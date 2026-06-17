# Terminus LowCode Engine 面试讲解稿

> 说明：下面是可直接照着讲的版本。你可以根据真实经历把“我主要参与”替换成你实际负责的模块。当前仓库是 TypeScript 低代码引擎，不是 Java 后端项目，所以讲解中会把后端中间件放在“落地扩展方案”里，而不是说成已实现代码。

## 3 分钟版本

面试官您好，我介绍一下我准备的这个项目。它是一个企业级中后台低代码引擎，核心目标是把常见的表单、表格、详情页、配置页这些重复开发场景，从手写页面代码转成基于 schema 的可视化搭建，并且能进一步生成可维护的前端工程代码。

这个项目不是单页面应用，而是一个 TypeScript monorepo。仓库里有 15 个核心 packages 和 2 个工具 modules，包含 1000 多个 TS/JS 相关源码文件、70 多个测试文件。核心模块包括 `engine`、`designer`、`shell`、`renderer-core`、React/Rax 渲染器、模拟器渲染器、`code-generator` 和 `material-parser`。

我理解它的主线是“协议驱动 + 微内核 + 双出口”。协议驱动是指设计器、渲染器、物料和出码都围绕低代码 schema 工作；微内核是指引擎内核只保留编辑器上下文、生命周期、事件和模型，业务差异通过插件扩展；双出口是指 schema 一方面可以被 renderer 直接运行时渲染，另一方面可以被 code-generator 生成 Ice.js 或 Rax 工程。

我重点关注的是设计器核心模型和工程化链路。设计器内部不是直接操作 JSON，而是把页面 schema 转成 `Project -> DocumentModel -> Node -> Props` 这种响应式模型。`DocumentModel` 维护节点索引，`Node` 表示组件节点，`Props` 表示属性、表达式、插槽等复杂值，`History` 通过 MobX reaction 监听 schema 变化实现撤销重做。这样拖拽、选中、属性配置、插槽、条件、循环这些设计态能力才能稳定承载。

性能上，这个项目做了不少工程优化。比如用多层 Map 缓存文档、节点、插件、组件元数据和组件实例，避免每次递归扫描 schema 树；用 `requestIdleCallback` 做画布节点位置计算，减少拖拽和滚动时的主线程压力；出码模块支持 Web Worker，把 schema 解析和工程生成放到后台线程，避免阻塞设计器 UI；项目生成时还会用 `Promise.all` 并行生成多个页面或组件模块。

如果要讲业务成果，我会说它打通了低代码平台最关键的闭环：物料解析、页面搭建、实时预览、运行态渲染、源码出码。可量化的仓库指标是 15 个核心包、2 个工具模块、74 个出码插件源码、265 个出码测试样例目录，并支持 React/Rax 双渲染体系和 Ice.js/Rax 双出码方案。它解决的核心业务问题是降低中后台重复页面开发成本，同时让低代码产物能够进入标准工程化交付流程。

## 5 分钟版本

我介绍的项目是 `terminus-lowcode-engine`，它的定位是企业级中后台低代码引擎底座。它不是一个普通前端页面，也不是 Java 微服务仓库，而是一套围绕低代码 schema 构建的设计器、渲染器、物料解析和源码出码工具链。

这个项目的业务背景是，中后台系统里有大量重复页面，比如列表、表单、详情、配置页、运营页。传统开发每次都要重复写布局、组件属性、数据源绑定、路由、工程配置和发布流程。低代码引擎要解决的问题，就是把这些重复工作沉淀成组件物料和 schema 协议，让业务通过拖拽和配置完成页面搭建，同时保留出码能力，方便后续进入 Git、CI/CD 和人工维护。

从工程规模看，它是 TypeScript monorepo，使用 Lerna 和 Yarn Workspaces 管理。核心有 15 个 packages，包括 `engine`、`designer`、`editor-core`、`editor-skeleton`、`shell`、React/Rax renderer、React/Rax simulator renderer、插件包、types 和 utils；另外有两个工具模块：`code-generator` 和 `material-parser`。仓库里可统计到 1034 个 TS/JS/TSX/JSX 源码文件、72 个测试文件、74 个出码插件源码和 265 个出码测试样例目录。

架构上我会用三层来讲。第一层是协议层，页面用低代码 schema 描述，组件用物料 schema 描述。第二层是设计态，核心是 `designer` 包，里面的 `Project` 管理项目级文档，`DocumentModel` 管理单个页面，`Node` 表示组件节点，`Props/Prop` 表示属性模型，`History` 管理撤销重做，`Dragon` 管理拖拽。第三层是输出层，一个方向是 renderer-core 加 React/Rax renderer 做运行态渲染，另一个方向是 code-generator 生成源码工程。

这里面我认为最关键的设计是 schema 到设计态模型的转换。低代码页面最终保存为 JSON，但编辑态不能直接改 JSON，因为设计器有很多复杂交互：拖拽节点、选中节点、编辑属性、配置插槽、条件渲染、循环渲染、撤销重做、大纲树同步、模拟器定位。如果直接在 JSON 上操作，会导致状态难维护、查找成本高、历史记录难做。所以项目把 schema 转成响应式模型，并用 `_nodesMap` 做节点索引，用 Props 模型处理复杂属性，用 History 监听导出的 schema 变化。

第二个重点是插件体系。`PluginManager` 负责插件注册、初始化、销毁、禁用、依赖排序和版本检查。业务平台通过插件扩展面板、设置器、物料、发布能力，而不是直接改内核。对外 API 也不是直接暴露 designer 内部类，而是通过 `shell` 包做门面封装。这个设计让低代码平台具备可扩展性，也降低业务插件和内核的耦合。

第三个重点是设计态模拟器。模拟器不是简单 iframe 预览，它要把 schema 渲染成真实 React/Rax 组件，同时还要支持选中、悬停、拖拽定位和节点实例反查。`BuiltinSimulatorHost` 负责 iframe、资源、环境和事件桥接，`react-simulator-renderer` 里有 `instancesMap` 和 `documentInstanceMap`，用于缓存节点 id 到真实组件实例的关系。这样设计器点击画布时，才能从 DOM/组件实例反查到低代码 Node。

性能优化方面，我会重点讲四点。第一，多层 Map 缓存，包括插件、文档、节点、组件元数据、渲染实例、物料解析 AST 缓存，降低高频查找成本。第二，MobX computed、reaction、autorun 做精细化响应式更新，避免全量刷新。第三，画布位置计算用 `requestIdleCallback`，减少拖拽和滚动过程的主线程抢占。第四，出码支持 Web Worker，schema 解析和工程生成放到后台线程，并且有 worker 脚本缓存、超时和 terminate 机制。

出码链路也是一个亮点。`code-generator` 按 `SchemaParser -> ProjectBuilder -> ModuleBuilder -> ChunkBuilder -> CodeBuilder -> Publisher` 分层。`SchemaParser` 解析页面、依赖、路由和工具函数；`ProjectBuilder` 做项目级编排，并行生成多个页面模块；`ChunkBuilder` 运行插件流水线；`Publisher` 输出磁盘目录或 zip。它内置 Ice.js 和 Rax 两套 solution，也支持自定义扩展。

如果面试官问 Redis、MQ、MySQL、Dubbo 这些后端技术，我会如实说明当前仓库没有这些实现。我的理解是，这个仓库提供的是低代码前端引擎和工具链。如果做企业级落地，可以把 schema 存储、物料中心、出码任务和发布流水线拆成后端服务：MySQL 存页面版本和物料元数据，Redis 缓存物料 manifest 和草稿，MQ 异步处理批量出码和物料解析，ES 做物料搜索，Nacos/Dubbo 或 HTTP 网关做服务治理。这是服务化落地方案，不是当前仓库已有代码。

总结一下，这个项目的价值是把低代码从“拖拽页面工具”提升成一套工程化平台：前面有物料入料，中间有设计器和模拟器，后面有运行态渲染和源码出码。它的技术深度主要体现在协议驱动、模型分层、插件微内核、模拟器实例映射、出码流水线和多层性能优化。

## 10 分钟版本

我介绍一下 `terminus-lowcode-engine`。这是一个企业级中后台低代码引擎项目，核心目标是解决中后台页面重复开发的问题。传统业务系统中，列表、表单、详情、配置页非常多，开发过程里大量工作是重复的：布局、组件组合、属性配置、接口绑定、路由配置、工程初始化和发布接入。这个项目的思路是把页面抽象成统一 schema，把组件抽象成物料协议，让设计器、渲染器和出码工具链都围绕协议工作。

先讲项目全景。它是 TypeScript monorepo，用 Lerna 4 和 Yarn Workspaces 管理。仓库下有 15 个核心 packages 和 2 个工具 modules。15 个 packages 里，`engine` 是入口和装配层，`editor-core` 提供上下文、配置、事件和 setter 注册，`designer` 是设计器核心，`editor-skeleton` 是工作台布局，`shell` 是对外 API 门面，`renderer-core` 是运行态渲染核心，React/Rax renderer 负责不同技术栈的渲染，React/Rax simulator renderer 负责设计态预览，另外还有内置插件、types 和 utils。两个 modules 是 `code-generator` 和 `material-parser`，分别负责源码出码和组件物料解析。

量化上，这个仓库有 1034 个 TS/JS/TSX/JSX 源码文件，72 个测试文件，出码插件源码 74 个，出码测试样例目录 265 个。它支持 React 和 Rax 两套渲染体系，内置 Ice.js 和 Rax 两套出码方案。这个规模说明它不是 demo，而是一个完整的低代码平台底座。

整个架构可以概括成“协议中心、微内核设计器、渲染和出码双出口”。协议中心是指页面 schema 和组件物料 schema。设计器不依赖具体业务组件，而是消费组件描述协议；渲染器不关心页面来自哪个业务平台，只消费 schema；出码模块也不关心搭建过程，只读取 schema 生成工程。这个协议边界让不同模块可以独立演进。

微内核设计器主要体现在 `engine`、`designer`、`shell` 和插件体系。`engine` 负责初始化 editor、designer、skeleton 和 plugin manager，并暴露 Project、Material、Setters、Event、Hotkey 等 API。`designer` 负责核心模型和交互，包括 Project、DocumentModel、Node、Props、Selection、History、Dragon。`shell` 包是 API 门面，它把内部复杂类包装成稳定接口，避免业务插件直接依赖内部实现。插件体系通过 `PluginManager` 管理插件注册、初始化、销毁、禁用、依赖排序和版本校验，这就是典型的前端微内核设计。

我重点讲设计器模型。低代码页面最终保存的是 JSON schema，但编辑器内部不能直接操作 JSON。原因是设计态有大量复杂交互，比如拖拽、选中、属性面板、插槽编辑、条件渲染、循环渲染、锁定隐藏、撤销重做、模拟器定位和大纲树同步。如果直接改 JSON，状态会散，查找节点也需要频繁递归树。所以项目把 schema 转成 `Project -> DocumentModel -> Node -> Props/Prop -> NodeChildren` 的响应式模型。

其中 `Project` 管理项目级文档、项目 schema、i18n 和配置；`DocumentModel` 管理单个页面，维护 `_nodesMap`，提供节点创建、插入、删除、导入导出；`Node` 表示组件节点，里面有 componentName、props、children、condition、loop、hidden、locked、slots 等信息；`Props/Prop` 表示属性模型，既支持字面量，也支持对象、数组、表达式和插槽；`NodeChildren` 负责子节点集合。这个分层让每个设计态概念都有明确的模型承载。

撤销重做也比较有意思。`History` 用 MobX reaction 监听导出的 schema，当 schema 变化时记录历史，内部按 timeGap 合并一段连续操作，避免用户拖拽或连续输入时产生过多历史点。这样用户体验更接近真实编辑器，而不是每个微小变动都变成一次撤销。

拖拽链路主要在 `Dragon`。它负责传感器、拖拽事件和 DropLocation。用户从物料面板拖入组件时，Dragon 计算投放位置，DocumentModel 创建 Node，NodeChildren 插入子节点，Props 初始化属性，History 记录变化，模拟器同步渲染。这里难点是拖拽不只发生在主文档，还要跨 iframe 模拟器，所以定位、事件桥接和坐标转换都比较复杂。

设计态模拟器是第二个技术重点。很多人会把它理解成 iframe 预览，但它比预览复杂得多。模拟器既要真实渲染业务组件，又要支持设计器交互。`BuiltinSimulatorHost` 管理 iframe、资源、环境变量、library、theme、runtime、上下文、热键和事件。`react-simulator-renderer` 加载资产后用 `buildComponents` 构建组件映射，再用 `LowCodeRenderer` 渲染 schema。它还维护 `instancesMap`，把低代码节点 id 映射到真实 React instance；维护 `documentInstanceMap`，复用不同文档的实例。这样点击画布时，设计器能从 DOM 或组件实例反查到 Node，进而更新选中框和属性面板。

运行态渲染则集中在 `renderer-core`。它负责把 schema 渲染为真实组件树，支持 condition、loop、JSSlot、JSExpression、生命周期、自定义方法和数据源。数据源部分由 `DataHelper` 管理，支持 fetch/jsonp、初始化加载、请求前后处理和状态维护。渲染器还有 fallback 组件，用于组件异常时兜底，避免低代码页面整页白屏。

再讲出码链路。低代码平台经常被质疑“产物只能在线运行、不可维护”。这个项目用 `code-generator` 解决这个问题。它的流程是 `SchemaParser -> ProjectBuilder -> ModuleBuilder -> ChunkBuilder -> CodeBuilder -> Publisher`。`SchemaParser` 负责校验和解析 schema，提取 containers、dependencies、router、utils、packages；`ProjectBuilder` 负责项目级编排，生成页面、组件、路由、入口、样式、package.json 等模块；`ModuleBuilder` 生成单个模块；`ChunkBuilder` 运行插件流水线，把 schema 转成代码片段；`CodeBuilder` 按依赖关系链接 chunk；`Publisher` 输出到磁盘或 zip。

出码模块有几个性能和工程化设计。第一，页面和组件模块之间没有强依赖，所以 `ProjectBuilder` 用 `Promise.all` 并行生成，降低多页面项目等待时间。第二，浏览器出码通过 Web Worker 执行，避免 schema 解析和代码生成阻塞设计器主线程。第三，`standalone-loader` 维护 worker 脚本缓存，同一个 worker URL 不重复 fetch 和创建 Blob。第四，worker 有默认超时和 terminate，异常任务不会长期占用资源。

物料解析模块 `material-parser` 是低代码平台的入口能力之一。业务组件库要进入设计器，需要变成 ComponentMeta。它的链路是 scan 扫描包信息，parse 解析 JS/TS 或动态元数据，resolver 解析 import、propTypes、defaultProps、子组件，generate 生成物料协议，validate 用 AJV 校验。它还有 AST cache、import cache 和 definition cache，减少批量解析时的重复工作。动态解析用 `vm2` sandbox，这里也有安全边界，企业落地时最好放在独立进程或容器里执行。

性能优化我一般会讲五个点。第一是 Map 缓存，DocumentModel 的 `_nodesMap`、Project 的 documentsMap、PluginManager 的 pluginsMap、Designer 的 componentMetasMap、Simulator 的 instancesMap 都是为高频查找准备的。低代码页面是树结构，如果每次操作都递归扫描，复杂页面会卡。第二是响应式更新，MobX computed、reaction、autorun 让模型变化只触发相关更新。第三是 requestIdleCallback，OffsetObserver 把 DOM rect 计算放到浏览器空闲时间，降低拖拽和滚动时的压力。第四是 Web Worker 出码，避免主线程阻塞。第五是 AssetLoader 和 CDN/UMD 外置，组件库资源可以动态加载和复用缓存，减少业务包体积。

缓存设计方面，我不会说 Redis，因为仓库没有 Redis。这里主要是编辑器内存态缓存和工具链缓存：插件 Map、文档 Map、节点 Map、属性 Map、组件元数据 Map、渲染实例 Map、大纲树 Map、AST/import cache、workerJsCache。这些缓存的共同目标是降低高频编辑、节点定位、组件查找、物料解析和出码资源加载的重复成本。

如果面试官问微服务，我会如实说明当前仓库不是 Spring Boot/Dubbo 微服务项目。但它具备服务化边界。`code-generator` 可以独立成出码服务，设计器提交 schema，服务端校验、生成 zip 或工程目录，再推送 Git 或触发 CI。`material-parser` 可以独立成物料入料服务，接收 npm 包或 Git 地址，解析后把 ComponentMeta 存入物料中心。企业落地时可以用 MySQL 存 schema 版本和任务记录，用 Redis 缓存物料 manifest 和草稿，用 MQ 处理异步出码和批量物料解析，用 ES 做物料搜索，用 Nacos/Dubbo 或 HTTP 网关做服务治理。但这些是落地扩展，不是当前仓库内已有实现。

项目风险和优化方向也可以讲。第一，`BuiltinSimulatorHost` 职责比较重，后续可以拆成 iframe lifecycle、resource manager、instance registry、event bridge。第二，动态物料解析需要安全隔离，最好容器化并限制权限。第三，表达式执行可以做编译缓存和安全白名单。第四，History 里有本地持久化 TODO，可以补 localStorage 或 IndexedDB 草稿恢复。第五，出码 solution 中的框架依赖和模板需要配置化和版本治理。

最后总结，这个项目的核心价值不是某个页面功能，而是一套平台能力。它用 schema 协议打通物料、设计器、渲染器和出码；用微内核插件体系支撑业务扩展；用设计态模型承载复杂编辑交互；用模拟器连接 schema 和真实组件实例；用 code-generator 解决低代码产物工程化交付；再通过多层缓存、响应式更新、Worker 出码和空闲调度提升复杂页面体验。这些点就是我在面试里最想重点展开的内容。

## 30 秒收尾版本

一句话讲，这个项目是一套低代码平台底座，不是普通页面应用。它最核心的是 schema 协议、设计器模型、插件体系、模拟器渲染和源码出码。我的讲解重点会放在三条线上：第一，业务上如何降低中后台重复页面开发成本；第二，架构上如何用协议和插件支撑多平台复用；第三，技术上如何通过缓存、响应式更新、Worker 出码和空闲调度解决复杂页面性能问题。

