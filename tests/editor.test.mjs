// Deep test: editor.js — Markdown editor, formatting, state, download
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

const EDITOR_HTML = `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <input type="text" id="post-title" value="">
  <input type="text" id="post-short-title" value="">
  <input type="text" id="post-slug" value="">
  <input type="date" id="post-date" value="">
  <select id="post-category"><option value="ai-coding">AI</option><option value="ai-systems">AI Systems</option></select>
  <select id="post-series"><option value="">None</option><option value="intelligent-analysis">Intelligent Analysis</option></select>
  <input type="number" id="post-series-order" value="1">
  <input type="text" id="post-summary" value="">
  <input type="text" id="post-description" value="">
  <input type="text" id="post-tags" value="">
  <input type="checkbox" id="post-draft">
  <select id="draft-select"></select>
  <span id="draft-save-status"></span>
  <textarea id="markdown-input"></textarea>
  <div id="markdown-preview"></div>
  <span id="editor-stats"></span>
  <button class="tool-btn" data-md="bold"><b>B</b></button>
  <button class="tool-btn" data-md="italic"><i>I</i></button>
  <button class="tool-btn" data-md="code">Code</button>
  <button class="tool-btn" data-md="heading">H</button>
  <button class="tool-btn" data-md="quote">Quote</button>
  <button class="tool-btn" data-md="ul">UL</button>
  <button class="tool-btn" data-md="ol">OL</button>
  <button class="tool-btn" data-md="link">Link</button>
  <button class="tool-btn" data-md="image">Image</button>
  <button class="tool-btn" data-md="codeblock">Code Block</button>
  <button class="tool-btn" data-md="table">Table</button>
  <button data-action="new">New</button>
  <button data-action="sample">Sample</button>
  <button data-action="copy-html">Copy HTML</button>
  <button data-action="download-md">Download MD</button>
  <button data-action="download-html">Download HTML</button>
  <button data-action="delete-draft">Delete draft</button>
</body></html>`;

async function loadEditor(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const editorCode = await readFile(join(ROOT, "js", "editor.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(editorCode);
  return dom;
}

// ─── Initial load ─────────────────────────────────────────────────────────

test("editor.js loads with sample content", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  assert.ok(document.getElementById("post-title").value.length > 0, "title should be pre-filled");
  assert.ok(document.getElementById("post-short-title").value.length > 0, "short title should be pre-filled");
  assert.ok(document.getElementById("post-slug").value.length > 0, "slug should be pre-filled");
  assert.ok(document.getElementById("post-date").value.match(/^\d{4}-\d{2}-\d{2}$/), "date should be YYYY-MM-DD");
  assert.ok(document.getElementById("post-summary").value.length > 0, "summary should be pre-filled");
  assert.ok(document.getElementById("post-description").value.length > 0, "description should be pre-filled");
  assert.ok(document.getElementById("markdown-input").value.length > 0, "markdown should be pre-filled");
  assert.ok(document.getElementById("markdown-preview").innerHTML.length > 0, "preview should have content");
  dom.window.close();
});

test("editor.js stats use shared CWLUtils readingMinutes", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "中".repeat(700);
  textarea.dispatchEvent(new dom.window.Event("input"));

  assert.match(document.getElementById("editor-stats").textContent, /2/);
  dom.window.close();
});

// ─── Auto slugify ─────────────────────────────────────────────────────────

test("editor.js auto-generates slug from title", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const titleInput = document.getElementById("post-title");
  const slugInput = document.getElementById("post-slug");

  // Simulate typing a title
  titleInput.value = "My New Blog Post!";
  titleInput.dispatchEvent(new dom.window.Event("input"));

  assert.equal(slugInput.value, "my-new-blog-post", "slug should be auto-generated, trailing hyphens stripped");
  dom.window.close();
});

// ─── Bold formatting ──────────────────────────────────────────────────────

test("editor.js bold button wraps selection with **", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "Hello World";
  textarea.selectionStart = 0;
  textarea.selectionEnd = 5;

  document.querySelector('[data-md="bold"]').click();

  assert.ok(textarea.value.includes("**Hello**"), "should wrap selection with **");
  dom.window.close();
});

// ─── Italic formatting ────────────────────────────────────────────────────

test("editor.js italic button wraps selection with *", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "Hello World";
  textarea.selectionStart = 0;
  textarea.selectionEnd = 5;

  document.querySelector('[data-md="italic"]').click();

  assert.ok(textarea.value.includes("*Hello*"), "should wrap selection with *");
  dom.window.close();
});

// ─── Code formatting ──────────────────────────────────────────────────────

test("editor.js code button wraps selection with backticks", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "console.log";
  textarea.selectionStart = 0;
  textarea.selectionEnd = 11;

  document.querySelector('[data-md="code"]').click();

  assert.ok(textarea.value.includes("`console.log`"), "should wrap selection with backticks");
  dom.window.close();
});

// ─── Heading formatting ───────────────────────────────────────────────────

test("editor.js heading button prefixes line with ##", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "My Title";
  textarea.selectionStart = 0;
  textarea.selectionEnd = 8;

  document.querySelector('[data-md="heading"]').click();

  assert.ok(textarea.value.startsWith("## My Title"), "should prefix with ## ");
  dom.window.close();
});

// ─── Quote formatting ─────────────────────────────────────────────────────

test("editor.js quote button prefixes lines with >", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "quoted text";
  textarea.selectionStart = 0;
  textarea.selectionEnd = 11;

  document.querySelector('[data-md="quote"]').click();

  assert.ok(textarea.value.startsWith("> quoted text"), "should prefix with > ");
  dom.window.close();
});

// ─── Link formatting ──────────────────────────────────────────────────────

test("editor.js link button inserts markdown link", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "Click ";
  textarea.selectionStart = 6;
  textarea.selectionEnd = 6;

  document.querySelector('[data-md="link"]').click();

  assert.ok(textarea.value.includes("["), "should insert link markdown");
  assert.ok(textarea.value.includes("](https://)"), "should include URL placeholder");
  dom.window.close();
});

// ─── Image formatting ─────────────────────────────────────────────────────

test("editor.js image button inserts markdown image", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "";
  textarea.selectionStart = 0;
  textarea.selectionEnd = 0;

  document.querySelector('[data-md="image"]').click();

  assert.ok(textarea.value.includes("!["), "should insert image markdown");
  assert.ok(textarea.value.includes("](https://)"), "should include URL placeholder");
  dom.window.close();
});

// ─── Code block formatting ────────────────────────────────────────────────

test("editor.js codeblock button wraps selection in fenced code block", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "code here";
  textarea.selectionStart = 0;
  textarea.selectionEnd = 9;

  document.querySelector('[data-md="codeblock"]').click();

  assert.ok(textarea.value.includes("```\ncode here\n```"), "should wrap in fenced code block");
  dom.window.close();
});

// ─── Table formatting ─────────────────────────────────────────────────────

test("editor.js table button inserts a markdown table", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  textarea.value = "";
  textarea.selectionStart = 0;
  textarea.selectionEnd = 0;

  document.querySelector('[data-md="table"]').click();

  assert.ok(textarea.value.includes("|"), "should contain table pipes");
  assert.ok(textarea.value.includes("---"), "should contain separator");
  dom.window.close();
});

// ─── Preview updates on input ─────────────────────────────────────────────

test("editor.js preview updates when markdown input changes", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const textarea = document.getElementById("markdown-input");
  const preview = document.getElementById("markdown-preview");

  textarea.value = "# Hello\n\nSome **bold** text.";
  textarea.dispatchEvent(new dom.window.Event("input"));

  // Wait for debounce (editor uses 150ms debounce)
  await new Promise((r) => dom.window.setTimeout(r, 300));

  // Preview uses marked if available, otherwise falls back to <pre> with escaping
  const html = preview.innerHTML;
  if (html.includes("<h1")) {
    // marked was available
    assert.ok(html.includes("<h1"), "preview should contain h1");
    assert.ok(html.includes("<strong>bold</strong>"), "preview should contain bold");
  } else {
    // Fallback: text rendered inside <pre> with escaped HTML
    assert.ok(html.includes("Hello"), "preview should contain the text");
    assert.ok(html.length > 10, "preview should have rendered content");
  }
  dom.window.close();
});

test("editor.js highlights rendered code blocks without deprecated marked highlight option", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  const setOptionsCalls = [];
  const highlighted = [];
  dom.window.marked = {
    setOptions(options) {
      setOptionsCalls.push(options);
    },
    parse() {
      return '<pre><code class="language-js">const x = 1;</code></pre>';
    },
  };
  dom.window.hljs = {
    highlightElement(block) {
      highlighted.push(block);
      block.classList.add("hljs");
    },
  };

  await loadEditor(dom);

  assert.equal(setOptionsCalls.length, 1);
  assert.equal(setOptionsCalls[0].gfm, true);
  assert.equal(setOptionsCalls[0].breaks, true);
  assert.equal(Object.hasOwn(setOptionsCalls[0], "highlight"), false);
  assert.equal(highlighted.length, 1);
  assert.equal(highlighted[0].dataset.highlighted, "yes");
  assert.ok(dom.window.document.getElementById("markdown-preview").querySelector("code.hljs"));
  dom.window.close();
});

// ─── Stats display ────────────────────────────────────────────────────────

test("editor.js stats shows word and character count", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const stats = document.getElementById("editor-stats");
  assert.ok(stats.textContent.length > 0, "stats should have text");
  assert.ok(stats.textContent.includes("词") || stats.textContent.includes("word"), "stats should show word count");
  dom.window.close();
});

// ─── New action ───────────────────────────────────────────────────────────

test("editor.js new action clears all fields", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  document.querySelector('[data-action="new"]').click();

  assert.equal(document.getElementById("post-title").value, "");
  assert.equal(document.getElementById("post-short-title").value, "");
  assert.equal(document.getElementById("post-slug").value, "");
  assert.equal(document.getElementById("post-summary").value, "");
  assert.equal(document.getElementById("post-description").value, "");
  assert.equal(document.getElementById("markdown-input").value, "");
  assert.ok(document.getElementById("post-date").value.match(/^\d{4}-\d{2}-\d{2}$/), "date should be set to today");
  dom.window.close();
});

// ─── Sample action ────────────────────────────────────────────────────────

test("editor.js sample action loads sample content", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  // First clear
  document.querySelector('[data-action="new"]').click();
  assert.equal(document.getElementById("post-title").value, "");

  // Then load sample
  document.querySelector('[data-action="sample"]').click();
  assert.ok(document.getElementById("post-title").value.length > 0, "title should be filled");
  assert.ok(document.getElementById("post-short-title").value.length > 0, "short title should be filled");
  assert.ok(document.getElementById("post-summary").value.length > 0, "summary should be filled");
  assert.ok(document.getElementById("post-description").value.length > 0, "description should be filled");
  assert.ok(document.getElementById("markdown-input").value.includes("```"), "sample should contain code block");
  dom.window.close();
});

// ─── Front matter generation ──────────────────────────────────────────────

test("editor.js generates proper front matter", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;

  const blobs = [];
  dom.window.URL.createObjectURL = function (blob) {
    blobs.push(blob);
    return "blob:test";
  };
  dom.window.URL.revokeObjectURL = function () {};
  dom.window.HTMLAnchorElement.prototype.click = function () {};
  document.getElementById("post-title").value = 'My "Great" Post';
  document.getElementById("post-short-title").value = "Great Post";
  document.getElementById("post-summary").value = "Short summary";
  document.getElementById("post-description").value = "Search description";
  document.getElementById("post-tags").value = "Java, GitHub, Java";
  document.getElementById("post-category").value = "ai-systems";
  document.getElementById("post-series").value = "intelligent-analysis";
  document.getElementById("post-series-order").value = "2";
  document.getElementById("markdown-input").value = "# Body";
  document.getElementById("post-draft").checked = false;

  document.querySelector('[data-action="download-md"]').click();
  const markdown = await new Promise((resolve, reject) => {
    const reader = new dom.window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blobs[0]);
  });

  assert.match(markdown, /title: "My \\"Great\\" Post"/);
  assert.match(markdown, /shortTitle: "Great Post"/);
  assert.match(markdown, /slug: "post-\d{8}"/);
  assert.match(markdown, /modified: \d{4}-\d{2}-\d{2}/);
  assert.match(markdown, /category: "ai-systems"/);
  assert.match(markdown, /series: "intelligent-analysis"/);
  assert.match(markdown, /order: 2/);
  assert.match(markdown, /summary: "Short summary"/);
  assert.match(markdown, /description: "Search description"/);
  assert.match(markdown, /draft: false/);
  assert.match(markdown, /tags: \["Java", "GitHub"\]/);
  dom.window.close();
});

test("editor.js exports draft true when the draft switch is enabled", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;
  const blobs = [];
  dom.window.URL.createObjectURL = function (blob) {
    blobs.push(blob);
    return "blob:test";
  };
  dom.window.URL.revokeObjectURL = function () {};
  dom.window.HTMLAnchorElement.prototype.click = function () {};

  document.getElementById("post-draft").checked = true;
  document.querySelector('[data-action="download-md"]').click();
  const markdown = await new Promise((resolve, reject) => {
    const reader = new dom.window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blobs[0]);
  });

  assert.match(markdown, /draft: true/);
  dom.window.close();
});

test("editor.js keeps multiple drafts and switches between them without IndexedDB", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document, Event } = dom.window;
  await new Promise((resolve) => setTimeout(resolve, 0));

  const firstId = document.getElementById("draft-select").value;
  const title = document.getElementById("post-title");
  title.value = "First draft";
  title.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 180));

  document.querySelector('[data-action="new"]').click();
  title.value = "Second draft";
  title.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 180));

  const selector = document.getElementById("draft-select");
  assert.equal(selector.options.length, 2);
  selector.value = firstId;
  selector.dispatchEvent(new Event("change", { bubbles: true }));
  assert.equal(title.value, "First draft");
  assert.equal(JSON.parse(dom.window.localStorage.getItem("wenliang-markdown-editor-drafts")).length, 2);
  dom.window.close();
});

test("editor.js deletes the selected draft and loads the remaining draft", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  dom.window.confirm = () => true;
  await loadEditor(dom);
  const { document } = dom.window;
  await new Promise((resolve) => setTimeout(resolve, 0));

  document.querySelector('[data-action="new"]').click();
  assert.equal(document.getElementById("draft-select").options.length, 2);
  document.querySelector('[data-action="delete-draft"]').click();
  assert.equal(document.getElementById("draft-select").options.length, 1);
  assert.ok(document.getElementById("post-title").value.length > 0);
  dom.window.close();
});

test("editor.js delegates HTML copy fallback to CWLUtils.copyText", async () => {
  const dom = new JSDOM(EDITOR_HTML, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  await loadEditor(dom);
  const { document } = dom.window;
  const copied = [];
  dom.window.CWLUtils.copyText = async function (text) {
    copied.push(text);
    return true;
  };
  document.getElementById("markdown-preview").innerHTML = "<p>Rendered</p>";

  document.querySelector('[data-action="copy-html"]').click();
  await Promise.resolve();

  assert.deepEqual(copied, ["<p>Rendered</p>"]);
  dom.window.close();
});

test("editor.js creates an authenticated publish PR without persisting CSRF data", async () => {
  const publishHtml = EDITOR_HTML
    .replace("<body", '<head><meta name="cwl-api-base" content="https://api.example.com"></head><body')
    .replace("</body>", `
      <div id="editor-publish-panel">
        <span id="editor-publish-status"></span>
        <span id="editor-ci-status" hidden></span>
        <button data-action="connect-github">Connect</button>
        <button data-action="publish-pr" disabled>Publish</button>
        <button data-action="logout-github" hidden>Logout</button>
        <a id="editor-pr-link" hidden></a>
        <a id="editor-preview-link" hidden></a>
      </div>
    </body>`);
  const dom = new JSDOM(publishHtml, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  const requests = [];
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith("/api/v1/auth/session")) {
      return { ok: true, json: async () => ({ authenticated: true, login: "owner", csrfToken: "session-csrf-token" }) };
    }
    if (url.endsWith("/api/v1/admin/publish")) {
      return {
        ok: true,
        json: async () => ({
          prUrl: "https://github.com/owner/repository/pull/42",
          previewUrl: "https://preview.example.com/42",
          pullNumber: 42,
        }),
      };
    }
    if (url.endsWith("/api/v1/admin/publish/status?pr=42")) {
      return {
        ok: true,
        json: async () => ({
          pullNumber: 42,
          state: "success",
          checks: { total: 2, completed: 2, failed: 0, items: [] },
        }),
      };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  await loadEditor(dom);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const publish = dom.window.document.querySelector('[data-action="publish-pr"]');
  assert.equal(publish.disabled, false);
  publish.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(requests.length, 3);
  assert.equal(requests[1].options.credentials, "include");
  assert.equal(requests[1].options.headers["x-csrf-token"], "session-csrf-token");
  const payload = JSON.parse(requests[1].options.body);
  assert.ok(Array.isArray(payload.tags));
  assert.match(dom.window.document.getElementById("editor-publish-status").textContent, /已创建/);
  assert.match(dom.window.document.getElementById("editor-ci-status").textContent, /CI 已通过/);
  assert.equal(dom.window.document.getElementById("editor-pr-link").href, "https://github.com/owner/repository/pull/42");
  const stored = Array.from({ length: dom.window.localStorage.length }, (_, index) => {
    const key = dom.window.localStorage.key(index);
    return dom.window.localStorage.getItem(key);
  }).join("\n");
  assert.doesNotMatch(stored, /session-csrf-token/);
  dom.window.close();
});

test("editor.js uploads a validated cover through an in-memory grant", async () => {
  const uploadHtml = EDITOR_HTML
    .replace("<body", '<head><meta name="cwl-api-base" content="https://api.example.com"></head><body')
    .replace("</body>", `
      <input id="post-cover" type="text">
      <input id="post-cover-alt" type="text">
      <input id="post-cover-file" type="file">
      <span id="editor-asset-upload-status"></span>
      <div id="editor-publish-panel">
        <span id="editor-publish-status"></span>
        <button data-action="connect-github">Connect</button>
        <button data-action="publish-pr" disabled>Publish</button>
        <button data-action="upload-cover" disabled>Upload</button>
        <button data-action="logout-github" hidden>Logout</button>
      </div>
    </body>`);
  const dom = new JSDOM(uploadHtml, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  const requests = [];
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith("/api/v1/auth/session")) {
      return { ok: true, json: async () => ({ login: "owner", csrfToken: "asset-csrf" }) };
    }
    if (url.endsWith("/api/v1/admin/assets/presign")) {
      return {
        ok: true,
        json: async () => ({
          uploadUrl: "https://api.example.com/api/v1/admin/assets/upload/images/uploads/cover.png",
          publicUrl: "https://assets.example.com/images/uploads/cover.png",
          headers: { "content-type": "image/png", "x-upload-token": "ephemeral-upload-grant" },
        }),
      };
    }
    if (url.includes("/api/v1/admin/assets/upload/")) {
      return {
        ok: true,
        json: async () => ({ publicUrl: "https://assets.example.com/images/uploads/cover.png", width: 1200, height: 630 }),
      };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  await loadEditor(dom);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const fileInput = dom.window.document.getElementById("post-cover-file");
  const file = new dom.window.File([new Uint8Array(24)], "cover.png", { type: "image/png" });
  Object.defineProperty(fileInput, "files", { configurable: true, value: [file] });
  fileInput.dispatchEvent(new dom.window.Event("change"));
  const upload = dom.window.document.querySelector('[data-action="upload-cover"]');
  assert.equal(upload.disabled, false);
  upload.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(requests.length, 3);
  assert.equal(requests[1].options.headers["x-csrf-token"], "asset-csrf");
  assert.equal(requests[2].options.credentials, "omit");
  assert.equal(requests[2].options.headers["x-upload-token"], "ephemeral-upload-grant");
  assert.equal(dom.window.document.getElementById("post-cover").value, "https://assets.example.com/images/uploads/cover.png");
  assert.match(dom.window.document.getElementById("editor-asset-upload-status").textContent, /1200×630/);
  const stored = Array.from({ length: dom.window.localStorage.length }, (_, index) => {
    const key = dom.window.localStorage.key(index);
    return dom.window.localStorage.getItem(key);
  }).join("\n");
  assert.doesNotMatch(stored, /asset-csrf|ephemeral-upload-grant/);
  dom.window.close();
});

test("editor.js browses, filters and reuses authenticated media without unsafe rendering", async () => {
  const html = EDITOR_HTML
    .replace("<body", '<head><meta name="cwl-api-base" content="https://api.example.com"></head><body')
    .replace("</body>", `
      <input id="post-cover" type="text">
      <input id="post-cover-alt" type="text">
      <input id="post-cover-file" type="file">
      <span id="editor-asset-upload-status"></span>
      <div id="editor-publish-panel">
        <span id="editor-publish-status"></span>
        <button data-action="connect-github">Connect</button>
        <button data-action="publish-pr" disabled>Publish</button>
        <button data-action="upload-cover" disabled>Upload</button>
        <button data-action="open-media-library" disabled>Media</button>
        <button data-action="logout-github" hidden>Logout</button>
      </div>
      <dialog id="editor-media-library" hidden>
        <button data-action="close-media-library">Close</button>
        <input id="editor-media-search" type="search">
        <p id="editor-media-status"></p>
        <div id="editor-media-grid"></div>
        <button id="editor-media-more" data-action="load-more-media" hidden>More</button>
      </dialog>
    </body>`);
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  const requests = [];
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith("/api/v1/auth/session")) {
      return { ok: true, json: async () => ({ login: "owner", csrfToken: "media-csrf" }) };
    }
    if (url.includes("/api/v1/admin/assets?limit=24&cursor=")) {
      return {
        ok: true,
        json: async () => ({
          assets: [{
            objectKey: "images/uploads/2026/07/older.jpeg",
            publicUrl: "https://assets.example.com/images/uploads/2026/07/older.jpeg",
            mime: "image/jpeg",
            bytes: 4096,
            width: 800,
            height: 450,
          }],
          cursor: "",
        }),
      };
    }
    if (url.endsWith("/api/v1/admin/assets?limit=24")) {
      return {
        ok: true,
        json: async () => ({
          assets: [
            {
              objectKey: "images/uploads/2026/08/new.webp",
              publicUrl: "https://assets.example.com/images/uploads/2026/08/new.webp",
              mime: "image/webp",
              bytes: 2048,
              width: 1600,
              height: 900,
            },
            {
              objectKey: "images/uploads/2026/08/<svg onload=alert(1)>.png",
              publicUrl: "https://assets.example.com/images/uploads/2026/08/safe.png",
              mime: "image/png",
              bytes: 1024,
              width: 1200,
              height: 630,
            },
          ],
          cursor: "next-page",
        }),
      };
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  await loadEditor(dom);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const open = dom.window.document.querySelector('[data-action="open-media-library"]');
  assert.equal(open.disabled, false);
  open.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const dialog = dom.window.document.getElementById("editor-media-library");
  const grid = dom.window.document.getElementById("editor-media-grid");
  assert.equal(dialog.hidden, false);
  assert.equal(grid.querySelectorAll(".editor-media-item").length, 2);
  assert.equal(grid.querySelector("svg"), null);
  assert.match(grid.textContent, /<svg onload=alert\(1\)>/);
  assert.equal(requests[1].options.credentials, "include");
  assert.equal(requests[1].options.headers, undefined);

  const search = dom.window.document.getElementById("editor-media-search");
  search.value = "webp";
  search.dispatchEvent(new dom.window.Event("input"));
  assert.equal(grid.querySelectorAll(".editor-media-item").length, 1);
  search.value = "";
  search.dispatchEvent(new dom.window.Event("input"));

  dom.window.document.getElementById("editor-media-more").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(grid.querySelectorAll(".editor-media-item").length, 3);
  assert.match(requests[2].url, /cursor=next-page/);

  grid.querySelector(".editor-media-actions button").click();
  assert.equal(dom.window.document.getElementById("post-cover").value, "https://assets.example.com/images/uploads/2026/08/new.webp");
  assert.equal(dialog.hidden, true);

  open.click();
  const secondInsert = grid.querySelectorAll(".editor-media-item")[1].querySelectorAll("button")[1];
  secondInsert.click();
  assert.match(dom.window.document.getElementById("markdown-input").value, /!\[图片说明\]\(https:\/\/assets\.example\.com\/images\/uploads\/2026\/08\/safe\.png\)/);
  assert.equal(dialog.hidden, true);
  dom.window.close();
});

test("editor.js reindexes public knowledge with the authenticated CSRF session", async () => {
  const html = EDITOR_HTML
    .replace("<body", '<head><meta name="cwl-api-base" content="https://api.example.com"></head><body')
    .replace("</body>", `
      <div id="editor-publish-panel">
        <span id="editor-publish-status"></span>
        <button data-action="connect-github">Connect</button>
        <button data-action="publish-pr" disabled>Publish</button>
        <button data-action="reindex-knowledge" disabled>Reindex</button>
        <button data-action="logout-github" hidden>Logout</button>
      </div>
    </body>`);
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://wenliang844.github.io/editor/" });
  const requests = [];
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith("/api/v1/auth/session")) {
      return { ok: true, json: async () => ({ login: "owner", csrfToken: "knowledge-csrf" }) };
    }
    if (url.endsWith("/api/v1/admin/knowledge/reindex")) {
      return { ok: true, json: async () => ({ datasetHash: "abc", vectors: 24 }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  await loadEditor(dom);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const reindex = dom.window.document.querySelector('[data-action="reindex-knowledge"]');
  assert.equal(reindex.disabled, false);
  reindex.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests[1].url, "https://api.example.com/api/v1/admin/knowledge/reindex");
  assert.equal(requests[1].options.headers["x-csrf-token"], "knowledge-csrf");
  assert.match(dom.window.document.getElementById("editor-publish-status").textContent, /24 个分块/);
  dom.window.close();
});

// ─── Missing elements graceful exit ───────────────────────────────────────

test("editor.js exits gracefully when required elements are missing", async () => {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/editor/",
  });
  const editorCode = await readFile(join(ROOT, "js", "editor.js"), "utf8");
  // Should not throw
  dom.window.eval(editorCode);
  assert.ok(true, "editor.js should exit gracefully without required elements");
  dom.window.close();
});
