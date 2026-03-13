"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Point, Zone } from "@/lib/types";

interface SegmentationOverlayProps {
  zones: Zone[];
  activeZoneId: string | null;
  editMode: boolean;
  onUpdateZone: (zoneId: string, points: Point[]) => void;
}

export default function SegmentationOverlay({
  zones,
  activeZoneId,
  editMode,
  onUpdateZone,
}: SegmentationOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    zoneId: string;
    pointIndex: number;
  } | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDims({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  const px = useCallback(
    (p: Point) => ({ x: p.x * dims.w, y: p.y * dims.h }),
    [dims]
  );
  const norm = useCallback(
    (x: number, y: number): Point => ({
      x: Math.max(0, Math.min(1, x / dims.w)),
      y: Math.max(0, Math.min(1, y / dims.h)),
    }),
    [dims]
  );
  const svgCoords = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const handlePointDown = useCallback(
    (e: React.MouseEvent, zoneId: string, idx: number) => {
      e.stopPropagation();
      e.preventDefault();
      setDragging({ zoneId, pointIndex: idx });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const c = svgCoords(e);
      const n = norm(c.x, c.y);
      const zone = zones.find((z) => z.id === dragging.zoneId);
      if (!zone) return;
      const pts = [...zone.points];
      pts[dragging.pointIndex] = n;
      onUpdateZone(dragging.zoneId, pts);
    },
    [dragging, zones, svgCoords, norm, onUpdateZone]
  );

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const handleSvgClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || !activeZoneId || dragging) return;
      const c = svgCoords(e);
      const n = norm(c.x, c.y);
      const zone = zones.find((z) => z.id === activeZoneId);
      if (!zone) return;
      const pts = [...zone.points];
      const idx = findInsertIndex(pts, n);
      pts.splice(idx, 0, n);
      onUpdateZone(activeZoneId, pts);
    },
    [editMode, activeZoneId, dragging, zones, svgCoords, norm, onUpdateZone]
  );

  const handlePointContext = useCallback(
    (e: React.MouseEvent, zoneId: string, idx: number) => {
      e.preventDefault();
      e.stopPropagation();
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return;
      onUpdateZone(
        zoneId,
        zone.points.filter((_, i) => i !== idx)
      );
    },
    [zones, onUpdateZone]
  );

  const ready = dims.w > 0 && dims.h > 0;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full"
      {...(ready ? { viewBox: `0 0 ${dims.w} ${dims.h}` } : {})}
      style={{ pointerEvents: editMode ? "auto" : "none" }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleSvgClick}
    >
      {ready && (
        <defs>
          {zones
            .filter((zone) => zone.points.length >= 3)
            .map((zone) => {
              const patternId = hatchPatternId(zone.id);
              const hatchOpacity = Math.max(0.2, Math.min(1, zone.opacity + 0.2));
              return (
                <pattern
                  key={patternId}
                  id={patternId}
                  patternUnits="userSpaceOnUse"
                  width={16}
                  height={16}
                  patternTransform="rotate(25)"
                >
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={22}
                    stroke={zone.color}
                    strokeWidth={12}
                    strokeOpacity={hatchOpacity}
                  />
                </pattern>
              );
            })}
        </defs>
      )}
      {ready &&
        zones.map((zone) => {
          if (zone.points.length < 2) {
            // single point: show dot
            if (zone.points.length === 1 && editMode && zone.id === activeZoneId) {
              const p = px(zone.points[0]);
              return (
                <circle
                  key={zone.id}
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill="white"
                  stroke={zone.color}
                  strokeWidth={2}
                  style={{ cursor: "grab" }}
                  onMouseDown={(e) => handlePointDown(e, zone.id, 0)}
                  onContextMenu={(e) => handlePointContext(e, zone.id, 0)}
                />
              );
            }
            return null;
          }

          const pxPts = zone.points.map(px);
          const ptStr = pxPts.map((p) => `${p.x},${p.y}`).join(" ");
          const active = zone.id === activeZoneId;

          return (
            <g key={zone.id}>
              {zone.points.length >= 3 ? (
                <polygon
                  points={ptStr}
                  fill={`url(#${hatchPatternId(zone.id)})`}
                  stroke={zone.color}
                  strokeWidth={active && editMode ? 2 : 1}
                  strokeOpacity={0.8}
                  strokeDasharray={active && editMode ? "6 3" : "none"}
                />
              ) : (
                <line
                  x1={pxPts[0].x}
                  y1={pxPts[0].y}
                  x2={pxPts[1].x}
                  y2={pxPts[1].y}
                  stroke={zone.color}
                  strokeWidth={2}
                  strokeOpacity={0.8}
                />
              )}

              {/* Label */}
              {zone.points.length >= 3 && (
                <text
                  x={centroidOf(pxPts).x}
                  y={centroidOf(pxPts).y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={12}
                  fontWeight="bold"
                  style={{
                    textShadow:
                      "0 0 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  {zone.name}
                </text>
              )}

              {/* Handles */}
              {editMode &&
                active &&
                pxPts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill="white"
                    stroke={zone.color}
                    strokeWidth={2}
                    style={{ cursor: "grab" }}
                    onMouseDown={(e) => handlePointDown(e, zone.id, i)}
                    onContextMenu={(e) => handlePointContext(e, zone.id, i)}
                  />
                ))}
            </g>
          );
        })}
    </svg>
  );
}

/* ── helpers ── */

function centroidOf(pts: { x: number; y: number }[]) {
  const s = pts.reduce(
    (a, p) => ({ x: a.x + p.x, y: a.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: s.x / pts.length, y: s.y / pts.length };
}

function findInsertIndex(points: Point[], pt: Point): number {
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

function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hatchPatternId(zoneId: string): string {
  return `zone-hatch-${zoneId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
