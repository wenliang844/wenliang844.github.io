# 安全性指南

## 概述

本项目已实施多层次安全防护机制，确保在生产环境中安全运行。

## 已实施的安全措施

### 1. XSS 防护

#### 前端转义
- 所有用户输入和动态内容通过 `CWLUtils.escapeHtml()` 转义
- 搜索结果使用 DOM API 构建，避免 `innerHTML` 注入
- 第三方库使用 DOMPurify 进行 HTML 清理

#### 关键防护点
- 搜索功能：`js/search.js` - 搜索结果渲染使用 DOM API
- 编辑器：`js/editor.js` - Front matter 转义特殊字符
- 标签过滤：`js/blog.js` - 标签名称安全渲染
- 反馈表单：`js/feedback.js` - 用户输入使用 `textContent`

#### 测试覆盖
```bash
npm test  # 运行安全测试套件
```

关键测试文件：
- `tests/security.test.mjs` - XSS 防护测试
- `tests/templates.test.mjs` - 模板转义测试

### 2. Content Security Policy (CSP)

所有 HTML 已内置 CSP meta，并由 `scripts/harden-csp.mjs` 在构建期校验。JSON-LD 使用逐页 SHA-256 哈希授权，内联事件处理器被构建直接拒绝：

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'sha256-<page-json-ld-hash>';
  script-src-attr 'none';
  style-src 'self';
  style-src-attr 'none';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://cloud.umami.is https://plausible.io
    https://buttondown.com https://muyuan.do
    https://token-plan-cn.xiaomimimo.com [configured Worker origin];
  frame-src https://giscus.app;
  base-uri 'self';
  form-action 'self';
```

Giscus 脚本源只授权给文章页，jsDelivr 只授权给使用 MediaPipe 的工具箱页面；`wasm-unsafe-eval` 仅授权给加载 Pagefind 全文搜索或 MediaPipe 的页面，不开放普通 `unsafe-eval`。公开页面的运行时样式已迁移为类、受控数据属性、原生 `<progress>` 和图片色块，错误提示也使用静态样式表；构建会拒绝任何静态 `style` 属性，并使用 `style-src 'self'; style-src-attr 'none'`。`/editor/` 是唯一例外：CodeMirror 6 为光标、选区和滚动测量写入运行时样式，因此该路由保留 `style-src/style-src-attr 'unsafe-inline'`，但不放宽脚本策略。

网络权限按页面能力生成：公共页面只允许本站、可选统计、Buttondown、固定 AI 预设和构建时配置的 Worker Origin；联系页额外允许 Web3Forms。只有 `/tools/` 的 Mini API Tester 需要请求用户输入的目标，因此该路由单独保留 `connect-src https:`，测试会阻止此权限扩散。`scripts/harden-csp.mjs` 会读取 `cwl-api-base` meta 并只写入其合法 HTTPS Origin（本地开发允许 localhost HTTP）。

### 3. 输入验证

#### 构建时验证
- **日期格式**：仅接受 `YYYY-MM-DD` 格式
- **Slug 字符**：仅允许字母、数字、连字符、下划线
- **字段长度**：
  - 标题：最多 200 字符
  - 短标题：最多 100 字符
  - 描述：最多 500 字符
  - Slug：最多 100 字符

#### 验证函数
```javascript
// scripts/build.mjs
export function normalizeDate(d)   // 验证日期格式
export function validateSlug(slug, filename)  // 验证 slug
export function validatePost(data, filename)  // 验证文章字段
```

### 4. 密钥管理

#### 客户端密钥
- **Web3Forms API Key**：`js/feedback.js` 中默认为空
- **Giscus 配置**：`js/giscus.js` 中已配置，公开可见
- **BYOK API Key**：只保留在当前页面的密码输入框/请求对象中，刷新即消失；配置保存与旧配置迁移都会把 `apiKey` 写成空字符串
- ⚠️ 不在客户端代码中硬编码任何私密密钥

#### 环境变量
静态站点不支持服务器端环境变量。所有客户端可访问的配置应视为公开。

边缘发布服务的 `GITHUB_CLIENT_SECRET`、`GITHUB_TOKEN` 和 `SESSION_SECRET` 使用 Wrangler Secrets 管理，禁止写入仓库或浏览器。GitHub OAuth 用户 Token 仅用于一次身份查询，不进入 Cookie、Analytics Engine 或本地存储。细节见 [GitHub PR 发布 API](PUBLISHING_API.md)。

### 4.1 发布接口

- 会话 Cookie：`Secure; HttpOnly; SameSite=Lax`，HMAC-SHA256 签名，8 小时过期。
- CSRF：Token 位于签名会话内，只通过会话接口返回当前页面内存。
- Origin：只接受 `SITE_ORIGIN` 的精确匹配，不使用通配 CORS。
- 授权：GitHub 登录名必须匹配单作者白名单。
- 仓库边界：slug 只能映射到 `src/posts/{slug}.md`，失败时回滚临时分支。
- 审计：仅记录事件元数据，不记录正文、Cookie 或 Token。

### 4.2 图片上传

- 许可：仅认证作者可通过 Cookie、精确 Origin 与 CSRF 获取 5 分钟签名许可，上传 Token 不进入 URL、Cookie 或本地存储。
- 类型：只允许 AVIF/JPEG/PNG/WebP，拒绝 SVG；服务端复验 Content-Type、魔数和真实尺寸。
- 配额：单文件最多 8 MB、单边最多 12000px、总像素不超过 4000 万。
- 存储：服务端生成 UUID 对象键，记录 SHA-256，并通过 R2 条件写入阻止覆盖已有对象。
- 分发：资源使用固定 Content-Type 与一年 immutable 缓存；公开域名必须启用 HTTPS 和 `X-Content-Type-Options: nosniff`。

当前上传面只接受严格图片格式，尚未接入通用附件和异步病毒扫描。未来开放 PDF/压缩包等附件前，必须增加隔离桶、恶意文件扫描和审核后发布流程。

### 4.3 AI 知识问答

- 数据边界：只读取构建期已过滤草稿的公开分块；Vectorize 查询必须匹配当前数据集哈希。
- 提示注入：系统提示明确把来源正文视为不可信数据，模型只能引用来源，不得执行正文中的指令。
- 可信回答：无充分关键词或向量证据时不调用生成模型；回答必须包含 `[n]` 引用并返回同站来源链接。
- 引用边界：响应后处理只保留 `1..sources.length` 范围内的引用，删除模型生成的越界编号，并由离线评测门禁验证引用契约。
- 滥用控制：Durable Object 原子执行分钟限流和每日预算熔断，访客 IP 先经 HMAC 后再参与计数。
- 隐私：Analytics Engine 只记录结果类型和数据集哈希前缀，不记录问题、回答、原始 IP、Cookie 或 Token。
- 关闭开关：`AI_ENABLED=false` 时接口失败关闭，客户端不会绕过边缘 API 直连模型。

### 4.4 在线聊天室

- 第三方边界：消息、昵称、IP 与浏览器连接信息会发送给 Minnit Chat，并受其隐私政策、保留期限和管理设置约束；页面明确提示访客不要发送敏感信息。
- CSP 边界：只有 `/chat/` 放行 `https://minnit.chat` 脚本、`https://organizations.minnit.chat` iframe，以及官方加载器生成 iframe 所需的内联样式属性；其他页面不继承这些权限。
- 本地状态：官方加载器使用带组织 ID 前缀的 localStorage 项保存访客昵称和恢复状态，不读取本站文章、编辑器草稿或其他业务数据。
- 缓存边界：聊天室页面、iframe 状态和第三方请求不进入本站 PWA 缓存。
- 备用实现：仓库保留的 Durable Objects 聊天 API 默认通过 `CHAT_ENABLED=false` 关闭，不参与当前页面运行。

### 5. localStorage 安全

#### 存储的数据
- 主题偏好（明/暗模式）
- 编辑器草稿（Markdown 内容）
- 反馈留言（本地存储）
- 语言偏好
- AI 助手的提供方、模型和流式输出偏好，以及本地对话记录（不含 API Key 和自定义请求端点）

#### 安全措施
- 所有 localStorage 操作包装在 try-catch 中
- 配额超限时优雅降级
- 不存储敏感信息（密码、令牌等）
- AI 助手读取旧配置时会立即移除历史 API Key，并把端点重置为只读预设；实际请求前再次校验允许的 HTTPS Origin

```javascript
// js/utils.js
CWLUtils.storageGet(key)   // 安全读取
CWLUtils.storageSet(key, value)  // 安全写入
```

### 6. 第三方依赖

#### CDN 资源
使用 Subresource Integrity (SRI) 验证 CDN 资源：

```html
<script src="https://cdn.jsdelivr.net/npm/marked@X.X.X/marked.min.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

#### npm 依赖
```bash
npm audit          # 检查依赖漏洞
npm audit fix      # 自动修复已知漏洞
```

当前依赖：
- `marked@^18.0.5` - Markdown 解析器
- `yaml@^2.9.0` - YAML 解析器
- `jsdom@^27.0.1` - 测试用 DOM 模拟

### 7. 错误处理

#### 全局错误捕获
```javascript
// js/error-handler.js
window.CWLErrorHandler.log(error, context)
```

- 捕获未处理的异常和 Promise 拒绝
- 记录错误日志但不暴露敏感信息
- 向用户显示友好的错误消息

#### 安全日志
- 不在日志中记录密码、令牌等敏感数据
- 生产环境中禁用调试模式（`debug: false`）

### 8. HTTPS

⚠️ **强制 HTTPS**

在生产环境中，必须通过 HTTPS 提供站点：

- GitHub Pages 自动启用 HTTPS
- 自托管时配置 SSL/TLS 证书
- 设置 HSTS 头：`Strict-Transport-Security: max-age=31536000; includeSubDomains`

## 安全检查清单

部署前执行以下检查：

- [ ] 运行测试套件：`npm test`
- [ ] 检查依赖漏洞：`npm audit`
- [x] 验证 CSP 策略已配置并对内联脚本使用哈希
- [ ] 确认 HTTPS 已启用
- [ ] 检查是否有硬编码的密钥
- [ ] 验证所有用户输入已转义
- [ ] 测试错误处理路径
- [ ] 审查 localStorage 存储的数据

## 安全报告

如果发现安全漏洞，请：

1. **不要公开披露**
2. 通过私密渠道联系维护者
3. 提供漏洞详情和复现步骤
4. 等待确认后再公开

## 定期维护

### 每月
- 运行 `npm audit` 检查新漏洞
- 更新依赖到最新稳定版本

### 每季度
- 审查安全策略
- 更新 CSP 配置
- 审计日志收集逻辑

### 每年
- 完整安全审计
- 渗透测试（可选）
- 更新文档

## 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
