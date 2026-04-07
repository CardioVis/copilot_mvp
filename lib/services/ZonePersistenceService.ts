import { Zone, SafeMargin } from "../types";
import { serializeZones, deserializeZones, serializeSafeZones, deserializeSafeZones } from "../zoneSerializer";

export class ZonePersistenceService {
  constructor(private scriptUrl: string) {}

  setScriptUrl(url: string): void {
    this.scriptUrl = url;
  }

  async readFromDrive(): Promise<{ zones: Zone[]; safeZones: SafeMargin[] }> {
    if (!this.scriptUrl.trim()) throw new Error("No script URL configured");

    const res = await fetch(
      `/api/drive?scriptUrl=${encodeURIComponent(this.scriptUrl.trim())}`
    );
    if (!res.ok) throw new Error(await res.text());

    const text = await res.text();
    return {
      zones: deserializeZones(text),
      safeZones: deserializeSafeZones(text),
    };
  }

  async writeToDrive(zones: Zone[], safeZones: SafeMargin[]): Promise<void> {
    if (!this.scriptUrl.trim()) throw new Error("No script URL configured");

    const parts = [serializeZones(zones), serializeSafeZones(safeZones)].filter(Boolean);
    const content = parts.join("\n\n");

    const res = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptUrl: this.scriptUrl.trim(), content }),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  exportToClipboard(zones: Zone[], safeZones: SafeMargin[]): void {
    const parts = [serializeZones(zones), serializeSafeZones(safeZones)].filter(Boolean);
    navigator.clipboard.writeText(parts.join("\n\n"));
  }

  async importFromClipboard(): Promise<{ zones: Zone[]; safeZones: SafeMargin[] }> {
    const text = await navigator.clipboard.readText();
    return {
      zones: deserializeZones(text),
      safeZones: deserializeSafeZones(text),
    };
  }
}
