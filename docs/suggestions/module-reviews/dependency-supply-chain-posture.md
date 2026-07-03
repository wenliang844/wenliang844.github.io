# 依赖与供应链姿态专题分析

生成时间：2026-07-03
分析范围：`package.json`、`package-lock.json`、CI audit、Dependabot、`js/vendor/` 自托管脚本、第三方运行时资源与供应链文档。
本轮验证：

- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 个漏洞。
- `js/vendor/` 当前 5 个文件，合计约 223KB：Fuse、highlight.js、marked、DOMPurify、QRCode。
- `package-lock.json` 中 145 个 `resolved` tarball 指向 `registry.npmmirror.com`。
- 约束说明：本轮仅新增 `/docs/suggestions/module-reviews/dependency-supply-chain-posture.md`，未修改源码、配置或测试。

## 总览

项目依赖面相对克制：生产运行主要是静态资源，自托管 vendor 文件数量少，npm 依赖集中在构建、测试、lint 和 Markdown/YAML 处理。本轮 `npm audit` 结果干净，这是一个好信号。但供应链治理不只看漏洞数量，还包括依赖来源一致性、vendor 文件来源与 hash、远程运行时资源清单、许可证和升级计划。当前最值得关注的是：锁文件 tarball 全部来自镜像域名，而 CI audit 使用 npmjs；自托管 vendor 文件没有统一 manifest；ESLint 8 已在 lockfile 中标记不再支持；工具箱视觉功能仍依赖远程 CDN/模型链路。

严重程度分布：

- 高：0
- 中：4
- 低：2

## 本轮观测数据

| 项目 | 结果 |
| --- | --- |
| `npm audit` | 0 vulnerabilities |
| lockfile resolved registry | `registry.npmmirror.com` 145 条 |
| CI audit registry | `https://registry.npmjs.org` |
| vendor 文件 | `fuse.min.js`、`highlight.min.js`、`marked.min.js`、`purify.min.js`、`qrcode.min.js` |
| vendor SHA256 摘要前缀 | Fuse `45E63F251EDE6CC9...`，highlight `837A6FA5B0C736B5...`，marked `15FABCE5B65898B3...`，DOMPurify `C0845096A7C4A674...`，QRCode `D8CE08E279110668...` |

## 建议清单

### 1. 锁文件 tarball 来源与 CI 审计 registry 不一致

- 📌 问题/建议标题：明确 npm registry 来源策略，避免 audit 与 install 口径分裂
- 📍 位置：`package-lock.json:22-23`、`package-lock.json:36-37`、`package-lock.json:646-650`、`.github/workflows/ci.yml:51-51`
- 📝 当前状况描述：`package-lock.json` 中 145 个 `resolved` URL 指向 `registry.npmmirror.com`，并带有 integrity；CI 中 `npm audit` 使用 `--registry=https://registry.npmjs.org`。这意味着安装来源和漏洞审计来源不是同一个 registry。integrity 可以校验包内容，但从供应链审计视角看，仍需要明确“以 npmjs 为 canonical，镜像仅加速”，还是“锁定镜像作为可复现来源”。否则排查依赖问题时可能出现 npmjs 显示可用、镜像 tarball 缺失或镜像元数据滞后的情况。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```ini
# .npmrc 方案 A：统一使用 npmjs，CI 与本地一致
registry=https://registry.npmjs.org/
```

或保留镜像，但显式记录策略：

```md
## Dependency registry policy

- Canonical audit registry: npmjs
- Install acceleration: npmmirror
- Lockfile integrity: required
- When refreshing lockfile: use `npm install --package-lock-only --registry=...`
```

同时可在 CI 中增加一次 `npm ci --registry=https://registry.npmjs.org` 的可选 nightly 验证，确认 lockfile 不依赖单一镜像域名。

- 📊 预期收益：降低依赖安装、漏洞审计和复现环境之间的口径差异，便于供应链问题排查。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/ci-release-automation-review.md`、`docs/suggestions/security-audit.md#s-06-第三方脚本缺少-subresource-integrity-sri-校验`。

### 2. 自托管 vendor 文件缺少统一来源、版本、hash 和许可证清单

- 📌 问题/建议标题：为 `js/vendor/` 建立 vendor manifest
- 📍 位置：`js/vendor/fuse.min.js:1-2`、`js/vendor/purify.min.js:1-3`、`js/vendor/highlight.min.js:184-191`、`tests/performance.test.mjs:208-216`
- 📝 当前状况描述：`js/vendor/` 中的文件体积可控，也比运行时拉 CDN 更稳定。但仓库没有集中说明这些文件来自哪个 npm 包或 release、下载 URL、许可证、SHA256、是否需要 sourcemap、何时升级。部分文件能从头部识别版本，例如 Fuse.js v7.0.0、DOMPurify 3.1.6；但 highlight、marked、qrcode 的版本和来源不便从仓库清单中审计。DOMPurify 还保留 `sourceMappingURL=purify.min.js.map`，但 `js/vendor/` 下没有 `.map` 文件。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```json
{
  "js/vendor/fuse.min.js": {
    "name": "fuse.js",
    "version": "7.0.0",
    "source": "https://www.npmjs.com/package/fuse.js",
    "license": "Apache-2.0",
    "sha256": "45E63F251EDE6CC9..."
  },
  "js/vendor/purify.min.js": {
    "name": "dompurify",
    "version": "3.1.6",
    "license": "Apache-2.0 OR MPL-2.0",
    "sha256": "C0845096A7C4A674...",
    "sourceMap": "omitted"
  }
}
```

测试层可读取 manifest，校验文件存在和 hash 前缀/完整 hash 匹配。

- 📊 预期收益：让自托管脚本从“复制进仓库的黑盒文件”变成可审计资产，后续升级和安全响应更稳。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`、`docs/suggestions/module-reviews/csp-resource-policy-review.md`。

### 3. ESLint 8 已不再受支持，需要迁移计划

- 📌 问题/建议标题：规划 ESLint 9 flat config 迁移
- 📍 位置：`package.json:19-20`、`package.json:30-30`、`package-lock.json:646-650`、`.github/dependabot.yml:1-40`
- 📝 当前状况描述：`package.json` 使用 `eslint: ^8.57.0`；lockfile 中 `node_modules/eslint` 已标记 `deprecated: This version is no longer supported`。项目已经有 Dependabot，每周会检查 npm 依赖，但 ESLint 8 到 9 涉及 flat config 和规则兼容，通常不能只依赖自动升级。当前 lint 脚本还包含 `lint` 自动修复和 `lint:check` 检查两种路径，迁移时需要避免格式化或规则变化引入大规模源码 churn。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```text
ESLint 9 迁移节奏：
1. 新增 eslint.config.js，与现有规则等价。
2. 保留 lint:check，先不扩大规则范围。
3. 在临时分支上运行 eslint --print-config js/tools.js 对比关键规则。
4. 只在迁移提交中更新 lint 配置和 lockfile，不混入业务改动。
```

如短期不迁移，也应在技术债中标注支持窗口和触发条件。

- 📊 预期收益：避免 lint 工具链突然失去支持后被迫大改，降低未来依赖升级风险。
- 🔗 相关建议引用：`docs/suggestions/tech-debt.md#td-11-eslint-当前仍有-77-个-warning集中在视觉交互大文件`、`docs/suggestions/devex-improvements.md`。

### 4. 远程视觉运行时仍需要集中资产清单和自托管路线

- 📌 问题/建议标题：把 MediaPipe/Three/face-api/WASM/模型纳入第三方资产清单
- 📍 位置：`docs/suggestions/module-reviews/csp-resource-policy-review.md:20-45`、`docs/suggestions/module-reviews/csp-resource-policy-review.md:109-134`、`docs/suggestions/security-audit.md:58-70`、`js/gesture.js:160-268`
- 📝 当前状况描述：手势/视觉工具会从 jsDelivr、Google storage 等来源加载视觉任务、WASM、模型和 3D 运行时。已有 CSP/安全文档指出这一点，也建议自托管或 hash 清单。本轮从供应链角度再次确认：npm audit 无法覆盖这些运行时远程资源，因为它们不在 package-lock 中，也不一定有 SRI。它们需要独立资产治理，尤其是摄像头相关功能具备更高信任要求。
- ⚠️ 影响程度：中
- 💡 建议方案（含伪代码或示例片段）：

```json
{
  "remoteAssets": [
    {
      "id": "mediapipe-vision",
      "url": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs",
      "type": "esm",
      "owner": "tools/gesture",
      "selfHostTarget": "/js/vendor/mediapipe/vision_bundle.mjs",
      "integrity": "sha384-..."
    }
  ]
}
```

优先级建议：先清单化，再 hash 校验，再评估自托管模型和 WASM。

- 📊 预期收益：把浏览器运行时供应链纳入与 npm 依赖同等级的治理，减少第三方资源变更导致的功能和信任风险。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/tools-gesture-and-api.md`、`docs/suggestions/security-audit.md#s-13-已修复核心治理-手势工具运行时加载-cdn-机器视觉脚本和模型缺少完整供应链约束`。

### 5. 当前 audit 只覆盖漏洞，缺少许可证和 SBOM 输出

- 📌 问题/建议标题：补充许可证清单与 SBOM 产物
- 📍 位置：`package.json:12-24`、`.github/workflows/ci.yml:27-51`、`package-lock.json:10-14`
- 📝 当前状况描述：CI 已运行 `npm audit --audit-level=moderate`，Dependabot 也会跟进依赖更新，这是安全底线。但 audit 不回答许可证、传递依赖清单、供应链可追溯和发布证据问题。对于静态站点来说这不是立即风险，但当 vendor 文件、远程模型和 npm devDependencies 混用时，缺少 SBOM 会让后续排查依赖来源更慢。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```bash
npm sbom --json > docs/sbom/npm-sbom.json
```

如果不希望提交机器生成的大文件，可在 CI 中上传 artifact：

```yaml
- name: Generate SBOM
  run: npm sbom --json > npm-sbom.json

- uses: actions/upload-artifact@v5
  with:
    name: npm-sbom
    path: npm-sbom.json
```

许可证可先从 `package-lock.json` 和 vendor manifest 中人工记录主依赖许可证。

- 📊 预期收益：提升依赖可追溯性，为后续安全审计、开源合规和事故响应提供基础资料。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/ci-release-automation-review.md`、`docs/suggestions/module-reviews/suggestions-knowledge-base-governance.md`。

### 6. Vendor sourcemap 策略需要明确，避免隐式 404 和审计困惑

- 📌 问题/建议标题：明确 minified vendor 是否保留 sourcemap 注释
- 📍 位置：`js/vendor/purify.min.js:3-3`、`js/vendor/:1-5`、`tests/performance.test.mjs:208-216`
- 📝 当前状况描述：`purify.min.js` 保留了 `//# sourceMappingURL=purify.min.js.map`，但 `js/vendor/` 下没有 `.map` 文件。普通用户不会因此受影响，浏览器也通常只有打开 DevTools 时才尝试加载 sourcemap；但这会让调试时出现 404，也让 vendor 文件看起来像“不完整复制”。其他 vendor 文件是否保留 sourcemap 注释没有统一策略。
- ⚠️ 影响程度：低
- 💡 建议方案（含伪代码或示例片段）：

```text
Vendor sourcemap policy:
- production vendor: remove sourceMappingURL comments unless .map is committed.
- debug vendor: commit .map files and list them in vendor manifest.
- tests: fail when sourceMappingURL points to a missing local file.
```

如果保留 `.map`，同样需要记录 hash 和来源；如果删除注释，应在 vendor manifest 中写明 `sourceMap: "omitted"`。

- 📊 预期收益：减少调试噪音，提升 vendor 资产完整性和可审计性。
- 🔗 相关建议引用：`docs/suggestions/module-reviews/static-assets-and-third-party-resources.md`、`docs/suggestions/module-reviews/browser-visual-smoke-testing.md`。

## 建议落地顺序

1. 决定 npm registry 策略，并记录在依赖治理文档中。
2. 为 `js/vendor/` 建立版本、来源、许可证、SHA256 manifest。
3. 将远程视觉运行时加入同一份第三方资产清单。
4. 明确 vendor sourcemap 策略，补 map 或移除无效注释。
5. 制定 ESLint 9 迁移计划，避免被动升级。
6. 在 CI 中按需生成 SBOM artifact，先不强制提交大文件。
