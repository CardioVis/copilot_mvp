#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

async function usage() {
  console.log('Usage: node scripts/copy_postfix.js <srcDir> <destDir>');
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const NUM_POSTFIX = 11; // fixed number of postfix characters
  const nonOpts = [];

  for (const arg of argv) {
    if (arg.startsWith('-')) {
      // ignore flags
    } else {
      nonOpts.push(arg);
    }
  }

  if (nonOpts.length < 2) return usage();
  const srcDir = nonOpts[0];
  const destDir = nonOpts[1];

  try {
    await fs.mkdir(destDir, { recursive: true });
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    let copied = 0;

    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const origName = ent.name;
      const ext = path.extname(origName);
      const base = path.basename(origName, ext);
      const postfix = NUM_POSTFIX === 0 ? '' : base.slice(-NUM_POSTFIX) || base;
      let newName = postfix + ext;

      // ensure unique name in dest
      let candidate = newName;
      let counter = 1;
      while (true) {
        try {
          await fs.access(path.join(destDir, candidate));
          // exists -> bump
          const nameOnly = path.basename(newName, path.extname(newName));
          const extPart = path.extname(newName);
          candidate = `${nameOnly}_${counter}${extPart}`;
          counter += 1;
        } catch (e) {
          // doesn't exist -> ok
          break;
        }
      }

      await fs.copyFile(path.join(srcDir, origName), path.join(destDir, candidate));
      console.log(`Copied: ${origName} -> ${candidate}`);
      copied += 1;
    }

    console.log(`Done. ${copied} files copied from ${srcDir} to ${destDir}`);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exitCode = 2;
  }
}

if (require.main === module) main();
