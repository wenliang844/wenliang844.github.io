---
title: "企顾 SaaS 多模块平台项目介绍"
titleEn: "Qigu SaaS Multi-Module Platform Project Overview"
shortTitle: "企顾 SaaS 多模块平台"
shortTitleEn: "Qigu SaaS Platform"
slug: "finance-saas-backend"
date: 2023-08-18
eyebrow: "SaaS Backend"
summary: "围绕客户数据资产、财税报表处理、通知触达和搜索检索，复盘企业服务 SaaS 多模块后端平台建设。"
summaryEn: "A backend platform retrospective covering customer data assets, finance reports, notification delivery and search for enterprise-service SaaS."
description: "企顾 SaaS 中客户数据、财税报表、通知中心和 Elasticsearch 搜索能力的多模块后端实践。"
descriptionEn: "Multi-module backend practice for customer data, finance reports, notification center and Elasticsearch search in Qigu SaaS."
cover: "/images/posts/finance-saas-backend.png"
tags: [Java, Spring Boot, Dubbo, RocketMQ, Elasticsearch]
tagsEn: [Java, Spring Boot, Dubbo, RocketMQ, Elasticsearch]
---

## 1. 项目概述

企顾 SaaS 多模块平台面向企业服务场景，围绕「客户数据资产、财税报表处理、通知触达、搜索检索」四类高频能力构建统一的业务中台。项目采用 Java 8 + Spring Boot 2.4.1 技术体系，并结合 Dubbo、RocketMQ、Redis/Redisson、JetCache、Elasticsearch、MyBatis、Druid、Nacos 等组件，形成可独立演进、可复用、可扩展的多模块微服务架构。

从代码结构看，项目由 4 个主项目、26 个 Maven POM、22+ 个业务/能力子模块组成，覆盖 API、实现、Starter、Runtime、SDK、DAO、Web、Export SDK 等不同层次。仓库中共有 1,362 个 Java 文件，其中通知中心与报表模块占比最高，体现出平台在业务编排、异步处理、缓存一致性、导出性能和三方集成方面的工程复杂度。

核心模块包括：

| 主项目 | 子模块数量 | Java 文件数 | 定位 |
| --- | ---: | ---: | --- |
| `qiangu-ftm-statement` | 4 | 614 | 财税报表、账套报表计算、Excel 导入导出、报表缓存、MQ 异步重算 |
| `qiangu-saas-notice` | 9 | 649 | 通知中心、短信、邮件、站内信、App Push、微信公众号、外呼、语音识别 |
| `qiangu-saas-galaxy` | 6 | 31 | 企业客户数据、工商画像、客户基础信息管理 |
| `qiangu-saas-search` | 3 | 68 | Elasticsearch 搜索 SDK、索引构建、查询封装、Spring Boot Starter |

## 2. 业务价值

该项目不是单一业务应用，而是支撑 SaaS 产品矩阵的「基础能力平台」。它将客户数据、通知触达、报表计算和搜索能力抽象成可复用服务，降低上层业务系统重复建设成本，并提升多租户 SaaS 场景下的交付效率。

### 2.1 客户数据资产沉淀

`qiangu-saas-galaxy` 负责企业客户信息与工商画像管理，初始化表结构覆盖 13 类企业数据主题，包括企业基本信息、股东、主要人员、商标、专利、软件著作权、作品著作权、经营异常、变更记录、联系人、ICP备案、对外投资、资质备案等。

这些数据支撑了客户识别、销售线索挖掘、风险判断、客户分层、工商信息查询等场景。表结构中围绕 `company_id`、`company_num`、`reg_num`、`tel` 等字段建立索引，说明系统针对企业维度查询、联系人检索和画像聚合做了查询路径设计。

### 2.2 财税报表自动化

`qiangu-ftm-statement` 承担财税报表域能力，覆盖余额表、明细账、总账、辅助余额表、辅助明细账、利润表、现金流量表、三表合一、期初余额导入结果等 10 类导出/处理类型。

业务价值主要体现在：

- 将凭证、科目、账期、账套、辅助核算等数据变化转化为自动化报表重算流程。
- 支持多种财务软件格式的导入解析，如金蝶、用友、柠檬云、云账房、新中大等，降低客户迁移与初始化成本。
- 支持单 Sheet、多 Sheet、文件流、异步文件路径等多种导出方式，满足页面下载、后台任务、批量归档等场景。
- 通过缓存、消息队列和分布式锁保障报表计算结果的正确性与性能。

### 2.3 全渠道通知触达

`qiangu-saas-notice` 将短信、邮件、站内信、App Push、微信公众号模板消息、外呼、语音识别封装为统一通知中心。业务系统不需要直接对接各类三方通道，只需要通过通知中心 API 或 MQ 事件发起触达。

通知中心的业务收益包括：

- 多渠道统一接入，减少业务系统重复对接成本。
- 支持模板化消息、人工发送记录、站内信广播、待办通知等业务形态。
- 微信公众号模板消息支持批量发送，并与站内信联动，提升触达成功率。
- 外呼模块兼容多个外呼供应商，并提供坐席状态、通话记录、录音转存、回调幂等等完整闭环。

### 2.4 搜索能力平台化

`qiangu-saas-search` 将 Elasticsearch 的索引、查询、聚合、别名、模板、分词、批量写入等能力封装为 `search-api`、`search-core` 和 `spring-boot-starter-search`。业务模块可以通过 Starter 自动装配 `ESClient`、`Searcher`、`Indexer`，不用重复处理 ES 连接、节点探活、响应反序列化和异常封装。

## 3. 技术架构

项目采用典型的多模块分层架构：

```text
API / SDK 层
  - gaia-notice-api
  - ftm-statement-api
  - ftm-statement-export-sdk
  - search-api
  - saas-galaxy-api

实现层
  - gaia-notice-implement
  - ftm-statement-implement
  - search-core
  - saas-galaxy-server

接入层 / Runtime 层
  - gaia-notice-starter
  - ftm-statement-runtime
  - saas-galaxy-runtime
  - saas-galaxy-web
  - spring-boot-starter-search

基础与三方集成层
  - saas-platform-common
  - sass-platform-call
  - sass-platform-call-sdk
  - sass-platform-wechat
  - saas-platform-speech
```

整体上，系统通过 API 模块定义稳定契约，通过 Implement/Server 模块承载业务逻辑，通过 Starter/Runtime 模块完成运行时装配，通过 SDK 模块对外复用能力。这种拆分方式适合 SaaS 多业务线共用能力沉淀，也便于灰度升级和独立部署。

## 4. 技术深度

### 4.1 微服务与服务治理实践

项目中 `saas-galaxy-server`、`saas-galaxy-web` 启用了 `@EnableDiscoveryClient` 与 `@EnableDubbo`，并通过 Nacos/Consul 相关配置承接服务注册发现。Galaxy 的 API 自动配置模块引入 Dubbo Consumer AutoConfiguration，使调用方可以通过依赖 API + AutoConfigure 的方式接入远程服务。

通知中心和报表中心则通过 API、Starter、SDK 的组合实现能力开放：

- API 模块定义跨服务调用契约，降低调用方对实现细节的依赖。
- Starter 模块负责自动装配，减少接入方配置成本。
- SDK 模块沉淀外呼状态、报表导出等可复用能力。
- Runtime 模块提供独立运行入口，支持单独部署与本地调试。
