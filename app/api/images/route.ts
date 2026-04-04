import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"]);

export async function GET(req: NextRequest) {
  const dirParam = req.nextUrl.searchParams.get("dir");

  let framesDir: string;
  let buildSrc: (f: string) => string;

  if (dirParam) {
    framesDir = path.resolve(dirParam);
    if (!path.isAbsolute(framesDir)) {
      return NextResponse.json({ error: "Invalid directory" }, { status: 400 });
    }
    buildSrc = (f: string) =>
      `/api/frame?dir=${encodeURIComponent(framesDir)}&file=${encodeURIComponent(f)}`;
  } else {
    framesDir = path.join(process.cwd(), "public", "frames");
    buildSrc = (f: string) => `/frames/${f}`;
  }

  let files: string[];
  try {
    files = fs.readdirSync(framesDir);
  } catch {
    return NextResponse.json({ images: [] });
  }

  const images = files
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map((f) => ({ name: f, src: buildSrc(f) }));

  return NextResponse.json({ images });
}
