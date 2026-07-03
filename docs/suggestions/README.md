# 📋 CWLBlog 项目分析报告索引

> 生成日期：2026-06-18 | 分析工具：Claude Code 自主分析

---

## 2026-07-03 自主复查快照（第 2 轮更新）

| 项目 | 结果 |
|------|------|
| 当前分支 | `codex/autonomous-optimization` |
| 工作区注意事项 | 多个源码/生成文件存在非本轮修改，已保留不触碰；本轮仅写入 `/docs/suggestions` |
| 只读检查 | `npm run check:readonly` 通过，731/731 tests pass，ESLint 0 error / 77 warning |
| 生产验证 | `npm run validate:production` 通过，但发现该脚本会写根目录构建产物 |
| 依赖审计 | `npm audit --omit=dev --json` 0 漏洞 |
| 覆盖率 | 总体 lines 94.32%、branches 76.28%、functions 91.70%，通过阈值 |
| 本地服务冒烟 | `/`、`/tools/`、`/post/`、`/search-index.json` 均返回 200 |
| 第 2 轮深挖 | `js/assistant.js`、`js/tools-core.js`、`tests/assistant*.mjs`、`tests/tools*.mjs` |
| 第 2 轮行为探测 | Cron 无解表达式 `0 0 31 2 *` 约 127.57ms；普通表达式约 0.19-1.52ms |

### 新增高优先级发现

| 编号 | 等级 | 建议 | 文档 |
|------|------|------|------|
| S-11 | 高 | `assistant.js` 仍在前端运行时拼接并使用默认体验 API Key | [security-audit.md](security-audit.md#s-11-assistantjs-仍在前端运行时拼接并使用默认体验-api-key) |
| S-14 | 中 | AI 助手对话和 LLM 上下文长期留存在 localStorage | [security-audit.md](security-audit.md#s-14-ai-助手对话和-llm-上下文长期留存在-localstorage) |
| S-12 | 中 | Mini API Tester 会把 Authorization 头和请求体持久化到 localStorage | [security-audit.md](security-audit.md#s-12-mini-api-tester-会把-authorization-头和请求体持久化到-localstorage) |
| S-13 | 中 | 手势工具运行时加载 CDN 机器视觉脚本和模型，缺少完整供应链约束 | [security-audit.md](security-audit.md#s-13-手势工具运行时加载-cdn-机器视觉脚本和模型缺少完整供应链约束) |
| B-13 | 中 | 生产验证脚本默认会覆盖根目录构建产物 | [bugs-and-risks.md](bugs-and-risks.md#b-13-生产验证脚本默认会覆盖根目录构建产物) |
| B-14 | 中 | 工具箱按需脚本加载 Promise 过早 resolve，手势页存在初始化竞态 | [bugs-and-risks.md](bugs-and-risks.md#b-14-工具箱按需脚本加载-promise-过早-resolve手势页存在初始化竞态) |
| B-15 | 中 | AI 助手模式偏好写入后不会被恢复 | [bugs-and-risks.md](bugs-and-risks.md#b-15-ai-助手模式偏好写入后不会被恢复) |
| B-16 | 中 | AI 助手 SSE 流结束时可能丢失最后一个未闭合事件 | [bugs-and-risks.md](bugs-and-risks.md#b-16-ai-助手-sse-流结束时可能丢失最后一个未闭合事件) |
| P-13 | 中 | 关键静态产物体积已经接近当前性能预算 | [performance-bottlenecks.md](performance-bottlenecks.md#p-13-关键静态产物体积已经接近当前性能预算) |
| P-16 | 中 | Cron 无解表达式会在主线程同步扫描两年分钟粒度 | [performance-bottlenecks.md](performance-bottlenecks.md#p-16-cron-无解表达式会在主线程同步扫描两年分钟粒度) |
| UX-13 | 中 | AI 助手默认模式与隐私文案需要重新对齐 | [ux-improvements.md](ux-improvements.md#ux-13-ai-助手默认模式与隐私文案需要重新对齐) |
| CQ-12 | 中 | 安全回归测试只检查连续 key 字面量，无法识别拼接型密钥 | [code-quality.md](code-quality.md#cq-12-安全回归测试只检查连续-key-字面量无法识别拼接型密钥) |

### 当前健康度修正

| 维度 | 2026-06-18 | 2026-07-03 复查 | 说明 |
|------|------------|------------------|------|
| 安全性 | 3.5 / 5 | 2.7 / 5 | 前端默认体验 key、AI 对话持久化和 UUID 弱随机 fallback 需优先治理 |
| 工程化 | 4.2 / 5 | 3.8 / 5 | 质量门禁存在写入副作用，assistant/Cron 边界缺少回归测试 |
| 性能 | 4.2 / 5 | 3.8 / 5 | CSS/HTML 体积接近预算，Cron 无解表达式存在主线程同步扫描 |
| 用户体验 | 4.0 / 5 | 3.8 / 5 | AI 助手默认模式、超时反馈和隐私文案需对齐 |
| 综合 | 3.9 / 5 | 3.4 / 5 | 项目整体仍可稳定运行，但安全和助手体验是当前最高优先级 |

---

## 🏥 项目健康度总评

| 维度 | 评分 | 等级 |
|------|------|------|
| 代码质量 | 4.0 / 5 | 🟢 良好 |
| 安全性 | 3.5 / 5 | 🟡 中等 |
| 性能 | 4.2 / 5 | 🟢 良好 |
| 架构设计 | 4.3 / 5 | 🟢 优秀 |
| 工程化 | 4.2 / 5 | 🟢 良好 |
| 用户体验 | 4.0 / 5 | 🟢 良好 |
| 可维护性 | 3.7 / 5 | 🟢 良好 |
| **综合** | **3.9 / 5** | **🟢 良好** |

---

## 📊 问题统计

| 优先级 | 类别 | 文档 | 发现数量 |
|--------|------|------|----------|
| 🔴 第一 | Bug 与风险 | [bugs-and-risks.md](bugs-and-risks.md) | 16（中 5 / 已修复 11） |
| 🔴 第一 | 安全审计 | [security-audit.md](security-audit.md) | 16（高 1 / 中 3 / 低 7 / 已修复 5） |
| 🔴 第一 | 性能瓶颈 | [performance-bottlenecks.md](performance-bottlenecks.md) | 16（中 6 / 低 2 / 预防 1 / 部分 1 / 已修复 6） |
| 🟡 第二 | 代码质量 | [code-quality.md](code-quality.md) | 12（中 3 / 低 3 / 已修复 6） |
| 🟡 第二 | 架构评审 | [architecture-review.md](architecture-review.md) | 7（中 3 / 低 4） |
| 🟡 第二 | 技术债务 | [tech-debt.md](tech-debt.md) | 12（中 2 / 低 8 / 已修复 2） |
| 🟢 第三 | 新功能建议 | [new-features.md](new-features.md) | 13 |
| 🟢 第三 | UX 优化 | [ux-improvements.md](ux-improvements.md) | 13（中 3 / 低 2 / 已修复 8） |
| 🟢 第三 | 开发体验 | [devex-improvements.md](devex-improvements.md) | 13（中 2 / 低 4 / 部分 1 / 已修复 6） |
| 🔵 第四 | 模块分析-构建系统 | [module-reviews/build-system.md](module-reviews/build-system.md) | 5（低 2 / 已修复 3） |
| 🔵 第四 | 模块分析-客户端JS | [module-reviews/client-javascript.md](module-reviews/client-javascript.md) | 5（低 3 / 已修复 2） |
| 🔵 第四 | 模块分析-编辑器 | [module-reviews/editor.md](module-reviews/editor.md) | 5 |
| 🔵 第四 | 模块分析-Overleaf | [module-reviews/overleaf.md](module-reviews/overleaf.md) | 5 |
| 🔵 第四 | 模块分析-CSS | [module-reviews/css-analysis.md](module-reviews/css-analysis.md) | 5 |
| 🔵 第四 | SEO 与可访问性 | [module-reviews/seo-analysis.md](module-reviews/seo-analysis.md) | 6 |
| 🔵 第四 | 资源与内容分析 | [module-reviews/resource-analysis.md](module-reviews/resource-analysis.md) | 5 |
| 🔵 第四 | HTML 页面一致性 | [module-reviews/html-pages.md](module-reviews/html-pages.md) | 5 |
| 🔵 第四 | 工具箱手势与 API 测试器 | [module-reviews/tools-gesture-and-api.md](module-reviews/tools-gesture-and-api.md) | 5（中 3 / 低 2） |
| 🔵 第四 | AI 助手深度分析 | [module-reviews/assistant-deep-dive.md](module-reviews/assistant-deep-dive.md) | 5（高 1 / 中 3 / 低 1） |
| 🔵 第四 | tools-core 深度分析 | [module-reviews/tools-core.md](module-reviews/tools-core.md) | 5（中 1 / 低 4） |
| 🔵 第四 | 竞品分析 | [competitive-analysis.md](competitive-analysis.md) | 6 |
| | **总计** | | **历史 141 条 + 复查新增/更新 40 条** |

---

## 🎯 按优先级排序的待办建议

### 🥇 高价值低成本（推荐立即实施）

| 编号 | 建议 | 来源 | 难度 |
|------|------|------|------|
| S-11 | 移除前端可还原体验 API key，改走服务端限额代理或用户自填 key | 安全 | ⭐⭐ |
| B-15 | 修复 AI 助手模式偏好读取逻辑，默认回到站点模式 | Bug | ⭐ |
| B-16 | 补齐 SSE 流结束 buffer flush，避免尾部 delta 丢失 | Bug | ⭐ |
| S-14 | 为 AI 助手增加隐私模式、历史保留期限和清除全部对话入口 | 安全/功能 | ⭐⭐ |
| P-16 | 优化 Cron 无解表达式，避免主线程百万次扫描 | 性能 | ⭐⭐ |
| ~~F-04~~ | ~~主题跟随系统~~ ✅ 已优化 | 功能 | ~~⭐~~ |

已完成：S-00 移除前端硬编码 API key，并新增无 key 阻断和源码密钥扫描回归测试。
已完成：P-01 粒子动画空闲停止，并新增 fake canvas 回归测试。
已完成：B-06 构建期标题 ID 去重，并新增 TOC/正文锚点一致性回归测试。
已完成：UX-04 非文章页隐藏阅读进度条；B-11 替换废弃 `pageYOffset`。
已完成：CQ-01/B-12 统一快捷键编辑态判断到 `CWLUtils.isEditing()`。
已完成：CQ-10 构建期 TOC 与正文标题处理合并为单次遍历。
已完成：B-10 反馈时间格式化改用 `Number.isNaN()`。
已完成：B-09 性能监控改用 Navigation Timing Level 2。
已完成：CQ-07 应用源码 DOM 集合转换统一改用 `Array.from()`。
已完成：B-04 giscus 未配置占位提示改用 DOM API 渲染。
已完成：S-02 微信二维码弹窗改用 DOM API 渲染 i18n 文案。
已完成：B-03 搜索结果高亮改用 DOM API 渲染。
已完成：CQ-02 复制逻辑统一委托 `CWLUtils.copyText`。
已完成：CQ-03 移除 `search.js` 内联 `escapeHtml` 重复实现。
已完成：CQ-04 稳定业务模块统一委托 `CWLUtils.t`。
已完成：S-05 全站添加 meta CSP，并新增 HTML 扫描回归测试。
已完成：P-09 粒子动画移除 `shadowBlur`，改用双层绘制模拟辉光。
已完成：UX-01 移动端导航增加点击外部关闭遮罩，并新增模板/CSS/HTML 扫描回归测试。
已完成：SEO-03 修复 sitemap priority，首页/文章/静态页输出合理优先级。
已完成：SEO-01 首页补充 WebSite JSON-LD，并新增结构化数据解析测试。
已完成：MR-EDITOR-03 移除 marked 废弃 highlight 选项，改为渲染后调用 `hljs.highlightElement()`。
已完成：MR-EDITOR-01/02 清理编辑器重复 escape/copy 记录，并将 HTML 复制委托 `CWLUtils.copyText`。
已完成：MR-EDITOR-05 编辑器导出补齐 shortTitle、summary、description 必填 front matter。
已完成：DE-01 新增 GitHub Actions CI 质量门禁，并补充只检查不改写的 `lint:check`。
已完成：SEO-02 为生成静态页和手写工具页补充页面级 JSON-LD 结构化数据。
已完成：SEO-05 支持文章 `modified` front matter，并用于 Article JSON-LD 的 `dateModified`。
已完成：DE-09 声明 Node.js engines，并通过 workflow 测试与 CI Node 版本对齐。
已完成：DE-02 为 `test:coverage` 增加 Node 原生覆盖率阈值，CI 可阻断明显覆盖率回退。
已完成：F-04 主题模式支持 auto/light/dark，无本地偏好时跟随系统主题。
已完成：RES-02 为 6 篇文章补充 cover 和 1200×630 社交封面，并接入 OG、JSON-LD 与 image sitemap。
已完成：DE-03 新增 Dependabot 周期更新检查，覆盖 npm devDependencies 与 GitHub Actions。
已完成：DE-10 新增结构化 CHANGELOG.md，并用 workflow 测试守住标题、日期和分类。
已完成：P-12 移动端关闭高成本 `backdrop-filter`，降低小屏 GPU 合成压力。
已完成：DE-08 新增独立文章 front matter 校验命令，并接入本地 validate 与 CI。
已完成：P-06 搜索资源空闲预热，降低首次打开搜索的冷启动等待。
已完成：B-05/MR-EDITOR-04 统一阅读时间计算，消除构建端、文章页和编辑器算法漂移风险。
已完成：MR-BUILD-05 页面脚本合并去重，避免模板误传造成重复加载。
已完成：B-07 单篇页已有 SSR 目录时跳过动态 TOC 构建，避免重复目录。
已完成：B-02 粒子热路径使用 swap-and-pop 删除，并新增源码守卫防止回退到 `splice()`。
已完成：UX-10 返回顶部按钮初始化后再显示，避免页面加载时短暂闪烁。
已完成：MR-BUILD-02 提取 RSS channel renderer，三种 feed 共用同一套 XML 外壳逻辑。
已完成：UX-05 订阅邮箱无效时增加输入框错误态和 `aria-invalid` 反馈。
已完成：UX-02 导航搜索按钮增加本地化快捷键 tooltip 与 aria 提示。
已完成：TD-08 移除全局 `scroll-behavior: smooth`，由 JS 按需控制平滑滚动。
已完成：UX-08 移动端文章分享条改为紧凑换行布局。
已完成：MR-BUILD-03 扩展 `tidyHtml()` 的 HTML 块保护范围，避免压缩块内空行。
已完成：UX-06 反馈列表增加确认后清空全部本地留言能力。
已完成：S-09 `validate:posts` 增加公开内容敏感标记扫描，防止内部笔记进入搜索索引。
已完成：MR-JS-04 `blog.js` 启动期文章项缓存只构建一次，消除重复 DOM 查询。
已完成：S-10 JWT 解码工具增加常驻签名未验证警示，防止安全决策误用。
已完成：MR-JS-05 `giscus.js` observer 清理改用 `pagehide`，避免 `unload` 影响 bfcache。
已完成：P-10 全站补齐第三方 resource hints，并新增已提交 HTML 扫描回归测试。
部分完成：P-11 Markdown 正文图片构建期补齐 `loading="lazy"` 与 `decoding="async"`，图片尺寸注入留作后续。
已完成：P-08 `coder.js` resize 阅读进度更新改用独立 200ms throttle，避免复用 scroll 节流状态。
已完成：UX-09 全站新增跳过导航链接和 `#main-content` 目标，并用 HTML/CSS 扫描测试防回退。

### 🥈 高价值中成本（建议近期规划）

| 编号 | 建议 | 来源 | 难度 |
|------|------|------|------|
| P-02 | CSS 关键路径提取 | 性能 | ⭐⭐ |
| P-03 | JS 文件合并 | 性能 | ⭐⭐ |
| P-04 | ~~Font Awesome 按需加载~~ ✅ 已优化 | 性能 | ~~⭐⭐~~ |
| CQ-06 | coder.js 拆分 | 代码质量 | ⭐⭐ |
| CQ-05 | assistant.js i18n | 代码质量 | ⭐⭐ |
| UX-03 | 图片 Lightbox | UX | ⭐⭐ |
| F-06 | 标签云可视化 | 功能 | ⭐ |
| COMP-02 | 构建时代码高亮 | 竞品借鉴 | ⭐⭐ |

### 🥉 低优先级（长期改进方向）

| 编号 | 建议 | 来源 | 难度 |
|------|------|------|------|
| AR-03 | ES Modules 迁移 | 架构 | ⭐⭐⭐ |
| F-07 | PWA 离线支持 | 功能 | ⭐⭐ |
| F-02 | AI 助手接入 LLM | 功能 | ⭐⭐⭐ |
| F-09 | 文章系列/专栏 | 功能 | ⭐⭐ |
| DE-07 | 开发文档 | 工程化 | ⭐⭐ |
| TD-09 | TypeScript / JSDoc 类型 | 技术债务 | ⭐⭐⭐ |

---

## 📁 文档目录结构

```
docs/
└── suggestions/
    ├── README.md                           ← 本文件（索引总览）
    ├── health-score.md                     ← 项目健康度评分报告
    ├── work-report.md                      ← 工作报告
    ├── bugs-and-risks.md                   ← 潜在 Bug 与崩溃风险
    ├── security-audit.md                   ← 安全漏洞与防护建议
    ├── performance-bottlenecks.md          ← 性能瓶颈与优化建议
    ├── code-quality.md                     ← 代码质量分析
    ├── architecture-review.md              ← 架构设计评审
    ├── tech-debt.md                        ← 技术债务清单
    ├── new-features.md                     ← 新功能建议
    ├── ux-improvements.md                  ← 用户体验优化
    ├── devex-improvements.md               ← 开发体验优化
    ├── competitive-analysis.md             ← 同类项目对比
    └── module-reviews/
        ├── build-system.md                 ← 构建系统模块分析
        ├── client-javascript.md            ← 客户端 JS 模块分析
        ├── editor.md                       ← Markdown 编辑器模块分析
        ├── overleaf.md                     ← Overleaf 简历编辑器模块分析
        ├── css-analysis.md                 ← CSS 样式系统分析
        ├── seo-analysis.md                 ← SEO 与可访问性专项分析
        ├── resource-analysis.md            ← 资源与内容深度分析
        ├── html-pages.md                   ← 手写 HTML 页面一致性分析
        └── tools-gesture-and-api.md        ← 工具箱手势与 API 测试器复查
```

---

## 📝 分析方法说明

### 分析范围
- **源码文件**：28 个 JS 文件（~10000 行，其中 assistant.js 1585 行为最大，含本地 vendor）、11 个构建模块（~1900 行）、1 个 CSS 文件（5801 行）、6 篇 Markdown 文章
- **配置文件**：package.json、.eslintrc.json、.gitignore
- **测试文件**：23 个测试文件（518 个测试用例，100% 通过）

### 分析方法
1. 逐文件阅读全部源码
2. 运行测试套件验证当前状态（518/518 通过）
3. 运行 ESLint 检查（0 错误）
4. 交叉引用模块间依赖关系
5. 对比行业最佳实践和同类项目

### 分析原则
- **不修改任何现有代码文件**
- **不修改任何配置文件**
- **只输出分析报告和建议文档**
- 每条建议包含：位置、现状、影响、方案、收益
