# i18n 覆盖率与内容一致性评审

分析日期：2026-07-03
更新日期：2026-07-04
分析范围：`js/i18n.js`、生成 HTML 的 `data-i18n*` 绑定、文章 TOC、观察家榜单、信任页统计区、i18n/a11y/template/tools 测试。

## 本轮验证

- `npm run check:i18n`：通过，21 个 HTML、965 个 `data-i18n*` / head 引用、258 个唯一 key、0 个缺失。
- `node --test tests/i18n-coverage.test.mjs tests/workflows.test.mjs tests/quality-baseline.test.mjs tests/templates.test.mjs`：31/31 通过。
- `npm run check:readonly`：通过，822/822 测试通过。
- 已新增 `scripts/check-i18n-coverage.mjs`，并接入 `check:readonly`、GitHub Actions CI 和 `quality:baseline`。
- 已补齐文章 TOC、离线页 head、信任页统计区 aria 的公共英文 key，并让鉴赏页专有名词显式输出 `data-i18n-en`。

## 结论摘要

项目的 i18n 基础能力已经很扎实：DOM 文本、aria、placeholder、title、innerHTML、语言块、head 元信息和动态工具状态都已有回归测试。本轮已把“新增页面和数据项时，能否自动知道哪些 key 有英文来源”固化成只读门禁。下一步重点转向两个更细的治理项：页面 head / OG / search / JSON-LD 英文元信息一致性，以及 `data-i18n-html` 的 key 与标签白名单。

---

## 📌 I18N-COV-01 [已修复]：缺少常态化 i18n 覆盖率报告，新增页面时不易发现英文缺口

- 📍 位置：`js/i18n.js:17-57`、`js/i18n.js:60-788`、`tests/i18n-a11y.test.mjs:163-212`、`tests/i18n-deep.test.mjs:18-47`
- 📝 当前状况描述：已新增 `scripts/check-i18n-coverage.mjs`，汇总所有 committed HTML 的 `data-i18n*` key 与 `body[data-i18n-page]` head key，并要求英文词典或 `data-i18n-en*` 内联英文覆盖。当前结果为 21 个 HTML、965 个引用、258 个唯一 key、0 缺失。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：第一阶段已落地。后续可在当前脚本基础上增加 dictionary / inline / HTML 型 key 分布报告。

```js
const sources = {
  dictionary: new Set(Object.keys(EN)),
  inlineAttrs: ["data-i18n-en", "data-i18n-en-html", "data-i18n-en-aria", "data-i18n-en-ph", "data-i18n-en-title"],
};

for (const binding of collectI18nBindings(renderedHtmlFiles)) {
  const hasInline = sources.inlineAttrs.some((attr) => binding.element.hasAttribute(attr));
  const hasDict = sources.dictionary.has(binding.key);
  const sameAsSource = binding.element.hasAttribute("data-i18n-same");
  report.add({ ...binding, source: hasInline ? "inline" : hasDict ? "dictionary" : sameAsSource ? "same" : "missing" });
}

assert.deepEqual(report.missing, []);
```

- 📊 预期收益：新增页面、榜单项、工具面板或文章模板时可以立即看到英文覆盖缺口，减少“英文模式局部回退中文”的体验裂缝。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md`、`docs/suggestions/module-reviews/trust-page-launch-readiness.md`

---

## 📌 I18N-COV-02 [已修复]：文章 TOC 模板使用 `toc.*` key，但英文词典只提供 `dyn.toc.aria`

- 📍 位置：`src/templates/post.mjs:93-116`、`js/i18n.js:760-763`、`docs/suggestions/module-reviews/i18n-and-accessibility.md:13-43`
- 📝 当前状况描述：已在 `js/i18n.js` 补齐 `"toc.aria"`、`"toc.toggle"` 和 `"toc.title"`。当前 `npm run check:i18n` 缺失为 0。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：二选一即可。更推荐补齐 `toc.*` 字典，保持模板语义清楚。

```js
// js/i18n.js
"toc.aria": "Contents",
"toc.toggle": "Expand or collapse contents",
"toc.title": "Contents",
```

或把模板 key 与动态脚本复用的 `dyn.*` 对齐：

```html
<aside data-i18n-aria="dyn.toc.aria">
  <button data-i18n-aria="dyn.toc.toggle">
    <span data-i18n="dyn.toc">目录</span>
  </button>
</aside>
```

- 📊 预期收益：英文模式下文章阅读动线不会出现“正文目录链接已翻译、目录外壳仍中文”的混合状态。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md`、`docs/suggestions/module-reviews/core-reading-interactions.md`

---

## 📌 I18N-COV-03 [已修复]：观察家榜单的“沿用原名”缺少显式标记，覆盖率扫描无法区分有意回退和遗漏

- 📍 位置：`src/templates/appreciation.mjs:6-8`、`src/templates/appreciation.mjs:16-22`、`src/templates/appreciation.mjs:149-159`、`tests/templates-extended.test.mjs:290-304`
- 📝 当前状况描述：已调整 `src/templates/appreciation.mjs`，`nameEn` 缺省时也输出 `data-i18n-en="${item.name}"`。Codex、Claude、AI、Java、Python 等专有名词现在是显式英文来源，不再和漏翻混淆。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：把“英文同原文”显式输出，或引入 `data-i18n-same` 作为覆盖率扫描的允许状态。

```js
const nameEn = item.nameEn || item.name;
const nameEnAttr = ` data-i18n-en="${escapeAttr(nameEn)}"`;
```

或：

```html
<span data-i18n="appr.b0.i0.name" data-i18n-same>Codex</span>
```

- 📊 预期收益：覆盖率报告可以保持零噪音，让真正缺少英文的新增榜单项更容易被发现。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/product-info-pages-and-rankings.md`、`docs/suggestions/module-reviews/search-and-content-discovery.md`

---

## 📌 I18N-COV-04 [已修复]：信任页统计区 aria 文案没有英文来源

- 📍 位置：`src/templates/trust.mjs:72-82`、`src/trust-data.mjs:1-17`、`tests/templates-extended.test.mjs:174-192`
- 📝 当前状况描述：已在 `js/i18n.js` 补齐 `"trust.stats.aria": "Trust summary"`。当前 `npm run check:i18n` 缺失为 0。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：如果默认页面是中文，建议把初始 aria 改为中文并提供英文内联；如果希望 aria 固定英文，则去掉 i18n key，避免被覆盖率扫描误判。

```html
<div
  class="trust-stats timeline-stats"
  aria-label="信任摘要"
  data-i18n-aria="trust.stats.aria"
  data-i18n-en-aria="Trust summary">
</div>
```

或：

```js
"trust.stats.aria": "Trust summary",
```

- 📊 预期收益：屏幕阅读器文案与当前语言一致，也减少信任页新增可访问性文案时的维护盲点。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/trust-page-launch-readiness.md`、`docs/suggestions/module-reviews/privacy-and-trust-center.md`

---

## 📌 I18N-COV-05：head 元信息同时来自字典和内联属性，建议纳入页面级元数据报告

- 📍 位置：`js/i18n.js:834-849`、`tests/i18n-deep.test.mjs:250-268`、`src/templates/trust.mjs:136-145`、`src/templates/tools.mjs:1058-1067`
- 📝 当前状况描述：`applyHead()` 会优先使用 `body` 上的 `data-i18n-title-en` / `data-i18n-desc-en`，缺省时再使用 `head.title.<page>` 和 `head.desc.<page>` 字典。这个机制灵活，当前扫描也没有发现 head 缺口；但 12 个页面已使用内联 head 英文。随着静态页和专题页增加，页面标题、描述、搜索索引、OG、JSON-LD、RSS 摘要可能各自维护英文，容易出现同一页面多处英文摘要不同步。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：把页面元信息纳入同一份 coverage/report，列出 title、description、OG、search page i18n、JSON-LD name/description 的来源。

```js
for (const page of PAGES) {
  assert.equal(page.head.titleEn, page.og.titleEn ?? page.head.titleEn);
  assert.ok(page.search?.i18n?.en?.title || page.privateToSearch);
  report.pageMeta.push({
    path: page.path,
    head: Boolean(page.head.titleEn && page.head.descriptionEn),
    search: Boolean(page.search?.i18n?.en),
    structuredData: Boolean(page.jsonLd?.name),
  });
}
```

- 📊 预期收益：避免英文标题、搜索摘要和分享卡片文案分叉，提升英文模式分享和站内搜索的一致性。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/seo-feed-and-structured-data.md`、`docs/suggestions/module-reviews/search-and-content-discovery.md`

---

## 📌 I18N-COV-06：`data-i18n-html` 能力已被广泛复用，应与覆盖率扫描一起加白名单

- 📍 位置：`js/i18n.js:17-25`、`tests/i18n-deep.test.mjs:92-107`、`docs/suggestions/module-reviews/i18n-and-accessibility.md:163-194`
- 📝 当前状况描述：i18n 运行时支持 `data-i18n-html`，会对受控文案执行 `innerHTML` 替换。当前用途主要是图标加文字，测试也确认能正常切换；旧评审已建议增加可信 HTML 边界。本轮覆盖率扫描如果固化，正好可以顺手输出所有 HTML 型 key，让安全审计知道哪些 key 被允许包含 HTML。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：覆盖率脚本增加 HTML key 白名单和标签白名单，禁止未知 key 使用 `data-i18n-html` 或 `data-i18n-en-html`。

```js
const HTML_I18N_ALLOWLIST = new Set([
  "nav.more",
  "nav.feedback",
  "nav.subscribe",
  "nav.sponsor",
  "appr.eyebrow",
  "trust.eyebrow",
]);

for (const binding of report.bindings.filter((item) => item.attr === "data-i18n-html")) {
  assert.ok(HTML_I18N_ALLOWLIST.has(binding.key), `${binding.key} must be reviewed before HTML i18n use`);
  assertNoUnexpectedTags(binding.zhHtml, ["i", "br", "span", "code"]);
  assertNoUnexpectedTags(binding.enHtml, ["i", "br", "span", "code"]);
}
```

- 📊 预期收益：保留图标和格式化文案能力，同时降低未来把外部内容误接入 HTML 型翻译带来的 XSS 维护风险。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md`、`docs/suggestions/module-reviews/i18n-and-accessibility.md`

---

## 优先级待办

1. 已完成：新增 i18n 覆盖率脚本或测试，要求 missing 为 0，并接入 `check:readonly`、CI 和质量基线。
2. 已完成：补齐文章 TOC 的 `toc.*` 英文字典。
3. 已完成：为观察家榜单的同名英文项输出 `data-i18n-en`。
4. 已完成：为信任页统计区补字典 key。
5. 中优先级：把页面 head、OG、search、JSON-LD 的英文元信息纳入同一份一致性报告。
6. 中优先级：给 `data-i18n-html` 增加 key 白名单和标签白名单。

## 本轮健康度评分

i18n 覆盖治理健康度：4.4 / 5。

基础运行时和回归测试很强，覆盖率报告已自动化且缺失为 0；扣分主要来自页面级英文元信息一致性报告和 HTML 型翻译白名单仍待推进。
