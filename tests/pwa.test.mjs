import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import vm from "node:vm";

const ROOT = join(import.meta.dirname, "..");

test("web app manifest is installable and uses local icons", async () => {
  const manifest = JSON.parse(await readFile(join(ROOT, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.start_url, "/post/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
  assert.ok(manifest.icons.every((icon) => icon.src.startsWith("/images/")));
});

test("service worker caches only public content and static assets", async () => {
  const source = await readFile(join(ROOT, "service-worker.js"), "utf8");
  assert.match(source, /PRIVATE_PREFIXES = \["\/editor\/", "\/overleaf\/", "\/chat\/", "\/api\/"\]/);
  assert.match(source, /request\.method !== "GET"/);
  assert.match(source, /url\.origin !== self\.location\.origin/);
  assert.match(source, /isPrivateRequest\(request, url\)/);
  assert.match(source, /request\.referrer/);
  assert.match(source, /request\.mode === "navigate" && hasPrefix\(url\.pathname, CONTENT_PREFIXES\)/);
  assert.match(source, /hasPrefix\(url\.pathname, STATIC_PREFIXES\)/);
  const precache = source.match(/const PRECACHE = \[[\s\S]*?\];/)?.[0] || "";
  assert.doesNotMatch(precache, /\/editor\/|\/overleaf\/|\/chat\/|\/api\//);
  assert.doesNotMatch(source, /localStorage|indexedDB/);
  assert.match(source, /CACHE_NAME = `\$\{CACHE_PREFIX\}[a-f0-9]{16}`/);
});

test("service worker bypasses static assets requested by private authoring pages", async () => {
  const source = await readFile(join(ROOT, "service-worker.js"), "utf8");
  const listeners = new Map();
  const context = vm.createContext({
    URL,
    Response,
    fetch: async () => new Response("ok"),
    caches: {
      open: async () => ({ match: async () => null, put: async () => undefined }),
      keys: async () => [],
      delete: async () => true,
    },
    self: {
      location: { origin: "https://wenliang844.github.io" },
      clients: { claim: async () => undefined },
      skipWaiting() {},
      addEventListener(type, listener) { listeners.set(type, listener); },
    },
  });
  vm.runInContext(source, context);

  const fetchListener = listeners.get("fetch");
  assert.equal(typeof fetchListener, "function");

  let privateHandled = false;
  fetchListener({
    request: {
      method: "GET",
      mode: "no-cors",
      url: "https://wenliang844.github.io/js/editor-codemirror.js",
      referrer: "https://wenliang844.github.io/editor/",
    },
    respondWith() { privateHandled = true; },
  });
  assert.equal(privateHandled, false, "editor subresources must bypass the shared public cache");

  let publicHandled = false;
  fetchListener({
    request: {
      method: "GET",
      mode: "no-cors",
      url: "https://wenliang844.github.io/js/coder.js",
      referrer: "https://wenliang844.github.io/post/example/",
    },
    respondWith() { publicHandled = true; },
  });
  assert.equal(publicHandled, true, "public static assets should use the shared cache");
});

test("PWA registration skips authoring routes", async () => {
  const source = await readFile(join(ROOT, "js", "pwa.js"), "utf8");
  assert.match(source, /\["\/editor\/", "\/overleaf\/", "\/chat\/", "\/api\/"\]/);
  assert.match(source, /navigator\.serviceWorker\.register\("\/service-worker\.js", \{ scope: "\/" \}\)/);
});

test("public entry points expose the manifest while authoring pages do not register", async () => {
  for (const path of ["index.html", join("about", "index.html"), join("contact", "index.html")]) {
    const html = await readFile(join(ROOT, path), "utf8");
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/);
    assert.match(html, /<script src="\/js\/pwa\.js" defer><\/script>/);
  }
  for (const path of [join("editor", "index.html"), join("overleaf", "index.html")]) {
    const html = await readFile(join(ROOT, path), "utf8");
    assert.doesNotMatch(html, /\/js\/pwa\.js/);
  }
  const offline = await readFile(join(ROOT, "offline.html"), "utf8");
  assert.match(offline, /http-equiv="Content-Security-Policy"/);
  assert.match(offline, /<meta name="description"/);
  assert.match(offline, /class="skip-link" href="#main-content"/);
  assert.match(offline, /<main id="main-content"/);
  assert.doesNotMatch(offline, /<script\b|rel="(?:preconnect|dns-prefetch)"/);
});
