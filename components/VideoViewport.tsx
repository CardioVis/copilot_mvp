"use client";

import Image from "next/image";
import SegmentationOverlay from "./SegmentationOverlay";
import { Point, Zone } from "@/lib/types";

interface VideoViewportProps {
  zones: Zone[];
  activeZoneId: string | null;
  editMode: boolean;
  onUpdateZone: (zoneId: string, points: Point[]) => void;
}

export default function VideoViewport({
  zones,
  activeZoneId,
  editMode,
  onUpdateZone,
}: VideoViewportProps) {
  return (
    <main className="relative flex-1 overflow-hidden bg-black">
      <Image
        src="/endoscopy.png"
        alt="Endoscopy video feed"
        fill
        priority
        className="object-cover"
      />
      <SegmentationOverlay
        zones={zones}
        activeZoneId={activeZoneId}
        editMode={editMode}
        onUpdateZone={onUpdateZone}
      />
    </main>
  );
}
