# CSP 与第三方资源边界专题分析

生成时间：2026-07-03  
分析范围：公共布局模板、CSP 生成逻辑、Giscus 评论、工具箱远程视觉运行时、资源提示与安全测试。  
本轮验证：`node --test tests/security-extended.test.mjs tests/templates.test.mjs tests/giscus-behavior.test.mjs tests/tools.test.mjs tests/performance.test.mjs`，88/88 通过。  
约束说明：本轮仅新增 `/docs/suggestions/module-reviews/csp-resource-policy-review.md`，未修改源码、配置或测试。

## 总览

当前项目的安全基线已经明显强于普通静态站：所有已提交 HTML 都带 CSP，外部脚本标签被限制，脚本默认 `defer`，工具箱远程视觉运行时有显式确认开关，Giscus 也限制了 `postMessage` 目标源。剩余问题不是“当前功能坏了”，而是 CSP 仍按全站最大能力配置：工具箱需要的 CDN/WASM 能力扩散到普通页面，meta CSP 无法提供完整 header 能力，`unsafe-inline` 仍被内联 HTML/样式使用牵制。

严重程度分布：

- 高：0
- 中：5
- 低：1

## 建议清单

### 1. `cdn.jsdelivr.net` 与 `wasm-unsafe-eval` 被放入全站 `script-src`

- 📌 问题/建议标题：按页面能力拆分 `script-src`，避免工具页权限扩散到普通页
- 📍 位置：`src/templates/layout.mjs:43-50`、`src/templates/tools.mjs:1035-1065`、`tests/security-extended.test.mjs:203-224`、`index.html:6-6`、`tools/index.html:6-6`
- 📝 当前状况描述：公共 CSP 固定包含 `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://giscus.app https://cdn.jsdelivr.net`。实际需要 jsDelivr、动态 `import()` 和 WASM 的主要是工具箱里的手势/视觉功能；普通首页、文章页、赞助页也继承了同样的脚本权限。测试目前要求所有 HTML 都包含这条共享指令，因此会把这种全站最大权限固化下来。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
const BASE_CSP = {
  scriptSrc: ["'self'", "https://giscus.app"],
  connectSrc: ["'self'", "https:"],
};

const TOOL_CSP = {
  ...BASE_CSP,
  scriptSrc: [...BASE_CSP.scriptSrc, "'wasm-unsafe-eval'", "https://cdn.jsdelivr.net"],
  connectSrc: ["'self'", "https:", "http:"],
};

renderPage({
  csp: page === "tools" ? TOOL_CSP : BASE_CSP,
});
```

配套测试应改为断言普通页面不包含 `https://cdn.jsdelivr.net` 和 `wasm-unsafe-eval`，工具页才允许。

- 📊 预期收益：缩小普通页面在 XSS 或供应链异常后的可执行资源面，同时保留工具页的视觉运行时能力。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md` 中的第三方脚本风险、`docs/suggestions/module-reviews/tools-core-runtime-safety.md` 的工具页连接边界。

### 2. 仅使用 meta CSP，无法覆盖 `frame-ancestors`、报告与灰度策略

- 📌 问题/建议标题：将 CSP 从页面 meta 逐步迁移到响应头
- 📍 位置：`src/templates/layout.mjs:232-232`、`tests/security-extended.test.mjs:203-231`、`docs/suggestions/security-audit.md:212-219`
- 📝 当前状况描述：模板通过 `<meta http-equiv="Content-Security-Policy">` 输出策略。meta CSP 对静态托管友好，但无法提供完整的响应头能力，例如 `frame-ancestors` 不能通过 meta 生效，`Content-Security-Policy-Report-Only`、`report-to`/`report-uri` 等观测能力也无法作为真实响应头灰度运行。现有文档已经注明这一点，但测试仍只检查 meta 存在。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```txt
Content-Security-Policy:
  default-src 'self';
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  report-to csp-endpoint;

Content-Security-Policy-Report-Only:
  script-src 'self' https://giscus.app;
```

GitHub Pages 原生不方便设置响应头，可评估 Cloudflare Pages、反向代理或边缘函数；短期保留 meta CSP，长期让构建产物同时生成 `_headers` 或等价部署清单。

- 📊 预期收益：获得点击劫持防护、策略灰度、违规上报和更完整的浏览器安全能力。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md#s-05-已修复-缺少-content-security-policy-csp-头`、`docs/suggestions/full-browser-audit-2026-07-03.md`。

### 3. `unsafe-inline` 仍被内联 JSON-LD、HTML 图标和样式属性牵制

- 📌 问题/建议标题：建立移除 `unsafe-inline` 的分阶段清单
- 📍 位置：`src/templates/layout.mjs:45-46`、`src/templates/layout.mjs:217-218`、`src/templates/tools.mjs:894-897`、`src/templates/sponsor.mjs:53-54`
- 📝 当前状况描述：所有外部脚本标签已经通过模板统一 `defer`，且测试禁止 inline event handler，这是好基础。但 CSP 仍保留 `script-src 'unsafe-inline'` 和 `style-src 'unsafe-inline'`。当前内联 JSON-LD、工具箱主题色点的 `style`、赞助进度条 `style="width: 72%"`、以及大量 `data-i18n-html` 图标 HTML 让策略难以收紧。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```html
<!-- 进度条从 style 属性迁移到 CSS 变量或数据属性 -->
<div class="sponsor-progress" style="--progress: 72%">
  <span></span>
</div>
```

```css
.sponsor-progress span {
  width: var(--progress, 0%);
}
```

```js
// 后续再对 JSON-LD 使用 hash/nonce 或保持在非执行脚本并配套测试
const scriptSrc = ["'self'", "https://giscus.app", "'sha256-<jsonld-hash>'"];
```

建议先清理内联样式，再评估 JSON-LD 和受控 HTML 片段的 nonce/hash 策略。

- 📊 预期收益：逐步降低 CSP 对内联执行/样式的依赖，让策略对 XSS 更有实际拦截能力。
- 🔗 相关建议引用：`docs/suggestions/full-browser-audit-2026-07-03.md` 的 Lighthouse CSP 提醒、`docs/suggestions/module-reviews/product-info-pages-and-rankings.md` 的赞助进度建议。

### 4. 动态第三方脚本缺少完整性或来源清单

- 📌 问题/建议标题：为 Giscus 与视觉运行时建立远程依赖清单和校验策略
- 📍 位置：`js/giscus.js:78-92`、`tests/giscus-behavior.test.mjs:127-140`、`js/gesture.js:160-176`、`js/gesture.js:216-228`、`js/gesture.js:260-268`
- 📝 当前状况描述：Giscus 动态脚本设置了 `crossOrigin="anonymous"`，但没有 `integrity`；测试只断言 `src`、配置属性和语言。手势工具通过动态 `import()` 加载 MediaPipe/Three.js，并动态插入 face-api 脚本，这些远程依赖已有版本号，但没有集中清单、hash、许可证和升级记录。动态 `import()` 的 SRI 支持有限，因此更需要清晰的来源治理或自托管策略。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```json
{
  "remoteRuntime": {
    "giscus": {
      "url": "https://giscus.app/client.js",
      "policy": "trusted-upstream",
      "crossorigin": "anonymous"
    },
    "mediapipeTasksVision": {
      "url": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs",
      "version": "0.10.18",
      "selfHostCandidate": true
    }
  }
}
```

对可 SRI 的普通脚本先补 `integrity`；对 ESM/WASM/模型文件优先考虑自托管或构建期下载并校验 hash。

- 📊 预期收益：让第三方运行时升级、回滚和安全响应更可控，也方便向用户解释远程依赖来源。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md#mr-asset-01本地-vendor-文件缺少可审计的来源版本和哈希清单`、`docs/suggestions/security-audit.md#s-06-第三方脚本缺少-subresource-integrity-sri-校验`。

### 5. `img-src 'self' data: https:` 过宽，图片来源缺少页面级白名单

- 📌 问题/建议标题：为图片来源生成可审计的 CSP 白名单
- 📍 位置：`src/templates/layout.mjs:47-47`、`scripts/build.mjs:75-88`、`scripts/build.mjs:291-318`、`tests/security-extended.test.mjs:203-224`
- 📝 当前状况描述：图片策略允许任意 HTTPS 图片和 `data:`。这对文章外链图片、二维码生成、Giscus 或未来远程图片很省事，但也降低了 CSP 对像素追踪、错误外链和意外第三方图片的约束力。构建脚本已经会处理文章图片和缺省 `loading/decoding`，但没有把文章中出现的外部图片域名汇总成 CSP 或报告。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```js
function imageSourcesFor(posts) {
  const origins = new Set(["'self'", "data:"]);
  for (const post of posts) {
    for (const src of extractImageSrcs(post.content)) {
      if (/^https:\/\//.test(src)) origins.add(new URL(src).origin);
    }
  }
  return `img-src ${[...origins].join(" ")}`;
}
```

短期可以继续保留 `https:`，但输出构建报告列出实际外部图片域名；长期改为页面级或站点级白名单。

- 📊 预期收益：降低外部图片跟踪和不可控资源加载面，同时保留内容作者使用外部图片的可审计路径。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/content-publishing-quality-gates.md`、`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`。

### 6. `data-i18n-html` 是受控 HTML sink，但没有 Trusted Types/净化边界

- 📌 问题/建议标题：为多语言 HTML 片段建立白名单渲染器
- 📍 位置：`js/i18n.js:17-25`、`js/i18n.js:805-827`、`tests/security-extended.test.mjs:19-32`、`tests/i18n-deep.test.mjs:92-108`
- 📝 当前状况描述：`i18n.js` 明确支持 `data-i18n-html` 并用 `innerHTML` 替换含图标的文案。当前来源是仓库内受控字典和模板属性，风险可控；但安全测试只禁止反馈、错误处理和助手中的 `innerHTML`，不会约束 i18n HTML 片段的标签/属性范围。如果未来翻译词条外部化或由 CMS 生成，这里会成为需要明确治理的 HTML sink。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```js
const ALLOWED_I18N_HTML = new Set(["I", "BR", "CODE", "SPAN"]);

function applySafeHtml(el, html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const node of template.content.querySelectorAll("*")) {
    if (!ALLOWED_I18N_HTML.has(node.tagName)) {
      throw new Error(`disallowed i18n tag: ${node.tagName}`);
    }
    for (const attr of [...node.attributes]) {
      if (!/^aria-|^class$/.test(attr.name)) node.removeAttribute(attr.name);
    }
  }
  el.replaceChildren(template.content);
}
```

如果后续迁移到 HTTP header CSP，可再评估 `require-trusted-types-for 'script'` 和 Trusted Types policy。

- 📊 预期收益：保持图标型翻译能力，同时让 HTML sink 有明确边界，避免未来内容来源变化时扩大 XSS 面。
- 🔗 相关建议引用：`docs/suggestions/security-audit.md`、`docs/suggestions/module-reviews/i18n-and-accessibility.md`。

## 后续优先级

1. 优先把 `script-src` 拆为普通页和工具页两套策略，普通页移除 `cdn.jsdelivr.net` 与 `wasm-unsafe-eval`。
2. 评估部署层是否能输出 HTTP CSP header，并保留 meta CSP 作为过渡。
3. 为动态远程运行时维护 manifest，先记录版本、来源、用途和升级责任人。
4. 清理内联样式，减少 `style-src 'unsafe-inline'` 的必要性。
5. 将 `data-i18n-html` 改为受限 HTML 渲染器，并补白名单测试。

