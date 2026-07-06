import { SITE } from "./config.mjs";

export const PWA_CACHE_STRATEGIES = Object.freeze({
  CACHE_FIRST: "cache-first",
  NETWORK_FIRST: "network-first",
  NETWORK_ONLY: "network-only",
  STALE_WHILE_REVALIDATE: "stale-while-revalidate",
});

export const PWA_CACHE_POLICY_MATRIX = Object.freeze([
  {
    category: "navigation",
    strategy: PWA_CACHE_STRATEGIES.NETWORK_FIRST,
    cacheable: true,
    examples: ["/", "/post/", "/tools/"],
  },
  {
    category: "static-asset",
    strategy: PWA_CACHE_STRATEGIES.CACHE_FIRST,
    cacheable: true,
    examples: ["/css/coder.css", "/js/coder.js", "/images/favicon.png"],
  },
  {
    category: "search-index",
    strategy: PWA_CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    cacheable: true,
    examples: ["/search-index.json"],
  },
  {
    category: "fresh-data",
    strategy: PWA_CACHE_STRATEGIES.NETWORK_ONLY,
    cacheable: false,
    examples: ["/data/relay-providers.json"],
  },
  {
    category: "sensitive-or-external",
    strategy: PWA_CACHE_STRATEGIES.NETWORK_ONLY,
    cacheable: false,
    examples: ["POST /feedback", "https://buttondown.com/", "/tools/?api_key=..."],
  },
]);

const STATIC_ASSET_RE = /\.(?:css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|webmanifest)$/i;
const HTML_RE = /\.html$/i;
const SENSITIVE_QUERY_RE = /(?:^|[?&])(?:access_token|api[_-]?key|auth|authorization|key|secret|signature|token)=/i;
const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
]);

function normalizeOrigin(origin) {
  return String(origin || SITE.baseURL).replace(/\/+$/, "");
}

function requestUrl(input) {
  if (typeof input === "string" || input instanceof URL) {
    return String(input);
  }
  return String(input?.url || "/");
}

function requestMethod(input) {
  if (typeof input === "string" || input instanceof URL) {
    return "GET";
  }
  return String(input?.method || "GET").toUpperCase();
}

function requestMode(input) {
  if (typeof input === "string" || input instanceof URL) {
    return "";
  }
  return String(input?.mode || "");
}

function normalizeHeaders(headers) {
  if (!headers) return [];
  if (typeof headers.forEach === "function") {
    const entries = [];
    headers.forEach((value, key) => entries.push([String(key).toLowerCase(), String(value)]));
    return entries;
  }
  if (Array.isArray(headers)) {
    return headers.map(([key, value]) => [String(key).toLowerCase(), String(value)]);
  }
  return Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), String(value)]);
}

function hasSensitiveHeader(headers) {
  return normalizeHeaders(headers).some(([key]) => SENSITIVE_HEADER_NAMES.has(key));
}

function policy(strategy, category, reason, cacheable = strategy !== PWA_CACHE_STRATEGIES.NETWORK_ONLY) {
  return { strategy, category, reason, cacheable };
}

export function classifyPwaRequest(input, options = {}) {
  const origin = normalizeOrigin(options.origin);
  const url = new URL(requestUrl(input), `${origin}/`);
  const method = requestMethod(input);
  const mode = requestMode(input);
  const headers = typeof input === "string" || input instanceof URL ? options.headers : input?.headers;

  if (method !== "GET") {
    return policy(PWA_CACHE_STRATEGIES.NETWORK_ONLY, "sensitive-or-external", "non-get request", false);
  }
  if (url.origin !== origin) {
    return policy(PWA_CACHE_STRATEGIES.NETWORK_ONLY, "sensitive-or-external", "external origin", false);
  }
  if (SENSITIVE_QUERY_RE.test(url.search)) {
    return policy(PWA_CACHE_STRATEGIES.NETWORK_ONLY, "sensitive-or-external", "sensitive query", false);
  }
  if (hasSensitiveHeader(headers)) {
    return policy(PWA_CACHE_STRATEGIES.NETWORK_ONLY, "sensitive-or-external", "sensitive header", false);
  }

  if (url.pathname === "/search-index.json") {
    return policy(PWA_CACHE_STRATEGIES.STALE_WHILE_REVALIDATE, "search-index", "search index");
  }
  if (url.pathname === "/data/relay-providers.json" || url.pathname.startsWith("/api/")) {
    return policy(PWA_CACHE_STRATEGIES.NETWORK_ONLY, "fresh-data", "fresh data", false);
  }
  if (mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/") || HTML_RE.test(url.pathname)) {
    return policy(PWA_CACHE_STRATEGIES.NETWORK_FIRST, "navigation", "navigation");
  }
  if (STATIC_ASSET_RE.test(url.pathname)) {
    return policy(PWA_CACHE_STRATEGIES.CACHE_FIRST, "static-asset", "static asset");
  }

  return policy(PWA_CACHE_STRATEGIES.NETWORK_ONLY, "sensitive-or-external", "unmatched request", false);
}
