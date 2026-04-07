import { IGNORED_LABELS, segmentationMask } from "./overlayConfig";
import {
  decodeRLE,
  getLabelColor,
  setupCanvas,
  getOverlayFontSize,
  drawLabelBadge,
  MASK_WIDTH,
  MASK_HEIGHT,
  type LabelColor,
} from "./rleDecoder";

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

export function renderSegmentationOverlay(
  canvas: HTMLCanvasElement,
  tags: SegmentationTag[],
  width = MASK_WIDTH,
  height = MASK_HEIGHT,
  opacity = segmentationMask.opacity,
): LabelInfo[] {
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

  const fontSize = getOverlayFontSize(width);
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;

  for (const li of labels) {
    ctx.save();
    ctx.translate(li.cx - width * 0.015, li.cy + height * 0.015);
    drawLabelBadge(ctx, li.label, fontSize);
    ctx.restore();
  }

  return labels;
}
