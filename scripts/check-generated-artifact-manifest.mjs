#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, "data", "generated-artifact-manifest.json");
const BUILD_SCRIPT_PATH = join(ROOT, "scripts", "build.mjs");
const POSTS_DIR = join(ROOT, "src", "posts");

function toPosix(path) {
  return path.replace(/\\/g, "/");
}

async function exists(path) {
  try {
    await access(join(ROOT, path));
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, predicate, base = ROOT) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "temp") {
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath, predicate, base));
    } else if (entry.isFile() && predicate(fullPath)) {
      files.push(toPosix(relative(base, fullPath)));
    }
  }
  return files.sort();
}

async function listHtmlFiles() {
  return listFiles(ROOT, (file) => file.endsWith(".html"));
}

function exactGeneratedPaths(manifest) {
  return new Set((manifest.generated?.exactOutputs ?? []).map((entry) => entry.path));
}

function manualHtmlPaths(manifest) {
  return new Set((manifest.manualHtmlPages ?? []).map((entry) => entry.path));
}

function manualStaticPaths(manifest) {
  return new Set((manifest.manualStaticFiles ?? []).map((entry) => entry.path));
}

async function postSlugs() {
  const entries = (await readdir(POSTS_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const slugs = [];
  for (const entry of entries) {
    const markdown = await readFile(join(POSTS_DIR, entry.name), "utf8");
    const slug = /^slug:\s*"([^"]+)"\s*$/m.exec(markdown)?.[1];
    if (!slug) {
      throw new Error(`Post is missing a slug front matter field: ${entry.name}`);
    }
    slugs.push(slug);
  }
  return slugs;
}

async function dynamicPostPaths(manifest) {
  const outputPattern = manifest.generated?.dynamicPostPages?.outputPattern;
  if (outputPattern !== "post/{slug}/index.html") {
    throw new Error("generated.dynamicPostPages.outputPattern must be post/{slug}/index.html");
  }
  return new Set((await postSlugs()).map((slug) => outputPattern.replace("{slug}", slug)));
}

async function staticBuildOutputs() {
  const buildScript = await readFile(BUILD_SCRIPT_PATH, "utf8");
  return new Set(
    [...buildScript.matchAll(/writeFileEnsured\("([^"`$]+)",/g)]
      .map((match) => match[1])
      .sort(),
  );
}

function validateManifestShape(manifest) {
  const errors = [];
  if (manifest.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1.");
  }
  if (!manifest.generated?.dynamicPostPages) {
    errors.push("generated.dynamicPostPages is required.");
  }
  if (!Array.isArray(manifest.generated?.exactOutputs)) {
    errors.push("generated.exactOutputs must be an array.");
  }
  if (!Array.isArray(manifest.manualHtmlPages)) {
    errors.push("manualHtmlPages must be an array.");
  }
  if (manifest.manualStaticFiles !== undefined && !Array.isArray(manifest.manualStaticFiles)) {
    errors.push("manualStaticFiles must be an array when present.");
  }
  if (!Array.isArray(manifest.copiedAssetDirectories)) {
    errors.push("copiedAssetDirectories must be an array.");
  }

  const seen = new Set();
  for (const entry of manifest.generated?.exactOutputs ?? []) {
    if (!entry.path || typeof entry.path !== "string") {
      errors.push("generated.exactOutputs entries must include a path.");
    }
    if (!entry.owner || typeof entry.owner !== "string") {
      errors.push(`${entry.path || "generated output"} must include an owner.`);
    }
    if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
      errors.push(`${entry.path || "generated output"} must include at least one source.`);
    }
    if (seen.has(entry.path)) {
      errors.push(`Duplicate generated output path: ${entry.path}`);
    }
    seen.add(entry.path);
  }

  for (const entry of manifest.manualHtmlPages ?? []) {
    if (!entry.path || typeof entry.path !== "string") {
      errors.push("manualHtmlPages entries must include a path.");
    }
    if (!entry.owner || typeof entry.owner !== "string") {
      errors.push(`${entry.path || "manual HTML page"} must include an owner.`);
    }
  }
  for (const entry of manifest.manualStaticFiles ?? []) {
    if (!entry.path || typeof entry.path !== "string") {
      errors.push("manualStaticFiles entries must include a path.");
    }
    if (!entry.owner || typeof entry.owner !== "string") {
      errors.push(`${entry.path || "manual static file"} must include an owner.`);
    }
  }
  for (const dir of manifest.copiedAssetDirectories ?? []) {
    if (!dir || typeof dir !== "string") {
      errors.push("copiedAssetDirectories entries must be non-empty strings.");
    }
  }
  return errors;
}

async function artifactOwnershipForPath(manifest, path) {
  const normalizedPath = toPosix(path).replace(/^\/+/, "");
  if (!normalizedPath) {
    return null;
  }

  if (exactGeneratedPaths(manifest).has(normalizedPath)) {
    return { type: "generated", owner: "scripts/build.mjs" };
  }
  if (manualHtmlPaths(manifest).has(normalizedPath)) {
    return { type: "manual-html", owner: "manual-static-page" };
  }
  if (manualStaticPaths(manifest).has(normalizedPath)) {
    return { type: "manual-static", owner: "manual-static-file" };
  }
  if ((await dynamicPostPaths(manifest)).has(normalizedPath)) {
    return { type: "dynamic-post", owner: "scripts/build.mjs" };
  }
  for (const dir of manifest.copiedAssetDirectories ?? []) {
    if (normalizedPath === dir || normalizedPath.startsWith(`${dir}/`)) {
      return { type: "copied-asset", owner: dir };
    }
  }
  return null;
}

async function validateGeneratedArtifactManifest(manifest) {
  const errors = validateManifestShape(manifest);
  if (errors.length > 0) {
    return errors;
  }

  const generatedExact = exactGeneratedPaths(manifest);
  const manualHtml = manualHtmlPaths(manifest);
  const manualStatic = manualStaticPaths(manifest);
  const dynamicPosts = await dynamicPostPaths(manifest);
  const buildOutputs = await staticBuildOutputs();

  for (const output of buildOutputs) {
    if (!generatedExact.has(output)) {
      errors.push(`Build output is missing from generated.exactOutputs: ${output}`);
    }
  }
  for (const output of generatedExact) {
    if (!buildOutputs.has(output)) {
      errors.push(`generated.exactOutputs contains a path not written by build.mjs: ${output}`);
    }
    if (!(await exists(output))) {
      errors.push(`Generated output is missing from the repository root: ${output}`);
    }
  }
  for (const output of manualHtml) {
    if (!(await exists(output))) {
      errors.push(`Manual HTML page is missing from the repository root: ${output}`);
    }
  }
  for (const output of manualStatic) {
    if (!(await exists(output))) {
      errors.push(`Manual static file is missing from the repository root: ${output}`);
    }
  }
  for (const output of dynamicPosts) {
    if (!(await exists(output))) {
      errors.push(`Dynamic post output is missing from the repository root: ${output}`);
    }
  }

  for (const file of await listHtmlFiles()) {
    const classified = generatedExact.has(file) || manualHtml.has(file) || dynamicPosts.has(file);
    if (!classified) {
      errors.push(`Committed HTML file is not classified as generated or manual: ${file}`);
    }
  }

  for (const dir of manifest.copiedAssetDirectories ?? []) {
    if (!(await exists(dir))) {
      errors.push(`Copied asset directory is missing: ${dir}`);
    }
  }
  return errors;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const errors = await validateGeneratedArtifactManifest(manifest);
  if (errors.length > 0) {
    console.error("Generated artifact manifest check failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("Generated artifact manifest covers build outputs, manual HTML pages, manual static files and copied asset directories.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  dynamicPostPaths,
  artifactOwnershipForPath,
  exactGeneratedPaths,
  manualHtmlPaths,
  manualStaticPaths,
  staticBuildOutputs,
  validateGeneratedArtifactManifest,
};
