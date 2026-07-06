# 内容发现与视觉搜索入口分析

本轮聚焦博客列表筛选、全局搜索懒加载和对象识别/视觉搜索脚本。现有文本搜索主链路已有较多修复：搜索 bundle 懒加载、Fuse 与索引空闲预热、结果 DOM API 渲染、博客列表缓存构建、标签筛选直达均已覆盖测试。剩余建议集中在筛选状态与分组显示一致性、搜索加载失败的用户反馈、移动目录焦点管理，以及未挂载对象识别功能的产品边界。

## 验证记录

- 测试命令：`node --test tests/blog.test.mjs tests/search-loader-behavior.test.mjs tests/js-behavior.test.mjs tests/integration.test.mjs tests/links.test.mjs tests/workflows.test.mjs`
- 结果：80/80 通过
- 本轮修复验证：`node --test tests/blog.test.mjs` 17/17 通过；`node --test tests/search-loader-behavior.test.mjs` 12/12 通过；`npm run lint:check` 通过。
- 额外观察：`search-index.json` 当前 17 条、约 26.2 KB；6 篇文章正文索引均截取 600 字。`js/object-search.js` 没有在 `src/templates/tools.mjs`、`tools/index.html` 或测试中找到对应 DOM/脚本引用。

## 建议清单

### 1. [已修复] 博客筛选只更新第一个年份分组的数量

- 📌 问题/建议标题：按年份分组的计数应按组更新，而不是把全局可见数量写入第一个 badge
- 📍 位置：`js/blog.js:14-16`、`js/blog.js:97-112`、`src/templates/post.mjs:312-324`
- ✅ 修复状态：`js/blog.js` 已移除单个 `countBadge` 缓存，新增 `updateGroupCounts()` 按 `.tree-group` 独立统计可见 `li` 并同步 `.tree-count`。
- 🧪 回归测试：`tests/blog.test.mjs` 新增多年份筛选用例，覆盖匹配年份计数更新和不匹配年份计数归零。
- 📝 当前状况描述：`countBadge` 通过 `document.querySelector(".tree-group .tree-count")` 只取第一个年份分组的数量节点。筛选时 `apply()` 计算的是全局 `visible.length`，然后只写入第一个分组。多年份文章列表中，第一组会显示全站匹配数，其他年份分组仍显示原始数量，容易让用户误解筛选结果分布。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：按 `.tree-group` 遍历组内链接，分别计算可见数量；空组可以隐藏或折叠。

```js
function updateGroupCounts() {
  document.querySelectorAll(".tree-group").forEach(function (group) {
    const visibleLinks = Array.from(group.querySelectorAll("li")).filter(function (li) {
      return !li.hidden;
    });
    const badge = group.querySelector(".tree-count");
    if (badge) {
      badge.textContent = String(visibleLinks.length);
    }
    group.hidden = visibleLinks.length === 0;
  });
}
```

- 📊 实际收益：筛选结果与时间线分组显示一致，减少多年份归档扩展后的计数误导。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/core-reading-interactions.md`、`docs/suggestions/ux-improvements.md`

### 2. [已修复] 筛选后空年份分组仍可能留在树形目录中

- 📌 问题/建议标题：搜索/标签筛选应隐藏无匹配文章的年份分组
- 📍 位置：`js/blog.js:97-123`、`src/templates/post.mjs:316-324`、`src/templates/post.mjs:385-387`
- ✅ 修复状态：筛选后外层 `.tree-group` 会在组内无可见条目时设置 `hidden`；有匹配条目时保持可见。
- 🧪 回归测试：`tests/blog.test.mjs` 覆盖搜索 `React` 时 2024 分组隐藏、2023 分组保留，且全局空状态仍正确隐藏。
- 📝 当前状况描述：`apply()` 只对每篇文章所在的 `li` 设置 `hidden`，没有同步处理外层 `.tree-group`。当某个年份下所有文章都被过滤掉时，年份标题和原始计数仍可见，但展开后没有可点击文章。当前测试覆盖了空状态和 tag chip，但没有覆盖多年份分组的隐藏与计数一致性。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：把上面的 `updateGroupCounts()` 接入 `apply()`，并在全部不可见时保持全局 empty state。

```js
function apply() {
  const visible = [];
  items.forEach(function (item) {
    const ok = matches(item);
    if (item.li) item.li.hidden = !ok;
    if (ok) visible.push(item);
  });

  updateGroupCounts();
  empty.hidden = visible.length !== 0;
}
```

- 📊 实际收益：让时间线目录在筛选状态下更干净，避免“年份还在但里面没有文章”的空壳交互。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/search-and-seo-pipeline.md`、`docs/suggestions/module-reviews/i18n-and-accessibility.md`

### 3. [已修复] 站内文章搜索关键词没有同步到 URL

- 📌 问题/建议标题：博客列表搜索可支持 `?q=` 直达和分享
- 📍 位置：`js/blog.js:125-137`、`js/blog.js:140-153`、`src/templates/post.mjs:388-391`
- ✅ 修复状态：`js/blog.js` 已在加载时读取 `?q=` 并写入搜索框；输入变化后通过 `replaceState` 同步 `q`，同时保留/删除现有 `tag` 参数。
- 🧪 回归测试：`tests/blog.test.mjs` 覆盖 `/post/?tag=TypeScript&q=React` 直达、输入改为 `Schema` 后 URL 同步、清空搜索后移除 `q`。
- 📝 当前状况描述：标签筛选会同步到 `?tag=<标签>`，支持从标签页或外部链接直达；但同一侧栏里的文章关键词搜索只存在于输入框状态，不会进入 URL。用户无法分享“低代码 + 某标签”的组合筛选，也无法刷新后保留当前搜索词。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：为关键词搜索增加 `q` 参数，加载时读取初始值；更新 URL 时同时维护 `tag` 和 `q`。

```js
function syncUrl() {
  const url = new URL(window.location.href);
  if (activeTag) url.searchParams.set("tag", activeTag);
  else url.searchParams.delete("tag");
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  window.history.replaceState(null, "", url);
}

const initialQuery = new URL(window.location.href).searchParams.get("q");
if (initialQuery && searchInput) {
  searchInput.value = initialQuery;
  query = initialQuery.trim().toLowerCase();
}
```

- 📊 实际收益：提升文章列表筛选的可分享性和刷新恢复能力，和标签直达行为保持一致。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/social-comments-integrations.md`、`docs/suggestions/new-features.md`

### 4. [已修复] 移动端文章目录打开后焦点仍可能停留在被隐藏的 FAB

- 📌 问题/建议标题：浮动目录打开/关闭时应移动焦点并声明背景不可达
- 📍 位置：`js/blog.js:302-375`
- ✅ 修复状态：打开浮动目录时焦点会移动到 `.post-tree-collapse`；通过按钮或 Escape 关闭时恢复到 FAB；点击文章链接关闭时不抢走链接点击流程的焦点。
- 🧪 回归测试：`tests/blog.test.mjs` 覆盖打开后焦点进入侧栏、按钮关闭和 Escape 关闭后焦点回到 FAB。
- 📝 当前状况描述：点击 `.post-tree-fab` 后，`setOpen(true)` 会让 FAB 添加 `is-hidden`，但代码没有把焦点移动到目录中的关闭按钮或第一篇文章链接。键盘用户可能停留在视觉上隐藏的按钮；侧栏打开期间也没有类似 `aria-modal`、`inert` 或焦点约束的语义，背景内容仍可被 Tab 到。关闭按钮点击后会 `fab.focus()`，说明关闭方向已有部分焦点恢复，但打开方向缺失。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：打开时聚焦 collapse 按钮或当前 active 链接，关闭时再恢复 FAB；若浮层覆盖全屏，可复用通用 modal/focus helper。

```js
const setOpen = function (open) {
  sidebar.classList.toggle("is-floating-open", open);
  document.body.classList.toggle("post-tree-floating", open);
  updateFab(open);
  updateCollapseButton();
  if (open) {
    collapseBtn.focus();
  } else {
    fab.focus();
  }
};
```

- 📊 实际收益：移动端目录更符合键盘与屏幕阅读器预期，避免焦点落在隐藏控件上。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/core-reading-interactions.md`、`docs/suggestions/module-reviews/i18n-and-accessibility.md`

### 5. [已修复] 搜索脚本加载失败时触发按钮没有用户可见反馈

- 📌 问题/建议标题：`search-loader.js` 的脚本加载失败应回写 UI 状态
- 📍 位置：`js/search-loader.js:17-40`、`js/search-loader.js:58-75`
- ✅ 修复状态：点击和快捷键加载路径已捕获 `loadSearch(true)` 失败；失败时按钮进入 `.is-error`、更新 aria/title、调用 `CWLErrorHandler.showUserMessage()`，并通过 `CWLLogger.warn()` 记录；失败脚本会移除，下一次点击可重试，加载成功后清理错误态。
- 🧪 回归测试：`tests/search-loader-behavior.test.mjs` 通过真实 `script.onerror` 事件覆盖失败反馈、日志、toast、失败脚本移除、二次重试和成功后恢复按钮文案。
- 📝 当前状况描述：搜索主脚本加载失败时，`script.onerror` 会重置 `task` 并 reject Promise；但点击和快捷键路径都没有处理 reject，也没有给触发按钮、toast 或状态区展示“搜索暂不可用”。`search.js` 内部能处理 Fuse 或索引加载失败，但如果 `/js/search.js` 本身加载失败，用户只会觉得点击搜索没有反应。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：为 `loadSearch(true)` 增加 `.catch()`，通过 `CWLLogger` 与 toast/status 反馈失败，并允许用户重试。

```js
function reportSearchLoadFailure(error) {
  if (window.CWLLogger) {
    window.CWLLogger.warn("Search bundle failed", { message: error.message });
  }
  const trigger = document.querySelector(".nav-search-trigger");
  if (trigger) {
    trigger.setAttribute("aria-label", "搜索加载失败，请稍后重试");
    trigger.classList.add("is-error");
  }
}

loadSearch(true).catch(reportSearchLoadFailure);
```

- 📊 实际收益：把搜索入口的网络失败从静默变成可恢复状态，便于用户和日志系统判断问题。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/runtime-observability-and-error-resilience.md`、`docs/suggestions/bugs-and-risks.md`

### 6. `object-search.js` 看起来是未挂载的对象识别功能

- 📌 问题/建议标题：确认对象识别脚本是废弃代码还是待上线功能，并补齐入口/测试
- 📍 位置：`js/object-search.js:1-355`、`src/templates/tools.mjs`、`tools/index.html`
- 📝 当前状况描述：`js/object-search.js` 包含完整的摄像头对象识别、拍照、Google 搜索和 Lens 辅助逻辑，但当前搜索只在该 JS 文件中找到 `obj-*` DOM id 和 `objectsearch` 面板引用，没有在工具页模板、生成 HTML 或测试中找到对应控件与脚本加载入口。这意味着该功能要么已经废弃但文件仍留在仓库，要么计划上线但缺少产品入口、权限文案和回归测试。
- ⚠️ 影响程度：低到中
- 💡 建议方案（含伪代码或示例片段）：如果废弃，建议在后续代码回合删除并补“无孤儿脚本”测试；如果保留，先在工具模板中显式挂载，并补 DOM 合约测试。

```js
test("object search tool has matching DOM and script", async () => {
  const html = renderToolsPage();
  assert.match(html, /id="obj-start"/);
  assert.match(html, /src="\/js\/object-search\.js"/);
});
```

- 📊 预期收益：减少无人维护的摄像头/远程模型代码长期漂移，也避免用户以为有视觉搜索功能但页面不可达。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/tools-core-runtime-safety.md`、`docs/suggestions/tech-debt.md`

### 7. 对象识别先下载远程模型再请求摄像头权限

- 📌 问题/建议标题：视觉搜索应先说明隐私边界，再加载第三方模型和请求摄像头
- 📍 位置：`js/object-search.js:44-49`、`js/object-search.js:82-99`、`js/object-search.js:106-127`
- 📝 当前状况描述：`startCamera()` 会先执行 `loadModel()`，动态 import jsDelivr 上的 MediaPipe bundle，并从 Google Storage 加载 EfficientDet 模型；模型加载成功后才调用 `getUserMedia()` 请求摄像头。如果功能未来重新挂载，用户点击“开始”后会先产生第三方网络请求，即使随后拒绝摄像头权限。当前状态文案只显示“加载模型…/模型已加载/模型加载失败”，没有说明模型来源、图片是否本地处理、是否会上传照片。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：首次启动前显示权限说明，用户确认后再并行或按需加载模型；文案明确“检测在浏览器本地运行，模型来自第三方 CDN，照片不会自动上传”。

```js
async function startCamera() {
  if (!await confirmVisionPrivacy()) {
    setStatus("ready", "已取消");
    return;
  }
  if (!(await loadModel())) return;
  cameraStream = await navigator.mediaDevices.getUserMedia({ video: constraints });
  // ...
}
```

- 📊 预期收益：降低摄像头功能的隐私惊讶成本，让第三方模型加载与用户授权顺序更透明。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md`、`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`

### 8. Lens 辅助会尝试把拍摄照片写入剪贴板，但没有明确反馈

- 📌 问题/建议标题：复制图片到剪贴板前应提供明确操作说明和失败状态
- 📍 位置：`js/object-search.js:243-266`、`js/object-search.js:284-307`
- 📝 当前状况描述：拍照后 `searchLens()` 会把 `capturedPhoto` 从 data URL 转成 Blob，并在支持 `navigator.clipboard.write()` 时尝试写入图片剪贴板，然后打开 `https://lens.google.com/`。这是一个聪明的浏览器内 workaround，但用户可能不知道照片被复制到了剪贴板；如果写入失败，代码仍打开 Lens，没有提示“请手动上传/粘贴图片”。对于涉及摄像头照片的功能，剪贴板写入应比普通文本复制更明确。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：点击 Lens 前显示“将复制当前照片到剪贴板并打开 Google Lens”的按钮文案或确认；写入成功/失败分别更新状态。

```js
navigator.clipboard.write([item]).then(function () {
  setStatus("ready", "照片已复制，打开 Lens 后可直接粘贴");
  window.open("https://lens.google.com/", "_blank", "noopener");
}, function () {
  setStatus("error", "无法复制照片，请在 Lens 页面手动上传");
  window.open("https://lens.google.com/", "_blank", "noopener");
});
```

- 📊 预期收益：提升视觉搜索的透明度和可恢复性，避免用户误解照片处理方式。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/user-data-entrypoints.md`、`docs/suggestions/module-reviews/social-comments-integrations.md`

## 优先级建议

1. 博客筛选年份计数/空分组、搜索脚本加载失败反馈、移动目录焦点和 `?q=` 搜索直达已完成并补回归测试。
2. 下一步优先决策 `object-search.js` 的去留；若上线，先补入口、隐私说明和视觉搜索专门测试。
3. 继续评估搜索加载失败的更细国际化文案和离线缓存提示。
