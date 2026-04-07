/** Client-side Label Studio brush-RLE decoder and shared canvas overlay utilities.
 *
 * Format (bit-stream):
 *   32-bit total RGBA values, 5-bit (wordSize-1), 4×4-bit rleSizes,
 *   then bit-packed RLE of RGBA pixel data.
 *  Alpha channel (every 4th value) indicates mask foreground.
 */
import { overlayLabel } from "./overlayConfig";
import { type RgbColor } from "./colors";

export type MaskColor = RgbColor;

export const MASK_WIDTH = 1920;
export const MASK_HEIGHT = 1080;

// ── Bit Stream Reader ─────────────────────────────────────────────────────────

/**
 * Reads an arbitrary number of bits sequentially from a byte array.
 * The stream is treated as a big-endian bit sequence: the most-significant
 * bit of byte 0 is bit 0.
 */
class BitInputStream {
  private bytes: number[];
  private bitPos = 0;

  constructor(bytes: number[]) {
    this.bytes = bytes;
  }

  /** Reads `numBits` bits from the stream and returns them as an unsigned integer. */
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

/**
 * Decodes a Label Studio brush-RLE payload and returns the raw RGBA byte
 * array.  The returned buffer has length `totalValues` where every group of
 * four bytes represents one pixel (R, G, B, A).  A non-zero alpha channel
 * indicates a foreground (masked) pixel.
 */
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

const KNOWN_COLORS: Record<string, MaskColor> = {
  "Phrenic nerve": { r: 50, g: 150, b: 255 },
  Grasper: { r: 50, g: 220, b: 100 },
  Pericardium: { r: 255, g: 80, b: 80 },
  "Epicardial adipose tissue": { r: 249, g: 115, b: 22 },
  "Incision line": { r: 50, g: 220, b: 80 },
  Centerline: { r: 50, g: 220, b: 80 },
  "Anterior MV (A1)": { r: 0, g: 150, b: 200 },   // teal-blue
  "Anterior MV (A2)": { r: 0, g: 230, b: 200 },   // cyan-green
  // "Artificial Chordae": { r: 0, g: 230, b: 200 },
  // "MV annuloplasty suture": { r: 0, g: 230, b: 200 },
  "MV anterior annulus": { r: 173, g: 255, b: 47 }, // green-yellow (lime)
  "MV posterior annulus": { r: 45, g: 212, b: 191 },// aquamarine
  "Native Chordae": { r: 255, g: 195, b: 0 },     // amber/gold
  "Posterior MV (P1)": { r: 255, g: 90, b: 90 },   // coral red
  "Posterior MV (P2)": { r: 255, g: 130, b: 70 },  // orange-red
  "Posterior MV (P3)": { r: 255, g: 110, b: 180 }, // pink
  "Posterior Papillary Muscle MV": { r: 125, g: 75, b: 255 }, // violet
};

const EXTRA_COLORS: MaskColor[] = [
  { r: 180, g: 100, b: 255 },
  { r: 255, g: 160, b: 50 },
  { r: 100, g: 255, b: 255 },
  { r: 255, g: 100, b: 200 },
];

/**
 * Returns the display colour for a given label.
 * Looks up the label name in the curated `KNOWN_COLORS` table first;
 * falls back to a cycling palette for unknown labels.
 */
export function getMaskColor(label: string, index: number): MaskColor {
  return KNOWN_COLORS[label] ?? EXTRA_COLORS[index % EXTRA_COLORS.length];
}

// ── Shared canvas / overlay helpers ──────────────────────────────────────────

/**
 * Resets a canvas to the given dimensions, clears it, and returns its 2-D
 * rendering context.  Centralises the boilerplate that every render function
 * would otherwise repeat.
 */
export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

/**
 * Returns the overlay label font size.  Honours the explicit `overlayLabel.fontSize`
 * config value when set; otherwise scales automatically from the canvas width.
 */
export function getOverlayFontSize(width: number): number {
  return overlayLabel.fontSize > 0
    ? overlayLabel.fontSize
    : Math.max(overlayLabel.minFontSize, Math.round(width / overlayLabel.autoScaleDivisor));
}

/**
 * Derives a canvas stroke width from a config object that supports either an
 * explicit pixel value (`config.lineWidth > 0`) or automatic scaling relative
 * to the canvas width.
 */
export function getLineWidth(
  config: { lineWidth: number; minWidth: number; autoScaleDivisor: number },
  canvasWidth: number,
): number {
  return config.lineWidth > 0
    ? config.lineWidth
    : Math.max(config.minWidth, Math.round(canvasWidth / config.autoScaleDivisor));
}

/**
 * Draws a rounded-rect label badge with white text centred at the canvas
 * origin.  Must be called inside a `ctx.save()` / `ctx.translate(x, y)` /
 * `ctx.restore()` block so the caller controls position.  The caller must
 * also set `ctx.font` before calling so that `measureText` returns the
 * correct width.
 *
 * @param alpha - Opacity multiplier applied to both the background and the
 *   text (0–1).  Defaults to 1 (fully opaque).
 */
export function drawLabelBadge(
  ctx: CanvasRenderingContext2D,
  label: string,
  fontSize: number,
  alpha = 1,
): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const m = ctx.measureText(label);
  const bw = m.width + overlayLabel.paddingX * 2;
  const bh = fontSize + overlayLabel.paddingY * 2;

  // Semi-transparent dark background
  ctx.fillStyle = `rgba(0,0,0,${overlayLabel.backgroundOpacity * alpha})`;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, overlayLabel.borderRadius);
  ctx.fill();

  // Transparent stroke — kept to maintain consistent canvas state
  ctx.strokeStyle = `rgba(0,0,0,0)`;
  ctx.lineWidth = overlayLabel.borderWidth;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, overlayLabel.borderRadius);
  ctx.stroke();

  // White label text
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillText(label, 0, 0);
}
