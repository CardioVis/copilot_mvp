export interface Point {
  x: number; // 0–1 normalized
  y: number; // 0–1 normalized
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  opacity: number;
  points: Point[];
}
