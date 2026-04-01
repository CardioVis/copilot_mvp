import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

export async function GET() {
  const framesDir = path.join(process.cwd(), "public", "frames");
  let files: string[];
  try {
    files = fs.readdirSync(framesDir);
  } catch {
    return NextResponse.json({ images: [] });
  }

  const images = files
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map((f) => ({ name: f, src: `/frames/${f}` }));

  return NextResponse.json({ images });
}
