# 🔍 模块深度分析：工具箱手势与 API 测试器

> 分析日期：2026-07-03 | 分析范围：`src/templates/tools.mjs`、`js/tools.js`、`js/tools-core.js`、`js/gesture.js`、`js/gesture-premium.js`

---

## 模块概况

工具箱已经从“轻量开发小工具集合”扩展成 31 个工具面板，其中手势交互和 Mini API Tester 是风险与复杂度最高的两个子模块：

| 子模块 | 关键文件 | 特征 |
|--------|----------|------|
| API Tester | `src/templates/tools.mjs`, `js/tools.js` | 可发送任意 HTTP(S) 请求、填充中转站配置、保存本地历史 |
| Gesture | `src/templates/tools.mjs`, `js/tools.js`, `js/gesture.js`, `js/gesture-premium.js` | 摄像头、MediaPipe、face-api、Three.js、WASM、canvas 动画 |

---

## 📌 MR-TOOLS-01 [已修复核心治理]: 手势工具的供应链和隐私边界需要产品化治理

- **📍 位置**：`js/gesture.js:160-167`, `js/gesture.js:213-216`, `js/gesture.js:258-265`, `src/templates/tools.mjs:865-868`
- **✅ 修复状态**：手势面板新增“第三方视觉运行时和模型会从 CDN 下载”的显式确认，未勾选时开始按钮禁用；文案同时说明摄像头流只在本机浏览器识别。运行时增加 `starting` 状态，启动过程中不会重复申请模型和摄像头。
- **🧪 回归测试**：`tests/templates.test.mjs`、`tests/tools.test.mjs` 覆盖确认控件、按钮状态和未确认不申请摄像头。
- **📝 当前状况描述**：手势工具运行时依赖 CDN 和 Google Storage 模型资源；UI 声明“所有数据均在浏览器本地处理”，但没有解释外部脚本/模型来源。摄像头类功能的用户信任门槛更高，文案和实现边界应该比普通工具更明确。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```text
  1. 自托管模型和第三方 runtime。
  2. 在开启摄像头前展示“本地处理 + 外部模型来源 + 不上传帧”的简短说明。
  3. 为模型文件记录版本、hash 和更新时间。
  ```
- **📊 实际收益**：提升摄像头功能可信度，减少 CDN 供应链和隐私承诺之间的落差；自托管模型、hash 清单和 CSP 精收敛仍可作为后续增强。
- **🔗 相关建议引用**：[S-13](../security-audit.md#s-13-已修复核心治理-手势工具运行时加载-cdn-机器视觉脚本和模型缺少完整供应链约束), [UX-11](../ux-improvements.md#ux-11-已修复核心问题-手势与-api-工具的隐私边界文案需要更精确)

---

## 📌 MR-TOOLS-02 [已修复核心竞态]: 按需 runtime 加载没有等待脚本执行完成

- **📍 位置**：`js/tools.js:83-116`, `js/tools.js:521-523`, `js/gesture.js:2339-2341`
- **✅ 修复状态**：`loadScript()` 已等待脚本 `load/error`，并复用同源脚本 Promise；Gesture runtime 按 `gesture-premium.js` → `gesture.js` 顺序加载。
- **🧪 验证**：`node --test tests/tools.test.mjs` 35/35 通过。
- **📝 原状况描述**：`loadScript()` append `<script>` 后立即 resolve，导致工具面板可能在脚本尚未下载/执行时进入可交互状态。手势按钮的事件绑定位于 `gesture.js` 末尾，弱网下容易出现短暂“点了没反应”。
- **⚠️ 影响程度**：中
- **💡 后续建议**：
  ```javascript
  showRuntimeStatus(toolId, "loading");
  showRuntimeStatus(toolId, "failed");
  ```
- **📊 实际收益**：核心加载竞态已消除；UI 仍可继续明确呈现“加载中/加载失败/可使用”状态。
- **🔗 相关建议引用**：[B-14](../bugs-and-risks.md#b-14-工具箱按需脚本加载-promise-过早-resolve手势页存在初始化竞态)

---

## 📌 MR-TOOLS-03 [已修复核心风险]: API Tester 历史保存未区分普通请求和敏感请求

- **📍 位置**：`src/templates/tools.mjs:147-167`, `js/tools.js:461-529`, `js/tools.js:584-643`
- **✅ 修复状态**：API Tester 保存历史前会脱敏敏感 Header，请求体默认不保存；显式勾选“保存请求体”后才持久化 body。发送请求仍使用原始输入，历史记录使用安全副本。
- **🧪 回归测试**：`tests/tools.test.mjs` 和 Playwright `/tools/` 抽查均覆盖该行为。
- **📝 原状况描述**：API Tester 保存历史时持久化完整 header/body；发送成功还会自动保存。对中转站、OpenAI/Anthropic 兼容接口等场景来说，Authorization 与 x-api-key 是高概率输入。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  const SENSITIVE_HEADERS = ["authorization", "cookie", "x-api-key"];
  // 保存历史前默认 redaction；body 默认不保存，除非用户显式选择。
  ```
- **📊 预期收益**：减少本地敏感信息残留，让 API Tester 更适合真实调试。
- **🔗 相关建议引用**：[S-12](../security-audit.md#s-12-mini-api-tester-会把-authorization-头和请求体持久化到-localstorage), [F-11](../new-features.md#f-11-为-api-tester-增加隐私模式和敏感信息脱敏保存)

---

## 📌 MR-TOOLS-04: 视觉交互脚本已成为代码质量热点

- **📍 位置**：`js/galaxy.js:136-690`, `js/gesture.js:427-1907`, `js/gesture-premium.js:1-639`
- **📝 当前状况描述**：`npm run lint:check` 的 77 个 warning 集中在 `galaxy.js` 与 `gesture.js`；`gesture-premium.js` 还通过文件头禁用了 `no-var`。这类视觉交互脚本通常修改频率高、回归难肉眼覆盖，warning 长期存在会降低 lint 信噪比。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```text
  - 先机械替换 var -> let/const。
  - 为 gesture runtime loader、start/stop camera、tab 切换释放摄像头补充源码/DOM 测试。
  - 再考虑把 gesture.js 按 camera、model-loader、modes、renderers 拆分。
  ```
- **📊 预期收益**：降低维护复杂度，为后续重构和功能扩展留出空间。
- **🔗 相关建议引用**：[CQ-11](../code-quality.md#cq-11-eslint-当前仍有-77-个-warning集中在视觉交互大文件), [TD-11](../tech-debt.md#td-11-eslint-8-迁移前应先清零当前-warning-债务)

---

## 📌 MR-TOOLS-05: 工具箱主模板已经过大，新增工具会继续推高生成页体积

- **📍 位置**：`src/templates/tools.mjs:1-982`, `tools/index.html:1-1247`
- **📝 当前状况描述**：`src/templates/tools.mjs` 约 71KB，生成后的 `tools/index.html` 约 105KB，所有工具面板一次性 SSR 到页面中。当前功能完整，但继续增加工具会让模板文件、HTML 体积和 i18n 文案一起膨胀。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```text
  tools/
  ├── panels/json.mjs
  ├── panels/api.mjs
  ├── panels/gesture.mjs
  └── render-tools-page.mjs
  ```
  先按工具类别拆模板文件；下一步再考虑只 SSR 首屏分类，其余 panel 用 `<template>` 延迟挂载。
- **📊 预期收益**：降低模板维护成本，并为未来按需加载工具面板奠定结构基础。
- **🔗 相关建议引用**：[P-13](../performance-bottlenecks.md#p-13-关键静态产物体积已经接近当前性能预算), [AR-04](../architecture-review.md#ar-04)
