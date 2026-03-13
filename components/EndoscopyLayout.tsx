"use client";

import { useCallback, useState } from "react";
import TaskBar from "@/components/TaskBar";
import SideBar from "@/components/SideBar";
import VideoViewport from "@/components/VideoViewport";
import { Point, Zone } from "@/lib/types";

export default function EndoscopyLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const handleUpdateZone = useCallback(
    (zoneId: string, points: Point[]) => {
      setZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, points } : z))
      );
    },
    []
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-zinc-100">
      <TaskBar />
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
        />
      </div>
    </div>
  );
}
