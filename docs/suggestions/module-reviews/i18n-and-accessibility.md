# i18n 与可访问性模块评审

> 轮次：2026-07-03 第三轮专题分析  
> 范围：`js/i18n.js`、`js/search.js`、`js/toc.js`、`js/blog.js`、`js/ai-tabs.js`、`src/templates/post.mjs`、`src/templates/ai.mjs` 与相关测试。  
> 验证：`node --test tests/i18n-a11y.test.mjs tests/i18n-deep.test.mjs tests/ai-tabs.test.mjs tests/blog.test.mjs tests/toc-behavior.test.mjs tests/js-behavior.test.mjs`，90 项通过。

## 总览

当前站点已经具备基础无障碍骨架：所有 HTML 页面有 `lang`、`viewport`、`description`、唯一 `h1`、skip link、导航 aria-label，动态组件也在多处维护 `aria-expanded`、`aria-selected`、`aria-current` 与 `aria-live`。本轮主要问题集中在双语键名漂移、模态焦点管理、键盘模型完整性、减少动态效果偏好和 i18n HTML 注入边界。

## 建议清单

### 1. TOC 使用 `toc.*` 键，但英文词典只维护 `dyn.toc*`

- 📌 问题/建议标题：文章目录的容器、按钮和标题在英文模式下仍显示中文
- 📍 位置：`src/templates/post.mjs:93-117`、`js/i18n.js:730-737`
- 📝 当前状况描述：文章页模板为 TOC 输出 `data-i18n-aria="toc.aria"`、`data-i18n-aria="toc.toggle"`、`data-i18n="toc.title"`；但 `js/i18n.js` 中只有 `dyn.toc` 和 `dyn.toc.aria`，没有对应的 `toc.*` 键。用户切到英文后，TOC 外壳文案会回退到缓存的中文，单个目录链接虽有 `data-i18n-en`，但“目录/展开收起目录”等控件不会同步。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
// js/i18n.js
const EN = {
  "toc.aria": "Contents",
  "toc.toggle": "Expand or collapse contents",
  "toc.title": "Contents",
  "dyn.toc": "Contents",
  "dyn.toc.aria": "Contents",
};
```

同时增加一个测试，扫描 `data-i18n*="toc.*"` 是否能在字典或内联英文属性里命中：

```js
test("TOC shell i18n keys are translated", async () => {
  const i18n = await readFile(join(ROOT, "js", "i18n.js"), "utf8");
  for (const key of ["toc.aria", "toc.toggle", "toc.title"]) {
    assert.match(i18n, new RegExp(`"${key.replace(".", "\\.")}"`));
  }
});
```

- 📊 预期收益：英文用户不会在文章阅读动线中看到混合语言；也能减少后续模板键名与字典键名继续分叉。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/search-and-seo-pipeline.md` 中“静态页面元数据/搜索/站点地图清单分散”的一致性问题。

### 2. 搜索弹窗初始加载失败提示未走 i18n

- 📌 问题/建议标题：英文模式下首次打开搜索失败仍显示中文错误
- 📍 位置：`js/search.js:132-153`、`js/search.js:277-297`
- 📝 当前状况描述：`open()` 调用 `loadIndex().then(render).catch(...)` 时，catch 内直接写入 `"搜索索引加载失败，请稍后重试"`；而 `render()` 中后续加载失败路径已使用 `t("dyn.search.loadFail", ...)`。这造成同一个失败状态在不同触发时机下本地化不一致。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```js
function showSearchLoadFailure() {
  setEmpty(t("dyn.search.loadFail", "搜索索引加载失败，请稍后重试"));
}

loadIndex().then(render).catch(showSearchLoadFailure);
```

建议补充一条 JSDOM 测试：切到英文、mock `fetch` 拒绝、打开搜索，断言 `.search-modal-empty` 为英文失败文案。

- 📊 预期收益：错误状态语言一致，减少英文用户在关键交互失败时的理解成本。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/user-data-entrypoints.md` 中关于表单/模态状态文案一致性的建议。

### 3. 搜索对话框声明 `aria-modal`，但未实现 Tab 焦点环绕

- 📌 问题/建议标题：搜索 Modal 可让键盘焦点逃逸到页面背景
- 📍 位置：`js/search.js:15-31`、`js/search.js:132-164`、`js/search.js:374-460`
- 📝 当前状况描述：搜索浮层使用 `role="dialog"` 与 `aria-modal="true"`，打开时聚焦输入框、关闭时恢复 `lastActive`。但键盘处理只覆盖 Escape、方向键、Enter、`/`、Ctrl/Cmd+K，没有处理 Tab/Shift+Tab 的焦点环绕。屏幕阅读器与键盘用户可能在弹窗打开时 Tab 到页面背后的导航、订阅、AI 助手等控件，导致“视觉上 modal、交互上非 modal”的状态不一致。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
function focusables() {
  return Array.from(overlay.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((el) => el.offsetParent !== null || el === input);
}

overlay.addEventListener("keydown", function (event) {
  if (event.key !== "Tab" || !overlay.classList.contains("open")) return;
  const nodes = focusables();
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
```

配套测试可打开搜索后连续派发 Tab/Shift+Tab，断言焦点始终停留在 `.search-modal` 内。

- 📊 预期收益：搜索弹窗符合用户对 modal 的预期，避免键盘用户迷失焦点；也为订阅、分享 QR、AI 助手等其它浮层沉淀通用工具函数。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/user-data-entrypoints.md` 中“Modal focus trap gaps”。

### 4. 多处平滑滚动未尊重 `prefers-reduced-motion`

- 📌 问题/建议标题：减少动态效果用户仍会触发 smooth scroll
- 📍 位置：`js/toc.js:64-107`、`js/blog.js:225-287`、`js/coder.js:164-166`、`js/coder.js:240-247`、`tests/toc-behavior.test.mjs:183-283`、`tests/coder.test.mjs:259-280`
- 📝 当前状况描述：`coder.js` 已在滚动 reveal 上读取 `prefers-reduced-motion`，但返回顶部、阅读进度恢复、TOC 跳转、博客 J/K 切换和标签滚动仍固定使用 `{ behavior: "smooth" }`。TOC 测试还明确断言 `behavior === "smooth"`，容易把当前行为固化。对前庭敏感用户，自动平滑滚动可能造成不适。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
function prefersReducedMotion() {
  return window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollOptions(options) {
  return prefersReducedMotion()
    ? { ...options, behavior: "auto" }
    : { ...options, behavior: "smooth" };
}

window.scrollTo(scrollOptions({ top: offsetPosition }));
target.link.scrollIntoView(scrollOptions({ block: "nearest" }));
```

将 `tests/toc-behavior.test.mjs` 的固定断言拆成两条：默认 smooth；mock reduced-motion 时为 `auto` 或省略 `behavior`。

- 📊 预期收益：更符合 WCAG 对动画可控性的预期，减少阅读页与博客列表的可访问性阻力。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/visual-interactions.md` 中“Galaxy canvas ignores prefers-reduced-motion”。

### 5. AI 页 tabs 键盘模型少于工具箱 tabs

- 📌 问题/建议标题：AI tabs 只支持左右方向键，不支持 Home/End
- 📍 位置：`src/templates/ai.mjs:267-276`、`js/ai-tabs.js:51-68`、`tests/ai-tabs.test.mjs:25-50`
- 📝 当前状况描述：AI 页 tab markup 已有 `role="tablist"`、`role="tab"`、`role="tabpanel"`、`aria-controls`、`aria-labelledby`，脚本也维护 `aria-selected` 与 roving `tabindex`。但键盘事件只处理 ArrowLeft/ArrowRight；工具箱 tabs 已覆盖 Home/End 导航，AI tabs 的交互模型相对不完整，测试也只覆盖 hash 和点击。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```js
tab.addEventListener("keydown", function (event) {
  const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();

  let nextIndex = index;
  if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabs.length - 1;
  else nextIndex = event.key === "ArrowRight"
    ? (index + 1) % tabs.length
    : (index - 1 + tabs.length) % tabs.length;

  const id = tabs[nextIndex].getAttribute("data-ai-tab");
  activate(id, true);
  syncHash(id);
});
```

新增测试：在 `#relay` 初始状态按 End/Home，断言 active tab、panel hidden 状态和 URL hash 同步。

- 📊 预期收益：AI 页与工具箱页的键盘体验一致，也更贴近 WAI-ARIA tabs 习惯用法。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/tools-core.md` 中工具箱 tabs 键盘导航覆盖情况。

### 6. `data-i18n-html` 缺少可信 HTML 边界测试

- 📌 问题/建议标题：i18n HTML 替换能力需要白名单约束，避免未来误接入用户内容
- 📍 位置：`js/i18n.js:17-25`、`js/i18n.js:781-799`、`src/templates/layout.mjs:62-69`、`src/templates/post.mjs:254-255`
- 📝 当前状况描述：`data-i18n-html` 会直接调用 `el.innerHTML = v`，当前主要用于受控图标和少量内置 HTML 文案，测试也覆盖了 HTML 切换行为。但这一能力是全局通用的，如果未来把文章、反馈、外部配置或生成内容接到 `data-i18n-en-html`，就会把 HTML 注入风险放大到所有页面。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const SAFE_HTML_I18N_KEYS = new Set([
  "nav.more",
  "nav.feedback",
  "nav.subscribe",
  "nav.sponsor",
  "home.hero",
  "dyn.copy",
  "dyn.copied",
  "post.comments",
]);

function applyHtml(el, key, value) {
  if (!SAFE_HTML_I18N_KEYS.has(key)) {
    el.textContent = value;
    return;
  }
  el.innerHTML = value;
}
```

也可以在构建测试中扫描所有 `data-i18n-html`，要求其 key 在白名单内，且 HTML 只允许 `<i>`、`<br>`、`<span>`、`<code>` 等受控标签。

- 📊 预期收益：保留图标/格式化文案能力，同时降低未来维护者误用 `data-i18n-html` 带来的 XSS 风险。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md`、`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`。

## 测试补强建议

- 为 `toc.*` 键名增加字典命中测试，避免模板和字典再次漂移。
- 为搜索弹窗增加失败态英文文案测试和 Tab 焦点环绕测试。
- 为 TOC、博客列表、返回顶部增加 reduced-motion 分支测试。
- 为 AI tabs 增加 Home/End 键盘导航测试。
- 为 `data-i18n-html` 增加白名单测试，禁止未评审 key 使用 HTML 注入式翻译。

## 本轮结论

i18n 与可访问性基础建设总体良好，已有测试覆盖了页面级语义、基础翻译、动态文案刷新和主要键盘入口。本轮建议更偏向“把已做好的基础收紧”：统一键名、补齐 modal 与 tabs 的键盘细节、让动态效果尊重系统偏好，并给 `innerHTML` 型翻译加护栏。
