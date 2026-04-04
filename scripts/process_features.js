#!/usr/bin/env node
/**
 * process_features.js
 *
 * Processes a project directory containing frame images and binary mask PNGs.
 * Outputs:
 *   1. labels.json        – Label Studio brush-RLE encoded masks
 *   2. labels_points.json – Douglas-Peucker simplified contour polygons
 *
 * Expected directory structure:
 *   <projectDir>/
 *     frames/               – frame_NNNNNN.png
 *     masks/
 *       class01_<name>/     – class01_NNNNNN.png  (binary 0/255)
 *       class02_<name>/     – class02_NNNNNN.png
 *       ...
 *     json/                 – ann_NNNNNN.json (optional, for class name mapping)
 *
 * Usage:
 *   node scripts/process_features.js [projectDir] [--epsilon=2] [--start=N] [--end=N]
 *
 * Defaults:
 *   projectDir → D:\Projects\Features
 *   epsilon    → 7 (Douglas-Peucker tolerance in pixels)
 *   start      → 0 (first frame)
 *   end        → (last frame)
 */

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of args) {
  const m = a.match(/^--(\w+)=(.+)$/);
  if (m) flags[m[1]] = m[2];
  else if (!a.startsWith("--")) positional.push(a);
}

const projectDir = path.resolve(positional[0] ?? "D:\\Projects\\Features");
const EPSILON = parseFloat(flags.epsilon ?? "7");
const startFrame = flags.start !== undefined ? parseInt(flags.start, 10) : null;
const endFrame = flags.end !== undefined ? parseInt(flags.end, 10) : null;

if (startFrame !== null && (isNaN(startFrame) || startFrame < 0)) {
  console.error(`Error: invalid --start value: ${flags.start}`);
  process.exit(1);
}
if (endFrame !== null && (isNaN(endFrame) || endFrame < 0)) {
  console.error(`Error: invalid --end value: ${flags.end}`);
  process.exit(1);
}
if (startFrame !== null && endFrame !== null && startFrame > endFrame) {
  console.error(`Error: --start (${startFrame}) must be <= --end (${endFrame})`);
  process.exit(1);
}

// ── Bit Stream Writer (reverse of BitInputStream in parse_rle.js) ─────────

class BitOutputStream {
  constructor() {
    this.bytes = [];
    this.currentByte = 0;
    this.bitInByte = 0;
  }

  write(value, numBits) {
    for (let i = numBits - 1; i >= 0; i--) {
      this.currentByte |= (((value >> i) & 1) << (7 - this.bitInByte));
      this.bitInByte++;
      if (this.bitInByte === 8) {
        this.bytes.push(this.currentByte);
        this.currentByte = 0;
        this.bitInByte = 0;
      }
    }
  }

  flush() {
    if (this.bitInByte > 0) {
      this.bytes.push(this.currentByte);
    }
    return this.bytes;
  }
}

// ── Encode binary mask → Label Studio brush RLE ───────────────────────────

function encodeBrushRLE(mask, width, height) {
  // Build RGBA: foreground → [255,255,255,255], background → [0,0,0,0]
  const numPixels = width * height;
  const num = numPixels * 4;
  const rgba = new Uint8Array(num);
  for (let p = 0; p < numPixels; p++) {
    if (mask[p]) {
      const off = p * 4;
      rgba[off] = 255;
      rgba[off + 1] = 255;
      rgba[off + 2] = 255;
      rgba[off + 3] = 255;
    }
  }

  const wordSize = 8;
  const rleSizes = [4, 8, 12, 16];

  const output = new BitOutputStream();

  // Header
  output.write(num, 32);
  output.write(wordSize - 1, 5);
  for (let k = 0; k < 4; k++) {
    output.write(rleSizes[k] - 1, 4);
  }

  // Body – encode runs of identical values
  let i = 0;
  while (i < num) {
    // Measure run length
    let runEnd = i + 1;
    while (runEnd < num && rgba[runEnd] === rgba[i]) {
      runEnd++;
    }

    let remaining = runEnd - i;
    const val = rgba[i];

    while (remaining > 0) {
      // Pick smallest sizeIdx whose max chunk (2^rleSizes[s]) >= remaining
      let sizeIdx = 3;
      for (let s = 0; s < 4; s++) {
        if (remaining <= (1 << rleSizes[s])) {
          sizeIdx = s;
          break;
        }
      }

      const maxChunk = 1 << rleSizes[sizeIdx];
      const chunkLen = Math.min(remaining, maxChunk);
      const runLen = chunkLen - 1;

      output.write(1, 1);                         // type = run
      output.write(sizeIdx, 2);                    // size index
      output.write(runLen, rleSizes[sizeIdx]);     // run length
      output.write(val, wordSize);                 // value

      remaining -= chunkLen;
    }

    i = runEnd;
  }

  return output.flush();
}

// ── Contour tracing (Moore-Neighbor) ──────────────────────────────────────
// Reused from parse_rle.js

function mooreTrace(mask, width, height, startX, startY) {
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  const getPixel = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return mask[y * width + x];
  };

  const contour = [{ x: startX, y: startY }];
  let cx = startX, cy = startY;
  let backDir = 4;
  const maxIter = width * height;
  let iter = 0;

  while (iter++ < maxIter) {
    const scanStart = (backDir + 1) % 8;
    let found = false;

    for (let i = 0; i < 8; i++) {
      const d = (scanStart + i) % 8;
      const nx = cx + dx[d];
      const ny = cy + dy[d];

      if (getPixel(nx, ny) === 1) {
        backDir = (d + 4) % 8;
        cx = nx;
        cy = ny;

        if (cx === startX && cy === startY) {
          return contour;
        }

        contour.push({ x: cx, y: cy });
        found = true;
        break;
      }
    }

    if (!found) break;
  }

  return contour;
}

function findContours(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const contours = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 0 || visited[idx]) continue;

      const isBoundary =
        x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
        mask[idx - 1] === 0 || mask[idx + 1] === 0 ||
        mask[idx - width] === 0 || mask[idx + width] === 0;

      if (!isBoundary) continue;

      const contour = mooreTrace(mask, width, height, x, y);
      if (contour.length >= 3) {
        for (const p of contour) {
          visited[p.y * width + p.x] = 1;
        }
        contours.push(contour);
      }
    }
  }

  return contours;
}

// ── Douglas-Peucker simplification (iterative) ───────────────────────────
// Reused from parse_rle.js

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

// ── Normalize points to 0–1 range ────────────────────────────────────────
// Reused from parse_rle.js

function normalizePoints(points, width, height) {
  return points.map((p) => ({
    x: parseFloat((p.x / (width - 1)).toFixed(6)),
    y: parseFloat((p.y / (height - 1)).toFixed(6)),
  }));
}

// ── PNG mask reader ───────────────────────────────────────────────────────

function readMaskPNG(filePath) {
  const buffer = fs.readFileSync(filePath);
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    // Red channel (grayscale PNGs are expanded to RGBA by pngjs)
    mask[i] = data[i * 4] > 127 ? 1 : 0;
  }
  return { mask, width, height };
}

// ── Class name resolver ───────────────────────────────────────────────────

function resolveClassNames(projectDir, classFolders) {
  // Try reading class_names from the first annotation JSON
  const jsonDir = path.join(projectDir, "json");
  if (fs.existsSync(jsonDir)) {
    const jsonFiles = fs.readdirSync(jsonDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    if (jsonFiles.length > 0) {
      try {
        const ann = JSON.parse(fs.readFileSync(path.join(jsonDir, jsonFiles[0]), "utf8"));
        if (ann.class_names) {
          const mapping = {};
          for (const folder of classFolders) {
            const m = folder.match(/^class(\d+)/);
            if (m) {
              const classId = String(parseInt(m[1], 10));
              mapping[folder] = ann.class_names[classId] || folder;
            }
          }
          return mapping;
        }
      } catch { /* fall through to derive from folder name */ }
    }
  }

  // Derive from folder name: class01_epicardial → "Epicardial"
  const mapping = {};
  for (const folder of classFolders) {
    const m = folder.match(/^class\d+_(.+)$/);
    mapping[folder] = m
      ? m[1].charAt(0).toUpperCase() + m[1].slice(1).replace(/_/g, " ")
      : folder;
  }
  return mapping;
}

// ── Process a single project ──────────────────────────────────────────────

function processProject(projectDir) {
  const projectName = path.basename(projectDir);
  const framesDir = path.join(projectDir, "frames");
  const masksDir = path.join(projectDir, "masks");

  if (!fs.existsSync(framesDir) || !fs.existsSync(masksDir)) {
    console.log(`  Skipping "${projectName}": missing frames/ or masks/`);
    return;
  }

  // Discover class folders
  const classFolders = fs.readdirSync(masksDir)
    .filter((f) => /^class\d+_/.test(f) && fs.statSync(path.join(masksDir, f)).isDirectory())
    .sort();

  if (classFolders.length === 0) {
    console.log(`  Skipping "${projectName}": no class mask folders found`);
    return;
  }

  // Resolve label names
  const classNames = resolveClassNames(projectDir, classFolders);
  console.log(`  Classes: ${classFolders.map((f) => `${f} → "${classNames[f]}"`).join(", ")}`);

  // List frame files sorted
  let frameFiles = fs.readdirSync(framesDir)
    .filter((f) => /\.(png|jpg|jpeg)$/i.test(f))
    .sort();

  if (startFrame !== null || endFrame !== null) {
    frameFiles = frameFiles.slice(startFrame ?? 0, endFrame !== null ? endFrame + 1 : undefined);
  }

  console.log(`  ${frameFiles.length} frame(s), ${classFolders.length} class(es)`);

  const rleOutput = [];
  const pointsOutput = [];
  let recordId = 0;
  const jsonDir = path.join(projectDir, "json");

  for (const frameFile of frameFiles) {
    // Extract frame number from filename
    const frameNumMatch = frameFile.match(/(\d{6})\.\w+$/);
    if (!frameNumMatch) continue;
    const frameNum = frameNumMatch[1];

    const rleEntry = { id: recordId, image: frameFile, tags: [] };
    const pointsEntry = { id: recordId, image: frameFile, zones: [], lines: [] };
    let hasData = false;
    let frameWidth = 0, frameHeight = 0;

    for (const classFolder of classFolders) {
      const label = classNames[classFolder];
      const classPrefix = classFolder.match(/^(class\d+)/)[1];
      const maskFile = `${classPrefix}_${frameNum}.png`;
      const maskPath = path.join(masksDir, classFolder, maskFile);

      if (!fs.existsSync(maskPath)) continue;

      try {
        const { mask, width, height } = readMaskPNG(maskPath);
        if (!frameWidth) { frameWidth = width; frameHeight = height; }

        // Count foreground pixels
        let fgCount = 0;
        for (let i = 0; i < mask.length; i++) fgCount += mask[i];
        if (fgCount === 0) continue;

        hasData = true;
        process.stdout.write(`  ${frameFile} / ${label}: ${fgCount} fg px…`);

        // 1. Encode to brush RLE
        const rle = encodeBrushRLE(mask, width, height);
        rleEntry.tags.push({ label, rle });

        // 2. Find contours + Douglas-Peucker
        const contours = findContours(mask, width, height);
        contours.sort((a, b) => b.length - a.length);
        const validContours = contours.filter((c) => c.length >= 3);

        const points = validContours.map((contour) => {
          const simplified = douglasPeucker(contour, EPSILON);
          return normalizePoints(simplified, width, height);
        });

        const totalPts = points.reduce((s, p) => s + p.length, 0);
        console.log(` ${validContours.length} contour(s), ${totalPts} pts`);

        pointsEntry.zones.push({ label, points });
      } catch (err) {
        console.log(` ERROR: ${err.message}`);
      }
    }

    // ── Process line annotations from json/ann_NNNNNN.json ──────────────────
    const annFile = path.join(jsonDir, `ann_${frameNum}.json`);
    if (fs.existsSync(annFile)) {
      try {
        const ann = JSON.parse(fs.readFileSync(annFile, "utf8"));

        // Fall back to reading the frame PNG for dimensions if no masks existed
        if (!frameWidth) {
          // Try image_size field first (fast)
          if (ann.image_size && ann.image_size.width) {
            frameWidth = ann.image_size.width;
            frameHeight = ann.image_size.height;
          } else {
            try {
              const buf = fs.readFileSync(path.join(framesDir, frameFile));
              const png = PNG.sync.read(buf);
              frameWidth = png.width;
              frameHeight = png.height;
            } catch { /* leave at 0 */ }
          }
        }

        if (frameWidth && frameHeight) {
          // centerline_segments: array of segments, each segment is [[x,y], [x,y], ...]
          if (Array.isArray(ann.centerline_segments) && ann.centerline_segments.length > 0) {
            // Always keep only the longest segment
            const longestSeg = ann.centerline_segments
              .filter((s) => Array.isArray(s) && s.length >= 2)
              .reduce((best, seg) => (seg.length > best.length ? seg : best), []);

            if (longestSeg.length >= 2) {
              const pts = longestSeg.map((p) => ({ x: p[0], y: p[1] }));
              const simplified = douglasPeucker(pts, EPSILON);
              const normalized = normalizePoints(simplified, frameWidth, frameHeight);
              pointsEntry.lines.push({ label: "Incision line", points: normalized });
              console.log(`  ${frameFile} / line "Incision line": ${pts.length} → ${simplified.length} pts`);
              hasData = true;
            }
          }
        }
      } catch (err) {
        console.log(`  WARN: Could not read ${annFile}: ${err.message}`);
      }
    }

    if (hasData) {
      rleOutput.push(rleEntry);
      pointsOutput.push(pointsEntry);
      recordId++;
    }
  }

  // Write outputs
  const rlePath = path.join(projectDir, "labels.json");
  const pointsPath = path.join(projectDir, "labels_points.json");

  fs.writeFileSync(rlePath, JSON.stringify(rleOutput, null, 2), "utf8");
  fs.writeFileSync(pointsPath, JSON.stringify(pointsOutput, null, 2), "utf8");

  console.log(`  Wrote ${rleOutput.length} record(s):`);
  console.log(`    → ${rlePath}`);
  console.log(`    → ${pointsPath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────

if (!fs.existsSync(projectDir)) {
  console.error(`Project directory not found: "${projectDir}"`);
  process.exit(1);
}

console.log(`Project: ${projectDir}`);
console.log(`Epsilon: ${EPSILON}`);
if (startFrame !== null || endFrame !== null) {
  console.log(`Range  : frames ${startFrame ?? 0} → ${endFrame ?? "end"}`);
}
console.log();

processProject(projectDir);

console.log("\nDone.");
