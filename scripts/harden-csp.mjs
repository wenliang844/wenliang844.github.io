import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_RE = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const CSP_RE = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/i;
const SKIPPED_DIRECTORIES = new Set([".git", ".astro", "node_modules", "pagefind", "playwright-report", "temp", "test-results"]);
const ASSISTANT_CONNECT_ORIGINS = [
  "https://muyuan.do",
  "https://token-plan-cn.xiaomimimo.com",
];

export function inlineScriptHashes(html) {
  const hashes = [];
  let match;
  SCRIPT_RE.lastIndex = 0;
  while ((match = SCRIPT_RE.exec(html))) {
    hashes.push(`'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`);
  }
  return [...new Set(hashes)];
}

export function hardenPolicy(policy, hashes, removedSources = [], options = {}) {
  const directives = policy.split(";").map((part) => part.trim()).filter(Boolean);
  const scriptIndex = directives.findIndex((directive) => directive.startsWith("script-src "));
  if (scriptIndex < 0) throw new Error("CSP is missing script-src");
  const sources = directives[scriptIndex].split(/\s+/).slice(1)
    .filter((source) => source !== "'unsafe-inline'"
      && !/^'sha256-[A-Za-z0-9+/=]+'$/.test(source)
      && !removedSources.includes(source));
  directives[scriptIndex] = `script-src ${[...new Set([...sources, ...(options.scriptSources || []), ...hashes])].join(" ")}`;
  const attributeDirective = "script-src-attr 'none'";
  const attributeIndex = directives.findIndex((directive) => directive.startsWith("script-src-attr "));
  if (attributeIndex >= 0) directives[attributeIndex] = attributeDirective;
  else directives.splice(scriptIndex + 1, 0, attributeDirective);

  const styleIndex = directives.findIndex((directive) => directive.startsWith("style-src "));
  if (styleIndex < 0) throw new Error("CSP is missing style-src");
  const styleSources = directives[styleIndex].split(/\s+/).slice(1)
    .filter((source) => (options.allowInlineStyles || source !== "'unsafe-inline'") && source !== "https://giscus.app");
  directives[styleIndex] = `style-src ${[...new Set(styleSources)].join(" ")}`;
  const styleAttributeDirective = options.allowInlineStyles
    ? "style-src-attr 'unsafe-inline'"
    : "style-src-attr 'none'";
  const styleAttributeIndex = directives.findIndex((directive) => directive.startsWith("style-src-attr "));
  if (styleAttributeIndex >= 0) directives[styleAttributeIndex] = styleAttributeDirective;
  else directives.splice(styleIndex + 1, 0, styleAttributeDirective);

  if (options.connectSources) {
    const connectDirective = `connect-src ${[...new Set(options.connectSources)].join(" ")}`;
    const connectIndex = directives.findIndex((directive) => directive.startsWith("connect-src "));
    if (connectIndex >= 0) directives[connectIndex] = connectDirective;
    else directives.push(connectDirective);
  }
  return directives.join("; ");
}

function metaContent(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(new RegExp(`<meta\\b[^>]*\\bname=["']${escapedName}["'][^>]*>`, "i"));
  if (!tag) return "";
  const content = tag[0].match(/\bcontent=["']([^"']*)["']/i);
  return content ? content[1].replace(/&amp;/g, "&") : "";
}

function configuredApiOrigin(html) {
  const value = metaContent(html, "cwl-api-base");
  if (!/^https?:\/\//i.test(value)) return "";
  try {
    const url = new URL(value);
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return url.protocol === "https:" || (local && url.protocol === "http:") ? url.origin : "";
  } catch {
    return "";
  }
}

export function connectSourcesForHtml(html) {
  const sources = ["'self'"];
  if (html.includes('src="/js/tools.js"')) {
    return [...sources, "https:"];
  }
  if (html.includes('src="/js/analytics.js"')) {
    sources.push("https://cloud.umami.is", "https://plausible.io");
  }
  if (html.includes('src="/js/subscribe.js"')) {
    sources.push("https://buttondown.com");
  }
  if (html.includes('src="/js/assistant.js"') || html.includes('src="/js/assistant-loader.js"')) {
    sources.push(...ASSISTANT_CONNECT_ORIGINS);
  }
  if (html.includes('src="/js/feedback.js"')) {
    sources.push("https://api.web3forms.com");
  }
  const apiOrigin = configuredApiOrigin(html);
  if (apiOrigin) sources.push(apiOrigin);
  return [...new Set(sources)];
}

export function hardenHtml(html, file = "HTML") {
  if (/<[^>]+\son[a-z]+\s*=/i.test(html)) {
    throw new Error(`${file} contains an inline event handler`);
  }
  if (/<[^>]+\sstyle\s*=/i.test(html)) {
    throw new Error(`${file} contains an inline style attribute`);
  }
  const match = html.match(CSP_RE);
  if (!match) return html;
  const removedSources = [];
  const usesGiscus = html.includes('src="/js/giscus.js"')
    || html.includes('src="/js/post-extras-loader.js"');
  if (!usesGiscus) removedSources.push("https://giscus.app");
  if (!html.includes('src="/js/tools.js"')) removedSources.push("https://cdn.jsdelivr.net");
  const usesPagefind = html.includes('src="/js/search-loader.js"');
  if (!html.includes('src="/js/tools.js"') && !usesPagefind) removedSources.push("'wasm-unsafe-eval'");
  const policy = hardenPolicy(match[1], inlineScriptHashes(html), removedSources, {
    allowInlineStyles: html.includes('src="/js/editor-codemirror.js"')
      || html.includes('src="https://minnit.chat/js/embed.js'),
    scriptSources: [
      ...(usesPagefind ? ["'wasm-unsafe-eval'"] : []),
      ...(usesGiscus ? ["https://giscus.app"] : []),
    ],
    connectSources: connectSourcesForHtml(html),
  });
  return html.replace(CSP_RE, `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
}

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

async function main() {
  const root = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), ".."));
  const files = await htmlFiles(root);
  let updated = 0;
  let protectedFiles = 0;
  for (const file of files) {
    const html = await readFile(file, "utf8");
    if (!CSP_RE.test(html)) continue;
    protectedFiles += 1;
    const hardened = hardenHtml(html, file);
    if (hardened !== html) {
      await writeFile(file, hardened, "utf8");
      updated += 1;
    }
  }
  console.log(`CSP hardened: ${protectedFiles} HTML files checked, ${updated} updated.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
