"use client";

import { useCallback, useState } from "react";
import TaskBar from "@/components/TaskBar";
import SideBar from "@/components/SideBar";
import VideoViewport from "@/components/VideoViewport";
import { Point, Zone } from "@/lib/types";
import { useZoneAnimation } from "@/hooks/useZoneAnimation";

export default function EndoscopyLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const {
    isAnimating,
    toggleAnimation,
    animGroupOpacity,
    labelScale,
    showDangerIcon,
    dangerBlinkOn,
  } = useZoneAnimation();

  const handleUpdateZone = useCallback(
    (zoneId: string, updates: Partial<Zone>) => {
      setZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, ...updates } : z))
      );
    },
    []
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-zinc-100">
      <TaskBar isAnimating={isAnimating} onToggleAnimation={toggleAnimation} />
      <div className="flex flex-1 overflow-hidden">
        <SideBar
          isOpen={sidebarOpen}
          zones={zones}
          activeZoneId={activeZoneId}
          editMode={editMode}
          onSetZones={setZones}
          onSetActiveZoneId={setActiveZoneId}
          onSetEditMode={setEditMode}
        />
        <VideoViewport
          zones={zones}
          activeZoneId={activeZoneId}
          editMode={editMode}
          onUpdateZone={handleUpdateZone}
          animGroupOpacity={animGroupOpacity}
          labelScale={labelScale}
          showDangerIcon={showDangerIcon}
          dangerBlinkOn={dangerBlinkOn}
        />
      </div>
    </div>
  );
}
