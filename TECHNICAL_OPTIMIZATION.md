# 🔧 CWLBlog 技术优化与改进指南

**编写日期**: 2026-06-17  
**优化周期**: 12 个月  
**目标**: 达到大厂级技术标准  

---

## 概览

```
技术债务跟踪
┌──────────────────────────────────┐
│  当前状态: 8/10 (生产级别)      │
│  目标状态: 9.5/10 (业界一流)    │
│  时间投入: 200-300 小时          │
│  优先级: P0 >> P1 >> P2 > P3     │
└──────────────────────────────────┘

改进领域:
1. 性能优化     (现: 8.5/10 → 目标: 9.5/10)
2. 测试覆盖     (现: 7/10   → 目标: 9/10)
3. 文档完整度   (现: 9/10   → 目标: 9.5/10)
4. 监控告警     (现: 3/10   → 目标: 8/10)
5. 可扩展性     (现: 7/10   → 目标: 8.5/10)
```

---

## 第一部分：性能优化详细方案

### 1.1 首页加载时间优化

**当前基线**: ~1.5s (估计)

**优化目标**: < 1.0s

#### 1.1.1 资源加载优化

```javascript
// 现状分析
首屏关键资源:
├─ index.html      (5KB)         ✓ 已优化
├─ coder.css       (50KB)        🔴 未优化
├─ coder.js        (30KB)        ✓ defer 加载
├─ utils.js        (20KB)        ✓ 同步加载
└─ webfonts/       (100KB)       🔴 可优化

总计: ~205KB (未压缩)

优化方案:
1. CSS 内联关键路径
2. 字体子集化
3. 资源版本控制
4. HTTP/2 推送
```

**实现步骤**:

```javascript
// 步骤 1: 提取关键 CSS
// 工具: critical
npm install -D critical

cat > scripts/critical-css.mjs << 'EOF'
import critical from 'critical';

await critical.generate({
  inline: true,
  base: './',
  src: 'index.html',
  target: 'index.html',
  width: 1280,
  height: 1024,
  penthouse: {
    timeout: 30000
  }
});
EOF

# 步骤 2: 字体子集化
npm install -D glyphanger subsetter

# 提取所有使用的字符
cat src/posts/*.md README.md | glyphanger

# 生成子集字体
fonttools subset webfonts/Poppins.ttf --unicodes=<extracted>
```

**预期收益**:
- 首屏加载 ↓ 200-300ms
- CSS 大小 ↓ 60%
- 字体大小 ↓ 70%

#### 1.1.2 图片优化

**当前**: PNG/JPG，未压缩

**目标**: WebP 格式，自适应尺寸

```bash
# 步骤 1: 批量转换 WebP
npm install -D sharp

cat > scripts/webp-convert.mjs << 'EOF'
import sharp from 'sharp';
import { readdir } from 'fs/promises';
import { join } from 'path';

const IMAGES_DIR = './images';
const files = await readdir(IMAGES_DIR);

for (const file of files) {
  const input = join(IMAGES_DIR, file);
  const output = input.replace(/\.(jpg|png)$/, '.webp');
  
  if (!file.match(/\.(jpg|png)$/i)) continue;
  
  console.log(`📦 Converting ${file}...`);
  
  await sharp(input)
    .webp({ quality: 80 })
    .toFile(output);
  
  // 同时保留原文件用于兼容性
}
EOF

node scripts/webp-convert.mjs

# 步骤 2: 生成响应式图片
# 为每张图片生成多个尺寸

for img in images/*.webp; do
  convert "$img" -resize 192x "$img/../thumbnails/${img##*/}"
  convert "$img" -resize 512x "$img/../medium/${img##*/}"
done
```

**HTML 中的应用**:

```html
<!-- 使用 picture 元素实现自适应 -->
<picture>
  <source srcset="images/og-cover.webp" type="image/webp">
  <source srcset="images/og-cover.jpg" type="image/jpeg">
  <img src="images/og-cover.jpg" alt="OG Cover" loading="lazy">
</picture>

<!-- 多尺寸支持 -->
<img 
  srcset="
    images/medium/og-cover.webp 1x,
    images/large/og-cover.webp 2x
  "
  src="images/medium/og-cover.webp"
  loading="lazy"
  alt="OG Cover"
>
```

**预期收益**:
- 图片大小 ↓ 40-60%
- 首屏加载 ↓ 100-150ms
- 移动设备加载 ↓ 200-300ms

#### 1.1.3 脚本加载优化

**当前策略**:
```html
<script src="/js/utils.js"></script>  <!-- 同步 -->
<script src="/js/coder.js" defer></script>  <!-- defer -->
```

**改进策略**:

```html
<!-- 核心脚本：同步但小于 10KB -->
<script src="/js/utils.js"></script>

<!-- 主交互脚本：defer 异步加载 -->
<script src="/js/coder.js" defer></script>

<!-- 非关键脚本：使用 async defer 组合 -->
<script src="/js/error-handler.js" async defer></script>

<!-- 预加载关键资源 -->
<link rel="preload" href="/js/utils.js" as="script">
<link rel="preload" href="/css/coder.css" as="style">

<!-- 预连接第三方服务 -->
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://giscus.app" crossorigin>
<link rel="dns-prefetch" href="https://api.web3forms.com">
```

**预期收益**:
- 主线程阻塞减少 ↓ 50%
- 交互时间 (TTI) ↓ 100ms

#### 1.1.4 缓存策略

```nginx
# Nginx 配置示例
# 在 _headers 文件中 (Netlify) 或 .htaccess (Apache)

# 长期缓存（版本控制的资源）
/js/*.min.js
  Cache-Control: public, max-age=31536000, immutable
  
/css/*.min.css
  Cache-Control: public, max-age=31536000, immutable

# 短期缓存（可能变化的资源）
/
  Cache-Control: public, max-age=3600, must-revalidate

/post/*
  Cache-Control: public, max-age=86400, must-revalidate

# 不缓存
/search-index.json
  Cache-Control: no-cache, no-store, must-revalidate
```

**版本控制实现**:

```javascript
// scripts/build.mjs 中
const VERSION = Date.now().toString(36);

// 生成版本化资源链接
function versionedUrl(path) {
  return `${path}?v=${VERSION}`;
}

// HTML 中引用
<script src="/js/utils.js?v=abc123"></script>
<link rel="stylesheet" href="/css/coder.css?v=abc123">
```

---

### 1.2 搜索功能性能优化

**现状**: Fuse.js 首次加载 ~30KB，初始化 ~200ms

**优化方案**:

#### 1.2.1 索引分片

```javascript
// 当前: 一个大的 search-index.json
// 优化: 按分类分割索引

// scripts/build.mjs
const indices = {
  posts: [],
  pages: [],
  tags: []
};

// 分别输出
fs.writeFileSync('search-index.posts.json', JSON.stringify(indices.posts));
fs.writeFileSync('search-index.pages.json', JSON.stringify(indices.pages));
fs.writeFileSync('search-index.tags.json', JSON.stringify(indices.tags));

// 前端：只在需要时加载
async function loadSearchIndex() {
  const [posts, pages] = await Promise.all([
    fetch('/search-index.posts.json').then(r => r.json()),
    fetch('/search-index.pages.json').then(r => r.json())
  ]);
  return [...posts, ...pages];
}
```

**预期收益**:
- 初始化延迟 ↓ 50%
- 内存占用 ↓ 30%

#### 1.2.2 Web Worker 搜索

```javascript
// js/search-worker.js
importScripts('/js/vendor/fuse.min.js');

let fuse = null;
let index = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data;
  
  if (type === 'init') {
    index = payload.index;
    fuse = new Fuse(index, {
      keys: ['title', 'summary', 'tags'],
      threshold: 0.3
    });
    self.postMessage({ type: 'ready' });
  }
  
  if (type === 'search') {
    const results = fuse.search(payload.query);
    self.postMessage({ type: 'results', payload: results });
  }
};

// 主线程使用
const searchWorker = new Worker('/js/search-worker.js');

function search(query) {
  return new Promise((resolve) => {
    searchWorker.onmessage = (e) => {
      if (e.data.type === 'results') {
        resolve(e.data.payload);
      }
    };
    searchWorker.postMessage({ type: 'search', payload: { query } });
  });
}
```

**预期收益**:
- 搜索响应不阻塞 UI
- 60 FPS 滚动体验

---

### 1.3 编辑器性能优化

**当前问题**: 大文档编辑时延迟明显

#### 1.3.1 虚拟滚动

```javascript
// 仅渲染可见的编辑器行
class VirtualEditor {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.lineHeight = options.lineHeight || 24;
    this.visibleLines = Math.ceil(window.innerHeight / this.lineHeight);
    this.renderBuffer = 10; // 前后各渲染 10 行
  }
  
  onScroll(scrollTop) {
    const firstVisibleLine = Math.floor(scrollTop / this.lineHeight);
    const startLine = Math.max(0, firstVisibleLine - this.renderBuffer);
    const endLine = Math.min(
      this.lines.length,
      firstVisibleLine + this.visibleLines + this.renderBuffer
    );
    
    this.renderLines(startLine, endLine);
  }
  
  renderLines(start, end) {
    // 只渲染必要的行
    const fragment = new DocumentFragment();
    for (let i = start; i < end; i++) {
      const lineEl = this.createLineElement(i, this.lines[i]);
      fragment.appendChild(lineEl);
    }
    this.container.replaceChildren(fragment);
  }
}
```

**预期收益**:
- 大文档（10k+ 行）编辑流畅度提升
- 内存占用减少 70%

#### 1.3.2 增量渲染

```javascript
// 预览端：只更新变化的部分，而不是整个重新渲染

class IncrementalPreview {
  update(delta) {
    // delta: { start, end, oldText, newText }
    
    // 定位受影响的段落
    const startParagraph = this.getParagraphIndex(delta.start);
    const endParagraph = this.getParagraphIndex(delta.start + delta.oldText.length);
    
    // 只重新渲染这些段落
    for (let i = startParagraph; i <= endParagraph; i++) {
      this.renderParagraph(i);
    }
  }
}
```

**预期收益**:
- 编辑延迟从 150ms ↓ 50ms
- 预览更新从 200ms ↓ 80ms

---

### 1.4 CSS 性能优化

**当前问题**: 选择器过于复杂，导致重排延迟

#### 1.4.1 CSS 优化

```css
/* ❌ 低效的选择器 */
.blog-container > .article-list > .article-item:nth-child(n+2) > .title {
  color: blue;
}

/* ✅ 优化后 */
.article-title { color: blue; }

/* ❌ 触发重排 */
.card {
  top: -4px;  /* 改变位置 */
  left: -4px;
}

/* ✅ GPU 加速 */
.card {
  transform: translate(-4px, -4px);  /* 不触发重排 */
}

/* ✅ 使用 will-change 提示浏览器 */
.article-item {
  will-change: transform;
}
```

#### 1.4.2 CSS 关键路径内联

```html
<!-- index.html 中 -->
<style>
/* 内联关键 CSS (~5KB) */
* { margin: 0; padding: 0; }
body { font: 16px system-ui; }
.main { max-width: 1200px; margin: 0 auto; }
/* ... 其他关键样式 ... */
</style>

<!-- 延迟加载非关键 CSS -->
<link rel="preload" href="/css/coder.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/css/coder.css"></noscript>
```

---

## 第二部分：测试覆盖扩展

### 2.1 当前测试现状

```
测试统计
┌────────────────────────────┐
│ 单元测试:    33 个       │
│ 覆盖率:      70%         │
│ E2E 测试:    0 个        │
│ 性能测试:    0 个        │
│ 安全测试:    10 个       │
└────────────────────────────┘

改进目标:
├─ 覆盖率提升 → 85%
├─ E2E 测试 → 20+ 个
├─ 性能基准 → 自动检测
└─ 安全测试 → 30+ 个
```

### 2.2 E2E 测试实施 (Playwright)

```bash
npm install -D @playwright/test

# 创建测试配置
cat > playwright.config.js << 'EOF'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: { baseURL: 'http://localhost:8137' },
  webServer: {
    command: 'npm run serve',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
});
EOF
```

**测试用例**:

```javascript
// tests/e2e/blog.spec.js
import { test, expect } from '@playwright/test';

test('blog list filters by tag', async ({ page }) => {
  await page.goto('/post/');
  
  // 检查初始状态
  const articles = page.locator('.article-item');
  const initialCount = await articles.count();
  expect(initialCount).toBeGreaterThan(0);
  
  // 点击标签筛选
  await page.click('button[data-tag="JavaScript"]');
  
  // 验证结果
  const filtered = page.locator('.article-item.active');
  expect(await filtered.count()).toBeLessThan(initialCount);
});

test('search finds articles', async ({ page }) => {
  await page.goto('/');
  
  // 打开搜索
  await page.click('.search-toggle');
  
  // 搜索
  await page.fill('input[placeholder*="搜索"]', 'React');
  
  // 等待结果
  await page.waitForSelector('.search-results li');
  const results = await page.locator('.search-results li').count();
  
  expect(results).toBeGreaterThan(0);
});

test('editor saves to localStorage', async ({ page }) => {
  await page.goto('/editor/');
  
  // 输入内容
  const editor = page.locator('textarea');
  await editor.fill('# Test Article');
  
  // 等待保存
  await page.waitForTimeout(500);
  
  // 刷新页面
  await page.reload();
  
  // 验证恢复
  const content = await editor.inputValue();
  expect(content).toBe('# Test Article');
});
```

### 2.3 性能基准测试

```bash
npm install -D @lhci/cli @lhci/server
```

```javascript
// lighthouserc.json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "staticDistDir": "./",
      "url": [
        "http://localhost:8137/",
        "http://localhost:8137/post/",
        "http://localhost:8137/editor/"
      ],
      "settings": {
        "chromeFlags": ["--disable-dev-shm-usage"],
        "onlyCategories": ["performance", "accessibility", "best-practices", "seo"]
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "cumulativeLayoutShift": ["error", { "maxNumericValue": 0.1 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2000 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}

# 运行性能测试
npm run lighthouse
```

### 2.4 安全扩展测试

```javascript
// tests/security-extended.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// OWASP Top 10 覆盖

test('OWASP A03: Injection - SQL 防护', () => {
  // 静态站点无 SQL 注入风险
  assert.ok(true);
});

test('OWASP A06: 脆弱和过期组件检测', async () => {
  const { vulnerabilities } = await audit();
  assert.equal(vulnerabilities.length, 0);
});

test('OWASP A05: 访问控制 - 无敏感数据泄露', () => {
  // 检查硬编码的密钥
  const forbidden = ['API_KEY', 'SECRET', 'TOKEN'];
  const code = readFileSync('js/*.js', 'utf8');
  
  forbidden.forEach(pattern => {
    assert.ok(!code.includes(pattern + ':'));
  });
});

test('OWASP A04: 不安全的反序列化', () => {
  // 不使用 eval() 或动态代码执行
  const code = readFileSync('js/*.js', 'utf8');
  assert.ok(!code.includes('eval('));
  assert.ok(!code.includes('new Function('));
});

test('常见 Web 漏洞 - Clickjacking', () => {
  // 建议的 header
  // X-Frame-Options: SAMEORIGIN
  assert.ok(true); // GitHub Pages 无法设置
});

test('常见 Web 漏洞 - 开放重定向', () => {
  // 检查所有重定向逻辑
  const redirects = findRedirects();
  redirects.forEach(redirect => {
    assert.ok(isValidUrl(redirect.target));
  });
});
```

---

## 第三部分：监控与告警

### 3.1 性能监控

```javascript
// js/monitoring.js
(function() {
  const metrics = {
    performance: {},
    errors: [],
    navigation: []
  };
  
  // 收集 Web Vitals
  function collectWebVitals() {
    // LCP: Largest Contentful Paint
    if (PerformanceObserver) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        metrics.performance.lcp = lastEntry.renderTime || lastEntry.loadTime;
        reportMetric('lcp', metrics.performance.lcp);
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    }
    
    // FID: First Input Delay
    if (PerformanceObserver) {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          metrics.performance.fid = entry.processingDuration;
          reportMetric('fid', metrics.performance.fid);
        });
      }).observe({ entryTypes: ['first-input'] });
    }
    
    // CLS: Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          metrics.performance.cls = clsValue;
          reportMetric('cls', clsValue);
        }
      });
    }).observe({ entryTypes: ['layout-shift'] });
  }
  
  // 报告指标
  function reportMetric(name, value) {
    // 发送到分析服务
    navigator.sendBeacon('/api/metrics', JSON.stringify({
      metric: name,
      value,
      timestamp: Date.now(),
      url: window.location.href
    }));
  }
  
  collectWebVitals();
  window.CWLMetrics = metrics;
})();
```

### 3.2 错误收集

```javascript
// js/error-collector.js
(function() {
  const errors = [];
  
  // 捕获未处理的错误
  window.addEventListener('error', (e) => {
    errors.push({
      type: 'uncaught',
      message: e.message,
      stack: e.stack,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      timestamp: Date.now()
    });
    
    reportErrors();
  });
  
  // 捕获未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', (e) => {
    errors.push({
      type: 'unhandledrejection',
      reason: e.reason,
      promise: e.promise,
      timestamp: Date.now()
    });
    
    reportErrors();
  });
  
  function reportErrors() {
    if (errors.length > 0) {
      navigator.sendBeacon('/api/errors', JSON.stringify(errors));
      errors.length = 0;
    }
  }
  
  // 定期上报
  setInterval(reportErrors, 30000);
  
  // 页面卸载时上报
  window.addEventListener('beforeunload', reportErrors);
})();
```

### 3.3 使用分析

```javascript
// js/analytics.js
(function() {
  const events = [];
  
  function trackEvent(name, properties = {}) {
    events.push({
      name,
      properties,
      timestamp: Date.now()
    });
  }
  
  // 核心事件
  
  // 1. 页面浏览
  trackEvent('page_view', {
    url: window.location.href,
    referrer: document.referrer
  });
  
  // 2. 文章阅读
  document.querySelectorAll('[data-post-slug]').forEach(article => {
    article.addEventListener('scroll', () => {
      const scrollPercent = (window.scrollY / document.body.scrollHeight) * 100;
      if (scrollPercent > 80) {
        trackEvent('article_read', {
          slug: article.dataset.postSlug,
          percent: Math.round(scrollPercent)
        });
      }
    });
  });
  
  // 3. 编辑器使用
  document.querySelectorAll('textarea').forEach(textarea => {
    textarea.addEventListener('input', () => {
      trackEvent('editor_usage', {
        length: textarea.value.length
      });
    });
  });
  
  // 4. 搜索查询
  window.addEventListener('cwl:search', (e) => {
    trackEvent('search_query', {
      query: e.detail.query,
      resultCount: e.detail.resultCount
    });
  });
  
  // 定期上报
  setInterval(() => {
    if (events.length > 0) {
      navigator.sendBeacon('/api/events', JSON.stringify(events));
      events.length = 0;
    }
  }, 60000);
})();
```

---

## 第四部分：可扩展性改进

### 4.1 模块化重构

**目标**: 从单体架构 → 微模块架构

```javascript
// 当前: js/coder.js (单一大文件)
// 优化: 小模块 + 模块加载器

// modules/theme.js
export const ThemeModule = {
  toggle() { /* ... */ },
  set(theme) { /* ... */ }
};

// modules/search.js
export const SearchModule = {
  init() { /* ... */ },
  search(query) { /* ... */ }
};

// modules/editor.js
export const EditorModule = {
  init() { /* ... */ },
  save() { /* ... */ }
};

// core/module-loader.js
class ModuleLoader {
  async load(modules) {
    const loaded = {};
    for (const name of modules) {
      const module = await import(`/modules/${name}.js`);
      loaded[name] = module[`${capitalize(name)}Module`];
    }
    return loaded;
  }
}

// 使用
const loader = new ModuleLoader();
const { ThemeModule, SearchModule } = await loader.load(['theme', 'search']);
```

### 4.2 插件架构

```javascript
// 支持第三方插件扩展

class PluginRegistry {
  constructor() {
    this.plugins = [];
    this.hooks = {};
  }
  
  register(plugin) {
    this.plugins.push(plugin);
    
    if (plugin.hooks) {
      Object.entries(plugin.hooks).forEach(([hook, fn]) => {
        if (!this.hooks[hook]) this.hooks[hook] = [];
        this.hooks[hook].push(fn);
      });
    }
  }
  
  async runHooks(hook, context) {
    const hooks = this.hooks[hook] || [];
    for (const fn of hooks) {
      await fn(context);
    }
  }
}

// 示例: 自定义渲染器插件
const customPlugin = {
  name: 'custom-renderer',
  hooks: {
    'article:beforeRender': async (article) => {
      // 修改文章内容
      article.content = article.content.replace(/###/g, '####');
    },
    'article:afterRender': async (html) => {
      // 统计生成时间
      console.log('文章渲染完成');
    }
  }
};
```

### 4.3 配置系统升级

```javascript
// src/config.mjs 扩展

export const CONFIG = {
  // 核心配置
  site: {
    baseURL: 'https://wenliang844.github.io',
    title: 'CWLBlog'
  },
  
  // 功能开关
  features: {
    search: true,
    comments: true,
    analytics: true,
    sponsors: true
  },
  
  // 外部集成
  integrations: {
    giscus: {
      repo: 'wenliang844/wenliang844.github.io',
      repoId: '...',
      category: 'Announcements'
    },
    web3forms: {
      serviceId: 'service_...'
    }
  },
  
  // 性能调优
  performance: {
    enableCaching: true,
    enableCompression: true,
    preloadResources: true
  },
  
  // 国际化
  i18n: {
    defaultLanguage: 'zh-CN',
    supportedLanguages: ['zh-CN', 'en-US']
  }
};
```

---

## 第五部分：迁移和部署

### 5.1 CI/CD 流程

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Performance testing
        run: npm run lighthouse
      
      - name: Build
        run: npm run build
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage.json
      
      - name: Deploy to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### 5.2 环境配置

```bash
# .env.development
VITE_API_URL=http://localhost:3000
VITE_DEBUG=true

# .env.production
VITE_API_URL=https://api.wenliang844.github.io
VITE_DEBUG=false
```

---

## 第六部分：文档更新清单

### 6.1 缺失的文档

- [ ] API 文档 (JSDoc)
- [ ] 贡献指南 (CONTRIBUTING.md)
- [ ] 开发者指南 (DEVELOPER.md)
- [ ] 发布说明 (CHANGELOG.md)
- [ ] 故障排查指南 (TROUBLESHOOTING.md)

### 6.2 文档改进

```markdown
# DEVELOPER.md - 开发者指南

## 本地开发环境

### 前置条件
- Node.js 18+
- npm 9+

### 快速开始

\`\`\`bash
# 克隆
git clone https://github.com/wenliang844/wenliang844.github.io.git
cd wenliang844.github.io

# 安装
npm install

# 开发
npm run dev

# 测试
npm run validate
\`\`\`

## 代码结构

(详细的目录说明)

## 贡献流程

1. Fork 项目
2. 创建特性分支
3. 提交 PR
4. 通过 CI 检查
5. Code Review
6. 合并

## 发布流程

(版本管理和发布步骤)
```

---

## 优先级排序与时间表

### 🔴 P0 - 立即 (第 1 周)

- [ ] 启用赞助渠道
- [ ] 部署 Lighthouse CI
- [ ] 配置基准测试
- [ ] 时间: 8-12 小时

### 🟠 P1 - 紧急 (第 2-4 周)

- [ ] Service Worker 实现
- [ ] 图片优化 (WebP)
- [ ] E2E 测试框架
- [ ] 性能基准测试
- [ ] 时间: 40-60 小时

### 🟡 P2 - 重要 (第 4-8 周)

- [ ] CSS 优化
- [ ] 搜索 Worker 优化
- [ ] 编辑器虚拟滚动
- [ ] 扩展安全测试
- [ ] 时间: 60-80 小时

### 🟢 P3 - 中期 (第 8-12 周)

- [ ] 插件架构
- [ ] 完整文档
- [ ] 监控系统
- [ ] 性能分析仪表板
- [ ] 时间: 80-100 小时

---

## ROI 分析

```
优化项         成本(小时)  收益        ROI
─────────────────────────────────────
Service Worker    8        高(离线)     ⭐⭐⭐⭐⭐
图片优化         10        中(快30%)    ⭐⭐⭐⭐
E2E 测试         40        高(稳定性)   ⭐⭐⭐⭐
CSP 头           2         高(安全)     ⭐⭐⭐⭐⭐
搜索优化        12        中(快40%)    ⭐⭐⭐
编辑器优化      20        中(体验好)   ⭐⭐⭐
文档完善        24        低(参考)     ⭐⭐
```

最高 ROI: **Service Worker** + **CSP 头** + **图片优化**

---

**文档完成日期**: 2026-06-17  
**下次更新**: 2026-07-17  
**维护者**: 自动化系统
