---
title: "低代码平台：Schema、物料与出码链路"
shortTitle: "低代码 Schema 与出码"
slug: "lowcode-schema-codegen"
date: 2026-03-22
eyebrow: "LowCode"
summary: "从设计器、物料协议到 Web Worker 出码，把页面搭建能力组织成可扩展的平台工程。"
description: "低代码平台中设计器、Schema、物料协议与 Web Worker 出码链路的实践复盘。"
tags: [TypeScript, React, MobX, LowCode Schema, Web Worker]
---
低代码平台最有意思的地方，是它同时包含编辑器交互、协议设计、工程生成和运行时渲染。做这类项目时，前后端边界会变得更开放，也更考验抽象是否克制。

## 链路拆解

<ul class="insight-list">
<li><strong>设计器核心：</strong>围绕 designer、editor-core、editor-skeleton 实现画布搭建、节点选中、拖拽编排、面板扩展和插件注册。</li>
<li><strong>Schema 渲染：</strong>将页面描述转换成 React/Rax 可运行视图，覆盖属性、插槽、条件渲染、循环渲染和数据源绑定。</li>
<li><strong>物料体系：</strong>扫描组件源码并提取属性、类型定义和元信息，生成中后台搭建所需的 JSON Schema。</li>
<li><strong>出码能力：</strong>支持浏览器端 Web Worker 出码和服务端出码，满足预览、下载和工程化交付。</li>
</ul>

低代码不是把代码藏起来，而是把重复的工程决策模板化。真正有价值的部分，是让业务页面更快落地，同时保留工程可维护性。
