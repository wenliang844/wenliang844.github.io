// CWLBlog 静态站点构建脚本。
//
// 输入：src/posts/*.md（front matter + Markdown 正文）
// 输出：post/<slug>/index.html、post/index.html、sitemap.xml、index.xml
//
// 用法：
//   node scripts/build.mjs            # 输出到项目根（覆盖现有产物）
//   node scripts/build.mjs --out dist # 输出到 dist/（用于对齐验证）

import { cp, readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { parse as parseYaml } from "yaml";

import { SITE, STATIC_PAGES, SEARCH_PAGES } from "../src/config.mjs";
import { renderPostPage, renderPostList } from "../src/templates/post.mjs";
import { renderTagsPage } from "../src/templates/tags.mjs";
import { renderCategoriesPage } from "../src/templates/categories.mjs";
import { renderAiPage } from "../src/templates/ai.mjs";
import { renderToolsPage } from "../src/templates/tools.mjs";
import { renderAppreciationPage } from "../src/templates/appreciation.mjs";
import { renderSponsorPage } from "../src/templates/sponsor.mjs";
import { renderTrustPage } from "../src/templates/trust.mjs";
import { escapeXml, rfc822, sitemapDate } from "../src/lib/format.mjs";
import { readingMinutes } from "../src/lib/reading.mjs";
import { renderServiceWorker } from "../src/service-worker-template.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const POSTS_DIR = join(ROOT, "src", "posts");
const POST_SITEMAP_PRIORITY = "0.8";
const SEARCH_BODY_LIMIT = 3200;
const SEARCH_SECTION_BODY_LIMIT = 560;
const SEARCH_PAGE_SECTION_BODY_LIMIT = 72;
const SEARCH_MAX_SECTIONS_PER_POST = 24;
const SEARCH_SECTION_MIN_TEXT = 20;
const POST_STATUS_VALUES = new Set(["maintained", "historical", "archived"]);

// 输出目录：--out <dir>，默认项目根。
const outIdx = process.argv.indexOf("--out");
const OUT_DIR = resolveOutDir(outIdx);
const STATIC_DEPLOY_ASSETS = [
  "css",
  "data",
  "images",
  "js",
  "webfonts",
  "about",
  "contact",
  "editor",
  "overleaf",
  "404.html",
  "index.html",
  "manifest.webmanifest",
  "offline.html",
];

marked.setOptions({ gfm: true, breaks: false });

// YAML 会把不带引号的 date 解析为 Date 对象；统一规范成 "YYYY-MM-DD" 字符串。
export function normalizeDate(d) {
  if (d instanceof Date) {
    if (Number.isNaN(d.getTime())) {
      throw new Error("Invalid date value.");
    }
    return d.toISOString().slice(0, 10);
  }
  const dateStr = String(d);
  // 验证日期格式 YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [year, month, day] = dateStr.split("-").map((value) => Number.parseInt(value, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date value: "${dateStr}".`);
  }
  return dateStr;
}

export function normalizeModifiedDate(modified, date, filename = "post") {
  const published = normalizeDate(date);
  if (!modified) {
    return published;
  }
  const normalized = normalizeDate(modified);
  if (normalized < published) {
    throw new Error(`Invalid modified date in ${filename}: "${normalized}" is before published date "${published}".`);
  }
  return normalized;
}

export function normalizeReviewedDate(reviewed, date, filename = "post") {
  if (!reviewed) {
    return "";
  }
  const published = normalizeDate(date);
  const normalized = normalizeDate(reviewed);
  if (normalized < published) {
    throw new Error(`Invalid reviewed date in ${filename}: "${normalized}" is before published date "${published}".`);
  }
  return normalized;
}

export function normalizePostStatus(status, filename = "post") {
  if (!status) {
    return "";
  }
  if (typeof status !== "string" || !POST_STATUS_VALUES.has(status)) {
    throw new Error(`Invalid status in ${filename}: expected one of ${[...POST_STATUS_VALUES].join(", ")}.`);
  }
  return status;
}

export function normalizeCover(cover, filename = "post") {
  if (!cover) {
    return null;
  }
  if (typeof cover !== "string") {
    throw new Error(`Invalid cover in ${filename}: cover must be a string.`);
  }
  if (cover.length > 300) {
    throw new Error(`Invalid cover in ${filename}: cover path is too long (max 300 characters).`);
  }
  if (!/^(\/images\/|https?:\/\/)/i.test(cover)) {
    throw new Error(`Invalid cover in ${filename}: cover must start with /images/ or http(s)://.`);
  }
  return cover;
}

// 验证 slug 是否合法（仅包含字母、数字、连字符、下划线）
export function validateSlug(slug, filename) {
  if (!slug || typeof slug !== "string") {
    throw new Error(`Invalid slug in ${filename}: slug is required and must be a string.`);
  }
  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    throw new Error(`Invalid slug in ${filename}: "${slug}". Only letters, numbers, hyphens, and underscores are allowed.`);
  }
  if (slug.length > 100) {
    throw new Error(`Invalid slug in ${filename}: "${slug}" is too long (max 100 characters).`);
  }
}

// 防止多个 Markdown 文件生成到同一个 URL，避免后写文章静默覆盖先写文章。
export function validateUniqueSlug(slug, filename, seenSlugs) {
  const existing = seenSlugs.get(slug);
  if (existing) {
    throw new Error(`Duplicate slug in ${filename}: "${slug}" already used by ${existing}.`);
  }
  seenSlugs.set(slug, filename);
}

// 验证文章必填字段
export function validatePost(data, filename) {
  const required = ["title", "shortTitle", "date", "summary", "description"];
  const missing = required.filter((field) => !data[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields in ${filename}: ${missing.join(", ")}`);
  }

  // 验证字段长度
  if (data.title.length > 200) {
    throw new Error(`Title too long in ${filename} (max 200 characters).`);
  }
  if (data.shortTitle.length > 100) {
    throw new Error(`Short title too long in ${filename} (max 100 characters).`);
  }
  if (data.description.length > 500) {
    throw new Error(`Description too long in ${filename} (max 500 characters).`);
  }
}

function resolveOutDir(index) {
  if (index === -1) {
    return ROOT;
  }

  const outArg = process.argv[index + 1];
  if (!outArg || outArg.startsWith("--")) {
    throw new Error("缺少 --out <dir> 参数。");
  }

  const outDir = resolve(ROOT, outArg);
  const rel = relative(ROOT, outDir);
  if (rel && (rel.startsWith("..") || isAbsolute(rel))) {
    throw new Error(`--out 只能指向项目内目录：${outArg}`);
  }
  return outDir;
}

function parseFrontMatter(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error(`${file}: Missing front matter block.`);
  }
  const data = parseYaml(match[1]) || {};
  const content = raw.slice(match[0].length);
  return { data, content };
}

// marked 在内联 HTML 块后会多输出空行；压缩块间空行让产物更干净。
// 先用 \x00（不会出现在正文）包裹占位序号抽出空白敏感 HTML 块，
// 避免压掉代码、折叠面板、表格等块内部的空行，压缩后再还原。
export function tidyHtml(html) {
  const blocks = [];
  let s = html.replace(/<(pre|div|details|table|script|style|textarea)\b[\s\S]*?<\/\1>/gi, (m) => {
    blocks.push(m);
    return "\x00" + (blocks.length - 1) + "\x00";
  });
  s = s.replace(/\n{2,}/g, "\n");
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => blocks[Number(i)]);
  return s.trim();
}

export function addImageLoadingHints(html) {
  const blocks = [];
  let s = html.replace(/<(pre|script|style|textarea)\b[\s\S]*?<\/\1>/gi, (m) => {
    blocks.push(m);
    return "\x00" + (blocks.length - 1) + "\x00";
  });

  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const additions = [];
    if (!/\sloading\s*=/i.test(tag)) {
      additions.push('loading="lazy"');
    }
    if (!/\sdecoding\s*=/i.test(tag)) {
      additions.push('decoding="async"');
    }
    if (!additions.length) {
      return tag;
    }

    const body = tag.replace(/\s*\/?>$/, "").trimEnd();
    const closing = /\/\s*>$/.test(tag) ? " />" : ">";
    return `${body} ${additions.join(" ")}${closing}`;
  });

  return s.replace(/\x00(\d+)\x00/g, (_, i) => blocks[Number(i)]);
}

function headingSlug(text) {
  return text.replace(/[^\w一-龥]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 50) || "section";
}

function uniqueHeadingId(base, seen) {
  let id = base;
  let index = 2;
  while (seen.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  seen.add(id);
  return id;
}

function createHeadingId(level, text, state) {
  const section = level === 2 ? ++state.h2Index : state.h2Index;
  return uniqueHeadingId(`toc-${section}-${headingSlug(text)}`, state.seen);
}

function renderHeadings(html) {
  const toc = [];
  const state = { h2Index: 0, seen: new Set() };
  const htmlWithIds = html.replace(/<(h[2-3])>(.*?)<\/\1>/gs, (match, tag, content) => {
    const level = parseInt(tag[1]);
    const text = content.replace(/<[^>]+>/g, "");
    const id = createHeadingId(level, text, state);
    toc.push({ level, text, id });
    return `<${tag} id="${id}">${content}</${tag}>`;
  });

  return { html: htmlWithIds, toc };
}

// 从 HTML 中提取标题生成目录数据
function extractToc(html) {
  return renderHeadings(html).toc;
}

// 把正文 Markdown 渲染为 HTML，为标题添加 id，并缩进对齐到 article-content 内部（10 空格）。
export function renderContent(markdown) {
  const html = addImageLoadingHints(tidyHtml(marked.parse(markdown)));
  const rendered = renderHeadings(html);

  const indented = rendered.html
    .split("\n")
    .map((line) => (line ? "          " + line : line))
    .join("\n");

  return { html: indented, toc: rendered.toc };
}

// 读取并解析所有文章，按日期倒序（最新在前）。
async function loadPosts() {
  const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith(".md"));
  const posts = [];
  const errors = [];
  const seenSlugs = new Map();

  for (const file of files) {
    try {
      const raw = await readFile(join(POSTS_DIR, file), "utf8");

      // 检查文件是否为空
      if (!raw.trim()) {
        errors.push(`${file}: File is empty`);
        continue;
      }

      const { data, content } = parseFrontMatter(raw, file);

      // 验证必填字段
      validatePost(data, file);

      const slug = data.slug || file.replace(/\.md$/, "");
      validateSlug(slug, file);
      validateUniqueSlug(slug, file, seenSlugs);

      // 检查内容是否为空
      if (!content.trim()) {
        console.warn(`Warning: ${file} has no content body`);
      }

      const contentResult = renderContent(content);
      const contentEnResult = data.contentEn ? renderContent(data.contentEn) : null;

      const date = normalizeDate(data.date);
      const modified = normalizeModifiedDate(data.modified, date, file);
      const reviewed = normalizeReviewedDate(data.reviewed, date, file);
      const status = normalizePostStatus(data.status, file);
      const cover = normalizeCover(data.cover, file);
      const contentImages = extractImages(contentResult.html);
      const images = cover
        ? [cover, ...contentImages.filter((src) => src !== cover)]
        : contentImages;

      posts.push({
        title: data.title,
        titleEn: data.titleEn,
        shortTitle: data.shortTitle,
        shortTitleEn: data.shortTitleEn,
        slug,
        date,
        modified,
        majorUpdate: data.majorUpdate === true,
        status,
        reviewed,
        contextNote: typeof data.contextNote === "string" ? data.contextNote : "",
        contextNoteEn: typeof data.contextNoteEn === "string" ? data.contextNoteEn : "",
        cover,
        eyebrow: data.eyebrow || "项目",
        summary: data.summary,
        summaryEn: data.summaryEn,
        description: data.description,
        descriptionEn: data.descriptionEn,
        tags: Array.isArray(data.tags) ? data.tags : [],
        tagsEn: Array.isArray(data.tagsEn) ? data.tagsEn : (Array.isArray(data.tags) ? data.tags : []),
        series: typeof data.series === "string" ? data.series : "",
        seriesEn: typeof data.seriesEn === "string" ? data.seriesEn : "",
        domains: Array.isArray(data.domains) ? data.domains : [],
        domainsEn: Array.isArray(data.domainsEn) ? data.domainsEn : [],
        stack: Array.isArray(data.stack) ? data.stack : [],
        stackEn: Array.isArray(data.stackEn) ? data.stackEn : [],
        contentHtml: contentResult.html,
        contentHtmlEn: contentEnResult ? contentEnResult.html : "",
        toc: contentResult.toc,
        tocEn: contentEnResult ? contentEnResult.toc : [],
        readMinutes: readingMinutes(stripHtml(contentResult.html)),
        images,
      });
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    console.error("\n❌ Errors found in the following files:");
    errors.forEach((err) => console.error(`  - ${err}`));
    throw new Error(`Failed to load ${errors.length} post(s). Please fix the errors above.`);
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return posts;
}

async function writeFileEnsured(relPath, content) {
  const full = join(OUT_DIR, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
  return full;
}

async function copyStaticDeployAssets() {
  if (OUT_DIR === ROOT) {
    return;
  }

  for (const asset of STATIC_DEPLOY_ASSETS) {
    await cp(join(ROOT, asset), join(OUT_DIR, asset), {
      recursive: true,
      force: true,
    });
  }
}

// 去掉 HTML 标签，保留纯文本，供搜索索引全文检索。
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export { readingMinutes };

function decodeHtmlEntities(text) {
  const entities = {
    amp: "&",
    gt: ">",
    lt: "<",
    quot: '"',
    "#39": "'",
  };
  return String(text || "").replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (key.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    }
    if (key.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    }
    return entities[key] || match;
  });
}

function plainHeadingText(html) {
  return decodeHtmlEntities(stripHtml(html));
}

export function extractSearchSections(html, limit = SEARCH_MAX_SECTIONS_PER_POST) {
  const headings = [...String(html || "").matchAll(/<h([2-3])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => ({
      level: Number.parseInt(match[1], 10),
      id: match[2],
      title: plainHeadingText(match[3]),
      start: match.index,
      end: match.index + match[0].length,
    }));

  return headings
    .map((heading, index) => {
      const next = headings[index + 1];
      const sectionHtml = String(html || "").slice(heading.end, next ? next.start : undefined);
      const text = stripHtml(sectionHtml);
      const body = `${heading.title} ${text}`.replace(/\s+/g, " ").trim();
      return {
        level: heading.level,
        id: heading.id,
        title: heading.title,
        body: body.slice(0, SEARCH_SECTION_BODY_LIMIT),
        textLength: body.length,
      };
    })
    .filter((section) => section.title && section.textLength >= SEARCH_SECTION_MIN_TEXT)
    .slice(0, limit);
}

// 把文章内图片 src 解析为绝对 URL：协议开头原样返回，
// 根相对（/ 开头）拼 baseURL，其余按文章目录 /post/<slug>/ 解析。
function absoluteUrl(src, slug) {
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return `${SITE.baseURL}${src}`;
  return `${SITE.baseURL}/post/${slug}/${src.replace(/^\.?\//, "")}`;
}

// 从渲染后的正文 HTML 中提取图片 src（用于 image sitemap）。
function extractImages(html) {
  const urls = [];
  const regex = /<img[^>]*\ssrc="([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function cleanFeature(value) {
  return String(value || "").trim();
}

function featureList(values) {
  return (Array.isArray(values) ? values : [values])
    .map(cleanFeature)
    .filter(Boolean);
}

function overlapValues(left, right) {
  const rightSet = new Set(featureList(right).map((value) => value.toLowerCase()));
  const seen = new Set();
  return featureList(left).filter((value) => {
    const key = value.toLowerCase();
    if (!rightSet.has(key) || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function firstOverlap(left, right) {
  return overlapValues(left, right)[0] || "";
}

function joinReasonValues(values, max = 2, separator = "、") {
  return values.slice(0, max).join(separator);
}

function relatedFeatures(post) {
  return {
    tags: featureList(post.tags),
    tagsEn: featureList(post.tagsEn),
    series: featureList(post.series),
    seriesEn: featureList(post.seriesEn),
    domains: featureList(post.domains),
    domainsEn: featureList(post.domainsEn),
    stack: featureList(post.stack),
    stackEn: featureList(post.stackEn),
    eyebrow: featureList(post.eyebrow),
  };
}

function relatedReason(current, candidate, matches) {
  if (matches.tags.length) {
    return {
      reason: `共同标签：${joinReasonValues(matches.tags)}`,
      reasonEn: `Shared tags: ${joinReasonValues(matches.tagsEn.length ? matches.tagsEn : matches.tags, 2, ", ")}`,
    };
  }
  if (matches.series) {
    return {
      reason: `同属系列：${matches.series}`,
      reasonEn: `Same series: ${matches.seriesEn || matches.series}`,
    };
  }
  if (matches.domains.length) {
    return {
      reason: `共同领域：${joinReasonValues(matches.domains)}`,
      reasonEn: `Shared domain: ${joinReasonValues(matches.domainsEn.length ? matches.domainsEn : matches.domains, 2, ", ")}`,
    };
  }
  if (matches.stack.length) {
    return {
      reason: `共同技术栈：${joinReasonValues(matches.stack)}`,
      reasonEn: `Shared stack: ${joinReasonValues(matches.stackEn.length ? matches.stackEn : matches.stack, 2, ", ")}`,
    };
  }
  if (matches.eyebrow) {
    return {
      reason: `同属主题：${matches.eyebrow}`,
      reasonEn: `Same topic: ${candidate.eyebrowEn || current.eyebrowEn || matches.eyebrow}`,
    };
  }
  if (matches.tagsEn.length) {
    return {
      reason: `共同英文标签：${joinReasonValues(matches.tagsEn)}`,
      reasonEn: `Shared tags: ${joinReasonValues(matches.tagsEn, 2, ", ")}`,
    };
  }
  return { reason: "主题相关", reasonEn: "Related topic" };
}

function relatedScore(current, candidate) {
  const currentFeatures = relatedFeatures(current);
  const candidateFeatures = relatedFeatures(candidate);
  const matches = {
    tags: overlapValues(currentFeatures.tags, candidateFeatures.tags),
    tagsEn: overlapValues(currentFeatures.tagsEn, candidateFeatures.tagsEn),
    series: firstOverlap(currentFeatures.series, candidateFeatures.series),
    seriesEn: firstOverlap(currentFeatures.seriesEn, candidateFeatures.seriesEn),
    domains: overlapValues(currentFeatures.domains, candidateFeatures.domains),
    domainsEn: overlapValues(currentFeatures.domainsEn, candidateFeatures.domainsEn),
    stack: overlapValues(currentFeatures.stack, candidateFeatures.stack),
    stackEn: overlapValues(currentFeatures.stackEn, candidateFeatures.stackEn),
    eyebrow: firstOverlap(currentFeatures.eyebrow, candidateFeatures.eyebrow),
  };
  const score =
    matches.tags.length * 4 +
    matches.tagsEn.length * 3 +
    (matches.series ? 6 : 0) +
    matches.domains.length * 3 +
    matches.stack.length * 2 +
    (matches.eyebrow ? 2 : 0);
  return {
    score,
    matches,
    ...relatedReason(current, candidate, matches),
  };
}

// 基于标签、系列、领域、技术栈和主题信号挑选相关文章：
// 先按综合分降序，同分按日期更新优先；取前 limit 篇。
export function relatedPosts(post, posts, limit = 3) {
  return posts
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ post: p, related: relatedScore(post, p) }))
    .filter((entry) => entry.related.score > 0)
    .sort((a, b) => {
      if (b.related.score !== a.related.score) {
        return b.related.score - a.related.score;
      }
      return String(a.post.date || "") < String(b.post.date || "") ? 1 : -1;
    })
    .slice(0, limit)
    .map((entry) => ({
      ...entry.post,
      relatedScore: entry.related.score,
      relatedReason: entry.related.reason,
      relatedReasonEn: entry.related.reasonEn,
    }));
}

function localizedPost(post) {
  const bodyHtml = post.contentHtmlEn || post.contentHtml;
  return {
    title: post.titleEn || post.title,
    shortTitle: post.shortTitleEn || post.shortTitle,
    summary: post.summaryEn || post.summary,
    tags: post.tagsEn || post.tags,
    body: stripHtml(bodyHtml).slice(0, SEARCH_BODY_LIMIT),
  };
}

function localizedSection(post, section, index) {
  const fallback = {
    sectionTitle: section.title,
    path: `/post/${post.slug}/#${section.id}`,
    body: section.body,
  };
  const enSections = post.contentHtmlEn ? extractSearchSections(post.contentHtmlEn) : [];
  const enSection = enSections[index];
  if (!enSection) {
    return fallback;
  }
  return {
    sectionTitle: enSection.title,
    path: `/post/${post.slug}/#${enSection.id}`,
    body: enSection.body,
  };
}

function buildPostSearchEntry(post) {
  const modified = post.modified || post.date;
  return {
    type: "post",
    title: post.title,
    shortTitle: post.shortTitle,
    summary: post.summary,
    date: post.date,
    modified,
    freshness: modified !== post.date ? "updated" : "published",
    tags: post.tags,
    path: `/post/${post.slug}/`,
    slug: post.slug,
    body: stripHtml(post.contentHtml).slice(0, SEARCH_BODY_LIMIT),
    i18n: {
      en: localizedPost(post),
    },
  };
}

function buildPostSectionSearchEntries(post) {
  const modified = post.modified || post.date;
  return extractSearchSections(post.contentHtml).map((section, index) => ({
    type: "post-section",
    title: post.title,
    shortTitle: post.shortTitle,
    sectionTitle: section.title,
    summary: `${post.shortTitle} / ${section.title}`,
    date: post.date,
    modified,
    freshness: modified !== post.date ? "updated" : "published",
    tags: post.tags,
    path: `/post/${post.slug}/#${section.id}`,
    slug: post.slug,
    sectionId: section.id,
    body: section.body,
    i18n: {
      en: {
        title: post.titleEn || post.title,
        shortTitle: post.shortTitleEn || post.shortTitle,
        summary: post.summaryEn || post.summary,
        tags: post.tagsEn || post.tags,
        ...localizedSection(post, section, index),
      },
    },
  }));
}

function buildPageSearchEntry(page) {
  const { searchSections, ...entry } = page;
  return { type: "page", ...entry };
}

function buildPageSectionSearchEntries(page) {
  return (page.searchSections || []).map((section) => {
    const tags = section.tags || page.tags || [];
    const enPage = page.i18n && page.i18n.en ? page.i18n.en : {};
    const enSection = section.i18n && section.i18n.en ? section.i18n.en : {};
    const body = (section.body || section.summary || "").slice(0, SEARCH_PAGE_SECTION_BODY_LIMIT);
    return {
      type: "page-section",
      title: page.title,
      sectionTitle: section.title,
      summary: section.summary || section.title,
      tags,
      path: section.path || page.path,
      body,
      i18n: {
        en: {
          title: enPage.title || page.title,
          sectionTitle: enSection.title || section.title,
          summary: enSection.summary || enSection.title || section.summary || section.title,
          tags: enSection.tags || enPage.tags || tags,
          path: enSection.path || section.path || page.path,
        },
      },
    };
  });
}

// 生成搜索索引 JSON（文章 + 静态页），供全局模糊搜索使用。
function buildSearchIndex(posts) {
  const postEntries = posts.flatMap((post) => [
    buildPostSearchEntry(post),
    ...buildPostSectionSearchEntries(post),
  ]);
  const pageEntries = SEARCH_PAGES.flatMap((page) => [
    buildPageSearchEntry(page),
    ...buildPageSectionSearchEntries(page),
  ]);

  return JSON.stringify(
    postEntries.concat(pageEntries),
    null,
    0,
  );
}

// sitemap.xml：静态页 + 文章页（插入到 /post/ 之后），对齐现有顺序。
export function buildSitemap(posts) {
  const siteLastmod = sitemapDate(posts[0].date);
  const rows = [];

  for (const page of STATIC_PAGES) {
    const loc = escapeXml(`${SITE.baseURL}${page.path}`);
    let row = `  <url><loc>${loc}</loc>`;
    if (page.withDate) row += `<lastmod>${siteLastmod}</lastmod>`;
    if (page.priority !== undefined) row += `<priority>${page.priority}</priority>`;
    row += `</url>`;
    rows.push(row);

    if (page.insertPostsAfter) {
      for (const post of posts) {
        const loc = escapeXml(`${SITE.baseURL}/post/${post.slug}/`);
        const images = post.images
          .map((src) => `<image:image><image:loc>${escapeXml(absoluteUrl(src, post.slug))}</image:loc></image:image>`)
          .join("");
        rows.push(
          `  <url><loc>${loc}</loc><lastmod>${sitemapDate(post.modified || post.date)}</lastmod><priority>${POST_SITEMAP_PRIORITY}</priority>${images}</url>`,
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${rows.join("\n")}
</urlset>`;
}

function buildRobots() {
  return `User-agent: *
Allow: /

# 优先抓取
Allow: /post/
Allow: /tags/
Allow: /categories/
Allow: /ai/
Allow: /trust/

# 公开渲染资源
Allow: /js/
Allow: /css/
Allow: /webfonts/

# Sitemap
Sitemap: ${SITE.baseURL}/sitemap.xml`;
}

// 统计所有文章的标签及出现次数，按文章数降序、同数按名称升序排列。
function collectTags(posts) {
  const counts = new Map();
  const namesEn = new Map();
  for (const post of posts) {
    for (const [index, tag] of post.tags.entries()) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
      if (!namesEn.has(tag)) {
        namesEn.set(tag, (post.tagsEn && post.tagsEn[index]) || tag);
      }
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, tagEn: namesEn.get(tag) || tag, count }))
    .sort((a, b) =>
      b.count - a.count || a.tag.localeCompare(b.tag, "zh-Hans-CN"),
    );
}

// index.xml：RSS 2.0，对齐现有结构。
export function buildRssItems(posts) {
  return posts
    .map((post) => {
      const url = `${SITE.baseURL}/post/${post.slug}/`;
      const feedDate = post.majorUpdate && post.modified ? post.modified : post.date;
      return `    <item>
      <title>${escapeXml(post.shortTitle)}</title>
      <link>${escapeXml(url)}</link>
      <pubDate>${rfc822(feedDate)}</pubDate>
      <guid>${escapeXml(url)}</guid>
      <description>${escapeXml(post.description)}</description>
    </item>`;
    })
    .join("\n");
}

function buildStats(posts) {
  const years = [...new Set(posts.map((post) => post.date.slice(0, 4)))];
  const startYear = years[years.length - 1];
  const endYear = years[0];
  return {
    count: posts.length,
    systems: SITE.systems,
    startYear,
    endYear,
    yearCount: years.length,
    range: startYear === endYear ? endYear : `${startYear}-${endYear}`,
  };
}

function buildRssFeed(posts, { title, link, description, selfHref }) {
  const lastBuild = rfc822(posts[0].date);
  const items = buildRssItems(posts);

  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <generator>Cwl static build</generator>
    <language>zh-CN</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${escapeXml(selfHref)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

function buildRss(posts) {
  return buildRssFeed(posts, {
    title: SITE.title,
    link: `${SITE.baseURL}/`,
    description: `Recent content on ${SITE.title}`,
    selfHref: `${SITE.baseURL}/index.xml`,
  });
}

// post/index.xml：博客目录 RSS，保持 /post/ 下的订阅入口同步。
function buildPostRss(posts) {
  return buildRssFeed(posts, {
    title: `Posts on ${SITE.title}`,
    link: `${SITE.baseURL}/post/`,
    description: `Recent content in Posts on ${SITE.title}`,
    selfHref: `${SITE.baseURL}/post/index.xml`,
  });
}

// categories/index.xml：时间归档页 RSS，避免分类页订阅入口停留在旧占位内容。
function buildCategoriesRss(posts) {
  return buildRssFeed(posts, {
    title: `Time Archive on ${SITE.title}`,
    link: `${SITE.baseURL}/categories/`,
    description: `Project retrospectives by year on ${SITE.title}`,
    selfHref: `${SITE.baseURL}/categories/index.xml`,
  });
}

async function main() {
  const posts = await loadPosts();
  if (posts.length === 0) {
    console.error("没有找到任何文章（src/posts/*.md）。");
    process.exit(1);
  }

  const stats = buildStats(posts);
  await copyStaticDeployAssets();

  // 单篇页
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const nav = {
      prev: posts[i - 1] || null,
      next: posts[i + 1] || null,
      related: relatedPosts(post, posts),
    };
    await writeFileEnsured(`post/${post.slug}/index.html`, renderPostPage(post, nav) + "\n");
  }

  // 列表页
  await writeFileEnsured("post/index.html", renderPostList(posts, stats) + "\n");

  // 标签云页
  await writeFileEnsured("tags/index.html", renderTagsPage(collectTags(posts)) + "\n");

  // 时间归档页
  await writeFileEnsured("categories/index.html", renderCategoriesPage(posts, stats) + "\n");

  // AI 导航页
  await writeFileEnsured("ai/index.html", renderAiPage() + "\n");

  // 在线工具箱
  await writeFileEnsured("tools/index.html", renderToolsPage() + "\n");

  // 鉴赏页
  await writeFileEnsured("appreciation/index.html", renderAppreciationPage() + "\n");

  // 赞助页
  await writeFileEnsured("sponsor/index.html", renderSponsorPage() + "\n");

  // 隐私与信任页
  await writeFileEnsured("trust/index.html", renderTrustPage() + "\n");

  // sitemap + RSS
  await writeFileEnsured("sitemap.xml", buildSitemap(posts) + "\n");
  await writeFileEnsured("robots.txt", buildRobots() + "\n");
  await writeFileEnsured("index.xml", buildRss(posts) + "\n");
  await writeFileEnsured("post/index.xml", buildPostRss(posts) + "\n");
  await writeFileEnsured("categories/index.xml", buildCategoriesRss(posts) + "\n");

  // 搜索索引
  await writeFileEnsured("search-index.json", buildSearchIndex(posts) + "\n");

  // Service Worker 由源契约生成，避免手写产物与 PWA 策略漂移。
  await writeFileEnsured("service-worker.js", renderServiceWorker() + "\n");

  console.log(`✓ 构建完成：${posts.length} 篇文章 → ${OUT_DIR}`);
  for (const p of posts) console.log(`  - post/${p.slug}/`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
