"use client";

import { useEffect, useRef, useState } from "react";

const PHASE1_MS = 3000;
const TOTAL_MS = 5000;
const BLINK_INTERVAL_MS = 200;

export interface ZoneAnimationState {
  /** Whether the animation is currently playing. */
  isAnimating: boolean;
  /** Toggle play / pause. */
  toggleAnimation: () => void;
  /**
   * SVG opacity to apply to zone shapes during animation.
   * `undefined` when not animating (use the zone's own opacity).
   * `0` on blink-off frames in phase 1.
   * `0.2` during phase 2.
   */
  animGroupOpacity: number | undefined;
  /** Scale multiplier for zone labels (1.4 in phase 1, 1 otherwise). */
  labelScale: number;
  /** Whether the danger triangle icon should be rendered (phase 1 only). */
  showDangerIcon: boolean;
  /** Whether the danger icon is currently in its visible blink state. */
  dangerBlinkOn: boolean;
}

export function useZoneAnimation(): ZoneAnimationState {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animElapsed, setAnimElapsed] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const animStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAnimating) {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      setAnimElapsed(0);
      return;
    }
    animStartRef.current = null;
    const animate = (timestamp: number) => {
      if (animStartRef.current === null) animStartRef.current = timestamp;
      const elapsed = timestamp - animStartRef.current;
      if (elapsed >= TOTAL_MS) {
        setAnimElapsed(TOTAL_MS);
        setIsAnimating(false);
        return;
      }
      setAnimElapsed(elapsed);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isAnimating]);

  const blinkOn = Math.floor(animElapsed / BLINK_INTERVAL_MS) % 2 === 0;
  const isPhase1 = isAnimating && animElapsed < PHASE1_MS;

  const animGroupOpacity: number | undefined = !isAnimating
    ? undefined
    : isPhase1
    ? blinkOn ? undefined : 0
    : 0.6;

  return {
    isAnimating,
    toggleAnimation: () => setIsAnimating((v) => !v),
    animGroupOpacity,
    labelScale: isPhase1 ? 1.4 : 1,
    showDangerIcon: isPhase1,
    dangerBlinkOn: blinkOn,
  };
}
