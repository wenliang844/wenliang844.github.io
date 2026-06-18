# 🎨 用户体验优化建议

> 分析日期：2026-06-18 | 分析范围：交互设计、视觉反馈、响应式、无障碍

---

## 📌 UX-01 [已修复]: 移动端导航菜单无遮罩层，点击外部区域无法关闭

- **📍 位置**：`src/templates/layout.mjs`、`css/coder.css`、手写 HTML 页面导航区
- **✅ 修复状态**：导航 checkbox 后增加 `.menu-overlay` label，移动端菜单打开时显示固定遮罩；点击遮罩会通过原生 label/checkbox 关系关闭菜单，无需新增脚本。
- **🧪 回归测试**：`tests/templates.test.mjs` 覆盖模板输出，`tests/css.test.mjs` 锁定遮罩层级，`tests/i18n-a11y.test.mjs` 扫描所有 HTML 页面。
- **📊 实际收益**：移动端用户可点击菜单外区域关闭导航，保留无 JS 可用性并减少遮挡困扰。
- **🔗 相关建议**：[P-01](performance-bottlenecks.md#p-01)

---

## 📌 UX-02 [已修复]: 搜索结果无键盘快捷键提示，首次使用学习成本高

- **📍 原位置**：`src/templates/layout.mjs`、`js/search.js`
- **✅ 修复状态**：导航搜索按钮增加本地化 `title` 和更具体的 `aria-label`，提示 `Ctrl+K` 与 `/`；`search.js` 初始化和语言切换时会同步 title/aria，覆盖手写页面中的旧按钮。
- **🧪 回归测试**：`tests/templates.test.mjs` 锁定模板输出，`tests/js-behavior.test.mjs` 验证运行时中文/英文提示会写入按钮。
- **📊 实际收益**：快捷键提示进入 tooltip 与辅助技术可读名称，不额外增加可见界面噪音。
- **🔗 相关建议**：[S-10](security-audit.md#s-10)

---

## 📌 UX-03: 文章正文图片无点击放大（Lightbox）功能

- **📍 位置**：`src/templates/post.mjs`（文章正文渲染）
- **📝 当前状况**：readme.md 中提到"图片懒加载 + 点击放大（lightbox）"已完成（√），但当前代码中未发现 lightbox 实现。文章中的图片直接以原始尺寸显示，无法点击放大查看细节。
- **⚠️ 影响程度**：中
- **💡 建议方案**：实现轻量 lightbox：
  ```javascript
  // 为文章图片添加点击放大
  document.querySelectorAll(".article-content img").forEach(function(img) {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", function() {
      const overlay = document.createElement("div");
      overlay.className = "lightbox-overlay";
      const clone = img.cloneNode();
      clone.style.cursor = "zoom-out";
      overlay.appendChild(clone);
      overlay.addEventListener("click", function() { overlay.remove(); });
      document.body.appendChild(overlay);
    });
  });
  ```
  CSS：
  ```css
  .lightbox-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.9); display: flex;
    align-items: center; justify-content: center;
    cursor: zoom-out;
  }
  .lightbox-overlay img { max-width: 90vw; max-height: 90vh; }
  ```
- **📊 预期收益**：技术文章配图可查看细节，阅读体验提升
- **🔗 相关建议**：[P-11](performance-bottlenecks.md#p-11)

---

## 📌 UX-04 [已修复]: 阅读进度条在非文章页面仍显示

- **📍 位置**：`js/coder.js`
- **✅ 修复状态**：滚动处理会检测当前是否存在活动文章；无文章页面保留 `.read-progress` 布局钩子但设置 `hidden`，避免首页、工具箱等页面显示误导性的阅读进度。
- **🧪 回归测试**：`tests/coder.test.mjs` 与 `tests/coder-deep.test.mjs` 覆盖文章页显示和非文章页隐藏。
- **📊 实际收益**：非文章页面视觉更干净，文章页阅读进度行为保持不变。
- **🔗 相关建议**：[TD-08](tech-debt.md#td-08)

---

## 📌 UX-05 [已修复]: 订阅表单无输入验证视觉反馈

- **📍 原位置**：`js/subscribe.js`、`css/coder.css`
- **✅ 修复状态**：页脚订阅表单和订阅弹窗在邮箱无效时都会添加 `.is-invalid` 与 `aria-invalid="true"`，聚焦输入框；用户继续输入时自动清除错误状态。
- **🧪 回归测试**：`tests/subscribe-deep.test.mjs` 覆盖页脚和弹窗错误态，`tests/css.test.mjs` 锁定 `.subscribe-input.is-invalid` 与 `.subscribe-modal-input.is-invalid` 样式。
- **📊 实际收益**：订阅失败原因从仅文字提示升级为文字、边框和可访问性状态同步反馈。
- **🔗 相关建议**：[B-08](bugs-and-risks.md#b-08)

---

## 📌 UX-06: 反馈页面无"清空全部"按钮

- **📍 位置**：`js/feedback.js`
- **📝 当前状况**：用户可以逐条删除反馈，但没有"清空全部"按钮。如果积累了大量反馈，逐条删除很繁琐。
- **⚠️ 影响程度**：低
- **💡 建议方案**：在反馈列表顶部添加清空按钮：
  ```javascript
  if (entries.length > 1) {
    const clearAll = document.createElement("button");
    clearAll.textContent = t("contact.fb.clearAll", "清空全部");
    clearAll.className = "feedback-clear-all";
    clearAll.addEventListener("click", function() {
      if (confirm(t("contact.fb.confirmClear", "确定清空所有反馈？"))) {
        save([]);
        render();
      }
    });
    listEl.before(clearAll);
  }
  ```
- **📊 预期收益**：反馈管理更便捷
- **🔗 相关建议**：无

---

## 📌 UX-07: 工具箱缺少"重置"按钮

- **📍 位置**：`js/tools.js`、`src/templates/tools.mjs`
- **📝 当前状况**：工具箱的各工具（JSON 格式化、Base64 等）有输入和输出区域，但没有统一的"清空/重置"按钮。用户需要手动清空输入框。
- **⚠️ 影响程度**：低
- **💡 建议方案**：为每个工具面板添加重置按钮：
  ```html
  <button class="tool-reset" data-tool-reset="json-input">
    <i class="fas fa-eraser"></i> 重置
  </button>
  ```
  JS 处理：
  ```javascript
  if (event.target.closest("[data-tool-reset]")) {
    const targetId = event.target.closest("[data-tool-reset]")
      .getAttribute("data-tool-reset");
    const el = document.getElementById(targetId);
    if (el) el.value = "";
    // 清空输出和状态
  }
  ```
- **📊 预期收益**：工具使用更流畅
- **🔗 相关建议**：无

---

## 📌 UX-08: 文章分享条在移动端显示拥挤

- **📍 位置**：`src/templates/post.mjs:70-79`、`css/coder.css`
- **📝 当前状况**：分享条包含 4 个按钮（X、微博、微信、复制链接）+ 文字标签，在窄屏设备上可能水平溢出或换行不美观。
- **⚠️ 影响程度**：低
- **💡 建议方案**：移动端改为紧凑布局：
  ```css
  @media (max-width: 480px) {
    .post-share {
      flex-wrap: wrap;
      gap: 8px;
    }
    .share-label { width: 100%; }
    .share-btn { flex: 1; min-width: 0; }
  }
  ```
- **📊 预期收益**：移动端分享体验改善
- **🔗 相关建议**：无

---

## 📌 UX-09: 无障碍（Accessibility）改进清单

- **📍 位置**：全站
- **📝 当前状况**：项目已有较好的 ARIA 基础（`aria-label`、`aria-expanded`、`role` 等），但以下方面可以改进：

  | 项目 | 现状 | 建议 |
  |------|------|------|
  | 跳过导航链接 | ❌ 缺失 | 添加 "Skip to main content" 链接 |
  | 焦点可见性 | ⚠️ 部分 | 确保所有交互元素有 `:focus-visible` 样式 |
  | 颜色对比度 | ✅ 良好 | 暗色主题下 muted 文本对比度约 4.5:1 |
  | 表单标签 | ✅ 良好 | 所有 input 都有 label/aria-label |
  | 动画减弱 | ✅ 已实现 | `prefers-reduced-motion` 检测 |

- **⚠️ 影响程度**：中
- **💡 建议方案**：添加跳过导航链接：
  ```html
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  ```
  CSS：
  ```css
  .skip-link {
    position: absolute; top: -100px; left: 0;
    background: var(--accent); color: #fff;
    padding: 8px 16px; z-index: 10001;
  }
  .skip-link:focus { top: 0; }
  ```
- **📊 预期收益**：WCAG 2.1 AA 合规性提升，键盘用户和屏幕阅读器体验改善
- **🔗 相关建议**：[S-05](security-audit.md#s-05)

---

## 📌 UX-10 [已修复]: 返回顶部按钮在页面刚加载时短暂可见

- **📍 原位置**：`css/coder.css`、`js/coder.js`
- **✅ 修复状态**：CSS 在 `body` 尚未带有 `.to-top-ready` 时隐藏 `.to-top`；`coder.js` 首次完成 `onScroll()` 状态计算后再添加 `.to-top-ready`，避免恢复滚动位置时出现未初始化闪烁。
- **🧪 回归测试**：`tests/css.test.mjs` 锁定初始化隐藏规则，`tests/coder-deep.test.mjs` 验证首次滚动状态计算后会标记 ready。
- **📊 实际收益**：返回顶部按钮只在状态计算完成后进入可显示状态，减少页面初始视觉抖动。
- **🔗 相关建议**：无

---

## UX 优化优先级

| 优先级 | 编号 | 影响用户范围 | 实施难度 |
|--------|------|-------------|----------|
| 🥇 | UX-03 | 文章读者 | 低 |
| 🥇 | UX-09 | 无障碍用户 | 中 |
| ✅ | UX-05 | 订阅用户 | 已完成 |
| ✅ | UX-02 | 搜索用户 | 已完成 |
| 🥉 | UX-06 | 反馈用户 | 低 |
| 🥉 | UX-07 | 工具箱用户 | 低 |
| 🥉 | UX-08 | 移动端用户 | 低 |
| ✅ | UX-10 | 所有用户 | 已完成 |
