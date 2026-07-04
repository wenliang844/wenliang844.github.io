#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = "data/vendor-manifest.json";
const VENDOR_DIR = "js/vendor";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REMOTE_TYPES = new Set(["script", "module-script", "wasm-base", "model", "model-base"]);
const REMOTE_PINNING = new Set(["versioned-url", "upstream-latest", "package-model-path"]);

function normalizePath(path) {
  return path.replace(/\\/g, "/");
}

async function sha256(filePath) {
  const body = await readFile(join(ROOT, filePath));
  return createHash("sha256").update(body).digest("hex");
}

async function vendorFiles() {
  const entries = await readdir(join(ROOT, VENDOR_DIR), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => normalizePath(join(VENDOR_DIR, entry.name)))
    .sort();
}

function validateMetadata(errors, entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push("manifest files entries must be objects");
    return;
  }
  for (const field of ["path", "name", "packageName", "license", "source", "sha256"]) {
    if (typeof entry[field] !== "string" || entry[field].length === 0) {
      errors.push(`${entry.path || "unknown"} missing ${field}`);
    }
  }
  if (entry.browserVersion !== null && typeof entry.browserVersion !== "string") {
    errors.push(`${entry.path || "unknown"} browserVersion must be a string or null`);
  }
  if (!Number.isInteger(entry.bytes) || entry.bytes <= 0) {
    errors.push(`${entry.path || "unknown"} bytes must be a positive integer`);
  }
  if (typeof entry.sha256 === "string" && !SHA256_PATTERN.test(entry.sha256)) {
    errors.push(`${entry.path || "unknown"} sha256 must be lowercase hex`);
  }
  if (typeof entry.source === "string" && !/^https:\/\//.test(entry.source)) {
    errors.push(`${entry.path || "unknown"} source must use https`);
  }
}

function validateRemoteResource(errors, entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push("manifest remoteResources entries must be objects");
    return;
  }
  for (const field of ["id", "url", "type", "packageName", "version", "provider", "trigger", "pinning"]) {
    if (typeof entry[field] !== "string" || entry[field].length === 0) {
      errors.push(`${entry.id || "unknown remote resource"} missing ${field}`);
    }
  }
  if (typeof entry.url === "string" && !/^https:\/\//.test(entry.url)) {
    errors.push(`${entry.id || entry.url} url must use https`);
  }
  if (typeof entry.type === "string" && !REMOTE_TYPES.has(entry.type)) {
    errors.push(`${entry.id || entry.url} has unsupported type ${entry.type}`);
  }
  if (typeof entry.pinning === "string" && !REMOTE_PINNING.has(entry.pinning)) {
    errors.push(`${entry.id || entry.url} has unsupported pinning ${entry.pinning}`);
  }
  if (entry.userConsentRequired !== true) {
    errors.push(`${entry.id || entry.url} must require explicit user consent`);
  }
  if (entry.localFallbackPlanned !== true) {
    errors.push(`${entry.id || entry.url} must keep localFallbackPlanned=true`);
  }
  if (entry.pinning === "upstream-latest" && typeof entry.notes !== "string") {
    errors.push(`${entry.id || entry.url} upstream-latest resources must document the risk in notes`);
  }
}

async function validateManifest() {
  const errors = [];
  const manifest = JSON.parse(await readFile(join(ROOT, MANIFEST_PATH), "utf8"));
  if (manifest.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (!Array.isArray(manifest.files)) {
    errors.push("files must be an array");
    return errors;
  }

  const actualFiles = await vendorFiles();
  const manifestFiles = manifest.files.map((entry) => entry?.path).sort();
  const actualSet = new Set(actualFiles);
  const manifestSet = new Set(manifestFiles);
  actualFiles.forEach((file) => {
    if (!manifestSet.has(file)) {
      errors.push(`missing manifest entry for ${file}`);
    }
  });
  manifestFiles.forEach((file) => {
    if (!actualSet.has(file)) {
      errors.push(`manifest entry has no vendor file: ${file}`);
    }
  });
  if (manifestSet.size !== manifestFiles.length) {
    errors.push("manifest contains duplicate file paths");
  }

  for (const entry of manifest.files) {
    validateMetadata(errors, entry);
    if (!entry?.path || !actualSet.has(entry.path)) {
      continue;
    }
    const fileStat = await stat(join(ROOT, entry.path));
    if (fileStat.size !== entry.bytes) {
      errors.push(`${entry.path} size changed: ${fileStat.size} != ${entry.bytes}`);
    }
    const digest = await sha256(entry.path);
    if (digest !== entry.sha256) {
      errors.push(`${entry.path} sha256 changed: ${digest} != ${entry.sha256}`);
    }
  }

  if (manifest.remoteResources !== undefined) {
    if (!Array.isArray(manifest.remoteResources)) {
      errors.push("remoteResources must be an array when present");
    } else {
      const ids = manifest.remoteResources.map((entry) => entry?.id);
      const urls = manifest.remoteResources.map((entry) => entry?.url);
      if (new Set(ids).size !== ids.length) {
        errors.push("remoteResources contains duplicate ids");
      }
      if (new Set(urls).size !== urls.length) {
        errors.push("remoteResources contains duplicate urls");
      }
      for (const entry of manifest.remoteResources) {
        validateRemoteResource(errors, entry);
      }
    }
  }

  return errors;
}

async function main() {
  const errors = await validateManifest();
  if (errors.length > 0) {
    console.error(`Vendor manifest check failed for ${relative(ROOT, join(ROOT, MANIFEST_PATH))}:`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("Vendor manifest matches js/vendor assets and documented remote runtime resources.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
