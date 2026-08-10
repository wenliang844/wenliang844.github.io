#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_PATHS = ["src/posts", "images", "src/config.mjs", "src/content.config.ts"];

function safeRelativePath(value) {
  const normalized = String(value || "").replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe backup path: ${value}`);
  }
  return normalized;
}

function pathInside(parent, candidate) {
  const rel = relative(parent, candidate);
  return Boolean(rel) && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (relativePath === "images/generated" || relativePath.startsWith("images/generated/")) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(fullPath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files.sort();
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function buildManifest(snapshotRoot, metadata = {}) {
  const files = (await listFiles(snapshotRoot)).filter((path) => path !== "backup-manifest.json");
  const entries = [];
  for (const path of files) {
    const fullPath = join(snapshotRoot, ...path.split("/"));
    entries.push({ path, bytes: (await stat(fullPath)).size, sha256: await sha256(fullPath) });
  }
  return {
    version: 1,
    createdAt: metadata.createdAt || new Date().toISOString(),
    revision: metadata.revision || process.env.GITHUB_SHA || null,
    r2Included: entries.some((entry) => entry.path.startsWith("r2/")),
    files: entries,
  };
}

export async function createContentBackup({ root = ROOT, outDir, r2Source = null, createdAt, revision } = {}) {
  const sourceRoot = resolve(root);
  const destination = resolve(outDir || join(sourceRoot, "temp", "content-backup"));
  if (!pathInside(sourceRoot, destination)) throw new Error("Backup output must be a new directory inside the project.");
  if (await exists(destination)) throw new Error(`Backup output already exists: ${destination}`);
  await mkdir(destination, { recursive: true });

  for (const sourcePath of CONTENT_PATHS) {
    const source = join(sourceRoot, ...sourcePath.split("/"));
    if (!(await exists(source))) throw new Error(`Required backup source is missing: ${sourcePath}`);
    await cp(source, join(destination, ...sourcePath.split("/")), { recursive: true, force: false });
  }
  if (r2Source && await exists(resolve(r2Source))) {
    await cp(resolve(r2Source), join(destination, "r2"), { recursive: true, force: false });
  }

  const manifest = await buildManifest(destination, { createdAt, revision });
  await writeFile(join(destination, "backup-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export async function verifyContentBackup(backupDir) {
  const source = resolve(backupDir);
  const manifest = JSON.parse(await readFile(join(source, "backup-manifest.json"), "utf8"));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("Backup manifest is invalid or empty.");
  }
  const seen = new Set();
  for (const entry of manifest.files) {
    const relativePath = safeRelativePath(entry.path);
    if (seen.has(relativePath)) throw new Error(`Duplicate backup path: ${relativePath}`);
    seen.add(relativePath);
    const fullPath = resolve(source, ...relativePath.split("/"));
    if (!pathInside(source, fullPath)) throw new Error(`Backup entry escapes snapshot: ${relativePath}`);
    const fileStat = await stat(fullPath);
    if (!fileStat.isFile() || fileStat.size !== entry.bytes || await sha256(fullPath) !== entry.sha256) {
      throw new Error(`Backup integrity check failed: ${relativePath}`);
    }
  }
  return manifest;
}

export async function restoreContentBackup({ backupDir, outDir }) {
  const source = resolve(backupDir);
  const destination = resolve(outDir);
  if (await exists(destination)) throw new Error(`Restore output already exists: ${destination}`);
  const manifest = await verifyContentBackup(source);
  await mkdir(destination, { recursive: true });
  for (const entry of manifest.files) {
    const relativePath = safeRelativePath(entry.path);
    const target = join(destination, ...relativePath.split("/"));
    await mkdir(dirname(target), { recursive: true });
    await cp(join(source, ...relativePath.split("/")), target, { force: false });
  }
  await writeFile(join(destination, "backup-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const verifyPath = argument("--verify");
  const restorePath = argument("--restore");
  if (verifyPath) {
    const manifest = await verifyContentBackup(verifyPath);
    console.log(`Backup verified: ${manifest.files.length} files${manifest.r2Included ? " including R2" : ""}.`);
    return;
  }
  if (restorePath) {
    const outDir = argument("--out");
    if (!outDir) throw new Error("Restore requires --out <new-directory>.");
    const manifest = await restoreContentBackup({ backupDir: restorePath, outDir });
    console.log(`Backup restored to ${resolve(outDir)}: ${manifest.files.length} files.`);
    return;
  }
  const outDir = argument("--out");
  if (!outDir) throw new Error("Backup requires --out <new-directory>.");
  const manifest = await createContentBackup({ outDir, r2Source: argument("--r2-source") });
  console.log(`Backup created at ${resolve(outDir)}: ${manifest.files.length} files${manifest.r2Included ? " including R2" : ""}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
