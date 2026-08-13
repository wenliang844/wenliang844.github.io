#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_DIRECTORIES = ["_astro", "css", "js", "images", "fonts"];
const STATIC_FILES = ["manifest.webmanifest", "offline.html"];
const CACHE_LINE = /const CACHE_NAME = `\$\{CACHE_PREFIX\}[^`]+`;/;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root, directory) {
  const base = join(root, directory);
  if (!(await exists(base))) return [];
  const files = [];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(relative(root, path).replaceAll("\\", "/"));
    }
  };
  await visit(base);
  return files;
}

export async function versionServiceWorker(root = ROOT) {
  const projectRoot = resolve(root);
  const workerPath = join(projectRoot, "service-worker.js");
  const source = await readFile(workerPath, "utf8");
  if (!CACHE_LINE.test(source)) throw new Error("Service worker cache version declaration is missing.");

  const files = [
    ...STATIC_FILES.filter((path) => exists(join(projectRoot, path))),
    ...(await Promise.all(STATIC_DIRECTORIES.map((path) => listFiles(projectRoot, path)))).flat(),
  ];
  const resolvedFiles = [];
  for (const item of files) {
    if (typeof item === "string" && await exists(join(projectRoot, item))) resolvedFiles.push(item);
  }
  resolvedFiles.sort();

  const hash = createHash("sha256");
  hash.update(source.replace(CACHE_LINE, "const CACHE_NAME = `${CACHE_PREFIX}<content-hash>`;"));
  for (const path of resolvedFiles) {
    hash.update(`\n${path}\n`);
    hash.update(await readFile(join(projectRoot, path)));
  }
  const cacheVersion = hash.digest("hex").slice(0, 16);
  const output = source.replace(CACHE_LINE, `const CACHE_NAME = \`\${CACHE_PREFIX}${cacheVersion}\`;`);
  if (output !== source) await writeFile(workerPath, output, "utf8");
  return { cacheVersion, files: resolvedFiles.length, updated: output !== source };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await versionServiceWorker();
  console.log(`PWA cache version ${result.cacheVersion}: ${result.files} static files${result.updated ? " updated" : " unchanged"}.`);
}
