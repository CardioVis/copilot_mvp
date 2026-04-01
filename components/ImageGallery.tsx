"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderSegmentationOverlay, renderBoundaryOverlay, SegmentationTag, BoundaryZone, BoundaryRecord } from "@/lib/rleDecoder";

interface ImageEntry {
  name: string;
  src: string;
  isObjectUrl?: boolean;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);

export default function ImageGallery() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [folderName, setFolderName] = useState("public/");
  const objectUrlsRef = useRef<string[]>([]);

  // Segmentation overlay state
  const [labelsMap, setLabelsMap] = useState<Record<string, SegmentationTag[]>>({});
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [overlayDecoding, setOverlayDecoding] = useState(false);
  const overlayCache = useRef<Map<string, string>>(new Map());

  // Boundary overlay state
  const [boundaryMap, setBoundaryMap] = useState<Record<string, BoundaryZone[]>>({});
  const [showBoundary, setShowBoundary] = useState(false);
  const [boundaryUrl, setBoundaryUrl] = useState<string | null>(null);
  const boundaryCache = useRef<Map<string, string>>(new Map());

  const selected = selectedIndex !== null ? images[selectedIndex] ?? null : null;

  const goNext = useCallback(() =>
    setSelectedIndex((i) => (i !== null ? (i + 1) % images.length : null)), [images.length]);
  const goPrev = useCallback(() =>
    setSelectedIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : null)), [images.length]);

  useEffect(() => {
    if (selectedIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") setSelectedIndex(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIndex, goNext, goPrev]);

  function loadLabelsFromRecords(records: { image: string; tags: SegmentationTag[] }[]) {
    const map: Record<string, SegmentationTag[]> = {};
    for (const rec of records) map[rec.image] = rec.tags;
    setLabelsMap(map);
    setShowOverlay(false);
    setOverlayUrl(null);
    overlayCache.current.clear();
  }

  function loadBoundaryFromRecords(records: BoundaryRecord[]) {
    const map: Record<string, BoundaryZone[]> = {};
    for (const rec of records) map[rec.image] = rec.zones;
    setBoundaryMap(map);
    setShowBoundary(false);
    setBoundaryUrl(null);
    boundaryCache.current.clear();
  }

  useEffect(() => {
    loadDefault();
    return () => revokeAll();
  }, []);

  // Decode overlay when image or toggle changes
  const selectedName = selected?.name ?? null;
  useEffect(() => {
    if (!showOverlay || !selectedName || !labelsMap[selectedName]) {
      setOverlayUrl(null);
      return;
    }
    if (overlayCache.current.has(selectedName)) {
      setOverlayUrl(overlayCache.current.get(selectedName)!);
      return;
    }
    setOverlayDecoding(true);
    const timer = setTimeout(() => {
      const canvas = document.createElement("canvas");
      renderSegmentationOverlay(canvas, labelsMap[selectedName]);
      const url = canvas.toDataURL();
      overlayCache.current.set(selectedName, url);
      setOverlayUrl(url);
      setOverlayDecoding(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [showOverlay, selectedName, labelsMap]);

  // Render boundary overlay when image or toggle changes
  useEffect(() => {
    if (!showBoundary || !selectedName || !boundaryMap[selectedName]) {
      setBoundaryUrl(null);
      return;
    }
    if (boundaryCache.current.has(selectedName)) {
      setBoundaryUrl(boundaryCache.current.get(selectedName)!);
      return;
    }
    const canvas = document.createElement("canvas");
    renderBoundaryOverlay(canvas, boundaryMap[selectedName]);
    const url = canvas.toDataURL();
    boundaryCache.current.set(selectedName, url);
    setBoundaryUrl(url);
  }, [showBoundary, selectedName, boundaryMap]);

  function revokeAll() {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
  }

  async function loadDefault() {
    setLoading(true);
    setSelectedIndex(null);
    try {
      const data = await fetch("/api/images").then((r) => r.json());
      setImages(data.images ?? []);
      setFolderName("public/");
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
    // Load labels.json from public/
    try {
      const records = await fetch("/api/labels").then((r) => r.json());
      if (Array.isArray(records)) loadLabelsFromRecords(records);
    } catch {
      setLabelsMap({});
    }
    // Load labels_points.json from public/
    try {
      const records = await fetch("/api/labels-points").then((r) => r.json());
      if (Array.isArray(records)) loadBoundaryFromRecords(records);
    } catch {
      setBoundaryMap({});
    }
  }

  async function handleChooseFolder() {
    if (!("showDirectoryPicker" in window)) {
      alert("Folder picker is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
      setLoading(true);
      setSelectedIndex(null);
      revokeAll();

      const newImages: ImageEntry[] = [];
      let labelsHandle: FileSystemFileHandle | null = null;
      let boundaryHandle: FileSystemFileHandle | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const [name, handle] of (dirHandle as any).entries()) {
        if (handle.kind !== "file") continue;
        if (name === "labels.json") {
          labelsHandle = handle;
          continue;
        }
        if (name === "labels_points.json") {
          boundaryHandle = handle;
          continue;
        }
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        if (!IMAGE_EXTENSIONS.has(ext)) continue;
        const file = await handle.getFile();
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
        newImages.push({ name, src: url, isObjectUrl: true });
      }
      newImages.sort((a, b) => a.name.localeCompare(b.name));
      setImages(newImages);
      setFolderName(dirHandle.name + "/");

      // Load labels.json from the chosen folder
      if (labelsHandle) {
        try {
          const labelsFile = await labelsHandle.getFile();
          const text = await labelsFile.text();
          const records = JSON.parse(text);
          if (Array.isArray(records)) loadLabelsFromRecords(records);
        } catch {
          setLabelsMap({});
        }
      } else {
        setLabelsMap({});
      }

      // Load labels_points.json from the chosen folder
      if (boundaryHandle) {
        try {
          const bFile = await boundaryHandle.getFile();
          const text = await bFile.text();
          const records = JSON.parse(text);
          if (Array.isArray(records)) loadBoundaryFromRecords(records);
        } catch {
          setBoundaryMap({});
        }
      } else {
        setBoundaryMap({});
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") console.error(err);
      // User cancelled — do nothing
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 flex-1 truncate">
          Image Gallery &mdash; {folderName}
        </span>
        {folderName !== "public/" && (
          <button
            onClick={loadDefault}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap"
          >
            Reset to public/
          </button>
        )}
        <button
          onClick={handleChooseFolder}
          className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors whitespace-nowrap"
        >
          Choose Folder…
        </button>
        {selected && (
          <>
            {labelsMap[selected.name] && (
              <button
                onClick={() => setShowOverlay((v) => !v)}
                className={`rounded border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  showOverlay
                    ? "border-blue-500 bg-blue-500/20 text-blue-300"
                    : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                }`}
              >
                {showOverlay ? "Hide Labels" : "Show Labels"}
              </button>
            )}
            {boundaryMap[selected.name] && (
              <button
                onClick={() => setShowBoundary((v) => !v)}
                className={`rounded border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  showBoundary
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                }`}
              >
                {showBoundary ? "Hide Boundary" : "Show Boundary"}
              </button>
            )}
            <span className="text-xs text-zinc-500">
              {selectedIndex !== null ? selectedIndex + 1 : ""} / {images.length}
            </span>
            <button
              onClick={() => setSelectedIndex(null)}
              className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              ✕ Close preview
            </button>
          </>
        )}
      </div>

      {/* Full-screen preview */}
      {selected ? (
        <div className="relative flex flex-1 items-center justify-center bg-black">
          {/* Prev button */}
          <button
            onClick={goPrev}
            className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/70 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            aria-label="Previous image"
          >
            ‹
          </button>

          {/* Image — click background to close */}
          <div
            className="flex flex-1 h-full items-center justify-center cursor-zoom-out"
            onClick={() => setSelectedIndex(null)}
          >
            <div className="relative inline-flex items-center justify-center" style={{ maxHeight: "calc(100vh - 6rem)", maxWidth: "100%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.src}
                alt={selected.name}
                className="max-h-full max-w-full object-contain"
                style={{ maxHeight: "calc(100vh - 6rem)" }}
                onClick={(e) => e.stopPropagation()}
              />
              {showOverlay && overlayUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={overlayUrl}
                  alt=""
                  className="absolute inset-0 m-auto max-h-full max-w-full object-contain pointer-events-none"
                  style={{ maxHeight: "calc(100vh - 6rem)" }}
                />
              )}
              {showBoundary && boundaryUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={boundaryUrl}
                  alt=""
                  className="absolute inset-0 m-auto max-h-full max-w-full object-contain pointer-events-none"
                  style={{ maxHeight: "calc(100vh - 6rem)" }}
                />
              )}
              {overlayDecoding && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="rounded bg-black/70 px-3 py-1.5 text-xs text-zinc-300">Decoding segmentation…</span>
                </div>
              )}
            </div>
          </div>

          {/* Next button */}
          <button
            onClick={goNext}
            className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/70 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            aria-label="Next image"
          >
            ›
          </button>

          <p className="absolute bottom-4 text-xs text-zinc-400 pointer-events-none">{selected.name}</p>
        </div>
      ) : (
        /* Grid view */
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-zinc-500">Loading images…</p>
          ) : images.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No images found in {folderName}.{" "}
              <button onClick={handleChooseFolder} className="underline hover:text-zinc-300">
                Choose a folder
              </button>
            </p>
          ) : (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
            >
              {images.map((img, idx) => (
                <button
                  key={img.src}
                  onClick={() => setSelectedIndex(idx)}
                  className="group flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-600 transition-colors text-left"
                >
                  <div className="flex h-36 w-full items-center justify-center overflow-hidden bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src}
                      alt={img.name}
                      className="h-full w-full object-cover group-hover:opacity-80 transition-opacity"
                    />
                  </div>
                  <span className="truncate px-2 py-1.5 text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    {img.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
