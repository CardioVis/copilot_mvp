import { readFile } from "fs/promises";
import path from "path";
import AICopilotLayout from "@/components/AICopilotLayout";
import type { BoundaryRecord } from "@/lib/boundaryOverlay";
import type { SegmentationTag } from "@/lib/segmentationOverlay";

export default async function Home() {
  const defaultVideoDir = process.env.DEFAULT_VIDEO_DIR ?? "";
  const defaultGalleryDir = process.env.DEFAULT_GALLERY_DIR ?? "";

  // Pre-fetch mask data server-side to avoid client waterfall fetches on initial render.
  // When a default gallery dir is configured, read from that directory; otherwise fall back to public/.
  const masksJsonPath = defaultGalleryDir
    ? path.join(defaultGalleryDir, "masks.json")
    : path.join(process.cwd(), "public", "masks.json");
  const maskPointsPath = defaultGalleryDir
    ? path.join(defaultGalleryDir, "masks_points.json")
    : path.join(process.cwd(), "public", "masks_points.json");

  let initialMasks: Array<{ image: string; tags: SegmentationTag[] }> = [];
  let initialPoints: BoundaryRecord[] = [];

  try {
    initialMasks = JSON.parse(await readFile(masksJsonPath, "utf8"));
  } catch {}

  try {
    initialPoints = JSON.parse(await readFile(maskPointsPath, "utf8"));
  } catch {}

  return (
    <AICopilotLayout
      initialMasks={initialMasks}
      initialPoints={initialPoints}
      defaultVideoDir={defaultVideoDir}
      defaultGalleryDir={defaultGalleryDir}
    />
  );
}
