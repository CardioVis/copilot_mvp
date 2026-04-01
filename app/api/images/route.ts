import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

export async function GET() {
  const publicDir = path.join(process.cwd(), "public");
  let files: string[];
  try {
    files = fs.readdirSync(publicDir);
  } catch {
    return NextResponse.json({ images: [] });
  }

  const images = files
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map((f) => ({ name: f, src: `/${f}` }));

  return NextResponse.json({ images });
}
