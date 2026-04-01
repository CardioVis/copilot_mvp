"use client";

import { useCallback, useState } from "react";
import TaskBar, { AppTab } from "@/components/TaskBar";
import SideBar from "@/components/SideBar";
import VideoViewport from "@/components/VideoViewport";
import ImageGallery from "@/components/ImageGallery";
import { Point, Zone, SafeZone } from "@/lib/types";
import { useZoneAnimation } from "@/hooks/useZoneAnimation";

export default function EndoscopyLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>("endoscopy");
  const [zones, setZones] = useState<Zone[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
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

  const handleUpdateSafeZone = useCallback(
    (zoneId: string, updates: Partial<SafeZone>) => {
      setSafeZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, ...updates } : z))
      );
    },
    []
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-zinc-100">
      <TaskBar
        isAnimating={isAnimating}
        onToggleAnimation={toggleAnimation}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="flex flex-1 overflow-hidden">
        {activeTab === "endoscopy" ? (
          <>
            <SideBar
              isOpen={sidebarOpen}
              zones={zones}
              safeZones={safeZones}
              activeZoneId={activeZoneId}
              editMode={editMode}
              onSetZones={setZones}
              onSetSafeZones={setSafeZones}
              onSetActiveZoneId={setActiveZoneId}
              onSetEditMode={setEditMode}
            />
            <VideoViewport
              zones={zones}
              safeZones={safeZones}
              activeZoneId={activeZoneId}
              editMode={editMode}
              onUpdateZone={handleUpdateZone}
              onUpdateSafeZone={handleUpdateSafeZone}
              animGroupOpacity={animGroupOpacity}
              labelScale={labelScale}
              showDangerIcon={showDangerIcon}
              dangerBlinkOn={dangerBlinkOn}
            />
          </>
        ) : (
          <ImageGallery />
        )}
      </div>
    </div>
  );
}
