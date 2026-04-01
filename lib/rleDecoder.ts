/** Client-side Label Studio brush-RLE decoder.
 *
 * Format (bit-stream):
 *   32-bit total RGBA values, 5-bit (wordSize-1), 4×4-bit rleSizes,
 *   then bit-packed RLE of RGBA pixel data.
 *  Alpha channel (every 4th value) indicates mask foreground.
 */

export const MASK_WIDTH = 1920;
export const MASK_HEIGHT = 1080;

// ── Bit Stream Reader ─────────────────────────────────────────────────────────

class BitInputStream {
  private bytes: number[];
  private bitPos = 0;

  constructor(bytes: number[]) {
    this.bytes = bytes;
  }

  read(numBits: number): number {
    let value = 0;
    for (let i = 0; i < numBits; i++) {
      const byteIndex = this.bitPos >> 3;
      const bitIndex = 7 - (this.bitPos & 7);
      if (byteIndex < this.bytes.length) {
        value = (value << 1) | ((this.bytes[byteIndex] >> bitIndex) & 1);
      } else {
        value <<= 1;
      }
      this.bitPos++;
    }
    return value;
  }
}

// ── RLE Decoder ───────────────────────────────────────────────────────────────

export function decodeRLE(rle: number[]): Uint8Array {
  const input = new BitInputStream(rle);
  const num = input.read(32);
  const wordSize = input.read(5) + 1;
  const rleSizes: number[] = [];
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
      const val = input.read(wordSize);
      out.fill(val, i, Math.min(j, num));
      i = j;
    } else {
      const end = Math.min(j, num);
      while (i < end) {
        out[i] = input.read(wordSize);
        i++;
      }
    }
  }

  return out;
}

// ── Label colours ─────────────────────────────────────────────────────────────

export interface LabelColor {
  r: number;
  g: number;
  b: number;
}

const KNOWN_COLORS: Record<string, LabelColor> = {
  "Phrenic nerve": { r: 50, g: 150, b: 255 },
  Grasper: { r: 50, g: 220, b: 100 },
  Pericardium: { r: 255, g: 80, b: 80 },
  "Epicardial adipose tissue": { r: 255, g: 220, b: 50 },
};

const EXTRA_COLORS: LabelColor[] = [
  { r: 180, g: 100, b: 255 },
  { r: 255, g: 160, b: 50 },
  { r: 100, g: 255, b: 255 },
  { r: 255, g: 100, b: 200 },
];

function getLabelColor(label: string, index: number): LabelColor {
  return KNOWN_COLORS[label] ?? EXTRA_COLORS[index % EXTRA_COLORS.length];
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface SegmentationTag {
  label: string;
  rle: number[];
}

export interface LabelInfo {
  label: string;
  color: LabelColor;
  cx: number;
  cy: number;
}

// ── Render all masks for one image onto a canvas ──────────────────────────────

export function renderSegmentationOverlay(
  canvas: HTMLCanvasElement,
  tags: SegmentationTag[],
  width = MASK_WIDTH,
  height = MASK_HEIGHT,
  opacity = 0.45,
): LabelInfo[] {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  const totalPixels = width * height;

  // Assign a stable colour index to each unique label
  const labelIndex = new Map<string, number>();
  let idx = 0;
  for (const tag of tags) {
    if (!labelIndex.has(tag.label)) labelIndex.set(tag.label, idx++);
  }

  // Union masks per label + accumulate centroid
  const perLabel = new Map<
    string,
    { mask: Uint8Array; sumX: number; sumY: number; count: number }
  >();
  for (const [label] of labelIndex) {
    perLabel.set(label, {
      mask: new Uint8Array(totalPixels),
      sumX: 0,
      sumY: 0,
      count: 0,
    });
  }

  for (const tag of tags) {
    const rgba = decodeRLE(tag.rle);
    if (rgba.length < totalPixels * 4) continue;

    const entry = perLabel.get(tag.label)!;
    for (let i = 0; i < totalPixels; i++) {
      if (rgba[i * 4 + 3] > 0 && !entry.mask[i]) {
        entry.mask[i] = 1;
        entry.sumX += i % width;
        entry.sumY += Math.floor(i / width);
        entry.count++;
      }
    }
  }

  // Paint pixel data
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const alpha = Math.round(opacity * 255);

  for (const [label] of labelIndex) {
    const { mask } = perLabel.get(label)!;
    const color = getLabelColor(label, labelIndex.get(label)!);
    for (let i = 0; i < totalPixels; i++) {
      if (mask[i]) {
        const off = i * 4;
        data[off] = color.r;
        data[off + 1] = color.g;
        data[off + 2] = color.b;
        data[off + 3] = alpha;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Collect label centroids
  const labels: LabelInfo[] = [];
  for (const [label] of labelIndex) {
    const entry = perLabel.get(label)!;
    if (entry.count === 0) continue;
    labels.push({
      label,
      color: getLabelColor(label, labelIndex.get(label)!),
      cx: entry.sumX / entry.count,
      cy: entry.sumY / entry.count,
    });
  }

  // Draw label badges
  const fontSize = Math.max(14, Math.round(width / 110));
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const li of labels) {
    const m = ctx.measureText(li.label);
    const px = 8;
    const py = 5;
    const bw = m.width + px * 2;
    const bh = fontSize + py * 2;
    const x = li.cx;
    const y = li.cy;

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 4);
    ctx.fill();

    ctx.strokeStyle = `rgb(${li.color.r},${li.color.g},${li.color.b})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 4);
    ctx.stroke();

    ctx.fillStyle = `rgb(${li.color.r},${li.color.g},${li.color.b})`;
    ctx.fillText(li.label, x, y);
  }

  return labels;
}

// ── Boundary (polygon) overlay ────────────────────────────────────────────────

export interface BoundaryZone {
  label: string;
  points: { x: number; y: number }[][] | { x: number; y: number }[];
}

export interface BoundaryRecord {
  image: string;
  zones: BoundaryZone[];
}

/** Normalize points field to always be an array of polygons. */
function normalizePolygons(
  points: { x: number; y: number }[][] | { x: number; y: number }[],
): { x: number; y: number }[][] {
  if (points.length === 0) return [];
  // If the first element has x/y, it's a single flat polygon
  if ("x" in points[0]) return [points as { x: number; y: number }[]];
  return points as { x: number; y: number }[][];
}

export function renderBoundaryOverlay(
  canvas: HTMLCanvasElement,
  zones: BoundaryZone[],
  width = MASK_WIDTH,
  height = MASK_HEIGHT,
): void {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  // Assign stable colour index
  const labelIndex = new Map<string, number>();
  let idx = 0;
  for (const z of zones) {
    if (!labelIndex.has(z.label)) labelIndex.set(z.label, idx++);
  }

  const lineWidth = Math.max(2, Math.round(width / 600));

  for (const zone of zones) {
    const polygons = normalizePolygons(zone.points);
    const color = getLabelColor(zone.label, labelIndex.get(zone.label)!);

    for (const poly of polygons) {
      if (poly.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(poly[0].x * (width - 1), poly[0].y * (height - 1));
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x * (width - 1), poly[i].y * (height - 1));
      }
      ctx.closePath();

      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},0.12)`;
      ctx.fill();

      ctx.strokeStyle = `rgb(${color.r},${color.g},${color.b})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  // Labels at combined centroid of all polygons per zone
  const fontSize = Math.max(14, Math.round(width / 110));
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const zone of zones) {
    const polygons = normalizePolygons(zone.points);
    const color = getLabelColor(zone.label, labelIndex.get(zone.label)!);
    let cx = 0, cy = 0, total = 0;
    for (const poly of polygons) {
      for (const p of poly) { cx += p.x; cy += p.y; total++; }
    }
    if (total < 3) continue;
    cx = (cx / total) * (width - 1);
    cy = (cy / total) * (height - 1);

    const m = ctx.measureText(zone.label);
    const px = 8, py = 5;
    const bw = m.width + px * 2;
    const bh = fontSize + py * 2;

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 4);
    ctx.fill();

    ctx.strokeStyle = `rgb(${color.r},${color.g},${color.b})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 4);
    ctx.stroke();

    ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
    ctx.fillText(zone.label, cx, cy);
  }
}
