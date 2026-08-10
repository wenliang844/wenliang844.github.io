import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

test("CodeMirror source includes Markdown commands and content diagnostics", async () => {
  const source = await readFile(join(ROOT, "src", "editor-codemirror.ts"), "utf8");
  assert.match(source, /markdown\(\)/);
  assert.match(source, /\/内部链接/);
  assert.match(source, /图片缺少替代文本/);
  assert.match(source, /禁止使用 javascript: 链接/);
  assert.match(source, /代码块缺少结束标记/);
  assert.match(source, /formatKey\("Mod-b", "bold"\)/);
});

test("CodeMirror bundle stays isolated to the editor and within its size budget", async () => {
  const bundle = join(ROOT, "js", "editor-codemirror.js");
  const info = await stat(bundle);
  assert.ok(info.size > 100_000, "bundle should contain the local CodeMirror runtime");
  assert.ok(info.size < 700_000, `editor bundle is too large: ${info.size} bytes`);
  const editorHtml = await readFile(join(ROOT, "editor", "index.html"), "utf8");
  const postHtml = await readFile(join(ROOT, "post", "index.html"), "utf8");
  assert.match(editorHtml, /src="\/js\/editor-codemirror\.js" defer/);
  assert.doesNotMatch(postHtml, /editor-codemirror\.js/);
});

test("editor exposes the optional GitHub PR publishing workflow", async () => {
  const html = await readFile(join(ROOT, "editor", "index.html"), "utf8");
  assert.match(html, /name="cwl-api-base" content=""/);
  assert.match(html, /id="post-tags"/);
  assert.match(html, /data-action="connect-github"/);
  assert.match(html, /data-action="publish-pr" disabled/);
  assert.match(html, /id="editor-pr-link"/);
  assert.match(html, /id="editor-preview-link"/);
  assert.match(html, /data-action="reindex-knowledge" disabled/);
});
