import {
  boundaryLine,
  boundaryFill,
  overlayLabel,
  annotationLine,
  IGNORED_LABELS,
} from "./overlayConfig";
import { BoundaryAnimationManager } from "./BoundaryAnimationManager";
import { classifyZone } from "./ZoneFactory";
import { SafeZone, DangerZone, OtherZone, HiddenZone } from "./types";
import { parseHex, lerpRgb } from "./ImageTools";
import {
  getColor,
  setupCanvas,
  getOverlayFontSize,
  getLineWidth,
  drawLabelBadge,
  MASK_WIDTH,
  MASK_HEIGHT,
  type MaskColor,
} from "./ImageTools";

// Derive boundary colors directly from the class defaults so any change there
// is automatically reflected here.
const _safe = new SafeZone("", "");
const _danger = new DangerZone("", "");
const _other = new OtherZone("", "");
const _hidden = new HiddenZone("", "");
const CLASSIFIED_COLORS: Record<string, MaskColor> = {
  danger:  parseHex(_danger.color),
  safe:    parseHex(_safe.color),
  other:   parseHex(_other.color),
  unknown: parseHex(_hidden.color),
};

export interface BoundaryZone {
  label: string;
  points: { x: number; y: number }[][] | { x: number; y: number }[];
}

export interface LineAnnotation {
  label: string;
  points: { x: number; y: number }[];
}

export interface BoundaryRecord {
  image: string;
  zones: BoundaryZone[];
  lines?: LineAnnotation[];
}

/** Normalize points field to always be an array of polygons. */
function normalizePolygons(
  points: { x: number; y: number }[][] | { x: number; y: number }[],
): { x: number; y: number }[][] {
  if (points.length === 0) return [];
  if ("x" in points[0]) return [points as { x: number; y: number }[]];
  return points as { x: number; y: number }[][];
}

/** Returns the boundary stroke/fill colour for a zone based on its danger classification. */
function getBoundaryColor(label: string): MaskColor {
  return CLASSIFIED_COLORS[classifyZone(label)];
}

export function renderBoundaryOverlay(
  canvas: HTMLCanvasElement,
  zones: BoundaryZone[],
  width = MASK_WIDTH,
  height = MASK_HEIGHT,
  animManager?: BoundaryAnimationManager,
  showSafeZones = false,
): void {
  const ctx = setupCanvas(canvas, width, height);

  const visibleZones = (showSafeZones ? zones : zones.filter((z) => classifyZone(z.label) !== "safe"))
    .filter((z) => !IGNORED_LABELS.has(z.label));

  const labelIndex = new Map<string, number>();
  let idx = 0;
  for (const z of visibleZones) {
    if (!labelIndex.has(z.label)) labelIndex.set(z.label, idx++);
  }

  const lineWidth = getLineWidth(boundaryLine, width);
  const lineDash =
    boundaryLine.style === "dashed"
      ? [boundaryLine.dashLength, boundaryLine.gapLength]
      : [];

  for (const zone of visibleZones) {
    const polygons = normalizePolygons(zone.points);
    const color = getBoundaryColor(zone.label);
    const zoneAlpha = animManager?.getHint(zone.label)?.opacity ?? 1;

    for (const poly of polygons) {
      if (poly.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(poly[0].x * (width - 1), poly[0].y * (height - 1));
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x * (width - 1), poly[i].y * (height - 1));
      }
      ctx.closePath();

      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${boundaryFill.opacity * zoneAlpha})`;
      ctx.fill();

      ctx.setLineDash(lineDash);
      ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${boundaryLine.opacity * zoneAlpha})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const fontSize = getOverlayFontSize(width);
  ctx.font = `${fontSize}px system-ui, sans-serif`;

  for (const zone of visibleZones) {
    const polygons = normalizePolygons(zone.points);
    const hint = animManager?.getHint(zone.label);
    const labelAlpha = hint?.labelOpacity ?? 1;
    const scale = hint?.labelScale ?? 1;
    const offY = hint?.labelOffsetY ?? 0;
    let cx = 0, cy = 0, total = 0;
    for (const poly of polygons) {
      for (const p of poly) { cx += p.x; cy += p.y; total++; }
    }
    if (total < 3) continue;

    const rawX = (cx / total) * (width - 1);
    const rawY = (cy / total) * (height - 1) + offY;

    const smoothed = animManager
      ? animManager.smoothCentroid(zone.label, rawX, rawY)
      : { x: rawX, y: rawY };

    ctx.save();
    ctx.translate(smoothed.x - width * 0.015, smoothed.y + height * 0.04);
    ctx.scale(scale, scale);

    const bh = fontSize + overlayLabel.paddingY * 2;
    drawLabelBadge(ctx, zone.label, fontSize, labelAlpha);

    if (hint?.flashing) {
      const iconAlpha = hint.opacity;
      const svgH = 13;
      const scale2 = (bh / svgH) * 0.7;
      const gap = 8;
      const bw = ctx.measureText(zone.label).width + overlayLabel.paddingX * 2;
      const cx2 = -bw / 2 - gap - 7 * scale2;

      ctx.save();
      ctx.translate(cx2, 0);
      ctx.scale(scale2, scale2);

      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, 5);
      ctx.lineTo(-7, 5);
      ctx.closePath();

      ctx.fillStyle = `rgba(250,204,21,${iconAlpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(146,64,14,${iconAlpha})`;
      ctx.lineWidth = 1 / scale2;
      ctx.stroke();

      ctx.fillStyle = `rgba(28,25,23,${iconAlpha})`;
      ctx.font = `bold 7px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", 0, 2);

      ctx.restore();

      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    }

    ctx.restore();
  }
}

export function renderLinesOverlay(
  canvas: HTMLCanvasElement,
  lines: LineAnnotation[],
  width = MASK_WIDTH,
  height = MASK_HEIGHT,
  animManager?: BoundaryAnimationManager,
): void {
  const ctx = setupCanvas(canvas, width, height);

  const labelIndex = new Map<string, number>();
  let idx = 0;
  for (const line of lines) {
    if (!labelIndex.has(line.label)) labelIndex.set(line.label, idx++);
  }

  const lineWidth = getLineWidth(annotationLine, width);
  const fontSize = getOverlayFontSize(width);

  ctx.lineJoin = "round";

  const lineDash =
    annotationLine.style === "dashed"
      ? [annotationLine.dashLength, annotationLine.gapLength]
      : [];

  for (const line of lines) {
    if (line.points.length < 2) continue;
    const color = getColor(line.label, labelIndex.get(line.label)!);

    const area = annotationLine.area;
    if (area.bands > 0 && area.width > 0) {
      const outerRgb = parseHex(area.outerColor);
      const bands = area.bands;
      ctx.setLineDash([]);
      ctx.lineCap = "round";
      for (let bi = 0; bi < bands; bi++) {
        const t = bands > 1 ? bi / (bands - 1) : 1;
        const w = area.width * (1 - t * 0.7);
        const bandColor = lerpRgb(outerRgb, color, t);
        const opacity = area.opacity * (0.4 + 0.6 * t);
        ctx.strokeStyle = `rgba(${bandColor.r},${bandColor.g},${bandColor.b},${opacity})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(line.points[0].x * (width - 1), line.points[0].y * (height - 1));
        for (let pi = 1; pi < line.points.length; pi++) {
          ctx.lineTo(line.points[pi].x * (width - 1), line.points[pi].y * (height - 1));
        }
        ctx.stroke();
      }
      ctx.lineCap = "butt";
    }

    ctx.setLineDash(lineDash);
    ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${annotationLine.opacity})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(line.points[0].x * (width - 1), line.points[0].y * (height - 1));
    for (let i = 1; i < line.points.length; i++) {
      ctx.lineTo(line.points[i].x * (width - 1), line.points[i].y * (height - 1));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    if (!annotationLine.showLabel) continue;
    const mid = line.points[Math.floor(line.points.length / 2)];
    const rawMx = mid.x * (width - 1) - width * 0.12;
    const rawMy = mid.y * (height - 1) + height * 0.04;
    const smoothed = animManager
      ? animManager.smoothCentroid(line.label, rawMx, rawMy)
      : { x: rawMx, y: rawMy };
    const mx = smoothed.x;
    const my = smoothed.y;
    ctx.font = `${fontSize}px system-ui, sans-serif`;
    ctx.save();
    ctx.translate(mx, my);
    drawLabelBadge(ctx, line.label, fontSize);
    ctx.restore();
  }
}
