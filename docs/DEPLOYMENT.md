# 部署指南

## 概述

本项目是一个静态站点，支持多种部署方式。

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 构建站点
npm run build

# 启动本地服务器
npm run serve

# 访问 http://localhost:8137
```

### 开发工作流

```bash
# 运行完整验证（推荐）
npm run validate

# 单独运行各项检查
npm run lint      # 代码检查
npm test          # 测试套件
npm run build     # 构建验证
```

## 生产部署

### GitHub Pages（推荐）

#### 自动部署（GitHub Actions）

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build site
        run: npm run build
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### 手动部署

```bash
# 1. 构建站点
npm run build

# 2. 提交更改
git add .
git commit -m "Build: update site"
git push origin master

# 3. GitHub Pages 会自动从 master 分支部署
```

#### 配置 GitHub Pages

1. 进入仓库 Settings → Pages
2. Source: Deploy from a branch
3. Branch: master / (root)
4. 保存

自定义域名（可选）：
1. 在根目录创建 `CNAME` 文件
2. 内容为你的域名（如 `blog.example.com`）
3. 在域名提供商处添加 CNAME 记录

### Vercel

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel

# 生产部署
vercel --prod
```

`vercel.json` 配置：

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".",
  "installCommand": "npm install",
  "framework": null,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    },
    {
      "source": "/(.*\\.(js|css|woff2|png|jpg|jpeg|gif|svg|ico))",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Netlify

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 初始化
netlify init

# 部署
netlify deploy

# 生产部署
netlify deploy --prod
```

`netlify.toml` 配置：

```toml
[build]
  command = "npm run build"
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://giscus.app https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:;"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 自托管（Nginx）

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name blog.example.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name blog.example.com;
    
    # SSL 证书（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/blog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.example.com/privkey.pem;
    
    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # 站点根目录
    root /var/www/blog;
    index index.html;
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    gzip_min_length 1000;
    
    # 安全头
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # 路由
    location / {
        try_files $uri $uri/ =404;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # HTML 不缓存
    location ~* \.html$ {
        add_header Cache-Control "no-cache";
    }
}
```

#### 部署步骤

```bash
# 1. 在服务器上克隆仓库
cd /var/www
git clone https://github.com/wenliang844/wenliang844.github.io.git blog

# 2. 构建站点
cd blog
npm install
npm run build

# 3. 配置 Nginx
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. 设置 SSL（Let's Encrypt）
sudo certbot --nginx -d blog.example.com

# 5. 设置自动更新（可选）
# 创建 /var/www/blog/deploy.sh
#!/bin/bash
cd /var/www/blog
git pull origin master
npm install
npm run build
sudo systemctl reload nginx

# 添加到 crontab（每小时检查更新）
0 * * * * /var/www/blog/deploy.sh > /var/log/blog-deploy.log 2>&1
```

## 部署检查清单

### 部署前

- [ ] 运行完整测试：`npm run validate`
- [ ] 检查依赖漏洞：`npm audit`
- [ ] 验证构建输出：`npm run build`
- [ ] 审查 git 状态：`git status`
- [ ] 更新版本号（可选）：`package.json`

### 部署后

- [ ] 验证站点可访问
- [ ] 测试关键功能：
  - [ ] 文章列表加载
  - [ ] 搜索功能
  - [ ] 标签过滤
  - [ ] 主题切换
  - [ ] 评论系统（Giscus）
- [ ] 检查浏览器控制台无错误
- [ ] 验证 HTTPS 正常工作
- [ ] 测试响应式布局（移动端）
- [ ] 运行 Lighthouse 审计

### SEO 检查

- [ ] 验证 sitemap.xml 可访问
- [ ] 验证 robots.txt 存在
- [ ] 检查 meta 标签（title, description）
- [ ] 验证 Open Graph 标签
- [ ] 提交 sitemap 到 Google Search Console

## 回滚策略

### GitHub Pages

```bash
# 回滚到上一个提交
git revert HEAD
git push origin master

# 回滚到特定提交
git revert <commit-hash>
git push origin master
```

### Vercel/Netlify

通过 Web 界面回滚到之前的部署：
1. 进入 Deployments 页面
2. 选择稳定的历史部署
3. 点击 "Promote to Production"

### 自托管

```bash
# 1. 备份当前版本
cd /var/www/blog
tar -czf ../blog-backup-$(date +%Y%m%d-%H%M%S).tar.gz .

# 2. 回滚到特定提交
git checkout <commit-hash>
npm install
npm run build
sudo systemctl reload nginx

# 3. 或从备份恢复
cd /var/www
tar -xzf blog-backup-YYYYMMDD-HHMMSS.tar.gz
```

## 环境变量

本项目不使用服务器端环境变量。客户端配置：

- `js/giscus.js` - Giscus 评论配置
- `js/feedback.js` - Web3Forms API Key（可选）
- `src/config.mjs` - 站点配置

## 监控和日志

### 错误监控

启用错误收集（可选）：

```javascript
// js/error-handler.js
var ErrorHandler = {
  debug: false,  // 生产环境设为 false
  // ...
};
```

### 性能监控

启用性能监控（可选）：

```javascript
// js/performance-monitor.js
var PerformanceMonitor = {
  enabled: false,  // 需要时设为 true
  // ...
};
```

### 访问日志

使用 Google Analytics、Plausible 或其他分析工具：

```html
<!-- 在 layout 模板中添加 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 故障排查

### 构建失败

```bash
# 清理并重新构建
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 样式未加载

检查：
1. CSS 文件路径正确
2. 服务器 MIME 类型配置正确
3. 浏览器缓存（强制刷新 Ctrl+Shift+R）

### JavaScript 错误

1. 打开浏览器控制台查看错误
2. 检查脚本加载顺序
3. 验证依赖库已加载

### 404 错误

检查：
1. 文件路径大小写（Linux 区分大小写）
2. `.html` 扩展名
3. 服务器路由配置

## 持续集成/持续部署

### GitHub Actions 工作流

完整的 CI/CD 流程：

```yaml
name: CI/CD

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm audit
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: |
            post/
            tags/
            categories/
            ai/
            sitemap.xml
            index.xml
            search-index.json
  
  deploy:
    needs: build
    if: github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build
      - uses: actions/deploy-pages@v4
```

## 支持

遇到问题？

1. 查看 [故障排查](#故障排查) 部分
2. 搜索 [GitHub Issues](https://github.com/wenliang844/wenliang844.github.io/issues)
3. 提交新 Issue
