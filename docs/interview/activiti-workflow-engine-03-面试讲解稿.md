# Activiti 工作流平台面试讲解稿

## 3 分钟版本

面试官您好，我这个项目是一个基于 Activiti 7 的企业流程引擎平台。它不是普通的业务 CRUD 系统，而是提供流程定义部署、流程实例运行、人任务处理、服务任务扩展、变量管理、异步 Job 和权限控制等基础能力，主要解决企业审批流、工单流、内容审核流这类业务流程容易写死在代码里的问题。

技术栈上，项目使用 Java 11、Spring Boot 2.6.2、Spring Security、MyBatis 3.5.7、BPMN 2.0 和 Maven 多模块。整个仓库有 4,874 个文件、2,836 个 Java 文件、801 个测试类、66 个 POM、1,227 个 BPMN 资源、59 个扩展 JSON、30 个缓存 matcher 和 336 个数据库脚本。

项目对业务应用最重要的是两个运行时门面：`ProcessRuntime` 和 `TaskRuntime`。`ProcessRuntime` 负责流程定义查询、流程启动、流程实例管理、变量读写、信号和消息；`TaskRuntime` 负责任务查询、领取、释放、完成、候选人和候选组。业务系统不直接调用底层 `RuntimeService` 和 `TaskService`，而是通过这两个 API 统一接入。

我重点梳理了流程启动链路。一次流程启动会先进入 `ProcessRuntimeImpl.start`，做流程定义、权限和变量校验，然后通过 `RuntimeService` 进入 `CommandExecutor`，执行 `StartProcessInstanceCmd`。命令内部创建流程实例、执行实体和变量，再把流程推进动作放进 Agenda，由 `CommandInvoker` 消费 Agenda，最终执行 BPMN 节点行为。这个设计让事务边界、缓存生命周期和异步任务处理都比较清楚。

性能方面，这个项目没有直接用 Redis 缓存流程状态，而是用了命令级实体缓存。`EntityCacheImpl` 在一次 Command 内缓存实体，`AbstractDataManager` 查询时会先查缓存，再查数据库，并把缓存中的新增、更新、删除状态和 DB 结果合并。对于流程引擎这种事务内读写交错很频繁的场景，这种缓存比跨请求缓存更关键。

扩展方面，项目通过 Spring Boot Starter 自动装配流程引擎，应用启动时扫描 `classpath*:**/processes/` 下的 BPMN 资源并自动部署。服务任务通过 Connector 机制集成业务能力，BPMN 的 `serviceTask implementation` 会映射到 Spring Bean，运行时构造 `IntegrationContext` 调用 `Connector.apply`，再把输出变量写回流程。当前仓库没有直接接入 Dubbo、Nacos、MQ、Redis 或 ES，但 Connector 和事件监听器是很自然的扩展点。

可靠性上，项目有异步 Job 执行器，默认线程池 core 是 2、max 是 10、队列 100、重试 3 次、Job 锁 5 分钟，并且有过期 Job 重置线程。权限上，运行时 API 有 `ACTIVITI_USER` 角色控制，流程定义和流程实例还能按用户、组、应用名和流程 key 做读写策略限制。整体来说，这个项目让我比较系统地理解了一个流程平台从 API 门面、引擎执行、持久化、缓存、异步到扩展机制的完整设计。

## 5 分钟版本

我介绍一下这个项目。它是一个基于 Activiti 7 的企业流程平台内核，定位是把审批、工单、内容审核、业务状态流转这类流程从业务系统中抽出来，用 BPMN 2.0 模型来描述。这样流程变更时，业务代码不需要到处改状态机，只需要调整流程定义、变量映射和服务任务配置。

工程结构上，它是 Maven 多模块工程，根模块下面主要有 `activiti-api`、`activiti-core-common`、`activiti-core`、`activiti-dependencies`、`activiti-examples`。`activiti-api` 定义对外模型和运行时接口，`activiti-core` 包含 BPMN 模型、转换、校验、引擎、Spring 集成和 Starter，`activiti-core-common` 提供安全、身份、连接器、资源发现和表达式能力，`activiti-examples` 提供流程、人任务、连接器和 Web 示例。

从架构上看，业务应用不会直接操作底层引擎，而是通过两个 runtime API：`ProcessRuntime` 和 `TaskRuntime`。`ProcessRuntime` 负责流程定义查询、启动流程、流程实例管理、变量管理、消息和信号；`TaskRuntime` 负责任务查询、创建、领取、释放、完成、候选人、候选组和任务变量。实现层的 `ProcessRuntimeImpl` 和 `TaskRuntimeImpl` 会做权限、用户上下文、变量校验、模型转换和事件发布。

我重点梳理了流程启动链路。业务调用 `ProcessRuntimeImpl.start` 后，会先检查流程定义是否属于最新部署、用户是否有写权限、变量是否符合扩展 JSON 中的定义。然后它通过 `RuntimeService.createProcessInstanceBuilder` 进入底层引擎。真正执行时，`RuntimeServiceImpl` 会把请求封装成 `StartProcessInstanceCmd` 交给 `CommandExecutor`。命令在 `CommandContext` 中运行，创建 `ExecutionEntity`、流程变量和历史记录，然后调用 `commandContext.getAgenda().planContinueProcessOperation(execution)`。后续由 `CommandInvoker` 循环消费 Agenda，执行 `ContinueProcessOperation`，再调用对应 BPMN 节点的 `ActivityBehavior`。

这个 Command + Agenda 模型是我觉得最值得讲的点。它不是简单递归执行流程节点，而是把流程推进拆成命令和操作队列。这样事务边界、异常处理、缓存生命周期都统一在 CommandContext 里；遇到异步节点时，也可以创建 Job 交给异步执行器，而不是在当前线程一直跑到底。

人任务链路也比较完整。`TaskRuntime.tasks()` 默认根据当前登录用户和用户组过滤，只返回用户是 assignee 或所在组是 candidate group 的任务。`claim()` 要求任务可见且未被领取，`complete()` 要求任务已经分配给当前用户，`assign()` 要求当前用户是 assignee 且新 assignee 是候选用户。这个设计避免业务侧自己到处写任务权限判断。

性能方面，项目的核心不是 Redis 缓存，而是命令级 `EntityCache`。`EntityCacheImpl` 用 `Map<Class<?>, Map<String, CachedEntity>>` 保存一次命令中的实体。`AbstractDataManager.findById` 会先从缓存查实体，没有再查 DB；列表查询会先查 DB，再把缓存中的新版本实体覆盖 DB 版本，并过滤当前会话已经标记删除的实体。`MybatisExecutionDataManager` 还支持 eager execution tree fetching，可以一次拉取同一个 root process instance 下的执行树，减少复杂流程中的多次查询。

扩展机制上，项目通过 Spring Boot Starter 做自动装配。`spring.factories` 注册 `ProcessEngineAutoConfiguration`、`ProcessRuntimeAutoConfiguration`、`TaskRuntimeAutoConfiguration` 等配置类。应用启动时可以自动扫描 BPMN 和扩展 JSON，创建 `SpringProcessEngineConfiguration`，配置数据源、事务管理器、异步执行器、数据库更新策略、历史级别和部署资源。

微服务集成主要靠 Connector。比如 `RankMovie` 示例里，BPMN 的 serviceTask implementation 是 `Movies.getMovieDesc`，Spring 里有一个 `@Bean("Movies.getMovieDesc") Connector`。执行到这个节点时，`DefaultServiceTaskBehavior` 会通过 Spring 容器拿到这个 Bean，`IntegrationContextBuilder` 会把流程实例 ID、流程定义 key/version、businessKey、executionId、connectorType 和输入变量放进 `IntegrationContext`，然后调用 `Connector.apply`，最后把输出变量传播回流程。这个点很适合接外部业务服务，比如 HTTP、RPC 或 Dubbo。不过当前仓库没有直接接入 Dubbo、Nacos、RocketMQ、Redis、Elasticsearch、Trantor，只是具备扩展点。

可靠性上，异步执行器默认 corePoolSize 是 2，maxPoolSize 是 10，queueSize 是 100，重试 3 次，Job 锁 5 分钟，过期 Job 每 60 秒扫描一次。`AcquireAsyncJobsDueRunnable` 周期性获取到期 Job，`ResetExpiredJobsRunnable` 负责把过期锁的 Job 恢复为可执行状态。集群里多个执行器抢 Job 可能有乐观锁异常，代码中把它当成预期行为处理。

如果让我总结这个项目的价值，就是它把业务流程从代码状态机中抽象出来，用平台方式提供流程建模、运行、任务、变量、服务集成、权限和异步执行能力。我在里面重点掌握的是运行时 API、命令执行模型、缓存设计、异步 Job 和 Connector 扩展，这些都是 Java 后端做平台型系统很有代表性的能力。

## 10 分钟版本

这个项目是基于 Activiti 7 的轻量级工作流和 BPM 平台内核，定位是企业流程数字化的基础设施。它解决的问题是，很多业务系统里审批流、工单流、内容审核流、订单状态流转会散落在业务代码里，后续流程调整时需要改很多 if else、状态枚举和任务分配逻辑。这个项目通过 BPMN 2.0 把流程抽象为模型，通过运行时 API 承载流程实例和任务生命周期，通过 Connector 把流程节点和业务服务打通。

从工程结构上看，它是 Maven 多模块工程。`activiti-api` 是对外 API 和模型定义；`activiti-core` 是核心，包括 BPMN model、BPMN converter、流程校验、图像生成、JSON 转换、引擎、Spring 集成、Spring Boot Starter、流程扩展；`activiti-core-common` 放身份、安全、Connector、资源发现、应用模型、表达式语言；`activiti-examples` 提供流程、人任务、Connector、Web 和 Spring Integration 示例。

技术栈上，项目使用 Java 11、Spring Boot 2.6.2、Spring Security、MyBatis 3.5.7、BPMN 2.0、Jackson、H2/MySQL/Postgres/Oracle/MSSQL/DB2/HSQL 数据库脚本和 JUnit 测试。从代码规模上看，仓库有 4,874 个文件，2,836 个 Java 文件，801 个测试类，66 个 POM，1,227 个 BPMN 资源，59 个扩展 JSON，20 个 Spring factories，30 个缓存 matcher，27 个 MyBatis 实体 XML，336 个 SQL 脚本。

架构上，我把它分为五层。第一层是业务应用层，比如 Web Controller 或 CommandLineRunner 示例。第二层是 API 门面层，核心是 `ProcessRuntime` 和 `TaskRuntime`。第三层是 runtime impl，负责权限、变量校验、模型转换和事件发布。第四层是引擎服务层，包括 `RuntimeService`、`TaskService`、`RepositoryService`，再往下是 `CommandExecutor`、`CommandContext` 和 Agenda。第五层是持久化和扩展层，包括 MyBatis DataManager、ACT 表、Async Job、Connector 和 Spring ApplicationEvent。

流程启动时，业务应用调用 `ProcessRuntime.start`，实际进入 `ProcessRuntimeImpl.start`。这里会检查流程定义是否存在且属于最新部署，检查安全策略里当前用户是否可以写这个流程 key，检查启动变量是否符合扩展 JSON 中的变量定义。然后通过 `RuntimeService.createProcessInstanceBuilder` 构造流程实例 builder。底层 `RuntimeServiceImpl` 不直接执行所有逻辑，而是封装成 `StartProcessInstanceCmd`，交给 `CommandExecutor.execute`。

`StartProcessInstanceCmd` 在 `CommandContext` 里执行，通过 `DeploymentManager` 和 `ProcessDefinitionRetriever` 找到流程定义，通过 `ProcessInstanceHelper` 创建流程实例。这里会创建 `ExecutionEntity`，设置 businessKey、processDefinitionId、rootProcessInstanceId、变量和历史记录。创建完成后，它调用 `commandContext.getAgenda().planContinueProcessOperation(execution)` 把继续执行流程的动作放进 Agenda。

`CommandInvoker` 会循环执行 `while (!commandContext.getAgenda().isEmpty())`，每次取出一个 operation 执行。`ContinueProcessOperation` 会根据当前 FlowNode 判断同步或异步。如果是同步节点，就拿到节点的 `ActivityBehavior` 并执行；如果是异步节点，就创建 Job，后续由异步执行器处理。这个模型让流程推进被拆成统一的操作队列，事务、缓存、异常和异步边界都比较清晰。

任务链路是另一个重点。`TaskRuntime` 提供任务查询、领取、释放、完成、删除、候选人和候选组。`TaskRuntimeImpl.tasks()` 会取当前认证用户和用户组，把 assignee 和 candidate group 条件带入查询。`claim()` 会检查任务可见且未分配，`complete()` 会检查任务已经分配给当前用户，`assign()` 会先检查当前用户是 assignee，再检查新 assignee 是候选用户，然后释放并重新 claim。

持久化层使用 MyBatis。映射 XML 在 `activiti-engine/src/main/resources/org/activiti/db/mapping/entity` 下，包括 `Execution.xml`、`Task.xml`、`VariableInstance.xml`、`Job.xml`、`Deployment.xml`、`ProcessDefinition.xml`、历史实体等。表结构按职责分为 `ACT_RU_*` 运行时表、`ACT_RE_*` 仓库表、`ACT_HI_*` 历史表、`ACT_GE_*` 通用表和 `ACT_EVT_LOG` 事件日志。数据库脚本覆盖多个数据库，并包含升级脚本。

性能优化方面，我最关注命令级缓存和执行树预取。`EntityCacheImpl` 是一次 Command 内的缓存，结构是 `Map<Class<?>, Map<String, CachedEntity>>`。`AbstractDataManager.findById` 先从缓存查实体，没有再查 DB。列表查询时，它会先执行 DB 查询，然后扫描缓存，把缓存中匹配条件的实体合并进去，如果同一个 ID 在 DB 和缓存都有，以缓存的新版本覆盖 DB 版本，最后过滤当前会话中已经标记删除的实体。

为什么这对流程引擎重要？因为一次流程推进会频繁读写 execution tree、task、variable、job、event subscription。很多实体可能已经在当前命令里创建或修改，但还没 flush 到 DB。如果只查数据库，会看不到未提交状态；如果每次都查 DB，又会造成重复查询。命令级缓存解决的是事务内一致性和重复查询问题。仓库里有 30 个 cache matcher，分别处理不同条件查询缓存实体。

`MybatisExecutionDataManager` 还有 `enableEagerExecutionTreeFetching` 配置。开启后，查某个 execution 时可以一次取同 root process instance 下的执行树并放入缓存。复杂流程里，网关、子流程、多实例、边界事件经常要反复查执行树，这个优化可以减少多次数据库往返。

异步可靠性方面，`AsyncExecutorProperties` 给了默认配置：核心线程数 2、最大线程数 10、队列 100、重试 3 次、异步 Job 和定时 Job 锁 5 分钟、过期 Job 每 60 秒扫描一次、过期恢复页大小 3。`AcquireAsyncJobsDueRunnable` 通过 `AcquireJobsCmd` 获取到期 Job，如果获取数量达到上限，就立刻继续获取；如果线程池队列满，就按配置等待。`ResetExpiredJobsRunnable` 会找出锁过期的 Job，执行 `ResetExpiredJobsCmd` 恢复它们。集群里多个节点同时抢 Job 可能出现乐观锁异常，代码里把它作为正常竞争处理。

扩展机制上，Spring Boot Starter 是业务接入入口。`spring.factories` 注册了多个自动配置类。`ProcessEngineAutoConfiguration` 创建 `SpringProcessEngineConfiguration`，注入数据源、事务管理器、异步执行器和资源发现组件。`ActivitiProperties` 默认扫描 `classpath*:**/processes/` 下的 `*.bpmn20.xml` 和 `*.bpmn`，自动部署流程。

Connector 是服务任务扩展点。以 `RankMovie` 示例为例，BPMN 里 serviceTask 的 implementation 是 `Movies.getMovieDesc`，Spring 应用里有 `@Bean("Movies.getMovieDesc") Connector`。流程执行到该节点时，`DefaultServiceTaskBehavior.execute` 会通过 `applicationContext.getBean(implementation, Connector.class)` 获取 Bean，`IntegrationContextBuilder` 会把 rootProcessInstanceId、processInstanceId、processDefinitionId、processDefinitionKey、processDefinitionVersion、businessKey、executionId、connectorType、clientName、appVersion 和输入变量组装到 `IntegrationContext`。Connector 执行业务逻辑后添加 outbound variables，`VariablesPropagator` 再把这些变量写回流程。

关于中间件我会讲得比较谨慎。当前仓库没有直接接入 Redis、RocketMQ、Dubbo、Nacos、Elasticsearch 或 Trantor。Redis 更适合放在查询侧做待办列表或流程详情 read model，不适合替代引擎的命令级缓存；MQ 可以通过事件监听器桥接流程事件，也可以结合异步 Job 扩展；ES 可以订阅流程和任务事件做复杂搜索；Dubbo/Nacos 可以放在 Connector Bean 内部调用外部业务服务。

最后讲优化点。第一，Connector 通过字符串 Bean 名称运行时查找，如果 BPMN 配置错会到运行时才失败，可以在应用启动时扫描 BPMN implementation 并校验 Spring Bean。第二，历史级别默认是 `NONE`，生产环境如果有审计要求，需要改成 AUDIT 或 FULL，同时做好历史表归档。第三，复杂查询可以通过事件同步 ES 或 Redis read model，避免直接压运行时表。第四，`AbstractDataManager.getListFromCache` 里有先 `cachedObjects.size()` 再判空的写法，可以改成空集合返回或先判空。

所以如果总结我的项目贡献和理解，我会说我主要做的是流程平台核心链路的源码级梳理和能力封装理解，重点掌握了 Runtime API 门面、Command + Agenda 执行模型、MyBatis 持久化、命令级缓存、异步 Job、Connector 微服务扩展、变量校验和权限策略。这些能力不只适用于 Activiti，也适用于很多平台型 Java 后端系统的设计。

## 追问短句

- 业务价值：BPMN 配置化替代硬编码状态机。
- 主链路：`Runtime API -> Command -> CommandContext -> Agenda -> ActivityBehavior`。
- 缓存：命令级缓存，不是 Redis，解决事务内一致性。
- 微服务：Connector 是扩展点，当前仓库未直接接 Dubbo/Nacos。
- 可靠性：异步 Job 有线程池、锁、重试、过期恢复。
- 权限：方法角色控制 + 流程 key 策略 + 任务候选人模型。
