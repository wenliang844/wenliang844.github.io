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

建议在服务器配置中添加以下 CSP 头：

```
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://giscus.app https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  img-src 'self' data: https:;
  font-src 'self' https://cdn.jsdelivr.net;
  connect-src 'self' https://api.web3forms.com;
  frame-src https://giscus.app;
  base-uri 'self';
  form-action 'self';
```

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
- ⚠️ 不在客户端代码中硬编码任何私密密钥

#### 环境变量
静态站点不支持服务器端环境变量。所有客户端可访问的配置应视为公开。

### 5. localStorage 安全

#### 存储的数据
- 主题偏好（明/暗模式）
- 编辑器草稿（Markdown 内容）
- 反馈留言（本地存储）
- 语言偏好

#### 安全措施
- 所有 localStorage 操作包装在 try-catch 中
- 配额超限时优雅降级
- 不存储敏感信息（密码、令牌等）

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
- [ ] 验证 CSP 策略已配置
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
