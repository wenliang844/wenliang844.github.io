# 视觉交互脚本深度分析

> 分析时间：2026-07-03 第五轮 | 范围：`js/gesture.js`, `js/galaxy.js`, `js/tools.js`, `src/templates/tools.mjs`

## 验证背景

当前工作树已通过 `npm run lint:check`、`npm test` / 生产验证内部测试 779/779、`npm run test:coverage`、`npm run test:http-smoke`、`npm run test:browser-smoke`、`npm run validate:production`、`npm audit --registry=https://registry.npmjs.org --audit-level=moderate` 和 `git diff --check`。以下建议不修改源码，只记录视觉交互脚本中仍值得治理的边界。

## 📌 MR-VIS-01 [已修复]: 手势摄像头启动缺少 `starting` 门闩，快速重复点击可能并发申请摄像头

- **📍 位置**：`js/gesture.js:487-516`, `js/gesture.js:2344-2345`
- **✅ 修复状态**：`startCamera()` 已增加 `starting` 状态；模型加载、3D 引擎加载、摄像头授权和视频播放期间开始按钮保持禁用，`running || starting` 时重复触发会直接返回。
- **🧪 回归测试**：`tests/tools.test.mjs` 覆盖手势启动前确认门槛和按钮状态，避免未确认时进入摄像头申请路径。
- **📝 当前状况描述**：`startCamera()` 只有在模型加载、`getUserMedia()` 和 `$video.play()` 成功之后才禁用开始按钮并设置 `running = true`。在模型加载或浏览器授权弹窗期间，用户可以重复点击“开启摄像头”，从而并发触发多次模型加载、摄像头授权和 `requestAnimationFrame(loop)`。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  let starting = false;

  async function startCamera() {
    if (starting || running) return;
    starting = true;
    $start.disabled = true;
    try {
      await ensureModelsForMode(mode);
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      running = true;
      gestureRafId = requestAnimationFrame(loop);
    } finally {
      starting = false;
      $start.disabled = running;
    }
  }
  ```
  同时新增测试：连续触发两次 start click，断言 `getUserMedia` 只调用一次。
- **📊 实际收益**：避免重复摄像头授权、重复检测循环和用户在弱网模型加载期间的误操作。
- **🔗 相关建议引用**：[MR-TOOLS-04](tools-gesture-and-api.md#mr-tools-04-视觉交互脚本已成为代码质量热点), [DE-14](../devex-improvements.md#de-14-增加页面级-dom-契约审计防止-seo-a11y-回退)

## 📌 MR-VIS-02: 页面隐藏时手势工具仍保持摄像头流占用

- **📍 位置**：`js/gesture.js:519-539`, `js/gesture.js:565-590`, `js/gesture.js:2444-2450`
- **📝 当前状况描述**：`visibilitychange` 中的注释写着“pause detection but keep stream alive”，实际没有暂停或释放动作。`loop()` 在 `document.hidden` 时跳过检测，但仍继续安排下一帧；摄像头 track 也继续保持打开。对摄像头工具来说，后台标签页继续占用摄像头会增加隐私感知风险和电量消耗。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && running) {
      stopCamera();
      setStatus("ready", "页面已隐藏，摄像头已关闭");
    }
  });
  ```
  如果产品希望恢复时自动继续，应保存 `wasRunningBeforeHidden`，但恢复前仍建议让用户重新确认摄像头。
- **📊 预期收益**：降低后台摄像头占用和用户信任风险，也减少隐藏标签页的 rAF/视频资源消耗。
- **🔗 相关建议引用**：[S-13](../security-audit.md#s-13-已修复核心治理-手势工具运行时加载-cdn-机器视觉脚本和模型缺少完整供应链约束), [UX-11](../ux-improvements.md#ux-11-已修复核心问题-手势与-api-工具的隐私边界文案需要更精确)

## 📌 MR-VIS-03: Galaxy canvas 没有遵守 `prefers-reduced-motion`

- **📍 位置**：`js/galaxy.js:655-667`, `js/galaxy.js:756-773`, `css/coder.css:6598-6610`
- **📝 当前状况描述**：CSS 已有 `prefers-reduced-motion: reduce`，但只覆盖部分 CSS 动画和 reveal 过渡。Galaxy 的星河 canvas 在面板可见时仍会 `start()` 并持续 rAF；页面从后台恢复时也会自动 `start()`。对选择减少动态效果的用户，canvas 粒子、星云和流星仍会持续运动。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function shouldAnimate() {
    return !reduceMotion.matches && (!$panel || !$panel.hidden);
  }

  if (shouldAnimate()) start();
  reduceMotion.addEventListener("change", function () {
    if (reduceMotion.matches) stop();
    else start();
  });
  ```
  reduced-motion 下可绘制一帧静态星图，并显示“动画已按系统偏好暂停”的状态。
- **📊 预期收益**：让高动态视觉工具符合用户系统偏好，减少眩晕和注意力负担。
- **🔗 相关建议引用**：[UX-09](../ux-improvements.md#ux-09), [MR-CSS-07](css-analysis.md#mr-css-07-复查发现-css-单包已增长到-6637-行)

## 📌 MR-VIS-04 [已修复核心竞态]: 工具 runtime 加载竞态仍存在于当前源码

- **📍 位置**：`js/tools.js:83-116`, `js/gesture.js:2344-2345`, `js/galaxy.js:772-773`
- **✅ 修复状态**：`loadScript()` 已等待 `load/error` 并缓存脚本 Promise；`loadToolRuntime()` 不再在 append 后立即标记完成，多脚本 runtime 按顺序加载。
- **🧪 验证**：`node --test tests/tools.test.mjs` 35/35 通过，覆盖 Galaxy runtime 和 Gesture runtime 顺序注入。
- **📝 原状况描述**：`loadScript()` 仍在 append `<script>` 后立即 `Promise.resolve()`，`loadToolRuntime()` 也把 runtime 标记为已加载。弱网下用户切到 Galaxy 或 Gesture 面板后，面板可能已经可交互，但 runtime 脚本还没有执行到事件绑定或 auto-start 逻辑。
- **⚠️ 影响程度**：中
- **💡 后续建议**：
  ```javascript
  showRuntimeStatus(toolId, "loading");
  showRuntimeStatus(toolId, "failed");
  ```
  工具切换时根据 Promise 状态展示加载中、失败重试或可交互。
- **📊 实际收益**：消除视觉工具弱网启动时的主要加载竞态，并给后续按需加载更多工具打基础。
- **🔗 相关建议引用**：[B-14](../bugs-and-risks.md#b-14-工具箱按需脚本加载-promise-过早-resolve手势页存在初始化竞态), [MR-TOOLS-02](tools-gesture-and-api.md#mr-tools-02-按需-runtime-加载没有等待脚本执行完成)
