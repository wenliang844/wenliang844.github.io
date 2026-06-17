# Terminus LowCode Engine 项目亮点包装

## 亮点 1：协议驱动的低代码平台架构

**业务价值：**  
用统一 schema 连接页面搭建、运行态渲染、源码出码和物料体系，避免每个业务平台重复建设设计器和渲染链路。

**技术实现：**  
页面使用低代码 schema 描述，组件使用 ComponentMeta 物料协议描述。`designer` 负责产生和维护 schema，`renderer-core` 消费 schema 渲染页面，`code-generator` 消费 schema 生成工程，`material-parser` 生成物料 schema。

**量化口径：**  
当前仓库支撑 15 个核心 packages、2 个工具 modules，支持 React/Rax 双渲染体系和 Ice.js/Rax 双出码方案。

**可追问点：**  
为什么 schema 是低代码系统的核心？

**回答思路：**  
schema 是模块之间的契约。只要协议稳定，设计器、渲染器、出码服务、物料服务就能独立演进。它解决的是低代码平台扩展性和资产流通问题。

## 亮点 2：微内核 + 插件体系

**业务价值：**  
不同业务平台可以在同一低代码引擎上扩展自己的面板、物料、setter、发布和出码能力，减少重复造轮子。

**技术实现：**  
`packages/designer/src/plugin/plugin-manager.ts` 管理插件注册、初始化、禁用、销毁、依赖排序、版本检查和偏好配置；`sequencify.ts` 处理插件依赖顺序；插件通过 `shell` API 访问内核。

**量化口径：**  
仓库内低代码能力被拆成 15 个核心 packages，并通过插件包和 shell API 扩展。出码模块中也沉淀了 74 个插件源码。

**可追问点：**  
插件过多会不会影响稳定性？

**回答思路：**  
用生命周期、依赖排序、版本校验、禁用和 destroy 控制插件行为；用 shell 门面隔离内部实现；关键插件增加初始化失败降级和错误上报。

## 亮点 3：Project/DocumentModel/Node/Props 设计态模型分层

**业务价值：**  
承载复杂页面搭建能力，包括拖拽、选中、属性配置、插槽、条件、循环、撤销重做、大纲树和实时预览。

**技术实现：**  
`Project` 管理项目级文档，`DocumentModel` 管理页面和 `_nodesMap`，`Node` 表示组件节点，`Props/Prop` 表示复杂属性，`NodeChildren` 管理子节点。静态 schema 被转换成可响应式更新的设计态模型。

**量化口径：**  
设计器模块拥有大量测试覆盖，仓库整体测试文件 72 个，其中包含节点增删改、拖拽、模拟器、视口等关键场景。

**可追问点：**  
为什么不直接修改 JSON？

**回答思路：**  
直接改 JSON 不利于高频查找、撤销重做、属性面板同步和模拟器定位。模型分层后，每个设计态概念都有清晰职责，状态变化也更可控。

## 亮点 4：shell API 门面与防腐层

**业务价值：**  
让业务插件使用稳定 API，而不是直接依赖 designer 内部类，降低平台升级和内核重构成本。

**技术实现：**  
`packages/shell/src` 对 Project、DocumentModel、Node、History、Dragon 等对象做包装，屏蔽内部 symbol 和私有实现，向插件暴露受控方法。

**量化口径：**  
shell 覆盖项目、文档、节点、历史、拖拽、选区等关键对象，是插件生态的统一入口。

**可追问点：**  
Facade 和普通工具函数有什么区别？

**回答思路：**  
Facade 是边界层，不只是复用函数。它限制访问范围、稳定 API 形态、隔离内部模型变化，解决长期演进中的耦合问题。

## 亮点 5：设计态模拟器与真实组件实例映射

**业务价值：**  
设计器不仅能预览页面，还能在真实组件上进行选中、拖拽、悬停、定位和属性编辑，提升搭建体验。

**技术实现：**  
`BuiltinSimulatorHost` 管理 iframe、资源、上下文和事件；`react-simulator-renderer` 使用 `AssetLoader` 和 `buildComponents` 渲染 schema，并通过 `instancesMap`、`documentInstanceMap` 缓存节点和组件实例关系。

**量化口径：**  
项目支持 React 和 Rax 两套 simulator renderer，能够适配不同运行时技术栈。

**可追问点：**  
模拟器为什么不是普通 iframe？

**回答思路：**  
普通 iframe 只能预览。低代码模拟器需要双向交互：schema 变化驱动渲染，用户点击真实组件又要反查 Node 并同步设计器状态。

## 亮点 6：多层缓存设计

**业务价值：**  
降低复杂页面编辑时的节点查找、组件查找、实例定位和物料解析成本，减少卡顿。

**技术实现：**  
使用 `pluginsMap`、`documentsMap`、`_nodesMap`、`componentMetasMap`、`instancesMap`、`treeMap`、AST/import cache、`workerJsCache` 等多层缓存。不同缓存绑定不同生命周期，例如节点缓存跟随 DocumentModel，Worker 缓存按 URL，物料解析缓存按路径或作用域。

**量化口径：**  
页面节点查找从树遍历变为 Map 索引；出码 Worker 脚本同 URL 可复用；物料解析减少重复 AST 解析。

**可追问点：**  
为什么这里不用 Redis？

**回答思路：**  
当前仓库是前端引擎和工具链，缓存主要解决浏览器/Node 进程内高频查找。Redis 适合服务化后缓存物料 manifest、schema 草稿、出码结果，不是当前仓库已有实现。

## 亮点 7：Web Worker 出码避免主线程阻塞

**业务价值：**  
在线出码时设计器仍可保持响应，提升复杂页面生成工程时的用户体验。

**技术实现：**  
`standalone-loader` 创建 Worker，把 schema 解析、项目构建、代码生成放到后台线程；主线程通过消息通信获取结果；内部有 worker 脚本缓存、超时控制和 terminate 机制。

**量化口径：**  
出码支持浏览器 Web Worker、Node 调用、CLI、设计器插件集成等多种形态。

**可追问点：**  
Worker 失败怎么处理？

**回答思路：**  
设置超时，失败后 terminate 回收资源，返回错误给调用方；服务化后可以引入任务状态机、失败重试和错误日志归档。

## 亮点 8：出码插件流水线

**业务价值：**  
把低代码页面转成可维护的源码工程，解决低代码产物难二次开发、难接入标准研发流程的问题。

**技术实现：**  
`SchemaParser -> ProjectBuilder -> ModuleBuilder -> ChunkBuilder -> CodeBuilder -> Publisher` 分层。`ChunkBuilder` 运行插件流水线生成代码片段，`CodeBuilder` 处理 chunk 依赖，publisher 输出目录或 zip。

**量化口径：**  
`modules/code-generator/src/plugins` 下有 74 个插件源码；`test-cases` 下有 265 个测试样例目录；内置 Ice.js 和 Rax 两套 solution。

**可追问点：**  
如何新增一个 Vue 出码方案？

**回答思路：**  
新增 Vue solution，复用 parser 和 builder 主流程，替换组件渲染、路由、样式、入口和依赖生成插件，再增加测试样例和 expected 输出。

## 亮点 9：并行生成提升多页面出码效率

**业务价值：**  
多页面低代码项目出码时，减少端到端等待时间。

**技术实现：**  
`ProjectBuilder` 对多个 container/page/module 使用 `Promise.all` 并行生成。页面和组件模块大多独立，适合并发处理，最后再聚合工程文件。

**量化口径：**  
265 个出码测试样例目录覆盖多种工程生成场景；并行生成是出码链路的关键性能设计。

**可追问点：**  
并行会不会导致输出顺序不稳定？

**回答思路：**  
模块生成可以并行，但最终文件聚合、chunk 链接和依赖排序需要稳定规则。并发只放在无强依赖的阶段。

## 亮点 10：物料自动解析与 AJV 校验

**业务价值：**  
降低组件库接入低代码平台的成本，让已有业务组件可以快速进入物料体系。

**技术实现：**  
`material-parser` 执行 scan、parse、generate、validate 流程。支持 JS/TS 静态解析和 dynamic sandbox 解析，最后用 AJV 校验 ComponentMeta 协议。

**量化口径：**  
物料解析模块独立于核心 packages，是 2 个工具 modules 之一，可作为物料服务独立部署。

**可追问点：**  
动态解析的安全风险怎么处理？

**回答思路：**  
当前用 `vm2` 做 sandbox。企业落地应放到独立进程或容器，限制文件系统、网络和 CPU 时间，并对包来源和解析结果做审核。

## 亮点 11：requestIdleCallback 优化画布定位

**业务价值：**  
降低拖拽、滚动、选中时的卡顿，让大页面编辑更顺滑。

**技术实现：**  
`OffsetObserver` 用 `requestIdleCallback` 调度 DOM rect 计算，在浏览器空闲时间更新节点 offset。选中框、悬停框、拖拽辅助线复用定位结果。

**量化口径：**  
优化方向是减少高频 DOM 测量对主线程的抢占。面试时不要编造 FPS 数字，可以说“应通过拖拽帧率、选中响应、offset 计算耗时验证”。

**可追问点：**  
requestIdleCallback 不支持怎么办？

**回答思路：**  
提供 fallback，例如 setTimeout 或 requestAnimationFrame；对关键交互优先级要区分，必须立即更新的选中态不能完全依赖 idle。

## 亮点 12：可服务化的出码与物料能力

**业务价值：**  
把低代码平台从前端工具升级为企业研发基础设施，接入 schema 存储、物料中心、出码任务、发布流水线和审计。

**技术实现：**  
`code-generator` 可独立为出码服务，`material-parser` 可独立为物料解析服务。服务之间通过页面 schema、物料 schema 和生成结果结构通信。

**量化口径：**  
仓库已有 2 个独立工具 modules，天然适合作为服务化边界。code-generator 支持目录和 zip 输出，可对接 Git/CI/CD。

**可追问点：**  
如果接入 Redis、MQ、MySQL、ES 怎么设计？

**回答思路：**  
MySQL 存 schema 版本、物料元数据和任务记录；Redis 缓存高频物料 manifest、草稿和出码结果；MQ 异步处理批量出码、物料解析和发布通知；ES 做物料搜索。这是落地扩展方案，不是当前仓库已有实现。

## 亮点 13：React/Rax 双技术栈适配

**业务价值：**  
同一低代码协议可以服务不同前端运行时，降低平台切换或多端适配成本。

**技术实现：**  
项目提供 React renderer、Rax renderer、React simulator renderer、Rax simulator renderer。核心 schema 和 renderer-core 能力复用，具体运行时适配放在不同包中。

**量化口径：**  
支持 2 套渲染体系和 2 套内置出码方案。

**可追问点：**  
多技术栈适配的关键是什么？

**回答思路：**  
关键是协议层稳定，运行时差异下沉到 adapter/renderer；不要让业务 schema 绑定某个框架私有实现。

## 亮点 14：质量保障与测试样例沉淀

**业务价值：**  
低代码平台改动影响面大，测试样例能避免设计器模型和出码结果回归。

**技术实现：**  
仓库使用 Jest 和快照测试，designer 测试覆盖节点增删改、拖拽、模拟器、视口等；code-generator 用大量 test-cases 对比 expected 工程输出；material-parser 使用快照验证解析结果。

**量化口径：**  
仓库扫描到 72 个测试文件，code-generator 测试样例目录 265 个。

**可追问点：**  
出码结果怎么测试？

**回答思路：**  
用输入 schema + expected 目录做快照/文件对比。更进一步可以在 CI 中对生成工程执行 install/build/lint，验证不只是文本一致，还能编译运行。

## 亮点 15：真实边界清晰，避免后端技术堆砌

**业务价值：**  
面试时可信度更高。能说清项目真实能力，也能说清企业落地时后端该怎么补齐。

**技术实现：**  
当前仓库聚焦低代码前端引擎和 Node 工具链；后端能力通过服务化架构扩展，而不是在本仓库中伪造 Redis/MQ/DB 使用。

**量化口径：**  
当前仓库未发现 `pom.xml`、Spring Boot、Dubbo、Nacos、RocketMQ、Redis、MySQL、ES、MyBatis 代码或配置。

**可追问点：**  
为什么项目里没有后端，却还讲微服务？

**回答思路：**  
这里讲的是服务边界和落地架构。低代码 schema、物料 schema、出码任务天然可以拆成独立服务；真正使用 Java 中间件要看配套后端实现。当前仓库提供的是可服务化的核心能力。

## 最推荐面试主打的 6 个亮点

1. schema 协议驱动低代码全链路。
2. 微内核插件体系和 shell API 防腐层。
3. Project/DocumentModel/Node/Props 设计态模型分层。
4. 模拟器真实组件实例映射。
5. code-generator 出码插件流水线和 Web Worker 出码。
6. 多层缓存 + 响应式更新 + requestIdleCallback 性能优化。

