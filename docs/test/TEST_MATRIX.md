# 测试用例矩阵（深度测试版）

> 生成日期：2026-06-18

## 按模块统计

| 模块 | 测试文件 | 用例数 | 通过 | 失败 | 覆盖维度 |
|------|---------|-------|------|------|---------|
| 构建系统 | build.test.mjs | 2 | 2 | 0 | 功能、安全 |
| 构建扩展 | build-extended.test.mjs | 24 | 24 | 0 | 边界、验证 |
| 构建深度 | build-deep.test.mjs | 30 | 30 | 0 | 极端边界 |
| 模板渲染 | templates.test.mjs | 5 | 5 | 0 | XSS、SEO、双语 |
| 模板扩展 | templates-extended.test.mjs | 22 | 22 | 0 | 结构、i18n、安全 |
| 安全基础 | security.test.mjs | 4 | 4 | 0 | XSS、输入净化 |
| 安全扩展 | security-extended.test.mjs | 11 | 11 | 0 | innerHTML、eval、CSP |
| 格式化 | format.test.mjs | 15 | 15 | 0 | 日期、转义 |
| 链接完整性 | links.test.mjs | 5 | 5 | 0 | 内部链接、脚本顺序 |
| i18n 可访问性 | i18n-a11y.test.mjs | 13 | 13 | 0 | ARIA、i18n、a11y |
| i18n 深度 | i18n-deep.test.mjs | 12 | 12 | 0 | 双向切换、DOM/属性/事件 |
| JS 行为 | js-behavior.test.mjs | 24 | 24 | 0 | 前端模块行为 |
| CSS | css.test.mjs | 25 | 25 | 0 | 选择器、暗色模式 |
| 性能 | performance.test.mjs | 12 | 12 | 0 | 文件大小、资源 |
| 集成 | integration.test.mjs | 6 | 6 | 0 | 构建全流程 |
| 工具箱 | tools.test.mjs | 4 | 4 | 0 | 算法、UI |
| AI 助手 | assistant.test.mjs | 13 | 13 | 0 | 交互、i18n、模式切换 |
| 订阅 | subscribe.test.mjs | 2 | 2 | 0 | 模态框 |
| 工具函数 | utils.test.mjs | 6组 | 6组 | 0 | 逻辑验证 |
| coder.js 深度 | coder.test.mjs | 13 | 13 | 0 | 主题/TOC/滚动/技能条 |
| editor.js 深度 | editor.test.mjs | 16 | 16 | 0 | 编辑/格式化/预览/状态 |
| overleaf.js 深度 | overleaf.test.mjs | 11 | 11 | 0 | 多格式简历/切换/同步 |
| error-handler 深度 | error-handler.test.mjs | 11 | 11 | 0 | 日志/toast/安全DOM |
| feedback 深度 | feedback.test.mjs | 11 | 11 | 0 | 提交/存储/删除/安全 |
| blog.js 深度 | blog.test.mjs | 14 | 14 | 0 | 搜索/标签/J-K/FAB |
| **合计** | **25 个文件** | **374** | **374** | **0** | |

## 按测试类型统计

| 测试类型 | 用例数 | 占比 |
|---------|-------|------|
| 单元测试 | 178 | 47.6% |
| 集成测试 | 62 | 16.6% |
| 静态分析 | 52 | 13.9% |
| 安全测试 | 15 | 4.0% |
| 性能测试 | 12 | 3.2% |
| 可访问性测试 | 7 | 1.9% |
| 深度行为测试 | 48 | 12.8% |
| **合计** | **374** | **100%** |

## 深度测试新增覆盖模块

| 源码模块 | 测试文件 | 新增用例 | 测试重点 |
|---------|---------|---------|---------|
| js/coder.js | coder.test.mjs | 13 | 主题切换、TOC 构建/切换、进度条、复制按钮、面板切换、技能条动画 |
| js/editor.js | editor.test.mjs | 16 | 格式化工具栏（粗/斜/代码/标题/引用/列表/链接/图片/代码块/表格）、预览、状态管理 |
| js/overleaf.js | overleaf.test.mjs | 11 | LaTeX/Markdown/moderncv/HTML 四格式解析渲染、预览同步、XSS 防护 |
| js/error-handler.js | error-handler.test.mjs | 11 | 错误日志记录/maxLogs/getLogs/clearLogs、toast 创建/替换/关闭 |
| js/i18n.js | i18n-deep.test.mjs | 12 | textContent/aria/placeholder/innerHTML/lang-block/head 切换、事件分发 |
| js/blog.js | blog.test.mjs | 14 | 搜索过滤、标签过滤/URL同步、J/K 导航、侧边栏 FAB、键盘可访问性 |
| js/feedback.js | feedback.test.mjs | 11 | 表单提交、匿名提交、删除、多条目、时间格式、安全渲染 |
| scripts/build.mjs | build-deep.test.mjs | 30 | normalizeDate 全月份边界、validateSlug 全特殊字符、readingMinutes 精确边界 |
