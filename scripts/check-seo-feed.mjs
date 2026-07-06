import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { JSDOM } from "jsdom";
import { SITE, STATIC_PAGES } from "../src/config.mjs";

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REPORT = "docs/suggestions/evidence/current-seo-feed-report.json";
const FEED_SPECS = [
  { path: "index.xml", href: `${SITE.baseURL}/index.xml`, title: "CWLBlog RSS" },
  { path: "post/index.xml", href: `${SITE.baseURL}/post/index.xml`, title: "CWLBlog Posts RSS" },
  { path: "categories/index.xml", href: `${SITE.baseURL}/categories/index.xml`, title: "CWLBlog Time Archive RSS" },
];

function routeFromHtmlFile(file) {
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) return `/${file.slice(0, -"index.html".length)}`;
  return `/${file}`;
}

function absoluteUrl(href) {
  return new URL(href, `${SITE.baseURL}/`).href;
}

function textContent(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || "";
}

async function listCommittedHtmlFiles(root = ROOT) {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.html"], {
    cwd: root,
    maxBuffer: 1024 * 1024,
  });
  return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseXml(xml, file) {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const error = dom.window.document.querySelector("parsererror");
  if (error) {
    throw new Error(`${file} is not valid XML: ${error.textContent.trim()}`);
  }
  return dom.window.document;
}

function readJsonLd(document, file) {
  const blocks = [];
  const errors = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((script, index) => {
    try {
      const data = JSON.parse(script.textContent || "{}");
      const entries = Array.isArray(data) ? data : [data];
      entries.forEach((entry) => {
        blocks.push({
          type: entry["@type"] || null,
          context: entry["@context"] || null,
        });
      });
    } catch (error) {
      errors.push(`${file}: JSON-LD block ${index + 1} is invalid JSON`);
    }
  });
  return { blocks, errors };
}

async function inspectHtmlFile(root, file) {
  const html = await readFile(join(root, file), "utf8");
  const dom = new JSDOM(html, { url: SITE.baseURL });
  const { document } = dom.window;
  const route = routeFromHtmlFile(file);
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
  const canonicalExpected = `${SITE.baseURL}${route}`;
  const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
  const noindex = /\bnoindex\b/i.test(robots);
  const feedAlternates = Array.from(document.querySelectorAll('link[rel="alternate"][type="application/rss+xml"]'))
    .map((link) => ({
      href: absoluteUrl(link.getAttribute("href") || ""),
      title: link.getAttribute("title") || "",
    }));
  const jsonLd = readJsonLd(document, file);
  const og = {
    title: document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "",
    description: document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "",
    url: document.querySelector('meta[property="og:url"]')?.getAttribute("content") || "",
    image: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "",
    twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute("content") || "",
  };
  const expectedFeeds = noindex
    ? []
    : [
        `${SITE.baseURL}/index.xml`,
        ...(route === "/post/" ? [`${SITE.baseURL}/post/index.xml`] : []),
        ...(route === "/categories/" ? [`${SITE.baseURL}/categories/index.xml`] : []),
      ];

  const violations = [];
  if (!noindex) {
    if (canonical !== canonicalExpected) {
      violations.push(`${file}: canonical should be ${canonicalExpected}, got ${canonical || "(missing)"}`);
    }
    for (const [key, value] of Object.entries(og)) {
      if (!value) {
        violations.push(`${file}: missing ${key === "twitterCard" ? "twitter:card" : `og:${key}`}`);
      }
    }
    if (og.url && canonical && og.url !== canonical) {
      violations.push(`${file}: og:url should match canonical`);
    }
    if (jsonLd.blocks.length === 0) {
      violations.push(`${file}: missing JSON-LD`);
    }
    for (const href of expectedFeeds) {
      if (!feedAlternates.some((feed) => feed.href === href)) {
        violations.push(`${file}: missing RSS alternate ${href}`);
      }
    }
  }

  return {
    file,
    route,
    noindex,
    canonical,
    canonicalExpected,
    og,
    feedAlternates,
    expectedFeeds,
    jsonLdTypes: jsonLd.blocks.map((block) => block.type),
    violations: [...jsonLd.errors, ...violations],
  };
}

async function inspectSitemap(root, expectedPostPaths) {
  const xml = await readFile(join(root, "sitemap.xml"), "utf8");
  const document = parseXml(xml, "sitemap.xml");
  const urls = Array.from(document.getElementsByTagName("url")).map((url) => ({
    loc: textContent(url, "loc"),
    lastmod: textContent(url, "lastmod"),
    priority: textContent(url, "priority"),
  }));
  const locs = new Set(urls.map((url) => url.loc));
  const expectedLocs = [
    ...STATIC_PAGES.map((page) => `${SITE.baseURL}${page.path}`),
    ...expectedPostPaths.map((path) => `${SITE.baseURL}${path}`),
  ];
  const missingExpected = expectedLocs.filter((loc) => !locs.has(loc));
  const missingLastmod = STATIC_PAGES
    .filter((page) => page.withDate)
    .map((page) => `${SITE.baseURL}${page.path}`)
    .filter((loc) => {
      const entry = urls.find((url) => url.loc === loc);
      return !entry?.lastmod;
    });

  return {
    urlCount: urls.length,
    missingExpected,
    missingLastmod,
    imageUrlCount: document.getElementsByTagName("image:image").length,
  };
}

async function inspectFeed(root, spec, expectedItems) {
  const xml = await readFile(join(root, spec.path), "utf8");
  const document = parseXml(xml, spec.path);
  const channel = document.querySelector("channel");
  const atomSelf = Array.from(document.getElementsByTagName("atom:link"))
    .find((node) => node.getAttribute("rel") === "self");
  const itemCount = document.getElementsByTagName("item").length;
  const violations = [];

  if (!channel) {
    violations.push(`${spec.path}: missing channel`);
  }
  if (itemCount !== expectedItems) {
    violations.push(`${spec.path}: expected ${expectedItems} item(s), got ${itemCount}`);
  }
  if (atomSelf?.getAttribute("href") !== spec.href) {
    violations.push(`${spec.path}: atom self link should be ${spec.href}`);
  }
  if (atomSelf?.getAttribute("type") !== "application/rss+xml") {
    violations.push(`${spec.path}: atom self link should declare application/rss+xml`);
  }

  return {
    path: spec.path,
    title: textContent(channel || document, "title"),
    itemCount,
    bytes: Buffer.byteLength(xml),
    selfHref: atomSelf?.getAttribute("href") || "",
    violations,
  };
}

async function loadSearchIndex(root) {
  const index = JSON.parse(await readFile(join(root, "search-index.json"), "utf8"));
  return {
    posts: index.filter((item) => item.type === "post"),
    pages: index.filter((item) => item.type === "page"),
  };
}

async function createSeoFeedReport({ root = ROOT } = {}) {
  const searchIndex = await loadSearchIndex(root);
  const postPaths = searchIndex.posts.map((post) => post.path);
  const htmlFiles = await listCommittedHtmlFiles(root);
  const html = [];
  for (const file of htmlFiles) {
    html.push(await inspectHtmlFile(root, file));
  }
  const sitemap = await inspectSitemap(root, postPaths);
  const feeds = [];
  for (const spec of FEED_SPECS) {
    feeds.push(await inspectFeed(root, spec, searchIndex.posts.length));
  }
  const violations = [
    ...sitemap.missingExpected.map((loc) => `sitemap.xml: missing expected URL ${loc}`),
    ...sitemap.missingLastmod.map((loc) => `sitemap.xml: missing lastmod for ${loc}`),
    ...feeds.flatMap((feed) => feed.violations),
    ...html.flatMap((page) => page.violations),
  ];
  const indexablePages = html.filter((page) => !page.noindex);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      status: violations.length === 0 ? "pass" : "fail",
      htmlFiles: html.length,
      indexablePages: indexablePages.length,
      sitemapUrls: sitemap.urlCount,
      rssFeeds: feeds.length,
      rssItemsPerFeed: searchIndex.posts.length,
      feedAlternates: html.reduce((sum, page) => sum + page.feedAlternates.length, 0),
      jsonLdBlocks: html.reduce((sum, page) => sum + page.jsonLdTypes.length, 0),
      violations: violations.length,
    },
    sitemap,
    feeds,
    html,
    violations,
  };
}

function formatSeoFeedReport(report) {
  const lines = [
    `HTML pages: ${report.summary.htmlFiles}`,
    `Indexable pages: ${report.summary.indexablePages}`,
    `Sitemap URLs: ${report.summary.sitemapUrls}`,
    `RSS feeds: ${report.summary.rssFeeds}`,
    `RSS items per feed: ${report.summary.rssItemsPerFeed}`,
    `Feed alternates: ${report.summary.feedAlternates}`,
    `JSON-LD blocks: ${report.summary.jsonLdBlocks}`,
    `Violations: ${report.summary.violations}`,
  ];

  if (report.violations.length > 0) {
    return `${lines.join("\n")}\n\nViolations:\n${report.violations.sort().join("\n")}`;
  }
  return `${lines.join("\n")}\nSEO/feed check passed.`;
}

function outputPathFromArgs(argv) {
  const outIndex = argv.indexOf("--out");
  if (outIndex === -1) return null;
  const value = argv[outIndex + 1] || DEFAULT_REPORT;
  if (value.startsWith("--")) return DEFAULT_REPORT;
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const report = await createSeoFeedReport();
    const outputPath = outputPathFromArgs(process.argv.slice(2));
    if (outputPath) {
      const absoluteOutput = join(ROOT, outputPath);
      await mkdir(dirname(absoluteOutput), { recursive: true });
      await writeFile(absoluteOutput, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`Wrote ${outputPath}`);
    }
    console.log(formatSeoFeedReport(report));
    if (report.violations.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SEO/feed check failed: ${message}`);
    process.exitCode = 1;
  }
}

export {
  FEED_SPECS,
  createSeoFeedReport,
  formatSeoFeedReport,
  inspectHtmlFile,
  inspectSitemap,
  listCommittedHtmlFiles,
  routeFromHtmlFile,
};
