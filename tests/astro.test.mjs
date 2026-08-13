import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildPosts } from "../scripts/build.mjs";
import { CONTENT_CATEGORIES, CONTENT_SERIES } from "../src/config.mjs";

const ROOT = join(import.meta.dirname, "..");

function postData(overrides = {}) {
  return {
    title: "Astro collection post",
    shortTitle: "Astro post",
    date: "2026-08-07",
    category: "ai-coding",
    summary: "A deterministic content collection fixture.",
    description: "A deterministic content collection fixture for route migration.",
    tags: ["Astro"],
    ...overrides,
  };
}

test("Astro content bridge keeps drafts out of the shared post domain", async () => {
  const posts = await buildPosts([
    { file: "published.md", data: postData({ slug: "published" }), content: "## Published\n\nVisible body." },
    { file: "draft.md", data: postData({ slug: "draft", draft: true }), content: "## Draft\n\nHidden body." },
  ]);

  assert.deepEqual(posts.map((post) => post.slug), ["published"]);
  assert.match(posts[0].contentHtml, /Visible body/);
  assert.equal(posts[0].contentMarkdown, "## Published\n\nVisible body.");
});

test("Astro collection schema covers every configured category and series", async () => {
  const schema = await readFile(join(ROOT, "src", "content.config.ts"), "utf8");
  for (const id of Object.keys(CONTENT_CATEGORIES)) assert.match(schema, new RegExp(`"${id}"`));
  for (const id of Object.keys(CONTENT_SERIES)) assert.match(schema, new RegExp(`"${id}"`));
  assert.match(schema, /Series posts require a positive order/);
  assert.match(schema, /Cover images require accessible alternative text/);
});

test("Astro owns content routes while the sync boundary stays scoped", async () => {
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const listRoute = await readFile(join(ROOT, "src", "pages", "post", "index.astro"), "utf8");
  const detailRoute = await readFile(join(ROOT, "src", "pages", "post", "[slug]", "index.astro"), "utf8");
  const contentRoutes = [
    ["tags", "index.astro"],
    ["categories", "index.astro"],
    ["categories", "[category]", "index.astro"],
    ["series", "index.astro"],
    ["series", "[series]", "index.astro"],
    ["knowledge", "index.astro"],
  ];
  const layout = await readFile(join(ROOT, "src", "layouts", "BaseLayout.astro"), "utf8");
  const sync = await readFile(join(ROOT, "scripts", "sync-astro-output.mjs"), "utf8");

  assert.match(packageJson.scripts.build, /build:content && npm run build:astro && npm run build:styles && npm run build:pwa && npm run build:csp && npm run build:search/);
  assert.equal(packageJson.scripts["build:content"], "node scripts/build.mjs --skip-astro-html");
  assert.equal(packageJson.scripts["check:astro"], "astro check");
  assert.match(listRoute, /getPublishedPosts/);
  assert.match(detailRoute, /getStaticPaths/);
  assert.match(listRoute, /BaseLayout/);
  assert.match(detailRoute, /BaseLayout/);
  assert.match(listRoute, /PostListPage/);
  assert.doesNotMatch(listRoute, /TrustedHtmlContent/);
  assert.match(detailRoute, /buildPostPageMetadata/);
  assert.match(detailRoute, /ArticlePage/);
  assert.doesNotMatch(detailRoute, /TrustedHtmlContent/);
  assert.doesNotMatch(listRoute, /set:html=\{html\}/);
  assert.doesNotMatch(detailRoute, /set:html=\{html\}/);
  for (const segments of contentRoutes) {
    const route = await readFile(join(ROOT, "src", "pages", ...segments), "utf8");
    assert.match(route, /BaseLayout/);
    assert.doesNotMatch(route, /set:html=\{html\}/);
  }
  assert.match(layout, /Astro Content Collections/);
  assert.match(layout, /SiteHeader/);
  assert.match(layout, /SiteFooter/);
  assert.match(layout, /<slot \/>/);
  assert.doesNotMatch(layout, /set:html=\{main\}/);
  const header = await readFile(join(ROOT, "src", "components", "SiteHeader.astro"), "utf8");
  assert.match(header, /data-i18n-html=\{item\.html \? "" : undefined\}/);
  assert.doesNotMatch(header, /data-i18n-html=\{item\.html \? true/);
  assert.match(sync, /const ROUTE_ROOTS = \["post", "categories", "series", "tags", "knowledge"\]/);
  assert.match(sync, /const ASSET_ROOT = "_astro"/);
  assert.match(sync, /rm\(assetDestination, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(sync, /cp\([^,]+,\s*ROOT/);
  await assert.rejects(
    readFile(join(ROOT, "src", "components", "TrustedHtmlContent.astro"), "utf8"),
    { code: "ENOENT" },
  );
});

test("article routes keep HTML injection limited to rendered Markdown", async () => {
  const article = await readFile(join(ROOT, "src", "components", "ArticlePage.astro"), "utf8");
  const markdown = await readFile(join(ROOT, "src", "components", "MarkdownContent.astro"), "utf8");
  const layout = await readFile(join(ROOT, "src", "layouts", "BaseLayout.astro"), "utf8");

  assert.match(article, /MarkdownContent/);
  assert.match(article, /data-pagefind-body/);
  assert.match(article, /class="toc-sidebar is-collapsed"/);
  assert.match(article, /id="giscus-thread"/);
  assert.match(article, /initArticleToc/);
  assert.match(article, /initPostExtras/);
  assert.match(layout, /initSiteRuntime/);
  assert.match(layout, /src !== compatibilityRuntime/);
  assert.match(article, /class="post-related"/);
  assert.match(article, /class="post-pager"/);
  assert.doesNotMatch(article, /set:html|TrustedHtmlContent/);
  assert.match(markdown, /set:html=\{renderedHtml\}/);
  assert.match(markdown, /headingIdPrefix/);
  assert.doesNotMatch(markdown, /searchableMain/);
});

test("post list uses native panels with isolated Markdown heading ids", async () => {
  const list = await readFile(join(ROOT, "src", "components", "PostListPage.astro"), "utf8");
  const panel = await readFile(join(ROOT, "src", "components", "PostPanel.astro"), "utf8");
  const share = await readFile(join(ROOT, "src", "components", "PostShare.astro"), "utf8");

  assert.match(list, /PostPanel/);
  assert.match(list, /class="post-tree"/);
  assert.match(list, /data-post-target/);
  assert.match(list, /data-giscus-mode="switch"/);
  assert.match(list, /initPostList/);
  assert.match(list, /initPostExtras/);
  assert.match(panel, /class:list=\{\["article", "blog-article"/);
  assert.match(panel, /headingIdPrefix/);
  assert.match(panel, /PostShare/);
  assert.doesNotMatch(list, /set:html|TrustedHtmlContent/);
  assert.doesNotMatch(panel, /set:html|TrustedHtmlContent/);
  assert.doesNotMatch(share, /set:html/);
  for (const removedScript of ["blog.js", "toc.js", "post-extras-loader.js", "share.js", "giscus.js", "post-next.js", "highlight-loader.js"]) {
    await assert.rejects(readFile(join(ROOT, "js", removedScript), "utf8"), { code: "ENOENT" });
  }
});

test("aggregate content routes render structured Astro components without HTML injection", async () => {
  const routes = [
    ["categories", "index.astro", "CategoriesPage"],
    ["categories", "[category]", "index.astro", "TaxonomyDetailPage"],
    ["series", "index.astro", "SeriesIndexPage"],
    ["series", "[series]", "index.astro", "TaxonomyDetailPage"],
    ["tags", "index.astro", "TagsPage"],
    ["knowledge", "index.astro", "KnowledgePage"],
  ];
  for (const route of routes) {
    const component = route.pop();
    const source = await readFile(join(ROOT, "src", "pages", ...route), "utf8");
    assert.match(source, new RegExp(component));
    assert.doesNotMatch(source, /TrustedHtmlContent|set:html/);
  }

  for (const component of ["CategoriesPage", "TaxonomyDetailPage", "SeriesIndexPage", "TagsPage", "KnowledgePage"]) {
    const source = await readFile(join(ROOT, "src", "components", `${component}.astro`), "utf8");
    assert.match(source, /<main[^>]+data-pagefind-body/);
    assert.doesNotMatch(source, /set:html/);
  }
});

test("sync and production validation require the Astro generation boundary", async () => {
  const sync = await readFile(join(ROOT, "scripts", "sync-astro-output.mjs"), "utf8");
  const production = await readFile(join(ROOT, "scripts", "validate-production.mjs"), "utf8");
  assert.match(sync, /Astro output marker missing/);
  assert.match(production, /astroPages = \['post\/index\.html', 'categories\/index\.html', 'series\/index\.html', 'tags\/index\.html', 'knowledge\/index\.html'\]/);
  assert.match(production, /Astro Content Collections/);
});
