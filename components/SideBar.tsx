"use client";

import { useState } from "react";
import { Zone, SafeZone } from "@/lib/types";
import ZoneEditorPanel from "./ZoneEditorPanel";

interface SideBarProps {
  isOpen: boolean;
  zones: Zone[];
  safeZones: SafeZone[];
  activeZoneId: string | null;
  editMode: boolean;
  onSetZones: (zones: Zone[]) => void;
  onSetSafeZones: (safeZones: SafeZone[]) => void;
  onSetActiveZoneId: (id: string | null) => void;
  onSetEditMode: (mode: boolean) => void;
  showDevTool?: boolean;
}

export default function SideBar({
  isOpen,
  zones,
  safeZones,
  activeZoneId,
  editMode,
  onSetZones,
  onSetSafeZones,
  onSetActiveZoneId,
  onSetEditMode,
  showDevTool = true,
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
        <div>
          <h3 className="py-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Safe Zones
          </h3>
          <div className="mt-2">
            <SafeZonesContent safeZones={safeZones} />
          </div>
        </div>
        {showDevTool && (
          <div className="border-t border-zinc-800 pt-4">
            <CollapsibleSection
              title="Dev tool"
              isOpen={editorOpen}
              onToggle={() => setEditorOpen((v) => !v)}
            >
              <ZoneEditorPanel
                zones={zones}
                safeZones={safeZones}
                activeZoneId={activeZoneId}
                editMode={editMode}
                onSetZones={onSetZones}
                onSetSafeZones={onSetSafeZones}
                onSetActiveZoneId={onSetActiveZoneId}
                onSetEditMode={onSetEditMode}
              />
            </CollapsibleSection>
          </div>
        )}
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
        zones.map((zone) => {
          return (
            <div key={zone.id} className="flex items-center gap-3">
              <svg
                className="h-3 w-3 shrink-0 text-rose-600"
                viewBox="0 0 24 24"
                fill="currentColor"
                role="img"
              >
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <p className="text-sm text-white">{zone.name}</p>
            </div>
          );
        })
      )}
    </div>
  );
}

function SafeZonesContent({ safeZones }: { safeZones: SafeZone[] }) {
  return (
    <div className="space-y-3">
      {safeZones.length === 0 ? (
        <p className="text-xs text-zinc-600">No safe zones found.</p>
      ) : (
        safeZones.map((sz) => (
          <div key={sz.id}>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-0.5 rounded-full shrink-0"
                style={{ backgroundColor: sz.lineColor, opacity: sz.lineOpacity }}
              />
              <p className="text-sm font-medium text-white">{sz.name}</p>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              {sz.points.length} point{sz.points.length !== 1 ? "s" : ""}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
