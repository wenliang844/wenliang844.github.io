# 产品信息页与排行榜专题分析

生成时间：2026-07-03  
分析范围：`/ai/`、`/appreciation/`、`/sponsor/` 三类静态产品/信息页，以及它们关联的模板、交互脚本、结构化数据和测试。  
本轮验证：`node --test tests/ai-tabs.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs tests/build-extra.test.mjs tests/css.test.mjs tests/i18n-a11y.test.mjs`，128/128 通过。  
约束说明：本轮仅新增 `/docs/suggestions/module-reviews/product-info-pages-and-rankings.md`，未修改源码、配置或测试。

## 总览

这组三个页面整体状态较稳：外链已带 `rel="noopener noreferrer"`，AI 标签页的 ARIA 基础状态通过测试，赞助页的关键支付入口也有结构化数据和二维码尺寸声明。主要风险集中在内容可信度、榜单结构化语义、可维护性和赞助转化细节上。建议优先把“公开页面的动态/可信信息”从模板硬编码迁移到可校验的数据层，再补充轻量的构建期校验。

严重程度分布：

- 高：0
- 中：4
- 低：3

## 建议清单

### 1. AI 标签页使用 `replaceState`，浏览器后退无法回到上一标签

- 📌 问题/建议标题：AI 标签页哈希同步缺少可选的历史栈策略
- 📍 位置：`js/ai-tabs.js:26-33`、`js/ai-tabs.js:47-69`、`tests/ai-tabs.test.mjs:39-48`
- 📝 当前状况描述：点击“中转站排行榜 / AI导航网站”时，页面会用 `history.replaceState` 同步 `#relay` 或 `#nav`。这能保持地址干净，但用户从 AI 导航页点回排行榜后，浏览器 Back 不会恢复上一标签，只会回到进入 `/ai/` 前的页面。当前测试只断言 hash 被同步，没有覆盖后退行为。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```js
const HISTORY_MODE = "push-on-click";

function syncHash(id, source) {
  const nextHash = id === "relay" ? "#relay" : "#nav";
  if (window.location.hash === nextHash) return;
  const method = source === "user" && HISTORY_MODE === "push-on-click" ? "pushState" : "replaceState";
  window.history?.[method]?.(null, "", window.location.pathname + window.location.search + nextHash);
}

tab.addEventListener("click", function () {
  const id = tab.getAttribute("data-ai-tab");
  activate(id, false);
  syncHash(id, "user");
});
```

- 📊 预期收益：让 `/ai/#nav` 和 `/ai/#relay` 更像两个可返回的浏览状态，降低移动端用户误触后找不回原内容的概率。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md` 已记录标签页 Home/End 键盘补强，本条只关注浏览历史行为。

### 2. AI 工具导航缺少“最后校验时间”和状态元数据

- 📌 问题/建议标题：AI 工具目录仍是纯静态卡片，难以判断链接新鲜度
- 📍 位置：`src/templates/ai.mjs:4-235`、`src/templates/ai.mjs:233-246`、`tests/templates-extended.test.mjs:168-175`
- 📝 当前状况描述：AI 导航的 5 个分组和 20 个工具直接写在 `GROUPS` 数组中，渲染时只输出标题、描述、URL 和外链属性。测试能保证数量和基础结构，但没有记录工具是否仍可访问、何时校验、是否推荐、是否需要登录或是否存在地区访问限制。对“导航网站”来说，链接老化会直接影响可信度。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const GROUPS = [
  {
    title: "AI 搜索",
    tools: [
      {
        name: "Perplexity",
        url: "https://www.perplexity.ai/",
        status: "ok",
        checkedAt: "2026-07-03",
        region: "global",
        loginRequired: false,
      },
    ],
  },
];

function validateTool(tool) {
  if (!tool.checkedAt) throw new Error(`${tool.name} missing checkedAt`);
  if (!["ok", "degraded", "offline"].includes(tool.status)) throw new Error(`${tool.name} invalid status`);
}
```

- 📊 预期收益：可以在页面上展示“已验证 / 可能失效 / 需登录”等状态，并为后续自动链接巡检、排序和搜索筛选打基础。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/search-and-seo-pipeline.md` 的静态页面元数据注册建议、`docs/suggestions/module-reviews/content-discovery-and-object-search.md` 的内容发现质量门禁。

### 3. 鉴赏页公开内容保留占位符，影响页面可信度与 SEO 摘要质量

- 📌 问题/建议标题：顿悟榜单中存在 `xx`、`xxxx`、`20xx` 等未完成内容
- 📍 位置：`src/templates/appreciation.mjs:93-106`、`tests/build.test.mjs:80-84`、`tests/templates-extended.test.mjs:275`
- 📝 当前状况描述：鉴赏页的“顿悟排行榜”包含多处占位式年份和文本，且测试明确断言这些占位内容存在，说明它已经成为当前构建契约的一部分。如果页面面向公开读者或搜索引擎，这类文本容易被理解为草稿残留，也会降低页面摘要、站内搜索和分享卡片的质量。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const item = {
  name: "第一次顿悟",
  note: "高三阶段：开始系统学习英语，并形成长期学习习惯。",
  visibility: "public",
};

function validatePublicCopy(text, context) {
  const placeholderPattern = /\b(?:xx|xxxx|20xx)\b/i;
  if (placeholderPattern.test(text)) {
    throw new Error(`${context} contains placeholder copy`);
  }
}
```

- 📊 预期收益：提升公开内容可信度，减少搜索索引收录草稿词的概率，并让构建测试从“固定占位符”升级为“禁止占位符”。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/content-publishing-quality-gates.md` 的发布质量门禁、`docs/suggestions/module-reviews/search-and-seo-pipeline.md` 的索引摘要质量建议。

### 4. 鉴赏页 JSON-LD 扁平化 68 个条目，丢失每个榜单的排名上下文

- 📌 问题/建议标题：结构化数据没有表达“每个榜单各自排名”
- 📍 位置：`src/templates/appreciation.mjs:166-176`、`src/templates/appreciation.mjs:205-214`、`tests/templates-extended.test.mjs:157-159`
- 📝 当前状况描述：HTML 中每个 `rank-board` 都是独立榜单，视觉上排名从 1 重新开始；但 JSON-LD 把所有 6 个榜单的 68 个条目扁平化为一个 `ItemList`，`position` 从 1 到 68 全局递增。搜索引擎和下游结构化消费者会看到“一个 68 项总榜”，无法得知“科技研究、电影、食物、顿悟”等分类语义。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
mainEntity: {
  "@type": "Collection",
  name: "CWLBlog 鉴赏榜单",
  hasPart: BOARDS.map((board) => ({
    "@type": "ItemList",
    name: board.title,
    numberOfItems: board.items.length,
    itemListElement: board.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.nameEn || item.name,
    })),
  })),
}
```

- 📊 预期收益：让结构化数据与页面真实信息架构一致，提升可解析性，也便于未来对单个榜单做分享、筛选或独立落地页。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/seo-analysis.md`、`docs/suggestions/module-reviews/search-and-seo-pipeline.md`。

### 5. 赞助页月度目标和完成率硬编码，容易造成信任漂移

- 📌 问题/建议标题：赞助进度缺少数据来源和更新时间
- 📍 位置：`src/templates/sponsor.mjs:51-57`、`tests/templates-extended.test.mjs:301-305`
- 📝 当前状况描述：页面固定展示“本月目标：¥2000”和“本月已完成 72%”，进度条宽度也直接写为 `72%`。测试断言了这些固定值，因此后续真实赞助进度变化时，维护者必须同步修改模板和测试。若忘记更新，赞助页会展示过期数据，直接影响读者信任。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const sponsorGoal = {
  month: "2026-07",
  targetCny: 2000,
  currentCny: 1440,
  updatedAt: "2026-07-03",
  source: "manual",
};

const percent = Math.min(100, Math.round((sponsorGoal.currentCny / sponsorGoal.targetCny) * 100));
```

- 📊 预期收益：把“真实数据”和“展示模板”解耦，降低忘记更新的概率，也可以在页面上自然展示“最后更新于”来提高赞助转化信任感。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/content-publishing-quality-gates.md` 的数据校验建议、`docs/suggestions/module-reviews/runtime-observability-and-error-resilience.md` 的状态可信度建议。

### 6. 赞助进度条只有视觉宽度和文本，缺少原生进度语义

- 📌 问题/建议标题：赞助进度条应补充 `role="progressbar"` 与数值属性
- 📍 位置：`src/templates/sponsor.mjs:51-56`、`tests/i18n-a11y.test.mjs`
- 📝 当前状况描述：当前进度条通过 `aria-label="Monthly sponsor goal progress 72%"` 和内部 `span style="width: 72%"` 表示进度，视觉用户能理解，但辅助技术无法获得标准化的 `aria-valuenow`、`aria-valuemin`、`aria-valuemax` 数值。对于捐赠页面，这属于低成本但直接提升可访问性的改进。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```html
<div
  class="sponsor-progress"
  role="progressbar"
  aria-label="Monthly sponsor goal progress"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow="72"
>
  <span style="width: 72%"></span>
</div>
```

- 📊 预期收益：屏幕阅读器和自动化 a11y 工具能准确识别进度组件，后续测试也可以从文本匹配升级为语义断言。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md`。

### 7. 赞助二维码作为关键支付内容却使用懒加载

- 📌 问题/建议标题：支付二维码应按首屏可见性选择加载策略
- 📍 位置：`src/templates/sponsor.mjs:63-68`、`tests/templates-extended.test.mjs:310-314`
- 📝 当前状况描述：微信和支付宝二维码都声明了固定尺寸，这是好的；但两张图都使用 `loading="lazy"`。如果右侧赞助栏在桌面首屏内可见，浏览器可能延迟加载主要支付内容；如果图片加载失败，页面也没有额外的复制账号、备用链接或错误提示。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```html
<img
  src="/images/sponsor/wechat-pay-qr.png"
  width="280"
  height="281"
  alt="微信支付收款二维码"
  loading="eager"
  decoding="async"
  fetchpriority="high"
>
```

也可以根据布局策略保守处理：桌面首屏二维码 `eager`，移动端折叠到首屏外时继续 `lazy`，并提供可复制的备用赞助链接。

- 📊 预期收益：减少关键转化内容延迟出现的概率，尤其是在网络较慢或读者快速扫码的场景下更稳。
- 🔗 相关建议引用：`docs/suggestions/performance-bottlenecks.md`、`docs/suggestions/ux-improvements.md`。

## 后续优先级

1. 优先处理赞助页目标数据源和更新时间，它直接影响转化信任。
2. 将鉴赏页占位符检测纳入构建质量门禁，避免公开草稿文本继续被测试固化。
3. 将 AI 工具导航抽成带状态元数据的数据源，再补链接巡检或构建期校验。
4. 补充鉴赏页嵌套 JSON-LD，使结构化数据与页面真实榜单结构一致。
5. 视产品决策决定 AI 标签页是否需要 `pushState`，并用测试覆盖 Back/Forward 行为。

