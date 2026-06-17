# Activiti 工作流平台项目亮点包装

## 亮点 1：Runtime API 门面封装

**业务价值**：业务应用不用直接理解底层 Activiti Engine API，通过 `ProcessRuntime` 和 `TaskRuntime` 即可完成流程启动、任务处理、变量管理和流程事件处理。

**技术实现**：`ProcessRuntimeImpl` 封装 `RepositoryService`、`RuntimeService`，`TaskRuntimeImpl` 封装 `TaskService`。实现层统一处理安全校验、用户上下文、分页模型、变量校验、模型转换和事件发布。

**可追问点**：为什么不直接暴露 `RuntimeService` 和 `TaskService`？

**回答思路**：底层服务能力太细，业务侧容易耦合引擎内部模型。Runtime API 是防腐层，能把权限、变量校验、事件、DTO 转换统一收敛，后续也方便做限流、审计和版本兼容。

## 亮点 2：Command + Agenda 执行模型

**业务价值**：复杂流程执行需要清晰的事务边界和可扩展的节点推进机制，尤其是网关、异步任务、边界事件、多实例和子流程。

**技术实现**：流程启动从 `ProcessRuntimeImpl.start` 进入 `RuntimeServiceImpl`，再封装为 `StartProcessInstanceCmd`。命令在 `CommandContext` 中创建流程实例和变量，然后通过 `DefaultActivitiEngineAgenda` 规划操作，由 `CommandInvoker` 循环消费 Agenda。

**可追问点**：Agenda 和直接递归调用有什么区别？

**回答思路**：Agenda 把流程推进拆成队列操作，避免复杂递归，也让同步、异步、边界事件和后续节点推进都走统一模型。事务、缓存和异常都绑定在 CommandContext 中，更适合流程引擎。

## 亮点 3：命令级 EntityCache

**业务价值**：流程推进过程中会频繁读写 execution、task、variable、job。命令级缓存可以减少重复查询，并保证当前事务中未 flush 数据也能被后续逻辑看到。

**技术实现**：`EntityCacheImpl` 用 `Map<Class<?>, Map<String, CachedEntity>>` 缓存实体。`AbstractDataManager.findById` 先查缓存，列表查询会把 DB 结果和缓存结果合并，用缓存新版本覆盖 DB 版本，并过滤已删除实体。

**可追问点**：为什么不用 Redis？

**回答思路**：这里解决的是一次 Command 内的事务一致性，不是跨请求热点缓存。Redis 适合查询侧 read model，比如待办列表或流程搜索，但不能替代引擎内部命令级缓存。

## 亮点 4：30 个 cache matcher 支撑复杂查询合并

**业务价值**：流程引擎查询条件很多，例如按流程实例、父执行、任务、变量、Job、事件订阅查询。如果缓存实体不能参与这些查询，事务内结果可能不一致。

**技术实现**：`activiti-engine/.../cachematcher` 下有 30 个 matcher，用于判断缓存实体是否匹配具体查询条件，如 root process instance、executionId、parentExecutionId、taskId、variable、job 等。

**可追问点**：列表查询为什么比 `findById` 更复杂？

**回答思路**：`findById` 只要按 ID 命中缓存即可，列表查询需要判断缓存中哪些新增或更新实体也满足当前查询条件，还要过滤当前命令里已删除的实体，所以需要 matcher。

## 亮点 5：执行树预取优化

**业务价值**：复杂 BPMN 流程中，网关、子流程、多实例、边界事件经常访问执行树。反复查询 execution tree 会增加 DB 往返。

**技术实现**：`MybatisExecutionDataManager` 支持 `enableEagerExecutionTreeFetching`。开启后，按某个 execution 查询时可以一次拉取同 root process instance 的执行树并写入命令级缓存。

**可追问点**：什么时候适合开启？

**回答思路**：复杂流程、执行树访问频繁、DB 往返明显时更适合。简单流程或执行树很大时要结合压测评估，因为预取也可能一次拉取更多数据。

## 亮点 6：Spring Boot Starter 自动装配

**业务价值**：业务应用引入 Starter 后可以低成本接入流程引擎，不需要手动创建大量引擎配置对象。

**技术实现**：`spring.factories` 注册 `ProcessEngineAutoConfiguration`、`ProcessRuntimeAutoConfiguration`、`TaskRuntimeAutoConfiguration`。`ProcessEngineAutoConfiguration` 创建 `SpringProcessEngineConfiguration`，注入数据源、事务管理器、异步执行器、配置项和部署资源。

**可追问点**：流程定义怎么部署？

**回答思路**：默认扫描 `classpath*:**/processes/` 下的 `*.bpmn20.xml` 和 `*.bpmn`，启动时将资源设置到引擎配置并自动部署。

## 亮点 7：Connector 服务任务扩展

**业务价值**：流程模型可以编排外部业务能力，比如调用风控、通知、内容识别、审批规则、数据补全等服务，而不用把服务调用写死在流程引擎里。

**技术实现**：BPMN `serviceTask implementation` 对应 Spring Bean 名称。`DefaultServiceTaskBehavior` 运行时通过 `applicationContext.getBean(implementation, Connector.class)` 获取 Connector，构造 `IntegrationContext`，调用 `Connector.apply`，再传播输出变量。

**可追问点**：当前项目是不是已经接了 Dubbo？

**回答思路**：当前仓库没有直接接 Dubbo/Nacos。Connector 是扩展点，实际业务里可以在 Connector Bean 内部调用 Dubbo、Feign、HTTP 或其他 RPC 客户端。

## 亮点 8：扩展 JSON 变量映射

**业务价值**：流程变量映射从 BPMN 结构中拆出来，便于配置和维护。业务变量变化时不一定要修改流程结构。

**技术实现**：`ExtensionsVariablesMappingProvider` 读取扩展定义，计算 serviceTask 输入变量和输出变量，支持变量、常量、表达式解析、map-all 输入输出。示例 `RankMovie-extensions.json` 把 `movieToRank` 映射为 `movieName`，再把 `movieDescription` 映射为 `movieDesc`。

**可追问点**：变量映射有什么风险？

**回答思路**：变量名和类型不一致可能导致运行时错误，所以项目通过 `ProcessVariablesPayloadValidator` 和 `VariableValidationService` 做启动变量和设置变量校验。

## 亮点 9：变量定义与类型校验

**业务价值**：提前发现变量名错误、类型不匹配、日期格式不对、表达式不合法，减少流程跑到中间节点才失败的情况。

**技术实现**：`ProcessVariablesPayloadValidator` 读取流程扩展中的变量定义，校验变量名、类型、日期和表达式。`VariableValidationService` 根据变量类型 map 执行具体类型校验，未知类型默认按 JSON 处理。

**可追问点**：为什么变量校验在流程平台里重要？

**回答思路**：流程变量会驱动网关条件、任务展示、服务调用和输出映射。变量错误会影响整条流程，前置校验能降低运行时失败概率。

## 亮点 10：任务权限与候选人模型

**业务价值**：企业审批和工单系统必须保证用户只能看到和操作自己有权限的任务。

**技术实现**：`TaskRuntimeImpl.tasks()` 根据当前用户和用户组查询任务。任务可以由 assignee 直接处理，也可以通过 candidate user 或 candidate group 被用户领取。`complete`、`release`、`delete`、`assign` 都会校验当前用户身份。

**可追问点**：assignee、owner、candidate group 区别是什么？

**回答思路**：assignee 是当前处理人；owner 通常是任务创建或归属人；candidate user/group 是可领取任务的候选人或候选组。候选人领取后才成为 assignee。

## 亮点 11：流程安全策略

**业务价值**：不同用户、组、应用只能访问特定流程定义和流程实例，避免跨业务线或跨租户误操作。

**技术实现**：入口使用 `@PreAuthorize("hasRole('ACTIVITI_USER')")`。`ProcessSecurityPoliciesManagerImpl` 根据当前用户、用户组、应用名和流程 key 判断 READ/WRITE 权限。管理员角色 `ACTIVITI_ADMIN` 放行全部。

**可追问点**：如果用户没有任何权限，怎么处理？

**回答思路**：RestrictionApplier 会构造一个不存在的流程 key，让查询条件不可能命中，从而返回空结果。这种做法不会暴露真实流程是否存在。

## 亮点 12：异步 Job 锁、重试和过期恢复

**业务价值**：流程中的异步服务任务、定时器和长耗时节点不能阻塞主请求，需要可靠调度。节点宕机或执行失败后也要能恢复。

**技术实现**：`DefaultAsyncJobExecutor` 管理线程池和采集线程。`AcquireAsyncJobsDueRunnable` 获取到期 Job 并提交执行。`ResetExpiredJobsRunnable` 定期扫描锁过期 Job 并重置。默认重试 3 次，Job 锁 5 分钟。

**可追问点**：集群抢 Job 冲突怎么办？

**回答思路**：多节点同时获取 Job 时可能出现乐观锁异常，代码中把它作为集群环境的预期竞争处理。成功抢到锁的节点执行，其他节点忽略或等待下次扫描。

## 亮点 13：多数据库兼容和版本升级脚本

**业务价值**：流程平台通常要适配不同企业客户数据库，不能只支持一种本地测试库。

**技术实现**：仓库包含 336 个 SQL 脚本，覆盖 H2、MySQL、Postgres、Oracle、MSSQL、DB2、HSQL 的 create、drop、upgrade。MyBatis 实体 XML 有 27 个，覆盖运行时、仓库、历史、Job、变量等实体。

**可追问点**：生产环境怎么处理表增长？

**回答思路**：运行时表关注索引和分页，历史表根据历史级别和审计要求做归档。复杂查询可以同步到查询侧 read model，减少直接扫引擎表。

## 亮点 14：事件驱动扩展

**业务价值**：流程完成、任务创建、变量变化等事件可以触发通知、审计、搜索同步和外部系统集成。

**技术实现**：`ProcessRuntimeAutoConfiguration` 注册 runtime event listener，示例中有 `VariableEventListener<VariableCreatedEvent>` 和 `ProcessRuntimeEventListener<ProcessCompletedEvent>`。`ProcessRuntimeImpl` 也使用 `ApplicationEventPublisher` 发布部分 payload。

**可追问点**：项目用了 MQ 吗？

**回答思路**：当前仓库没有直接用 MQ。事件机制可以作为本地扩展点，生产环境可以在监听器中桥接 RocketMQ/Kafka，把流程事件发给其他系统。

## 亮点 15：工程规模与测试资源

**业务价值**：流程引擎是基础平台，稳定性和兼容性比单个业务功能更重要。大量测试和 BPMN 资源能覆盖不同流程行为。

**技术实现**：仓库有 801 个测试 Java 文件、1,227 个 BPMN 资源，覆盖网关、事件、变量、任务、Connector、Spring Boot 自动装配、安全策略和 conformance 测试。

**可追问点**：怎么证明不是只看了 README？

**回答思路**：讲具体类和链路，比如 `ProcessRuntimeImpl.start -> RuntimeServiceImpl -> StartProcessInstanceCmd -> ProcessInstanceHelper -> Agenda`，以及 `EntityCacheImpl -> AbstractDataManager -> cache matcher`。再结合 `RankMovie` 示例说明 Connector、变量映射和人任务闭环。

## 优先背诵的 5 个亮点

1. Runtime API 门面封装。
2. Command + Agenda 执行模型。
3. 命令级 EntityCache 和 cache matcher。
4. Connector + 扩展 JSON 的服务集成。
5. 异步 Job 的锁、重试和过期恢复。

这 5 个亮点覆盖业务价值、架构设计、性能优化、微服务实践和可靠性，最适合面试时主动展开。
