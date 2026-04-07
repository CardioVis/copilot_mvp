import { readFile } from "fs/promises";
import path from "path";
import AICopilotLayout from "@/components/AICopilotLayout";
import type { BoundaryRecord } from "@/lib/boundaryOverlay";
import type { SegmentationTag } from "@/lib/segmentationOverlay";

export default async function Home() {
  const defaultVideoDir = process.env.DEFAULT_VIDEO_DIR ?? "";
  const defaultGalleryDir = process.env.DEFAULT_GALLERY_DIR ?? "";

  // Pre-fetch label data server-side to avoid client waterfall fetches on initial render.
  // When a default gallery dir is configured, read from that directory; otherwise fall back to public/.
  const labelsJsonPath = defaultGalleryDir
    ? path.join(defaultGalleryDir, "labels.json")
    : path.join(process.cwd(), "public", "labels.json");
  const labelPointsPath = defaultGalleryDir
    ? path.join(defaultGalleryDir, "labels_points.json")
    : path.join(process.cwd(), "public", "labels_points.json");

  let initialLabels: Array<{ image: string; tags: SegmentationTag[] }> = [];
  let initialLabelPoints: BoundaryRecord[] = [];

  try {
    initialLabels = JSON.parse(await readFile(labelsJsonPath, "utf8"));
  } catch {}

  try {
    initialLabelPoints = JSON.parse(await readFile(labelPointsPath, "utf8"));
  } catch {}

  return (
    <AICopilotLayout
      initialLabels={initialLabels}
      initialLabelPoints={initialLabelPoints}
      defaultVideoDir={defaultVideoDir}
      defaultGalleryDir={defaultGalleryDir}
    />
  );
}
