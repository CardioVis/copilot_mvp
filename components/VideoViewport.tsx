"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface VideoViewportProps {
  children?: React.ReactNode;
}

export default function VideoViewport({ children }: VideoViewportProps) {
  const mainRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: pw, height: ph } = entry.contentRect;
      if (pw / ph > 16 / 9) {
        setSize({ w: Math.round(ph * (16 / 9)), h: Math.round(ph) });
      } else {
        setSize({ w: Math.round(pw), h: Math.round(pw * (9 / 16)) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <main ref={mainRef} className="flex flex-1 items-center justify-center overflow-hidden bg-black">
      <div className="relative" style={{ width: size.w, height: size.h }}>
      <Image
        src="/mitral_frame_1_modified.png"
        alt="Endoscopy video feed"
        fill
        priority
      />
      {children}
      </div>
    </main>
  );
}
