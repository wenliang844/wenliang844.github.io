---
title: "Terminus LowCode Engine 项目介绍：面向企业级中后台的低代码引擎实践"
titleEn: "Terminus LowCode Engine: Enterprise Middle- and Back-Office Low-Code Practice"
shortTitle: "LowCode Engine 实践"
shortTitleEn: "LowCode Engine Practice"
slug: "lowcode-schema-codegen"
date: 2022-02-01
eyebrow: "LowCode"
summary: "从低代码协议、设计器内核、物料体系、渲染器到出码工具链，梳理企业级中后台低代码平台底座。"
summaryEn: "A low-code platform foundation covering protocol design, designer core, materials, renderers and code generation tooling."
description: "企业级中后台低代码引擎在 Schema、物料、渲染和出码链路上的实践复盘。"
descriptionEn: "A retrospective on enterprise low-code engine practice across schema, materials, rendering and code generation."
cover: "/images/posts/lowcode-schema-codegen.png"
tags: [TypeScript, React, 低代码, Schema, 代码生成]
tagsEn: [TypeScript, React, Low-Code, Schema, Code Generation]
---

## 一、项目概述

Terminus LowCode Engine 是一套面向企业级中后台场景的低代码技术体系，核心目标是通过统一的低代码协议、可扩展的设计器内核、物料体系、渲染器和出码工具链，帮助业务团队快速搭建页面、沉淀组件资产，并将低代码编排结果转化为可运行、可维护、可交付的前端工程。

从项目结构看，该工程采用 TypeScript + Lerna + Yarn Workspaces 的 monorepo 架构，将低代码平台拆分为引擎内核、设计器、编辑器骨架、插件体系、React/Rax 渲染器、模拟器、物料解析、代码生成等多个独立模块。整体设计遵循“最小内核、最强生态”的思路：内核只负责稳定的协议、生命周期、事件和扩展点，业务差异通过插件、物料和出码方案完成定制。

项目定位不是单一页面搭建工具，而是一个低代码平台底座。它可以支撑多个垂直业务低代码平台复用同一套引擎能力，降低重复造轮子的成本，并通过协议化资产流通提升企业内部研发效率。

## 二、业务价值

### 1. 降低中后台页面交付成本

传统中后台页面开发通常包含需求分析、组件选型、页面布局、表单/表格配置、接口联调、路由配置、工程初始化、构建发布等重复流程。Terminus LowCode Engine 将这些流程抽象为低代码 schema，通过拖拽编排和协议化描述完成页面构建，再由运行时渲染器或出码工具链生成可运行工程。

业务收益主要体现在：

- 页面搭建从“手写代码驱动”转向“schema 配置驱动”，减少重复 UI 和胶水代码。
- 常见表单、表格、详情、列表、运营配置页等中后台场景可以复用统一物料。
- 页面、组件、区块、工具函数、国际化配置等都可以进入平台资产体系，实现跨团队复用。
- 出码能力可以把低代码 schema 转换为 Ice.js、Rax 等工程代码，兼顾低代码效率和源码可维护性。

### 2. 提升业务平台复用能力

该项目明确强调可扩展能力，并已支撑近 100 个垂直低代码平台。对于企业内部而言，这意味着不同业务线不需要分别建设设计器、画布、插件、渲染器、物料解析和出码能力，而是可以基于统一引擎做差异化扩展。

这种模式带来的业务价值是：

- 新业务平台启动时只需要关注业务模型、物料和插件，而不是重新建设低代码底座。
- 组件协议和 schema 协议统一后，物料可以在多个平台间流通。
- 平台能力沉淀为统一 npm 包和插件，减少跨团队协作成本。
- 设计器能力、渲染能力和出码能力可以分别演进，降低系统升级风险。

### 3. 打通“搭建、预览、出码、发布”全链路

项目不仅提供设计器运行时能力，还提供物料解析模块和代码生成模块，形成完整闭环：

1. 物料解析：扫描组件源码，生成符合中后台组件描述协议的 JSON Schema。
2. 页面搭建：在设计器中基于物料完成页面编排。
3. 实时预览：通过 React/Rax renderer 和 simulator renderer 进行实时渲染。
4. 代码生成：将 schema 转换为可运行项目，支持服务端出码和浏览器 Web Worker 出码。
5. 工程发布：生成目录或 zip 包后接入 Git、CI/CD、发布系统。

这使低代码平台从“在线搭建工具”升级为“企业级研发生产链路”。

## 三、技术架构

### 1. Monorepo 模块化架构

项目采用 Lerna + Yarn Workspaces 管理多包，仓库中包含 15 个核心 packages 和 2 个 modules：

- `@alilc/lowcode-engine`：低代码引擎入口，负责初始化 editor、designer、skeleton、plugins、project、material 等核心对象。
- `@alilc/lowcode-designer`：设计器核心，包含文档模型、节点模型、拖拽、选中、插件管理等能力。
- `@alilc/lowcode-editor-core`：编辑器底层能力，提供全局上下文、配置、事件、响应式能力。
- `@alilc/lowcode-editor-skeleton`：编辑器布局骨架，承载顶部、左侧、右侧、主区域等工作台结构。
- `@alilc/lowcode-shell`：对外 API 封装，隔离内部实现细节。
- `@alilc/lowcode-react-renderer` / `@alilc/lowcode-rax-renderer`：运行时渲染器。
- `@alilc/lowcode-react-simulator-renderer` / `@alilc/lowcode-rax-simulator-renderer`：设计态模拟器渲染器。
- `@alilc/lowcode-plugin-designer` / `@alilc/lowcode-plugin-outline-pane`：内置设计器插件与大纲树插件。
- `@alilc/lowcode-types`：统一类型定义。
- `@alilc/lowcode-utils`：通用工具能力。
- `modules/material-parser`：物料入料模块。
- `modules/code-generator`：低代码 schema 出码模块。

这种拆分方式类似前端领域的“微内核 + 微服务化能力包”：每个模块围绕明确职责独立发布、独立测试、独立演进，平台层通过协议和插件机制进行集成。

### 2. 低代码协议驱动

项目实现了中后台前端基础搭建协议和中后台前端物料协议。协议是整个系统的核心边界：

- 设计器不直接依赖具体业务组件，而是依赖组件描述协议。
- 渲染器不关心页面来自哪个业务平台，而是消费统一 schema。
- 出码模块不关心搭建过程，只读取 schema 并转换为工程代码。
- 物料解析模块把源码组件转换为协议数据，使组件资产可被设计器识别。

协议化带来的核心收益是解耦。业务组件、设计器、渲染器、出码服务可以各自演进，只要保持 schema 协议兼容，就能在同一生态中流通。

### 3. 插件体系与微内核设计

设计器通过 `LowCodePluginManager` 管理插件生命周期，支持注册、初始化、禁用、删除、销毁、偏好配置和版本匹配。插件管理器内部使用 `pluginsMap` 做插件索引，注册时校验插件名、引擎版本和重复注册策略，初始化时通过依赖编排计算加载顺序。

这一设计有几个关键优势：

- 内核保持稳定，业务能力通过插件扩展。
- 插件之间可以声明依赖，平台启动时按拓扑顺序初始化。
- 插件可以被禁用或销毁，便于灰度、隔离和故障恢复。
- 通过 shell API 暴露能力，避免业务插件直接依赖内部复杂实现。

例如引擎启动时会自动注册组件元数据解析、默认 setter、默认面板、大纲树等内置插件；业务平台可以继续注册自定义插件，如权限控制、数据源面板、代码生成按钮、业务 DSL 面板、页面发布能力等。

### 4. 渲染器与模拟器设计

项目同时支持 React 和 Rax 两套渲染体系。React simulator renderer 在设计态承担非常关键的职责：

- 将 schema 转换为可交互的 React 组件树。
- 管理节点 id 与 React instance 的映射关系。
- 处理组件资源加载和异步 library 加载。
- 同步设计模式、设备类型、国际化、请求处理器、上下文工具等运行时信息。
- 支持设计器在画布上进行选中、拖拽、定位、节点查找等操作。
