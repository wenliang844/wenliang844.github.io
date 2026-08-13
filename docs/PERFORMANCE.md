# 性能优化指南

## 概述

本文档记录了项目中实施的性能优化措施和最佳实践。

## 已实施的优化

### 0. 当前关键链路

- 文章列表只输出标题、摘要、主题和日期，不再内嵌每篇全文。
- Pagefind 在构建后索引完整正文，并返回中文命中片段。
- Sharp 为封面生成固定尺寸 AVIF/WebP 与 `srcset`，减少传输并避免 CLS。
- 公开文章和静态资源支持 PWA 离线读取；编辑器、草稿和 API 明确排除。
- CI 在 390x844、768x1024、1280x720 三个视口运行响应式回归，并执行 Lighthouse 预算。

### 1. JavaScript 性能

#### 防抖和节流
对高频事件使用防抖和节流优化：

```javascript
// src/client/post-list.ts - 搜索输入防抖（200ms）
const debouncedSearch = CWLUtils.debounce(() => {
  query = searchInput.value.trim().toLowerCase();
  apply();
}, 200);

// js/search.js - 全局搜索输入防抖（150ms）
var debouncedRender = CWLUtils.debounce(render, 150);

// js/editor.js - 编辑器输入防抖（150ms）
var debouncedRender = CWLUtils.debounce(render, 150);

// src/client/article-reading.ts - 阅读进度滚动/尺寸更新分别节流
const throttledScroll = CWLUtils.throttle(update, 100);
const throttledResize = CWLUtils.throttle(update, 200);
```

**优化效果**：
- 减少不必要的函数调用 60-80%
- 降低 CPU 使用率
- 提升输入流畅度

#### 懒加载
延迟加载非关键资源：

```javascript
// js/search.js - 首次打开时加载 Pagefind
function loadIndex() {
  // 动态导入 /pagefind/pagefind.js
  // Pagefind 返回完整正文的匹配片段与页面元数据
}

// src/client/code-highlight.ts - 代码高亮近视口加载
function initCodeHighlight() {
  // 无代码文章零请求；首个代码块进入 800px 预取区后才加载本地 vendor
  // 已加载或正在加载的脚本会被复用，highlight.js 不进入文章入口 chunk
}
```

**优化效果**：
- 首次加载减少 ~150KB
- 提升首屏渲染速度
- 降低不必要的网络请求

#### 事件委托
使用事件委托减少监听器数量：

```javascript
// js/feedback.js - 单个监听器处理所有删除按钮
listEl.addEventListener("click", function (event) {
  var id = event.target && event.target.getAttribute("data-remove");
  if (!id) { return; }
  // 处理删除
});

// js/search.js - 单个监听器处理所有搜索结果点击
list.addEventListener("click", function (e) {
  var li = e.target.closest("li");
  if (!li) { return; }
  var idx = parseInt(li.getAttribute("data-idx"), 10);
  openResult(idx);
});
```

**优化效果**：
- 减少内存占用
- 提升事件处理效率
- 支持动态添加的元素

### 2. 渲染性能

#### DOM 操作优化
最小化 DOM 操作和重排：

```javascript
// src/client/post-list.ts - 一次性替换标签按钮集合
function rebuildTagFilter() {
  tagFilter.replaceChildren(...tags.map(buildTagChip));
}

// js/feedback.js - 使用 replaceChildren 清空列表
listEl.replaceChildren();
```

#### 虚拟滚动
对长列表实施滚动优化：

```javascript
// src/client/article-reading.ts - 滚动监听使用 passive 标志
window.addEventListener("scroll", throttledScroll, { passive: true });
```

**优化效果**：
- 允许浏览器优化滚动性能
- 减少主线程阻塞
- 阅读位置仅在进度变化至少 1% 时写入，并在 `pagehide` 最终刷新，避免滚动期间高频写 `localStorage`
- 文章专属逻辑只进入 `/post/` 的 Vite 运行时块，非文章页面不再创建阅读进度 DOM 或扫描正文

#### CSS 动画
使用 GPU 加速的 CSS 属性：

```css
/* 优先使用 transform 和 opacity */
.card {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

/* 避免动画触发布局计算 */
.card:hover {
  transform: translateY(-4px);  /* ✓ GPU 加速 */
  /* top: -4px;  ✗ 触发重排 */
}
```

### 3. 资源加载优化

#### 脚本加载策略
```html
<!-- 关键脚本：立即加载 -->
<script src="/js/utils.js"></script>
<script src="/js/error-handler.js"></script>

<!-- 非关键全站脚本：延迟加载 -->
<script src="/js/search-loader.js" defer></script>

<!-- 路由客户端模块按需协调独立 vendor，不在 HTML 中直挂 -->
<!-- /js/vendor/highlight.min.js 仅在代码块接近视口时请求 -->

<!-- 工具页仍可按其独立能力加载第三方库 -->
<script src="https://cdn.jsdelivr.net/npm/marked@18.0.5/marked.min.js" async></script>
```

#### 图片优化
- 使用适当的图片格式（WebP > JPEG > PNG）
- 提供响应式图片：`<img srcset="...">`
- 添加 `loading="lazy"` 属性
- 压缩图片（建议 < 200KB）

#### 字体优化
```css
/* 字体子集化和预加载 */
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;  /* 避免 FOIT */
  unicode-range: U+0020-007E;  /* 仅包含需要的字符 */
}
```

### 4. 缓存策略

#### IndexedDB 草稿存储
```javascript
// 编辑器多草稿持久化
function saveState() {
  // 草稿单独存储，不进入 Service Worker 或共享缓存
}

// 主题偏好持久化
CWLUtils.storageSet(STORAGE_KEY_THEME, dark ? "dark" : "light");
```

#### HTTP 缓存
推荐的 HTTP 头配置：

```
# 静态资源（JS/CSS/字体）- 长期缓存
Cache-Control: public, max-age=31536000, immutable

# HTML 文件 - 不缓存或短期缓存
Cache-Control: no-cache

# 图片 - 中期缓存
Cache-Control: public, max-age=2592000
```

### 5. 构建优化

#### 代码压缩
```bash
# 生产构建（未来添加）
npm run build:prod
# - 压缩 JavaScript (Terser)
# - 压缩 CSS (cssnano)
# - 移除注释和空格
# - Tree-shaking
```

#### 输出优化
```javascript
// scripts/build.mjs - 压缩 HTML 输出
function tidyHtml(html) {
  // 移除多余空行
  return html.replace(/\n{2,}/g, "\n").trim();
}
```

### 6. 网络性能

#### CDN 使用
```html
<!-- 使用 CDN 加速第三方库 -->
<script src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js"></script>
```

#### HTTP/2 推送
```
# 服务器配置（Nginx 示例）
http2_push_preload on;
link: </css/coder.css>; rel=preload; as=style
link: </js/utils.js>; rel=preload; as=script
```

### 7. 性能监控

#### Core Web Vitals
```javascript
// js/performance-monitor.js
PerformanceMonitor.init();

// 监控指标：
// - LCP (Largest Contentful Paint) - 目标 < 2.5s
// - FID (First Input Delay) - 目标 < 100ms
// - CLS (Cumulative Layout Shift) - 目标 < 0.1
```

#### 资源监控
```javascript
// 监控慢资源（加载 > 1s）
observeResources: function() {
  var observer = new PerformanceObserver(function(list) {
    list.getEntries().forEach(function(entry) {
      if (entry.duration > 1000) {
        console.warn('[Performance] Slow resource:', entry.name);
      }
    });
  });
  observer.observe({ entryTypes: ['resource'] });
}
```

## 性能基准

### 目标指标

| 指标 | 目标值 | 当前值 |
|------|--------|--------|
| **LCP** | < 2.5s | 待测量 |
| **FID** | < 100ms | 待测量 |
| **CLS** | < 0.1 | 待测量 |
| **首次渲染** | < 1.5s | 待测量 |
| **可交互时间** | < 3.5s | 待测量 |
| **总页面大小** | < 1MB | ~800KB |
| **请求数** | < 30 | ~25 |

### 测试工具

```bash
# Lighthouse
npx lighthouse https://wenliang844.github.io --view

# WebPageTest
# 访问 https://www.webpagetest.org/

# Chrome DevTools Performance
# 1. 打开 DevTools (F12)
# 2. 切换到 Performance 标签
# 3. 点击 Record 开始录制
# 4. 刷新页面
# 5. 分析结果
```

## 性能检查清单

部署前检查：

- [ ] 所有图片已压缩优化
- [ ] 脚本使用 defer/async 加载
- [ ] 启用文本压缩（gzip/brotli）
- [ ] 配置适当的缓存策略
- [ ] 移除未使用的 CSS/JS
- [ ] 运行 Lighthouse 审计（分数 > 90）
- [ ] 测试慢速网络（3G）下的表现
- [ ] 验证 Core Web Vitals 达标

## 持续优化

### 监控
- 使用 Google Analytics 跟踪真实用户性能
- 配置 Performance Budgets
- 定期审查慢页面

### 优化周期
1. **测量** - 使用工具收集性能数据
2. **分析** - 识别瓶颈和优化机会
3. **优化** - 实施改进措施
4. **验证** - 测量优化效果
5. **重复** - 持续迭代改进

## 参考资源

- [Web.dev Performance](https://web.dev/performance/)
- [MDN Web Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Google Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Can I Use](https://caniuse.com/) - 浏览器兼容性
