import test from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { CORE_SCRIPTS } from "../src/templates/layout.mjs";
import {
  PWA_PRECACHE_CORE_ASSETS,
  PWA_PRECACHE_CORE_ROUTES,
  PWA_PRECACHE_PAGE_ASSETS,
  PWA_PRECACHE_URLS,
  PWA_PRECACHE_WEBFONTS,
  uniquePwaPrecacheUrls,
} from "../src/pwa-precache.mjs";
import { pageAssetUrls } from "../src/page-assets.mjs";
import { classifyPwaRequest } from "../src/pwa-cache-policy.mjs";
import {
  fontUrlsFromCss,
  loadServiceWorkerPrecacheUrls,
  unmanagedPrecacheUrls,
  validatePrecache,
} from "../scripts/check-pwa-precache.mjs";

const ROOT = join(import.meta.dirname, "..");

function localPath(url) {
  return url === "/" ? "index.html" : url.replace(/^\/+/, "");
}

test("PWA precache source includes the app shell, core assets, page assets and layout scripts", () => {
  assert.deepEqual(PWA_PRECACHE_CORE_ROUTES, ["/", "/offline.html"]);
  assert.ok(PWA_PRECACHE_CORE_ASSETS.includes("/manifest.webmanifest"));
  assert.ok(PWA_PRECACHE_CORE_ASSETS.includes("/css/coder.css"));
  assert.ok(PWA_PRECACHE_CORE_ASSETS.includes("/css/assistant.css"));
  assert.ok(PWA_PRECACHE_WEBFONTS.includes("/webfonts/fa-solid-900.subset.woff2"));
  assert.deepEqual(PWA_PRECACHE_PAGE_ASSETS, pageAssetUrls());
  assert.ok(PWA_PRECACHE_PAGE_ASSETS.includes("/css/tools.css"));
  assert.ok(PWA_PRECACHE_PAGE_ASSETS.includes("/css/trust.css"));

  for (const script of CORE_SCRIPTS) {
    assert.ok(PWA_PRECACHE_URLS.includes(script), `${script} should be precached`);
  }
  for (const pageAsset of PWA_PRECACHE_PAGE_ASSETS) {
    assert.ok(PWA_PRECACHE_URLS.includes(pageAsset), `${pageAsset} should be precached`);
  }

  assert.deepEqual(uniquePwaPrecacheUrls(), PWA_PRECACHE_URLS);
});

test("PWA precache source only names existing cacheable local resources", async () => {
  for (const url of PWA_PRECACHE_URLS) {
    await stat(join(ROOT, localPath(url)));
    assert.equal(classifyPwaRequest(url).cacheable, true, `${url} should be cacheable`);
  }
});

test("service worker precache list matches the source module", async () => {
  assert.deepEqual(await loadServiceWorkerPrecacheUrls(), PWA_PRECACHE_URLS);
});

test("fontawesome webfonts referenced by CSS are included in the precache list", async () => {
  const fontUrls = await fontUrlsFromCss("/css/fontawesome-all.min.css");
  assert.deepEqual(fontUrls, PWA_PRECACHE_WEBFONTS);
});

test("PWA precache checker reports a clean resource graph", async () => {
  const result = await validatePrecache();

  assert.deepEqual(result.errors, []);
  assert.equal(result.expectedCount, PWA_PRECACHE_URLS.length);
  assert.equal(result.actualCount, PWA_PRECACHE_URLS.length);
  assert.equal(result.missingFiles, 0);
  assert.equal(result.unmanagedUrls, 0);
  assert.equal(result.missingFromServiceWorker, 0);
  assert.equal(result.extraInServiceWorker, 0);
  assert.equal(result.uncacheableUrls, 0);
  assert.equal(result.cssFontUrls, PWA_PRECACHE_WEBFONTS.length);
  assert.equal(result.pageAssetUrls, PWA_PRECACHE_PAGE_ASSETS.length);
  assert.equal(result.missingPageAssets, 0);
});

test("PWA precache URLs are owned by the generated artifact manifest", async () => {
  assert.deepEqual(await unmanagedPrecacheUrls(PWA_PRECACHE_URLS), []);
  assert.deepEqual(await unmanagedPrecacheUrls([...PWA_PRECACHE_URLS, "/unmanaged.txt"]), ["/unmanaged.txt"]);
});
