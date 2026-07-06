import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { renderToolsPage } from "../src/templates/tools.mjs";

const ROOT = join(import.meta.dirname, "..");
const MANIFEST_PATH = join(ROOT, "data", "vendor-manifest.json");

function normalizePath(path) {
  return path.replace(/\\/g, "/");
}

async function sha256(relPath) {
  const body = await readFile(join(ROOT, relPath));
  return createHash("sha256").update(body).digest("hex");
}

test("vendor manifest covers every local vendor script with hashes", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const vendorEntries = await readdir(join(ROOT, "js", "vendor"), { withFileTypes: true });
  const actualFiles = vendorEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => normalizePath(join("js", "vendor", entry.name)))
    .sort();
  const manifestFiles = manifest.files.map((entry) => entry.path).sort();

  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifestFiles, actualFiles);

  for (const entry of manifest.files) {
    assert.match(entry.path, /^js\/vendor\/.+\.js$/);
    assert.ok(entry.name);
    assert.ok(entry.packageName);
    assert.ok(entry.license);
    assert.match(entry.source, /^https:\/\//);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.equal((await stat(join(ROOT, entry.path))).size, entry.bytes);
    assert.equal(await sha256(entry.path), entry.sha256);
  }
});

test("vendor manifest documents known browser and build-time marked versions", async () => {
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(join(ROOT, "package-lock.json"), "utf8"));
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const marked = manifest.files.find((entry) => entry.path === "js/vendor/marked.min.js");
  const qrcode = manifest.files.find((entry) => entry.path === "js/vendor/qrcode.min.js");

  assert.equal(marked.browserVersion, "12.0.2");
  assert.equal(marked.nodePackageVersion, packageLock.packages["node_modules/marked"].version);
  assert.equal(packageJson.devDependencies.marked, "^18.0.5");
  assert.equal(qrcode.browserVersion, null);
  assert.match(qrcode.notes, /does not include a version banner/);
});

test("vendor manifest documents gesture remote runtime resources", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const gestureCode = await readFile(join(ROOT, "js", "gesture.js"), "utf8");
  const gestureRemoteUrls = Array.from(
    gestureCode.matchAll(/https:\/\/(?:cdn\.jsdelivr\.net|storage\.googleapis\.com)\/[^"']+/g),
    (match) => match[0],
  ).sort();
  const manifestRemoteUrls = manifest.remoteResources.map((entry) => entry.url).sort();

  assert.deepEqual(manifestRemoteUrls, gestureRemoteUrls);

  for (const entry of manifest.remoteResources) {
    assert.match(entry.id, /^gesture-/);
    assert.match(entry.url, /^https:\/\//);
    assert.ok(["script", "module-script", "wasm-base", "model", "model-base"].includes(entry.type));
    assert.ok(entry.packageName);
    assert.ok(entry.version);
    assert.ok(entry.provider);
    assert.ok(entry.trigger.includes("explicit acknowledgement"));
    assert.equal(entry.userConsentRequired, true);
    assert.equal(entry.localFallbackPlanned, true);
    assert.ok(["versioned-url", "upstream-latest", "package-model-path"].includes(entry.pinning));
    if (entry.pinning === "upstream-latest") {
      assert.match(entry.notes, /self-hosted hash-pinned model/);
    }
  }
});

test("tools page surfaces gesture remote resource governance status", async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const html = renderToolsPage();
  const remoteResources = manifest.remoteResources.filter((entry) => entry.id.startsWith("gesture-"));
  const watchedResources = remoteResources.filter((entry) => entry.pinning !== "versioned-url");

  assert.equal((html.match(/class="gesture-resource-item"/g) || []).length, remoteResources.length);
  assert.equal((html.match(/data-resource-status="watch"/g) || []).length, watchedResources.length);
  assert.match(html, /Visual resource governance status/);
  assert.match(html, /Self-hosting planned/);
});
