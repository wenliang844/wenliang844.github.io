import test from "node:test";
import assert from "node:assert/strict";
import {
  firstMarkdownTitle,
  formatJson,
  governanceBudgetErrors,
  githubHeadingSlug,
  localMarkdownLinks,
  markdownAnchors,
  replaceReadmeModuleIndex,
  SUGGESTION_GOVERNANCE_BUDGET,
  suggestionItems,
  suggestionStatus,
  splitMarkdownHref,
} from "../scripts/check-suggestions-index.mjs";

test("suggestions index parses local markdown links with fragments", () => {
  assert.deepEqual(splitMarkdownHref("../foo.md#bar"), {
    href: "../foo.md#bar",
    pathPart: "../foo.md",
    fragment: "bar",
  });
  assert.deepEqual(splitMarkdownHref("#local-anchor"), {
    href: "#local-anchor",
    pathPart: "",
    fragment: "local-anchor",
  });

  const links = localMarkdownLinks([
    "[same](#local-anchor)",
    "[cross](module-reviews/foo.md#target)",
    "[plain](module-reviews/foo.md)",
    "[external](https://example.com/readme.md#skip)",
  ].join("\n"));

  assert.deepEqual(
    links.map((link) => [link.href, link.pathPart, link.fragment, link.line]),
    [
      ["#local-anchor", "", "local-anchor", 1],
      ["module-reviews/foo.md#target", "module-reviews/foo.md", "target", 2],
      ["module-reviews/foo.md", "module-reviews/foo.md", "", 3],
    ],
  );
});

test("suggestions index generates GitHub-style heading and suggestion-id anchors", () => {
  assert.equal(
    githubHeadingSlug("DE-14 [已修复]: 增加页面级 DOM 契约审计，防止 SEO/a11y 回退"),
    "de-14-已修复-增加页面级-dom-契约审计防止-seoa11y-回退",
  );

  const anchors = markdownAnchors([
    "### 📌 DE-14 [已修复]: 增加页面级 DOM 契约审计，防止 SEO/a11y 回退",
    "### 📌 DE-14 [已修复]: 增加页面级 DOM 契约审计，防止 SEO/a11y 回退",
    "## 普通标题",
  ].join("\n"));

  assert.ok(anchors.has("de-14"));
  assert.ok(anchors.has("de-14-增加页面级-dom-契约审计防止-seoa11y-回退"));
  assert.ok(anchors.has("de-14-已修复-增加页面级-dom-契约审计防止-seoa11y-回退"));
  assert.ok(anchors.has("de-14-已修复-增加页面级-dom-契约审计防止-seoa11y-回退-1"));
  assert.ok(anchors.has("普通标题"));
});

test("suggestions index renders README module index from document titles", () => {
  assert.equal(firstMarkdownTitle("# 标题\n\n正文", "fallback"), "标题");
  assert.equal(firstMarkdownTitle("正文", "fallback"), "fallback");

  const readme = [
    "before",
    "<!-- suggestions-index:start -->",
    "- [old](module-reviews/old.md)",
    "<!-- suggestions-index:end -->",
    "after",
  ].join("\n");

  assert.equal(
    replaceReadmeModuleIndex(readme, "- [new](module-reviews/new.md)"),
    [
      "before",
      "<!-- suggestions-index:start -->",
      "- [new](module-reviews/new.md)",
      "<!-- suggestions-index:end -->",
      "after",
    ].join("\n"),
  );
  assert.throws(
    () => replaceReadmeModuleIndex("no markers", "- [new](module-reviews/new.md)"),
    /missing suggestions-index generated section markers/,
  );
});

test("suggestions governance stats classify suggestion fields and status", () => {
  assert.equal(suggestionStatus("DE-01 [已修复]: 标题"), "fixed");
  assert.equal(suggestionStatus("DE-02 [已修复第一阶段]: 标题"), "partial");
  assert.equal(suggestionStatus("DE-03: 标题"), "open");

  const items = suggestionItems([
    "### 📌 DE-01 [已修复]: 完整建议",
    "- 📍 位置：`a.js`",
    "- 📝 当前状况描述：text",
    "- ⚠️ 影响程度：中",
    "- 💡 建议方案：text",
    "- 📊 实际收益：text",
    "- 🔗 相关建议引用：none",
    "",
    "### 📌 DE-02: 不完整建议",
    "- 📍 位置：`b.js`",
    "- 📝 当前状况描述：text",
  ].join("\n"), "sample.md");

  assert.equal(items.length, 2);
  assert.deepEqual(items[0], {
    file: "sample.md",
    line: 1,
    title: "DE-01 [已修复]: 完整建议",
    status: "fixed",
    missingFields: [],
  });
  assert.equal(items[1].status, "open");
  assert.deepEqual(items[1].missingFields, ["impact", "solution", "benefit", "links"]);
  assert.equal(formatJson({ ok: true }), "{\n  \"ok\": true\n}\n");
});

test("suggestions governance budget rejects new incomplete suggestion debt", () => {
  const baselineReport = {
    incompleteSuggestionItems: SUGGESTION_GOVERNANCE_BUDGET.incompleteSuggestionItems,
    missingFieldCounts: { ...SUGGESTION_GOVERNANCE_BUDGET.missingFieldCounts },
  };
  assert.deepEqual(governanceBudgetErrors(baselineReport), []);

  assert.deepEqual(
    governanceBudgetErrors({
      ...baselineReport,
      incompleteSuggestionItems: SUGGESTION_GOVERNANCE_BUDGET.incompleteSuggestionItems + 1,
    }),
    ["Suggestions governance incomplete item budget exceeded: 83 > 82."],
  );

  assert.deepEqual(
    governanceBudgetErrors({
      ...baselineReport,
      missingFieldCounts: {
        ...baselineReport.missingFieldCounts,
        links: SUGGESTION_GOVERNANCE_BUDGET.missingFieldCounts.links + 1,
      },
    }),
    ["Suggestions governance missing field budget exceeded for links: 31 > 30."],
  );
});
