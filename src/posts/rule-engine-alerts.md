---
title: "规则引擎与告警闭环：让分析结果变成可解释事件"
titleEn: "Rule Engine and Alert Loop: Turning Analysis Results into Explainable Events"
shortTitle: "规则引擎与告警闭环"
shortTitleEn: "Rule Engine and Alert Loop"
slug: "rule-engine-alerts"
date: 2026-05-28
eyebrow: "Runtime Design"
summary: "把算法输出组织成规则运行时上下文，支持窗口聚合、事实时间线和统一告警创建。"
summaryEn: "Organizing algorithm output into rule-runtime context, with window aggregation, fact timelines and unified alert creation."
description: "规则引擎如何把算法分析结果转换成可解释、可追踪的业务告警。"
descriptionEn: "How a rule engine turns algorithm analysis results into explainable, traceable business alerts."
tags: [规则引擎, 告警系统, Redis, MySQL]
tagsEn: [Rule engine, Alert system, Redis, MySQL]
contentEn: |
  Algorithm results only describe "what was seen"; the rule engine has to answer whether the event is worth notifying the business about. The core work on the rule pipeline this year was turning standard analysis results into runtime context that can be judged, traced and explained.

  ## Design Ideas

  <ul class="insight-list">
  <li><strong>Fact timeline:</strong> Organize facts by point, algorithm, target and time, so continuous hits, interval hits and missing conditions can all be represented.</li>
  <li><strong>Window aggregation:</strong> Process multiple recognition results in a short time window on the rule side, reducing duplicate alerts while preserving the evidence chain that still matters.</li>
  <li><strong>Unified entry point:</strong> Consolidate alert creation for in-house algorithms, Hikvision events and third-party integrations, so queries, statistics and exports share the same business definition.</li>
  <li><strong>Compatibility fallback:</strong> Keep the old fact pipeline available during migration, allowing old and new rules to switch gradually.</li>
  </ul>

  I prefer to think of the rule engine as a business interpretation layer. It should not only run expressions; it should also explain why a rule matched, what matched, and which business domain should handle the follow-up.
---
算法结果本身只是“看见了什么”，规则引擎要回答的是“这件事是否值得通知业务”。今年在规则链路上做的核心工作，就是把标准分析结果转换为可判断、可追踪、可解释的运行时上下文。

## 设计思路

<ul class="insight-list">
<li><strong>事实时间线：</strong>按点位、算法、目标和时间组织事实，让连续命中、间隔命中和缺失判断都能被表达。</li>
<li><strong>窗口聚合：</strong>在规则侧处理短时间内的多次识别结果，减少重复告警，也保留必要的证据链。</li>
<li><strong>入口收口：</strong>统一自研算法、海康事件和第三方接入的告警创建流程，让查询、统计、导出共享同一套业务口径。</li>
<li><strong>兼容兜底：</strong>旧事实链路在迁移期继续可用，保证新旧规则能逐步切换。</li>
</ul>

我更喜欢把规则引擎看成“业务解释层”，它不能只会跑表达式，还要能说明为什么命中、命中了什么、后续由哪个业务域接住。
