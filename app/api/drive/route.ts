import { NextRequest, NextResponse } from "next/server";

const APPS_SCRIPT_RE =
  /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/;

function isValidScriptUrl(url: string): boolean {
  return APPS_SCRIPT_RE.test(url);
}

/** GET /api/drive?scriptUrl=xxx  –  read via Google Apps Script */
export async function GET(request: NextRequest) {
  const scriptUrl = request.nextUrl.searchParams.get("scriptUrl");
  if (!scriptUrl || !isValidScriptUrl(scriptUrl)) {
    return new NextResponse("Invalid or missing Apps Script URL", {
      status: 400,
    });
  }

  try {
    const res = await fetch(scriptUrl, { redirect: "follow" });
    if (!res.ok) {
      return new NextResponse(
        `Apps Script read failed (${res.status}): ${await res.text()}`,
        { status: res.status }
      );
    }
    return new NextResponse(await res.text());
  } catch (err) {
    return new NextResponse(
      `Apps Script read error: ${err instanceof Error ? err.message : "Unknown"}`,
      { status: 500 }
    );
  }
}

/** POST /api/drive  { scriptUrl, content }  –  write via Google Apps Script */
export async function POST(request: NextRequest) {
  let body: { scriptUrl?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const { scriptUrl, content } = body;
  if (
    !scriptUrl ||
    !isValidScriptUrl(scriptUrl) ||
    typeof content !== "string"
  ) {
    return new NextResponse("Invalid scriptUrl or content", { status: 400 });
  }

  try {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      redirect: "follow",
    });
    if (!res.ok) {
      return new NextResponse(
        `Apps Script write failed (${res.status}): ${await res.text()}`,
        { status: res.status }
      );
    }
    return new NextResponse("OK");
  } catch (err) {
    return new NextResponse(
      `Apps Script write error: ${err instanceof Error ? err.message : "Unknown"}`,
      { status: 500 }
    );
  }
}
