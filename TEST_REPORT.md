# CWLBlog 测试报告

> 最新状态（2026-06-17）：本文件下方保留早期基线报告，部分严重问题已在后续优化轮次中修复。当前 `npm test` 为 38/38 通过，`npm run validate:production` 为 33 项通过、0 失败、0 警告，官方 npm registry 审计为 0 个已知漏洞。最新优化过程见 `docs/optimization-report.md`。

**测试时间：** 2026-06-17  
**测试范围：** 全站 18 个页面 + 构建系统 + 测试套件  
**总体评价：** 网站功能基本完整，视觉设计精美，但存在 SEO、i18n 一致性、测试套件损坏等问题。

---

## 🔴 严重问题（3 个）

### 1. `/about/` 页面未收录到 sitemap.xml
- **现象：** sitemap.xml 包含 16 个 URL，但 `/about/` 页面完全缺失
- **影响：** 搜索引擎无法发现关于页面，严重影响 SEO
- **位置：** `scripts/build.mjs` 或 `src/config.mjs` 的 STATIC_PAGES 配置

### 2. 测试套件大面积失败（5/6 文件）
- **现象：** 运行 `npm test` 时 6 个测试文件中 5 个报错
  - `build.test.mjs` — `ERR_INVALID_ARG_TYPE`（path 参数为 undefined）
  - `links.test.mjs` — 同上
  - `security.test.mjs` — `webidl-conversions` 崩溃（Node.js 18.18.2 与 jsdom 版本不兼容）
  - `subscribe.test.mjs` — 同上
  - `utils.test.mjs` — 同上
  - `templates.test.mjs` — ✅ 4/4 通过
- **影响：** 安全测试、链接校验、构建测试全部失效，CI 形同虚设
- **根因：** `jsdom` 依赖版本过旧，与 Node.js 18.18.2 的 `ArrayBuffer.prototype.resizable` 不兼容

### 3. 手写页面缺少 OG/Twitter 元标签
- **现象：** 首页、about、contact、editor、overleaf、404 均无 `og:title`、`og:description`、`og:image`、`twitter:card`、`canonical`
- **对比：** build 生成的文章页有完整的 OG/Twitter 标签
- **影响：** 社交媒体分享这些页面时无法生成预览卡片

---

## 🟡 中等问题（8 个）

### 4. Footer 和 meta 标签声称 "Powered by Hugo"（实际不是）
- **位置：**
  - 所有页面的 `<meta name="generator" content="Hugo 0.82.0">`
  - 所有页面 footer: `© 2021 - 2026 CWL · Powered by Hugo · Theme inspired by Coder`
  - editor 页面提示文字: "可放入 Hugo 的 content/post/"
- **事实：** 网站使用自定义 `build.mjs` 静态站点生成器，不是 Hugo
- **建议：** 移除 Hugo generator meta，修改 footer 和 editor 提示文字

### 5. 中英文混杂 — "Sponsor" 链接
- **位置：** 导航栏和 footer 中的赞助链接均显示英文 "Sponsor" / "☕ Sponsor" / "💳 PayPal Support"
- **对比：** 其他导航项均为中文（"博客"、"编辑器"、"联系"等）
- **建议：** 添加 `data-i18n` 属性或使用中文"赞助"

### 6. "Contact" 页面标题为英文
- **位置：** `contact/index.html` 的 `<h1>Contact</h1>`
- **现象：** 虽有 `data-i18n="contact.h1"` 属性，但默认显示英文，与中文站点不一致
- **建议：** 将默认文本改为"联系"或"联系方式"

### 7. "Markdown Editor" 标题和按钮中英混杂
- **位置：** `editor/index.html`
- **现象：**
  - 标题 "Markdown Editor"（英文）
  - 按钮 " New"、" Sample"（英文）
  - 表单标签 "Title"、"Slug"、"Date"（英文）
  - 工具提示和说明文字为中文
- **建议：** 统一语言风格，按钮和标签添加 `data-i18n` 或使用中文默认值

### 8. 404 页面 "Go to homepage" 为英文
- **位置：** `404.html` — `<a href="/" data-i18n="notfound.home">Go to homepage</a>`
- **现象：** 虽有 i18n 属性，但默认显示英文；中文用户看到的 404 页面中有一行英文

### 9. 个人主页（index.html）大量内容缺少 i18n 属性
- **位置：** `index.html`
- **现象：** 以下内容无 `data-i18n` 属性，切换英文时不会翻译：
  - 精选项目卡片（视频智能侦测系统、钱谷财税 SaaS 等）
  - 时间线标题（浙江联乾信息科技 · Java 开发工程师等）
  - 荣誉列表
- **影响：** 英文模式下这些内容仍显示中文

### 10. 反馈系统仅 localStorage
- **位置：** `contact/index.html` + `js/feedback.js`
- **现象：** 反馈内容只保存在用户浏览器 localStorage 中，不会发送到服务器
- **影响：** 博主无法看到任何用户反馈，功能名存实亡
- **建议：** 接入后端 API 或使用第三方服务（如 Formspree、Google Forms）

### 11. 鉴赏页面（appreciation）内容不完整
- **现象：** "影视作品排行榜" 和 "娱乐项目排行榜" 两个板块为空，只有"科技研究排行榜"有数据
- **建议：** 补充内容或隐藏空板块

---

## 🟢 轻微问题 / 改进建议（6 个）

### 12. OG 图片（og:image）缺失
- **现象：** build 生成的文章页有 OG 标签但无 `og:image`；社交分享时没有特色图片
- **建议：** 生成默认 OG 图片或为每篇文章配置图片

### 13. 暗黑模式为系统偏好跟随（非记忆）
- **现象：** 首次访问时跟随系统 `prefers-color-scheme`，但用户手动切换后未见 localStorage 持久化（`localStorage.getItem('theme')` 返回 null）
- **建议：** 用户手动切换主题后保存到 localStorage，下次访问时优先使用

### 14. 导航栏缺少 "关于" 页面入口
- **现象：** `/about/` 页面存在且内容完整，但导航栏中没有链接
- **建议：** 在导航栏添加"关于"链接

### 15. 文章分享按钮仅显示图标
- **现象：** 分享条（X、微博、微信、复制链接）只显示 SVG 图标，无文字标签
- **影响：** 功能可用，但新用户可能不易识别各按钮用途
- **建议：** 添加 tooltip 或 aria-label（已有 aria-label，可接受）

### 16. 阅读进度条和返回顶部按钮
- **现象：** 功能正常工作 ✅
- **建议：** 无

### 17. 搜索功能
- **现象：** 搜索正常工作，输入 "Claude" 能找到对应文章 ✅
- **建议：** 无

---

## ✅ 测试通过项

| 检查项 | 结果 |
|--------|------|
| 所有页面 HTTP 200 | ✅ |
| 移动端响应式（375px） | ✅ 无水平溢出 |
| 暗黑模式默认跟随系统 | ✅ |
| 导航链接全部可访问 | ✅ 无死链 |
| 搜索功能 | ✅ 可搜索并返回结果 |
| 文章页 TOC 侧边栏 | ✅ |
| 文章页 prev/next 导航 | ✅ |
| 文章页 Giscus 评论 | ✅ |
| 文章页分享按钮 | ✅（图标） |
| RSS 订阅（3 个 feed） | ✅ |
| 404 页面 | ✅ |
| 无重复 ID | ✅ |
| 无锚点死链 | ✅ |
| 站点地图（除 /about/） | ✅ |
| robots.txt | ✅ |
| 模板测试（templates.test.mjs） | ✅ 4/4 |

---

## 📊 问题汇总

| 严重度 | 数量 | 影响领域 |
|--------|------|----------|
| 🔴 严重 | 3 | SEO、CI/测试、社交分享 |
| 🟡 中等 | 8 | 品牌一致性、i18n、功能完整性 |
| 🟢 轻微 | 6 | 体验优化、内容补充 |
| **总计** | **17** | |

---

## 🛠 优先修复建议

1. **P0 — 修复 sitemap 遗漏 `/about/`**：在 `src/config.mjs` 的 STATIC_PAGES 中添加 about
2. **P0 — 修复测试套件**：升级 jsdom 版本，修复 build/links 测试的 path 参数
3. **P1 — 手写页面添加 OG/Twitter 标签**：至少为首页添加 og:title、og:description
4. **P1 — 移除 Hugo 虚假声明**：修改 generator meta 和 footer
5. **P1 — 统一 i18n**：为英文元素添加中文默认值
6. **P2 — 补充鉴赏页面内容** 或隐藏空板块
7. **P2 — 为反馈系统接入后端** 或标注为纯本地功能
