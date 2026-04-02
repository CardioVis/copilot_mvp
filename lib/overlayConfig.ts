/**
 * overlayConfig.ts
 *
 * Central configuration for all canvas overlay rendering:
 *   – Boundary (polygon) overlay
 *   – Segmentation (RLE mask) overlay
 *
 * Edit the values here to change how overlays look without touching
 * render logic in rleDecoder.ts.
 */

// ── Boundary line ─────────────────────────────────────────────────────────────

export const boundaryLine = {
  /**
   * Fixed stroke width in pixels.
   * Set to 0 to auto-scale with canvas resolution using `autoScaleDivisor`.
   */
  lineWidth: 8,

  /**
   * Used when lineWidth === 0:
   *   computedWidth = max(minWidth, round(canvasWidth / autoScaleDivisor))
   */
  autoScaleDivisor: 600,

  /** Minimum stroke width when auto-scaling (px). */
  minWidth: 2,

  /** Stroke style: "solid" or "dashed". */
  style: "dashed" as "solid" | "dashed",

  /** Length of each dash in pixels (only used when style === "dashed"). */
  dashLength: 24,

  /** Length of each gap in pixels (only used when style === "dashed"). */
  gapLength: 8,

  /** Stroke opacity (0–1). Applied on top of the per-label colour. */
  opacity: 1,
};

// ── Boundary fill ─────────────────────────────────────────────────────────────

export const boundaryFill = {
  /** Semi-transparent fill opacity for the polygon interior (0–1). */
  opacity: 0,
};

// ── Label badge (shared by boundary and segmentation overlays) ────────────────

export const overlayLabel = {
  /**
   * Fixed font size in pixels.
   * Set to 0 to auto-scale: fontSize = max(minFontSize, round(canvasWidth / autoScaleDivisor))
   */
  fontSize: 0,

  /** Divisor for auto-scaling font size. */
  autoScaleDivisor: 110,

  /** Minimum font size when auto-scaling (px). */
  minFontSize: 14,

  /** Horizontal inner padding of the badge (px). */
  paddingX: 8,

  /** Vertical inner padding of the badge (px). */
  paddingY: 5,

  /** Corner radius of the badge rectangle (px). */
  borderRadius: 4,

  /** Opacity of the dark badge background. */
  backgroundOpacity: 0.75,

  /** Width of the coloured border drawn around the badge (px). */
  borderWidth: 1.5,
};

// ── Segmentation mask ─────────────────────────────────────────────────────────

export const segmentationMask = {
  /** Fill opacity applied to all RLE mask pixels (0–1). */
  opacity: 0.45,
};
