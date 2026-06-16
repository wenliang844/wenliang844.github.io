import test from "node:test";
import assert from "node:assert/strict";

import { escapeAttr, escapeHtml } from "../src/lib/format.mjs";
import { renderPage } from "../src/templates/layout.mjs";
import { renderPostPage } from "../src/templates/post.mjs";
import { renderTagsPage } from "../src/templates/tags.mjs";

test("escape helpers protect text and attribute contexts", () => {
  assert.equal(escapeHtml(`<script>"x"&'y'</script>`), "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
  assert.equal(escapeAttr(`"x"&<y>`), "&quot;x&quot;&amp;&lt;y&gt;");
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

test("tags page escapes tag labels and i18n keys", () => {
  const html = renderTagsPage([{ tag: `bad"tag<script>`, tagEn: `Bad <Tag>`, count: 1 }]);
  assert.doesNotMatch(html, />bad"tag<script></);
  assert.match(html, /bad&quot;tag&lt;script&gt;/);
  assert.match(html, /data-i18n-en="Bad &lt;Tag&gt;"/);
});
