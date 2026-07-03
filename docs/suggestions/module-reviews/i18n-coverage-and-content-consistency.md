# i18n 覆盖率与内容一致性评审

分析日期：2026-07-03
分析范围：`js/i18n.js`、生成 HTML 的 `data-i18n*` 绑定、文章 TOC、观察家榜单、信任页统计区、i18n/a11y/template/tools 测试。

## 本轮验证

- `node --test tests/i18n-a11y.test.mjs tests/i18n-deep.test.mjs tests/js-behavior.test.mjs tests/templates-extended.test.mjs tests/tools.test.mjs`：141/141 通过。
- 只读覆盖率扫描：20 个 HTML 文件、697 个英文词典 key、1509 个 `data-i18n*` 绑定。
- 覆盖来源分布：868 个绑定由 `js/i18n.js` 字典提供英文，617 个绑定由 `data-i18n-en*` 内联英文提供，24 个绑定没有显式英文来源。
- 未覆盖绑定主要集中在：文章 TOC 的 `toc.title` / `toc.aria` / `toc.toggle`，观察家榜单中本来可沿用英文原名的 `Codex` / `Claude` / `AI` / `Java` / `Python`，以及信任页统计区 `trust.stats.aria`。

## 结论摘要

项目的 i18n 基础能力已经很扎实：DOM 文本、aria、placeholder、title、innerHTML、语言块、head 元信息和动态工具状态都已有回归测试。下一步的重点不是“能不能切换语言”，而是“新增页面和数据项时，能否自动知道哪些 key 有字典英文、哪些走内联英文、哪些只是中文回退”。建议把本轮临时扫描固化成 CI 报告，并把有意沿用原文的条目显式标记出来。

---

## 📌 I18N-COV-01：缺少常态化 i18n 覆盖率报告，新增页面时不易发现英文缺口

- 📍 位置：`js/i18n.js:17-57`、`js/i18n.js:60-788`、`tests/i18n-a11y.test.mjs:163-212`、`tests/i18n-deep.test.mjs:18-47`
- 📝 当前状况描述：现有测试验证了页面有 `data-i18n-page`、导航/页脚/语言按钮存在，以及 i18n 运行时能切换 text、aria、placeholder、HTML、head 和语言块。但测试没有汇总所有 `data-i18n*` key 的英文来源。本轮只读扫描发现 1509 个绑定中仍有 24 个没有显式英文来源；如果不生成报告，维护者只能在真实切换页面或人工 grep 时发现。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：新增 `scripts/check-i18n-coverage.mjs` 或测试用例，扫描生成 HTML 和模板输出，分类统计 `dictionary`、`inline`、`same-as-source`、`missing`。

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

## 📌 I18N-COV-02：文章 TOC 模板使用 `toc.*` key，但英文词典只提供 `dyn.toc.aria`

- 📍 位置：`src/templates/post.mjs:93-116`、`js/i18n.js:760-763`、`docs/suggestions/module-reviews/i18n-and-accessibility.md:13-43`
- 📝 当前状况描述：文章目录外壳输出 `data-i18n-aria="toc.aria"`、`data-i18n-aria="toc.toggle"` 和 `data-i18n="toc.title"`；单个目录链接有 `data-i18n-en`，但外壳 key 没有字典英文，也没有内联英文。本轮扫描在 6 篇文章中各发现 3 个缺口，共 18 个绑定。旧评审已指出该问题，目前仍是覆盖率扫描中的最大缺口。
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

## 📌 I18N-COV-03：观察家榜单的“沿用原名”缺少显式标记，覆盖率扫描无法区分有意回退和遗漏

- 📍 位置：`src/templates/appreciation.mjs:6-8`、`src/templates/appreciation.mjs:16-22`、`src/templates/appreciation.mjs:149-159`、`tests/templates-extended.test.mjs:290-304`
- 📝 当前状况描述：榜单数据注释说明 `nameEn` 缺省时英文环境沿用 `name`，适合 Codex、Java 等专有名词。当前实现只有 `item.nameEn` 存在时才输出 `data-i18n-en`；否则依赖 i18n fallback 保持原文。本轮扫描把 `Codex`、`Claude`、`AI`、`Java`、`Python` 标为缺失英文来源。用户视角影响很低，但治理视角会让真实遗漏和有意沿用原文混在一起。
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

## 📌 I18N-COV-04：信任页统计区 aria 文案没有英文来源

- 📍 位置：`src/templates/trust.mjs:72-82`、`src/trust-data.mjs:1-17`、`tests/templates-extended.test.mjs:174-192`
- 📝 当前状况描述：信任页统计卡片的数值和标签都由 `TRUST_STATS` 提供 `labelEn`，但统计区容器的 `aria-label="Trust summary"` 同时标记 `data-i18n-aria="trust.stats.aria"`，没有 `data-i18n-en-aria`，字典中也没有 `trust.stats.aria`。因为初始 aria 已经是英文，中文模式反而会缓存英文；切换语言后也不会有明确的中英来源。
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

1. 中优先级：新增 i18n 覆盖率脚本或测试，要求 missing 为 0，并输出 dictionary/inline/same 来源分布。
2. 中优先级：补齐文章 TOC 的 `toc.*` 英文字典，或统一改用已有 `dyn.*` key。
3. 中优先级：把页面 head、OG、search、JSON-LD 的英文元信息纳入同一份一致性报告。
4. 低优先级：为观察家榜单的同名英文项输出 `data-i18n-en` 或 `data-i18n-same`。
5. 低优先级：为信任页统计区补 `data-i18n-en-aria` 或字典 key。
6. 中优先级：给 `data-i18n-html` 增加 key 白名单和标签白名单。

## 本轮健康度评分

i18n 覆盖治理健康度：4.0 / 5。

基础运行时和回归测试很强，真实用户可见风险不高；扣分主要来自覆盖率报告尚未自动化、TOC 旧 key 漂移未消除，以及“有意沿用原文”和“遗漏英文”还没有机器可读区分。
