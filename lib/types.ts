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
