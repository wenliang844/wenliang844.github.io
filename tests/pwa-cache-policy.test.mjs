import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";

import {
  PWA_CACHE_POLICY_MATRIX,
  PWA_CACHE_STRATEGIES,
  classifyPwaRequest,
} from "../src/pwa-cache-policy.mjs";
import { PWA_PRECACHE_URLS } from "../src/pwa-precache.mjs";

const ROOT = join(import.meta.dirname, "..");

async function loadServiceWorkerPolicy({ cacheKeys = [] } = {}) {
  const code = await readFile(join(ROOT, "service-worker.js"), "utf8");
  const listeners = {};
  const deletedCaches = [];
  let clientsClaimed = false;
  const sandbox = {
    URL,
    Response,
    Promise,
    console,
    self: {
      location: { origin: "https://wenliang844.github.io" },
      addEventListener(type, listener) {
        listeners[type] = listener;
      },
      skipWaiting() {
        return Promise.resolve();
      },
      clients: {
        claim() {
          clientsClaimed = true;
          return Promise.resolve();
        },
      },
    },
    caches: {
      open() {
        return Promise.resolve({ addAll: () => Promise.resolve(), put: () => Promise.resolve() });
      },
      keys() {
        return Promise.resolve(cacheKeys);
      },
      match() {
        return Promise.resolve(undefined);
      },
      delete(key) {
        deletedCaches.push(key);
        return Promise.resolve(true);
      },
    },
    fetch() {
      return Promise.resolve(new Response(""));
    },
  };
  sandbox.self.self = sandbox.self;
  vm.runInNewContext(code, sandbox, { filename: "service-worker.js" });
  const policy = sandbox.self.CWL_PWA_CACHE_POLICY;
  policy.PRECACHE_URLS = JSON.parse(JSON.stringify(policy.PRECACHE_URLS));
  return {
    policy,
    listeners,
    deletedCaches,
    wasClientsClaimed: () => clientsClaimed,
  };
}

test("PWA cache policy matrix documents every supported strategy category", () => {
  const byCategory = new Map(PWA_CACHE_POLICY_MATRIX.map((entry) => [entry.category, entry]));

  for (const category of ["navigation", "static-asset", "search-index", "fresh-data", "sensitive-or-external"]) {
    assert.ok(byCategory.has(category), `${category} should be documented`);
    assert.ok(Array.isArray(byCategory.get(category).examples), `${category} should include examples`);
  }

  assert.equal(byCategory.get("navigation").strategy, PWA_CACHE_STRATEGIES.NETWORK_FIRST);
  assert.equal(byCategory.get("static-asset").strategy, PWA_CACHE_STRATEGIES.CACHE_FIRST);
  assert.equal(byCategory.get("search-index").strategy, PWA_CACHE_STRATEGIES.STALE_WHILE_REVALIDATE);
  assert.equal(byCategory.get("fresh-data").cacheable, false);
  assert.equal(byCategory.get("sensitive-or-external").cacheable, false);
});

test("PWA cache policy keeps non-GET and external requests network-only", () => {
  assert.deepEqual(
    classifyPwaRequest({ url: "/feedback", method: "POST" }),
    {
      strategy: PWA_CACHE_STRATEGIES.NETWORK_ONLY,
      category: "sensitive-or-external",
      reason: "non-get request",
      cacheable: false,
    },
  );

  assert.deepEqual(
    classifyPwaRequest("https://buttondown.com/api/emails/embed-subscribe/cwl"),
    {
      strategy: PWA_CACHE_STRATEGIES.NETWORK_ONLY,
      category: "sensitive-or-external",
      reason: "external origin",
      cacheable: false,
    },
  );
});

test("PWA cache policy rejects sensitive query strings and headers", () => {
  assert.equal(classifyPwaRequest("/tools/?api_key=secret").strategy, PWA_CACHE_STRATEGIES.NETWORK_ONLY);
  assert.equal(classifyPwaRequest("/assistant/?token=secret").reason, "sensitive query");

  const withAuth = classifyPwaRequest({
    url: "/search-index.json",
    method: "GET",
    headers: { Authorization: "Bearer secret" },
  });

  assert.equal(withAuth.strategy, PWA_CACHE_STRATEGIES.NETWORK_ONLY);
  assert.equal(withAuth.reason, "sensitive header");
});

test("PWA cache policy maps public data and static routes to explicit strategies", () => {
  assert.equal(classifyPwaRequest("/search-index.json").strategy, PWA_CACHE_STRATEGIES.STALE_WHILE_REVALIDATE);
  assert.equal(classifyPwaRequest("/data/relay-providers.json").strategy, PWA_CACHE_STRATEGIES.NETWORK_ONLY);
  assert.equal(classifyPwaRequest({ url: "/post/", mode: "navigate" }).strategy, PWA_CACHE_STRATEGIES.NETWORK_FIRST);
  assert.equal(classifyPwaRequest("/css/coder.css").strategy, PWA_CACHE_STRATEGIES.CACHE_FIRST);
  assert.equal(classifyPwaRequest("/js/vendor/fuse.min.js").strategy, PWA_CACHE_STRATEGIES.CACHE_FIRST);
  assert.equal(classifyPwaRequest("/manifest.webmanifest").strategy, PWA_CACHE_STRATEGIES.CACHE_FIRST);
});

test("PWA cache policy defaults unmatched same-origin requests to network-only", () => {
  const result = classifyPwaRequest("/unknown/custom-endpoint");

  assert.equal(result.strategy, PWA_CACHE_STRATEGIES.NETWORK_ONLY);
  assert.equal(result.cacheable, false);
  assert.equal(result.reason, "unmatched request");
});

test("service worker mirrors the source PWA cache policy decisions", async () => {
  const { policy: swPolicy, listeners } = await loadServiceWorkerPolicy();
  const cases = [
    "/",
    "/post/",
    "/offline.html",
    "/css/coder.css",
    "/js/pwa-register.js",
    "/manifest.webmanifest",
    "/search-index.json",
    "/data/relay-providers.json",
    "/tools/?api_key=secret",
    "https://buttondown.com/api/emails/embed-subscribe/cwl",
    { url: "/feedback", method: "POST" },
    { url: "/assistant/", method: "GET", headers: { Authorization: "Bearer secret" } },
    "/unknown/custom-endpoint",
  ];

  assert.equal(typeof listeners.install, "function");
  assert.equal(typeof listeners.activate, "function");
  assert.equal(typeof listeners.fetch, "function");
  assert.deepEqual(swPolicy.PRECACHE_URLS, PWA_PRECACHE_URLS);

  for (const item of cases) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(swPolicy.classifyPwaRequest(item))),
      classifyPwaRequest(item),
      `service worker policy should match source policy for ${typeof item === "string" ? item : item.url}`,
    );
  }
});

test("service worker activation removes old CWL caches only", async () => {
  const { policy: swPolicy } = await loadServiceWorkerPolicy();
  const currentPrecache = `cwlblog-precache-${swPolicy.VERSION}`;
  const currentRuntime = `cwlblog-runtime-${swPolicy.VERSION}`;
  const waitUntilPromises = [];

  const { listeners: activateListeners, deletedCaches: activateDeletedCaches, wasClientsClaimed: activateWasClientsClaimed } =
    await loadServiceWorkerPolicy({
      cacheKeys: [
        "cwlblog-precache-old",
        "cwlblog-runtime-old",
        currentPrecache,
        currentRuntime,
        "other-app-runtime-old",
      ],
    });

  activateListeners.activate({
    waitUntil(promise) {
      waitUntilPromises.push(promise);
    },
  });
  await Promise.all(waitUntilPromises);

  assert.deepEqual(activateDeletedCaches.sort(), ["cwlblog-precache-old", "cwlblog-runtime-old"]);
  assert.equal(activateWasClientsClaimed(), true);
});

test("PWA registration and fallback artifacts are conservative", async () => {
  const [registerJs, offlineHtml, serviceWorkerJs] = await Promise.all([
    readFile(join(ROOT, "js", "pwa-register.js"), "utf8"),
    readFile(join(ROOT, "offline.html"), "utf8"),
    readFile(join(ROOT, "service-worker.js"), "utf8"),
  ]);

  assert.match(registerJs, /const sw = navigator\.serviceWorker/);
  assert.match(registerJs, /location\.protocol === "https:" \|\| \/\^\(localhost\|127\\\.\|::1\)\//);
  assert.match(registerJs, /sw\.register\("\/service-worker\.js"\)/);
  assert.match(registerJs, /data-pwa-article-status/);
  assert.match(registerJs, /sw && sw\.controller/);
  assert.match(registerJs, /cwl:langchange/);
  assert.match(registerJs, /dyn\.pwa\.articleOffline/);
  assert.match(offlineHtml, /<meta name="robots" content="noindex,follow">/);
  assert.match(offlineHtml, /<main id="main-content"/);
  assert.match(serviceWorkerJs, /event\.respondWith\(fetch\(event\.request\)\)/);
  assert.match(serviceWorkerJs, /url\.pathname === "\/data\/relay-providers\.json" \|\| url\.pathname\.indexOf\("\/api\/"\) === 0/);
});
