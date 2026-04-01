#!/usr/bin/env node
/**
 * parse_data.js
 *
 * Parses a Label Studio brush-annotation JSON export and outputs a
 * trimmed file containing only the fields needed for downstream
 * processing:
 *
 *   image            – relative path to the source frame
 *   id               – annotation record ID
 *   tags[]
 *     brushlabels[]  – semantic label names
 *     rle[]          – run-length encoded segmentation mask
 *     original_width / original_height – dimensions needed to decode the RLE
 *
 * Usage:
 *   node scripts/parse_data.js [input.json] [output.json] [--limit=N]
 *
 * Defaults:
 *   input  → scripts/data.json
 *   output → scripts/data_parsed.json
 *
 * Options:
 *   --limit=N  Only parse the first N records
 */

const fs = require("fs");
const path = require("path");

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : null;

const inputPath = path.resolve(process.argv.find((a, i) => i >= 2 && !a.startsWith("--")) ?? "scripts/data.json");

const positional = process.argv.filter((a, i) => i >= 2 && !a.startsWith("--"));

let outputPath;
if (positional[1]) {
  outputPath = path.resolve(positional[1]);
} else if (positional[0]) {
  const ext = path.extname(inputPath);
  outputPath = path.join(path.dirname(inputPath), path.basename(inputPath, ext) + "_parsed" + ext);
} else {
  outputPath = path.resolve("scripts/data_parsed.json");
}

// ── Read & parse ──────────────────────────────────────────────────────────────

let raw;
try {
  raw = fs.readFileSync(inputPath, "utf8");
} catch (err) {
  console.error(`Error reading input file "${inputPath}": ${err.message}`);
  process.exit(1);
}

let records;
try {
  records = JSON.parse(raw);
} catch (err) {
  console.error(`Error parsing JSON in "${inputPath}": ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(records)) {
  console.error("Expected the JSON file to contain an array at the top level.");
  process.exit(1);
}

// ── Transform ─────────────────────────────────────────────────────────────────

const subset = limit !== null ? records.slice(0, limit) : records;

const parsed = subset.map((record, index) => {
  const tags = Array.isArray(record.tag)
    ? record.tag.map((t) => ({
        label: (t.brushlabels ?? [])[0] ?? "",
        rle: t.rle ?? []
      }))
    : [];

  const basename = path.basename(record.image);
  const ext = path.extname(basename);
  const name = path.basename(basename, ext);
  const image = name.slice(-11) + ext;

  return {
    id: index,
    image,
    tags,
  };
});

// ── Write output ──────────────────────────────────────────────────────────────

try {
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2), "utf8");
} catch (err) {
  console.error(`Error writing output file "${outputPath}": ${err.message}`);
  process.exit(1);
}

console.log(
  `Parsed ${parsed.length} record(s) → "${outputPath}"`
);
