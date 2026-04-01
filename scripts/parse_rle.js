#!/usr/bin/env node
/**
 * parse_rle.js
 *
 * Decodes Label Studio RLE segmentation masks from labels_parsed.json
 * and extracts boundary polygon points for each zone.
 *
 * The Label Studio brush RLE format:
 *   - Byte array interpreted as a bit stream
 *   - Header: 32-bit num (total RGBA values), 5-bit word_size-1, 4×4-bit rle_sizes
 *   - Body: bit-packed RLE of RGBA pixel data
 *   - Decoded array reshaped to [height, width, 4]; alpha channel = mask
 *
 * Usage:
 *   node scripts/parse_rle.js [input.json] [output.json] [--width=1920] [--height=1080] [--epsilon=2]
 *
 * Defaults:
 *   input   → scripts/labels_parsed.json
 *   output  → scripts/zones_parsed.json
 *   width   → 1920
 *   height  → 1080
 *   epsilon → 2 (Douglas-Peucker tolerance in pixels)
 */

const fs = require("fs");
const path = require("path");

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of args) {
  const m = a.match(/^--(\w+)=(.+)$/);
  if (m) flags[m[1]] = m[2];
  else if (!a.startsWith("--")) positional.push(a);
}

const inputPath = path.resolve(positional[0] ?? "scripts/labels_parsed.json");
let outputPath;
if (positional[1]) {
  outputPath = path.resolve(positional[1]);
} else {
  const ext = path.extname(inputPath);
  outputPath = path.join(path.dirname(inputPath), path.basename(inputPath, ext) + "_points" + ext);
}
const IMG_WIDTH = parseInt(flags.width ?? "1920", 10);
const IMG_HEIGHT = parseInt(flags.height ?? "1080", 10);
const EPSILON = parseFloat(flags.epsilon ?? "2");

// ── Bit Stream Reader ─────────────────────────────────────────────────────────

class BitInputStream {
  constructor(bytes) {
    this.bytes = bytes;
    this.bitPos = 0;
  }

  read(numBits) {
    let value = 0;
    for (let i = 0; i < numBits; i++) {
      const byteIndex = (this.bitPos >> 3);       // Math.floor(bitPos / 8)
      const bitIndex = 7 - (this.bitPos & 7);     // 7 - (bitPos % 8), MSB first
      if (byteIndex < this.bytes.length) {
        value = (value << 1) | ((this.bytes[byteIndex] >> bitIndex) & 1);
      } else {
        value = value << 1;
      }
      this.bitPos++;
    }
    return value;
  }
}

// ── RLE Decoder (Label Studio format) ─────────────────────────────────────────

function decodeRLE(rle) {
  const input = new BitInputStream(rle);
  const num = input.read(32);
  const wordSize = input.read(5) + 1;
  const rleSizes = [];
  for (let k = 0; k < 4; k++) {
    rleSizes.push(input.read(4) + 1);
  }

  const out = new Uint8Array(num);
  let i = 0;
  while (i < num) {
    const x = input.read(1);
    const sizeIdx = input.read(2);
    const runLen = input.read(rleSizes[sizeIdx]);
    const j = i + 1 + runLen;
    if (x) {
      // Run of identical values
      const val = input.read(wordSize);
      out.fill(val, i, Math.min(j, num));
      i = j;
    } else {
      // Sequence of individual values
      const end = Math.min(j, num);
      while (i < end) {
        out[i] = input.read(wordSize);
        i++;
      }
    }
  }

  return out;
}

// ── Extract binary mask from RGBA data ────────────────────────────────────────

function extractMask(rgba, width, height) {
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    // Alpha channel is every 4th byte (index 3, 7, 11, ...)
    mask[i] = rgba[i * 4 + 3] > 0 ? 1 : 0;
  }
  return mask;
}

// ── Contour tracing (Moore-Neighbor) ──────────────────────────────────────────

/**
 * Traces the outer boundary of a connected foreground region
 * using Moore-Neighbor tracing (clockwise).
 */
function mooreTrace(mask, width, height, startX, startY) {
  // 8-connected neighbors, clockwise: E, SE, S, SW, W, NW, N, NE
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  const getPixel = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return mask[y * width + x];
  };

  const contour = [{ x: startX, y: startY }];
  let cx = startX, cy = startY;
  // We entered from the West (pixel to the left), so backtrack direction is W = index 4
  let backDir = 4;

  const maxIter = width * height; // safety limit
  let iter = 0;

  while (iter++ < maxIter) {
    // Start scanning clockwise from one position after the backtrack direction
    const scanStart = (backDir + 1) % 8;
    let found = false;

    for (let i = 0; i < 8; i++) {
      const d = (scanStart + i) % 8;
      const nx = cx + dx[d];
      const ny = cy + dy[d];

      if (getPixel(nx, ny) === 1) {
        backDir = (d + 4) % 8; // opposite direction = where we came from
        cx = nx;
        cy = ny;

        if (cx === startX && cy === startY) {
          return contour; // closed loop
        }

        contour.push({ x: cx, y: cy });
        found = true;
        break;
      }
    }

    if (!found) break; // isolated pixel
  }

  return contour;
}

/**
 * Find all outer contours in a binary mask.
 * Returns an array of contours, each being an array of {x, y} points.
 */
function findContours(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const contours = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0 || visited[idx]) continue;

      // Check if this is a boundary pixel
      const isBoundary =
        x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
        mask[idx - 1] === 0 || mask[idx + 1] === 0 ||
        mask[idx - width] === 0 || mask[idx + width] === 0;

      if (!isBoundary) continue;

      const contour = mooreTrace(mask, width, height, x, y);
      if (contour.length >= 3) {
        // Mark all contour pixels as visited
        for (const p of contour) {
          visited[p.y * width + p.x] = 1;
        }
        contours.push(contour);
      }
    }
  }

  return contours;
}

// ── Douglas-Peucker simplification (iterative) ───────────────────────────────

function perpendicularDist(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  const ex = p.x - cx;
  const ey = p.y - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  // Iterative stack-based approach to avoid stack overflow on large inputs
  const stack = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxDist = 0;
    let maxIdx = start;

    for (let i = start + 1; i < end; i++) {
      const dist = perpendicularDist(points[i], points[start], points[end]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      keep[maxIdx] = 1;
      if (maxIdx - start > 1) stack.push([start, maxIdx]);
      if (end - maxIdx > 1) stack.push([maxIdx, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

// ── Normalize points to 0–1 range ────────────────────────────────────────────

function normalizePoints(points, width, height) {
  return points.map((p) => ({
    x: parseFloat((p.x / (width - 1)).toFixed(6)),
    y: parseFloat((p.y / (height - 1)).toFixed(6)),
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

let raw;
try {
  raw = fs.readFileSync(inputPath, "utf8");
} catch (err) {
  console.error(`Error reading "${inputPath}": ${err.message}`);
  process.exit(1);
}

let records;
try {
  records = JSON.parse(raw);
} catch (err) {
  console.error(`Error parsing JSON: ${err.message}`);
  process.exit(1);
}

console.log(`Processing ${records.length} record(s)…`);
console.log(`Image size: ${IMG_WIDTH}×${IMG_HEIGHT}, epsilon: ${EPSILON}`);

const output = [];

for (const record of records) {
  const imageEntry = { id: record.id, image: record.image, zones: [] };
  console.log(`\n── ${record.image} (${record.tags.length} tags) ──`);

  for (const tag of record.tags) {
    const label = tag.label;
    process.stdout.write(`  ${label}: decoding RLE (${tag.rle.length} bytes)…`);

    try {
      // 1. Decode RLE
      const rgba = decodeRLE(tag.rle);
      const expectedPixels = IMG_WIDTH * IMG_HEIGHT;

      if (rgba.length < expectedPixels * 4) {
        console.log(` skipped (decoded ${rgba.length} values, expected ${expectedPixels * 4})`);
        continue;
      }

      // 2. Extract binary mask
      const mask = extractMask(rgba, IMG_WIDTH, IMG_HEIGHT);

      // Count foreground pixels
      let fgCount = 0;
      for (let i = 0; i < mask.length; i++) fgCount += mask[i];
      process.stdout.write(` ${fgCount} fg pixels…`);

      if (fgCount === 0) {
        console.log(" empty mask, skipped.");
        continue;
      }

      // 3. Find contours
      const contours = findContours(mask, IMG_WIDTH, IMG_HEIGHT);
      if (contours.length === 0) {
        console.log(" no contours found.");
        continue;
      }

      // Sort contours by size descending, filter out tiny ones (< 3 pts)
      contours.sort((a, b) => b.length - a.length);
      const validContours = contours.filter((c) => c.length >= 3);
      process.stdout.write(` ${validContours.length} contour(s)…`);

      // 4. Simplify & normalize each contour
      const points = validContours.map((contour) => {
        const simplified = douglasPeucker(contour, EPSILON);
        return normalizePoints(simplified, IMG_WIDTH, IMG_HEIGHT);
      });

      const totalPts = points.reduce((s, p) => s + p.length, 0);
      console.log(` ${totalPts} pts total after simplify… done.`);

      imageEntry.zones.push({ label, points });
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
    }
  }

  output.push(imageEntry);
}

// ── Write output ──────────────────────────────────────────────────────────────

try {
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
} catch (err) {
  console.error(`Error writing "${outputPath}": ${err.message}`);
  process.exit(1);
}

console.log(`\nWrote ${output.length} record(s) → "${outputPath}"`);
