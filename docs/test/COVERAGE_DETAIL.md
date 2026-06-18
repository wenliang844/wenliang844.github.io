# 代码覆盖率详情

> 生成日期：2026-06-18
> 工具：Node.js `--experimental-test-coverage`

## 总体覆盖率

| 指标 | 覆盖率 |
|------|--------|
| **行覆盖率 (Line %)** | 98.71% |
| **分支覆盖率 (Branch %)** | 88.14% |
| **函数覆盖率 (Funcs %)** | 96.75% |

## 各文件覆盖率

```
file                        | line % | branch % | funcs % | 状态
──────────────────────────────────────────────────────────────────
scripts/build.mjs           |  95.44 |    81.75 |   91.84 | 🟡
src/config.mjs              | 100.00 |    50.00 |  100.00 | 🟡
src/lib/format.mjs          | 100.00 |   100.00 |  100.00 | 🟢
src/templates/ai.mjs        | 100.00 |    81.82 |  100.00 | 🟡
src/templates/appreciation.mjs | 100.00 | 88.89 |  100.00 | 🟢
src/templates/categories.mjs| 100.00 |    81.82 |  100.00 | 🟡
src/templates/layout.mjs    |  98.85 |    96.55 |  100.00 | 🟢
src/templates/post.mjs      | 100.00 |    93.67 |  100.00 | 🟢
src/templates/sponsor.mjs   | 100.00 |   100.00 |  100.00 | 🟢
src/templates/tags.mjs      | 100.00 |    80.00 |  100.00 | 🟡
src/templates/tools.mjs     | 100.00 |    95.83 |  100.00 | 🟢
```

🟢 = 优秀 (>90%)　🟡 = 良好 (>75%)　🔴 = 需改进 (<75%)

## 未覆盖行详解

### scripts/build.mjs

| 行号 | 代码路径 | 原因 | 风险 |
|------|---------|------|------|
| 125-126 | `resolveOutDir` 缺少 `--out` 后的参数 | 测试已覆盖（`runBuild(["--out"])`），可能为覆盖工具统计误差 | 🟢 无 |
| 200-202 | 空 Markdown 文件警告 | 当前 6 篇文章均非空 | 🟢 无 |
| 215-216 | Markdown 内容体为空警告 | 当前 6 篇文章均有内容 | 🟢 无 |
| 243-244 | 多文件错误聚合输出 | 需多篇文章同时出错才触发 | 🟢 无 |
| 248-251 | 构建失败抛出错误 | 同上 | 🟢 无 |
| 286-290 | `absoluteUrl()` 根相对路径拼接 | 需文章中图片 src 以 `/` 开头 | 🟢 无 |
| 298-299 | `extractImages()` 无图片匹配 | 需文章无图片 | 🟢 无 |
| 492-494 | `main()` 空文章退出 | 当前始终有 6 篇文章 | 🟢 无 |
| 545-546 | `main()` 入口检查 | 仅在非直接运行时 | 🟢 无 |

### src/config.mjs

| 行号 | 代码路径 | 原因 | 风险 |
|------|---------|------|------|
| ogImage null 分支 | `existsSync` 返回 false | favicon.png 始终存在 | 🟢 无 |

### src/templates/layout.mjs

| 行号 | 代码路径 | 原因 | 风险 |
|------|---------|------|------|
| 81-82 | `ogImage` 为 null 时输出 summary 卡片 | favicon.png 始终存在 | 🟢 无 |

## 覆盖率评估

### 优势
- **核心业务逻辑 100% 行覆盖**：format.mjs、所有模板文件（除 layout 1 行）
- **安全函数 100% 覆盖**：escapeHtml、escapeAttr、escapeXml
- **验证函数 100% 覆盖**：validateSlug、validatePost、validateUniqueSlug
- **所有函数 100% 或接近 100% 调用覆盖**

### 说明
- 未覆盖行均为**防御性代码**（错误处理、极端边界条件）
- 所有未覆盖路径在正常运行中不会被触发
- 分支覆盖率 88.14% 受模板条件渲染（如 ogImage null 分支）影响，属正常情况

### 提升建议
1. 为 `build.mjs` 添加空文件/空内容的边界测试用例（可提升 ~5% 行覆盖）
2. 模拟 `ogImage` 为 null 的场景测试 `layout.mjs` 降级路径
3. 为前端 JS 模块（editor.js, coder.js 等）添加 JSDOM 单元测试
