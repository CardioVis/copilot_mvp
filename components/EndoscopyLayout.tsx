"use client";

import { useState } from "react";
import TaskBar, { AppTab } from "@/components/TaskBar";
import ImageGallery from "@/components/ImageGallery";
import VideoPlayerTab from "@/components/VideoPlayerTab";

export default function EndoscopyLayout() {
  const [activeTab, setActiveTab] = useState<AppTab>("video");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black text-zinc-100">
      <TaskBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="flex flex-1 overflow-hidden">
        {activeTab === "gallery" ? (
          <ImageGallery />
        ) : (
          <VideoPlayerTab />
        )}
      </div>
    </div>
  );
}
