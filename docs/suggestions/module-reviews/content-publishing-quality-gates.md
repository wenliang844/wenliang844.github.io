# 内容发布质量门禁专题分析

> 分析时间：2026-07-04 01:26 +08:00  
> 分析范围：`scripts/build.mjs`, `scripts/validate-posts.mjs`, `src/templates/post.mjs`, `src/posts/*.md`, `.github/workflows/ci.yml`  
> 验证命令：`node --test tests/build.test.mjs tests/build-deep.test.mjs tests/build-extended.test.mjs tests/build-extra.test.mjs tests/validate-posts.test.mjs tests/post-next.test.mjs tests/post-next-deep.test.mjs tests/blog.test.mjs`，153/153 通过；`npm run validate:posts` 通过，6 篇文章有效

## 本轮结论

构建与内容测试覆盖较好：日期、slug、封面路径、RSS、sitemap、搜索索引、文章导航和博客交互均有回归测试。当前更值得治理的是发布质量门禁的一致性：`validate:posts` 拦截的公开内容标记没有进入 `build.mjs` 主路径，文章元数据类型和长度校验仍偏轻，Markdown 原始 HTML 没有安全策略，英文正文覆盖率没有被量化，封面只校验路径形状但不校验文件存在和协议。

---

## 📌 MR-PUB-01: `build.mjs` 主路径可绕过公开内容和标签字段校验

- **📍 位置**：`scripts/build.mjs:256-332`, `scripts/validate-posts.mjs:52-102`, `.github/workflows/ci.yml:33-39`
- **📝 当前状况描述**：`validate-posts.mjs` 会检查 `TODO`、`SECRET`、`TOKEN` 等公开内容标记，也会校验 `tags` / `tagsEn` 类型和长度匹配；CI 也在 build 前运行 `npm run validate:posts`。但 `scripts/build.mjs` 自身只调用 `validatePost()`、`validateSlug()` 和 `validateUniqueSlug()`，没有复用 `validatePublicContent()` 与 `validateTagFields()`。直接执行 `node scripts/build.mjs` 或任何只跑 `npm run build` 的自动化，都可能绕过这些发布前检查。
- **⚠️ 影响程度**：高
- **💡 建议方案**：把文章校验抽成共享模块，例如 `src/lib/post-validation.mjs`，让 `validate-posts.mjs` 与 `build.mjs` 都调用同一组规则。构建可以默认拒绝 error，只允许 warning 继续。
  ```javascript
  import { validatePostDocument } from "../src/lib/post-validation.mjs";

  const { data, content } = parseFrontMatter(raw, file);
  const report = validatePostDocument({ raw, data, content, file });
  if (report.errors.length) {
    throw new Error(report.errors.join("; "));
  }
  ```
- **📊 预期收益**：避免本地构建、定时同步脚本或未来部署流程绕过内容安全门禁，让“能构建”与“能发布”使用同一套标准。
- **🔗 相关建议引用**：[MR-SEARCH-01](search-and-seo-pipeline.md) 中关于草稿/未来发布时间门禁的建议，[DE-08](../devex-improvements.md) 中关于文章 front matter 校验工具的建议。

---

## 📌 MR-PUB-02: 文章元数据缺少统一类型和长度 schema

- **📍 位置**：`scripts/build.mjs:114-132`, `src/templates/post.mjs:236-244`, `src/templates/post.mjs:334-340`, `scripts/build.mjs:392-408`
- **📝 当前状况描述**：`validatePost()` 只检查 `title`、`shortTitle`、`date`、`summary`、`description` 是否 truthy，并限制 `title`、`shortTitle`、`description` 长度。它没有显式要求这些字段必须是字符串，也没有限制 `summary`、`titleEn`、`summaryEn`、`descriptionEn` 等英文元数据长度。YAML 中若误写数组或对象，可能绕过 missing 检查并在模板中被字符串化；超长 summary 也可能进入文章页、列表页、搜索索引和 JSON-LD。
- **⚠️ 影响程度**：中
- **💡 建议方案**：定义文章 front matter schema，覆盖类型、长度、可选字段和 i18n 字段。当前不一定需要引入新依赖，先用轻量函数即可。
  ```javascript
  const STRING_FIELDS = {
    title: 200,
    shortTitle: 100,
    summary: 240,
    description: 500,
    titleEn: 200,
    shortTitleEn: 100,
    summaryEn: 280,
    descriptionEn: 500,
  };

  for (const [field, max] of Object.entries(STRING_FIELDS)) {
    if (data[field] !== undefined && typeof data[field] !== "string") {
      throw new Error(`${field} must be a string.`);
    }
    if (data[field] && data[field].length > max) {
      throw new Error(`${field} too long.`);
    }
  }
  ```
- **📊 预期收益**：减少 front matter 误写造成的页面怪异输出、SEO 摘要过长和搜索索引噪声，让编辑器导出、校验脚本与构建脚本保持同一契约。
- **🔗 相关建议引用**：[MR-BUILD-01](build-system.md) 中关于构建逻辑单一事实源的建议，[TD-03](../tech-debt.md) 中关于 Markdown 渲染依赖升级风险的建议。

---

## 📌 MR-PUB-03: Markdown 原始 HTML 缺少发布级安全策略

- **📍 位置**：`scripts/build.mjs:162-202`, `scripts/build.mjs:243-255`, `src/templates/post.mjs:50-60`
- **📝 当前状况描述**：文章正文由 `marked.parse()` 渲染，`tidyHtml()` 还会保护 `<script>`、`<style>`、`textarea` 等块不被空行压缩破坏，说明原始 HTML 会被保留。对于个人博客的受信任 Markdown 源，这是可接受的编辑自由；但一旦从外部草稿、AI 生成内容或在线编辑器导入，`<script>`、`onerror=`、`javascript:` 链接、第三方 iframe 等内容可能直接进入静态页面。
- **⚠️ 影响程度**：中
- **💡 建议方案**：在 `validate:posts` 中先做 HTML 安全 lint：默认拒绝脚本、内联事件、`javascript:` URL 和非白名单 iframe；确有需要的 HTML 组件用显式 allowlist。
  ```javascript
  const BLOCKED_HTML = [
    /<script\b/i,
    /\son\w+\s*=/i,
    /\bjavascript:/i,
    /<iframe\b(?![^>]+src="https:\/\/www\.youtube-nocookie\.com\/)/i,
  ];
  for (const rule of BLOCKED_HTML) {
    if (rule.test(content)) throw new Error("Unsafe raw HTML in Markdown.");
  }
  ```
- **📊 预期收益**：保留 Markdown 表达力，同时防止一次错误粘贴把可执行 HTML 发布到所有读者浏览器。
- **🔗 相关建议引用**：[S-01](../security-audit.md) 中关于 `innerHTML` 使用点审计的建议，[编辑器专题](editor.md) 中关于 Markdown 渲染净化的建议。

---

## 📌 MR-PUB-04: 英文正文覆盖率没有被量化，英文模式会出现混合内容

- **📍 位置**：`scripts/build.mjs:286-324`, `src/templates/post.mjs:50-60`, `src/posts/*.md:1-16`
- **📝 当前状况描述**：本轮统计显示 6/6 文章都有 `titleEn`、`summaryEn`、`descriptionEn` 和 `tagsEn`，但 `contentEn` 覆盖率为 0/6。模板在没有英文正文时故意不加 `data-i18n-lang`，让正文在任何语言下都显示中文兜底，这是稳妥的降级；问题在于英文模式下用户会看到英文标题、英文摘要、英文标签和中文正文混排，且当前没有构建报告或页面提示说明“正文暂无英文版”。
- **⚠️ 影响程度**：低到中
- **💡 建议方案**：建立 i18n 内容覆盖报告，并在英文模式下对无 `contentEn` 的文章显示轻量状态或筛选入口。发布策略上可设阈值，例如关键文章必须有英文正文，普通文章允许中文兜底。
  ```javascript
  const coverage = posts.map((post) => ({
    slug: post.slug,
    metaEn: Boolean(post.titleEn && post.summaryEn && post.descriptionEn),
    bodyEn: Boolean(post.contentHtmlEn),
  }));
  await writeFile("docs/suggestions/generated/i18n-content-coverage.json", JSON.stringify(coverage, null, 2));
  ```
- **📊 预期收益**：让双语能力从“隐式兜底”变成可运营指标，减少英文访问者对内容完整度的误判。
- **🔗 相关建议引用**：[i18n 与可访问性专题](i18n-and-accessibility.md)，[MR-SEARCH-05](search-and-seo-pipeline.md) 中关于页面元数据一致性的建议。

---

## 📌 MR-PUB-05: 封面校验只看路径形状，不校验文件存在与安全协议

- **📍 位置**：`scripts/build.mjs:75-88`, `scripts/build.mjs:291-296`, `scripts/build.mjs:428-434`, `src/templates/post.mjs:172-194`
- **📝 当前状况描述**：`normalizeCover()` 接受 `/images/` 和 `http(s)://` 开头的封面路径，并限制长度。本轮检查当前 6 篇文章封面均为本地 `/images/posts/*.png` 且文件存在，体积约 140-152 KB；但代码没有校验本地文件是否真实存在，也允许 `http://` 远程封面进入 OG、JSON-LD 和 image sitemap。封面路径拼错会生成坏社交卡片，HTTP 远程图则可能带来混合内容、抓取失败或第三方资源稳定性问题。
- **⚠️ 影响程度**：中
- **💡 建议方案**：构建期校验本地封面存在、限制远程封面为 HTTPS，并为封面记录宽高和体积预算。远程封面如确有必要，建议先下载到本地资产目录。
  ```javascript
  function normalizeCover(cover, filename) {
    if (/^http:\/\//i.test(cover)) {
      throw new Error(`Invalid cover in ${filename}: remote cover must use HTTPS.`);
    }
    if (cover.startsWith("/images/") && !existsSync(join(ROOT, cover.slice(1)))) {
      throw new Error(`Invalid cover in ${filename}: local cover file not found.`);
    }
    return cover;
  }
  ```
- **📊 预期收益**：避免社交分享图、结构化数据和 image sitemap 指向坏图或不稳定远程资源，提升发布前反馈质量。
- **🔗 相关建议引用**：[RES-02](resource-analysis.md) 中关于文章封面接入 image sitemap 的建议，[P-11](../performance-bottlenecks.md) 中关于图片尺寸预留的建议。

---

## 📌 MR-PUB-06: 公开内容标记扫描需要降低误报并补真实密钥模式

- **📍 位置**：`scripts/validate-posts.mjs:20`, `scripts/validate-posts.mjs:64-70`, `tests/validate-posts.test.mjs:137-150`
- **📝 当前状况描述**：`PUBLIC_CONTENT_MARKER` 会拦截 `TODO|FIXME|HACK|XXX|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|TOKEN`，这对防止草稿备注误发很有帮助。但它按普通单词扫描整篇 Markdown，技术文章里合法讨论 “token”、“API key” 或 “password” 时会产生误报；同时它没有识别更具体的真实密钥形态，例如 `sk-...`、私钥 PEM 块、云厂商 access key 等。
- **⚠️ 影响程度**：低到中
- **💡 建议方案**：把扫描拆成两层：草稿标记默认 error，但支持精确 allow 注释；真实密钥模式永远 error 且不允许白名单。测试覆盖 fenced code、普通正文和 allow 注释。
  ```javascript
  const SECRET_PATTERNS = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE\s+KEY-----/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\b(AKIA|ASIA)[A-Z0-9]{16}\b/,
  ];
  const DRAFT_MARKERS = /\b(TODO|FIXME|HACK|XXX)\b/i;
  ```
- **📊 预期收益**：既保持“别把草稿备注发出去”的保护，又减少正常技术写作被关键词误伤，并提高真实密钥泄漏检出率。
- **🔗 相关建议引用**：[安全审计](../security-audit.md) 中关于敏感信息泄露的建议，[MR-PUB-01](#mr-pub-01-buildmjs-主路径可绕过公开内容和标签字段校验)

## 建议优先级

| 优先级 | 建议 |
|--------|------|
| P1 | MR-PUB-01 构建主路径复用完整文章校验；MR-PUB-03 Markdown 原始 HTML 安全 lint |
| P2 | MR-PUB-02 元数据 schema；MR-PUB-05 封面存在性与 HTTPS 校验 |
| P3 | MR-PUB-04 英文正文覆盖率报告；MR-PUB-06 公开内容扫描分层 |
