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
