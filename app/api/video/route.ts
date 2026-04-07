import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import path from "path";

function isValidDirectory(dir: string): boolean {
  const normalized = path.resolve(dir);
  return normalized === dir || normalized === dir.replace(/[/\\]+$/, "");
}

/** GET /api/video?dir=<absolute-path> — stream footage.mp4 from the given directory. */
export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");

  if (!dir) {
    return NextResponse.json({ error: "Missing dir param" }, { status: 400 });
  }

  if (!isValidDirectory(dir)) {
    return NextResponse.json({ error: "Invalid directory" }, { status: 400 });
  }

  const filePath = path.join(path.resolve(dir), "footage.mp4");

  if (!filePath.startsWith(path.resolve(dir))) {
    return NextResponse.json({ error: "Path traversal" }, { status: 403 });
  }

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "footage.mp4 not found" }, { status: 404 });
  }

  const data = await readFile(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": data.byteLength.toString(),
      "Accept-Ranges": "bytes",
    },
  });
}

/**
 * POST /api/video — check that the given directory contains the required files.
 * Body: { dir: string }
 * Returns: { hasVideo, hasLabels, files }
 */
export async function POST(req: NextRequest) {
  const { dir } = await req.json();

  if (!dir || !isValidDirectory(dir)) {
    return NextResponse.json({ error: "Invalid directory" }, { status: 400 });
  }

  try {
    const entries = await readdir(path.resolve(dir));
    const hasVideo = entries.includes("footage.mp4");
    const hasLabels = entries.includes("labels_points.json");
    return NextResponse.json({ hasVideo, hasLabels, files: entries });
  } catch {
    return NextResponse.json({ error: "Cannot read directory" }, { status: 404 });
  }
}
