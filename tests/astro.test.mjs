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

test("Astro owns the post routes while the sync boundary stays scoped", async () => {
  const packageJson = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const listRoute = await readFile(join(ROOT, "src", "pages", "post", "index.astro"), "utf8");
  const detailRoute = await readFile(join(ROOT, "src", "pages", "post", "[slug]", "index.astro"), "utf8");
  const sync = await readFile(join(ROOT, "scripts", "sync-astro-output.mjs"), "utf8");

  assert.match(packageJson.scripts.build, /build:content && npm run build:astro && npm run build:styles && npm run build:pwa && npm run build:csp && npm run build:search/);
  assert.equal(packageJson.scripts["check:astro"], "astro check");
  assert.match(listRoute, /getPublishedPosts/);
  assert.match(detailRoute, /getStaticPaths/);
  assert.match(detailRoute, /renderPostPage/);
  assert.match(sync, /"astro-dist", "post"/);
  assert.doesNotMatch(sync, /cp\([^,]+,\s*ROOT/);
});

test("sync and production validation require the Astro generation boundary", async () => {
  const sync = await readFile(join(ROOT, "scripts", "sync-astro-output.mjs"), "utf8");
  const production = await readFile(join(ROOT, "scripts", "validate-production.mjs"), "utf8");
  assert.match(sync, /Astro output marker missing/);
  assert.match(production, /文章路由缺少 Astro 生成标记/);
  assert.match(production, /Astro Content Collections/);
});
