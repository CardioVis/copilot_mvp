#!/usr/bin/env node
/**
 * frames_to_video.js
 *
 * Creates a video from a folder of image frames named in the pattern:
 *   frame_XXXXX.{png,jpg,jpeg}
 *
 * Requires ffmpeg to be installed and available on PATH.
 *
 * Usage:
 *   node scripts/frames_to_video.js [framesDir] [outputFile] [--fps=N]
 *
 * Defaults:
 *   framesDir  → ./frames
 *   outputFile → ./output.mp4
 *   fps        → 30
 *
 * Examples:
 *   node scripts/frames_to_video.js ./public/frames ./output.mp4 --fps=25
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

const framesDir = path.resolve(args[0] ?? "./frames");
const outputFile = path.resolve(args[1] ?? "./output.mp4");
const fps = parseInt(flags.fps ?? "30", 10);

// --- Validate inputs ---
if (!fs.existsSync(framesDir)) {
  console.error(`Error: frames directory not found: ${framesDir}`);
  process.exit(1);
}

if (isNaN(fps) || fps <= 0) {
  console.error(`Error: invalid fps value: ${flags.fps}`);
  process.exit(1);
}

// --- Detect frame extension ---
const files = fs.readdirSync(framesDir).sort();
const framePattern = /^frame_\d+\.(png|jpe?g)$/i;
const frameFiles = files.filter((f) => framePattern.test(f));

if (frameFiles.length === 0) {
  console.error(
    `Error: no files matching frame_XXXXX.{png,jpg,jpeg} found in: ${framesDir}`
  );
  process.exit(1);
}

// Use the extension of the first frame file
const ext = path.extname(frameFiles[0]).toLowerCase();

console.log(`Found ${frameFiles.length} frame(s) in: ${framesDir}`);
console.log(`Output : ${outputFile}`);
console.log(`FPS    : ${fps}`);
console.log(`Format : ${ext}`);

// --- Verify ffmpeg is available ---
try {
  execSync("ffmpeg -version", { stdio: "ignore" });
} catch {
  console.error(
    "Error: ffmpeg not found. Install it from https://ffmpeg.org/download.html and ensure it is on your PATH."
  );
  process.exit(1);
}

// --- Build ffmpeg concat list ---
// Using the concat demuxer so frames can start at any number (e.g. frame_00120)
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const concatListPath = path.join(outputDir, "_concat_list.txt");
const duration = 1 / fps;
const concatContent = frameFiles
  .map((f) => {
    // Use forward slashes and escape single quotes for ffmpeg
    const absPath = path.join(framesDir, f).replace(/\\/g, "/").replace(/'/g, "'\\\\''" );
    return `file '${absPath}'\nduration ${duration.toFixed(6)}`;
  })
  .join("\n");

fs.writeFileSync(concatListPath, concatContent + "\n", "utf8");

const cmd = [
  "ffmpeg",
  "-y",                          // overwrite output without prompting
  "-f concat",                   // use concat demuxer (explicit file list)
  "-safe 0",                     // allow absolute paths in the list
  `-i "${concatListPath}"`,
  "-c:v libx264",                // H.264 codec — widely compatible
  "-pix_fmt yuv420p",            // required for QuickTime / browser compatibility
  "-crf 18",                     // quality: 0 (lossless) – 51 (worst); 18 is near-lossless
  `"${outputFile}"`,
].join(" ");

console.log(`\nRunning: ${cmd}\n`);

try {
  execSync(cmd, { stdio: "inherit" });
  console.log(`\nDone! Video saved to: ${outputFile}`);
} finally {
  // Clean up the temporary concat list
  fs.rmSync(concatListPath, { force: true });
}
