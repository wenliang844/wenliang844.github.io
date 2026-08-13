// CWLBlog 静态站点构建脚本。
//
// 输入：src/posts/*.md（front matter + Markdown 正文）
// 输出：文章路由、RSS/Sitemap、搜索/知识索引与资源引用清单
//
// 用法：
//   node scripts/build.mjs            # 输出到项目根（覆盖现有产物）
//   node scripts/build.mjs --out dist # 输出到 dist/（用于对齐验证）
//   node scripts/build.mjs --skip-astro-html # 跳过已由 Astro 接管的内容 HTML

import { existsSync } from "node:fs";
import { readdir, readFile, mkdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import sharp from "sharp";
import { parse as parseYaml } from "yaml";

import { CONTENT_CATEGORIES, CONTENT_SERIES, SITE, STATIC_PAGES, SEARCH_PAGES } from "../src/config.mjs";
import { renderPostPage, renderPostList } from "../src/templates/post.mjs";
import { renderTagsPage } from "../src/templates/tags.mjs";
import { renderCategoriesPage } from "../src/templates/categories.mjs";
import { renderSeriesIndex, renderTaxonomyDetail } from "../src/templates/taxonomy.mjs";
import { renderKnowledgePage } from "../src/templates/knowledge.mjs";
import { renderAiPage } from "../src/templates/ai.mjs";
import { renderToolsPage } from "../src/templates/tools.mjs";
import { renderAppreciationPage } from "../src/templates/appreciation.mjs";
import { renderSponsorPage } from "../src/templates/sponsor.mjs";
import { renderChatPage } from "../src/templates/chat.mjs";
import { escapeAttr, escapeHtml, escapeXml, rfc822, sitemapDate } from "../src/lib/format.mjs";
import { readingMinutes } from "../src/lib/reading.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(__dirname, "..");
const ROOT = existsSync(join(sourceRoot, "src", "posts")) ? sourceRoot : process.cwd();
const POSTS_DIR = join(ROOT, "src", "posts");
const IMAGES_DIR = join(ROOT, "images");
const POST_SITEMAP_PRIORITY = "0.8";
const COVER_MAX_PIXELS = 40_000_000;
const COVER_WIDTH = 960;
const COVER_FORMATS = new Set(["png", "jpeg", "webp", "avif"]);

// 输出目录：--out <dir>，默认项目根。
const outIdx = process.argv.indexOf("--out");
const OUT_DIR = resolveOutDir(outIdx);
const SKIP_ASTRO_HTML = process.argv.includes("--skip-astro-html");

marked.setOptions({ gfm: true, breaks: false });
marked.use({
  extensions: [{
    name: "wikiLink",
    level: "inline",
    start(source) {
      const index = source.indexOf("[[");
      return index >= 0 ? index : undefined;
    },
    tokenizer(source) {
      const match = source.match(/^\[\[([A-Za-z0-9_-]+)(?:\|([^\]\n]+))?\]\]/);
      if (!match) return undefined;
      return {
        type: "wikiLink",
        raw: match[0],
        target: match[1],
        label: (match[2] || match[1]).trim(),
      };
    },
    renderer(token) {
      return `<a class="wiki-link" href="/post/${escapeAttr(token.target)}/">${escapeHtml(token.label)}</a>`;
    },
  }],
});

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

export function validateCoverAlt(cover, coverAlt, filename = "post") {
  if (!cover) return "";
  if (typeof coverAlt !== "string" || !coverAlt.trim()) {
    throw new Error(`Invalid coverAlt in ${filename}: a non-empty description is required when cover is set.`);
  }
  if (coverAlt.length > 240) {
    throw new Error(`Invalid coverAlt in ${filename}: description is too long (max 240 characters).`);
  }
  return coverAlt.trim();
}

async function generatedCoverIsCurrent(sourcePath, outputPaths) {
  try {
    const sourceStat = await stat(sourcePath);
    const outputStats = await Promise.all(outputPaths.map((path) => stat(path)));
    return outputStats.every((outputStat) => outputStat.mtimeMs >= sourceStat.mtimeMs);
  } catch {
    return false;
  }
}

async function buildCoverAsset(cover, coverAlt, slug, filename) {
  if (!cover || /^https?:\/\//i.test(cover)) return null;

  const sourcePath = resolve(ROOT, cover.replace(/^\/+/, ""));
  const imageRelativePath = relative(IMAGES_DIR, sourcePath);
  if (!imageRelativePath || imageRelativePath.startsWith("..") || isAbsolute(imageRelativePath)) {
    throw new Error(`Invalid cover in ${filename}: local cover must stay inside /images/.`);
  }

  let metadata;
  try {
    metadata = await sharp(sourcePath, { failOn: "error", limitInputPixels: COVER_MAX_PIXELS }).metadata();
  } catch (error) {
    throw new Error(`Invalid cover in ${filename}: ${error.message}`);
  }
  if (!COVER_FORMATS.has(metadata.format) || !metadata.width || !metadata.height) {
    throw new Error(`Invalid cover in ${filename}: use PNG, JPEG, WebP or AVIF with valid dimensions.`);
  }

  const generatedBase = `images/generated/${slug}-cover`;
  const webpPath = join(OUT_DIR, `${generatedBase}.webp`);
  const avifPath = join(OUT_DIR, `${generatedBase}.avif`);
  await mkdir(dirname(webpPath), { recursive: true });
  if (!(await generatedCoverIsCurrent(sourcePath, [webpPath, avifPath]))) {
    await Promise.all([
      sharp(sourcePath, { failOn: "error", limitInputPixels: COVER_MAX_PIXELS })
        .resize({ width: COVER_WIDTH, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(webpPath),
      sharp(sourcePath, { failOn: "error", limitInputPixels: COVER_MAX_PIXELS })
        .resize({ width: COVER_WIDTH, withoutEnlargement: true })
        .avif({ quality: 52, effort: 4 })
        .toFile(avifPath),
    ]);
  }

  return {
    src: cover,
    alt: coverAlt,
    width: metadata.width,
    height: metadata.height,
    webp: `/${generatedBase}.webp`,
    avif: `/${generatedBase}.avif`,
  };
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

export function validateContentTaxonomy(data, filename, seenSeriesOrders = null) {
  if (!data.category || typeof data.category !== "string" || !CONTENT_CATEGORIES[data.category]) {
    throw new Error(`Invalid category in ${filename}: use a configured category ID.`);
  }
  if (!data.series) {
    if (data.order !== undefined) {
      throw new Error(`Invalid order in ${filename}: order requires a series.`);
    }
    return;
  }
  if (typeof data.series !== "string" || !CONTENT_SERIES[data.series]) {
    throw new Error(`Invalid series in ${filename}: use a configured series ID.`);
  }
  if (!Number.isInteger(data.order) || data.order < 1) {
    throw new Error(`Invalid order in ${filename}: series order must be a positive integer.`);
  }
  if (seenSeriesOrders) {
    const key = `${data.series}:${data.order}`;
    const existing = seenSeriesOrders.get(key);
    if (existing) {
      throw new Error(`Duplicate series order in ${filename}: ${key} is already used by ${existing}.`);
    }
    seenSeriesOrders.set(key, filename);
  }
}

// 只有显式布尔值 true 才视为草稿，避免字符串 "false" 等宽松值误判。
export function isDraftPost(data) {
  return data && data.draft === true;
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

function internalPostSlug(href) {
  if (!href || typeof href !== "string") return null;
  let url;
  try {
    url = new URL(href, SITE.baseURL);
  } catch {
    return null;
  }
  if (url.origin !== new URL(SITE.baseURL).origin) return null;
  const match = url.pathname.match(/^\/post\/([A-Za-z0-9_-]+)\/?$/);
  return match ? match[1] : null;
}

export function collectInternalLinks(markdown) {
  const links = new Set();
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (value.type === "wikiLink" && value.target) {
      links.add(value.target);
    } else if (value.type === "link") {
      const slug = internalPostSlug(value.href);
      if (slug) links.add(slug);
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
  };
  marked.lexer(markdown || "").forEach(visit);
  return [...links];
}

export function resolvePostLinks(posts) {
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  const errors = [];
  for (const post of posts) {
    post.backlinks = [];
    post.outgoingLinks = [...new Set(post.outgoingLinks || [])];
    for (const target of post.outgoingLinks) {
      if (target === post.slug) continue;
      if (!bySlug.has(target)) {
        errors.push(`${post.sourceFile || post.slug}: internal link target does not exist: ${target}`);
      }
    }
  }
  if (errors.length) {
    throw new Error(`Broken internal links:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
  }
  for (const post of posts) {
    for (const target of post.outgoingLinks) {
      if (target === post.slug) continue;
      bySlug.get(target).backlinks.push(post);
    }
  }
  posts.forEach((post) => post.backlinks.sort((a, b) => b.modified.localeCompare(a.modified)));
  return posts;
}

// 将已解析的内容条目转换为站点领域模型。Astro Content Collections 和
// 兼容构建器共享这一步，避免迁移期间出现两套文章排序、链接与图片逻辑。
export async function buildPosts(sourceEntries, initialErrors = []) {
  const posts = [];
  const errors = [...initialErrors];
  const seenSlugs = new Map();
  const seenSeriesOrders = new Map();

  for (const entry of sourceEntries) {
    const { file, data, content = "" } = entry;
    try {
      // 验证必填字段
      validatePost(data, file);
      validateContentTaxonomy(data, file, seenSeriesOrders);

      // 草稿保留在 Git 中，但不得进入页面、搜索、RSS 或 sitemap。
      if (isDraftPost(data)) {
        continue;
      }

      const slug = data.slug || file.replace(/\.md$/, "");
      validateSlug(slug, file);
      validateUniqueSlug(slug, file, seenSlugs);

      // 检查内容是否为空
      if (!content.trim()) {
        console.warn(`Warning: ${file} has no content body`);
      }

      const contentResult = renderContent(content);
      const contentEnResult = data.contentEn ? renderContent(data.contentEn) : null;
      const outgoingLinks = [
        ...new Set([
          ...collectInternalLinks(content),
          ...(data.contentEn ? collectInternalLinks(data.contentEn) : []),
        ]),
      ];

      const date = normalizeDate(data.date);
      const modified = normalizeModifiedDate(data.modified, date, file);
      const cover = normalizeCover(data.cover, file);
      const coverAlt = validateCoverAlt(cover, data.coverAlt, file);
      const coverAsset = await buildCoverAsset(cover, coverAlt, slug, file);
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
        category: data.category,
        series: data.series || "",
        seriesOrder: data.series ? data.order : null,
        sourceFile: file,
        revisionUrl: `${SITE.repositoryURL}/commits/${SITE.repositoryBranch}/src/posts/${encodeURIComponent(file)}`,
        cover,
        coverAlt,
        coverAsset,
        eyebrow: data.eyebrow || "项目",
        summary: data.summary,
        summaryEn: data.summaryEn,
        description: data.description,
        descriptionEn: data.descriptionEn,
        tags: Array.isArray(data.tags) ? data.tags : [],
        tagsEn: Array.isArray(data.tagsEn) ? data.tagsEn : (Array.isArray(data.tags) ? data.tags : []),
        contentHtml: contentResult.html,
        contentHtmlEn: contentEnResult ? contentEnResult.html : "",
        contentMarkdown: content,
        outgoingLinks,
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
  return resolvePostLinks(posts);
}

// 兼容构建器仍可直接从文件系统加载内容；文章页面路由已由 Astro
// Content Collections 接管，RSS、Sitemap 与知识派生产物暂时复用此入口。
export async function loadPosts() {
  const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith(".md"));
  const entries = [];
  const errors = [];

  for (const file of files) {
    try {
      const raw = await readFile(join(POSTS_DIR, file), "utf8");
      if (!raw.trim()) {
        errors.push(`${file}: File is empty`);
        continue;
      }
      const { data, content } = parseFrontMatter(raw, file);
      entries.push({ file, data, content });
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }

  return buildPosts(entries, errors);
}

async function writeFileEnsured(relPath, content) {
  const full = join(OUT_DIR, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf8");
  return full;
}

// 去掉 HTML 标签，保留纯文本，供搜索索引全文检索。
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export { readingMinutes };

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

// 构建期推荐只使用公开内容关系，不依赖用户画像。
// 正文引用、系列、分类和共同标签形成主分，发布时间接近度只做小幅排序。
export function relatedPosts(post, posts, limit = 3) {
  const tags = new Set(post.tags || []);
  const outgoing = new Set(post.outgoingLinks || []);
  const postTime = Date.parse(post.modified || post.date || "") || 0;
  return posts
    .filter((p) => p.slug !== post.slug)
    .map((candidate) => {
      const sharedTags = (candidate.tags || []).filter((tag) => tags.has(tag)).length;
      const linked = outgoing.has(candidate.slug) || (candidate.outgoingLinks || []).includes(post.slug);
      const sameSeries = Boolean(post.series && candidate.series && post.series === candidate.series);
      const sameCategory = Boolean(post.category && candidate.category && post.category === candidate.category);
      const reasons = [];
      let semanticScore = 0;
      if (linked) {
        semanticScore += 8;
        reasons.push("linked");
      }
      if (sameSeries) {
        semanticScore += 6;
        reasons.push("series");
      }
      if (sameCategory) {
        semanticScore += 3;
        reasons.push("category");
      }
      if (sharedTags > 0) {
        semanticScore += sharedTags * 2;
        reasons.push("tags");
      }
      const candidateTime = Date.parse(candidate.modified || candidate.date || "") || 0;
      const distanceDays = postTime && candidateTime ? Math.abs(postTime - candidateTime) / 86_400_000 : 3650;
      const recencyAffinity = Math.max(0, 1 - distanceDays / 1825);
      return {
        post: {
          ...candidate,
          recommendation: {
            score: Number((semanticScore + recencyAffinity).toFixed(3)),
            reasons,
            sharedTags,
          },
        },
        semanticScore,
        recencyAffinity,
      };
    })
    .filter((entry) => entry.semanticScore > 0)
    .sort((a, b) => b.semanticScore - a.semanticScore
      || b.recencyAffinity - a.recencyAffinity
      || String(b.post.modified || b.post.date || "").localeCompare(String(a.post.modified || a.post.date || "")))
    .slice(0, limit)
    .map((entry) => entry.post);
}

function localizedPost(post) {
  return {
    title: post.titleEn || post.title,
    shortTitle: post.shortTitleEn || post.shortTitle,
    summary: post.summaryEn || post.summary,
    tags: post.tagsEn || post.tags,
    body: stripHtml(post.contentHtmlEn || post.contentHtml),
  };
}

// 生成搜索索引 JSON（文章 + 静态页），供全局模糊搜索使用。
function buildSearchIndex(posts) {
  return JSON.stringify(
    posts.map((p) => ({
      type: "post",
      title: p.title,
      shortTitle: p.shortTitle,
      summary: p.summary,
      date: p.date,
      tags: p.tags,
      path: `/post/${p.slug}/`,
      slug: p.slug,
      category: p.category,
      series: p.series,
      body: stripHtml(p.contentHtml),
      i18n: {
        en: localizedPost(p),
      },
    })).concat(SEARCH_PAGES.map((p) => ({ type: "page", ...p }))),
    null,
    0,
  );
}

// sitemap.xml：静态页 + 文章页（插入到 /post/ 之后），对齐现有顺序。
function buildSitemap(posts, categories = collectCategories(posts), seriesGroups = collectSeries(posts)) {
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

  for (const group of categories) {
    rows.push(`  <url><loc>${escapeXml(`${SITE.baseURL}/categories/${group.id}/`)}</loc><lastmod>${siteLastmod}</lastmod><priority>0.6</priority></url>`);
  }
  for (const group of seriesGroups) {
    rows.push(`  <url><loc>${escapeXml(`${SITE.baseURL}/series/${group.id}/`)}</loc><lastmod>${siteLastmod}</lastmod><priority>0.6</priority></url>`);
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

# 排除资源文件夹
Disallow: /js/vendor/
Disallow: /css/fontawesome/

# Sitemap
Sitemap: ${SITE.baseURL}/sitemap.xml`;
}

// 统计所有文章的标签及出现次数，按文章数降序、同数按名称升序排列。
export function collectTags(posts) {
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

function rssCdata(value) {
  return String(value || "").replace(/]]>/g, "]]]]><![CDATA[>");
}

export function buildKnowledgeGraph(posts) {
  const nodes = posts.map((post) => ({
    id: post.slug,
    title: post.title,
    shortTitle: post.shortTitle,
    url: `/post/${post.slug}/`,
    category: post.category,
    series: post.series,
    date: post.date,
    modified: post.modified || post.date,
    tags: [...post.tags],
    incomingLinks: post.backlinks?.length || 0,
    outgoingLinks: post.outgoingLinks?.length || 0,
  }));
  const edges = [];
  const seen = new Set();
  const addEdge = (source, target, type, label, weight = 1) => {
    if (!source || !target || source === target) return;
    const key = `${source}:${target}:${type}`;
    const reverseKey = `${target}:${source}:${type}`;
    if (seen.has(key) || seen.has(reverseKey)) return;
    seen.add(key);
    edges.push({ source, target, type, label, weight });
  };

  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const sharedTags = posts[i].tags.filter((tag) => posts[j].tags.includes(tag));
      if (sharedTags.length) {
        addEdge(posts[i].slug, posts[j].slug, "tag", sharedTags.join("、"), sharedTags.length);
      }
    }
  }
  for (const group of collectSeries(posts)) {
    for (let index = 1; index < group.posts.length; index++) {
      addEdge(group.posts[index - 1].slug, group.posts[index].slug, "series", group.name);
    }
  }
  for (const post of posts) {
    (post.outgoingLinks || []).forEach((target) => {
      if (nodes.some((node) => node.id === target)) {
        addEdge(post.slug, target, "reference", "文章引用");
      }
    });
  }

  const degree = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => {
    degree.set(edge.source, degree.get(edge.source) + 1);
    degree.set(edge.target, degree.get(edge.target) + 1);
  });
  nodes.forEach((node) => { node.connections = degree.get(node.id); });
  const latestModified = nodes.reduce((latest, node) => node.modified > latest ? node.modified : latest, "1970-01-01");
  return {
    generatedAt: `${latestModified}T00:00:00.000Z`,
    nodes,
    edges,
    stats: {
      articles: nodes.length,
      categories: new Set(nodes.map((node) => node.category)).size,
      edges: edges.length,
      orphans: nodes.filter((node) => node.connections === 0).length,
      references: edges.filter((edge) => edge.type === "reference").length,
      linkOrphans: nodes.filter((node) => node.incomingLinks + node.outgoingLinks === 0).length,
    },
  };
}

const CONTENT_TARGET_PER_CATEGORY = 5;
const CONTENT_REVIEW_DAYS = 90;
const CONTENT_STALE_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(start, end) {
  return Math.max(0, Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS));
}

function currentMonthStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// 月初时钟让停更站点的陈旧度继续推进，同时把纯时间造成的生成产物变化
// 限制为每月一次。测试和恢复构建可通过 asOf 显式固定评估日期。
export function buildContentHealth(posts, graph = buildKnowledgeGraph(posts), { asOf: requestedAsOf } = {}) {
  const latestModified = graph.generatedAt.slice(0, 10);
  const clockDate = normalizeDate(requestedAsOf || process.env.CWL_CONTENT_AS_OF || currentMonthStart());
  const asOf = clockDate > latestModified ? clockDate : latestModified;
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const articles = posts.map((post) => {
    const node = nodesById.get(post.slug);
    const modified = post.modified || post.date;
    const ageDays = daysBetween(modified, asOf);
    const freshness = ageDays > CONTENT_STALE_DAYS
      ? "stale"
      : ageDays > CONTENT_REVIEW_DAYS ? "review" : "current";
    const linkOrphan = (node?.incomingLinks || 0) + (node?.outgoingLinks || 0) === 0;
    const graphOrphan = (node?.connections || 0) === 0;
    const sparseTags = (post.tags?.length || 0) < 2;
    const score = (freshness === "stale" ? 4 : freshness === "review" ? 2 : 0)
      + (linkOrphan ? 3 : 0)
      + (graphOrphan ? 2 : 0)
      + (sparseTags ? 1 : 0);
    const reasons = [];
    if (freshness === "stale") reasons.push(`超过 ${CONTENT_STALE_DAYS} 天未更新`);
    else if (freshness === "review") reasons.push(`超过 ${CONTENT_REVIEW_DAYS} 天未更新`);
    if (linkOrphan) reasons.push("缺少正文入链或出链");
    if (graphOrphan) reasons.push("未形成知识关联");
    if (sparseTags) reasons.push("主题标签少于 2 个");
    return {
      slug: post.slug,
      title: post.title,
      shortTitle: post.shortTitle,
      url: `/post/${post.slug}/`,
      category: post.category,
      modified,
      ageDays,
      freshness,
      linkOrphan,
      graphOrphan,
      sparseTags,
      score,
      reasons,
    };
  });

  const categories = Object.entries(CONTENT_CATEGORIES).map(([id, meta]) => {
    const categoryArticles = articles.filter((article) => article.category === id);
    const latestModified = categoryArticles.reduce(
      (latest, article) => article.modified > latest ? article.modified : latest,
      "",
    );
    return {
      id,
      name: meta.name,
      count: categoryArticles.length,
      target: CONTENT_TARGET_PER_CATEGORY,
      coverage: Math.min(100, Math.round((categoryArticles.length / CONTENT_TARGET_PER_CATEGORY) * 100)),
      gap: Math.max(0, CONTENT_TARGET_PER_CATEGORY - categoryArticles.length),
      latestModified: latestModified || null,
      stale: categoryArticles.filter((article) => article.freshness === "stale").length,
    };
  });
  const maintenance = articles
    .filter((article) => article.score > 0)
    .sort((left, right) => right.score - left.score || left.modified.localeCompare(right.modified))
    .slice(0, 10);

  return {
    version: 1,
    asOf,
    policy: {
      categoryTarget: CONTENT_TARGET_PER_CATEGORY,
      reviewAfterDays: CONTENT_REVIEW_DAYS,
      staleAfterDays: CONTENT_STALE_DAYS,
      clock: "monthly-or-latest-content",
    },
    stats: {
      articles: articles.length,
      current: articles.filter((article) => article.freshness === "current").length,
      review: articles.filter((article) => article.freshness === "review").length,
      stale: articles.filter((article) => article.freshness === "stale").length,
      linkOrphans: articles.filter((article) => article.linkOrphan).length,
      graphOrphans: articles.filter((article) => article.graphOrphan).length,
      categoryGap: categories.reduce((total, category) => total + category.gap, 0),
    },
    categories,
    articles,
    maintenance,
  };
}

function knowledgePlainText(markdown) {
  return String(markdown || "")
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([A-Za-z0-9_-]+)(?:\|([^\]\n]+))?\]\]/g, (_, slug, label) => label || slug)
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]\s|\d+\.\s)\s*/gm, "")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitKnowledgeText(text, maxLength = 1100, overlap = 140) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      const prefix = current.trim();
      let start = 0;
      const available = maxLength - prefix.length - 2;
      if (prefix && available >= 100) {
        chunks.push(`${prefix}\n\n${paragraph.slice(0, available)}`);
        start = Math.max(0, available - overlap);
      } else if (prefix) {
        chunks.push(prefix);
      }
      for (let offset = start; offset < paragraph.length; offset += maxLength - overlap) {
        chunks.push(paragraph.slice(offset, offset + maxLength).trim());
      }
      current = "";
      continue;
    }
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }
    const previous = current.trim();
    if (previous) chunks.push(previous);
    const tail = previous.slice(Math.max(0, previous.length - overlap));
    current = tail && tail.length + paragraph.length + 2 <= maxLength
      ? `${tail}\n\n${paragraph}`
      : paragraph;
  }
  if (current.trim()) chunks.push(current.trim());
  return [...new Set(chunks.filter((chunk) => chunk.length >= 40))];
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildKnowledgeChunks(posts) {
  const chunks = [];
  const documents = posts.map((post) => {
    const text = knowledgePlainText(post.contentMarkdown || stripHtml(post.contentHtml || ""));
    const documentHash = sha256Text(`${post.slug}\n${post.modified || post.date}\n${text}`);
    const parts = splitKnowledgeText(text);
    parts.forEach((part, ordinal) => {
      const hash = sha256Text(`${documentHash}:${ordinal}:${part}`);
      chunks.push({
        id: `${post.slug}-${ordinal}-${hash.slice(0, 12)}`,
        documentId: post.slug,
        ordinal,
        title: post.title,
        path: `/post/${post.slug}/`,
        text: part,
        hash,
        category: post.category,
        series: post.series || "",
        tags: [...(post.tags || [])],
        modified: post.modified || post.date,
      });
    });
    return {
      id: post.slug,
      title: post.title,
      path: `/post/${post.slug}/`,
      contentHash: documentHash,
      modified: post.modified || post.date,
      chunkCount: parts.length,
    };
  });
  const datasetHash = sha256Text(documents.map((document) => `${document.id}:${document.contentHash}`).join("\n"));
  return { version: 1, datasetHash, documents, chunks };
}

export function buildAssetReferences(posts) {
  const references = new Set();
  const pattern = /(?:^|[(/"'\s])(images\/uploads\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|jpe?g|png|webp))(?=$|[?#)"'\s])/gi;
  for (const post of posts) {
    const sources = [post.cover || "", post.contentMarkdown || ""];
    for (const source of sources) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(String(source)))) {
        const key = match[1];
        if (!key.includes("..")) references.add(key);
      }
    }
  }
  const sorted = [...references].sort();
  return {
    version: 1,
    contentHash: sha256Text(sorted.join("\n")),
    references: sorted,
  };
}

export function collectCategories(posts) {
  return Object.entries(CONTENT_CATEGORIES)
    .map(([id, meta]) => ({ id, ...meta, posts: posts.filter((post) => post.category === id) }))
    .filter((group) => group.posts.length > 0)
    .sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

export function collectSeries(posts) {
  return Object.entries(CONTENT_SERIES)
    .map(([id, meta]) => ({
      id,
      ...meta,
      posts: posts
        .filter((post) => post.series === id)
        .sort((a, b) => a.seriesOrder - b.seriesOrder),
    }))
    .filter((group) => group.posts.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

export function buildSeriesContext(post, groups) {
  if (!post.series) return null;
  const group = groups.find((candidate) => candidate.id === post.series);
  if (!group) return null;
  const index = group.posts.findIndex((candidate) => candidate.slug === post.slug);
  return {
    id: group.id,
    name: group.name,
    index,
    total: group.posts.length,
    prev: group.posts[index - 1] || null,
    next: group.posts[index + 1] || null,
  };
}

// index.xml：RSS 2.0，全量输出正文，读者无需跳出阅读器才能阅读。
function buildRssItems(posts) {
  return posts
    .map((post) => {
      const url = `${SITE.baseURL}/post/${post.slug}/`;
      return `    <item>
      <title>${escapeXml(post.shortTitle)}</title>
      <link>${escapeXml(url)}</link>
      <pubDate>${rfc822(post.date)}</pubDate>
      <guid>${escapeXml(url)}</guid>
      <description>${escapeXml(post.description)}</description>
      <content:encoded><![CDATA[${rssCdata(post.contentHtml)}]]></content:encoded>
    </item>`;
    })
    .join("\n");
}

export function buildStats(posts) {
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
  const latestModified = posts.reduce((latest, post) => {
    const value = post.modified || post.date;
    return value > latest ? value : latest;
  }, posts[0].modified || posts[0].date);
  const lastBuild = rfc822(latestModified);
  const items = buildRssItems(posts);

  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
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
  const categories = collectCategories(posts);
  const seriesGroups = collectSeries(posts);
  const knowledgeGraph = buildKnowledgeGraph(posts);
  const contentHealth = buildContentHealth(posts, knowledgeGraph);
  const knowledgeChunks = buildKnowledgeChunks(posts);

  if (!SKIP_ASTRO_HTML) {
    // 兼容独立构建与隔离测试；混合生产构建中的这些路由由 Astro 唯一生成。
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const nav = {
        prev: posts[i - 1] || null,
        next: posts[i + 1] || null,
        related: relatedPosts(post, posts),
        backlinks: post.backlinks,
        series: buildSeriesContext(post, seriesGroups),
      };
      await writeFileEnsured(`post/${post.slug}/index.html`, renderPostPage(post, nav) + "\n");
    }
    await writeFileEnsured("post/index.html", renderPostList(posts, stats) + "\n");
    await writeFileEnsured("tags/index.html", renderTagsPage(collectTags(posts)) + "\n");
    await writeFileEnsured("categories/index.html", renderCategoriesPage(posts, stats, categories) + "\n");
    for (const group of categories) {
      await writeFileEnsured(`categories/${group.id}/index.html`, renderTaxonomyDetail(group, "category") + "\n");
    }
    await writeFileEnsured("series/index.html", renderSeriesIndex(seriesGroups) + "\n");
    for (const group of seriesGroups) {
      await writeFileEnsured(`series/${group.id}/index.html`, renderTaxonomyDetail(group, "series") + "\n");
    }
    await writeFileEnsured("knowledge/index.html", renderKnowledgePage(knowledgeGraph, contentHealth) + "\n");
  }
  await writeFileEnsured("knowledge/graph.json", JSON.stringify(knowledgeGraph, null, 2) + "\n");
  await writeFileEnsured("knowledge/health.json", JSON.stringify(contentHealth, null, 2) + "\n");
  await writeFileEnsured("knowledge/chunks.json", JSON.stringify(knowledgeChunks) + "\n");
  await writeFileEnsured("asset-references.json", JSON.stringify(buildAssetReferences(posts), null, 2) + "\n");

  // AI 导航页
  await writeFileEnsured("ai/index.html", renderAiPage() + "\n");

  // 在线工具箱
  await writeFileEnsured("tools/index.html", renderToolsPage() + "\n");

  // 临时聊天室
  await writeFileEnsured("chat/index.html", renderChatPage() + "\n");

  // 鉴赏页
  await writeFileEnsured("appreciation/index.html", renderAppreciationPage() + "\n");

  // 赞助页
  await writeFileEnsured("sponsor/index.html", renderSponsorPage() + "\n");

  // sitemap + RSS
  await writeFileEnsured("sitemap.xml", buildSitemap(posts, categories, seriesGroups) + "\n");
  await writeFileEnsured("robots.txt", buildRobots() + "\n");
  await writeFileEnsured("index.xml", buildRss(posts) + "\n");
  await writeFileEnsured("post/index.xml", buildPostRss(posts) + "\n");
  await writeFileEnsured("categories/index.xml", buildCategoriesRss(posts) + "\n");

  // 搜索索引
  await writeFileEnsured("search-index.json", buildSearchIndex(posts) + "\n");

  console.log(`✓ 构建完成：${posts.length} 篇文章 → ${OUT_DIR}`);
  for (const p of posts) console.log(`  - post/${p.slug}/`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
