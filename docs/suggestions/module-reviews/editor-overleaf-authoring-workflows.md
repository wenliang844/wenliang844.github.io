# 编辑器与 Overleaf 创作工作流分析

本轮聚焦 `/editor/` Markdown 编辑器与 `/overleaf/` 简历编辑器。两者都属于用户长时间输入内容、依赖本地保存与导出的工具型页面，主路径测试稳定，但仍存在内容丢失提示、导出前质量门禁、格式转换可逆性和高频解析性能等边界。

## 验证记录

- 测试命令：`node --test tests/editor.test.mjs tests/overleaf.test.mjs tests/templates.test.mjs tests/templates-extended.test.mjs tests/format.test.mjs`
- 结果：97/97 通过
- 范围：Markdown 编辑器加载、格式工具、预览净化、front matter 导出、Overleaf 多格式解析/渲染、预览同步、模板重置、模板输出与转义 helper

## 建议清单

### 1. Markdown 编辑器自动保存失败时没有用户可见反馈

- 📌 问题/建议标题：为编辑器 localStorage 写入失败增加状态提示和导出提醒
- 📍 位置：`js/editor.js:160-165`、`js/editor.js:185-202`、`js/editor.js:358-374`
- 📝 当前状况描述：`render()` 会在预览更新后调用 `saveState()`，而 `saveState()` 捕获 `localStorage.setItem()` 异常后静默忽略。长文、图片 data URL、隐私模式或浏览器存储配额不足时，用户仍会看到预览正常更新，但刷新页面后内容可能无法恢复。当前页面没有保存状态指示，也没有在导出/离开前提示“本地保存失败”。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：让 `saveState()` 返回布尔值，并在页面状态区或编辑器标题栏展示保存结果；保存失败时建议用户立即导出 Markdown。

```js
let lastSaveOk = true;

function saveState() {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(currentState()));
    lastSaveOk = true;
    setEditorStatus(t("editor.save.ok", "已自动保存"));
    return true;
  } catch (error) {
    lastSaveOk = false;
    setEditorStatus(t("editor.save.fail", "自动保存失败，请先导出文件。"));
    return false;
  }
}
```

- 📊 预期收益：降低长文编辑时的隐性数据丢失风险，让用户能在刷新或关闭前采取补救动作。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/tools-core-runtime-safety.md`、`docs/suggestions/module-reviews/user-data-entrypoints.md`

### 2. 新建、示例和恢复模板动作会立即覆盖当前内容

- 📌 问题/建议标题：破坏性编辑动作应增加确认或撤销缓冲
- 📍 位置：`js/editor.js:388-413`、`js/overleaf.js:876-882`、`js/overleaf.js:943-950`
- 📝 当前状况描述：Markdown 编辑器的“新建”“示例”和 Overleaf 的“恢复模板”都会直接替换当前输入，并立即触发保存。用户如果误点按钮，当前草稿或简历源码会被覆盖到本地存储中；虽然浏览器撤销栈可能在部分输入框内可用，但跨字段替换和模板重置没有统一撤销入口。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：对会覆盖大量内容的操作使用确认弹窗或临时撤销 toast；保存覆盖前保留一次快照。

```js
let lastSnapshot = null;

function snapshotEditor() {
  lastSnapshot = currentState();
}

function restoreSnapshot() {
  if (!lastSnapshot) return;
  applyState(lastSnapshot);
  render();
}

if (action === "new") {
  snapshotEditor();
  if (!window.confirm(t("editor.confirm.new", "当前内容会被清空，是否继续？"))) {
    return;
  }
  clearEditor();
}
```

- 📊 预期收益：减少误点造成的草稿丢失，增强长时间创作工具的容错感。
- 🔗 相关建议引用：`docs/suggestions/ux-improvements.md`、`docs/suggestions/module-reviews/core-reading-interactions.md`

### 3. Markdown 导出缺少与发布构建一致的前置校验

- 📌 问题/建议标题：导出前复用 `validate:posts` 规则的轻量前端校验
- 📍 位置：`js/editor.js:129-145`、`js/editor.js:419-424`、`scripts/validate-posts.mjs`
- 📝 当前状况描述：编辑器导出 front matter 已包含 `title`、`shortTitle`、`date`、`summary`、`description` 和 `draft`，这是很好的改进。但导出前没有校验 slug 格式、日期是否为空、摘要长度、正文是否为空、标签/封面等发布侧约束。用户可能下载出“看起来完整”的 Markdown，放入 `src/posts/` 后才在构建或内容校验阶段失败。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：在前端维护一份与 `validate-posts.mjs` 对齐的轻量 schema，或从共享 JSON schema 生成校验逻辑；导出按钮在有错误时显示清单。

```js
function validateDraft(state) {
  const errors = [];
  if (!/^[a-z0-9-]+$/.test(slugify(state.slug || state.title))) {
    errors.push(t("editor.err.slug", "别名只能包含小写字母、数字和短横线。"));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(state.date)) {
    errors.push(t("editor.err.date", "日期不能为空。"));
  }
  if (!state.markdown.trim()) {
    errors.push(t("editor.err.body", "正文不能为空。"));
  }
  return errors;
}
```

- 📊 预期收益：把发布失败提前到导出前，减少“下载后才发现不能构建”的返工。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/content-publishing-quality-gates.md`、`docs/suggestions/devex-improvements.md`

### 4. Overleaf 源码输入每次按键都会完整解析、渲染和写入存储

- 📌 问题/建议标题：为简历源码输入增加 debounce、脏状态和显式编译边界
- 📍 位置：`js/overleaf.js:801-808`、`js/overleaf.js:737-743`、`js/overleaf.js:908-909`
- 📝 当前状况描述：`source.addEventListener("input", syncFromSource)` 会在每次输入时解析当前格式、重绘预览、写入 localStorage 并更新状态。默认模板不大时体验可接受，但用户粘贴长简历、复杂 HTML 或大量项目经历时，高频解析和同步存储可能造成输入卡顿；同时“重新编译”按钮的语义被弱化，因为实际每次输入都已经编译。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：使用 `CWLUtils.debounce()` 延迟编译，保存草稿文本可独立节流；编译按钮负责立即刷新。

```js
const debouncedCompile = window.CWLUtils && window.CWLUtils.debounce
  ? window.CWLUtils.debounce(syncFromSource, 250)
  : syncFromSource;

source.addEventListener("input", function () {
  markDirty();
  saveRawSourceThrottled();
  debouncedCompile();
});

compileButton.addEventListener("click", syncFromSource);
```

- 📊 预期收益：提升大简历和低性能设备上的输入流畅度，让“重新编译”成为清晰的手动刷新入口。
- 🔗 相关建议引用：`docs/suggestions/performance-bottlenecks.md`、`docs/suggestions/module-reviews/runtime-observability-and-error-resilience.md`

### 5. Overleaf 解析失败会回退到旧模型，但格式切换仍会继续覆盖视图

- 📌 问题/建议标题：格式转换失败时应阻断切换并展示可恢复错误
- 📍 位置：`js/overleaf.js:728-734`、`js/overleaf.js:866-873`
- 📝 当前状况描述：`parseSource()` 捕获异常后设置状态文案并返回 `currentModel` 或默认模板。`switchFormat()` 随后仍会切换格式并用回退模型渲染新源码。这样在用户源码存在解析问题时，界面可能悄悄从“用户真实源码”转换成“上一次可解析模型”或默认模板，造成认知落差。当前测试覆盖了空源码 fallback，但没有覆盖解析失败时是否阻止格式切换。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：让解析函数返回 `{ ok, model, error }`，格式切换时遇到失败直接停留在当前格式，并提示用户下载原始源码或查看错误位置。

```js
function parseSourceResult(value) {
  try {
    return { ok: true, model: formats[currentFormat].parse(value) };
  } catch (error) {
    return { ok: false, error: error };
  }
}

function switchFormat(nextFormat) {
  const parsed = parseSourceResult(source.value);
  if (!parsed.ok) {
    setStatus(t("overleaf.status.parsefail.blocked", "当前源码无法转换，请先修正或导出备份。"));
    return;
  }
  currentModel = parsed.model;
  currentFormat = nextFormat;
  source.value = renderSource(currentModel);
}
```

- 📊 预期收益：防止格式切换时把不可解析源码“正常化”为旧内容或默认模板，保护用户真实输入。
- 🔗 相关建议引用：`docs/suggestions/bugs-and-risks.md`、`docs/suggestions/module-reviews/overleaf.md`

### 6. LaTeX 和 moderncv 解析器仍难处理嵌套或转义花括号

- 📌 问题/建议标题：为简历格式解析增加 token 化解析或明确限制
- 📍 位置：`js/overleaf.js:313-329`、`js/overleaf.js:358-386`、`js/overleaf.js:524-563`
- 📝 当前状况描述：`readCommand()` 已经比旧版本更稳，能按括号深度读取普通命令。但 section 和 entry 解析仍大量依赖正则，如 `\\entry{...}{...}{...}{...}` 和 `\\cventry{...}{...}{...}{...}{...}{...}`。如果用户在条目描述中写入被转义的 `{}`、复杂 `\href{}`、LaTeX 命令或嵌套结构，正则组仍可能提前截断或错位，导致预览和跨格式转换丢字段。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：为 LaTeX 条目实现小型 token reader，按命令名读取固定数量参数；若不计划支持复杂 LaTeX，应在 UI 中明确标注“仅支持模板语法子集”。

```js
function readCommandArgs(sourceText, commandName, count) {
  const args = [];
  let index = sourceText.indexOf("\\" + commandName);
  if (index < 0) return args;
  index += commandName.length + 1;
  while (args.length < count) {
    const result = readBalancedBrace(sourceText, index);
    if (!result) break;
    args.push(result.value);
    index = result.end;
  }
  return args;
}
```

- 📊 预期收益：减少复杂简历内容在格式转换中的字段错位和内容丢失；也让支持范围更容易测试。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/overleaf.md`、`docs/suggestions/code-quality.md`

### 7. Overleaf 复制源码没有复用统一剪贴板 fallback

- 📌 问题/建议标题：`copySource()` 应委托 `CWLUtils.copyText()` 并保留失败详情
- 📍 位置：`js/overleaf.js:846-859`、`js/editor.js:376-386`
- 📝 当前状况描述：Markdown 编辑器的 HTML 复制已委托 `CWLUtils.copyText()`，能复用 Clipboard API 与 textarea fallback；Overleaf 的 `copySource()` 则只调用 `navigator.clipboard.writeText()`，不可用时直接显示失败。非安全上下文、老浏览器或权限受限环境下，两个编辑器的复制表现不一致。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：与 `editor.js` 对齐，统一使用公共复制 helper，并在失败时给出可恢复提示。

```js
function copySource(button) {
  const copy = window.CWLUtils && window.CWLUtils.copyText
    ? window.CWLUtils.copyText
    : function () { return Promise.reject(new Error("copy unavailable")); };
  copy(source.value).then(function () {
    done(true);
  }, function (error) {
    done(false);
    if (window.CWLLogger) {
      window.CWLLogger.warn("Overleaf copy failed", { message: error.message });
    }
  });
}
```

- 📊 预期收益：统一站内复制体验，减少剪贴板兼容分支重复维护。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/core-reading-interactions.md`、`docs/suggestions/module-reviews/client-javascript.md`

## 优先级建议

1. 优先补自动保存失败反馈、破坏性动作确认和格式转换失败阻断，这三项直接关系到用户内容安全。
2. 随后处理 Overleaf 高频解析与 LaTeX 参数解析器，提升大内容性能和转换可信度。
3. 最后统一 Overleaf 复制 fallback 与编辑器导出校验，让两个创作工具的工程质量保持一致。

