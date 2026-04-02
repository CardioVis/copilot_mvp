#!/usr/bin/env node
/**
 * frames_to_video.js
 *
 * Creates a video for every project subfolder inside a root directory.
 * Each project must contain a frames/ subfolder with files named:
 *   frame_XXXXX.{png,jpg,jpeg}
 * The output video is saved as <project>/footage.mp4.
 *
 * Requires ffmpeg to be installed and available on PATH.
 *
 * Usage:
 *   node scripts/frames_to_video.js [rootDir] [--fps=N]
 *
 * Defaults:
 *   rootDir → D:\Projects\Features
 *   fps     → 30
 *
 * Examples:
 *   node scripts/frames_to_video.js "D:\Projects\Features" --fps=25
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

const rootDir = path.resolve(args[0] ?? "D:\\Projects\\Features");
const fps = parseInt(flags.fps ?? "30", 10);

// --- Validate inputs ---
if (!fs.existsSync(rootDir)) {
  console.error(`Error: root directory not found: ${rootDir}`);
  process.exit(1);
}

if (isNaN(fps) || fps <= 0) {
  console.error(`Error: invalid fps value: ${flags.fps}`);
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

// --- Discover project subfolders ---
const projects = fs.readdirSync(rootDir)
  .filter((name) => fs.statSync(path.join(rootDir, name)).isDirectory())
  .sort();

if (projects.length === 0) {
  console.error(`Error: no subdirectories found in: ${rootDir}`);
  process.exit(1);
}

console.log(`Root  : ${rootDir}`);
console.log(`FPS   : ${fps}`);
console.log(`Found ${projects.length} project(s): ${projects.join(", ")}\n`);

// --- Process each project ---
const framePattern = /^frame_\d+\.(png|jpe?g)$/i;
const duration = 1 / fps;

function buildVideo(framesDir, outputFile) {
  const frameFiles = fs.readdirSync(framesDir)
    .filter((f) => framePattern.test(f))
    .sort();

  if (frameFiles.length === 0) {
    console.log(`  No matching frames found, skipping.`);
    return;
  }

  console.log(`  ${frameFiles.length} frame(s) → ${outputFile}`);

  const concatListPath = path.join(path.dirname(outputFile), "_concat_list.txt");
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
    console.log(`  Saved: ${outputFile}`);
  } finally {
    fs.rmSync(concatListPath, { force: true });
  }
}

let succeeded = 0;
let skipped = 0;

for (const project of projects) {
  const projectDir = path.join(rootDir, project);
  const framesDir = path.join(projectDir, "frames");
  const outputFile = path.join(projectDir, "footage.mp4");

  console.log(`\n── ${project} ──`);

  if (!fs.existsSync(framesDir)) {
    console.log(`  No frames/ subfolder found, skipping.`);
    skipped++;
    continue;
  }

  buildVideo(framesDir, outputFile);
  succeeded++;
}

console.log(`\nDone. ${succeeded} video(s) created, ${skipped} skipped.`);
