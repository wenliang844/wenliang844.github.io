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

本轮最初只做只读分析与文档写入；后续已推进 MR-ASSET-01，新增 `data/vendor-manifest.json`、`scripts/check-vendor-manifest.mjs`、`npm run check:vendor` 和 `tests/vendor-manifest.test.mjs`，并接入 `check:readonly`、CI 与质量基线。随后推进 MR-ASSET-07，把手势工具远程 MediaPipe、face-api、Three.js、WASM 和模型 URL 纳入同一份 manifest，并由 `check:vendor` 与单测校验 `js/gesture.js` 的远程运行时均被记录；第二阶段又在手势工具确认区展示 7 个远程视觉资源治理状态，并由模板测试、CSS 测试、vendor manifest 测试和 browser smoke 保护；推进 MR-ASSET-06，将全站 HTML 图片属性纳入生产验证；推进 MR-ASSET-03，让 robots 允许公开 JS/CSS/webfonts 渲染资源；推进 MR-ASSET-02，将第三方 `preconnect` 改为页面能力与用户动作触发；推进 MR-ASSET-05，为首页、文章页和工具页增加路由级 raw/gzip 总预算与 JS 子预算；并新增 `src/pwa-precache.mjs` 与 `npm run check:pwa-precache`，把 19 个 PWA app-shell 预缓存 URL、Font Awesome 字体引用、2 个页面级资源、按需助手 CSS 和 Service Worker 清单一致性纳入只读门禁。验证记录：`npm run check:vendor` 通过；`node --test tests/vendor-manifest.test.mjs` 4/4 通过；`npm run check:pwa-precache` 通过；`node --test tests/quality-baseline.test.mjs tests/workflows.test.mjs` 25/25 通过；`npm run validate:production` 75/75 通过；`node --test tests/build-extra.test.mjs tests/build.test.mjs` 38/38 通过；`node --test tests/performance.test.mjs tests/templates.test.mjs tests/css.test.mjs tests/vendor-manifest.test.mjs` 71/71 通过；`npm run test:browser-smoke` 通过；`npm run check:generated` 通过。

当前资产基线：

- 本地 vendor JS 共 5 个，合计约 223 KB：`marked.min.js`、`purify.min.js`、`highlight.min.js`、`qrcode.min.js`、`fuse.min.js`。
- 最大非 vendor JS 当前为 `js/gesture.js`，约 88 KB，低于现有 90 KB 阈值。
- `css/coder.css` 当前约 137 KB，低于现有 140 KB 阈值。
- 最大文章图片约 149 KB，所有 `images/posts/*.png` 均低于 200 KB。

## 📌 MR-ASSET-01 [已修复]：本地 vendor 文件缺少可审计的来源、版本和哈希清单

📍 位置（文件路径 + 行号范围）

- `data/vendor-manifest.json`
- `scripts/check-vendor-manifest.mjs`
- `tests/vendor-manifest.test.mjs`
- `.github/workflows/ci.yml`
- `package.json:31-31`
- `package-lock.json:1253-1262`

📝 当前状况描述

测试会确认 vendor 文件存在，HTML 也避免直接从第三方 CDN 加载核心脚本，这是好的。此前仓库没有独立记录 vendor 文件的来源 URL、许可证、版本和 SHA-256；当前已新增 `data/vendor-manifest.json`，记录 5 个本地 vendor 文件的来源、许可证、浏览器版本、字节数和 SHA-256，并对 `marked` 明确记录浏览器期 `12.0.2` 与构建期 `18.0.5` 的版本差异。`qrcode.min.js` 没有版本 banner，清单中保留 `browserVersion: null` 和说明，避免编造版本号。`npm run check:vendor` 会校验 manifest 与 `js/vendor/*.js` 文件集合、大小和哈希完全一致。

⚠️ 影响程度（高/中/低）

中。核心风险已收敛：当前 vendor 文件具备可自动比对的哈希清单。剩余治理点是后续升级时补充下载日期、发布包签名或上游 npm tarball 对照。

💡 建议方案（含伪代码或示例片段）

已新增 vendor manifest，记录每个文件的版本、来源和哈希，并在 CI 中校验当前文件哈希是否匹配。构建期和浏览器期同名库 `marked` 已纳入同一份清单，明确版本差异。

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

## 📌 MR-ASSET-07 [已修复第二阶段]：远程视觉运行时和模型资源缺少 manifest 治理

📍 位置（文件路径 + 行号范围）

- `data/vendor-manifest.json`
- `scripts/check-vendor-manifest.mjs`
- `src/templates/tools.mjs`
- `css/tools.css`
- `scripts/browser-smoke.mjs`
- `tests/vendor-manifest.test.mjs`
- `js/gesture.js`

📝 当前状况描述

手势工具仍按需从 jsDelivr 和 Google Storage 加载 MediaPipe、face-api、Three.js、WASM 和视觉模型。第一阶段已把 7 个远程运行时/模型 URL 纳入 `data/vendor-manifest.json` 的 `remoteResources`：记录资源类型、包名、版本/路径、供应商、触发条件、是否要求用户确认、当前 pinning 状态和后续本地化计划。第二阶段已把这份治理状态产品化到手势工具确认区：7 个资源逐项展示为“版本锁定”“上游 latest”或“待自托管”，并在用户勾选第三方资源确认前可见。`npm run check:vendor` 会校验远程资源字段、HTTPS、唯一性、显式确认与 `upstream-latest` 风险说明；`tests/vendor-manifest.test.mjs` 会从真实 `js/gesture.js` 抽取远程 URL，并要求 manifest 完整覆盖；`scripts/browser-smoke.mjs` 会在 `/tools/` 真实浏览器交互中断言资源状态列表存在、7 项渲染且 3 项处于 watch 状态。

⚠️ 影响程度（高/中/低）

中。前两阶段把“远程加载了什么”和“哪些资源仍未自托管”变成可审计、可见、可测试的契约；剩余风险是 MediaPipe 模型仍使用 upstream `latest` 路径，尚未自托管和 hash pin。

💡 建议方案（含伪代码或示例片段）

已落地 manifest、用户可见状态和测试覆盖。下一阶段应把 `hand_landmarker.task`、`efficientdet_lite0.tflite`、face-api 模型和关键 WASM 资源下载到本地，记录 SHA-256，并把手势工具 CSP 收敛到自托管资源。

```js
const gestureUrls = extractRemoteUrls(await readFile("js/gesture.js", "utf8"));
assert.deepEqual(manifest.remoteResources.map((item) => item.url).sort(), gestureUrls);
```

📊 实际收益

- 手势工具远程依赖有了可 review、可 CI 阻断的清单。
- `latest` 模型路径被显式标记为后续自托管/hash pin 工作，不再埋在源码常量里，也会显示在手势工具确认区。
- 供应链治理范围从本地 vendor 扩展到按需远程 runtime。

🔗 相关建议引用

- `security-audit.md` 中 S-13 手势工具供应链风险。
- `performance-bottlenecks.md` 中 P-14 手势工具远程模型冷启动风险。

## 📌 MR-ASSET-02 [已修复]：第三方资源提示在所有页面无条件输出

📍 位置（文件路径 + 行号范围）

- `src/templates/layout.mjs`
- `src/templates/post.mjs`
- `js/subscribe.js`
- `tests/templates.test.mjs`
- `tests/performance.test.mjs`
- `tests/share-subscribe-feedback-deep.test.mjs`

📝 当前状况描述

公共模板现在默认只输出低成本 `dns-prefetch`：Giscus、Buttondown、爱发电和 PayPal 域名仍可被浏览器预解析。较重的 `preconnect` 已改为按页面能力或用户动作触发：文章页和文章列表页通过 `resourceHintCapabilities: ["comments"]` 保留 `https://giscus.app` 预连接；Buttondown 预连接不再静态写入 HTML，而是在订阅邮箱获得焦点、订阅弹窗打开或提交前由 `js/subscribe.js` 动态插入一次。

⚠️ 影响程度（高/中/低）

低到中。核心风险已收敛：普通页面不再无条件预连第三方域名；评论页仍保留高概率评论加载的预热收益。

💡 建议方案（含伪代码或示例片段）

已把资源提示改为按页面能力生成：全站保留低成本 DNS hint，评论页保留 Giscus preconnect，订阅 preconnect 延迟到用户意图出现后插入。测试会扫描已提交 HTML，要求 `giscus.app` preconnect 只出现在加载 `/js/giscus.js` 的页面，并禁止提交的 HTML 静态包含 Buttondown preconnect。

```js
const CAPABILITY_RESOURCE_HINTS = {
  comments: [{ rel: "preconnect", href: "https://giscus.app" }],
  subscribe: [{ rel: "preconnect", href: "https://buttondown.com" }],
};
```

📊 预期收益

- 减少普通页面的第三方连接噪声。
- 保留文章页评论区的预热收益。
- 让测试从“所有页面必须有所有 hint”升级为“页面需要什么才输出什么”。

🔗 相关建议引用

- `performance-bottlenecks.md` 中关于资源加载策略的建议。
- `module-reviews/user-data-entrypoints.md` 中关于第三方外连边界的建议。

## 📌 MR-ASSET-03 [已修复]：`robots.txt` 屏蔽本地 JS vendor 目录，可能削弱渲染型抓取

📍 位置（文件路径 + 行号范围）

- `scripts/build.mjs`
- `robots.txt`
- `tests/build-extra.test.mjs:232-240`

📝 当前状况描述

`robots.txt` 当前允许站点主体路径，并已移除 `Disallow: /js/vendor/` 和 `Disallow: /css/fontawesome/`。构建脚本现在显式输出 `Allow: /js/`、`Allow: /css/` 和 `Allow: /webfonts/`，避免遵守 robots 的渲染型爬虫被本地运行时脚本、CSS 或字体资源挡住。测试也已改为断言公开渲染资源不被屏蔽。

⚠️ 影响程度（高/中/低）

低到中。核心风险已收敛：公开渲染资源不再被 robots 屏蔽。

💡 建议方案（含伪代码或示例片段）

已默认不屏蔽公开渲染资源，只通过 sitemap 和合理链接结构引导抓取。

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

## 📌 MR-ASSET-05 [已修复]：性能预算以原始单文件大小为主，缺少路由级和压缩后预算

📍 位置（文件路径 + 行号范围）

- `tests/performance.test.mjs`
- `index.html`
- `post/rule-engine-alerts/index.html`
- `tools/index.html`

📝 当前状况描述

性能测试已经覆盖 HTML、非 vendor JS、CSS、搜索索引、sitemap、RSS、vendor 文件存在性、CSS 路由预算和关键路由真实资源预算。新增 `routeBudget()` 会解析 HTML 的本地 CSS/JS/图片引用，统计 HTML 与资源的 raw/gzip 总量，并对首页、文章页和工具页设置总预算、JS 子预算和本地资源数量预算。当前基线约为：首页 260 KB raw / 61 KB gzip，文章页 305 KB / 79 KB，工具页 668 KB / 171 KB。

⚠️ 影响程度（高/中/低）

中。核心风险已收敛：关键路由整体变重会被 `tests/performance.test.mjs` 直接拦截。后续可继续扩展到图片变体、字体间接引用和 brotli 预算。

💡 建议方案（含伪代码或示例片段）

已新增 route budget 测试：解析 HTML 中的 CSS/JS/image 引用，按页面类型统计原始大小和 gzip 大小。对首页、文章页、工具页分别设置预算，并单独限制 JS raw/gzip 体积。

```js
async function routeBudget(htmlFile) {
  const html = await readFile(htmlFile, "utf8");
  const assets = extractLocalAssets(html);
  const rawBytes = await sumSize([htmlFile, ...assets]);
  const gzipBytes = await gzipSize([html, ...await readAssets(assets)]);
  return { rawBytes, gzipBytes, assets };
}

test("route asset budgets cover real HTML CSS JS and image references", async () => {
  const budget = await routeBudget("tools/index.html");
  assert.ok(budget.total.gzipBytes < 178 * 1024);
  assert.ok(budget.js.gzipBytes < 132 * 1024);
});
```

📊 预期收益

- 更早发现路由整体变重，而不是等单个文件越过阈值。
- 能区分普通内容页和工具页的合理预算。
- 为后续性能优化提供更贴近用户体验的数据。

🔗 相关建议引用

- `performance-bottlenecks.md` 中关于资源体积预算的建议。
- `devex-improvements.md` 中关于 CI 性能门禁的建议。

## 📌 MR-ASSET-06 [已修复]：生产验证只检查图片 alt，未覆盖尺寸、懒加载和解码策略

📍 位置（文件路径 + 行号范围）

- `scripts/validate-production.mjs`
- `tests/workflows.test.mjs`
- `scripts/build.mjs:176-201`
- `tests/build-deep.test.mjs:209-225`
- `src/templates/sponsor.mjs:64-68`
- `src/templates/tools.mjs:560-560`

📝 当前状况描述

构建脚本会为 Markdown 正文图片补 `loading="lazy"` 和 `decoding="async"`，赞助二维码和工具箱 QR 图片也已经有宽高与加载属性。此前生产验证脚本只检查首页和文章列表图片是否有 `alt`；当前已扩展为递归扫描 20 个已提交 HTML 页面，检查图片 `alt`、非 SVG/非隐藏图片 `width`/`height`、显式 `loading` 策略和 `decoding="async"`。允许 `fetchpriority="high"` 作为首屏关键图的显式加载策略入口。

⚠️ 影响程度（高/中/低）

低到中。核心风险已收敛：现有关键图片和后续新增 HTML 图片都会被生产验证统一检查。

💡 建议方案（含伪代码或示例片段）

已扩展生产验证：对非 SVG、非隐藏占位图要求宽高；对图片要求显式 `loading` 策略与 `decoding="async"`；允许首屏关键图显式使用 `fetchpriority="high"`。

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
