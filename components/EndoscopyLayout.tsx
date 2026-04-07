"use client";

import { useState } from "react";
import TaskBar, { AppTab } from "@/components/TaskBar";
import SideBar from "@/components/SideBar";
import VideoViewport from "@/components/VideoViewport";
import SegmentationOverlay from "@/components/SegmentationOverlay";
import ImageGallery from "@/components/ImageGallery";
import VideoPlayerTab from "@/components/VideoPlayerTab";
import { ZoneEditorProvider, useZoneEditor } from "@/contexts/ZoneEditorContext";

export default function EndoscopyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ZoneEditorProvider>
      <EndoscopyLayoutInner />
    </ZoneEditorProvider>
  );
}

function EndoscopyLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>("video");

  const ctx = useZoneEditor();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-zinc-100">
      <TaskBar
        isAnimating={ctx.isAnimating}
        onToggleAnimation={ctx.toggleAnimation}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="flex flex-1 overflow-hidden">
        {activeTab === "endoscopy" ? (
          <>
            <SideBar
              isOpen={sidebarOpen}
              zones={ctx.zones}
              safeZones={ctx.safeZones}
              activeZoneId={ctx.activeZoneId}
              editMode={ctx.editMode}
              onSetZones={ctx.setZones}
              onSetSafeZones={ctx.setSafeZones}
              onSetActiveZoneId={ctx.setActiveZoneId}
              onSetEditMode={ctx.setEditMode}
            />
            <VideoViewport>
              <SegmentationOverlay />
            </VideoViewport>
          </>
        ) : activeTab === "gallery" ? (
          <ImageGallery />
        ) : (
          <VideoPlayerTab />
        )}
      </div>
    </div>
  );
}
