# 运行时观测性与错误韧性专题分析

> 分析时间：2026-07-04 02:05 +08:00  
> 分析范围：`js/error-handler.js`, `js/logger.js`, `js/performance-monitor.js`, `src/templates/layout.mjs`, `tests/error-handler*.mjs`, `tests/logger-behavior.test.mjs`, `tests/performance*.mjs`, `tests/utils*.mjs`  
> 验证命令：`node --test tests/error-handler.test.mjs tests/error-handler-deep.test.mjs tests/logger-behavior.test.mjs tests/performance-behavior.test.mjs tests/performance.test.mjs tests/utils.test.mjs tests/utils-deep.test.mjs`，110/110 通过

## 本轮结论

横切运行时脚本的测试覆盖较完整：错误 Toast 使用安全 DOM API，错误日志有数量上限，logger 默认禁用，performance monitor 已使用 Navigation Timing v2 而不是旧 `performance.timing`。剩余优化点集中在观测性语义：全局错误被 `preventDefault()` 后只进入内存日志，普通用户和维护者都不一定看得到；错误日志包含 stack 与 userAgent 且挂在全局对象上；Promise rejection 的非 Error 信息会丢失；Toast CSS 运行时注入不利于 CSP 收紧；性能监控仍使用 FID，缺少 INP 与 buffered observer 策略。

---

## 📌 MR-OBS-01: 全局错误被阻止默认上报后缺少可见诊断出口

- **📍 位置**：`js/error-handler.js:116-134`, `tests/error-handler.test.mjs:190-205`, `tests/error-handler-deep.test.mjs:1-220`
- **📝 当前状况描述**：`window.onerror` 和 `unhandledrejection` 都会调用 `ErrorHandler.log()`，随后 `event.preventDefault()`。但除了 vendor 脚本资源加载失败外，普通运行时错误不会展示 Toast，也不会发送到任何诊断端点；`debug` 默认 false，控制台也没有输出。结果是用户页面可能已经出现功能异常，浏览器默认错误提示和控制台默认未处理 rejection 又被抑制，维护者只能在当前页面会话里手动读取 `window.CWLErrorHandler.getLogs()`。
- **⚠️ 影响程度**：中
- **💡 建议方案**：区分“用户可恢复错误”和“开发诊断错误”。普通未捕获错误可以不弹打扰性 Toast，但至少保留可选控制台输出或页面隐藏诊断入口；生产采样上报必须接入隐私同意和脱敏。
  ```javascript
  function handleGlobalError(error, context) {
    const entry = ErrorHandler.log(error, context);
    if (ErrorHandler.debug || shouldExposeDiagnostics()) {
      console.error("[CWL]", entry.context, entry.message);
    }
    if (isCritical(entry)) {
      ErrorHandler.showUserMessage(t("error.critical", "部分功能异常，请刷新后重试。"));
    }
  }
  ```
- **📊 预期收益**：降低“错误被记录但没人看见”的概率，让真实线上故障更容易被用户理解和维护者定位。
- **🔗 相关建议引用**：[TD-06](../tech-debt.md#td-06-performance-monitorjs-和-loggerjs-未被任何页面引用), [user-data-entrypoints.md](user-data-entrypoints.md) 中关于日志上传隐私网关的建议。

---

## 📌 MR-OBS-02: 全局错误日志包含 stack 和 userAgent，缺少脱敏与导出边界

- **📍 位置**：`js/error-handler.js:21-40`, `tests/error-handler.test.mjs:39-54`, `tests/error-handler-deep.test.mjs:197-214`
- **📝 当前状况描述**：`ErrorHandler.log()` 会记录 `message`、`stack` 和 `navigator.userAgent`，并通过 `window.CWLErrorHandler.getLogs()` 暴露给同页面脚本。当前日志只保存在内存且最多 50 条，风险有限；但 stack 可能包含 URL、文件路径、查询参数或用户输入片段，userAgent 也属于可识别设备信息。未来如果与 `CWLLogger` 或远端诊断结合，缺少字段 allowlist 会放大隐私风险。
- **⚠️ 影响程度**：低到中
- **💡 建议方案**：在记录阶段先规范化和脱敏，默认不保存完整 stack；需要导出诊断包时由用户显式触发，并展示将包含哪些字段。
  ```javascript
  function sanitizeError(error) {
    return {
      message: String(error.message || error).slice(0, 500),
      stack: sanitizeStack(error.stack).slice(0, 2000),
      userAgentFamily: parseBrowserFamily(navigator.userAgent),
    };
  }
  ```
- **📊 预期收益**：保留排障价值，同时避免错误日志在未来上传、复制或第三方脚本读取时携带过多环境信息。
- **🔗 相关建议引用**：[S-08](../security-audit.md#s-08-localstorage-中存储反馈数据无加密), [user-data-entrypoints.md](user-data-entrypoints.md) 中关于 `CWLLogger` 字段白名单的建议。

---

## 📌 MR-OBS-03: Promise rejection 的非 Error reason 会被压成不可读信息

- **📍 位置**：`js/error-handler.js:128-134`, `tests/error-handler.test.mjs:218-229`, `tests/error-handler-deep.test.mjs:216-228`
- **📝 当前状况描述**：`unhandledrejection` 中使用 `new Error(event.reason || "Promise rejected")`。当 `reason` 是对象、Response、DOMException 或包含 `code` 的业务错误时，`Error` message 可能变成 `[object Object]` 或丢失原始字段；而 `log()` 本身已经能处理简单对象的 `message` 字段。当前测试覆盖了 `handler.log({ message: "simple error" })`，但没有覆盖真实 `unhandledrejection` 的对象 reason。
- **⚠️ 影响程度**：低
- **💡 建议方案**：新增 `normalizeErrorReason()`，优先保留 `name`、`message`、`code`、`status`，无法识别时安全 JSON 摘要化。
  ```javascript
  function normalizeErrorReason(reason) {
    if (reason instanceof Error) return reason;
    if (reason && typeof reason === "object") {
      const message = reason.message || reason.statusText || JSON.stringify(reason).slice(0, 500);
      const error = new Error(message);
      error.name = reason.name || "UnhandledRejection";
      return error;
    }
    return new Error(String(reason || "Promise rejected"));
  }
  ```
- **📊 预期收益**：让异步失败日志更接近真实原因，减少排查网络、存储、解析错误时的上下文丢失。
- **🔗 相关建议引用**：[UX-12](../ux-improvements.md#ux-12), [assistant-deep-dive.md](assistant-deep-dive.md) 中关于网络错误可诊断性的建议。

---

## 📌 MR-OBS-04: 错误 Toast 样式运行时注入，且文本未接入 i18n/减少动态效果

- **📍 位置**：`js/error-handler.js:49-96`, `js/error-handler.js:151-226`, `tests/error-handler.test.mjs:113-188`
- **📝 当前状况描述**：`showUserMessage()` 使用 `createElement` 和 `textContent` 渲染，XSS 边界是好的。但 Toast CSS 通过 JS 创建 `<style>` 注入到每个页面，关闭按钮 `aria-label="关闭"`、默认资源错误提示“部分功能加载失败，页面功能可能受限。”也没有接入 i18n。动画 `slideInRight` 未检查 `prefers-reduced-motion`。如果后续收紧 CSP，运行时 style 注入也会成为额外例外。
- **⚠️ 影响程度**：低
- **💡 建议方案**：把 `.global-error-toast` 样式迁入 `css/coder.css`，文案通过 `window.cwlT` 或 `CWLUtils.t()` 获取，并为动画添加减少动态效果分支。
  ```css
  @media (prefers-reduced-motion: reduce) {
    .global-error-toast {
      animation: none;
    }
  }
  ```
- **📊 预期收益**：降低 CSP 与运行时样式注入耦合，提升英文模式和动效敏感用户的错误提示体验。
- **🔗 相关建议引用**：[i18n-and-accessibility.md](i18n-and-accessibility.md), [security-audit.md](../security-audit.md) 中关于 CSP 和 `innerHTML` 边界的建议。

---

## 📌 MR-OBS-05: 性能监控仍使用 FID，缺少 INP 与 buffered observer 策略

- **📍 位置**：`js/performance-monitor.js:18-35`, `js/performance-monitor.js:116-180`, `tests/performance-behavior.test.mjs:57-76`, `tests/performance-behavior.test.mjs:178-271`
- **📝 当前状况描述**：`performance-monitor.js` 默认禁用且当前未被页面引用，这点已有技术债记录。若未来启用，它会观察 `largest-contentful-paint`、`first-input` 和 `layout-shift`。其中 FID 已被 INP 取代为 Core Web Vitals 交互指标；同时 observer 没有使用 `{ buffered: true }`，如果监控在页面加载后才开启，可能错过早期 LCP/CLS/资源条目。
- **⚠️ 影响程度**：低到中
- **💡 建议方案**：将 FID 升级为 INP，LCP/CLS/resource observer 使用 buffered 选项，并考虑直接复用 web-vitals 小型库或把指标采集放到 Playwright/Lighthouse CI，而不是默认发到浏览器端全局对象。
  ```javascript
  observer.observe({ type: "largest-contentful-paint", buffered: true });
  eventObserver.observe({ type: "event", buffered: true, durationThreshold: 40 });
  ```
- **📊 预期收益**：让未来性能监控与当前 Web Vitals 标准对齐，避免启用后采集到过时或不完整的指标。
- **🔗 相关建议引用**：[B-09](../bugs-and-risks.md#b-09-已修复-performance-monitorjs-使用已废弃的-performancetiming-api), [TD-06](../tech-debt.md#td-06-performance-monitorjs-和-loggerjs-未被任何页面引用)

---

## 📌 MR-OBS-06: Logger 和 PerformanceMonitor 需要统一启用策略，而不是单点手动打开

- **📍 位置**：`js/logger.js:8-18`, `js/logger.js:56-90`, `js/performance-monitor.js:18-35`, `src/templates/layout.mjs:52-55`
- **📝 当前状况描述**：`logger.js` 与 `performance-monitor.js` 都是独立全局对象，默认禁用或未被核心脚本引用；`error-handler.js` 则作为核心脚本在所有模板页加载。未来如果单独把 logger 或 performance monitor 打开，容易出现三个系统各自采集、各自存储、各自处理失败的碎片化状态。
- **⚠️ 影响程度**：低
- **💡 建议方案**：抽象一个 `observabilityConfig`，统一控制采样率、隐私同意、endpoint allowlist、字段脱敏和 flush 失败回退。错误、日志、性能指标都从同一配置读取。
  ```javascript
  const Observability = {
    enabled: hasConsent() && isAllowedEndpoint(endpoint),
    sampleRate: 0.05,
    redact: sanitizeTelemetryPayload,
  };
  ```
- **📊 预期收益**：避免未来“临时打开一个监控脚本”造成隐私、采样和失败处理不一致，也让测试可以围绕统一契约写。
- **🔗 相关建议引用**：[user-data-entrypoints.md](user-data-entrypoints.md), [MR-HTML-05](html-pages.md#mr-html-05-highlight-loaderjs-和-loggerjs-是死代码)

## 建议优先级

| 优先级 | 建议 |
|--------|------|
| P1 | MR-OBS-01 错误捕获后的可见诊断出口 |
| P2 | MR-OBS-02 日志脱敏边界；MR-OBS-05 INP/buffered 性能指标升级 |
| P3 | MR-OBS-03 rejection reason 规范化；MR-OBS-04 Toast CSS/i18n；MR-OBS-06 统一观测性启用策略 |
