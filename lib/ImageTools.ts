import { overlayLabel, KNOWN_COLORS, EXTRA_COLORS } from "./overlayConfig";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): RgbColor {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function lerpRgb(a: RgbColor, b: RgbColor, t: number): RgbColor {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/** Linearly interpolate between two hex colors. t=0 returns a, t=1 returns b. */
export function lerpHexColor(a: string, b: string, t: number): string {
  const c = lerpRgb(parseHex(a), parseHex(b), t);
  return `rgb(${c.r},${c.g},${c.b})`;
}

export type MaskColor = RgbColor;

export const MASK_WIDTH = 1920;
export const MASK_HEIGHT = 1080;

/**
 * Returns the display colour for a given label.
 * Looks up the label name in the curated `KNOWN_MASK_COLORS` table first;
 * falls back to a cycling palette for unknown labels.
 */
export function getColor(label: string, index: number): MaskColor {
  const hex = KNOWN_COLORS[label] ?? EXTRA_COLORS[index % EXTRA_COLORS.length];
  return parseHex(hex);
}

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

export function getOverlayFontSize(width: number): number {
  return overlayLabel.fontSize > 0
    ? overlayLabel.fontSize
    : Math.max(overlayLabel.minFontSize, Math.round(width / overlayLabel.autoScaleDivisor));
}

export function getLineWidth(
  config: { lineWidth: number; minWidth: number; autoScaleDivisor: number },
  canvasWidth: number,
): number {
  return config.lineWidth > 0
    ? config.lineWidth
    : Math.max(config.minWidth, Math.round(canvasWidth / config.autoScaleDivisor));
}

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

  ctx.fillStyle = `rgba(0,0,0,${overlayLabel.backgroundOpacity * alpha})`;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, overlayLabel.borderRadius);
  ctx.fill();

  ctx.strokeStyle = `rgba(0,0,0,0)`;
  ctx.lineWidth = overlayLabel.borderWidth;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, overlayLabel.borderRadius);
  ctx.stroke();

  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillText(label, 0, 0);
}
