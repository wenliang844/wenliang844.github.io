import { CORE_SCRIPTS } from "./templates/layout.mjs";
import { pageAssetUrls } from "./page-assets.mjs";

export const PWA_PRECACHE_CORE_ROUTES = Object.freeze([
  "/",
  "/offline.html",
]);

export const PWA_PRECACHE_CORE_ASSETS = Object.freeze([
  "/manifest.webmanifest",
  "/images/favicon.png",
  "/css/fontawesome-all.min.css",
  "/css/coder.css",
  "/css/assistant.css",
]);

export const PWA_PRECACHE_WEBFONTS = Object.freeze([
  "/webfonts/fa-brands-400.subset.woff2",
  "/webfonts/fa-solid-900.subset.woff2",
]);

export const PWA_PRECACHE_PAGE_ASSETS = Object.freeze(pageAssetUrls());

export const PWA_PRECACHE_URLS = Object.freeze([
  ...PWA_PRECACHE_CORE_ROUTES,
  ...PWA_PRECACHE_CORE_ASSETS,
  ...PWA_PRECACHE_WEBFONTS,
  ...PWA_PRECACHE_PAGE_ASSETS,
  ...CORE_SCRIPTS,
]);

export function uniquePwaPrecacheUrls(urls = PWA_PRECACHE_URLS) {
  return [...new Set(urls)];
}
