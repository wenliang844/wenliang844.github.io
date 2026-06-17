# Terminus LowCode Engine 简历项目经历

> 使用建议：本仓库真实技术栈是 TypeScript 低代码引擎，不是 Java 后端项目。简历中不要写“使用 Spring Boot、Dubbo、Redis、RocketMQ、MySQL、MyBatis 开发本项目”，除非你在另一个配套后端仓库中确实做过这些能力。下面提供的版本可以按投递岗位选择其一或组合改写。

## 版本一：低代码平台 / 平台前端方向

**项目名称：企业级中后台低代码引擎平台**

**项目描述：**  
基于 TypeScript monorepo 构建企业级低代码引擎底座，覆盖物料解析、可视化设计器、schema 模型、设计态模拟器、运行态渲染器和源码出码工具链。平台通过统一低代码协议连接组件物料、页面搭建、实时预览和工程代码生成，面向中后台表单、表格、详情、配置页等高频场景提升研发效率。

**技术栈：**  
TypeScript、React、Rax、MobX、Lerna、Yarn Workspaces、Web Worker、Jest、AST 解析、AJV、低代码 schema、插件化架构。

**个人职责：**

- 参与低代码引擎整体架构梳理与模块拆分，围绕 `engine`、`designer`、`shell`、`renderer-core`、`code-generator` 建立清晰的协议边界和调用链路。
- 参与设计器核心模型建设，基于 `Project -> DocumentModel -> Node -> Props` 的分层模型承载页面 schema、节点树、属性、插槽、条件、循环、选区和历史记录。
- 参与插件体系和 shell API 设计，通过插件注册、依赖排序、生命周期管理和 API 门面隔离业务扩展与内核实现。
- 参与设计态模拟器能力建设，打通 schema 文档模型到 React/Rax 真实组件实例的映射，支持选中、拖拽、定位和实时预览。
- 参与性能优化，使用 Map 索引、MobX 响应式更新、requestIdleCallback、Web Worker 出码和 AssetLoader/CDN 资源加载降低复杂页面编辑和出码成本。

**核心成果：**

- 支撑一个 15 个核心 packages、2 个工具 modules 的低代码引擎 monorepo，仓库包含 1034 个 TS/JS/TSX/JSX 源码文件和 72 个测试文件。
- 打通物料入料、页面搭建、实时预览、运行态渲染和源码出码完整链路。
- 支持 React/Rax 双渲染体系和 Ice.js/Rax 双出码方案。
- 出码模块沉淀 74 个插件源码和 265 个测试样例目录，提升生成链路可扩展性和可验证性。

## 版本二：低代码出码 / 工程化方向

**项目名称：低代码 Schema 源码出码工具链**

**项目描述：**  
建设低代码 schema 到标准前端工程的代码生成链路，支持 Ice.js、Rax 等工程方案，将在线搭建产物转化为可二次开发、可版本管理、可接入 CI/CD 的源码工程，解决低代码产物难维护、难交付的问题。

**技术栈：**  
TypeScript、Node.js、Web Worker、AST/模板生成、插件流水线、Lerna、Jest、Ice.js、Rax。

**个人职责：**

- 参与 `code-generator` 架构分析和链路建设，围绕 `SchemaParser -> ProjectBuilder -> ModuleBuilder -> ChunkBuilder -> CodeBuilder -> Publisher` 拆分出码职责。
- 参与 schema 解析与工程生成逻辑梳理，提取页面、组件、路由、依赖、工具函数、国际化和 package 配置等工程信息。
- 参与插件化出码方案设计，通过 chunk 和 plugin pipeline 将页面代码、组件代码、样式、路由、入口、依赖配置等生成逻辑解耦。
- 参与浏览器端出码优化，将重计算任务放入 Web Worker，并通过 Worker 脚本缓存、超时控制和 terminate 机制降低主线程阻塞与资源泄漏风险。
- 参与 publisher 设计，支持生成目录和 zip 包，便于对接 Git、CI/CD、发布系统或在线下载。

**核心成果：**

- 支持 CLI、Node 调用、浏览器 Web Worker、设计器插件集成等多种出码形态。
- 支持 Ice.js 和 Rax 两套内置 solution，并可通过插件扩展新的工程规范。
- 出码插件源码达到 74 个，测试样例目录 265 个，覆盖 React app、Rax app、React module 等多种生成场景。
- 通过 `Promise.all` 并行生成页面/组件模块，减少多页面项目端到端出码等待。

## 版本三：物料工程 / 组件平台方向

**项目名称：低代码组件物料解析与入料系统**

**项目描述：**  
建设组件物料解析模块，将已有 React/Rax 组件库解析为低代码组件描述协议，为设计器物料面板、属性设置器和出码链路提供标准化组件元数据，降低组件库接入低代码平台的成本。

**技术栈：**  
TypeScript、JavaScript/TypeScript AST、propTypes/defaultProps 解析、动态 sandbox、vm2、AJV、JSON Schema、Node.js。

**个人职责：**

- 参与 `material-parser` 解析链路设计，完成组件包扫描、源码解析、动态元数据加载、物料协议生成和协议校验的流程梳理。
- 参与 JS/TS 解析能力建设，识别组件属性、默认值、描述、子组件、导入依赖等信息。
- 参与动态解析方案设计，通过 sandbox 执行组件元信息获取逻辑，并结合 AJV 校验保障物料 manifest 合法性。
- 参与解析性能优化，通过 import resolver cache、AST cache、definition cache 减少重复文件和重复类型解析。
- 参与物料协议与设计器消费链路对接，使组件元数据可被设计器识别并用于属性面板、拖拽搭建和运行态渲染。

**核心成果：**

- 将组件源码到低代码 ComponentMeta 的链路自动化，降低人工维护物料 JSON 的成本。
- 支持静态解析和动态解析两类入料方式，适配不同组件库组织形式。
- 使用 AJV 校验物料协议，避免异常组件描述进入设计器导致搭建或渲染异常。
- 通过多级解析缓存降低批量组件入料的重复 AST 解析成本。

## 版本四：平台服务化 / 后端面试辅助方向

**注意：** 这一版适合你投递后端或平台服务岗位时作为“低代码平台服务化设计”表达，不能直接写成“当前仓库已实现 Java 微服务”。当前仓库没有 Spring Boot、Dubbo、Nacos、RocketMQ、Redis、MySQL、ES、MyBatis 代码。

**项目名称：低代码平台出码与物料服务化设计**

**项目描述：**  
围绕低代码引擎的 schema 协议、出码工具链和物料解析能力，设计可服务化的低代码平台后端架构。将 schema 存储、物料中心、出码任务、发布记录、权限审计等能力拆分为独立服务，为前端设计器提供稳定的工程化交付支撑。

**技术栈：**  
低代码 schema、Node.js code-generator、material-parser、MySQL、Redis、MQ、对象存储、CI/CD、服务注册与配置中心。若真实落地为 Java，可补充 Spring Boot、MyBatis、Dubbo/Nacos、RocketMQ、Elasticsearch。

**个人职责：**

- 基于低代码 schema 设计页面版本、草稿、发布记录和回滚模型，保障页面搭建产物可追踪、可审计、可恢复。
- 设计出码任务中心，将 `code-generator` 作为独立任务执行器，支持异步出码、状态查询、失败重试、产物归档和 CI/CD 触发。
- 设计物料中心，将 `material-parser` 解析结果沉淀为组件元数据，支持版本管理、权限控制、搜索和缓存。
- 设计缓存与异步机制，使用 Redis 缓存高频物料 manifest、schema 草稿和出码结果，使用 MQ 解耦批量出码、物料解析和发布通知。
- 设计可靠性方案，包括任务幂等、超时终止、失败重试、版本锁定、灰度发布和操作审计。

**核心成果：**

- 把低代码前端引擎能力延展为可落地的平台服务架构，形成设计器、物料服务、出码服务、发布系统之间的协议边界。
- 通过异步任务和缓存设计降低大 schema 出码、批量物料解析对在线编辑链路的影响。
- 支持将低代码产物纳入 Git、CI/CD、权限审计和版本管理流程，提升企业级可运维性。

## 简历 Bullet 可直接摘用

- 参与企业级低代码引擎建设，基于 TypeScript monorepo 拆分 engine、designer、shell、renderer、simulator、code-generator、material-parser 等模块，打通物料入料、页面搭建、实时预览、运行态渲染和源码出码链路。
- 参与设计器核心模型设计，基于 `Project -> DocumentModel -> Node -> Props` 分层管理低代码 schema，支持拖拽、选区、属性编辑、插槽、条件、循环、撤销重做等复杂设计态能力。
- 参与插件化架构建设，通过插件生命周期、依赖排序、版本校验和 shell API 门面隔离业务插件与引擎内核，提高平台扩展性和稳定性。
- 参与性能优化，使用 Map 索引缓存节点/文档/组件元数据/渲染实例，结合 MobX 响应式更新、requestIdleCallback 和 Web Worker 出码降低复杂页面编辑与出码阻塞。
- 参与低代码出码链路建设，基于 `SchemaParser -> ProjectBuilder -> ChunkBuilder -> Publisher` 分层生成 Ice.js/Rax 工程，支持浏览器 Worker、Node 调用、目录和 zip 输出。
- 参与组件物料解析能力建设，支持 JS/TS 静态解析、动态 sandbox 解析和 AJV 协议校验，将组件库自动转换为低代码 ComponentMeta。

## 不建议写进简历的说法

- 不建议写：“使用 Spring Boot + Dubbo + RocketMQ + Redis 开发低代码引擎核心链路。”当前仓库无证据。
- 不建议写：“负责 MySQL 表设计和 MyBatis DAO 开发。”当前仓库无后端持久化代码。
- 不建议写：“通过 Redis 将接口 QPS 提升 300%。”当前仓库没有 Redis 和接口压测数据。
- 不建议写：“系统已支撑百万用户/千万 QPS。”当前仓库没有相关线上数据。

更稳的替代表述：

> 当前仓库主要是低代码前端引擎和工具链。我重点讲的是协议设计、设计器模型、插件扩展、渲染链路、出码链路、缓存和性能优化。如果面试官关注后端，我会补充如何把 schema、物料和出码能力服务化，而不会把仓库没有的 Java 中间件说成已实现。

