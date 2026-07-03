# 信任页上线闭环与烟测治理专题分析

生成时间：2026-07-03

分析范围：`/trust/` 信任页模板与数据、静态页配置、构建输出、HTTP smoke、浏览器 smoke、工作流测试、i18n 运行时和信任页样式。

本轮验证：

- `node --test tests/templates.test.mjs tests/templates-extended.test.mjs tests/i18n-deep.test.mjs tests/workflows.test.mjs`：64/64 通过。
- `node --test tests/build.test.mjs`：3/3 通过，新增 `STATIC_PAGES` 已登记路径必须存在已提交 `index.html` 的只读门禁。
- `node --test tests/workflows.test.mjs tests/build.test.mjs tests/templates-extended.test.mjs`：48/48 通过，新增 `SMOKE_ROUTES` / `MOBILE_SMOKE_ROUTES` 配置源守卫。
- `npm run test:http-smoke`：6 个由 `STATIC_PAGES` 派生的路由全部通过，包含 `/trust/`。
- `npm run test:browser-smoke`：桌面与移动关键路由、`/trust/`、工具箱 JSON/Galaxy/UUID/Gesture 交互全部通过。
- 复核 `src/config.mjs`、`src/templates/trust.mjs`、`src/trust-data.mjs`、`scripts/http-smoke.mjs`、`scripts/browser-smoke.mjs`、`tests/workflows.test.mjs`、`css/coder.css`。

## 总览

信任页的基础上线质量已经较好：`STATIC_PAGES`、`SEARCH_PAGES`、构建脚本、导航、页脚、模板测试、HTTP smoke 和浏览器 smoke 都已覆盖 `/trust/`，页面也能在桌面和移动视口通过真实浏览器检查。

剩余风险不在“页面是否存在”，而在“新增页面时有哪些清单需要同步”。当前 `STATIC_PAGES` 已经同时驱动 sitemap、静态产物检查、HTTP smoke 和浏览器 smoke 的关键路由；新增页面时不再需要在两个 smoke 脚本里重复维护数组。后续主要风险转向信任页声明本身是否跟真实本机存储、第三方域名和源码密钥扫描持续一致。

严重程度分布：

- 高：0
- 中：1
- 低：3

## 建议清单

### 📌 MR-TRUST-LAUNCH-01 [已修复]：用静态路由清单驱动 smoke 路由，减少多处手写数组漂移

📍 位置（文件路径 + 行号范围）

- `src/config.mjs:22-36`
- `scripts/http-smoke.mjs:8-10`
- `scripts/browser-smoke.mjs:8-13`
- `tests/workflows.test.mjs:127-148`

📝 当前状况描述

`src/config.mjs` 已新增 `SMOKE_ROUTES` 和 `MOBILE_SMOKE_ROUTES`，它们从 `STATIC_PAGES` 中的 `smoke` / `mobileSmoke` 字段派生。`scripts/http-smoke.mjs` 直接导入 `SMOKE_ROUTES`，`scripts/browser-smoke.mjs` 直接导入桌面和移动路由清单；工作流测试改为验证这些路由均来自 `STATIC_PAGES`，并确认两个脚本消费配置源。

⚠️ 影响程度（高/中/低）

已修复。

💡 建议方案（含伪代码或示例片段）

已把 smoke 路由从 `STATIC_PAGES` 生成，而不是在两个脚本里重复维护数组。关键页面用字段显式加入 smoke 集合，移动端路由用 `mobileSmoke` 独立标记。

```js
export const SMOKE_ROUTES = STATIC_PAGES.filter((page) => page.smoke).map((page) => page.path);
export const MOBILE_SMOKE_ROUTES = STATIC_PAGES.filter((page) => page.mobileSmoke).map((page) => page.path);
```

配套测试已从“正则匹配固定数组”改成“脚本导出的路由覆盖 `STATIC_PAGES` 中的关键页”。

📊 预期收益

- 新增页面只需改一处权威清单，烟测自动跟进。
- 减少测试为了匹配源码字面量而产生的维护成本。
- 避免路由清单、构建产物和浏览器验证出现短暂不同步。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/build-artifact-synchronization.md`
- `/docs/suggestions/module-reviews/privacy-and-trust-center.md`

### 📌 MR-TRUST-LAUNCH-02 [已修复]：新增“已登记静态页必须存在生成产物”的只读门禁

📍 位置（文件路径 + 行号范围）

- `src/config.mjs:22-36`
- `scripts/build.mjs:604-605`
- `scripts/http-smoke.mjs:131-148`
- `trust/index.html:1-20`

📝 当前状况描述

`tests/build.test.mjs` 已新增只读门禁：直接读取 `STATIC_PAGES`，把 `/` 映射到根目录 `index.html`，把其它静态路径映射到 `<path>/index.html`，并通过 `git ls-files` 确认每个已登记页面都有已跟踪 HTML 产物和 `main#main-content`。这样新增页面如果只改配置或构建逻辑、忘记提交根目录静态产物，会在本地测试和 CI 中直接失败。

⚠️ 影响程度（高/中/低）

已修复。

💡 建议方案（含伪代码或示例片段）

已增加只读检查：读取 `STATIC_PAGES`，对每个登记页面确认仓库根目录存在且 Git 跟踪对应 `index.html`。后续仍可再扩展为“临时构建输出与已提交产物内容漂移比较”。

```js
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { STATIC_PAGES } from "../src/config.mjs";

const tracked = await trackedFiles();

function indexPathForRoute(root, route) {
  const segments = route.split("/").filter(Boolean);
  return join(root, ...segments, "index.html");
}

function indexArtifactForRoute(route) {
  const segments = route.split("/").filter(Boolean);
  return segments.length ? `${segments.join("/")}/index.html` : "index.html";
}

async function trackedFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: ROOT, windowsHide: true });
  return new Set(stdout.trim().split(/\r?\n/).filter(Boolean));
}

for (const page of STATIC_PAGES) {
  const artifact = indexArtifactForRoute(page.path);
  assert.ok(tracked.has(artifact));
  const html = await readFile(indexPathForRoute(rootDir, page.path), "utf8");
  assert.match(html, /<main\b[^>]*\bid=["']main-content["']/i);
}
```

📊 预期收益

- 在 CI 中直接阻止“路由已登记但产物 404”的提交。
- 让静态站点发布更接近真实 GitHub Pages 行为。
- 与构建漂移检查互补，分别覆盖“文件是否存在”和“内容是否最新”。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/build-artifact-synchronization.md#mr-build-sync-01`
- `/docs/suggestions/module-reviews/browser-visual-smoke-testing.md`

### 📌 MR-TRUST-LAUNCH-03：为信任页数据建立“事实来源”测试，避免隐私承诺过期

📍 位置（文件路径 + 行号范围）

- `src/trust-data.mjs:1-17`
- `src/trust-data.mjs:19-50`
- `src/trust-data.mjs:52-118`
- `src/templates/trust.mjs:90-123`

📝 当前状况描述

信任页声明 “0 内置私密 API key”、“本机优先”、“外发请求由用户动作触发”，并列出本机数据和第三方服务。页面本身是用户信任承诺，维护要求比普通介绍页更高。现在这些内容以手写数组维护，测试确认它能渲染，但没有自动验证“列出的存储 key 覆盖真实 localStorage/sessionStorage 使用”、“第三方服务覆盖 CSP/脚本/表单/跳转域名”、“0 内置私密 API key 与源码扫描结果一致”。

⚠️ 影响程度（高/中/低）

中。

💡 建议方案（含伪代码或示例片段）

增加 trust facts 测试，把源码扫描结果与 `src/trust-data.mjs` 做弱耦合校验。

```js
const source = await readAllSource(["js", "src"]);
const externalHosts = collectHosts(source, [
  /https:\/\/([^/"')]+)/g,
  /form-action[^"]+/g
]);
const documentedHosts = THIRD_PARTY_SERVICES.flatMap((service) => service.hosts ?? [service.host]);

assert.ok(documentedHosts.some((host) => host.includes("giscus.app")));
assert.deepEqual(findSecretLikeTokens(source), []);
for (const host of externalHosts) {
  assert.ok(documentedHosts.some((docHost) => docHost.includes(host)), `${host} is not documented`);
}
```

📊 预期收益

- 把隐私页面从“静态说明”升级为可回归的信任契约。
- 新增第三方服务、本机存储 key 或 API key 扫描规则时能及时提醒维护者更新页面。
- 降低用户看到过期隐私承诺的风险。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/local-data-retention-map.md`
- `/docs/suggestions/module-reviews/dependency-supply-chain-posture.md`
- `/docs/suggestions/security-audit.md`

### 📌 MR-TRUST-LAUNCH-04：第三方服务数据结构避免用 `"host A / host B"` 字符串承载多个来源

📍 位置（文件路径 + 行号范围）

- `src/trust-data.mjs:92-117`
- `src/templates/trust.mjs:26-52`
- `src/templates/trust.mjs:145-164`

📝 当前状况描述

`THIRD_PARTY_SERVICES` 中部分服务用 `"cdn.jsdelivr.net / storage.googleapis.com"`、`"ifdian.net / paypal.me"` 表示多个 host。模板展示没问题，但 JSON-LD 通过 `service.host.split(" / ")[0]` 只取第一个 host 生成 `Service.url`。这会让结构化数据只表达部分服务来源，也让未来做 CSP/外链/隐私披露自动校验时必须解析展示字符串。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

把 host 改为结构化数组，并为展示和 JSON-LD 分别生成输出。

```js
{
  hosts: ["cdn.jsdelivr.net", "storage.googleapis.com"],
  displayHost: "cdn.jsdelivr.net / storage.googleapis.com",
  name: "手势工具运行时资源"
}

item: {
  "@type": "Service",
  name: service.name,
  serviceType: service.purpose,
  url: `https://${service.hosts[0]}`,
  sameAs: service.hosts.slice(1).map((host) => `https://${host}`)
}
```

📊 预期收益

- JSON-LD 更准确，SEO 和结构化数据表达更完整。
- 后续自动校验 CSP、外链、资源提示和信任页披露时不需要解析人类展示文案。
- 降低新增多域名服务时遗漏披露的概率。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/csp-resource-policy-review.md`
- `/docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`

### 📌 MR-TRUST-LAUNCH-05 [已修复]：浏览器 smoke 的剪贴板断言应增加能力探测和失败降级

📍 位置（文件路径 + 行号范围）

- `scripts/browser-smoke.mjs:215-254`
- `tests/workflows.test.mjs:137-148`
- `js/utils.js:43-50`
- `tests/tools.test.mjs:1612-1721`

📝 当前状况描述

真实浏览器 smoke 现在分层验证 UUID 复制：默认模式必须看到 `#uuid-status` 的“已复制 / Copied”反馈，覆盖用户可见结果；只有设置 `STRICT_CLIPBOARD_SMOKE=1` 时才要求 `navigator.clipboard.readText()` 可用并读回系统剪贴板。这样 CI 默认路径不再被浏览器权限模型差异拖垮，本地或专门环境仍能运行严格剪贴板读回。

⚠️ 影响程度（高/中/低）

已修复。

💡 建议方案（含伪代码或示例片段）

已把“复制状态反馈”和“系统剪贴板真实读回”拆成两级断言：默认必须检查状态反馈；显式设置 `STRICT_CLIPBOARD_SMOKE=1` 时才读回系统剪贴板，且严格模式下如果缺少 `navigator.clipboard.readText()` 会失败。

```js
await page.click('[data-copy-target="uuid-output"]');
await expectStatus("#uuid-status", /已复制|Copied/);

const canReadClipboard = await page.evaluate(() =>
  Boolean(navigator.clipboard && navigator.clipboard.readText)
);

if (process.env.STRICT_CLIPBOARD_SMOKE === "1") {
  assert.ok(canReadClipboard);
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText, uuid);
}
```

📊 预期收益

- 保留对核心复制体验的覆盖，同时降低 CI 环境差异导致的误报。
- 让本地严格烟测和 CI 稳定烟测可以按环境分层运行。
- 与现有 `CWLUtils.copyText` fallback 测试形成互补。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/browser-visual-smoke-testing.md`
- `/docs/suggestions/module-reviews/tools-core-runtime-safety.md`

### 📌 MR-TRUST-LAUNCH-06：信任页英文文案建议生成 i18n 覆盖报告

📍 位置（文件路径 + 行号范围）

- `src/templates/trust.mjs:5-7`
- `src/templates/trust.mjs:75-131`
- `js/i18n.js:19-57`
- `js/i18n.js:809-852`

📝 当前状况描述

信任页大量使用 `data-i18n-en` / `data-i18n-en-html` 内联英文文案，这是 i18n 运行时支持的模式，也能避免把整页内容塞进 `js/i18n.js` 字典。问题是维护可见性：英文文案分散在模板和 `src/trust-data.mjs`，全局字典只包含导航、页头和少量共用文案。未来改中文文案、复制页面区块或新增数据项时，容易漏掉对应英文，测试目前只验证页面能渲染和语言切换能力，没有输出“哪些 key 来自字典，哪些 key 来自内联英文，哪些 key 缺失英文”。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

新增一个 i18n 覆盖检查，扫描生成 HTML 中所有 `data-i18n*`，把英文来源分类，并在缺少字典和内联英文时失败。

```js
for (const node of document.querySelectorAll("[data-i18n], [data-i18n-aria], [data-i18n-title], [data-i18n-ph]")) {
  const key = node.getAttribute("data-i18n") || node.getAttribute("data-i18n-aria");
  const hasInline =
    node.hasAttribute("data-i18n-en") ||
    node.hasAttribute("data-i18n-en-html") ||
    node.hasAttribute("data-i18n-en-aria");
  assert.ok(EN[key] || hasInline, `${key} has no English source`);
}
```

📊 预期收益

- 新增页面时能快速发现缺失英文文案。
- 保留内联文案模式的灵活性，同时提升可审计性。
- 降低中英页面内容长期不一致的维护风险。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/i18n-and-accessibility.md`
- `/docs/suggestions/module-reviews/privacy-and-trust-center.md`

### 📌 MR-TRUST-LAUNCH-07：信任页视觉回归应记录关键区块截图和布局预算

📍 位置（文件路径 + 行号范围）

- `css/coder.css:1689-1770`
- `css/coder.css:6575-6590`
- `scripts/browser-smoke.mjs:193-212`
- `scripts/browser-smoke.mjs:215-268`

📝 当前状况描述

浏览器 smoke 已确认 `/trust/` 在桌面与移动视口可见、无横向溢出、无运行时错误。现有 smoke 更偏结构和交互，不保留截图，也不检查信任页专属区块数量、卡片折行、服务事实表在移动端的可读性或 CTA 是否进入首屏下方合理位置。信任页承担“用户理解数据流”的任务，布局回归对可信度影响比普通静态页更直接。

⚠️ 影响程度（高/中/低）

低。

💡 建议方案（含伪代码或示例片段）

在浏览器 smoke 或单独 visual smoke 中为 `/trust/` 增加轻量布局预算，必要时保存截图到临时目录或 CI artifact。

```js
await page.goto(`${baseUrl}/trust/`, { waitUntil: "load" });
await assertVisible(page.locator(".trust-card").first(), "trust local data card");
await assertVisible(page.locator(".trust-service").first(), "trust third-party service");

const metrics = await page.evaluate(() => ({
  services: document.querySelectorAll(".trust-service").length,
  cards: document.querySelectorAll(".trust-card").length,
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
}));

assert.equal(metrics.cards, 3);
assert.ok(metrics.services >= 5);
assert.ok(metrics.overflow <= 2);
```

📊 预期收益

- 除“页面能打开”之外，锁定信任页核心信息是否仍可见。
- 降低 CSS 后续改动导致卡片折行、服务表压缩或 CTA 遗失的风险。
- 为后续视觉报告和截图基线提供入口。

🔗 相关建议引用

- `/docs/suggestions/module-reviews/browser-visual-smoke-testing.md`
- `/docs/suggestions/ux-improvements.md`

## 建议优先级

1. 中优先级：把信任页数据与源码扫描结果建立事实来源测试。
2. 低优先级：把多 host 第三方服务改为结构化数组，改善 JSON-LD 和校验能力。
3. 低优先级：生成 i18n 覆盖报告，区分字典英文、内联英文和缺失英文。
4. 低优先级：为 `/trust/` 增加专属视觉布局预算和截图 artifact。
