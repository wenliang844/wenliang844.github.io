// Phase 3: 模板渲染测试扩展
import test from "node:test";
import assert from "node:assert/strict";

import { renderToolsPage } from "../src/templates/tools.mjs";
import { renderAiPage } from "../src/templates/ai.mjs";
import { renderCategoriesPage } from "../src/templates/categories.mjs";
import { renderAppreciationPage } from "../src/templates/appreciation.mjs";
import { renderSponsorPage } from "../src/templates/sponsor.mjs";
import { renderPostPage, renderPostList } from "../src/templates/post.mjs";
import { renderTagsPage } from "../src/templates/tags.mjs";

function extractJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, "page should include JSON-LD");
  return JSON.parse(match[1]);
}

// ─── Tools 页面测试 ────────────────────────────────────────────────────────────

test("renderToolsPage includes all 26 tool panels", () => {
  const html = renderToolsPage();
  const panelIds = [
    "json",
    "time",
    "base64",
    "url",
    "uuid",
    "jwt",
    "hash",
    "password",
    "color",
    "regex",
    "markdown",
    "diff",
    "case",
    "html",
    "cron",
    "qr",
    "yaml",
    "urlparse",
    "query",
    "jsonpath",
    "textstats",
    "cleantext",
    "unit",
    "random",
    "datediff",
    "ua",
  ];

  for (const id of panelIds) {
    assert.match(html, new RegExp(`id="tool-${id}"`));
  }
});

test("renderToolsPage has correct script references", () => {
  const html = renderToolsPage();
  assert.match(html, /src="\/js\/tools-core\.js"/);
  assert.match(html, /src="\/js\/tools\.js"/);
  assert.match(html, /src="\/js\/assistant\.js"/);
  assert.match(html, /src="\/js\/vendor\/marked\.min\.js"/);
  assert.match(html, /src="\/js\/vendor\/purify\.min\.js"/);
  assert.match(html, /src="\/js\/vendor\/qrcode\.min\.js"/);
});

test("renderToolsPage has OG meta tags", () => {
  const html = renderToolsPage();
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:description"/);
  assert.match(html, /href="https:\/\/wenliang844\.github\.io\/tools\/"/);
});

test("renderToolsPage has tool navigation tabs with aria attributes", () => {
  const html = renderToolsPage();
  assert.match(html, /data-tool-tab="json"/);
  assert.match(html, /aria-controls="tool-json"/);
  assert.match(html, /data-tool-tab="jwt"/);
});

test("renderToolsPage has i18n data attributes", () => {
  const html = renderToolsPage();
  assert.match(html, /data-i18n="tools\.h1"/);
  assert.match(html, /data-i18n="tools\.lead"/);
  assert.match(html, /data-i18n="tools\.eyebrow"/);
});

test("generated static templates include page-specific JSON-LD", () => {
  const posts = [
    { slug: "a", shortTitle: "A", shortTitleEn: "A", title: "A", titleEn: "A", date: "2024-06-01", eyebrow: "项目", summary: "S", summaryEn: "S", tags: ["Java"], tagsEn: ["Java"], contentHtml: "<p>A</p>", contentHtmlEn: "", readMinutes: 1, images: [] },
    { slug: "b", shortTitle: "B", shortTitleEn: "B", title: "B", titleEn: "B", date: "2023-01-01", eyebrow: "项目", summary: "S", summaryEn: "S", tags: ["Node"], tagsEn: ["Node"], contentHtml: "<p>B</p>", contentHtmlEn: "", readMinutes: 1, images: [] },
  ];
  const stats = { count: 2, systems: 2, startYear: "2023", endYear: "2024", yearCount: 2, range: "2023-2024" };

  const toolsLd = extractJsonLd(renderToolsPage());
  assert.equal(toolsLd["@type"], "WebApplication");
  assert.equal(toolsLd.applicationCategory, "DeveloperApplication");
  assert.ok(toolsLd.featureList.includes("JSON Formatter"));

  const aiLd = extractJsonLd(renderAiPage());
  assert.equal(aiLd["@type"], "CollectionPage");
  assert.equal(aiLd.mainEntity.numberOfItems, 20);

  const postListLd = extractJsonLd(renderPostList(posts, stats));
  assert.equal(postListLd["@type"], "CollectionPage");
  assert.equal(postListLd.mainEntity.itemListElement[0].url, "https://wenliang844.github.io/post/a/");

  const categoriesLd = extractJsonLd(renderCategoriesPage(posts, stats));
  assert.equal(categoriesLd["@type"], "CollectionPage");
  assert.equal(categoriesLd.mainEntity.numberOfItems, 2);

  const tagsLd = extractJsonLd(renderTagsPage([{ tag: "Java", tagEn: "Java", count: 1 }]));
  assert.equal(tagsLd["@type"], "CollectionPage");
  assert.equal(tagsLd.mainEntity.itemListElement[0].url, "https://wenliang844.github.io/post/?tag=Java");

  const appreciationLd = extractJsonLd(renderAppreciationPage());
  assert.equal(appreciationLd["@type"], "CollectionPage");
  assert.equal(appreciationLd.mainEntity.numberOfItems, 44);

  const sponsorLd = extractJsonLd(renderSponsorPage());
  assert.equal(sponsorLd["@type"], "WebPage");
  assert.equal(sponsorLd.potentialAction[0]["@type"], "DonateAction");
});

// ─── AI 导航页面测试 ───────────────────────────────────────────────────────────

test("renderAiPage includes all 5 category groups", () => {
  const html = renderAiPage();
  // 5 个 category section
  const matches = html.match(/class="ai-category"/g);
  assert.ok(matches && matches.length === 5, `Expected 5 categories, got ${matches ? matches.length : 0}`);
});

test("renderAiPage includes all 20 AI tools", () => {
  const html = renderAiPage();
  const toolCards = html.match(/class="ai-tool-card"/g);
  assert.ok(toolCards && toolCards.length === 20, `Expected 20 tools, got ${toolCards ? toolCards.length : 0}`);
});

test("renderAiPage external links have noopener noreferrer", () => {
  const html = renderAiPage();
  const externalLinks = html.match(/target="_blank"[^>]*>/g) || [];
  for (const link of externalLinks) {
    assert.ok(
      /rel="noopener noreferrer"/.test(link) || /rel="[^"]*\bnoopener\b[^"]*\bnoreferrer\b"/.test(link),
      `External link missing noopener noreferrer: ${link}`,
    );
  }
});

test("renderAiPage has proper OG and page metadata", () => {
  const html = renderAiPage();
  assert.match(html, /<title>中转站排名 :: CWLBlog<\/title>/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /href="https:\/\/wenliang844\.github\.io\/ai\/"/);
});

test("renderAiPage includes the relay ranking tab content", () => {
  const html = renderAiPage();
  assert.match(html, /<button class="ai-tab active" id="ai-tab-relay"[^>]+aria-selected="true"/);
  assert.match(html, /<button class="ai-tab" id="ai-tab-nav"[^>]+aria-selected="false"[^>]+tabindex="-1"/);
  assert.match(html, /<section class="ai-tab-panel relay-page ai-relay-panel active" id="ai-panel-relay"/);
  assert.match(html, /<section class="ai-tab-panel" id="ai-panel-nav"[^>]+hidden/);
  assert.match(html, /id="relay"/);
  assert.match(html, /data-relay-filter="chatgpt"/);
  assert.match(html, /data-relay-filter="claude"/);
  assert.match(html, /id="relay-search-input"/);
  assert.match(html, /LinuxDo 站/);
  assert.match(html, /商业站/);
  assert.match(html, /id="relay-list-linuxdo"/);
  assert.match(html, /id="relay-list-commercial"/);
  assert.match(html, /src="\/js\/relay\.js"/);
  assert.match(html, /href="https:\/\/wenliang844\.github\.io\/ai\/"/);
});

// ─── Categories 页面测试 ───────────────────────────────────────────────────────

test("renderCategoriesPage groups posts by year", () => {
  const posts = [
    { slug: "a", shortTitle: "A", shortTitleEn: "A EN", date: "2024-06-01", eyebrow: "项目" },
    { slug: "b", shortTitle: "B", shortTitleEn: "B EN", date: "2024-03-01", eyebrow: "项目" },
    { slug: "c", shortTitle: "C", shortTitleEn: "C EN", date: "2023-01-01", eyebrow: "项目" },
  ];
  const stats = { count: 3, systems: 2, yearCount: 2, range: "2023-2024" };
  const html = renderCategoriesPage(posts, stats);

  // 应该有两个年份组
  const yearGroups = html.match(/class="tree-group"/g);
  assert.ok(yearGroups && yearGroups.length === 2, `Expected 2 year groups, got ${yearGroups ? yearGroups.length : 0}`);

  // 包含年份
  assert.match(html, /2024/);
  assert.match(html, /2023/);

  // 包含统计
  assert.match(html, /3/); // count
  assert.match(html, /2023-2024/); // range
});

test("renderCategoriesPage has i18n attributes", () => {
  const posts = [{ slug: "a", shortTitle: "A", shortTitleEn: "A EN", date: "2024-01-01", eyebrow: "项目" }];
  const stats = { count: 1, systems: 1, yearCount: 1, range: "2024" };
  const html = renderCategoriesPage(posts, stats);
  assert.match(html, /data-i18n="categories\.title"/);
  assert.match(html, /data-i18n="categories\.lead"/);
});

// ─── Appreciation 页面测试 ─────────────────────────────────────────────────────

test("renderAppreciationPage includes all 5 boards", () => {
  const html = renderAppreciationPage();
  const boards = html.match(/class="rank-board"/g);
  assert.ok(boards && boards.length === 5, `Expected 5 boards, got ${boards ? boards.length : 0}`);
});

test("renderAppreciationPage contains expected content", () => {
  const html = renderAppreciationPage();
  assert.match(html, /鉴赏/);
  assert.match(html, /科技研究排行榜/);
  assert.match(html, /影视作品排行榜/);
  assert.match(html, /娱乐项目排行榜/);
  assert.match(html, /食物排行榜/);
  assert.match(html, /座右铭排行榜/);
  assert.match(html, /Codex/);
  assert.match(html, /Claude/);
  assert.match(html, /无耻之徒/);
  assert.match(html, /绝命毒师/);
  assert.match(html, /黑道家族/);
  assert.match(html, /鸡蛋/);
  assert.match(html, /所有的问题都是经济问题/);
});

test("renderAppreciationPage has correct item count per board", () => {
  const html = renderAppreciationPage();
  const rankItems = html.match(/class="rank-item"/g);
  // 5 + 10 + 14 + 7 + 8 = 44 items
  assert.ok(rankItems && rankItems.length === 44, `Expected 44 rank items, got ${rankItems ? rankItems.length : 0}`);
});

// ─── Sponsor 页面测试 ──────────────────────────────────────────────────────────

test("renderSponsorPage includes payment methods", () => {
  const html = renderSponsorPage();
  assert.match(html, /爱发电/);
  assert.match(html, /PayPal/);
  assert.match(html, /SPONSOR_LINKS\.afdian|ifdian\.net/);
  assert.match(html, /PayPal\.Me/);
});

test("renderSponsorPage has sponsor goal progress", () => {
  const html = renderSponsorPage();
  assert.match(html, /sponsor-progress/);
  assert.match(html, /72%/);
  assert.match(html, /¥2000/);
});

test("renderSponsorPage has domestic payment QR codes", () => {
  const html = renderSponsorPage();
  assert.match(html, /sponsor-qr-card/);
  assert.match(html, /\/images\/sponsor\/wechat-pay\.jpg/);
  assert.match(html, /\/images\/sponsor\/alipay-pay\.jpg/);
  assert.match(html, /微信支付扫码/);
  assert.match(html, /支付宝扫码/);
});

test("renderSponsorPage external links have proper security attributes", () => {
  const html = renderSponsorPage();
  const externalLinks = html.match(/<a[^>]*target="_blank"[^>]*>/g) || [];
  for (const link of externalLinks) {
    assert.ok(/rel="[^"]*noopener/.test(link), `Missing noopener: ${link}`);
    assert.ok(/rel="[^"]*noreferrer/.test(link), `Missing noreferrer: ${link}`);
  }
});

// ─── Post 模板边界测试 ─────────────────────────────────────────────────────────

test("renderPostPage includes all required SEO elements", () => {
  const post = {
    title: "Test Post", titleEn: "Test Post EN",
    shortTitle: "Test", shortTitleEn: "Test EN",
    slug: "test-post", date: "2024-06-15", modified: "2024-06-20",
    eyebrow: "项目", summary: "Summary", summaryEn: "Summary EN",
    description: "Description", descriptionEn: "Description EN",
    tags: ["Java"], tagsEn: ["Java"],
    contentHtml: "          <p>Content</p>",
    contentHtmlEn: "", readMinutes: 2, images: [], toc: [], tocEn: [],
  };
  const html = renderPostPage(post, { prev: null, next: null });

  // 基本 SEO
  assert.match(html, /<title>Test :: CWLBlog<\/title>/);
  assert.match(html, /<link rel="canonical"/);
  assert.match(html, /property="og:type" content="article"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:description"/);
  assert.match(html, /twitter:card/);

  // JSON-LD
  assert.match(html, /"@type":"Article"/);
  assert.match(html, /"dateModified":"2024-06-20"/);
  assert.match(html, /"@type":"Person"/);
  assert.match(html, /"@type":"Organization"/);

  // 结构
  assert.match(html, /class="article-header"/);
  assert.match(html, /class="article-content"/);
  assert.match(html, /class="post-tags"/);
  assert.match(html, /class="post-share"/);
});

test("renderPostPage renders bilingual content with hidden attribute", () => {
  const post = {
    title: "中文标题", titleEn: "English Title",
    shortTitle: "中文", shortTitleEn: "English",
    slug: "bilingual", date: "2024-01-01",
    eyebrow: "项目", summary: "中文摘要", summaryEn: "English Summary",
    description: "中文描述", descriptionEn: "English Description",
    tags: [], tagsEn: [],
    contentHtml: "          <p>中文正文</p>",
    contentHtmlEn: "          <p>English content</p>",
    readMinutes: 1, images: [], toc: [], tocEn: [],
  };
  const html = renderPostPage(post, { prev: null, next: null });

  assert.match(html, /data-i18n-lang="zh"/);
  assert.match(html, /data-i18n-lang="en" hidden/);
});

test("renderPostPage without English content does not add language markers", () => {
  const post = {
    title: "纯中文", titleEn: "",
    shortTitle: "中文", shortTitleEn: "",
    slug: "chinese-only", date: "2024-01-01",
    eyebrow: "项目", summary: "摘要", summaryEn: "",
    description: "描述", descriptionEn: "",
    tags: [], tagsEn: [],
    contentHtml: "          <p>正文</p>",
    contentHtmlEn: "", readMinutes: 1, images: [], toc: [], tocEn: [],
  };
  const html = renderPostPage(post, { prev: null, next: null });

  assert.doesNotMatch(html, /data-i18n-lang/);
});

test("renderPostPage includes giscus comments section", () => {
  const post = {
    title: "T", titleEn: "", shortTitle: "T", shortTitleEn: "",
    slug: "t", date: "2024-01-01", eyebrow: "项目",
    summary: "S", summaryEn: "", description: "D", descriptionEn: "",
    tags: [], tagsEn: [],
    contentHtml: "          <p>C</p>", contentHtmlEn: "",
    readMinutes: 1, images: [], toc: [], tocEn: [],
  };
  const html = renderPostPage(post, { prev: null, next: null });
  assert.match(html, /id="giscus-thread"/);
  assert.match(html, /src="\/js\/giscus\.js"/);
});

// ─── Tags 页面测试 ─────────────────────────────────────────────────────────────

test("renderTagsPage renders tag chips with correct links", () => {
  const tags = [
    { tag: "Java", tagEn: "Java", count: 3 },
    { tag: "Spring", tagEn: "Spring", count: 2 },
  ];
  const html = renderTagsPage(tags);

  assert.match(html, /class="tag-chip"/);
  assert.match(html, /\/post\/\?tag=Java/);
  assert.match(html, /\/post\/\?tag=Spring/);
  assert.match(html, />3</);
  assert.match(html, />2</);
});

test("renderTagsPage escapes special characters in tag names", () => {
  const tags = [{ tag: 'C++ <script>', tagEn: 'C++ <tag>', count: 1 }];
  const html = renderTagsPage(tags);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /C\+\+ &lt;script&gt;/);
});

test("renderTagsPage has proper page metadata", () => {
  const html = renderTagsPage([]);
  assert.match(html, /<title>标签 :: CWLBlog<\/title>/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /href="https:\/\/wenliang844\.github\.io\/tags\/"/);
});

// ─── Post List 测试 ────────────────────────────────────────────────────────────

test("renderPostList groups posts by year with correct counts", () => {
  const posts = [
    { slug: "a", shortTitle: "A", shortTitleEn: "A", title: "A", titleEn: "A", date: "2024-06-01", eyebrow: "项目", summary: "S", summaryEn: "S", tags: [], tagsEn: [], contentHtml: "<p>A</p>", contentHtmlEn: "", readMinutes: 1, images: [] },
    { slug: "b", shortTitle: "B", shortTitleEn: "B", title: "B", titleEn: "B", date: "2024-03-01", eyebrow: "项目", summary: "S", summaryEn: "S", tags: [], tagsEn: [], contentHtml: "<p>B</p>", contentHtmlEn: "", readMinutes: 1, images: [] },
    { slug: "c", shortTitle: "C", shortTitleEn: "C", title: "C", titleEn: "C", date: "2023-01-01", eyebrow: "项目", summary: "S", summaryEn: "S", tags: [], tagsEn: [], contentHtml: "<p>C</p>", contentHtmlEn: "", readMinutes: 1, images: [] },
  ];
  const stats = { count: 3, systems: 2, startYear: "2023", endYear: "2024", yearCount: 2, range: "2023-2024" };
  const html = renderPostList(posts, stats);

  assert.match(html, /class="post-tree"/);
  assert.match(html, /class="post-detail"/);
  assert.match(html, /2024/);
  assert.match(html, /2023/);
  assert.match(html, /3/); // count
  assert.match(html, /2023-2024/); // range
});

test("renderPostList renders search input and tag filter", () => {
  const posts = [
    { slug: "a", shortTitle: "A", shortTitleEn: "A", title: "A", titleEn: "A", date: "2024-01-01", eyebrow: "项目", summary: "S", summaryEn: "S", tags: ["Java"], tagsEn: ["Java"], contentHtml: "<p>A</p>", contentHtmlEn: "", readMinutes: 1, images: [] },
  ];
  const stats = { count: 1, systems: 1, startYear: "2024", endYear: "2024", yearCount: 1, range: "2024" };
  const html = renderPostList(posts, stats);

  assert.match(html, /id="post-search-input"/);
  assert.match(html, /id="tag-filter"/);
});
