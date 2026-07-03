# Relay 数据质量与同步可靠性专题分析

> 分析时间：2026-07-04 01:48 +08:00  
> 分析范围：`data/relay-providers.json`, `scripts/parse-relay.mjs`, `scripts/update-commercial-relay.mjs`, `.github/workflows/relay-commercial-sync.yml`, `js/relay.js`, `js/tools.js`, `src/templates/relay.mjs`, `src/templates/tools.mjs`  
> 验证命令：`node --test tests/relay.test.mjs`，8/8 通过；`npm run test:coverage`，779/779 通过

## 本轮结论

Relay 数据链路已经具备基本脱敏能力：SQL 导入测试会确认 `settings_config`、API key、token、账号 ID 和 URL query 不进入公开 JSON；商业站同步也有多源合并和失败源跳过测试。本轮又补充了 official 跳过、失败摘要、CLI 参数保护、缺源配置、认证 header、非法 header JSON 和字段清洗测试，并修复 `isCurrent: "false"` 被误判为当前可用的问题。剩余主要风险不在“是否泄漏密钥”，而在“公开榜单数据是否足够适合被 API Tester 直接使用”：商业站条目很多是官网/控制台地址，LinuxDo 条目存在重复 endpoint，前端会把 down/unknown 条目一起展示和填入，商业同步在部分源失败时会直接用剩余源覆盖旧数据。

本轮数据探针：

- `data/relay-providers.json` 共 43 条：LinuxDo 19 条，商业站 24 条。
- 健康状态分布：healthy 3、degraded 1、unknown 31、down 8。
- 重复 endpoint 3 组：`capi.aerolink.lat`、`gw2.oops.asia`、`a-ocnfniawgw.cn-shanghai.fcapp.run`。
- 商业站多数组为官网/控制台地址，例如 `https://302ai.cn`、`https://openrouter.ai`，只有少数看起来像 API base URL。

---

## 📌 MR-RELAY-01: 商业站官网 URL 被当作 API endpoint 填入 API Tester

- **📍 位置**：`data/relay-providers.json:375-788`, `js/tools.js:932-972`, `src/templates/tools.mjs:123-129`, `tests/tools.test.mjs:768-828`
- **📝 当前状况描述**：商业站同步把 `endpoint` 作为唯一可用地址字段；API Tester 的 `fillRelayProvider()` 会对 ChatGPT 格式统一拼成 `${endpoint}/chat/completions`。但商业站数据中大量 endpoint 更像官网或控制台页面，例如 `https://302ai.cn`、`https://platform.deepseek.com`、`https://openrouter.ai`。用户在工具箱选择这些条目后，可能得到一个看似可请求、实际错误的 API URL。
- **⚠️ 影响程度**：中
- **💡 建议方案**：把 relay 数据拆成 `apiBaseUrl` 和 `websiteUrl`，并增加 `endpointKind` 或 `callable` 字段。API Tester 只展示 `callable === true` 的条目；AI 排行榜仍可展示官网类条目，但复制配置时提示“仅官网/控制台，暂无 API endpoint”。
  ```javascript
  {
    name: "OpenRouter",
    apiBaseUrl: "https://openrouter.ai/api/v1",
    websiteUrl: "https://openrouter.ai",
    endpointKind: "api",
    callable: true
  }
  ```
- **📊 预期收益**：减少用户把官网地址误当 OpenAI-compatible endpoint 的失败体验，让排行榜信息和可调用配置各有清晰边界。
- **🔗 相关建议引用**：[MR-RT-04](tools-core-runtime-safety.md#mr-rt-04-mini-api-tester-需要标注私网和非-https-请求边界), [assistant-loader-and-llm-runtime.md](assistant-loader-and-llm-runtime.md) 中关于 endpoint 信任边界的建议。

---

## 📌 MR-RELAY-02: 前端未默认隐藏 down/unknown 或低分条目

- **📍 位置**：`js/relay.js:40-58`, `js/relay.js:94-156`, `js/tools.js:975-1003`, `data/relay-providers.json:1-788`
- **📝 当前状况描述**：AI relay 页面有“可用/异常”筛选，但默认仍展示全部；API Tester 的 `normalizeRelaySections()` 只要求 provider 有 endpoint，然后按 score 排序。当前 43 条里只有 4 条 healthy/degraded，8 条 down，31 条 unknown；低于 40 分或 down 的条目仍可被选中、复制或填入请求。对于“排行榜”这是信息完整性，对于“调试预设”却会增加失败概率。
- **⚠️ 影响程度**：中
- **💡 建议方案**：AI 页面保留全部但默认排序时把 down/unknown 分区；API Tester 只默认展示 healthy/degraded 且 score 达标的条目，并提供“显示所有中转站”开关。
  ```javascript
  function isCallablePreset(provider) {
    return provider.callable !== false
      && ["healthy", "degraded"].includes(provider.healthStatus)
      && Number(provider.score || 0) >= 40;
  }
  relayProviders = normalizeRelaySections(data).filter(isCallablePreset);
  ```
- **📊 预期收益**：提高 API Tester 预设的首试成功率，同时保留 AI 页面作为完整数据浏览入口。
- **🔗 相关建议引用**：[P-15](../performance-bottlenecks.md#p-15-测试覆盖率总体达标但-relay-同步脚本覆盖率明显低于整体水平), [full-browser-audit-2026-07-03.md](../full-browser-audit-2026-07-03.md) 中关于 relay 数据质量监控的建议。

---

## 📌 MR-RELAY-03: LinuxDo 导入未按 endpoint + format 合并重复路由

- **📍 位置**：`scripts/parse-relay.mjs:387-538`, `data/relay-providers.json:99-201`, `data/relay-providers.json:283-347`
- **📝 当前状况描述**：`parse-relay.mjs` 先按 `provider.id + format` 分组，再取该组 `uniqueSorted(group.endpoints)[0]` 作为公开 endpoint。这样可以保留源系统里的 provider 语义，但公开 JSON 中仍出现多个相同 endpoint：`capi.aerolink.lat` 2 条、`gw2.oops.asia` 3 条、`a-ocnfniawgw.cn-shanghai.fcapp.run` 2 条。部分重复条目还带有 `copy` 名称、缺少测速数据或健康状态未知，会稀释榜单质量。
- **⚠️ 影响程度**：低到中
- **💡 建议方案**：导出阶段按 `endpoint + format` 做二次聚合，合并模型、标签和健康数据，名称选最高分或最新健康记录对应项；保留 `aliases` 记录源名称。
  ```javascript
  const key = `${row.endpoint}::${row.format}`;
  merged.set(key, mergeRelayRows(merged.get(key), row));
  ```
- **📊 预期收益**：减少榜单噪声，避免用户在多个同 endpoint 条目之间做无意义选择，也让健康状态和评分更集中。
- **🔗 相关建议引用**：[full-browser-audit-2026-07-03.md](../full-browser-audit-2026-07-03.md) 中关于重复 provider 合并测试的建议。

---

## 📌 MR-RELAY-04 [部分修复]: 商业同步部分失败时会用剩余源覆盖旧数据

- **📍 位置**：`scripts/update-commercial-relay.mjs:142-168`, `scripts/update-commercial-relay.mjs:179-217`, `tests/relay.test.mjs:67-121`, `.github/workflows/relay-commercial-sync.yml:33-61`
- **✅ 修复状态**：非法 `RELAY_COMMERCIAL_HEADERS` 现在会在发起请求前失败，不再被 `Promise.allSettled()` 吃成“所有源 0 条”；缺少必需源和商业字段清洗也已进入测试。
- **📝 剩余状况描述**：`fetchCommercialProviders()` 仍使用 `Promise.allSettled()`，单个源 HTTP 失败只记录 warning，成功源合并后去重；主流程只检查总数不低于 `RELAY_COMMERCIAL_MIN_COUNT`。如果一个关键商业源失败，而另一个次要源仍返回 1 条以上，脚本仍可能通过并覆盖 `data.commercialProviders`。
- **⚠️ 影响程度**：中
- **💡 建议方案**：记录每个源的成功/失败和条数，设置 `minSuccessfulSources` 或“低于上次数量的一定比例时保留旧数据”。GitHub Actions 可输出 diff 摘要并阻止大幅缩水的自动提交。
  ```javascript
  if (providers.length < previousCommercial.length * 0.8) {
    throw new Error("商业站数据缩水超过 20%，保留旧数据并人工检查。");
  }
  ```
- **📊 预期收益**：避免短暂网络故障或单个源异常导致公开数据大幅回退，让自动同步更像可靠的数据发布流程。
- **🔗 相关建议引用**：[DE-11](../devex-improvements.md#de-11-已修复-把生产验证改造成真正只读的质量门禁), [P-15](../performance-bottlenecks.md#p-15-测试覆盖率总体达标但-relay-同步脚本覆盖率明显低于整体水平)

---

## 📌 MR-RELAY-05: 同一组认证 Header 会发送到所有商业数据源

- **📍 位置**：`scripts/update-commercial-relay.mjs:118-139`, `scripts/update-commercial-relay.mjs:142-153`, `.github/workflows/relay-commercial-sync.yml:16-18`
- **📝 当前状况描述**：`RELAY_COMMERCIAL_SOURCE_URL` 支持逗号分隔多个 URL，`authHeaders()` 会把同一个 `RELAY_COMMERCIAL_TOKEN` 和 `RELAY_COMMERCIAL_HEADERS` 附加到每个源请求。若未来配置多个不同域名的数据源，同一个 bearer token 或自定义 header 会被发送到所有源。当前 tests 覆盖多源跳过失败，但没有覆盖“多源 + 认证头”的信任边界。
- **⚠️ 影响程度**：中
- **💡 建议方案**：当存在认证 header 时限制单一 origin，或把配置改成结构化数组，每个 source 单独声明 URL 和认证信息。至少在多 origin + token 时直接失败。
  ```javascript
  const origins = new Set(urls.map((url) => new URL(url).origin));
  if (origins.size > 1 && hasAuthHeaders()) {
    throw new Error("多源同步不能复用同一认证 Header，请改用 per-source 配置。");
  }
  ```
- **📊 预期收益**：降低外部源配置失误导致同步 token 泄露到非预期域名的风险。
- **🔗 相关建议引用**：[security-audit.md](../security-audit.md), [assistant-loader-and-llm-runtime.md](assistant-loader-and-llm-runtime.md)

---

## 📌 MR-RELAY-06: SQL 导入解析器缺少结构漂移告警

- **📍 位置**：`scripts/parse-relay.mjs:45-134`, `scripts/parse-relay.mjs:545-574`, `tests/relay.test.mjs:11-65`
- **📝 当前状况描述**：SQL 导入器手写解析 `INSERT INTO "table"` 语句，并从固定表名提取数据。它能处理简单字符串转义和字段脱敏，但如果 CC Switch 导出格式换成无引号表名、批量 `VALUES (...), (...)`、字段名变化或缺表，解析结果可能变少甚至为空。当前测试只覆盖一条理想 INSERT 和公开 JSON 不含密钥，没有覆盖格式漂移时的 fail-fast。
- **⚠️ 影响程度**：低到中
- **💡 建议方案**：为每张关键表记录解析行数，缺少 `providers` 或 `provider_endpoints` 时直接失败；同时增加格式漂移 fixture 测试，至少覆盖批量 VALUES、缺列和异常 JSON。
  ```javascript
  if (!tables.providers.length || !tables.provider_endpoints.length) {
    throw new Error("relay SQL export missing required provider tables.");
  }
  ```
- **📊 预期收益**：避免源格式变化后生成一个“看起来合法但严重缺数据”的公开榜单，提高导入链路可诊断性。
- **🔗 相关建议引用**：[P-15](../performance-bottlenecks.md#p-15-测试覆盖率总体达标但-relay-同步脚本覆盖率明显低于整体水平)

## 建议优先级

| 优先级 | 建议 |
|--------|------|
| P1 | MR-RELAY-01 区分官网与 API endpoint；MR-RELAY-05 多源认证 Header 隔离 |
| P2 | MR-RELAY-02 API Tester 默认过滤可用条目；MR-RELAY-04 部分失败时保留旧数据 |
| P3 | MR-RELAY-03 重复 endpoint 合并；MR-RELAY-06 SQL 结构漂移告警 |
