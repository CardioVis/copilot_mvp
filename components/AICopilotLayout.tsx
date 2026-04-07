"use client";

import { useState } from "react";
import TaskBar, { AppTab } from "@/components/TaskBar";
import ImageGalleryTab from "@/components/ImageGalleryTab";
import VideoPlayerTab from "@/components/VideoPlayerTab";
import type { BoundaryRecord } from "@/lib/boundaryOverlay";
import type { SegmentationTag } from "@/lib/segmentationOverlay";

interface AICopilotLayoutProps {
  initialMasks: Array<{ image: string; tags: SegmentationTag[] }>;
  initialPoints: BoundaryRecord[];
  defaultVideoDir: string;
  defaultGalleryDir: string;
}

export default function AICopilotLayout({
  initialMasks,
  initialPoints,
  defaultVideoDir,
  defaultGalleryDir,
}: AICopilotLayoutProps) {
  const [activeTab, setActiveTab] = useState<AppTab>("video");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-zinc-100">
      <TaskBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="flex flex-1 overflow-hidden">
        {activeTab === "gallery" ? (
          <ImageGalleryTab
            initialMasks={initialMasks}
            initialPoints={initialPoints}
            initialDir={defaultGalleryDir}
          />
        ) : (
          <VideoPlayerTab initialDir={defaultVideoDir} />
        )}
      </div>
    </div>
  );
}
