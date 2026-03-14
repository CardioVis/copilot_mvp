import { Zone, ZoneFillStyle } from "./types";

const VALID_FILL_STYLES: ZoneFillStyle[] = ["hatch", "solid", "outline", "dashed"];

/**
 * Text format:
 *   ZONE:<id>:<name>:<color>:<opacity>:<fillStyle>:[<labelX>,<labelY>]
 *   x,y
 *   x,y
 *   ...
 *   (blank line or next ZONE header)
 */
export function serializeZones(zones: Zone[]): string {
  return zones
    .map((zone) => {
      let header = `ZONE:${zone.id}:${zone.name}:${zone.color}:${zone.opacity}:${zone.fillStyle ?? "hatch"}`;
      if (zone.labelPos) {
        header += `:[${zone.labelPos.x.toFixed(6)},${zone.labelPos.y.toFixed(6)}]`;
      }
      const points = zone.points
        .map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`)
        .join("\n");
      return points ? `${header}\n${points}` : header;
    })
    .join("\n\n");
}

export function deserializeZones(text: string): Zone[] {
  const zones: Zone[] = [];
  const lines = text.trim().split("\n");
  let currentZone: Zone | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("ZONE:")) {
      if (currentZone) zones.push(currentZone);
      
      const headerStr = trimmed.substring(5);
      const lpMatch = headerStr.match(/(:\[([\d.-]+),([\d.-]+)\])$/);
      let partsStr = headerStr;
      let labelPos;
      if (lpMatch) {
        partsStr = headerStr.slice(0, -lpMatch[1].length);
        labelPos = { x: parseFloat(lpMatch[2]), y: parseFloat(lpMatch[3]) };
      }
      
      const parts = partsStr.split(":");
      const parsedStyle = parts[4] as ZoneFillStyle | undefined;
      currentZone = {
        id: parts[0] || crypto.randomUUID(),
        name: parts[1] || "Unnamed",
        color: parts[2] || "#ef4444",
        opacity: parseFloat(parts[3]) || 0.3,
        points: [],
        visible: true,
        fillStyle: parsedStyle && VALID_FILL_STYLES.includes(parsedStyle) ? parsedStyle : "hatch",
        labelPos,
      };
    } else if (currentZone) {
      const [xStr, yStr] = trimmed.split(",");
      const x = parseFloat(xStr);
      const y = parseFloat(yStr);
      if (!isNaN(x) && !isNaN(y)) {
        currentZone.points.push({
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
        });
      }
    }
  }

  if (currentZone) zones.push(currentZone);
  return zones;
}
