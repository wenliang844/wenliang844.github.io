import test from "node:test";
import assert from "node:assert/strict";

import { escapeAttr, escapeHtml, escapeXml } from "../src/lib/format.mjs";
import { renderPage } from "../src/templates/layout.mjs";
import { renderPostPage } from "../src/templates/post.mjs";
import { renderTagsPage } from "../src/templates/tags.mjs";

test("escape helpers protect text and attribute contexts", () => {
  assert.equal(escapeHtml(`<script>"x"&'y'</script>`), "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
  assert.equal(escapeAttr(`"x"&<y>`), "&quot;x&quot;&amp;&lt;y&gt;");
  assert.equal(escapeXml(`<title>"x"&'y'</title>`), "&lt;title&gt;&quot;x&quot;&amp;&apos;y&apos;&lt;/title&gt;");
});

test("layout escapes title and metadata", () => {
  const html = renderPage({
    title: `Unsafe <title>`,
    description: `bad "description" <tag>`,
    active: "",
    scripts: [],
    bodyClass: "colorscheme-dark",
    page: "",
    main: "<main></main>",
    og: {
      title: `OG <title>`,
      description: `OG "desc" <tag>`,
      path: "/test/",
    },
  });

  assert.match(html, /<title>Unsafe &lt;title&gt;<\/title>/);
  assert.match(html, /<meta name="description" content="bad &quot;description&quot; &lt;tag&gt;">/);
  assert.match(html, /property="og:title" content="OG &lt;title&gt;"/);
  assert.match(html, /href="\/tools\/" data-i18n="nav.tools">工具箱<\/a>/);
  assert.match(html, /class="nav-search-trigger" type="button" aria-label="全局搜索（Ctrl\+K 或 \/）" title="全局搜索（Ctrl\+K 或 \/）" data-i18n-aria="nav.searchHint" data-i18n-title="nav.searchHint"/);
  assert.match(html, /class="nav-ai-experience assistant-nav-trigger" type="button" aria-label="打开 AI 助手" title="打开 AI 助手" data-assistant-toggle data-i18n-aria="assistant.open" data-i18n-title="assistant.open"/);
  assert.doesNotMatch(html, /href="\/\?assistant=fullscreen"/);
  assert.match(html, /src="\/js\/assistant\.js"/);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /frame-src https:\/\/giscus\.app/);
  assert.match(html, /connect-src 'self' https:/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/giscus\.app">/);
  assert.match(html, /<link rel="dns-prefetch" href="https:\/\/giscus\.app">/);
  assert.match(html, /<link rel="preconnect" href="https:\/\/buttondown\.com">/);
  assert.match(html, /<link rel="dns-prefetch" href="https:\/\/buttondown\.com">/);
  assert.match(html, /<link rel="dns-prefetch" href="https:\/\/www\.ifdian\.net">/);
  assert.match(html, /<link rel="dns-prefetch" href="https:\/\/paypal\.me">/);
  assert.match(html, /<label class="menu-overlay" for="menu-toggle" aria-hidden="true"><\/label>/);
});

test("layout deduplicates core and page scripts", () => {
  const html = renderPage({
    title: "Scripts",
    description: "Script test",
    active: "",
    scripts: ["/js/utils.js", "/js/tools.js", "/js/tools.js"],
    bodyClass: "colorscheme-dark",
    page: "",
    main: "<main></main>",
  });

  assert.equal((html.match(/src="\/js\/utils\.js"/g) || []).length, 1);
  assert.equal((html.match(/src="\/js\/tools\.js"/g) || []).length, 1);
  assert.match(html, /src="\/js\/assistant\.js"/);
});

test("post template escapes front matter text while preserving article HTML", () => {
  const post = {
    title: `Title <img src=x onerror=alert(1)>`,
    titleEn: `English <Title>`,
    shortTitle: `Short <b>`,
    shortTitleEn: `Short EN`,
    slug: "safe-post",
    date: "2026-06-16",
    eyebrow: `Eye <script>`,
    summary: `Summary "quote" <script>`,
    summaryEn: `Summary EN`,
    description: `Desc <meta>`,
    descriptionEn: `Desc EN`,
    tags: [`Java <script>`],
    tagsEn: [`Java`],
    contentHtml: `          <p><strong>trusted markdown html</strong></p>`,
    contentHtmlEn: "",
  };

  const html = renderPostPage(post, { prev: null, next: null });
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
  assert.match(html, /Title &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /Summary &quot;quote&quot; &lt;script&gt;/);
  assert.match(html, /Java &lt;script&gt;/);
  assert.match(html, /<strong>trusted markdown html<\/strong>/);
});

test("post template renders next popup, related posts, bilingual body and JSON-LD images", () => {
  const post = {
    title: "Current Post",
    titleEn: "Current Post EN",
    shortTitle: "Current",
    shortTitleEn: "Current EN",
    slug: "current-post",
    date: "2026-06-16",
    eyebrow: "Case Study",
    summary: "Summary",
    summaryEn: "Summary EN",
    description: "Description",
    descriptionEn: "Description EN",
    tags: ["Java"],
    tagsEn: ["Java"],
    cover: "/images/posts/current-post.png",
    images: ["/images/favicon.png", "./cover.png", "https://example.com/remote.png"],
    readMinutes: 3,
    contentHtml: "          <p>中文正文</p>",
    contentHtmlEn: "          <p>English body</p>",
  };
  const next = {
    ...post,
    title: "Next Post",
    shortTitle: "Next",
    slug: "next-post",
    date: "2026-01-01",
    eyebrow: "Next",
  };
  const prev = {
    ...post,
    title: "Previous Post",
    shortTitle: "Previous",
    slug: "previous-post",
    date: "2026-06-17",
    eyebrow: "Previous",
  };
  const related = [{
    ...post,
    title: "Related Post",
    shortTitle: "Related",
    slug: "related-post",
    date: "2025-01-01",
    eyebrow: "Related",
  }];

  const html = renderPostPage(post, { prev, next, related });

  assert.match(html, /<span data-i18n="dyn\.readingPrefix">约<\/span> 3 <span data-i18n="dyn\.readingSuffix">分钟<\/span>/);
  assert.match(html, /src="\/js\/post-next\.js"/);
  assert.match(html, /class="next-popup"/);
  assert.match(html, /data-next-url="\/post\/next-post\/"/);
  assert.match(html, /data-prev-url="\/post\/previous-post\/"/);
  assert.match(html, /href="\/post\/next-post\/"/);
  assert.match(html, /class="post-related"/);
  assert.match(html, /href="\/post\/related-post\/"/);
  assert.match(html, /data-i18n-lang="en" hidden/);
  assert.match(html, /<script type="application\/ld\+json">/);
  assert.match(html, /property="og:image" content="https:\/\/wenliang844\.github\.io\/images\/posts\/current-post\.png"/);
  assert.match(html, /name="twitter:image" content="https:\/\/wenliang844\.github\.io\/images\/posts\/current-post\.png"/);
  assert.match(html, /https:\/\/wenliang844\.github\.io\/images\/favicon\.png/);
  assert.match(html, /https:\/\/wenliang844\.github\.io\/post\/current-post\/cover\.png/);
  assert.match(html, /https:\/\/example\.com\/remote\.png/);
});

test("tags page escapes tag labels and i18n keys", () => {
  const html = renderTagsPage([{ tag: `bad"tag<script>`, tagEn: `Bad <Tag>`, count: 1 }]);
  assert.doesNotMatch(html, />bad"tag<script></);
  assert.match(html, /bad&quot;tag&lt;script&gt;/);
  assert.match(html, /data-i18n-en="Bad &lt;Tag&gt;"/);
});
