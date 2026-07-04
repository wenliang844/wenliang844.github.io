#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readdir, readFile, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CHECK_OUT = "temp/generated-drift-check";
const CHECK_DIR = resolve(ROOT, CHECK_OUT);

function assertInsideRoot(path, label) {
  const rel = relative(ROOT, path);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`${label} must stay inside the repository root: ${path}`);
  }
}

function toPosixPath(path) {
  return path.split("\\").join("/");
}

async function listFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(full, base));
    } else if (entry.isFile()) {
      files.push(toPosixPath(relative(base, full)));
    }
  }
  return files.sort();
}

async function compareGeneratedFiles(files) {
  const drifted = [];
  const missing = [];

  for (const file of files) {
    const expectedPath = join(CHECK_DIR, file);
    const actualPath = join(ROOT, file);
    let expected;
    let actual;
    try {
      [expected, actual] = await Promise.all([
        readFile(expectedPath),
        readFile(actualPath),
      ]);
    } catch {
      missing.push(file);
      continue;
    }

    if (!expected.equals(actual)) {
      drifted.push(file);
    }
  }

  return { drifted, missing };
}

async function main() {
  assertInsideRoot(CHECK_DIR, "generated drift check output");
  await rm(CHECK_DIR, { recursive: true, force: true });

  try {
    await execFileAsync("node", ["scripts/build.mjs", "--out", CHECK_OUT], {
      cwd: ROOT,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });

    const files = await listFiles(CHECK_DIR);
    const { drifted, missing } = await compareGeneratedFiles(files);

    if (missing.length || drifted.length) {
      if (missing.length) {
        console.error("Generated files missing from the repository root:");
        for (const file of missing) {
          console.error(`  - ${file}`);
        }
      }
      if (drifted.length) {
        console.error("Generated files are stale compared with the current build:");
        for (const file of drifted) {
          console.error(`  - ${file}`);
        }
      }
      console.error("Run npm run build and commit the updated generated artifacts.");
      process.exitCode = 1;
      return;
    }

    console.log(`Generated artifact drift check passed for ${files.length} file(s).`);
  } finally {
    await rm(CHECK_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Generated artifact drift check failed: ${error.message}`);
  process.exit(1);
});
