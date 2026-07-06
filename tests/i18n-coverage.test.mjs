import test from "node:test";
import assert from "node:assert/strict";
import {
  checkI18nCoverage,
  collectRequiredKeys,
  formatI18nCoverageReport,
  loadEnglishLookup,
} from "../scripts/check-i18n-coverage.mjs";

test("i18n coverage collector mirrors runtime data attributes", () => {
  const html = `<!doctype html><html><head><title>测试</title><meta name="description" content="描述"></head>
    <body data-i18n-page="sample">
      <p data-i18n="known.key">中文</p>
      <p data-i18n="inline.key" data-i18n-en="Inline English">中文</p>
      <span data-i18n="html.key" data-i18n-html>中文 <strong>HTML</strong></span>
      <button data-i18n-aria="aria.key" aria-label="中文">按钮</button>
      <input data-i18n-ph="ph.key" placeholder="中文">
      <a data-i18n-title="title.key" title="中文">链接</a>
    </body></html>`;

  assert.deepEqual(collectRequiredKeys(html, "sample.html"), [
    { file: "sample.html", key: "html.key", attr: "data-i18n-html" },
    { file: "sample.html", key: "known.key", attr: "data-i18n" },
    { file: "sample.html", key: "aria.key", attr: "data-i18n-aria" },
    { file: "sample.html", key: "ph.key", attr: "data-i18n-ph" },
    { file: "sample.html", key: "title.key", attr: "data-i18n-title" },
    { file: "sample.html", key: "head.title.sample", attr: "body[data-i18n-page]" },
    { file: "sample.html", key: "head.desc.sample", attr: "body[data-i18n-page]" },
  ]);
});

test("i18n English lookup uses the real runtime dictionary", async () => {
  const hasEnglishKey = await loadEnglishLookup();

  assert.equal(hasEnglishKey("nav.blog"), true);
  assert.equal(hasEnglishKey("this.key.does.not.exist"), false);
});

test("committed HTML data-i18n keys have English coverage", async () => {
  const result = await checkI18nCoverage();

  assert.equal(formatI18nCoverageReport(result).includes("Missing English keys"), true);
  assert.deepEqual(result.missing, []);
  assert.ok(result.checkedFiles >= 20);
  assert.ok(result.uniqueRequiredKeys >= 250);
});
