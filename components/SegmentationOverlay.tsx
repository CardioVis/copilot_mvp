"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Point } from "@/lib/types";
import {
  hatch,
  safeZoneLine,
  safeZoneArea,
  getHatchOpacity,
  getFill,
  getFillOpacity,
  getStroke,
  getStrokeWidth,
  getStrokeDasharray,
  getStrokeOpacity,
} from "@/lib/zoneStyles";
import { centroidOf, findInsertIndex, findLineInsertIndex, closestEdgePoint } from "@/lib/geometry";
import { lerpHexColor } from "@/lib/colors";
import { useZoneEditor } from "@/contexts/ZoneEditorContext";

export default function SegmentationOverlay() {
  const {
    zones,
    safeZones,
    activeZoneId,
    editMode,
    updateZone,
    updateSafeZone,
    animGroupOpacity,
    labelScale,
    showDangerIcon,
    dangerBlinkOn,
  } = useZoneEditor();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{
    zoneId: string;
    pointIndex?: number;
    isLabel?: boolean;
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
    (e: React.PointerEvent, zoneId: string, idx: number) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      setDragging({ zoneId, pointIndex: idx });
    },
    []
  );

  const handleLabelDown = useCallback(
    (e: React.PointerEvent, zoneId: string) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      setDragging({ zoneId, isLabel: true });
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const c = svgCoords(e);
      const n = norm(c.x, c.y);

      // Try danger zone first, then safe zone
      const zone = zones.find((z) => z.id === dragging.zoneId);
      if (zone) {
        if (dragging.isLabel) {
          updateZone(dragging.zoneId, { labelPos: n });
        } else if (dragging.pointIndex !== undefined) {
          const pts = [...zone.points];
          pts[dragging.pointIndex] = n;
          updateZone(dragging.zoneId, { points: pts });
        }
        return;
      }

      const sz = safeZones.find((z) => z.id === dragging.zoneId);
      if (sz) {
        if (dragging.isLabel) {
          updateSafeZone(dragging.zoneId, { labelPos: n });
        } else if (dragging.pointIndex !== undefined) {
          const pts = [...sz.points];
          pts[dragging.pointIndex] = n;
          updateSafeZone(dragging.zoneId, { points: pts });
        }
      }
    },
    [dragging, zones, safeZones, svgCoords, norm, updateZone, updateSafeZone]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(null);
  }, []);

  const handleSvgClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editMode || !activeZoneId || dragging) return;
      if ((e.target as Element).tagName === "rect" || (e.target as Element).tagName === "text") return;

      const c = svgCoords(e);
      const n = norm(c.x, c.y);

      // Try danger zone first
      const zone = zones.find((z) => z.id === activeZoneId);
      if (zone) {
        const pts = [...zone.points];
        const idx = findInsertIndex(pts, n);
        pts.splice(idx, 0, n);
        updateZone(activeZoneId, { points: pts });
        return;
      }

      // Try safe zone — for safe zones, always append to end (line, not closed shape)
      const sz = safeZones.find((z) => z.id === activeZoneId);
      if (sz) {
        const pts = [...sz.points];
        if (pts.length < 2) {
          pts.push(n);
        } else {
          const idx = findLineInsertIndex(pts, n);
          pts.splice(idx, 0, n);
        }
        updateSafeZone(activeZoneId, { points: pts });
      }
    },
    [editMode, activeZoneId, dragging, zones, safeZones, svgCoords, norm, updateZone, updateSafeZone]
  );

  const handlePointContext = useCallback(
    (e: React.MouseEvent, zoneId: string, idx: number) => {
      e.preventDefault();
      e.stopPropagation();
      const zone = zones.find((z) => z.id === zoneId);
      if (zone) {
        updateZone(zoneId, { points: zone.points.filter((_, i) => i !== idx) });
        return;
      }
      const sz = safeZones.find((z) => z.id === zoneId);
      if (sz) {
        updateSafeZone(zoneId, { points: sz.points.filter((_, i) => i !== idx) });
      }
    },
    [zones, safeZones, updateZone, updateSafeZone]
  );

  const ready = dims.w > 0 && dims.h > 0;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 h-full w-full"
      {...(ready ? { viewBox: `0 0 ${dims.w} ${dims.h}` } : {})}
      style={{ pointerEvents: editMode ? "auto" : "none" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleSvgClick}
    >
      {ready && (
        <defs>
          {zones
            .filter((zone) => zone.visible !== false && zone.points.length >= 3)
            .map((zone) => {
              const patternId = hatchPatternId(zone.id);
              const hatchOpacity = getHatchOpacity(zone.opacity);
              return (
                <pattern
                  key={patternId}
                  id={patternId}
                  patternUnits="userSpaceOnUse"
                  width={hatch.spacing}
                  height={hatch.spacing}
                  patternTransform={`rotate(${hatch.angle})`}
                >
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={hatch.lineLength}
                    stroke={zone.color}
                    strokeWidth={hatch.strokeWidth}
                    strokeOpacity={hatchOpacity}
                  />
                </pattern>
              );
            })}
        </defs>
      )}
      {ready &&
        zones.filter((z) => z.visible !== false).map((zone) => {
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
                  onPointerDown={(e) => handlePointDown(e, zone.id, 0)}
                  onContextMenu={(e) => handlePointContext(e, zone.id, 0)}
                />
              );
            }
            return null;
          }

          const pxPts = zone.points.map(px);
          const ptStr = pxPts.map((p) => `${p.x},${p.y}`).join(" ");
          const active = zone.id === activeZoneId;
          const style = zone.fillStyle ?? "hatch";
          const isActiveEdit = active && editMode;
          const patternId = hatchPatternId(zone.id);

          return (
            <g key={zone.id}>
              {zone.points.length >= 3 ? (
                <polygon
                  points={ptStr}
                  fill={getFill(style, zone.color, patternId)}
                  fillOpacity={getFillOpacity(style, zone.opacity)}
                  stroke={getStroke(style, zone.color, isActiveEdit)}
                  strokeWidth={getStrokeWidth(style, isActiveEdit)}
                  strokeOpacity={getStrokeOpacity(style, zone.opacity, isActiveEdit)}
                  strokeDasharray={getStrokeDasharray(style, isActiveEdit)}
                  {...(animGroupOpacity !== undefined ? { opacity: animGroupOpacity } : {})}
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
                  {...(animGroupOpacity !== undefined ? { opacity: animGroupOpacity } : {})}
                />
              )}

              {/* Label with box and pointer line */}
              {zone.points.length >= 3 && (() => {
                const centroid = centroidOf(pxPts);
                const topY = Math.min(...pxPts.map((p) => p.y));
                let labelX = centroid.x;
                let labelY = Math.max(20, topY - 28);
                
                if (zone.labelPos) {
                  const lblPx = px(zone.labelPos);
                  labelX = lblPx.x;
                  labelY = lblPx.y;
                }
                
                const padX = 6;
                const padY = 3;
                const textLen = zone.name.length * 6.5;
                const boxW = textLen + padX * 2;
                const boxH = 16 + padY * 2;
                const textYOffset = 1; // minor vertical fix
                
                let lineStart = { x: labelX, y: labelY };
                const borderPt = closestEdgePoint(lineStart, centroid, pxPts);
                
                // Calculate box edge intersection to make line start cleanly at box border
                const dx = borderPt.x - labelX;
                const dy = borderPt.y - labelY;
                // If the pointer is very close to the center, just keep it at center to prevent glitches
                if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
                  // Box half-dimensions
                  const hw = boxW / 2;
                  const hh = boxH / 2;
                  // Ratio of distance to borders
                  const rx = hw / Math.abs(dx);
                  const ry = hh / Math.abs(dy);
                  const minR = Math.min(rx, ry);
                  lineStart.x += dx * minR;
                  lineStart.y += dy * minR;
                }

                const isDraggingLabel = dragging?.zoneId === zone.id && dragging?.isLabel;

                const iconCenterX = labelX - boxW / 2 - 12;
                const scaleTransform = labelScale !== 1
                  ? `translate(${labelX}, ${labelY}) scale(${labelScale}) translate(${-labelX}, ${-labelY})`
                  : undefined;

                return (
                  <g 
                    style={{ 
                      pointerEvents: editMode ? "auto" : "none", 
                      userSelect: "none",
                      cursor: editMode ? (isDraggingLabel ? "grabbing" : "grab") : "default"
                    }}
                    onPointerDown={(e) => editMode && handleLabelDown(e, zone.id)}
                  >
                    <g transform={scaleTransform}>
                      {/* Danger triangle */}
                      {showDangerIcon && (
                        <g
                          transform={`translate(${iconCenterX}, ${labelY})`}
                          opacity={dangerBlinkOn ? 1 : 0}
                          style={{ pointerEvents: "none" }}
                        >
                          <polygon points="0,-8 7,5 -7,5" fill="#facc15" stroke="#92400e" strokeWidth={1} />
                          <text
                            x={0}
                            y={2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#1c1917"
                            fontSize={7}
                            fontWeight="bold"
                          >!</text>
                        </g>
                      )}
                      <rect
                        x={labelX - boxW / 2}
                        y={labelY - boxH / 2}
                        width={boxW}
                        height={boxH}
                        rx={4}
                        fill="rgba(0,0,0,0.75)"
                        stroke="black"
                        strokeWidth={1.5}
                      />
                      <text
                        x={labelX}
                        y={labelY + textYOffset}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={12}
                        fontWeight="bold"
                        style={{ pointerEvents: "none" }}
                      >
                        {zone.name}
                      </text>
                    </g>
                  </g>
                );
              })()}

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
                    onPointerDown={(e) => handlePointDown(e, zone.id, i)}
                    onContextMenu={(e) => handlePointContext(e, zone.id, i)}
                  />
                ))}
            </g>
          );
        })}

      {/* ── Safe zones ── */}
      {ready &&
        safeZones.filter((sz) => sz.visible !== false).map((sz) => {
          const pxPts = sz.points.map(px);
          const active = sz.id === activeZoneId;
          const isActiveEdit = active && editMode;

          if (sz.points.length === 0) return null;

          if (sz.points.length === 1) {
            if (isActiveEdit) {
              const p = pxPts[0];
              return (
                <circle
                  key={sz.id}
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill="white"
                  stroke={sz.lineColor}
                  strokeWidth={2}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => handlePointDown(e, sz.id, 0)}
                  onContextMenu={(e) => handlePointContext(e, sz.id, 0)}
                />
              );
            }
            return null;
          }

          const ptStr = pxPts.map((p) => `${p.x},${p.y}`).join(" ");

          return (
            <g key={sz.id}>
              {/* Area: gradient bands from outer (warning) to inner (safe) */}
              {(() => {
                const bands = safeZoneArea.bands;
                const outerColor = safeZoneArea.outerColor;
                const innerColor = sz.areaColor;
                return Array.from({ length: bands }, (_, i) => {
                  const t = i / (bands - 1); // 0 = outermost, 1 = innermost
                  const w = sz.areaWidth * (1 - t * 0.7); // outer is full width, inner shrinks
                  const color = lerpHexColor(outerColor, innerColor, t);
                  const opacity = sz.areaOpacity * (0.4 + 0.6 * t); // outer more transparent
                  return (
                    <polyline
                      key={i}
                      points={ptStr}
                      fill="none"
                      stroke={color}
                      strokeWidth={w}
                      strokeOpacity={opacity}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                });
              })()}
              {/* Line: the actual path */}
              <polyline
                points={ptStr}
                fill="none"
                stroke={sz.lineColor}
                strokeWidth={sz.lineWidth}
                strokeOpacity={sz.lineOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
                {...(sz.lineStyle === "dashed" ? { strokeDasharray: `${safeZoneLine.dashLength} ${safeZoneLine.gapLength}` } : {})}
              />

              {/* Label */}
              {sz.points.length >= 2 && (() => {
                const midIdx = Math.floor(pxPts.length / 2);
                const midPt = pxPts.length % 2 === 0
                  ? { x: (pxPts[midIdx - 1].x + pxPts[midIdx].x) / 2, y: (pxPts[midIdx - 1].y + pxPts[midIdx].y) / 2 }
                  : pxPts[midIdx];

                let labelX = midPt.x;
                let labelY = midPt.y - 24;
                if (sz.labelPos) {
                  const lblPx = px(sz.labelPos);
                  labelX = lblPx.x;
                  labelY = lblPx.y;
                }

                const padX = 6;
                const padY = 3;
                const textLen = sz.name.length * 6.5;
                const boxW = textLen + padX * 2;
                const boxH = 16 + padY * 2;

                const isDraggingLabel = dragging?.zoneId === sz.id && dragging?.isLabel;
                const scaleTransform = labelScale !== 1
                  ? `translate(${labelX}, ${labelY}) scale(${labelScale}) translate(${-labelX}, ${-labelY})`
                  : undefined;

                return (
                  <g
                    style={{
                      pointerEvents: editMode ? "auto" : "none",
                      userSelect: "none",
                      cursor: editMode ? (isDraggingLabel ? "grabbing" : "grab") : "default",
                    }}
                    onPointerDown={(e) => editMode && handleLabelDown(e, sz.id)}
                  >
                    <g transform={scaleTransform}>
                      <rect
                        x={labelX - boxW / 2}
                        y={labelY - boxH / 2}
                        width={boxW}
                        height={boxH}
                        rx={4}
                        fill="rgba(0,0,0,0.75)"
                        stroke={sz.lineColor}
                        strokeWidth={1.5}
                      />
                      <text
                        x={labelX}
                        y={labelY + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={12}
                        fontWeight="bold"
                        style={{ pointerEvents: "none" }}
                      >
                        {sz.name}
                      </text>
                    </g>
                  </g>
                );
              })()}

              {/* Handles */}
              {isActiveEdit &&
                pxPts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill="white"
                    stroke={sz.lineColor}
                    strokeWidth={2}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => handlePointDown(e, sz.id, i)}
                    onContextMenu={(e) => handlePointContext(e, sz.id, i)}
                  />
                ))}
            </g>
          );
        })}
    </svg>
  );
}

/* ── helpers ── */

function hatchPatternId(zoneId: string): string {
  return `zone-hatch-${zoneId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
