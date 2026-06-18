# 🔍 资源与内容深度分析

> 分析日期：2026-06-18

---

## 1. 项目资源清单

### JS 文件统计

| 类别 | 文件数 | 总大小 | 说明 |
|------|--------|--------|------|
| 核心 JS | 7 | ~35KB | 每页必加载 |
| 页面特有 JS | 14 | ~45KB | 按页面加载 |
| Vendor JS | 5 | ~222KB | 懒加载 |
| **总计** | **26** | **~302KB** | 未压缩 |

### Vendor 依赖详情

| 文件 | 大小 | 加载方式 | 使用页面 |
|------|------|----------|----------|
| `highlight.min.js` | 121KB | 懒加载 | 编辑器页 |
| `marked.min.js` | 35KB | 懒加载 | 编辑器页 |
| `fuse.min.js` | 24KB | 懒加载 | 全站搜索 |
| `qrcode.min.js` | 20KB | 按需加载 | 文章页分享 |
| `purify.min.js` | 21KB | 懒加载 | 编辑器页 |

### CSS 和字体

| 文件 | 大小 | 说明 |
|------|------|------|
| `coder.css` | 95KB | 主样式文件 |
| `fontawesome-all.min.css` | 3.2KB | Font Awesome 子集（已优化！） |
| `fa-brands-400.subset.woff2` | 544B | 品牌图标子集 |
| `fa-solid-900.subset.woff2` | 3.2KB | 实心图标子集 |

> ✅ **重要发现**：Font Awesome 已经是子集版本！`fontawesome-all.min.css` 仅 3.2KB，字体文件总计仅 3.7KB。之前 [P-04](performance-bottlenecks.md#p-04) 的建议可以降级为"无需优化"。

---

## 📌 RES-01: `highlight.min.js`（121KB）仅编辑器页面使用，但占用 vendor 目录空间

- **📍 位置**：`js/vendor/highlight.min.js`
- **📝 当前状况**：highlight.js 是 vendor 目录中最大的文件（121KB），但只在编辑器页面使用。它通过 `highlight-loader.js` 懒加载，不影响其他页面性能。
- **⚠️ 影响程度**：低（已正确懒加载）
- **💡 建议方案**：
  1. 当前方案可接受（懒加载，不影响首屏）
  2. 如果需要减小体积，可以只打包使用的语言（Java、JavaScript、Python、TypeScript、SQL、Bash），从 121KB 降至约 30KB
  3. 或迁移到 Shiki（构建时高亮，零客户端 JS）

- **📊 预期收益**：编辑器页加载速度提升

---

## 📌 RES-02 [已修复]: 所有文章无图片，image sitemap 和 JSON-LD image 字段为空

- **📍 位置**：`src/posts/*.md`（718 行总计）
- **✅ 修复状态**：6 篇文章均新增 `cover` front matter，并生成 1200×630 PNG 社交封面图，保存于 `images/posts/`。
- **✅ 构建支持**：`scripts/build.mjs` 新增 `normalizeCover()`，将 cover 排入 `post.images` 首位；单篇页 OG/Twitter image、Article JSON-LD `image` 和 sitemap `image:image` 均使用文章专属封面。
- **🧪 回归测试**：`tests/build-deep.test.mjs` 覆盖 cover 路径校验；`tests/templates.test.mjs` 覆盖单篇页 OG/Twitter image；`tests/build-extra.test.mjs` 覆盖 sitemap image 输出。
- **📊 实际收益**：社交平台分享时显示文章专属图片，不再全部使用 favicon 兜底。
- **🔗 相关建议**：[F-08](../new-features.md#f-08)

---

## 📌 RES-03: 文章内容质量分析

- **📍 位置**：`src/posts/*.md`
- **📝 当前状况**：6 篇文章平均约 120 行，内容结构良好：

  | 文章 | 行数 | 标签 | 特点 |
  |------|------|------|------|
  | manage-system | 113 | Java, Spring Boot, 视频分析 | 项目复盘 |
  | finance-saas-backend | 114 | ElasticSearch, RocketMQ | SaaS 后端 |
  | lowcode-schema-codegen | 114 | TypeScript, React, Web Worker | 低代码平台 |
  | activiti-workflow-engine | 114 | Activiti, BPMN 2.0 | 工作流引擎 |
  | rule-engine-alerts | 113 | 规则引擎, 告警 | 规则系统 |
  | codex-claude-vibe-coding | 150 | AI, Codex, Claude | AI 协作开发 |

  所有文章都有完整的 front-matter（title、titleEn、shortTitle、summary、description 及英文版）。
- **⚠️ 影响程度**：无（正面评价）
- **💡 建议方案**：
  1. 文章长度适中（100-150 行），但可以考虑添加代码示例和架构图
  2. 考虑添加"系列"标记（如"后端复盘系列"、"AI 协作系列"）
  3. 每篇文章可以添加"相关工具"链接（指向工具箱页面）

- **📊 预期收益**：文章内容更丰富，读者参与度提升

---

## 📌 RES-04: 项目总大小 48MB，node_modules 占大头

- **📍 位置**：项目根目录
- **📝 当前状况**：项目总大小 48MB，其中：
  - `node_modules/`：~45MB（devDependencies）
  - 源码 + 产物：~3MB
  - `.git/`：~5MB（估算）

  生产部署的实际文件（GitHub Pages）约 1.5MB。
- **⚠️ 影响程度**：无（node_modules 不部署）
- **💡 建议方案**：确保 `.gitignore` 正确排除 `node_modules/`（已确认 ✅）。

---

## 📌 RES-05: HTML 页面共 19 个（含生成页），结构一致

- **📍 位置**：全站
- **📝 当前状况**：
  - 手写页面：13 个（index, 404, about, ai, appreciation, categories, contact, editor, overleaf, post, sponsor, tags, tools）
  - 生成页面：6 个（post/<slug>/index.html）

  所有页面都遵循相同的 HTML 结构：`<head>` → `<header class="navigation">` → `<main>` → `<footer>`。
- **⚠️ 影响程度**：无（正面评价）
- **💡 建议方案**：无需修改。手写页面和生成页面的结构一致性是优秀实践。

---

## 更新后的 P-04 建议降级

> **注意**：经过深入分析，Font Awesome 已经是子集版本（CSS 3.2KB + 字体 3.7KB），之前的 [P-04](../performance-bottlenecks.md#p-04) 建议（Font Awesome 全量加载）需要修正。当前 Font Awesome 配置已经是优化过的状态。建议降级为"无需优化"。
