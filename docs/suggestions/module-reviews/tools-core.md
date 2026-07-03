# tools-core 模块深度分析

> 分析时间：2026-07-03 23:20 +08:00 | 范围：`js/tools-core.js`, `tests/tools*.mjs`

## 📌 MR-CORE-01: Cron 解析器需要避免主线程百万次扫描

- **📍 位置**：`js/tools-core.js:938-980`, `tests/tools-core-deep.test.mjs:258-266`
- **📝 当前状况描述**：Cron 下一次执行时间通过逐分钟推进计算，最多扫描两年。第 2 轮只读探测显示，无解表达式 `0 0 31 2 *` 约 127.57ms，明显高于普通表达式。
- **⚠️ 影响程度**：中
- **💡 建议方案**：
  ```javascript
  if (isImpossibleDayMonth(dayOfMonth.value, month.value)) {
    return fail("日期字段永远无法匹配", "cronNoRuns");
  }
  ```
  后续可以把逐分钟推进替换为按字段跳跃：分钟不匹配跳到下一合法分钟，小时不匹配跳到下一合法小时，日期不匹配跳到下一天零点。
- **📊 预期收益**：缩短无解表达式反馈时间，避免工具页主线程被同步计算卡住。
- **🔗 相关建议引用**：[P-16](../performance-bottlenecks.md#p-16-cron-无解表达式会在主线程同步扫描两年分钟粒度)

## 📌 MR-CORE-02: UUID 生成器的弱随机 fallback 需要明确降级语义

- **📍 位置**：`js/tools-core.js:204-228`, `tests/tools.test.mjs:236-258`
- **📝 当前状况描述**：UUID 主路径优先使用 Web Crypto，但 crypto 不可用时仍用 `Math.random()` 生成符合格式的 UUID。格式正确不等于随机强度足够，当前 UI 和测试没有把这一区别暴露给用户。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```javascript
  if (!filled) {
    return fail("缺少安全随机数能力", "uuidCrypto");
  }
  ```
  如果兼容旧环境更重要，则输出结果旁增加“非安全随机”状态，并禁止把它作为安全 token 的示例。
- **📊 预期收益**：减少安全场景误用，保持密码生成器和 UUID 生成器的随机数策略一致。
- **🔗 相关建议引用**：[S-15](../security-audit.md#s-15-uuid-工具在-web-crypto-不可用时退化到-mathrandom), [TD-12](../tech-debt.md#td-12-随机数能力边界需要产品和测试共同收敛)

## 📌 MR-CORE-03: 随机数工具应标注非加密用途

- **📍 位置**：`js/tools-core.js:1275-1293`, `src/templates/tools.mjs:650-705`
- **📝 当前状况描述**：随机数生成器使用 `Math.random()`，适合抽样、演示和轻量随机选择；但如果用户把它理解成安全随机，可能会用于抽奖防刷、验证码或 token 场景。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```text
  随机数工具提示：使用浏览器普通伪随机数，适合演示和抽样；安全 token 请使用密码生成器。
  ```
  也可以增加一个“安全随机整数”模式，在 Web Crypto 可用时通过 `crypto.getRandomValues()` 生成。
- **📊 预期收益**：降低误用成本，同时给高级用户清晰的能力升级路径。
- **🔗 相关建议引用**：[TD-12](../tech-debt.md#td-12-随机数能力边界需要产品和测试共同收敛)

## 📌 MR-CORE-04: 轻量 YAML 转换器需要明确支持范围

- **📍 位置**：`js/tools-core.js:1056-1100`, `src/templates/tools.mjs:560-620`
- **📝 当前状况描述**：YAML 解析器只支持常见 `key: value` 和 `- value` 片段，这对工具箱轻量转换是合理的，但 UI 若未说明限制，用户可能把嵌套对象、引号、多行字符串和注释解析失败视为 bug。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```text
  支持：简单对象、数组、布尔值、数字、null。
  暂不支持：锚点、多行字符串、复杂嵌套和自定义类型。
  ```
  对复杂 YAML 可提示用户使用专业 parser，或后续按需引入受控依赖。
- **📊 预期收益**：降低工具预期落差，减少“轻量 parser”被当作完整 YAML 引擎维护的压力。
- **🔗 相关建议引用**：[UX-07](../ux-improvements.md#ux-07)

## 📌 MR-CORE-05: 现有输入上限值得保留为工具核心契约

- **📍 位置**：`js/tools-core.js:436-470`, `js/tools-core.js:772-851`, `js/tools-core.js:1127-1265`, `js/tools-core.js:1320-1348`
- **📝 当前状况描述**：工具核心已经对密码长度、正则输入、diff 行数、二维码长度、JSONPath 等高风险输入做了限制。这些限制是工具页稳定性的基础，但目前主要散落在实现中，缺少一份“工具核心输入预算”说明。
- **⚠️ 影响程度**：低
- **💡 建议方案**：
  ```text
  docs/suggestions/module-reviews/tools-core.md 维护输入预算：
  - Regex input <= 20,000 chars
  - Diff lines <= 2,000
  - QR text <= 1,000 chars
  - Random count <= 1,000
  ```
  后续新增工具时先声明预算，再写实现和测试。
- **📊 预期收益**：让工具箱继续扩张时保持可预测的性能和错误反馈，不把边界限制藏在代码细节里。
- **🔗 相关建议引用**：[P-16](../performance-bottlenecks.md#p-16-cron-无解表达式会在主线程同步扫描两年分钟粒度), [DE-13](../devex-improvements.md#de-13-为-ai-助手和-cron-边界行为补充回归测试)
