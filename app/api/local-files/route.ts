import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, stat } from "fs/promises";
import path from "path";

const ALLOWED_FILES = new Set(["footage.mp4", "labels_points.json"]);

function isValidDirectory(dir: string): boolean {
  // Must be an absolute path, no path traversal
  const normalized = path.resolve(dir);
  return normalized === dir || normalized === dir.replace(/[/\\]+$/, "");
}

export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");
  const file = req.nextUrl.searchParams.get("file");

  if (!dir || !file) {
    return NextResponse.json({ error: "Missing dir or file param" }, { status: 400 });
  }

  if (!ALLOWED_FILES.has(file)) {
    return NextResponse.json({ error: "File not allowed" }, { status: 403 });
  }

  if (!isValidDirectory(dir)) {
    return NextResponse.json({ error: "Invalid directory" }, { status: 400 });
  }

  const filePath = path.join(path.resolve(dir), file);

  // Ensure resolved path stays within the specified directory
  if (!filePath.startsWith(path.resolve(dir))) {
    return NextResponse.json({ error: "Path traversal" }, { status: 403 });
  }

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  if (file === "labels_points.json") {
    const content = await readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(content));
  }

  // Stream the video file
  const data = await readFile(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": data.byteLength.toString(),
      "Accept-Ranges": "bytes",
    },
  });
}

/** List available directories or check if a directory has the required files */
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
