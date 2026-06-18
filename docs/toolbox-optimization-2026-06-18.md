# 在线工具箱优化报告（2026-06-18）

## 本轮目标

- 扩展 `/tools/` 在线工具箱，从 6 个工具增加到 16 个工具。
- 所有新增工具保持浏览器本地运行，不依赖后端。
- 同步模板、前端交互、核心算法、i18n、搜索索引、助手推荐、测试和构建产物。

## 新增工具清单

1. 哈希摘要：SHA-1 / SHA-256 / SHA-384 / SHA-512，基于 Web Crypto。
2. 密码生成器：基于 `crypto.getRandomValues`，支持字符集选择和熵估算。
3. 颜色转换：HEX / RGB / HSL 互转，输出可读前景色建议。
4. 正则测试：JavaScript RegExp 本地测试，限制输入规模避免页面卡死。
5. Markdown 预览：`marked` + `DOMPurify` 本地渲染和清理，缺失运行时时降级为纯文本预览。
6. 文本 Diff：轻量行级 LCS 对比，限制单侧 300 行。
7. 命名转换：camelCase、PascalCase、snake_case、kebab-case、CONSTANT_CASE 等。
8. HTML 实体：特殊字符实体编码与解码。
9. Cron 解析：支持 5 段表达式、范围、步长、月份/星期英文名，输出后续 5 次执行时间。
10. 二维码生成：使用本地 `qrcode.min.js` 生成 Data URL。

## 参考来源

- DevToys、CyberChef、regex101、crontab.guru 均可访问（HTTP 200），本轮新增方向对齐常见开发者工具箱高频能力。
- 未复制第三方实现代码；新增核心逻辑均在项目内实现，Markdown/QR 仅复用仓库已有本地 vendor。

## Bug 修复清单

- 修复 sitemap / 搜索索引缺失 `/about/` 的配置问题。
- 修复助手 AI 导航测试与当前 `/ai/#nav` 数据源不一致的问题。
- 修复 `npm run lint` 暴露的 `tools-core.js` 宽松等号、`tools.js` 未使用函数、`assistant.js` 常量循环、`blog.js` 块内函数声明问题。
- 修复工具箱旧 tab 测试默认 `End` 键跳到 JWT 的错误假设，改为覆盖新增最后一个 QR tab。

## 性能优化清单

- 新增工具样式压缩到 `coder.css` 仍低于 115KB 阈值。
- 工具页左侧 16 个 tab 增加视口内滚动，避免窄高屏溢出。
- 正则、Diff、QR 输入设置大小上限，降低卡死和内存膨胀风险。
- Markdown / QR vendor 使用本地文件，不引入外部 CDN。

## 安全优化清单

- 哈希使用 Web Crypto；密码生成拒绝不安全随机数运行时。
- Markdown 输出经过 DOMPurify 清理；缺失清理器时只渲染转义后的纯文本。
- 工具输出统一通过 `value` / `textContent` 或受控清理后的 HTML 写入。
- 安全测试确认 `tools-core.js`、`tools.js`、`assistant.js` 不使用 `eval` / `Function`。
- `npm audit --audit-level=moderate --registry=https://registry.npmjs.org`：0 vulnerabilities。

## 验证指标

- `npm run lint`：通过。
- `npm test`：518/518 通过。
- `npm run build`：通过，输出 6 篇文章和静态页面。
- `npm run test:coverage`：line 94.55%，branch 76.21%，functions 90.50%。
- `npm run validate:production`：33 项通过，0 失败，0 警告。
- `node --test tests/performance.test.mjs`：13/13 通过。
- 本地服务 `/tools/`：HTTP 200，页面包含“哈希摘要”和“二维码生成”。

## 后续建议

- 后续如继续扩展工具，优先拆分 `tools-core.js` 或按工具懒加载，避免单文件继续增长。
- 可补 Playwright 浏览器端截图回归，覆盖移动端 tab 滚动和 Markdown/QR 视觉状态。
- Cron 解析当前按常见 5 段表达式实现，若要覆盖 Quartz 秒/年字段，应独立新增模式切换。
