# CARDIOVIS

A surgical video annotation and hazard awareness tool for cardiac procedures. Displays real-time segmentation overlays, animated danger zone indicators, and safety corridor visualisations on endoscopy video frames.

---

## Running the Application

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (recommended) or npm

### Install dependencies

```bash
pnpm install
```

### Development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production build

```bash
pnpm build
pnpm start
```

### Lint

```bash
pnpm lint
```

---

## Loading Data

The application has two tabs:

**Hazard Awareness (Video Player)**
- Enter a directory path containing `footage.mp4` and `labels_points.json`, then click **Load**.
- Alternatively click **Choose Folder…** to pick a local folder via the browser File System Access API.
- Optionally place `labels.json` in the same folder to enable RLE segmentation mask overlays.

**Dataset Preview (Image Gallery)**
- Enter a directory path or click **Choose Folder…** to browse frames.
- Expects a `frames/` sub-folder for images, and `labels.json` / `labels_points.json` at the folder root.
- Toggle **Show Labels**, **Show Boundary**, and **Show Lines** to layer overlays on the selected frame.

**Editor** (hidden by default, enable in `TaskBar.tsx`)
- Draw and edit polygon zones over the endoscopy still image.
- Sync zones to/from Google Drive via an Apps Script URL.

---

## Project Structure

```
app/
  layout.tsx              Root Next.js layout (sets page title)
  page.tsx                Home page — renders EndoscopyLayout
  api/
    drive/route.ts        Proxy to Google Apps Script for zone persistence
    frame/route.ts        Serve an individual frame image by path
    images/route.ts       List frame images from a local directory
    labels/route.ts       Serve default labels.json from public/
    labels-points/route.ts  Serve default labels_points.json from public/
    local-files/route.ts  Read footage.mp4, labels.json, labels_points.json from disk

components/
  EndoscopyLayout.tsx     Root layout shell — mounts ZoneEditorProvider, routes tabs
  VideoViewport.tsx       16:9 letterbox container for the still image + overlay
  SegmentationOverlay.tsx SVG editing layer — draws zones, safe margins, labels; drag/click handlers
  SideBar.tsx             Left panel — surgery phase info, zone lists by category, dev tool toggle
  ZoneEditorPanel.tsx     Dev tool — zone CRUD, style controls, Google Drive sync, clipboard I/O
  TaskBar.tsx             Top header — tab navigation, settings dropdown, animation toggle
  ImageGallery.tsx        Frame browser with segmentation/boundary/line overlay toggles
  VideoPlayerTab.tsx      Video player with per-frame boundary, segmentation, and line overlays

contexts/
  ZoneEditorContext.tsx   React context + provider — owns zone state, animation state, edit mode

hooks/
  useZoneAnimation.ts     Animation loop hook for SVG danger zone flash/zoom effect

lib/
  types.ts                Core domain types: Point, Zone, SafeMargin, ZoneFillStyle; SafeZone / DangerZone / OtherZone classes
  geometry.ts             Pure geometry helpers: centroid, segment distance, insert-index, edge intersection
  colors.ts               Colour utilities: parseHex, lerpRgb, lerpHexColor
  ZoneFactory.ts          Factory — classifyZone(), createClassifiedZone() from label string
  overlayConfig.ts        Centralised rendering constants (line widths, opacities, label sets)
  zoneStyles.ts           SVG style helpers for zone fill, stroke, dash, hatch patterns
  zoneSerializer.ts       Text serialisation / deserialisation for Zone and SafeMargin
  BoundaryAnimationManager.ts  Per-zone animation state machine for video overlay (flash, zoom, smoothing)
  rleDecoder.ts           Label Studio RLE decoder; canvas renderers for segmentation, boundary, and line overlays
  services/
    ZonePersistenceService.ts  Service — Google Drive read/write, clipboard export/import

scripts/                  Standalone Node.js data-processing CLI tools
  parse_data.js           Trim a Label Studio JSON export to required fields
  parse_rle.js            Decode RLE masks → contours (Moore-Neighbour + Douglas-Peucker)
  process_features.js     Full pipeline: encode masks to RLE + trace contours
  frames_to_video.js      Concatenate frame images to footage.mp4 using ffmpeg
  copy_postfix.js         Rename/copy files by postfix (dataset organisation utility)
```

---

## Data Formats

**`labels_points.json`** — boundary polygons per frame:
```json
[
  {
    "image": "frame_0001.png",
    "zones": [{ "label": "Phrenic nerve", "points": [{"x": 0.4, "y": 0.3}, ...] }],
    "lines": [{ "label": "Incision line", "points": [{"x": 0.1, "y": 0.5}, ...] }]
  }
]
```

**`labels.json`** — RLE segmentation masks per frame:
```json
[
  {
    "image": "frame_0001.png",
    "tags": [{ "label": "Phrenic nerve", "rle": [12345, ...] }]
  }
]
```

Zone coordinates are normalised to `[0, 1]` relative to the image dimensions.

---

## Zone Categories

Zones are automatically classified by label name using sets defined in `lib/overlayConfig.ts`:

| Category | Colour  | Behaviour |
|----------|---------|-----------|
| Danger   | Red     | Flash animation on first appearance, warning triangle badge |
| Safe     | Green   | Rendered with gradient corridor; hidden by default in video player |
| Other    | Orange  | No animation |
| Unknown  | Purple  | No animation |
