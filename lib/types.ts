export interface Point {
  x: number; // 0–1 normalized
  y: number; // 0–1 normalized
}

export type ZoneFillStyle = "hatch" | "solid" | "outline" | "dashed";

export interface Zone {
  id: string;
  name: string;
  color: string;
  opacity: number;
  points: Point[];
  visible: boolean;
  fillStyle?: ZoneFillStyle;
  labelPos?: Point;
  accuracy?: number; // AI confidence percentage (0-100)
}

export type SafeZoneLineStyle = "solid" | "dashed";

export interface SafeZone {
  id: string;
  name: string;
  points: Point[]; // forms a polyline (open path, not closed)
  visible: boolean;
  lineColor: string;
  lineWidth: number;
  lineOpacity: number;
  lineStyle: SafeZoneLineStyle;
  areaColor: string;
  areaWidth: number; // thickness of the filled region around the line
  areaOpacity: number;
  labelPos?: Point;
  accuracy?: number;
}
