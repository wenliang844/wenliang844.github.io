# 真实浏览器与视觉冒烟测试风险分析

生成时间：2026-07-03  
分析范围：`package.json` 测试脚本、GitHub Actions 质量门禁、静态 HTML/性能/无障碍测试、本地静态服务页面读取、工具箱浏览器 API 交互面。  
本轮验证：

- 本地只读静态服务：`/`、`/tools/`、`/ai/`、`/post/`、`/contact/`、`/trust/` 均返回 200。
- 页面抽样结果：`/tools/` 约 104900 字符、15 个脚本引用，是当前最需要真实浏览器冒烟覆盖的页面。
- 自动化测试：`npm run test:http-smoke` 6/6 路由通过；`npm run test:browser-smoke` 覆盖桌面 6 个关键路径、移动端 4 个关键路径和 `/tools/` JSON/随机数、Galaxy Canvas、UUID Clipboard、手势远程运行时确认门闩；`node --test tests/workflows.test.mjs`，9/9 通过；`npm run test:coverage`，789/789 通过。
- 实际发现并修复：真实浏览器 mobile `/post/` 冒烟暴露首个 `h1` 位于默认隐藏的浮动文章目录内，随后静态 a11y 门禁发现 `post/index.html` 存在双 `h1`；已将目录标题改为 `.post-tree-title`，页面保留单一可见 `h1`。
- 约束说明：真实浏览器 smoke 已作为 `npm run test:browser-smoke` 固化，暂未接入主 CI；待稳定运行一段时间后再考虑 nightly 或单独可选 job。

## 总览

当前测试体系对静态结构、模板输出、JSDOM 行为和 CI 工作流都有较强覆盖；本轮已经补上一条最小真实浏览器 smoke：“启动静态站点 -> 用 Chromium/Edge 打开关键页面 -> 检查控制台错误、页面错误、同源 4xx/失败请求、可见 main/H1、响应式横向溢出和工具箱核心交互”。剩余风险主要集中在截图证据、焦点路径、Canvas/Clipboard/摄像头降级和 CI artifact：这些模块大量依赖真实浏览器布局、权限、媒体设备、Canvas/WebGL、Clipboard 和滚动 API，JSDOM 测试仍很难完整发现视觉错位、焦点逃逸、权限提示和真实 CSS 断点问题。

严重程度分布：

- 高：0
- 中：5
- 低：1

## 本轮观察记录

| 页面 | HTTP 状态 | 页面长度 | H1 | 脚本数 | 样式表数 |
| --- | ---: | ---: | --- | ---: | ---: |
| `/` | 200 | 20687 | AI 全栈工程师 | 8 | 2 |
| `/tools/` | 200 | 104900 | 在线工具箱 | 15 | 2 |
| `/ai/` | 200 | 30540 | 中转站排名 | 10 | 2 |
| `/post/` | 200 | 85937 | 文章 | 12 | 2 |
| `/contact/` | 200 | 10853 | 关于CWL | 9 | 2 |
| `/trust/` | 200 | 25575 | 本站如何处理数据 | 7 | 2 |

## 建议清单

### 1. [已部分落地] 真实浏览器冒烟测试已固化，CI 门禁仍待稳定后接入

- 📌 问题/建议标题：增加最小 Playwright/浏览器冒烟门禁
- 📍 位置：`package.json:12-22`、`scripts/browser-smoke.mjs`、`tests/workflows.test.mjs:30-150`、`.github/workflows/ci.yml:27-48`
- ✅ 落地状态：新增 `scripts/browser-smoke.mjs` 和 `npm run test:browser-smoke`，脚本会启动本地静态服务，用 Playwright Chromium 打开 `/`、`/tools/`、`/ai/`、`/post/`、`/contact/`、`/trust/` 桌面视口，以及 `/`、`/tools/`、`/post/`、`/trust/` 移动视口；同时检查 `main#main-content`、可见 H1、横向溢出、控制台错误、页面错误、同源 4xx/失败请求，并覆盖 `/tools/` JSON 格式化、随机数安全提示、Galaxy Canvas 非空像素、UUID Clipboard 复制和手势远程运行时确认门闩。
- 🧪 回归测试：`tests/workflows.test.mjs` 已加入脚本契约断言，覆盖关键路由、桌面/移动视口、运行时错误收集、横向溢出检查和工具交互选择器。真实浏览器运行曾发现 mobile `/post/` H1 检测落到隐藏目录标题；静态门禁进一步发现双 `h1`，现已通过单一可见 `h1` 和 `.post-tree-title` 修复。
- 📝 剩余状况描述：CI 当前仍只运行 HTTP smoke，尚未把 Playwright smoke 放进主质量门禁。保守原因是 GitHub runner 需要安装浏览器依赖，运行时间和偶发资源加载噪声都高于 Node/JSDOM 测试；更适合先作为本地发布前检查或 nightly/可选 job。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```json
{
  "scripts": {
    "test:browser-smoke": "npx --yes --package=playwright node scripts/browser-smoke.mjs"
  }
}
```

```js
import { test, expect } from "@playwright/test";

for (const path of ["/", "/tools/", "/ai/", "/post/", "/contact/"]) {
  test(`${path} opens without console errors`, async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
```

CI 中可先把现有 `test:browser-smoke` 放入可选 job 或 nightly，只跑 Chromium 和 5 个关键路径；稳定后再扩展截图、trace、焦点路径和更多工具交互。

- 📊 实际收益：已经把“页面能构建”升级为“关键页面能在真实浏览器中打开并完成基础交互”，并真实拦截了移动端 `/post/` 可见标题缺失。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/test-coverage-risk-map.md`、`docs/suggestions/module-reviews/ci-release-automation-review.md`、`docs/suggestions/devex-improvements.md`。

### 2. [已修复] 按钮可访问名称测试存在静态正则盲区

- 📌 问题/建议标题：用 DOM 解析替代 `<button>` 开始标签正则
- 📍 位置：`tests/i18n-a11y.test.mjs:103-116`
- ✅ 修复状态：`interactive elements have accessible labels` 已改用 JSDOM 解析已提交 HTML，并通过 `aria-labelledby`、`aria-label`、`title` 和 `textContent` 计算按钮可访问名称；失败信息会输出按钮 id/class/type，便于定位。
- 🧪 回归测试：`node --test tests/i18n-a11y.test.mjs` 16/16 通过，更严格的 DOM 检查未发现当前页面按钮缺失名称。
- 📝 当前状况描述：`interactive elements have accessible labels` 测试用 `html.match(/<button[^>]*>/g)` 只抓取按钮开始标签，然后判断 `!btn.includes(">")`。由于每个开始标签都包含 `>`，这个分支不会进入，实际无法检查按钮可见文本、`aria-label`、`aria-labelledby` 或图标按钮名称。本轮该测试通过，但通过结果主要说明没有触发失败条件，不能代表所有按钮都具备真实可访问名称。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
import { JSDOM } from "jsdom";

function buttonName(button) {
  const labelledby = button.getAttribute("aria-labelledby");
  if (labelledby) {
    return labelledby
      .split(/\s+/)
      .map((id) => button.ownerDocument.getElementById(id)?.textContent || "")
      .join(" ")
      .trim();
  }
  return (
    button.getAttribute("aria-label") ||
    button.getAttribute("title") ||
    button.textContent ||
    ""
  ).trim();
}

for (const button of dom.window.document.querySelectorAll("button")) {
  assert.ok(buttonName(button), `${file}: button missing accessible name`);
}
```

后续如果引入 Playwright，可再用浏览器级 Locator 断言关键按钮 `toBeVisible()`、`toHaveAttribute()` 和键盘可达性。

- 📊 实际收益：避免“测试通过但检查逻辑空转”，更早发现图标按钮、动态按钮和多语言切换后的可访问名称缺失。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md`、`docs/suggestions/ux-improvements.md`、`docs/suggestions/full-browser-audit-2026-07-03.md`。

### 3. [已部分落地] 性能测试偏静态文件检查，截图基线仍待补充

- 📌 问题/建议标题：为关键页面增加响应式布局和截图 smoke
- 📍 位置：`tests/performance.test.mjs:19-90`、`tests/performance.test.mjs:145-183`、`package.json:21-22`
- ✅ 落地状态：`scripts/browser-smoke.mjs` 已在桌面和移动视口检查关键路径横向溢出，覆盖 `/tools/` 桌面交互和移动端页面可见 H1。
- 📝 剩余状况描述：性能测试目前主要检查 HTML/JS/CSS 文件大小、资源引用存在、favicon、重复脚本、搜索索引和 RSS 大小。真实浏览器 smoke 已补上低噪声的 overflow 信号，但仍没有截图基线、打印预览、固定按钮安全区和浮层遮挡证据。本轮 `/tools/` 页面体积和脚本数最高，且包含多工具分区、Canvas、API 调试、Markdown 编辑等复杂 UI，仍是视觉截图和交互扩展优先级最高的路径。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const viewports = [
  { width: 390, height: 844, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1366, height: 768, name: "desktop" },
];

for (const viewport of viewports) {
  test(`tools page has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/tools/");
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page).toHaveScreenshot(`tools-${viewport.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
}
```

截图可以先只在本地或 nightly job 运行，主 CI 先保留 overflow、H1、核心控件可见性等低噪声断言。

- 📊 实际收益：移动端文章列表标题缺失和关键路径横向溢出已进入可重复检查；截图和 trace 证据仍是下一步收益点。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/layout-responsive-print-review.md`、`docs/suggestions/performance-bottlenecks.md`、`docs/suggestions/module-reviews/product-info-pages-and-rankings.md`。

### 4. [已部分落地] 工具箱真实浏览器 API 面积大，摄像头授权失败路径仍待扩展

- 📌 问题/建议标题：给摄像头、Canvas/WebGL、Clipboard 增加真实环境 smoke
- 📍 位置：`src/templates/tools.mjs:865-923`、`js/gesture.js:279-285`、`js/gesture.js:520-535`、`js/gesture.js:565-612`、`js/object-search.js:109-127`、`js/object-search.js:295-297`、`js/galaxy.js:112-120`、`js/galaxy.js:613-661`、`js/relay.js:70-71`、`js/overleaf.js:854-855`
- ✅ 落地状态：`scripts/browser-smoke.mjs` 已扩展 `/tools/` 真实浏览器交互：点击 Galaxy tab 后等待 `#galaxy-canvas` 具备非零尺寸和非空像素；生成 UUID 后通过真实 `navigator.clipboard.readText()` 验证复制内容；进入手势 tab 后确认未勾选第三方运行时说明时 `#gesture-start` 禁用，勾选 `.gesture-consent` 后启动按钮才放开。
- 🧪 回归测试：`tests/workflows.test.mjs` 已约束 `assertCanvasHasPixels`、`#galaxy-canvas`、`data-uuid-generate`、`navigator.clipboard.readText`、`#gesture-start` 和 `.gesture-consent` 保留在 browser smoke 中。
- 📝 剩余状况描述：工具箱页面包含手势识别画布、星河动画画布、物体识别摄像头、Clipboard 复制、WebGLRenderer、requestAnimationFrame 动画和大量尺寸计算。现有 browser smoke 已覆盖 Canvas/Clipboard/摄像头启动门闩的低噪声路径，但尚未实际授予/拒绝摄像头、加载 MediaPipe/Three.js 外部模型，或验证 WebGLRenderer 失败兜底。JSDOM mock 仍很难覆盖真实权限弹窗、非安全上下文限制、设备不可用、WebGL 初始化失败、DPR 缩放和移动端触摸坐标偏移。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
test.use({
  permissions: ["clipboard-read", "clipboard-write", "camera"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test("tools browser APIs expose graceful fallback", async ({ page }) => {
  await page.goto("/tools/#gesture");
  await expect(page.locator("#gesture-canvas")).toBeVisible();
  await page.goto("/tools/#galaxy");
  await expect(page.locator("#galaxy-canvas")).toBeVisible();
  await page.goto("/ai/");
  await page.locator("[data-copy]").first().click();
});
```

首轮不必追求完整功能验证，优先断言“页面不崩、关键 Canvas 非零尺寸、权限失败有用户可见反馈、控制台无未捕获错误”。

- 📊 实际收益：Galaxy canvas 空白、Clipboard 权限/复制状态、手势确认门闩这三类真实浏览器问题已进入可重复 smoke；摄像头授权失败、外部视觉模型和 WebGL 兜底仍是后续扩展点。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/tools-gesture-and-api.md`、`docs/suggestions/module-reviews/tools-core-runtime-safety.md`、`docs/suggestions/module-reviews/visual-interactions.md`。

### 5. [已修复] 静态服务可用性检查已固化为脚本

- 📌 问题/建议标题：把关键路径 HTTP smoke 固化为轻量脚本
- 📍 位置：`package.json:21-22`、`.github/workflows/ci.yml:39-45`
- ✅ 修复状态：新增 `scripts/http-smoke.mjs` 和 `npm run test:http-smoke`，脚本会启动本地静态服务，访问 `/`、`/tools/`、`/ai/`、`/post/`、`/contact/`、`/trust/`，并检查 200、HTML content-type、`main#main-content`、`h1` 和本地脚本引用可达。CI 在 `npm run build` 后执行该 smoke。
- 🧪 回归测试：`npm run test:http-smoke` 6/6 路由通过；`node --test tests/workflows.test.mjs` 9/9 通过，覆盖 npm 脚本、CI 步骤和关键路由清单。
- 📝 原状况描述：本轮通过本地静态服务读取了 5 个关键路径，能快速发现 404、路由目录缺失、生成产物为空、H1 缺失和脚本引用异常。但这个步骤此前没有固化为 npm 脚本或 CI 步骤；`serve` 只负责启动静态服务，`validate:production` 和测试组更多是静态文件扫描。若未来某个目录页面缺失但文件扫描没有覆盖到用户入口，可能仍需人工打开才发现。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const routes = ["/", "/tools/", "/ai/", "/post/", "/contact/"];

for (const route of routes) {
  const res = await fetch(`http://127.0.0.1:${port}${route}`);
  assert.equal(res.status, 200, `${route} should be reachable`);
  const html = await res.text();
  assert.match(html, /<h1\b/i, `${route} should include an h1`);
  assert.match(html, /<script\b/i, `${route} should include runtime scripts`);
}
```

可以把它作为 `test:http-smoke`，运行成本低于 Playwright，适合作为浏览器测试前的快速守门。

- 📊 实际收益：把本轮人工验证沉淀为可重复门禁，优先拦截最基础的站点可达性问题。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/ci-release-automation-review.md`、`docs/suggestions/module-reviews/search-and-seo-pipeline.md`。

### 6. 浏览器测试失败时缺少可追溯证据设计

- 📌 问题/建议标题：为 screenshot、trace、console log 预留 CI artifact
- 📍 位置：`.github/workflows/ci.yml:27-48`、`tests/workflows.test.mjs:30-37`
- 📝 当前状况描述：当前 CI 主要输出命令日志；如果后续加入浏览器测试，单纯失败日志很难解释视觉错位、焦点逃逸、浮层遮挡或动画空白。没有 artifact 约定时，失败后开发者需要本地复现，排查成本会明显高于单元测试。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```yaml
- name: Run browser smoke
  run: npm run test:browser

- name: Upload browser artifacts
  if: failure()
  uses: actions/upload-artifact@v5
  with:
    name: browser-smoke-artifacts
    path: |
      test-results/
      playwright-report/
```

同时在测试中收集 `console` 和 `pageerror`，失败信息中附带路径、视口和浏览器名称。

- 📊 预期收益：让浏览器回归具备截图和 trace 证据，减少“CI 红了但看不出来哪里坏”的排查时间。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/ci-release-automation-review.md`、`docs/suggestions/devex-improvements.md`。

## 建议落地顺序

1. 已修复 `tests/i18n-a11y.test.mjs` 的按钮可访问名称检查，让现有 Node 测试变得真实有效。
2. 已增加 `test:http-smoke`，把本轮 6 个关键路径的 200/H1/脚本检查固化。
3. 已引入最小 Playwright Chromium smoke，覆盖 `/`、`/tools/`、`/ai/`、`/post/`、`/contact/`、`/trust/` 桌面路径和移动端 `/`、`/tools/`、`/post/`、`/trust/`。
4. 已为关键路径增加移动端和桌面端横向溢出检查；后续可扩展截图基线。
5. 已对工具箱 Galaxy Canvas、Clipboard 和摄像头启动确认门闩补充真实浏览器测试；摄像头授权失败和外部模型加载路径留作下一步。
6. 浏览器测试稳定后再加入截图基线和失败 artifact。
