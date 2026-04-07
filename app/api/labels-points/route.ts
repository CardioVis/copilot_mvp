import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

function isValidDirectory(dir: string): boolean {
  const normalized = path.resolve(dir);
  return normalized === dir || normalized === dir.replace(/[\/\\]+$/, "");
}

/** GET /api/labels-points?dir=<absolute-path> — serve labels_points.json from dir, or public/ if omitted. */
export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");

  let filePath: string;
  if (dir) {
    if (!isValidDirectory(dir)) {
      return NextResponse.json({ error: "Invalid directory" }, { status: 400 });
    }
    filePath = path.join(path.resolve(dir), "labels_points.json");
    if (!filePath.startsWith(path.resolve(dir))) {
      return NextResponse.json({ error: "Path traversal" }, { status: 403 });
    }
    try {
      await stat(filePath);
    } catch {
      return NextResponse.json({ error: "labels_points.json not found" }, { status: 404 });
    }
  } else {
    filePath = path.join(process.cwd(), "public", "labels_points.json");
  }

  try {
    const raw = await readFile(filePath, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
