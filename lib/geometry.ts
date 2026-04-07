import type { Point } from "./types";

export function centroidOf(pts: { x: number; y: number }[]): { x: number; y: number } {
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

export function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Find the best index to insert a new point into a closed polygon. */
export function findInsertIndex(points: Point[], pt: Point): number {
  if (points.length < 2) return points.length;
  let min = Infinity;
  let idx = points.length;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const d = segDist(pt, points[i], points[j]);
    if (d < min) {
      min = d;
      idx = j === 0 ? points.length : j;
    }
  }
  return idx;
}

/** For open polylines (safe zones): find the best segment to insert a new point into. */
export function findLineInsertIndex(points: Point[], pt: Point): number {
  if (points.length < 2) return points.length;
  let min = Infinity;
  let idx = points.length;
  for (let i = 0; i < points.length - 1; i++) {
    const d = segDist(pt, points[i], points[i + 1]);
    if (d < min) {
      min = d;
      idx = i + 1;
    }
  }
  const dEnd = Math.hypot(pt.x - points[points.length - 1].x, pt.y - points[points.length - 1].y);
  const dStart = Math.hypot(pt.x - points[0].x, pt.y - points[0].y);
  if (dEnd < min) return points.length;
  if (dStart < min) return 0;
  return idx;
}

type XY = { x: number; y: number };

/** Find where the ray from `from` toward `to` first intersects the polygon edge. */
export function closestEdgePoint(from: XY, to: XY, polygon: XY[]): XY {
  let best: XY = to;
  let bestT = Infinity;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) continue;
    const t = ((a.x - from.x) * ey - (a.y - from.y) * ex) / denom;
    const u = ((a.x - from.x) * dy - (a.y - from.y) * dx) / denom;
    if (t > 0 && u >= 0 && u <= 1 && t < bestT) {
      bestT = t;
      best = { x: from.x + t * dx, y: from.y + t * dy };
    }
  }
  return best;
}
