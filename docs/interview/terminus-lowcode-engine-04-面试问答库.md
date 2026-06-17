# Terminus LowCode Engine 面试问答库

## 1. 架构设计

### Q1：这个项目整体是做什么的？

**参考回答：**  
这是一个企业级中后台低代码引擎。它用低代码 schema 描述页面，用物料 schema 描述组件，通过设计器完成页面搭建，通过 React/Rax 渲染器实时预览和运行，通过 code-generator 把 schema 转成 Ice.js/Rax 工程代码。它解决的是中后台重复页面开发成本高、组件资产难复用、低代码产物难工程化交付的问题。

### Q2：项目为什么要拆成这么多 packages？

**参考回答：**  
因为低代码引擎不是单一 UI，而是一套平台底座。`engine` 负责入口装配，`designer` 负责设计器模型和交互，`shell` 负责 API 门面，`renderer-core` 负责运行态渲染，`react/rax renderer` 适配不同技术栈，`simulator renderer` 负责设计态预览，`code-generator` 负责出码，`material-parser` 负责物料入料。拆包后每个模块职责清晰，可以独立测试、独立演进，也方便多个业务平台按需组合。

### Q3：项目的核心架构思想是什么？

**参考回答：**  
我会概括为“协议驱动 + 微内核插件 + 渲染/出码双出口”。协议驱动是 schema 连接设计器、渲染器、物料和出码；微内核插件是内核只保留稳定模型和生命周期，业务差异通过插件扩展；双出口是 schema 既可以运行态渲染，也可以生成源码工程。

### Q4：为什么要有 shell 包？

**参考回答：**  
`shell` 是 Facade 门面层。designer 内部模型很复杂，如果业务插件直接依赖内部类，内核一改就会影响插件。shell 把 Project、DocumentModel、Node、History、Dragon 等内部对象包装成稳定 API，隔离内部实现细节，降低插件耦合。

### Q5：这个项目和普通页面搭建器有什么区别？

**参考回答：**  
普通搭建器可能只做到拖拽和预览。这个项目覆盖完整链路：物料解析、设计器模型、插件体系、设计态模拟器、运行态渲染、源码出码和测试样例。它更像低代码平台底座，而不是单个搭建页面。

## 2. 设计器核心模型

### Q6：为什么不直接操作 JSON schema？

**参考回答：**  
因为设计态有很多复杂操作：拖拽、选中、属性编辑、插槽、条件、循环、撤销重做、大纲树、模拟器定位。如果直接改 JSON，节点查找、历史记录、状态同步都很难维护。项目把 schema 转成 `Project -> DocumentModel -> Node -> Props` 响应式模型，再在保存、预览、出码时导出 schema。

### Q7：DocumentModel 的作用是什么？

**参考回答：**  
`DocumentModel` 表示一个页面或文档，负责从 schema 初始化节点树，维护 `_nodesMap`，提供节点创建、查找、插入、删除、导入导出，也持有 selection 和 history。它是设计态页面的核心聚合根。

### Q8：Node 模型里一般有什么？

**参考回答：**  
`Node` 表示低代码组件节点，包含 `componentName`、`props`、`children`、slot、condition、loop、hidden、locked 等信息。它既承载组件结构，又承载设计态行为，例如是否可选中、是否可拖拽、如何导出 schema。

### Q9：Props/Prop 为什么要单独建模？

**参考回答：**  
低代码属性不只是简单 key-value。它可能是对象、数组、表达式、函数、插槽，也可能需要触发属性面板和历史记录更新。单独建模后可以统一处理属性读取、设置、导出、子属性管理和变更事件。

### Q10：History 是怎么做撤销重做的？

**参考回答：**  
`History` 使用 MobX reaction 监听导出的 schema，当 schema 变化时记录历史快照，并按 timeGap 合并连续操作。这样拖拽或连续输入不会产生过多历史点，撤销重做更符合编辑器体验。

## 3. 插件体系

### Q11：插件体系解决了什么问题？

**参考回答：**  
低代码平台业务差异很大，不能把所有能力都写死在内核里。插件体系允许业务扩展面板、setter、物料、快捷键、发布、出码按钮等能力。内核稳定，业务能力通过插件扩展，这就是微内核思路。

### Q12：插件初始化顺序怎么保证？

**参考回答：**  
插件可以声明依赖，`plugin-manager` 结合 `sequencify` 对插件依赖进行排序，再按顺序初始化。这样可以避免某个插件依赖的能力还没 ready 就开始执行。

### Q13：插件稳定性怎么保障？

**参考回答：**  
项目在插件管理器里做了插件名校验、重复注册处理、引擎版本检查、禁用、删除和 destroy 生命周期。插件通过 shell API 访问内核，减少直接破坏内部状态的风险。

## 4. 渲染器与模拟器

### Q14：设计态模拟器为什么复杂？

**参考回答：**  
因为它不是只负责预览。它要在 iframe 中加载组件库、主题、runtime、上下文，再把 schema 渲染成真实组件树，同时还要支持选中、悬停、拖拽定位和实例反查。它是设计器模型和真实组件实例之间的桥。

### Q15：instancesMap 有什么价值？

**参考回答：**  
`instancesMap` 把低代码节点 id 映射到真实 React/Rax 组件实例。设计器选中节点、悬停节点、拖拽定位时，不需要遍历整棵组件树，可以通过 Map 快速定位实例。一个节点可能对应多个实例，所以值通常是数组。

### Q16：运行态渲染器支持哪些低代码能力？

**参考回答：**  
`renderer-core` 支持条件渲染、循环渲染、插槽 JSSlot、JSExpression、JSFunction、生命周期、自定义方法、数据源加载和 fallback 组件。它负责把 schema 转换成真实 React/Rax 组件树。

### Q17：数据源是怎么处理的？

**参考回答：**  
`DataHelper` 管理 datasource list、加载状态、初始化请求和数据处理逻辑，底层支持 fetch/jsonp，也支持 beforeRequest、afterRequest、dataHandler 等扩展。这样 schema 里的数据源配置可以在运行态转成真实请求。

## 5. 出码与物料

### Q18：code-generator 的核心流程是什么？

**参考回答：**  
核心流程是 `SchemaParser -> ProjectBuilder -> ModuleBuilder -> ChunkBuilder -> CodeBuilder -> Publisher`。先解析 schema，再生成项目级模块和页面/组件模块，接着通过插件流水线生成代码片段，最后链接 chunk 并输出到磁盘或 zip。

### Q19：为什么出码要做插件化？

**参考回答：**  
因为不同业务可能有不同框架、目录、路由、样式和依赖规范。插件化后，通用流程不变，具体生成逻辑可以按 solution 或插件替换。比如 Ice.js 和 Rax 可以共用 parser/builder，但代码模板不同。

### Q20：浏览器出码为什么用 Web Worker？

**参考回答：**  
schema 解析和工程生成是重计算任务，如果在主线程执行，会导致设计器卡顿。Web Worker 可以把出码放到后台线程，主线程只负责发送 schema 和接收结果。项目还做了 worker 脚本缓存、超时和 terminate，避免重复加载和资源泄漏。

### Q21：material-parser 的作用是什么？

**参考回答：**  
它负责把组件源码或组件包解析成低代码物料协议 ComponentMeta。流程包括 scan 包信息、解析 JS/TS 或动态元数据、生成物料描述、用 AJV 校验。这样已有组件库可以进入设计器物料面板。

### Q22：动态解析有没有安全风险？

**参考回答：**  
有。仓库里使用 `vm2` sandbox 动态加载组件元信息，但动态执行第三方包仍然有风险。企业落地时建议把解析放在独立容器或进程里，限制网络、文件系统、CPU 时间和包来源，并对解析结果做审核。

## 6. 性能优化

### Q23：这个项目有哪些性能优化？

**参考回答：**  
主要有六类：第一，多层 Map 缓存插件、文档、节点、组件元数据和实例，减少递归查找；第二，MobX computed/reaction/autorun 做响应式更新，减少全量刷新；第三，requestIdleCallback 做画布位置计算；第四，Web Worker 出码避免主线程阻塞；第五，Promise.all 并行生成页面/组件模块；第六，AssetLoader/CDN 外置减少资源重复加载和业务包体积。

### Q24：节点 Map 缓存为什么重要？

**参考回答：**  
低代码页面本质是树结构。复杂页面节点多，如果每次属性修改、选中、拖拽都从根节点递归查找，性能会很差。`DocumentModel._nodesMap` 用节点 id 做索引，把高频查找降到近似 O(1)。

### Q25：requestIdleCallback 用在哪里？

**参考回答：**  
主要用于画布节点位置计算，例如 `OffsetObserver` 计算 DOM rect。选中框、悬停框、拖拽辅助线都依赖位置信息，但这些计算不应该抢占拖拽和滚动过程的主线程，所以放到浏览器空闲时间执行。

### Q26：如果页面很大，如何继续优化？

**参考回答：**  
可以从几个方向优化：大纲树和画布虚拟化；节点位置计算分批；表达式编译结果缓存；组件元数据按需加载；schema diff 增量同步；出码任务服务化；超大页面拆分为区块或子文档；关闭或降级设计态检测能力，例如 `disableDetecting`。

## 7. 缓存设计

### Q27：项目里有没有 Redis？

**参考回答：**  
当前仓库没有 Redis。这里的缓存主要是编辑器内存态缓存和工具链缓存，比如 pluginsMap、documentsMap、nodesMap、componentMetasMap、instancesMap、AST/import cache、workerJsCache。它们解决的是前端编辑器高频查找和解析重复计算问题。

### Q28：如果服务化落地，Redis 应该怎么用？

**参考回答：**  
可以用 Redis 缓存高频物料 manifest、组件元数据、页面草稿、schema 最新版本、出码任务临时结果和用户最近打开页面。需要注意版本号和失效策略，比如物料发布后按 package/version 做缓存 key，schema 保存后主动失效草稿缓存。

### Q29：缓存一致性怎么考虑？

**参考回答：**  
前端内存缓存主要跟随模型生命周期，节点增删时同步更新 Map。服务端缓存则需要基于版本号和主动失效，比如 schema 每次保存生成新版本，Redis key 带 version；物料发布后更新 manifest version；出码任务结果按 taskId 存储并设置 TTL。

## 8. Java 后端与中间件追问

### Q30：这个项目用 Spring Boot 了吗？

**参考回答：**  
当前仓库没有 Spring Boot，它是 TypeScript 低代码引擎和工具链。如果企业落地需要后端，我会用 Spring Boot 承载 schema 存储、物料中心、出码任务、发布记录和权限审计，但这属于配套后端服务，不是当前仓库代码。

### Q31：有没有 Dubbo/Nacos？

**参考回答：**  
当前仓库没有 Dubbo/Nacos。低代码引擎本身主要运行在前端和 Node 工具链里。如果后端服务化，可以用 Nacos 做配置中心和服务注册，用 Dubbo 或 HTTP/RPC 暴露 schema、物料、出码任务服务。schema 协议就是服务之间的契约。

### Q32：有没有 RocketMQ？哪些任务适合异步化？

**参考回答：**  
当前仓库没有 RocketMQ。适合异步化的是重任务和非实时任务，比如批量出码、物料解析、发布通知、截图预览生成、依赖安全扫描、构建发布。设计器在线编辑链路应该尽量轻，重任务通过 MQ 解耦。

### Q33：有没有 MySQL/MyBatis？如果要设计表怎么做？

**参考回答：**  
当前仓库没有 MySQL/MyBatis。服务化落地可以设计几类表：页面表、schema 版本表、物料包表、组件元数据表、出码任务表、发布记录表、操作审计表。MyBatis 负责持久化，关键字段包括 projectId、pageId、version、schemaJson、status、creator、updatedAt。

### Q34：有没有 Elasticsearch？

**参考回答：**  
当前仓库没有 ES。如果做物料中心，可以用 ES 支撑组件搜索、属性搜索、标签筛选和文档检索。数据来源是 material-parser 生成的 ComponentMeta，再同步到 ES 索引。

### Q35：有没有事务问题？

**参考回答：**  
当前仓库没有数据库事务。设计态内部更像内存模型的一致性问题，例如节点增删要同时维护节点树和 `_nodesMap`，history 要记录同一批 schema 变化。服务端落地时，schema 保存、版本创建、发布记录需要放在事务里；出码任务则需要任务状态机和幂等处理，避免重复提交导致状态错乱。

## 9. 可靠性与扩展性

### Q36：项目怎么保证渲染可靠性？

**参考回答：**  
renderer-core 有 fallback 组件用于渲染异常兜底；物料解析后有 AJV 校验；设计器里缺失组件会进入 lost component meta 相关逻辑，避免页面直接崩溃。正式落地还可以增加 schema 校验、表达式沙箱和运行态错误上报。

### Q37：出码失败怎么处理？

**参考回答：**  
浏览器 Worker 出码有超时和 terminate；publisher 阶段可以捕获输出错误。服务化后建议做任务状态机，状态包括 pending、running、success、failed、timeout，并保存错误日志、schema 版本和 solution 版本，支持重试和问题复现。

### Q38：如何扩展一种新的出码框架？

**参考回答：**  
新增 solution，定义项目模板、插件集合、依赖、路由和文件结构。复用 SchemaParser 和 builder 主流程，只替换 framework-specific 的 chunk 插件和模板。然后增加 test-cases 和 expected 输出，保证生成结果稳定。

### Q39：如何接入新的组件库？

**参考回答：**  
先通过 material-parser 解析组件库，生成 ComponentMeta；然后在设计器物料中心加载 assets 和物料描述；运行态或模拟器通过 AssetLoader 加载 UMD/CDN 资源；最后确保出码模块知道组件 npm 包依赖和 import 方式。

### Q40：项目的代码质量怎么保障？

**参考回答：**  
仓库使用 TypeScript、ESLint、Lerna test、Jest 测试和大量 code-generator test-cases。架构上也通过 shell API、plugin lifecycle、schema validation、AJV 校验、builder 分层降低复杂度。后续可以加强 e2e、性能基准和出码结果编译校验。

## 10. 项目风险与优化

### Q41：你觉得项目最大的风险是什么？

**参考回答：**  
一个是模拟器 Host 职责偏重，长期维护成本高；一个是动态物料解析的安全边界；还有表达式执行的性能和安全风险。优化方向是拆分 host 子模块、解析任务容器化、表达式编译缓存和白名单沙箱。

### Q42：如果让你继续优化这个项目，你会优先做什么？

**参考回答：**  
我会优先做三件事：第一，梳理模拟器 Host，把资源管理、实例注册、iframe 通信拆清楚；第二，给 code-generator 增加生成结果编译校验和性能基准；第三，补 schema 草稿持久化和版本恢复能力，解决刷新丢失编辑上下文的问题。

### Q43：如何证明性能优化有效？

**参考回答：**  
需要建立指标。设计态可以记录节点数、选中响应时间、拖拽帧率、schema 导出耗时、组件资源加载耗时；出码可以记录 schema size、页面数、生成耗时、Worker 启动耗时、publisher 输出耗时。优化前后对比 P50/P95，而不是只凭主观感觉。

### Q44：这个项目适合怎么做监控？

**参考回答：**  
前端设计器监控编辑器启动耗时、assets 加载耗时、画布首渲染、拖拽异常、schema 导入导出异常、表达式异常。出码服务监控任务耗时、成功率、失败原因、超时率、生成产物大小。物料服务监控解析耗时、失败组件数、协议校验失败率。

### Q45：你在这个项目里最想重点讲的亮点是什么？

**参考回答：**  
我会讲四个：第一，schema 协议驱动，把物料、设计器、渲染和出码解耦；第二，Project/DocumentModel/Node/Props 模型分层，支撑复杂编辑器状态；第三，插件微内核和 shell 门面，支撑业务扩展；第四，多层缓存、响应式更新和 Worker 出码带来的性能优化。

