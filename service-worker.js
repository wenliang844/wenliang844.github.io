"use strict";

const CACHE_PREFIX = "cwlblog-public-";
const CACHE_NAME = `${CACHE_PREFIX}ea8def23bbce5256`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/post/",
  "/knowledge/",
  "/css/coder.css",
  "/css/content.css",
  "/images/favicon.png",
];
const PRIVATE_PREFIXES = ["/editor/", "/overleaf/", "/api/"];
const CONTENT_PREFIXES = ["/post/", "/categories/", "/series/", "/tags/", "/knowledge/"];
const STATIC_PREFIXES = ["/css/", "/js/", "/images/", "/fonts/", "/pagefind/"];

function hasPrefix(pathname, prefixes) {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

function isPrivateRequest(request, url) {
  if (hasPrefix(url.pathname, PRIVATE_PREFIXES)) return true;
  if (!request.referrer) return false;

  try {
    const referrer = new URL(request.referrer);
    return referrer.origin === self.location.origin && hasPrefix(referrer.pathname, PRIVATE_PREFIXES);
  } catch {
    return false;
  }
}

function isCacheableResponse(response) {
  return response && response.ok && response.type === "basic";
}

async function put(cache, request, response) {
  if (isCacheableResponse(response)) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    return await put(cache, request, await fetch(request));
  } catch {
    return (await cache.match(request)) || (await cache.match(OFFLINE_URL));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => put(cache, request, response))
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivateRequest(request, url)) return;

  if (request.mode === "navigate" && hasPrefix(url.pathname, CONTENT_PREFIXES)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (hasPrefix(url.pathname, STATIC_PREFIXES)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
