# 项目结构

```
wenliang844.github.io/
├── .claude/                   # Claude Code 配置
│   ├── settings.json          # 项目设置
│   └── launch.json            # 开发服务器配置
│
├── .github/                   # GitHub Actions 工作流（可选）
│   └── workflows/
│       └── deploy.yml         # 自动部署配置
│
├── css/                       # 样式文件
│   ├── coder.css              # 主样式
│   └── fontawesome-all.min.css  # 图标字体
│
├── docs/                      # 项目文档
│   ├── SECURITY.md            # 安全指南
│   ├── PERFORMANCE.md         # 性能优化指南
│   └── DEPLOYMENT.md          # 部署指南
│
├── js/                        # JavaScript 文件
│   ├── utils.js               # 公共工具函数
│   ├── error-handler.js       # 全局错误处理
│   ├── performance-monitor.js # 性能监控（可选）
│   ├── logger.js              # 日志收集器（可选）
│   ├── i18n.js                # 国际化
│   ├── coder.js               # 核心交互逻辑
│   ├── blog.js                # 博客列表交互
│   ├── search.js              # 全局搜索
│   ├── search-loader.js       # 搜索懒加载
│   ├── toc.js                 # 文章目录
│   ├── editor.js              # Markdown 编辑器
│   ├── overleaf.js            # 简历编辑器
│   ├── feedback.js            # 反馈表单
│   ├── giscus.js              # 评论系统
│   ├── share.js               # 分享功能
│   ├── highlight-loader.js    # 代码高亮懒加载
│   └── vendor/                # 第三方库
│       ├── marked.min.js      # Markdown 解析器
│       ├── purify.min.js      # HTML 清理器
│       ├── highlight.min.js   # 代码高亮
│       ├── fuse.min.js        # 模糊搜索
│       └── qrcode.min.js      # 二维码生成
│
├── scripts/                   # 构建脚本
│   └── build.mjs              # 主构建脚本
│
├── src/                       # 源文件
│   ├── config.mjs             # 站点配置
│   ├── lib/
│   │   └── format.mjs         # 格式化工具
│   ├── posts/                 # Markdown 文章源文件
│   │   ├── example-post.md
│   │   └── ...
│   └── templates/             # HTML 模板
│       ├── layout.mjs         # 页面布局
│       ├── post.mjs           # 文章页模板
│       ├── tags.mjs           # 标签页模板
│       ├── categories.mjs     # 归档页模板
│       └── ai.mjs             # AI 导航页模板
│
├── tests/                     # 测试文件
│   ├── build.test.mjs         # 构建测试
│   ├── security.test.mjs      # 安全测试
│   ├── templates.test.mjs     # 模板测试
│   ├── utils.test.mjs         # 工具函数测试
│   └── links.test.mjs         # 链接验证测试
│
├── post/                      # 构建输出：文章页
│   ├── index.html             # 文章列表
│   ├── index.xml              # RSS 订阅
│   └── [slug]/
│       └── index.html         # 单篇文章
│
├── tags/                      # 构建输出：标签云
│   └── index.html
│
├── categories/                # 构建输出：时间归档
│   ├── index.html
│   └── index.xml
│
├── ai/                        # 构建输出：AI 导航
│   └── index.html
│
├── editor/                    # Markdown 编辑器页面
│   └── index.html
│
├── overleaf/                  # 简历编辑器页面
│   └── index.html
│
├── contact/                   # 联系页面
│   └── index.html
│
├── index.html                 # 首页
├── sitemap.xml                # 搜索引擎地图
├── index.xml                  # 站点 RSS
├── search-index.json          # 搜索索引
├── robots.txt                 # 搜索引擎爬虫配置
├── package.json               # 项目配置
├── .eslintrc.json             # ESLint 配置
└── README.md                  # 项目说明
```

## 关键文件说明

### 配置文件

- **package.json** - npm 项目配置，定义脚本和依赖
- **.eslintrc.json** - 代码检查规则
- **src/config.mjs** - 站点级配置（URL、标题、SEO 等）

### 构建系统

- **scripts/build.mjs** - 主构建脚本
  - 解析 Markdown 文章
  - 验证必填字段和格式
  - 渲染 HTML 页面
  - 生成 sitemap 和 RSS
  - 构建搜索索引

### 模板系统

- **src/templates/layout.mjs** - 页面通用结构
- **src/templates/post.mjs** - 文章页和列表页
- **src/templates/tags.mjs** - 标签云页面
- **src/templates/categories.mjs** - 时间归档页面

### 前端核心

- **js/utils.js** - 公共工具（转义、复制、节流、防抖等）
- **js/error-handler.js** - 全局错误捕获和用户友好提示
- **js/coder.js** - 页面交互核心（主题切换、阅读进度、返回顶部、目录等）
- **js/blog.js** - 博客列表交互（搜索、标签过滤、面板切换）
- **js/search.js** - 全局模糊搜索（Fuse.js 驱动）

### 测试套件

- **tests/security.test.mjs** - XSS 防护、输入验证、转义逻辑
- **tests/build.test.mjs** - 构建输出验证
- **tests/templates.test.mjs** - 模板转义验证
- **tests/utils.test.mjs** - 工具函数验证
- **tests/links.test.mjs** - 链接完整性检查

## 数据流

### 构建流程

```
src/posts/*.md
    ↓ (parse front matter + markdown)
scripts/build.mjs
    ↓ (render templates)
post/[slug]/index.html  (单篇文章)
post/index.html         (文章列表)
tags/index.html         (标签云)
categories/index.html   (时间归档)
sitemap.xml             (SEO)
index.xml               (RSS)
search-index.json       (搜索索引)
```

### 运行时流程

```
用户访问 /post/
    ↓
加载 post/index.html
    ↓
执行 js/blog.js
    ↓
初始化搜索、标签过滤、面板切换
    ↓
用户交互（搜索、筛选、点击）
    ↓
动态更新 DOM（不刷新页面）
```

### 搜索流程

```
用户打开搜索弹窗
    ↓
懒加载 fuse.min.js + search-index.json
    ↓
用户输入查询
    ↓
防抖 150ms
    ↓
Fuse.js 模糊搜索
    ↓
安全渲染结果（DOM API，无 innerHTML）
    ↓
用户选择结果 → 跳转页面
```

## 开发工作流

### 添加新文章

1. 在 `src/posts/` 创建 `my-post.md`
2. 添加 front matter：
   ```yaml
   ---
   title: "文章标题"
   shortTitle: "短标题"
   slug: my-post
   date: 2026-06-17
   summary: "摘要"
   description: "SEO 描述"
   tags: [标签1, 标签2]
   ---
   ```
3. 编写 Markdown 正文
4. 运行 `npm run build`
5. 查看 `post/my-post/index.html`

### 修改样式

1. 编辑 `css/coder.css`
2. 刷新浏览器查看效果
3. 测试响应式布局（移动端）

### 添加新功能

1. 编辑相应的 JS 文件（如 `js/coder.js`）
2. 添加测试（如 `tests/utils.test.mjs`）
3. 运行 `npm run validate` 确保通过
4. 提交代码

### 国际化

1. 在 `js/i18n.js` 添加翻译键值
2. 在 HTML 中使用 `data-i18n` 或 `data-i18n-html` 属性
3. 动态内容使用 `cwlT(key, fallback)` 函数

## 扩展指南

### 添加新页面

1. 在 `src/templates/` 创建新模板（如 `my-page.mjs`）
2. 在 `scripts/build.mjs` 中渲染新页面
3. 在 `src/config.mjs` 的 `STATIC_PAGES` 中添加路由
4. （可选）在 `SEARCH_PAGES` 中添加搜索索引

### 添加新的第三方库

1. 下载到 `js/vendor/` 或使用 CDN
2. 在模板中引入（优先使用 `defer` 或 `async`）
3. 更新 CSP 策略（如需要）
4. 在 `.eslintrc.json` 中声明全局变量

### 自定义构建

编辑 `scripts/build.mjs`：

```javascript
// 自定义处理逻辑
function customProcess(posts) {
  // 过滤、排序、分组等
  return posts.filter(p => !p.draft);
}

const posts = customProcess(await loadPosts());
```

## 性能考量

### 构建优化

- 并行处理文章（未来可添加）
- 增量构建（仅重建变更的文章）
- 缓存 Markdown 渲染结果

### 运行时优化

- 懒加载非关键资源（搜索、代码高亮）
- 防抖/节流高频事件
- 使用事件委托减少监听器
- DOM 操作批量化

## 维护建议

### 定期任务

- **每周**：运行 `npm audit` 检查依赖漏洞
- **每月**：更新依赖到最新稳定版本
- **每季度**：审查性能指标（Lighthouse）
- **每年**：完整安全审计

### 备份策略

- 使用 Git 版本控制（已实施）
- 定期推送到 GitHub（远程备份）
- 导出 `src/posts/` 到本地（额外备份）
- 备份 `localStorage` 数据（编辑器草稿、反馈等）

### 监控

- 使用 Google Analytics 跟踪访问
- 监控 Core Web Vitals（LCP、FID、CLS）
- 设置错误收集（可选）
- 定期检查死链接

## 相关文档

- [安全指南](./SECURITY.md)
- [性能优化指南](./PERFORMANCE.md)
- [部署指南](./DEPLOYMENT.md)
- [README.md](../README.md)
