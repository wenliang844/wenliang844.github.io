# 核心阅读交互模块深度分析

本轮聚焦 `js/coder.js` 中的主题切换、文章切换、阅读进度、代码复制和图片预览交互。已结合现有单元测试与 DOM 行为测试进行验证，当前功能主路径稳定，但仍存在若干可访问性、失败反馈和长期状态管理边界。

## 验证记录

- 测试命令：`node --test tests/coder.test.mjs tests/coder-deep.test.mjs tests/js-behavior.test.mjs tests/css.test.mjs tests/toc-behavior.test.mjs tests/post-next.test.mjs tests/post-next-deep.test.mjs`
- 结果：130/130 通过
- 范围：主题模式、文章面板切换、阅读进度、目录行为、代码复制、图片灯箱、返回顶部等核心阅读交互

## 建议清单

### 1. 主题切换按钮缺少屏幕阅读器可感知状态

- 📌 问题/建议标题：为主题切换补充 `aria-label`、`aria-pressed` 或状态文本
- 📍 位置：`js/coder.js:29-37`、`js/coder.js:68-73`
- 📝 当前状况描述：`updateThemeButtons()` 只更新 `dataset.themeMode`、`dataset.themeActual` 和 `title`，图标固定为 `fa-adjust`。鼠标用户能通过外观变化感知主题，但屏幕阅读器用户只能获得静态按钮语义，无法明确当前处于自动、浅色还是深色模式，也不知道点击后会切换到什么状态。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：在更新按钮时同步可访问状态；如果仍保留三态循环，建议使用可读的状态标签而不是布尔化的 `aria-pressed`。

```js
const themeLabels = {
  auto: t("dyn.theme.auto", "自动主题"),
  light: t("dyn.theme.light", "浅色主题"),
  dark: t("dyn.theme.dark", "深色主题")
};

button.setAttribute(
  "aria-label",
  t("dyn.theme.current", "当前主题：") + themeLabels[themeMode]
);
button.setAttribute("data-next-theme", nextThemeMode(themeMode));
```

- 📊 预期收益：提升主题切换对辅助技术的可理解性，减少“按钮可点击但状态不可知”的可访问性缺口。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md`、`docs/suggestions/ux-improvements.md`

### 2. 文章面板切换使用 `replaceState`，浏览器返回栈不可回溯

- 📌 问题/建议标题：为连续阅读场景评估 `pushState` 或显式导航历史策略
- 📍 位置：`js/coder.js:96-121`、`js/coder.js:125-141`
- 📝 当前状况描述：用户在文章列表中点击不同文章时，`showPost()` 使用 `history.replaceState()` 更新 hash。这能避免浏览器历史栈膨胀，但用户连续打开多篇文章后，点击浏览器返回不会回到上一篇文章，而是直接离开当前页面或回到更早页面。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：如果产品预期是“文章选择类似页面导航”，可改为在用户主动点击时 `pushState`，在初始化和程序化同步时继续使用 `replaceState`。同时监听 `popstate` 恢复对应面板。

```js
function showPost(targetId, options = {}) {
  const mode = options.historyMode || "replace";
  // ...切换 active 面板...
  if (options.updateHash && target.dataset.postSlug) {
    const url = "#" + target.dataset.postSlug;
    window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
  }
}

link.addEventListener("click", function (event) {
  event.preventDefault();
  showPost(link.dataset.postTarget, { updateHash: true, historyMode: "push" });
});
```

- 📊 预期收益：让文章列表阅读更符合浏览器导航直觉，尤其适合从搜索结果或目录中连续跳读的用户。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/search-and-seo-pipeline.md`、`docs/suggestions/ux-improvements.md`

### 3. 阅读进度持久化缺少写入降噪与过期清理

- 📌 问题/建议标题：为阅读进度 localStorage 增加最小变化阈值、写入节流和历史键清理
- 📍 位置：`js/coder.js:205-231`、`js/coder.js:294-305`
- 📝 当前状况描述：滚动处理被 100ms 节流后，每次仍会调用 `saveReadingPosition()`，只要阅读比例超过 8% 就写入 `localStorage`。恢复提示会忽略超过 14 天的记录，但旧键不会被清理；长期浏览大量文章后会留下许多 `cwl.reading.*` 键，并增加滚动期间同步存储写入压力。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：缓存上一次保存的 slug、ratio 和时间，只有比例变化超过阈值或间隔超过指定时间才写入；顺手在页面加载或保存时清理过期阅读记录。

```js
const lastReadingSave = { slug: "", ratio: 0, time: 0 };

function shouldSaveReading(slug, ratio) {
  const now = Date.now();
  return slug !== lastReadingSave.slug ||
    Math.abs(ratio - lastReadingSave.ratio) >= 0.02 ||
    now - lastReadingSave.time >= 5000;
}

function pruneReadingPositions(now = Date.now()) {
  Object.keys(localStorage).forEach(function (key) {
    if (!key.startsWith("cwl.reading.")) return;
    const saved = JSON.parse(localStorage.getItem(key) || "{}");
    if (now - Number(saved.time || 0) > READING_RESUME_MAX_AGE) {
      localStorage.removeItem(key);
    }
  });
}
```

- 📊 预期收益：降低滚动路径上的同步写入频率，避免阅读历史键长期堆积，也让隐私和存储占用更可控。
- 🔗 相关建议引用：`docs/suggestions/performance-bottlenecks.md`、`docs/suggestions/module-reviews/runtime-observability-and-error-resilience.md`

### 4. 继续阅读滚动缺少减弱动态效果适配

- 📌 问题/建议标题：继续阅读与返回顶部应尊重 `prefers-reduced-motion`
- 📍 位置：`js/coder.js:164-166`、`js/coder.js:240-247`、`js/coder.js:276-279`
- 📝 当前状况描述：返回顶部和继续阅读都固定使用 `behavior: "smooth"`。对设置了减弱动态效果的用户，长距离平滑滚动可能造成不适；同时测试环境或低性能设备上，强制平滑滚动也可能让定位反馈显得拖沓。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：封装一个统一的滚动偏好函数，在所有滚动入口复用。

```js
function preferredScrollBehavior() {
  return window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
}

window.scrollTo({
  top: targetTop,
  behavior: preferredScrollBehavior()
});
```

- 📊 预期收益：补齐动态效果无障碍细节，降低长文阅读场景中的眩晕和定位延迟风险。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md`、`docs/suggestions/ux-improvements.md`

### 5. 代码复制失败没有用户可见反馈和按钮恢复路径

- 📌 问题/建议标题：为代码复制增加失败态、错误日志和可恢复 UI
- 📍 位置：`js/coder.js:333-357`
- 📝 当前状况描述：复制按钮只处理 `copyText(...).then(...)` 的成功路径。如果浏览器权限、非安全上下文、剪贴板 API 限制或 fallback 失败导致 Promise reject，按钮不会变化，用户只能感到“点了没反应”。当前也没有向统一错误处理或日志系统记录该失败。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：使用 `then(success, failure)` 或 `catch()` 显示短暂失败态，并在可用时接入 `CWLLogger`。

```js
button.addEventListener("click", function () {
  const code = pre.querySelector("code") || pre;
  copyText(code.innerText)
    .then(function () {
      setCopyButtonState(button, "copied");
    })
    .catch(function (error) {
      setCopyButtonState(button, "failed");
      if (window.CWLLogger) {
        window.CWLLogger.warn("Code copy failed", { message: error.message });
      }
    });
});
```

- 📊 预期收益：提升代码阅读页的交互可信度，便于定位剪贴板权限或 HTTPS 环境相关问题。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/runtime-observability-and-error-resilience.md`、`docs/suggestions/bugs-and-risks.md`

### 6. 图片灯箱声明为模态框但缺少焦点闭环和焦点恢复

- 📌 问题/建议标题：为灯箱补充 Tab 焦点陷阱与关闭后焦点恢复
- 📍 位置：`js/coder.js:364-415`
- 📝 当前状况描述：灯箱打开时设置了 `role="dialog"` 和 `aria-modal="true"`，并把焦点移动到关闭按钮。但当前没有拦截 Tab/Shift+Tab，键盘焦点可能离开模态层进入背后的页面；关闭后也没有把焦点恢复到触发图片，键盘用户容易丢失原来的阅读位置。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：保存触发元素，关闭时恢复焦点；灯箱打开期间拦截 Tab，使焦点在可聚焦元素内循环。

```js
let lightboxTrigger = null;

function openLightbox(img) {
  lightboxTrigger = img;
  // ...创建 overlay...
  close.focus();
}

function closeLightbox() {
  // ...移除 overlay...
  if (lightboxTrigger && lightboxTrigger.focus) {
    lightboxTrigger.focus({ preventScroll: true });
  }
  lightboxTrigger = null;
}
```

- 📊 预期收益：让灯箱的实际键盘行为与模态语义一致，降低键盘和屏幕阅读器用户的迷失成本。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/user-data-entrypoints.md`、`docs/suggestions/module-reviews/i18n-and-accessibility.md`

### 7. 图片按钮化会覆盖原始图片的可访问名称

- 📌 问题/建议标题：灯箱触发图片应保留 `alt` 信息并说明操作意图
- 📍 位置：`js/coder.js:393-397`、`js/coder.js:417-424`
- 📝 当前状况描述：所有 `.article-content img` 都会被设置 `role="button"`、`tabIndex = 0`，并统一写入 `aria-label="查看大图"`。如果图片本身 `alt` 包含图表、截图或正文语义，统一 aria-label 会覆盖辅助技术读取到的图片内容，导致用户只知道“可以查看大图”，却不知道这是什么图。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：生成触发标签时把原始 `alt` 合并进去；对纯装饰图或空 alt 图片，可跳过按钮化或使用通用标签。

```js
const alt = (img.getAttribute("alt") || "").trim();
if (!alt) {
  img.setAttribute("aria-label", t("dyn.lightbox.open", "查看大图"));
} else {
  img.setAttribute(
    "aria-label",
    t("dyn.lightbox.openNamed", "查看大图：") + alt
  );
}
```

- 📊 预期收益：兼顾图片语义和放大查看能力，避免无障碍名称被交互提示完全替代。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/i18n-and-accessibility.md`、`docs/suggestions/ux-improvements.md`

## 优先级建议

1. 优先修复复制失败反馈、灯箱焦点闭环和图片可访问名称，这三项直接影响用户是否能理解交互结果。
2. 随后优化阅读进度写入策略，减少滚动路径的同步存储压力。
3. 最后评估文章切换历史策略和主题按钮状态表达，二者更偏体验一致性与可访问性完善。

