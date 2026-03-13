"use client";

import { useEffect, useRef, useState } from "react";
import { Zone } from "@/lib/types";
import { serializeZones, deserializeZones } from "@/lib/zoneSerializer";

const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwsrp7iUZZN2UJaIRfyER9YNDqF2pIiHAPJtBq_fUQTTGt0a8LWO1RFTExwV-kI4uMyTA/exec";

const ZONE_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

interface ZoneEditorPanelProps {
  zones: Zone[];
  activeZoneId: string | null;
  editMode: boolean;
  onSetZones: (zones: Zone[]) => void;
  onSetActiveZoneId: (id: string | null) => void;
  onSetEditMode: (mode: boolean) => void;
}

export default function ZoneEditorPanel({
  zones,
  activeZoneId,
  editMode,
  onSetZones,
  onSetActiveZoneId,
  onSetEditMode,
}: ZoneEditorPanelProps) {
  const [scriptUrl, setScriptUrl] = useState(DEFAULT_SCRIPT_URL);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const didAutoLoad = useRef(false);

  const activeZone = zones.find((z) => z.id === activeZoneId);

  // Auto-load zones from Drive on first mount
  useEffect(() => {
    if (didAutoLoad.current) return;
    if (!scriptUrl.trim() || scriptUrl.includes("PASTE_YOUR")) return;
    didAutoLoad.current = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/drive?scriptUrl=${encodeURIComponent(scriptUrl.trim())}`
        );
        if (!res.ok) return;
        const text = await res.text();
        const parsed = deserializeZones(text);
        if (parsed.length > 0) {
          onSetZones(parsed);
          onSetActiveZoneId(parsed[0].id);
          setSyncStatus(`Auto-loaded ${parsed.length} zone(s)`);
        }
      } catch {
        // silent — auto-load is best-effort
      }
    })();
  }, [scriptUrl, onSetZones, onSetActiveZoneId]);

  const addZone = () => {
    const newZone: Zone = {
      id: crypto.randomUUID(),
      name: `Zone ${zones.length + 1}`,
      color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
      opacity: 0.3,
      points: [],
    };
    onSetZones([...zones, newZone]);
    onSetActiveZoneId(newZone.id);
    onSetEditMode(true);
  };

  const deleteZone = (id: string) => {
    onSetZones(zones.filter((z) => z.id !== id));
    if (activeZoneId === id) onSetActiveZoneId(null);
  };

  const updateZone = (id: string, updates: Partial<Zone>) => {
    onSetZones(zones.map((z) => (z.id === id ? { ...z, ...updates } : z)));
  };

  const readFromDrive = async () => {
    if (!scriptUrl.trim()) return;
    setIsLoading(true);
    setSyncStatus("Reading…");
    try {
      const res = await fetch(
        `/api/drive?scriptUrl=${encodeURIComponent(scriptUrl.trim())}`
      );
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      const parsed = deserializeZones(text);
      onSetZones(parsed);
      setSyncStatus(`Loaded ${parsed.length} zone(s)`);
      if (parsed.length > 0) onSetActiveZoneId(parsed[0].id);
    } catch (err) {
      setSyncStatus(
        `Error: ${err instanceof Error ? err.message : "Unknown"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const writeToDrive = async () => {
    if (!scriptUrl.trim()) return;
    setIsLoading(true);
    setSyncStatus("Writing…");
    try {
      const content = serializeZones(zones);
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptUrl: scriptUrl.trim(), content }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSyncStatus("Saved to Drive ✓");
    } catch (err) {
      setSyncStatus(
        `Error: ${err instanceof Error ? err.message : "Unknown"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const exportToClipboard = () => {
    navigator.clipboard.writeText(serializeZones(zones));
    setSyncStatus("Copied to clipboard");
  };

  const importFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = deserializeZones(text);
      onSetZones(parsed);
      setSyncStatus(`Imported ${parsed.length} zone(s)`);
      if (parsed.length > 0) onSetActiveZoneId(parsed[0].id);
    } catch {
      setSyncStatus("Failed to read clipboard");
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wider text-zinc-500">
          Danger Zones
        </h3>
        <button
          onClick={() => onSetEditMode(!editMode)}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            editMode
              ? "bg-amber-500/20 text-amber-400"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
          }`}
        >
          {editMode ? "Editing" : "Edit"}
        </button>
      </div>

      {/* Zone list */}
      <div className="space-y-1">
        {zones.map((zone) => (
          <div
            key={zone.id}
            onClick={() => onSetActiveZoneId(zone.id)}
            className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer transition-colors ${
              zone.id === activeZoneId
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300"
            }`}
          >
            <span
              className="inline-block h-3 w-3 rounded-sm flex-shrink-0"
              style={{
                backgroundColor: zone.color,
                opacity: zone.opacity + 0.3,
              }}
            />
            <span className="flex-1 truncate">{zone.name}</span>
            <span className="font-mono text-zinc-600">{zone.points.length}pt</span>
          </div>
        ))}
        <button
          onClick={addZone}
          className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400 transition-colors"
        >
          <span className="text-base leading-none">+</span> Add Zone
        </button>
      </div>

      {/* Active zone settings */}
      {activeZone && editMode && (
        <div className="space-y-2 border-t border-zinc-800 pt-3">
          <h4 className="text-xs font-medium text-zinc-500">Zone Settings</h4>

          <div>
            <label className="text-[10px] uppercase text-zinc-600">Name</label>
            <input
              type="text"
              value={activeZone.name}
              onChange={(e) =>
                updateZone(activeZone.id, { name: e.target.value })
              }
              className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-zinc-600">Color</label>
            <div className="mt-0.5 flex gap-1">
              {ZONE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateZone(activeZone.id, { color: c })}
                  className={`h-5 w-5 rounded-sm border ${
                    activeZone.color === c
                      ? "border-white"
                      : "border-zinc-700"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-zinc-600">
              Opacity: {Math.round(activeZone.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={activeZone.opacity}
              onChange={(e) =>
                updateZone(activeZone.id, {
                  opacity: parseFloat(e.target.value),
                })
              }
              className="mt-0.5 w-full accent-teal-500"
            />
          </div>

          <p className="text-[10px] text-zinc-600">
            Click viewport to add points · Drag to move · Right-click to remove
          </p>

          <button
            onClick={() => deleteZone(activeZone.id)}
            className="w-full rounded border border-red-900/50 px-2 py-1 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
          >
            Delete Zone
          </button>
        </div>
      )}

      {/* Google Drive sync */}
      <div className="space-y-2 border-t border-zinc-800 pt-3">
        <h4 className="text-xs font-medium text-zinc-500">Google Drive Sync</h4>

        <div>
          <label className="text-[10px] uppercase text-zinc-600">Apps Script URL</label>
          <input
            type="text"
            value={scriptUrl}
            onChange={(e) => setScriptUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            className="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none focus:border-teal-500 placeholder:text-zinc-600"
          />
        </div>

        <div className="flex gap-1">
          <button
            onClick={readFromDrive}
            disabled={isLoading || !scriptUrl.trim()}
            className="flex-1 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            Read
          </button>
          <button
            onClick={writeToDrive}
            disabled={isLoading || !scriptUrl.trim() || zones.length === 0}
            className="flex-1 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            Write
          </button>
        </div>

        <div className="flex gap-1">
          <button
            onClick={exportToClipboard}
            disabled={zones.length === 0}
            className="flex-1 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            Copy
          </button>
          <button
            onClick={importFromClipboard}
            className="flex-1 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            Paste
          </button>
        </div>

        {syncStatus && (
          <p
            className={`text-[10px] ${
              syncStatus.startsWith("Error")
                ? "text-red-400"
                : "text-teal-400"
            }`}
          >
            {syncStatus}
          </p>
        )}
      </div>
    </div>
  );
}
