import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"]);

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");
  const file = req.nextUrl.searchParams.get("file");

  if (!dir || !file) {
    return NextResponse.json({ error: "Missing dir or file param" }, { status: 400 });
  }

  // Only allow plain filenames — no subdirectory traversal
  if (file !== path.basename(file)) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const ext = path.extname(file).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 403 });
  }

  const resolvedDir = path.resolve(dir);
  const filePath = path.join(resolvedDir, file);

  // Ensure resolved file path stays within the resolved directory
  if (!filePath.startsWith(resolvedDir + path.sep)) {
    return NextResponse.json({ error: "Path traversal detected" }, { status: 403 });
  }

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const data = await readFile(filePath);
  const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(data, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
