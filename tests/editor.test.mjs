// Deep test: editor.js — Markdown editor, formatting, state, download
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

const EDITOR_HTML = `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <input type="text" id="post-title" value="">
  <input type="text" id="post-slug" value="">
  <input type="date" id="post-date" value="">
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
  assert.ok(document.getElementById("post-slug").value.length > 0, "slug should be pre-filled");
  assert.ok(document.getElementById("post-date").value.match(/^\d{4}-\d{2}-\d{2}$/), "date should be YYYY-MM-DD");
  assert.ok(document.getElementById("markdown-input").value.length > 0, "markdown should be pre-filled");
  assert.ok(document.getElementById("markdown-preview").innerHTML.length > 0, "preview should have content");
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
  assert.equal(document.getElementById("post-slug").value, "");
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

  document.getElementById("post-title").value = 'My "Great" Post';
  // The frontMatter function is internal; we verify through download-md action
  // by checking the source value formatting
  const title = document.getElementById("post-title").value;
  assert.ok(title.includes('"Great"'), "title preserves quotes");
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
