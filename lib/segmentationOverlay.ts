import { IGNORED_LABELS, segmentationMask } from "./overlayConfig";
import {
  getColor,
  setupCanvas,
  getOverlayFontSize,
  drawLabelBadge,
  MASK_WIDTH,
  MASK_HEIGHT,
  type MaskColor,
} from "./ImageTools";

// Decode RLE moved here from the previous rle decoder module
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

export interface SegmentationTag {
  label: string;
  rle: number[];
}

export interface MaskInfo {
  label: string;
  color: MaskColor;
  cx: number;
  cy: number;
}

export function renderSegmentationOverlay(
  canvas: HTMLCanvasElement,
  tags: SegmentationTag[],
  width = MASK_WIDTH,
  height = MASK_HEIGHT,
  opacity = segmentationMask.opacity,
): MaskInfo[] {
  const ctx = setupCanvas(canvas, width, height);

  const totalPixels = width * height;

  tags = tags.filter((t) => !IGNORED_LABELS.has(t.label));

  const labelIndex = new Map<string, number>();
  let idx = 0;
  for (const tag of tags) {
    if (!labelIndex.has(tag.label)) labelIndex.set(tag.label, idx++);
  }

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

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const alpha = Math.round(opacity * 255);

  for (const [label] of labelIndex) {
    const { mask } = perLabel.get(label)!;
    const color = getColor(label, labelIndex.get(label)!);
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

  const masks: MaskInfo[] = [];
  for (const [label] of labelIndex) {
    const entry = perLabel.get(label)!;
    if (entry.count === 0) continue;
    masks.push({
      label,
      color: getColor(label, labelIndex.get(label)!),
      cx: entry.sumX / entry.count,
      cy: entry.sumY / entry.count,
    });
  }

  const fontSize = getOverlayFontSize(width);
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;

  for (const li of masks) {
    ctx.save();
    ctx.translate(li.cx - width * 0.015, li.cy + height * 0.015);
    drawLabelBadge(ctx, li.label, fontSize);
    ctx.restore();
  }

  return masks;
}
