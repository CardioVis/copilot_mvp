#!/usr/bin/env node
/**
 * frames_to_video.js
 *
 * Creates a video from a frames/ subfolder inside the given project directory.
 * The frames/ folder must contain files named:
 *   frame_XXXXX.{png,jpg,jpeg}
 * The output video is saved as <projectDir>/footage.mp4.
 *
 * Requires ffmpeg to be installed and available on PATH.
 *
 * Usage:
 *   node scripts/frames_to_video.js [projectDir] [--fps=N] [--start=N] [--end=N]
 *
 * Defaults:
 *   projectDir → D:\Projects\Features
 *   fps        → 18
 *   start      → 0 (first frame)
 *   end        → (last frame)
 *
 * Examples:
 *   node scripts/frames_to_video.js "D:\Projects\Features\Case01" --fps=25
 *   node scripts/frames_to_video.js "D:\Projects\Features\Case01" --start=100 --end=200
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// --- Parse arguments ---
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [key, val] = a.slice(2).split("=");
      return [key, val ?? true];
    })
);

const projectDir = path.resolve(args[0] ?? "D:\\Projects\\Features");
const fps = parseInt(flags.fps ?? "18", 10);
const startFrame = flags.start !== undefined ? parseInt(flags.start, 10) : null;
const endFrame = flags.end !== undefined ? parseInt(flags.end, 10) : null;

// --- Validate inputs ---
if (!fs.existsSync(projectDir)) {
  console.error(`Error: directory not found: ${projectDir}`);
  process.exit(1);
}

if (isNaN(fps) || fps <= 0) {
  console.error(`Error: invalid fps value: ${flags.fps}`);
  process.exit(1);
}

if (startFrame !== null && (isNaN(startFrame) || startFrame < 0)) {
  console.error(`Error: invalid start frame: ${flags.start}`);
  process.exit(1);
}

if (endFrame !== null && (isNaN(endFrame) || endFrame < 0)) {
  console.error(`Error: invalid end frame: ${flags.end}`);
  process.exit(1);
}

if (startFrame !== null && endFrame !== null && startFrame > endFrame) {
  console.error(`Error: --start (${startFrame}) must be <= --end (${endFrame})`);
  process.exit(1);
}

// --- Verify ffmpeg is available ---
try {
  execSync("ffmpeg -version", { stdio: "ignore" });
} catch {
  console.error(
    "Error: ffmpeg not found. Install it from https://ffmpeg.org/download.html and ensure it is on your PATH."
  );
  process.exit(1);
}

const framesDir = path.join(projectDir, "frames");
const outputFile = path.join(projectDir, "footage.mp4");

console.log(`Project: ${projectDir}`);
console.log(`FPS    : ${fps}`);
if (startFrame !== null || endFrame !== null) {
  console.log(`Range  : frames ${startFrame ?? 0} → ${endFrame ?? "end"}`);
}

if (!fs.existsSync(framesDir)) {
  console.error(`Error: frames/ subfolder not found in: ${projectDir}`);
  process.exit(1);
}

// --- Build video ---
const framePattern = /^frame_\d+\.(png|jpe?g)$/i;
const duration = 1 / fps;

let frameFiles = fs.readdirSync(framesDir)
  .filter((f) => framePattern.test(f))
  .sort();

if (startFrame !== null || endFrame !== null) {
  frameFiles = frameFiles.slice(startFrame ?? 0, endFrame !== null ? endFrame + 1 : undefined);
}

if (frameFiles.length === 0) {
  console.error("Error: no matching frames found.");
  process.exit(1);
}

console.log(`\n${frameFiles.length} frame(s) → ${outputFile}`);

const concatListPath = path.join(projectDir, "_concat_list.txt");
const concatContent = frameFiles
  .map((f) => {
    const absPath = path.join(framesDir, f).replace(/\\/g, "/").replace(/'/g, "'\\''");
    return `file '${absPath}'\nduration ${duration.toFixed(6)}`;
  })
  .join("\n");

fs.writeFileSync(concatListPath, concatContent + "\n", "utf8");

const cmd = [
  "ffmpeg",
  "-y",
  "-f concat",
  "-safe 0",
  `-i "${concatListPath}"`,
  "-c:v libx264",
  "-pix_fmt yuv420p",
  "-crf 18",
  `"${outputFile}"`,
].join(" ");

try {
  execSync(cmd, { stdio: "inherit" });
  console.log(`Saved: ${outputFile}`);
} finally {
  fs.rmSync(concatListPath, { force: true });
}
