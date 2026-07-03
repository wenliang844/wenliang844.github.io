# 静态资产与第三方资源专题审查

生成时间：2026-07-03

审查范围：

- `src/templates/layout.mjs`
- `src/templates/post.mjs`
- `scripts/build.mjs`
- `scripts/validate-production.mjs`
- `tests/performance.test.mjs`
- `tests/security-extended.test.mjs`
- `tests/links.test.mjs`
- `js/vendor/*`
- `images/**/*`

本轮只做只读分析与文档写入，未修改任何站点代码或配置。验证记录：`node --test tests/performance.test.mjs tests/security-extended.test.mjs tests/links.test.mjs` 通过，33 项测试全部成功。

当前资产基线：

- 本地 vendor JS 共 5 个，合计约 223 KB：`marked.min.js`、`purify.min.js`、`highlight.min.js`、`qrcode.min.js`、`fuse.min.js`。
- 最大非 vendor JS 当前为 `js/gesture.js`，约 88 KB，低于现有 90 KB 阈值。
- `css/coder.css` 当前约 137 KB，低于现有 140 KB 阈值。
- 最大文章图片约 149 KB，所有 `images/posts/*.png` 均低于 200 KB。

## 📌 MR-ASSET-01：本地 vendor 文件缺少可审计的来源、版本和哈希清单

📍 位置（文件路径 + 行号范围）

- `js/vendor/marked.min.js:1-3`
- `js/vendor/purify.min.js:1-2`
- `js/vendor/highlight.min.js:1-3`
- `tests/performance.test.mjs:228-249`
- `package.json:31-31`
- `package-lock.json:1253-1262`

📝 当前状况描述

测试会确认 vendor 文件存在，HTML 也避免直接从第三方 CDN 加载核心脚本，这是好的。但仓库没有独立记录 vendor 文件的来源 URL、许可证、版本、下载日期和 SHA-256。部分文件头部带版本信息，例如 DOMPurify 3.1.6、Highlight.js 11.9.0；同时构建期 npm 依赖 `marked` 是 18.0.5，而浏览器工具箱本地 vendor 是 `marked v12.0.2`。同名库双版本会让 Markdown 行为、安全修复节奏和升级路径分叉。

⚠️ 影响程度（高/中/低）

中。当前不代表文件已被篡改，但后续升级、漏洞响应和供应链审计缺少可自动比对的依据。

💡 建议方案（含伪代码或示例片段）

新增 vendor manifest，记录每个文件的版本、来源和哈希，并在 CI 中校验当前文件哈希是否匹配。可把构建期和浏览器期同名库纳入同一份清单，明确是否允许版本差异。

```json
{
  "js/vendor/marked.min.js": {
    "name": "marked",
    "browserVersion": "12.0.2",
    "nodeVersion": "18.0.5",
    "source": "https://www.npmjs.com/package/marked",
    "license": "MIT",
    "sha256": "15FABCE5B65898B32B03F5ED25E9F891A729AD4C0D6D877110A7744AA847A894"
  }
}
```

```js
test("vendor files match recorded SHA-256 manifest", async () => {
  const manifest = JSON.parse(await readFile("docs/vendor-manifest.json", "utf8"));
  for (const [file, meta] of Object.entries(manifest)) {
    assert.equal(await sha256(file), meta.sha256);
  }
});
```

📊 预期收益

- vendor 文件升级变得可追踪、可审计。
- 能及时发现本地 vendor 文件被误改或来源不明。
- 构建期与浏览器期同名库的版本差异可以被显式管理。

🔗 相关建议引用

- `security-audit.md` 中关于供应链风险的建议。
- `devex-improvements.md` 中关于 CI 校验和依赖治理的建议。

## 📌 MR-ASSET-02：第三方资源提示在所有页面无条件输出

📍 位置（文件路径 + 行号范围）

- `src/templates/layout.mjs:30-37`
- `src/templates/layout.mjs:216-227`
- `tests/templates.test.mjs:46-51`

📝 当前状况描述

公共模板会在所有生成页输出 Giscus、Buttondown、爱发电和 PayPal 的 `preconnect`/`dns-prefetch`。这些 hint 能改善真实使用时的连接延迟，但也会让普通页面在用户未打开评论、未订阅、未点击赞助前就暴露第三方域名解析或连接意图。尤其 `preconnect` 比 `dns-prefetch` 更重，适合高概率即将使用的资源，而不是所有页面的默认成本。

⚠️ 影响程度（高/中/低）

低到中。当前资源提示数量不大，但会增加首屏网络噪声和轻微隐私暴露，页面越多越值得收敛。

💡 建议方案（含伪代码或示例片段）

把 `RESOURCE_HINTS` 改为按页面能力生成：文章页或文章列表页保留 Giscus hint；所有页可保留低成本 `dns-prefetch`，但 `preconnect` 仅在高概率交互页面或用户触发前插入。

```js
function resourceHintsForPage(page) {
  const hints = [
    { rel: "dns-prefetch", href: "https://buttondown.com" },
    { rel: "dns-prefetch", href: "https://www.ifdian.net" },
    { rel: "dns-prefetch", href: "https://paypal.me" },
  ];
  if (page === "posts") {
    hints.push(
      { rel: "preconnect", href: "https://giscus.app" },
      { rel: "dns-prefetch", href: "https://giscus.app" },
    );
  }
  return hints;
}
```

📊 预期收益

- 减少普通页面的第三方连接噪声。
- 保留文章页评论区的预热收益。
- 让测试从“所有页面必须有所有 hint”升级为“页面需要什么才输出什么”。

🔗 相关建议引用

- `performance-bottlenecks.md` 中关于资源加载策略的建议。
- `module-reviews/user-data-entrypoints.md` 中关于第三方外连边界的建议。

## 📌 MR-ASSET-03：`robots.txt` 屏蔽本地 JS vendor 目录，可能削弱渲染型抓取

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs:446-461`
- `tests/build-extra.test.mjs:232-240`

📝 当前状况描述

`robots.txt` 当前允许站点主体路径，但显式 `Disallow: /js/vendor/`。这会阻止遵守 robots 的爬虫抓取本地 vendor 资源。对纯静态文章内容影响有限，但现代搜索引擎会进行渲染型抓取；如果未来页面的关键内容或结构化交互依赖 vendor 脚本，屏蔽这些资源会降低抓取器还原页面状态的能力。测试目前还固定断言该 Disallow 存在。

⚠️ 影响程度（高/中/低）

低到中。当前大部分内容是静态 HTML，不是即时故障；长期看不建议为了“节省抓取”屏蔽公共渲染资源。

💡 建议方案（含伪代码或示例片段）

默认不要屏蔽公开渲染资源，只屏蔽确实不希望抓取的私有或无意义路径。若担心 crawl budget，可通过 sitemap 和合理链接结构引导，而不是禁止 JS/CSS。

```txt
User-agent: *
Allow: /
Allow: /js/vendor/
Allow: /css/
Sitemap: https://wenliang844.github.io/sitemap.xml
```

配套测试应改为断言不屏蔽公共静态资源：

```js
assert.doesNotMatch(robots, /Disallow:\s*\/js\/vendor\//);
```

📊 预期收益

- 爬虫可以完整获取渲染所需资源。
- robots 语义更聚焦于抓取引导，而不是阻止公共资产。
- 减少后续功能依赖 vendor 后出现 SEO 渲染偏差的风险。

🔗 相关建议引用

- `module-reviews/search-and-seo-pipeline.md` 中关于 sitemap 与 SEO 信号的建议。
- `security-audit.md` 中关于不要把 robots 当安全边界的建议。

## 📌 MR-ASSET-04：文章图片仍是单一 PNG 形态，缺少现代格式和响应式候选流水线

📍 位置（文件路径 + 行号范围）

- `src/posts/*:13-13`
- `scripts/build.mjs:75-88`
- `scripts/build.mjs:291-318`
- `src/templates/post.mjs:275-281`
- `images/posts/*`

📝 当前状况描述

当前文章封面通过 front matter 的 `cover` 进入 OG/Twitter 卡片、JSON-LD 和 image sitemap。现有 PNG 体积控制得不错，最大约 149 KB；但资产流水线没有生成 WebP/AVIF、不同宽度候选或图片 manifest。现在封面并未作为页面内主图渲染，因此首屏影响有限；如果后续把封面加入文章卡片或文章页 hero，就会缺少响应式和现代格式基础。

⚠️ 影响程度（高/中/低）

低到中。当前不是性能故障，是图片规模增长和 UI 扩展前的准备项。

💡 建议方案（含伪代码或示例片段）

增加只读可验证的图片 manifest 与优化脚本：保留 PNG 作为社交平台兼容格式，同时生成 WebP/AVIF 和宽度候选，模板需要渲染页面内图片时使用 `<picture>`。

```json
{
  "/images/posts/rule-engine-alerts.png": {
    "width": 1200,
    "height": 630,
    "variants": [
      "/images/posts/rule-engine-alerts-640.webp",
      "/images/posts/rule-engine-alerts-1200.webp"
    ]
  }
}
```

```html
<picture>
  <source type="image/avif" srcset="/images/posts/example-640.avif 640w, /images/posts/example-1200.avif 1200w">
  <source type="image/webp" srcset="/images/posts/example-640.webp 640w, /images/posts/example-1200.webp 1200w">
  <img src="/images/posts/example.png" width="1200" height="630" loading="lazy" decoding="async" alt="">
</picture>
```

📊 预期收益

- 为未来文章封面渲染和卡片列表做好低带宽适配。
- 保持 OG 图片兼容，同时让页面内展示使用更小格式。
- 图片尺寸、变体和预算可以进入 CI 自动校验。

🔗 相关建议引用

- `performance-bottlenecks.md` 中关于图片优化的建议。
- `module-reviews/search-and-seo-pipeline.md` 中关于 image sitemap 的建议。

## 📌 MR-ASSET-05：性能预算以原始单文件大小为主，缺少路由级和压缩后预算

📍 位置（文件路径 + 行号范围）

- `tests/performance.test.mjs:19-50`
- `tests/performance.test.mjs:222-249`
- `src/templates/post.mjs:263-264`
- `src/templates/post.mjs:407-414`

📝 当前状况描述

性能测试已经覆盖 HTML、非 vendor JS、CSS、搜索索引、sitemap、RSS 和 vendor 文件存在性，当前 33 项资源相关测试通过。但预算主要以“单个原始文件大小”为单位，没有计算每个路由实际会加载的总 JS/CSS、gzip/brotli 后大小、图片总量、第三方 hint 数量或按页面类型区分的预算。比如文章页会加载 core scripts、`qrcode.min.js`、`share.js`、`giscus.js`、`toc.js`，工具页会加载更重的 vendor 组合；单文件都达标时，路由总成本仍可能慢慢膨胀。

⚠️ 影响程度（高/中/低）

中。现有体积仍可控，但增长趋势需要更接近用户真实加载路径的预算。

💡 建议方案（含伪代码或示例片段）

新增 route budget 测试：解析 HTML 中的 CSS/JS/image 引用，按页面类型统计原始大小和 gzip 大小。对首页、文章页、工具页分别设置预算。

```js
async function routeBudget(htmlFile) {
  const html = await readFile(htmlFile, "utf8");
  const assets = extractLocalAssets(html);
  const rawBytes = await sumSize([htmlFile, ...assets]);
  const gzipBytes = await gzipSize([html, ...await readAssets(assets)]);
  return { rawBytes, gzipBytes, assets };
}

test("tools route stays within route-level JS budget", async () => {
  const budget = await routeBudget("tools/index.html");
  assert.ok(budget.gzipBytes < 260 * 1024);
});
```

📊 预期收益

- 更早发现路由整体变重，而不是等单个文件越过阈值。
- 能区分普通内容页和工具页的合理预算。
- 为后续性能优化提供更贴近用户体验的数据。

🔗 相关建议引用

- `performance-bottlenecks.md` 中关于资源体积预算的建议。
- `devex-improvements.md` 中关于 CI 性能门禁的建议。

## 📌 MR-ASSET-06：生产验证只检查图片 alt，未覆盖尺寸、懒加载和解码策略

📍 位置（文件路径 + 行号范围）

- `scripts/validate-production.mjs:320-349`
- `scripts/build.mjs:176-201`
- `tests/build-deep.test.mjs:209-225`
- `src/templates/sponsor.mjs:64-68`
- `src/templates/tools.mjs:560-560`

📝 当前状况描述

构建脚本会为 Markdown 正文图片补 `loading="lazy"` 和 `decoding="async"`，赞助二维码和工具箱 QR 图片也已经有宽高与加载属性。生产验证脚本目前只检查 HTML 图片是否有 `alt`，没有统一检查 `width`/`height`、`loading`、`decoding` 或首图 `fetchpriority`。这会让未来新增手写页面或模板图片时，可能绕过布局稳定性和加载策略检查。

⚠️ 影响程度（高/中/低）

低到中。现有关键图片已有不少保护，但验证脚本覆盖面偏窄。

💡 建议方案（含伪代码或示例片段）

扩展生产验证：对非 SVG、非隐藏占位图要求宽高；对正文和非首屏图片要求 `loading="lazy"` 与 `decoding="async"`；允许首屏关键图显式使用 `fetchpriority="high"`。

```js
for (const img of imgs) {
  if (!hasAttr(img, "alt")) warn("missing alt");
  if (!hasAttr(img, "width") || !hasAttr(img, "height")) warn("missing dimensions");
  if (!isCriticalImage(img) && !/loading="lazy"/.test(img)) warn("missing lazy loading");
  if (!/decoding="async"/.test(img)) warn("missing async decoding");
}
```

📊 预期收益

- 降低未来新增图片造成 CLS 或加载回退的概率。
- 把已有模板规范变成生产验证规则。
- 图片治理从“部分测试覆盖”升级为“部署前统一检查”。

🔗 相关建议引用

- `ux-improvements.md` 中关于布局稳定性的建议。
- `devex-improvements.md` 中关于生产验证扩展的建议。

