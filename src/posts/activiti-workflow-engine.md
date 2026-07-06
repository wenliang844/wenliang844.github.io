---
title: "Terminus Activiti：面向业务流程数字化的轻量级 BPM 引擎实践"
titleEn: "Terminus Activiti: Lightweight BPM Engine Practice for Digital Business Processes"
shortTitle: "Activiti BPM 引擎实践"
shortTitleEn: "Activiti BPM Engine Practice"
slug: "activiti-workflow-engine"
date: 2022-02-09
modified: 2026-07-04
status: historical
reviewed: 2026-07-04
contextNote: "本文是历史项目复盘，流程引擎背景和维护状态已按 2026 年视角复核。"
contextNoteEn: "This is a historical project retrospective; the workflow-engine context and maintenance status were reviewed from a 2026 perspective."
eyebrow: "Workflow"
summary: "围绕 Activiti 7、BPMN 2.0、运行时 API 和 Spring Boot 自动装配，梳理企业审批流与流程基础设施的工程实践。"
summaryEn: "Engineering notes on enterprise workflow infrastructure around Activiti 7, BPMN 2.0, runtime APIs and Spring Boot auto-configuration."
description: "基于 Activiti 7 的企业级工作流与 BPM 流程引擎实践。"
descriptionEn: "Enterprise workflow and BPM engine practice based on Activiti 7."
cover: "/images/posts/activiti-workflow-engine.png"
tags: [Java, Spring Boot, Activiti 7, BPMN 2.0, 工作流]
tagsEn: [Java, Spring Boot, Activiti 7, BPMN 2.0, Workflow]
---

## 项目概述

Terminus Activiti 是一个基于 Activiti 7.1.0-SNAPSHOT 的企业级工作流与 BPM（Business Process Management）项目。项目以 BPMN 2.0 流程引擎为核心，围绕流程定义、流程实例、人工任务、变量管理、事件监听、异步作业、连接器扩展和 Spring Boot 自动装配构建了一套可嵌入业务系统、可扩展到微服务架构的流程基础设施。

从业务视角看，它解决的是企业系统中大量“状态流转 + 人工审批 + 系统协同 + 过程留痕”的通用问题，例如审批流、订单履约、内容审核、工单处理、任务协同、跨系统回调等。传统做法往往把流程逻辑硬编码在业务服务中，后续规则变更需要频繁发版；本项目通过 BPMN 建模和统一 Runtime API，把流程从业务代码中剥离出来，使业务人员、开发人员和系统管理员可以围绕同一套流程模型协作。

## 业务价值

### 1. 流程标准化：把“隐式代码逻辑”变成“显式流程资产”

项目支持以 BPMN 2.0 描述业务流程，并通过 `ProcessRuntime`、`TaskRuntime` 暴露流程启动、挂起、恢复、删除、任务认领、任务完成、变量读写等能力。业务系统不再需要在多个服务中重复维护状态机，而是把流程节点、网关、人工任务、服务任务、消息事件、信号事件等统一沉淀为流程资产。

带来的直接收益是：

- 流程规则可视化，业务沟通成本降低。
- 流程变更集中在 BPMN 定义和扩展 JSON 中，减少业务代码侵入。
- 流程实例、任务、变量、事件具备统一查询与审计基础。
- 人工任务和系统任务边界清晰，便于跨团队协作。

### 2. 复用统一流程底座，降低多业务线接入成本

项目将流程运行能力拆分为 API 层、引擎层、Spring 集成层和 examples 示例层。业务服务只需要接入统一的 Runtime API，就可以获得流程定义部署、流程实例管理、任务生命周期管理、变量管理和事件订阅能力。

这种模式适合平台化复用：一个流程底座可以支撑多个业务域，业务域只关注自己的流程模型、连接器实现和权限策略，而不必重复建设流程引擎、任务中心、异步作业调度、流程事件分发等基础能力。

### 3. 支撑业务扩展：Connector 把流程节点与外部服务解耦

项目提供 `activiti-spring-connector` 和 `activiti-connector-model` 模块，用连接器定义外部动作、输入输出变量和服务任务绑定关系。流程模型中的服务任务可以通过 connector 连接到业务服务、规则服务、通知服务、内容处理服务等外部能力。

这使流程引擎不必了解每个业务服务的内部实现，业务服务也不必侵入流程内核。流程与业务服务通过契约协作，更适合微服务架构下的独立开发、独立演进和灰度替换。

## 技术架构

项目采用 Maven 多模块工程，整体分层如下：

| 层级 | 代表模块 | 作用 |
| --- | --- | --- |
| API 层 | `activiti-api-process-runtime`、`activiti-api-task-runtime` | 定义流程与任务运行时 API，屏蔽引擎内部复杂度 |
| 核心引擎层 | `activiti-engine`、`activiti-bpmn-model`、`activiti-bpmn-converter`、`activiti-process-validation` | 负责 BPMN 解析、流程执行、任务调度、持久化、校验和事件分发 |
| Spring 集成层 | `activiti-spring`、`activiti-spring-boot-starter`、`activiti-spring-process-extensions` | 提供 Spring Boot 自动装配、事务集成、资源发现和扩展变量映射 |
| 公共能力层 | `activiti-spring-security-policies`、`activiti-spring-connector`、`activiti-expression-language` | 提供权限策略、连接器、表达式语言等通用能力 |
| 示例与验证层 | `activiti-examples`、`activiti-spring-conformance-tests` | 提供 ProcessRuntime、TaskRuntime、Connector、Spring Integration 等接入样例与一致性测试 |

从工程规模看，项目包含 6 个顶层 Maven 模块，进一步拆分为 66 个 Maven POM，代码和测试资源覆盖流程引擎的核心路径：

| 指标 | 数量 |
| --- | ---: |
| 仓库文件总数 | 4,873 |
| Java 文件 | 2,836 |
| 测试 Java 文件 | 801 |
| Maven POM | 66 |
| BPMN 流程资源 | 1,227 |
| 流程扩展 JSON | 59 |
| 缓存匹配器 | 30 |

这些数字说明项目不是单点功能封装，而是一套完整的流程平台内核：既有流程模型、引擎执行、持久化和异步任务，也有面向业务接入的 API、Spring Boot Starter、连接器和测试体系。

## 技术深度

### 1. Runtime API 设计：用稳定契约隔离流程引擎复杂度

项目将业务接入入口收敛到 `ProcessRuntime` 和 `TaskRuntime` 两组接口。

`ProcessRuntime` 负责流程侧能力，包括流程定义查询、流程实例创建与启动、实例挂起与恢复、变量设置、消息接收、信号发送、流程元数据查询等。业务服务通过 payload 对象传参，避免直接依赖底层引擎实体。

`TaskRuntime` 负责人机协同能力，包括任务查询、创建、认领、释放、完成、保存变量、更新、删除、候选人和候选组维护等。接口注释中明确了鉴权语义，例如任务可见性、当前用户是否为 assignee、是否属于候选组等，为业务任务中心提供了清晰边界。

这种 API 设计让流程引擎可以在内部调整持久化、缓存、异步执行策略，而不影响上层业务服务。

### 2. 缓存设计：命令执行期实体缓存 + 查询匹配器

项目的缓存设计不是简单的外部 KV 缓存，而是流程引擎内部的一致性缓存。`EntityCache` 在一次 `Command` 执行期间保存实体快照，按实体类型和实体 ID 建立内存索引，并记录实体持久化状态，用于后续差异判断和数据库 flush。

核心设计包括：

- `EntityCacheImpl` 使用 `Map<Class<?>, Map<String, CachedEntity>>` 管理不同类型的流程实体。
- `AbstractDataManager.findById` 优先从缓存读取，未命中再访问数据库。
- `AbstractDataManager.getList` 会先查数据库，再用缓存中的新版本实体覆盖数据库结果，保证同一命令上下文内读到最新状态。
- 对已标记删除的实体进行过滤，避免出现“同一事务中已删除但查询又返回”的一致性问题。
- `cachematcher` 包下提供 30 个匹配器，覆盖执行树、任务、变量、事件订阅、Job、历史变量等高频查询场景。

这套设计的业务价值在于：流程执行过程中经常需要反复读取同一流程实例、执行树、任务、变量和事件订阅。如果每一步都访问数据库，会形成大量短查询。通过命令上下文缓存，项目可以在保证事务内一致性的前提下减少数据库往返，并提升流程推进、任务完成和变量更新的响应效率。

### 3. 性能优化：执行树预取、关系计数与异步作业调度

项目内置 `PerformanceSettings`，提供多项可配置的性能优化开关：

- `enableEagerExecutionTreeFetching`：获取某个 execution 时一次性拉取整棵执行树，减少流程推进时的多次数据库往返。
- `enableExecutionRelationshipCounts`：在 execution 上维护变量、任务、Job、事件订阅等关系计数，删除执行树时减少额外查询。
- `enableLocalization`：在不需要本地化能力时关闭相关逻辑，换取更轻的运行路径。

在异步任务方面，项目提供 `AsyncExecutorProperties` 和 `DefaultAsyncJobExecutor` 配置，包括：

- 默认核心线程数 2，最大线程数 10。
- 默认队列容量 100。
- Job 默认重试 3 次，重试等待 500ms。
- 异步 Job 和 Timer Job 默认每次获取 1 条，以降低乐观锁冲突概率。
- Job 锁默认 5 分钟，过期 Job 每 60 秒扫描一次，默认分页大小 3。
