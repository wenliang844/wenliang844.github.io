# Activiti 工作流平台面试问答库

## 1. 项目与架构

### Q1：这个项目是做什么的？

答：  
这是一个基于 Activiti 7 的工作流和 BPM 平台内核，提供 BPMN 流程定义部署、流程实例运行、人任务处理、服务任务扩展、变量管理、异步 Job、权限策略和 Spring Boot 自动装配能力。它解决的是审批流、工单流、内容审核流等流程容易硬编码在业务系统里的问题。

### Q2：为什么不直接在业务代码里写状态机？

答：  
简单流程可以写状态机，但企业流程经常变化，比如审批节点、候选人、网关条件、服务调用和超时任务都可能调整。如果都写在业务代码里，变更成本高。BPMN 的价值是把流程结构模型化，业务代码更多关注节点动作和变量处理。

### Q3：整体架构是什么？

答：

```text
业务应用
  -> ProcessRuntime / TaskRuntime
  -> Runtime Impl 权限和变量校验
  -> RuntimeService / TaskService
  -> CommandExecutor
  -> CommandContext
  -> Agenda
  -> BPMN ActivityBehavior
  -> MyBatis DataManager
  -> ACT_* 数据表
```

旁路还有 Connector、Async Job Executor 和 Spring ApplicationEvent。

### Q4：项目模块怎么分？

答：  
`activiti-api` 定义 API 和模型；`activiti-core` 包含引擎、BPMN 转换、校验、Spring 集成和 Starter；`activiti-core-common` 提供安全、身份、连接器、资源发现、表达式语言；`activiti-examples` 提供流程、人任务、Connector、Web 示例。

### Q5：这个项目最值得讲的技术点是什么？

答：  
我会讲五个：`ProcessRuntime/TaskRuntime` 门面封装、Command + Agenda 执行模型、命令级 EntityCache、Connector 服务任务扩展、异步 Job 锁和重试。

## 2. Spring Boot

### Q6：Spring Boot 在项目里怎么用？

答：  
主要用于自动装配流程引擎和 runtime API。`spring.factories` 注册 `ProcessEngineAutoConfiguration`、`ProcessRuntimeAutoConfiguration`、`TaskRuntimeAutoConfiguration`、`ConnectorsAutoConfiguration` 等配置类。业务应用引入 `activiti-spring-boot-starter` 后，可以自动创建流程引擎配置、扫描 BPMN 资源、部署流程定义、配置异步执行器和安全能力。

### Q7：`ProcessEngineAutoConfiguration` 做了什么？

答：  
它创建 `SpringProcessEngineConfiguration`，注入数据源、事务管理器、异步执行器、Activiti 配置和资源发现组件，并设置部署资源、数据库 schema 更新、历史级别、强 UUID、自定义 MyBatis mapper、异步执行器参数等。

### Q8：流程定义怎么自动部署？

答：  
`ActivitiProperties` 默认扫描 `classpath*:**/processes/`，文件后缀包括 `**.bpmn20.xml` 和 `**.bpmn`。应用启动时自动发现这些资源并部署。

## 3. Runtime API

### Q9：`ProcessRuntime` 和底层 `RuntimeService` 有什么区别？

答：  
`RuntimeService` 是引擎底层服务，能力更底层。`ProcessRuntime` 是业务侧运行时门面，统一处理流程定义过滤、权限策略、变量校验、API 模型转换和事件发布。业务应用用 `ProcessRuntime` 更稳定，也更利于平台治理。

### Q10：`ProcessRuntimeImpl.start` 做了什么？

答：  
它会校验流程定义是否可用和属于最新部署，检查当前用户是否有写权限，校验启动变量，然后通过 `RuntimeService` 创建流程实例 builder 并启动。

### Q11：`TaskRuntime` 怎么保证用户只能看到自己的任务？

答：  
`TaskRuntimeImpl.tasks()` 通过 `SecurityManager` 获取当前用户 ID 和用户组，把 assignee 和 candidate group 条件带入查询。完成、释放、删除、更新时还会校验当前用户是不是任务 assignee。

### Q12：`claim`、`complete`、`assign` 的规则是什么？

答：

- `claim`：任务必须可见且未被其他人领取。
- `complete`：任务必须已经分配给当前用户。
- `assign`：当前用户必须是 assignee，新 assignee 必须是候选用户。

## 4. 流程执行模型

### Q13：启动流程的完整调用链是什么？

答：

```text
ProcessRuntimeImpl.start
  -> RuntimeService.createProcessInstanceBuilder
  -> ProcessInstanceBuilderImpl.start
  -> RuntimeServiceImpl.startProcessInstance
  -> commandExecutor.execute(new StartProcessInstanceCmd)
  -> StartProcessInstanceCmd.execute
  -> ProcessInstanceHelper.createAndStartProcessInstance
  -> commandContext.getAgenda().planContinueProcessOperation
  -> CommandInvoker 消费 Agenda
  -> ContinueProcessOperation 执行 ActivityBehavior
```

### Q14：为什么要用 Command 模式？

答：  
Command 模式把一次引擎操作封装起来，统一进入 `CommandExecutor`。事务、异常处理、拦截器、DB session、EntityCache、Agenda 都能绑定在同一个 `CommandContext` 生命周期中。流程引擎读写状态很多，用 Command 管理边界更清晰。

### Q15：Agenda 是什么？

答：  
Agenda 是流程操作队列。启动流程、继续流程、走出当前节点、触发执行、结束执行等动作都会包装成 operation 放入 Agenda。`CommandInvoker` 循环消费 Agenda。这样可以避免复杂递归，也方便处理异步节点、边界事件、多实例和子流程。

## 5. MyBatis、事务与数据库

### Q16：MyBatis 在项目里怎么用？

答：  
Activiti Engine 用 MyBatis 做实体持久化。映射 XML 位于 `activiti-core/activiti-engine/src/main/resources/org/activiti/db/mapping/entity`，包括 Execution、Task、Variable、Job、Deployment、ProcessDefinition、History 等 27 个实体 XML。

### Q17：主要数据库表怎么理解？

答：  
`ACT_RU_*` 是运行时表，如 execution、task、variable、job；`ACT_RE_*` 是流程定义仓库表，如 deployment、process definition、model；`ACT_HI_*` 是历史表；`ACT_GE_*` 是通用表；`ACT_EVT_LOG` 是事件日志。

### Q18：事务怎么保证？

答：  
Spring Boot Starter 注入 `PlatformTransactionManager` 到 `SpringProcessEngineConfiguration`。引擎命令通过 `CommandContext` 管理一次操作的 DB session、缓存和 flush。一次流程启动或任务完成通常在同一命令上下文和事务边界内完成，异常时统一回滚。

### Q19：为什么有这么多数据库脚本？

答：  
流程平台要适配不同企业数据库。仓库有 336 个 SQL 脚本，覆盖 H2、MySQL、Postgres、Oracle、MSSQL、DB2、HSQL 的 create、drop、upgrade。

## 6. 缓存与性能

### Q20：项目用了 Redis 吗？

答：  
当前仓库没有直接使用 Redis。项目核心缓存是命令级 `EntityCache`，生命周期是一次 `Command`，主要解决流程推进中的重复查询和事务内一致性问题。

### Q21：命令级缓存和 Redis 有什么区别？

答：  
命令级缓存只在一次引擎命令内有效，能看到当前事务里已经创建或修改但还没 flush 到 DB 的实体。Redis 是跨请求共享缓存，更适合待办列表 read model、用户组缓存、流程详情缓存。Redis 不能简单替代引擎内部命令级缓存。

### Q22：`EntityCacheImpl` 怎么设计？

答：  
它用 `Map<Class<?>, Map<String, CachedEntity>>` 按实体类型和 ID 缓存对象。`findById` 先查缓存，没有再查 DB。列表查询时，`AbstractDataManager` 会把 DB 结果和缓存结果合并，用缓存里的新版本覆盖 DB 版本，并过滤已删除实体。

### Q23：cache matcher 是什么？

答：  
cache matcher 用来判断缓存实体是否匹配某个查询条件。项目里有 30 个 matcher，覆盖按流程实例、执行 ID、父执行 ID、任务 ID、变量、Job、事件订阅等场景。

### Q24：执行树预取有什么用？

答：  
复杂流程经常查询同一个 root process instance 下的 execution tree。`MybatisExecutionDataManager` 支持 `enableEagerExecutionTreeFetching`，可以一次拉取整棵执行树并放入缓存，后续从缓存匹配，减少 DB 往返。

### Q25：你发现哪些优化点？

答：  
Connector 可以做启动时 Bean 校验；大规模流程定义/实例查询要关注 DB 层分页；历史级别默认 `NONE`，生产审计要改成 AUDIT/FULL 并归档；复杂待办和流程搜索可通过事件同步 ES/Redis read model；`getListFromCache` 的空集合处理可以优化。

## 7. 异步任务与可靠性

### Q26：异步 Job 怎么执行？

答：  
`DefaultAsyncJobExecutor` 启动线程池和采集线程。`AcquireAsyncJobsDueRunnable` 周期性执行 `AcquireJobsCmd` 获取到期 Job，然后调用 `asyncExecutor.executeAsyncJob(job)`。如果队列满，会等待配置的 queue full wait time，避免过载。

### Q27：Job 失败怎么办？

答：  
默认重试 3 次。Job 有锁时间，默认 5 分钟。`ResetExpiredJobsRunnable` 定期扫描锁过期的 Job，并执行 `ResetExpiredJobsCmd` 恢复可执行状态，避免执行节点宕机后 Job 永久卡住。

### Q28：集群里多个节点同时抢 Job 怎么办？

答：  
多个异步执行器同时抢同一个 Job 时可能出现乐观锁异常。代码中把这种异常作为集群下的预期行为处理，成功抢到锁的节点执行，其他节点等待下次扫描。

### Q29：异步执行器默认参数有哪些？

答：  
默认 corePoolSize 2，maxPoolSize 10，queueSize 100，重试 3 次，异步 Job 和 Timer Job 锁 5 分钟，过期 Job 扫描间隔 60 秒，过期 Job 每页 3 条，`messageQueueMode=false`。

## 8. Connector、MQ、Dubbo/Nacos、ES

### Q30：Connector 解决什么问题？

答：  
Connector 让 BPMN 的 serviceTask 不直接依赖具体业务代码。BPMN 中只写 `implementation`，运行时通过 Spring Bean 名称找到 `Connector`，构造 `IntegrationContext` 调用 `Connector.apply`，再把输出变量写回流程。它是流程平台和业务服务之间的扩展点。

### Q31：扩展 JSON 有什么用？

答：  
扩展 JSON 定义流程变量、Connector 输入输出映射、常量和表达式。比如 `RankMovie-extensions.json` 把流程变量 `movieToRank` 映射为 connector 入参 `movieName`，再把 connector 输出 `movieDescription` 映射为流程变量 `movieDesc`。

### Q32：项目用了 RocketMQ 吗？

答：  
当前仓库没有 RocketMQ。可扩展方案是通过流程事件监听器捕获流程启动、任务创建、流程完成、变量变化等事件，然后桥接到 RocketMQ/Kafka。异步 Job 的 `messageQueueMode` 也提供了进一步扩展空间，但当前默认是 false。

### Q33：项目用了 Dubbo/Nacos 吗？

答：  
当前仓库没有 Dubbo/Nacos。微服务实践主要体现在 Connector 抽象和 Spring Boot Starter 嵌入式接入。Connector Bean 内部可以调用 HTTP、Feign、Dubbo 等远程服务，Nacos 可以作为业务服务注册发现，但不是当前仓库内置能力。

### Q34：项目用了 Elasticsearch 吗？

答：  
当前仓库没有 ES。流程搜索可以通过事件监听器同步流程实例、任务、变量、候选人等数据到 ES，构建查询侧 read model。复杂搜索和报表走 ES，流程状态写入仍由引擎和数据库保证一致性。

### Q35：Redis 可以放在哪里？

答：  
Redis 更适合放查询侧和业务侧，例如缓存用户组、待办列表摘要、流程定义元数据、流程详情 read model。不要用 Redis 替代引擎内部命令级缓存，因为后者解决的是一次事务内未 flush 实体的一致性。

## 9. 安全与变量

### Q36：安全策略怎么做？

答：  
入口层用 `@PreAuthorize("hasRole('ACTIVITI_USER')")` 控制 runtime API 访问。流程层用 `ProcessSecurityPoliciesManagerImpl` 根据用户、用户组、应用名和流程 key 判断 READ/WRITE 权限。任务层根据 assignee、candidate user、candidate group 控制任务可见性和操作权限。

### Q37：管理员怎么处理？

答：  
如果当前用户角色包含 `ACTIVITI_ADMIN`，则允许访问全部流程。这是一个简单清晰的管理员放行策略。

### Q38：变量校验怎么做？

答：  
`ProcessVariablesPayloadValidator` 读取扩展 JSON 中的变量定义，检查变量名是否合法、是否包含不允许的表达式、类型是否匹配、日期格式是否可解析。实际类型校验由 `VariableValidationService` 和变量类型 map 处理，未知类型默认按 JSON 处理。

## 10. 工程质量

### Q39：测试情况怎么样？

答：  
静态扫描有 801 个测试 Java 文件和 1,227 个 BPMN 资源。测试覆盖引擎行为、BPMN 网关、事件、变量、任务、Connector、Spring Boot 自动装配、安全策略、conformance 等。

### Q40：用了哪些设计模式？

答：  
门面模式：`ProcessRuntime`、`TaskRuntime`；命令模式：`StartProcessInstanceCmd` 等；策略/匹配器：cache matcher、SecurityPoliciesRestrictionApplier；工厂/自动装配：Spring Boot AutoConfiguration、ActivityBehaviorFactory；观察者模式：Spring ApplicationEvent 和 runtime event listener。

### Q41：如果生产化增强，你会怎么做？

答：  
我会做查询侧 read model、Connector 启动校验、异步 Job 监控、历史归档、分页和索引优化。复杂查询同步 ES，热点待办同步 Redis，流程写入仍由引擎数据库保证一致性。

### Q42：如果面试官质疑“这不是业务项目”，怎么回答？

答：  
可以说：这个项目不是单一业务 CRUD，而是流程平台内核。它覆盖 Java 后端平台开发中非常核心的能力：Spring Boot Starter、运行时 API、MyBatis 持久化、事务和命令模式、缓存、异步 Job、权限、事件和服务扩展。业务场景可以落到审批、工单、内容审核和任务协同。

### Q43：如果问“业务成果是什么”？

答：  
业务成果是平台能力沉淀。它把流程启动、人任务、服务任务、变量、权限和异步执行标准化，业务系统可以用 BPMN 配置流程，减少硬编码状态机。量化上，项目包含 1,227 个 BPMN 资源、59 个扩展 JSON、30 个缓存 matcher、336 个数据库脚本，覆盖较多流程行为和数据库适配场景。

### Q44：如果问“性能结果是什么”？

答：  
当前仓库没有线上压测数据，所以不说虚假的 TPS 提升。能明确讲的是性能机制：命令级 EntityCache 减少一次流程推进中的重复查询，执行树预取减少复杂流程反复查 execution tree，异步执行器通过线程池、Job acquisition、锁和过期恢复控制异步吞吐和可靠性。生产落地后应基于慢 SQL、Job 积压和任务查询压测再量化收益。
