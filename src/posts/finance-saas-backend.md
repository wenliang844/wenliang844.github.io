---
title: "财税 SaaS 后端实践：报表、搜索与通知中心"
shortTitle: "财税 SaaS 后端实践"
slug: "finance-saas-backend"
date: 2026-04-18
eyebrow: "SaaS Backend"
summary: "围绕财务报表计算、ElasticSearch Starter 和多渠道通知中心，沉淀可复用的业务基础能力。"
description: "财税 SaaS 中财务报表、ElasticSearch Starter 与多渠道通知中心的后端实践。"
tags: [Spring Boot Starter, ElasticSearch, RocketMQ, EasyExcel, CompletableFuture]
---
财税 SaaS 的复杂度不在“接口很多”，而在金额口径、租户隔离、异步处理和外部渠道都要求稳定。后端模块按 API、Implement、Runtime、Starter 分层后，很多通用能力可以从业务代码里抽出来。

## 实践记录

<ul class="insight-list">
<li><strong>财务报表：</strong>基于凭证行、会计期间、科目借贷方向和辅助核算计算科目余额表、利润表、现金流量表，金额统一使用 <code>BigDecimal</code>。</li>
<li><strong>搜索 Starter：</strong>封装索引初始化、Mapping、批量写入、别名切换、scroll 分页、聚合查询和高亮回填，降低业务接入成本。</li>
<li><strong>通知中心：</strong>支持短信、邮件、站内信、App Push 和微信公众号模板消息，多租户上下文与发送结果统一落库。</li>
<li><strong>并发发送：</strong>公众号批量发送前预加载模板和 OpenId 绑定信息，再用 <code>CompletableFuture</code> 和线程池隔离耗时操作。</li>
</ul>

这类系统很适合训练“业务口径优先”的后端思维：先把数据定义对，再谈性能优化和组件复用。
