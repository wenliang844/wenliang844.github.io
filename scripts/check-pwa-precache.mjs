#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { PWA_PRECACHE_URLS, uniquePwaPrecacheUrls } from "../src/pwa-precache.mjs";
import { classifyPwaRequest } from "../src/pwa-cache-policy.mjs";
import { pageAssetUrls } from "../src/page-assets.mjs";
import { artifactOwnershipForPath } from "./check-generated-artifact-manifest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVICE_WORKER_PATH = join(ROOT, "service-worker.js");
const GENERATED_ARTIFACT_MANIFEST_PATH = join(ROOT, "data", "generated-artifact-manifest.json");

function toLocalPath(url) {
  if (url === "/") return "index.html";
  return url.replace(/^\/+/, "");
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  values.forEach((value) => {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  });
  return [...repeated].sort();
}

async function loadServiceWorkerPrecacheUrls() {
  const code = await readFile(SERVICE_WORKER_PATH, "utf8");
  const sandbox = {
    URL,
    Response,
    Promise,
    console,
    self: {
      location: { origin: "https://wenliang844.github.io" },
      addEventListener() {},
      skipWaiting() {
        return Promise.resolve();
      },
      clients: {
        claim() {
          return Promise.resolve();
        },
      },
    },
    caches: {
      open() {
        return Promise.resolve({ addAll: () => Promise.resolve(), put: () => Promise.resolve() });
      },
      keys() {
        return Promise.resolve([]);
      },
      match() {
        return Promise.resolve(undefined);
      },
      delete() {
        return Promise.resolve(true);
      },
    },
    fetch() {
      return Promise.resolve(new Response(""));
    },
  };
  sandbox.self.self = sandbox.self;
  vm.runInNewContext(code, sandbox, { filename: "service-worker.js" });
  return JSON.parse(JSON.stringify(sandbox.self.CWL_PWA_CACHE_POLICY?.PRECACHE_URLS ?? []));
}

async function missingLocalFiles(urls) {
  const missing = [];
  for (const url of urls) {
    try {
      await stat(join(ROOT, toLocalPath(url)));
    } catch {
      missing.push(url);
    }
  }
  return missing;
}

async function unmanagedPrecacheUrls(urls) {
  const manifest = JSON.parse(await readFile(GENERATED_ARTIFACT_MANIFEST_PATH, "utf8"));
  const unmanaged = [];
  for (const url of urls) {
    const ownership = await artifactOwnershipForPath(manifest, toLocalPath(url));
    if (!ownership) {
      unmanaged.push(url);
    }
  }
  return unmanaged;
}

async function fontUrlsFromCss(cssUrl) {
  const cssPath = join(ROOT, toLocalPath(cssUrl));
  const css = await readFile(cssPath, "utf8");
  const cssDir = posix.dirname(cssUrl);
  const urls = [];
  for (const match of css.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)) {
    const raw = match[2];
    if (/^(?:data:|https?:)/i.test(raw)) continue;
    urls.push(posix.normalize(posix.join(cssDir, raw)).replace(/^(?!\/)/, "/"));
  }
  return [...new Set(urls)].sort();
}

async function validatePrecache() {
  const errors = [];
  const expected = uniquePwaPrecacheUrls();
  const actual = await loadServiceWorkerPrecacheUrls();
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missingFromServiceWorker = expected.filter((url) => !actualSet.has(url));
  const extraInServiceWorker = actual.filter((url) => !expectedSet.has(url));
  const duplicateExpected = duplicates(PWA_PRECACHE_URLS);
  const duplicateActual = duplicates(actual);
  const missingFiles = await missingLocalFiles(expected);
  const unmanagedUrls = await unmanagedPrecacheUrls(expected);
  const uncacheableUrls = expected
    .map((url) => ({ url, decision: classifyPwaRequest(url) }))
    .filter(({ decision }) => decision.cacheable !== true);
  const cssFontUrls = await fontUrlsFromCss("/css/fontawesome-all.min.css");
  const missingFonts = cssFontUrls.filter((url) => !expectedSet.has(url));
  const manifestPageAssetUrls = pageAssetUrls();
  const missingPageAssets = manifestPageAssetUrls.filter((url) => !expectedSet.has(url));

  missingFromServiceWorker.forEach((url) => errors.push(`service worker is missing precache URL: ${url}`));
  extraInServiceWorker.forEach((url) => errors.push(`service worker has unmanaged precache URL: ${url}`));
  duplicateExpected.forEach((url) => errors.push(`source precache URL is duplicated: ${url}`));
  duplicateActual.forEach((url) => errors.push(`service worker precache URL is duplicated: ${url}`));
  missingFiles.forEach((url) => errors.push(`precache URL has no local file: ${url}`));
  unmanagedUrls.forEach((url) => errors.push(`precache URL is not covered by generated artifact manifest: ${url}`));
  uncacheableUrls.forEach(({ url, decision }) => {
    errors.push(`precache URL is not cacheable by policy: ${url} (${decision.category}/${decision.reason})`);
  });
  missingFonts.forEach((url) => errors.push(`fontawesome CSS font URL is not precached: ${url}`));
  missingPageAssets.forEach((url) => errors.push(`page asset manifest URL is not precached: ${url}`));

  return {
    errors,
    expectedCount: expected.length,
    actualCount: actual.length,
    missingFiles: missingFiles.length,
    unmanagedUrls: unmanagedUrls.length,
    missingFromServiceWorker: missingFromServiceWorker.length,
    extraInServiceWorker: extraInServiceWorker.length,
    uncacheableUrls: uncacheableUrls.length,
    cssFontUrls: cssFontUrls.length,
    pageAssetUrls: manifestPageAssetUrls.length,
    missingPageAssets: missingPageAssets.length,
  };
}

async function main() {
  const result = await validatePrecache();
  console.log(`PWA precache URLs: ${result.expectedCount}`);
  console.log(`Service worker precache URLs: ${result.actualCount}`);
  console.log(`Missing files: ${result.missingFiles}`);
  console.log(`Managed precache URL gaps: ${result.unmanagedUrls}`);
  console.log(`Missing from service worker: ${result.missingFromServiceWorker}`);
  console.log(`Extra in service worker: ${result.extraInServiceWorker}`);
  console.log(`Uncacheable URLs: ${result.uncacheableUrls}`);
  console.log(`Font URLs covered: ${result.cssFontUrls}`);
  console.log(`Page asset URLs covered: ${result.pageAssetUrls}`);
  console.log(`Missing page asset URLs: ${result.missingPageAssets}`);

  if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("PWA precache check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { fontUrlsFromCss, loadServiceWorkerPrecacheUrls, unmanagedPrecacheUrls, validatePrecache };
