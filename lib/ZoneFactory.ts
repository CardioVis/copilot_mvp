import { Zone, SafeZone, DangerZone, OtherZone } from "./types";
import { DANGER_LABELS, SAFE_LABELS, OTHER_LABELS } from "./overlayConfig";

export type ZoneCategory = "danger" | "safe" | "other" | "unknown";

export function classifyZone(label: string): ZoneCategory {
  if (DANGER_LABELS.has(label)) return "danger";
  if (SAFE_LABELS.has(label)) return "safe";
  if (OTHER_LABELS.has(label)) return "other";
  return "unknown";
}

export function createClassifiedZone(label: string): Zone {
  const category = classifyZone(label);
  switch (category) {
    case "danger":
      return new DangerZone(label, label);
    case "safe":
      return new SafeZone(label, label);
    case "other":
      return new OtherZone(label, label);
    default:
      return new SafeZone(label, label);
  }
}
