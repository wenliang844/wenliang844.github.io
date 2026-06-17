# Activiti 工作流平台简历项目经历

## 使用口径

这个项目适合包装为“企业流程平台 / 工作流引擎 / 平台服务 / 审批任务流转 / Java 后端源码深度项目”。不建议说“从零自研工作流引擎”，更准确的说法是“基于 Activiti 7 做流程平台能力建设、源码级分析、封装和扩展设计”。

可量化结果：

- 66 个 Maven POM，2,836 个 Java 文件，801 个测试 Java 文件。
- 1,227 个 BPMN 资源，59 个扩展 JSON。
- 20 个 Spring Boot 自动装配入口。
- 30 个命令级缓存 matcher。
- 27 个 MyBatis 实体映射 XML，336 个数据库 SQL 脚本。
- 异步执行器默认 core 2、max 10、queue 100、重试 3 次、Job 锁 5 分钟。

不建议写：

- 不写“TPS 提升 xx%”，当前仓库没有压测报告。
- 不写“项目使用 Redis/RocketMQ/Dubbo/Nacos/ES”，当前仓库没有直接接入。
- 不写“完整财税 SaaS 业务系统”，它更像流程平台内核。

## 版本一：Java 后端 / 流程平台

**项目名称**：企业流程引擎平台能力建设（基于 Activiti 7）

**项目描述**：  
项目是面向企业流程数字化的工作流平台内核，基于 BPMN 2.0 提供流程定义部署、流程实例运行、人任务处理、服务任务扩展、变量管理、异步 Job 调度、权限策略和 Spring Boot Starter 接入能力，用于将审批流、工单流、内容审核流等业务流转从业务代码中抽离。

**技术栈**：  
Java 11、Spring Boot 2.6.2、Spring Security、MyBatis 3.5.7、BPMN 2.0、Maven 多模块、H2/MySQL/Postgres/Oracle/MSSQL/DB2/HSQL。

**个人职责**：

- 梳理 `ProcessRuntime`、`TaskRuntime` 运行时 API，封装流程启动、实例查询、任务领取/释放/完成、变量读写等能力。
- 深入分析流程启动链路：`ProcessRuntimeImpl.start -> RuntimeServiceImpl -> StartProcessInstanceCmd -> ProcessInstanceHelper -> Agenda -> ContinueProcessOperation`。
- 梳理 MyBatis 持久化模型和 ACT 表族，包括运行时表、仓库表、历史表和通用表。
- 分析命令级缓存设计，包括 `EntityCacheImpl`、`AbstractDataManager`、30 个 cache matcher 和执行树预取。
- 梳理 Spring Boot Starter 自动装配机制，包括 BPMN 资源扫描、自动部署、异步执行器配置和安全方法配置。

**核心成果**：

- 完成 6 个一级模块、66 个 POM、2,836 个 Java 文件规模的流程平台工程拆解。
- 梳理流程启动、人任务完成、服务任务 Connector、异步 Job、权限策略等核心链路。
- 总结命令级缓存和执行树预取机制，用于降低单次流程推进中的重复查询和状态不一致风险。

## 版本二：平台服务 / 微服务集成

**项目名称**：流程平台服务集成与 Connector 扩展机制

**项目描述**：  
项目通过 Spring Boot Starter 将流程引擎嵌入业务应用，应用只需引入依赖、放置 BPMN 和扩展 JSON，即可获得流程运行、人任务、服务任务和事件监听能力。服务任务通过 Connector 抽象与业务服务解耦，适合在微服务架构中编排外部业务能力。

**技术栈**：  
Java 11、Spring Boot Starter、Spring Security、MyBatis、BPMN、Jackson、Spring ApplicationEvent、Connector SPI。

**个人职责**：

- 梳理 `spring.factories` 自动装配链路，分析 `ProcessEngineAutoConfiguration`、`ProcessRuntimeAutoConfiguration`、`TaskRuntimeAutoConfiguration` 的职责。
- 分析 Connector 机制：BPMN `serviceTask implementation` 映射到 Spring Bean，运行时构造 `IntegrationContext` 并调用 `Connector.apply`。
- 梳理扩展 JSON 输入/输出变量映射，理解 `ExtensionsVariablesMappingProvider` 对变量、常量和表达式的处理。
- 分析 runtime event listener，用于流程完成、变量创建、消息/信号等事件扩展。
- 输出微服务扩展方案：Connector 内部可调用 HTTP/RPC/Dubbo，事件监听器可桥接 MQ，查询侧可同步 ES/Redis read model。

**核心成果**：

- 梳理 20 个 Spring Boot 自动装配入口，明确业务应用低成本接入流程引擎的方式。
- 基于 `RankMovie` 和 Web 示例沉淀“流程编排外部服务 + 变量映射 + 事件监听”的集成模式。
- 明确当前仓库未直接接入 Dubbo/Nacos/MQ/ES/Redis，并给出基于 Connector 和事件机制的扩展设计。

## 版本三：工作流 / 审批系统

**项目名称**：企业审批与任务流转平台

**项目描述**：  
项目基于 Activiti 7 提供审批和任务流转基础能力，支持 BPMN 流程部署、流程启动、人工任务分配、候选人/候选组、任务领取、任务完成、流程变量和流程事件。适用于企业审批、内容审核、工单协同、业务状态流转等场景。

**技术栈**：  
Java、Spring Boot、Spring Security、MyBatis、BPMN 2.0、Activiti Engine。

**个人职责**：

- 梳理人任务生命周期，包括任务查询、创建、领取、释放、完成、删除、候选用户和候选组维护。
- 分析 `TaskRuntimeImpl` 中基于当前登录用户、用户组、assignee、candidate group 的任务可见性控制。
- 梳理流程变量从启动入参、serviceTask 输入、connector 输出到 userTask 完成变量的传递过程。
- 分析 `ProcessSecurityPoliciesManagerImpl`，理解流程定义和流程实例按用户、组、应用名和流程 key 做读写控制。
- 结合 Web 示例梳理 `POST /documents` 启动内容分类流程和 `GET /process-definitions` 查询流程定义的接口链路。

**核心成果**：

- 沉淀标准任务模型，明确 assignee、owner、candidate user、candidate group 的职责区别。
- 梳理审批场景完整链路：发起流程、系统自动判断、人工处理、变量提交、流程结束。
- 基于 1,227 个 BPMN 资源和 59 个扩展 JSON，总结流程模型、扩展配置和运行时 API 的协作方式。

## 版本四：性能优化 / 引擎源码

**项目名称**：Activiti 7 流程引擎性能与可靠性机制分析

**项目描述**：  
项目底层通过 Command、CommandContext、Agenda、EntityCache、MyBatis DataManager、Async Job Executor 等机制执行 BPMN 流程。重点关注复杂流程推进时的事务一致性、执行树查询性能、异步 Job 可靠执行和集群场景下的乐观锁处理。

**技术栈**：  
Java 11、Activiti Engine、MyBatis、Spring Boot、线程池、命令模式、乐观锁、BPMN。

**个人职责**：

- 分析 `CommandInvoker` 和 `DefaultActivitiEngineAgenda`，理解流程节点推进从命令执行到操作队列消费的过程。
- 梳理 `EntityCacheImpl` 和 `AbstractDataManager`，总结命令上下文内缓存读取、DB 查询合并、删除实体过滤策略。
- 分析 `MybatisExecutionDataManager` 的 eager execution tree fetching，理解执行树预取对复杂流程的查询优化价值。
- 梳理 `DefaultAsyncJobExecutor`、`AcquireAsyncJobsDueRunnable`、`ResetExpiredJobsRunnable`，理解异步 Job 获取、执行、锁超时恢复和重试机制。
- 识别潜在优化点，如 Connector Bean 启动时校验、查询分页下推、历史级别配置、缓存空集合处理等。

**核心成果**：

- 总结 30 个 cache matcher 的缓存匹配策略，明确命令级缓存解决的是事务内重复查询和未 flush 数据一致性。
- 梳理异步执行器默认线程池、队列、重试和锁配置，为生产调优提供依据。
- 输出可落地优化建议，避免只停留在功能调用层面。

## 可直接放简历的精简版

### 精简版 A

企业流程引擎平台能力建设：基于 Activiti 7、Spring Boot、MyBatis、Spring Security 和 BPMN 2.0，参与流程运行时 API、任务运行时 API、服务任务 Connector、变量映射、异步 Job、权限策略等能力梳理与封装。深入分析 `ProcessRuntime/TaskRuntime`、Command + Agenda 执行模型、命令级 EntityCache 和 MyBatis DataManager，沉淀流程启动、人任务完成、服务任务调用和异步执行完整链路。项目包含 66 个 Maven POM、2,836 个 Java 文件、801 个测试类、1,227 个 BPMN 资源，支持多数据库脚本和 Spring Boot Starter 快速接入。

### 精简版 B

工作流与审批平台：负责梳理基于 BPMN 的流程部署、流程实例运行、人任务领取/完成、候选人/候选组、流程变量和事件监听能力。通过 `ProcessRuntimeImpl`、`TaskRuntimeImpl`、`ProcessSecurityPoliciesManagerImpl` 实现统一运行时门面和权限收敛；通过 Connector 和扩展 JSON 支持流程节点调用外部服务并完成变量输入输出映射。重点分析命令级缓存、执行树预取和异步 Job 调度机制，提升复杂流程执行的可维护性和可靠性。

### 精简版 C

流程平台性能与扩展机制：深入分析 Activiti 7 引擎源码中的 Command、CommandContext、Agenda、EntityCache、MyBatis DataManager 和 AsyncExecutor 设计。总结 30 个缓存 matcher、27 个 MyBatis 实体映射、336 个数据库脚本和默认异步线程池配置，明确流程引擎在事务内一致性缓存、执行树预取、Job 锁定/重试/过期恢复、多租户异步执行方面的实现方式，并输出查询分页、Connector 启动校验、事件桥接 MQ/ES 等优化方案。

## 面试口径

当面试官问“你具体负责什么”时：

> 我主要围绕流程运行时和任务运行时做源码级分析和平台能力梳理，重点看过流程启动、任务完成、Connector 服务任务、变量映射、权限策略、命令级缓存和异步 Job。因为这是流程平台内核，我做的不是简单 CRUD，而是理解和沉淀平台能力。

当面试官问“有没有性能结果”时：

> 当前仓库没有线上压测报告，所以不建议写虚假的 TPS 提升。能量化的是工程规模和优化机制：30 个 cache matcher、执行树预取配置、默认异步线程池和 Job 锁恢复机制。性能优化重点是减少单次流程推进中的重复查询、控制异步 Job 获取和队列压力，以及通过查询侧 read model 承接复杂搜索。
