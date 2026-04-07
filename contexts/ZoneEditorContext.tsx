"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { Zone, SafeMargin } from "@/lib/types";
import { useZoneAnimation, type ZoneAnimationState } from "@/hooks/useZoneAnimation";

interface ZoneEditorState {
  zones: Zone[];
  safeZones: SafeMargin[];
  activeZoneId: string | null;
  editMode: boolean;
}

interface ZoneEditorActions {
  setZones: React.Dispatch<React.SetStateAction<Zone[]>>;
  setSafeZones: React.Dispatch<React.SetStateAction<SafeMargin[]>>;
  setActiveZoneId: (id: string | null) => void;
  setEditMode: (mode: boolean) => void;
  updateZone: (id: string, updates: Partial<Zone>) => void;
  updateSafeZone: (id: string, updates: Partial<SafeMargin>) => void;
}

export type ZoneEditorContextValue = ZoneEditorState & ZoneEditorActions & ZoneAnimationState;

const ZoneEditorContext = createContext<ZoneEditorContextValue | null>(null);

export function ZoneEditorProvider({ children }: { children: React.ReactNode }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [safeZones, setSafeZones] = useState<SafeMargin[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const animation = useZoneAnimation();

  const updateZone = useCallback(
    (id: string, updates: Partial<Zone>) => {
      setZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...updates } : z)));
    },
    []
  );

  const updateSafeZone = useCallback(
    (id: string, updates: Partial<SafeMargin>) => {
      setSafeZones((prev) => prev.map((z) => (z.id === id ? { ...z, ...updates } : z)));
    },
    []
  );

  const value: ZoneEditorContextValue = {
    zones,
    safeZones,
    activeZoneId,
    editMode,
    setZones,
    setSafeZones,
    setActiveZoneId,
    setEditMode,
    updateZone,
    updateSafeZone,
    ...animation,
  };

  return (
    <ZoneEditorContext.Provider value={value}>
      {children}
    </ZoneEditorContext.Provider>
  );
}

export function useZoneEditor(): ZoneEditorContextValue {
  const ctx = useContext(ZoneEditorContext);
  if (!ctx) throw new Error("useZoneEditor must be used within ZoneEditorProvider");
  return ctx;
}
