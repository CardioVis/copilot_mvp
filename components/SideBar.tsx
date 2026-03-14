"use client";

import { useState } from "react";
import { Zone } from "@/lib/types";
import ZoneEditorPanel from "./ZoneEditorPanel";

interface SideBarProps {
  isOpen: boolean;
  zones: Zone[];
  activeZoneId: string | null;
  editMode: boolean;
  onSetZones: (zones: Zone[]) => void;
  onSetActiveZoneId: (id: string | null) => void;
  onSetEditMode: (mode: boolean) => void;
}

export default function SideBar({
  isOpen,
  zones,
  activeZoneId,
  editMode,
  onSetZones,
  onSetActiveZoneId,
  onSetEditMode,
}: SideBarProps) {
  if (!isOpen) return null;

  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* <AIPanel /> */}
        <div>
          <h3 className="py-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Danger Zones
          </h3>
          <div className="mt-2">
            <DangerZonesContent zones={zones} />
          </div>
        </div>
        <div className="border-t border-zinc-800 pt-4">
          <CollapsibleSection
            title="Dev tool"
            isOpen={editorOpen}
            onToggle={() => setEditorOpen((v) => !v)}
          >
            <ZoneEditorPanel
              zones={zones}
              activeZoneId={activeZoneId}
              editMode={editMode}
              onSetZones={onSetZones}
              onSetActiveZoneId={onSetActiveZoneId}
              onSetEditMode={onSetEditMode}
            />
          </CollapsibleSection>
        </div>
      </div>
    </aside>
  );
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-1 text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <span>{title}</span>
        <span className="text-[10px]">{isOpen ? "▲" : "▼"}</span>
      </button>
      <div className={`mt-2 ${isOpen ? "" : "hidden"}`}>{children}</div>
    </div>
  );
}

const HARDCODED_ACCURACY = 92.7;

function DangerZonesContent({ zones }: { zones: Zone[] }) {
  return (
    <div className="space-y-3">
      {zones.length === 0 ? (
        <p className="text-xs text-zinc-600">No danger zones found.</p>
      ) : (
        zones.map((zone) => (
          <div key={zone.id}>
            <p className="text-sm font-medium text-white">{zone.name}</p>
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${HARDCODED_ACCURACY}%` }}
                />
              </div>
              <span className="font-mono text-zinc-400 text-[10px] w-10 text-right">
                {HARDCODED_ACCURACY}%
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
