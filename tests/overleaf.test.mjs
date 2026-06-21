// Deep test: overleaf.js — multi-format resume parsing & rendering
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = join(import.meta.dirname, "..");

function buildOverleafDom(sourceHtml, opts = {}) {
  const dom = new JSDOM(sourceHtml, {
    runScripts: "outside-only",
    url: "https://wenliang844.github.io/overleaf/",
    pretendToBeVisual: true,
  });
  return dom;
}

async function loadOverleaf(dom) {
  const utilsCode = await readFile(join(ROOT, "js", "utils.js"), "utf8");
  const overleafCode = await readFile(join(ROOT, "js", "overleaf.js"), "utf8");
  dom.window.eval(utilsCode);
  dom.window.eval(overleafCode);
  return dom;
}

const BASE_HTML = `<!doctype html><html lang="zh-CN"><body class="colorscheme-dark">
  <textarea id="latex-source"></textarea>
  <div id="resume-preview"></div>
  <span id="overleaf-status"></span>
  <select id="resume-format">
    <option value="latex">LaTeX</option>
    <option value="markdown">Markdown</option>
    <option value="moderncv">moderncv</option>
    <option value="html">HTML</option>
  </select>
  <span id="resume-source-badge"></span>
  <div class="overleaf-preview-scroll"></div>
  <button data-overleaf-action="compile">Compile</button>
  <button data-overleaf-action="copy">Copy</button>
  <button data-overleaf-action="reset">Reset</button>
</body></html>`;

// ─── LaTeX rendering ──────────────────────────────────────────────────────

test("overleaf.js LaTeX source contains document class and sections", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;
  const select = document.getElementById("resume-format");

  // overleaf.js defaults to markdown; switch to LaTeX
  select.value = "latex";
  select.dispatchEvent(new dom.window.Event("change"));

  const source = document.getElementById("latex-source").value;

  assert.ok(source.includes("\\documentclass"), "should have document class");
  assert.ok(source.includes("\\usepackage[UTF8]{ctex}"), "should use ctex");
  assert.ok(source.includes("\\begin{document}"), "should have begin document");
  assert.ok(source.includes("\\end{document}"), "should have end document");
  assert.ok(source.includes("\\section{"), "should have sections");
  assert.ok(source.includes("\\entry{"), "should have entries");
  assert.ok(source.includes("CWL"), "should contain name");
  dom.window.close();
});

// ─── Preview rendering ────────────────────────────────────────────────────

test("overleaf.js preview renders resume sections with editable fields", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;
  const preview = document.getElementById("resume-preview");

  assert.ok(preview.innerHTML.length > 100, "preview should have content");
  assert.ok(preview.querySelector("h1"), "preview should have name heading");
  assert.ok(preview.querySelector(".latex-section"), "should have sections");
  assert.ok(preview.querySelector(".latex-entry"), "should have entries");
  assert.ok(preview.querySelector("[contenteditable='true']"), "should have editable fields");

  // Check name is rendered
  const nameSpan = preview.querySelector("[data-resume-field='name']");
  assert.ok(nameSpan, "should have editable name field");
  assert.ok(nameSpan.textContent.includes("CWL"), "name should contain author name");
  dom.window.close();
});

// ─── Format switching ─────────────────────────────────────────────────────

test("overleaf.js can switch between formats", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;

  const select = document.getElementById("resume-format");
  const badge = document.getElementById("resume-source-badge");

  // Initial format should be markdown (default from loadInitialFormat)
  assert.ok(select.value === "markdown" || select.value === "latex", "should start with a valid format");

  // Switch to LaTeX
  select.value = "latex";
  select.dispatchEvent(new dom.window.Event("change"));
  assert.equal(badge.textContent, "resume.tex", "badge should show resume.tex");
  assert.ok(document.getElementById("latex-source").value.includes("\\documentclass"), "source should be LaTeX");

  // Switch to Markdown
  select.value = "markdown";
  select.dispatchEvent(new dom.window.Event("change"));
  assert.equal(badge.textContent, "resume.md", "badge should show resume.md");
  assert.ok(document.getElementById("latex-source").value.startsWith("#"), "source should start with #");

  // Switch to moderncv
  select.value = "moderncv";
  select.dispatchEvent(new dom.window.Event("change"));
  assert.equal(badge.textContent, "resume-moderncv.tex", "badge should show resume-moderncv.tex");
  assert.ok(document.getElementById("latex-source").value.includes("moderncv"), "source should be moderncv");

  // Switch to HTML
  select.value = "html";
  select.dispatchEvent(new dom.window.Event("change"));
  assert.equal(badge.textContent, "resume.html", "badge should show resume.html");
  assert.ok(document.getElementById("latex-source").value.includes("<!doctype html>"), "source should be HTML");
  dom.window.close();
});

// ─── Markdown format round-trip ───────────────────────────────────────────

test("overleaf.js Markdown format round-trips correctly", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;
  const select = document.getElementById("resume-format");

  // Switch to markdown
  select.value = "markdown";
  select.dispatchEvent(new dom.window.Event("change"));

  const source = document.getElementById("latex-source").value;
  assert.ok(source.includes("# CWL"), "markdown should have name as h1");
  assert.ok(source.includes("## "), "markdown should have section headings");
  assert.ok(source.includes("### "), "markdown should have entry headings");

  // Edit source and re-compile
  document.getElementById("latex-source").value = source.replace("CWL", "测试用户");
  document.querySelector("[data-overleaf-action='compile']").click();

  const nameSpan = document.getElementById("resume-preview").querySelector("[data-resume-field='name']");
  assert.ok(nameSpan.textContent.includes("测试用户"), "name should update after recompile");
  dom.window.close();
});

// ─── Preview → source sync ────────────────────────────────────────────────

test("overleaf.js editing preview syncs back to source", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;

  const nameSpan = document.getElementById("resume-preview").querySelector("[data-resume-field='name']");
  assert.ok(nameSpan, "should have editable name");

  // Simulate editing the name in preview
  nameSpan.textContent = "新名字";
  nameSpan.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  const source = document.getElementById("latex-source").value;
  assert.ok(source.includes("新名字"), "source should contain updated name");
  dom.window.close();
});

// ─── Reset template ───────────────────────────────────────────────────────

test("overleaf.js reset restores default template", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;

  // Modify the source
  document.getElementById("latex-source").value = "modified content";

  // Click reset
  document.querySelector("[data-overleaf-action='reset']").click();

  const source = document.getElementById("latex-source").value;
  assert.ok(source.length > 100, "source should be restored");
  assert.ok(source.includes("CWL"), "source should contain default name");

  const status = document.getElementById("overleaf-status").textContent;
  assert.ok(status.includes("Template") || status.includes("模板"), "status should indicate reset");
  dom.window.close();
});

// ─── empty source fallback ────────────────────────────────────────────────

test("overleaf.js gracefully handles empty source input", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;

  // Set empty source and recompile
  document.getElementById("latex-source").value = "";
  document.querySelector("[data-overleaf-action='compile']").click();

  // Preview should still have some content (fallback model)
  const preview = document.getElementById("resume-preview");
  assert.ok(preview.innerHTML.length > 0, "preview should have fallback content");
  dom.window.close();
});

// ─── Section ordering ─────────────────────────────────────────────────────

test("overleaf.js orders sections with education first and professional skills last", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;
  const select = document.getElementById("resume-format");

  select.value = "markdown";
  select.dispatchEvent(new dom.window.Event("change"));

  const source = document.getElementById("latex-source").value;
  const eduIdx = source.indexOf("教育与荣誉");
  const skillsIdx = source.indexOf("专业技能");

  // Education should come before professional skills
  assert.ok(eduIdx < skillsIdx, "education should come before professional skills in source");
  dom.window.close();
});

// ─── Status updates ───────────────────────────────────────────────────────

test("overleaf.js status reflects current operation", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;

  const status = document.getElementById("overleaf-status").textContent;
  assert.ok(status.length > 0, "status should have text after load");
  assert.ok(status.includes("Compiled") || status.includes("编译") || status.includes("markdown") || status.includes("LaTeX"), "status should indicate format");
  dom.window.close();
});

// ─── escapeHtml in overleaf context ───────────────────────────────────────

test("overleaf.js escapes HTML in resume entries", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;
  const select = document.getElementById("resume-format");

  // Switch to markdown, inject XSS, recompile
  select.value = "markdown";
  select.dispatchEvent(new dom.window.Event("change"));

  const source = document.getElementById("latex-source").value;
  document.getElementById("latex-source").value = source.replace("CWL", '<script>alert("xss")</script>');
  document.querySelector("[data-overleaf-action='compile']").click();

  const preview = document.getElementById("resume-preview");
  assert.ok(!preview.innerHTML.includes('<script>alert("xss")</script>'), "XSS should be escaped in preview");
  assert.ok(preview.innerHTML.includes("&lt;script&gt;"), "script tag should be escaped");
  dom.window.close();
});

// ─── Skills section ───────────────────────────────────────────────────────

test("overleaf.js includes professional skills section", async () => {
  const dom = buildOverleafDom(BASE_HTML);
  await loadOverleaf(dom);
  const { document } = dom.window;
  const select = document.getElementById("resume-format");

  // Check markdown format
  select.value = "markdown";
  select.dispatchEvent(new dom.window.Event("change"));
  const mdSource = document.getElementById("latex-source").value;
  assert.ok(mdSource.includes("专业技能"), "markdown should include skills section");

  // Check LaTeX format
  select.value = "latex";
  select.dispatchEvent(new dom.window.Event("change"));
  const texSource = document.getElementById("latex-source").value;
  assert.ok(texSource.includes("专业技能"), "LaTeX should include skills section");
  dom.window.close();
});
