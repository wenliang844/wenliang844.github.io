---
title: "Activiti 审批流：轻量 BPM 引擎封装"
shortTitle: "Activiti 审批流封装"
slug: "activiti-workflow-engine"
date: 2026-02-24
eyebrow: "Workflow"
summary: "基于 Activiti 7 封装流程部署、任务运行、变量管理和流程图能力，让业务审批更容易接入。"
description: "基于 Activiti 7 的轻量 BPM 工作流引擎封装与工程实践。"
tags: [Java 11, Spring Boot, Activiti 7, BPMN 2.0, MyBatis]
---
审批流项目的目标不是做一个“大而全”的 BPM 平台，而是把业务系统最常用的流程能力整理成稳定、轻量、可接入的工程模块。

## 封装范围

<ul class="insight-list">
<li><strong>多模块结构：</strong>拆分 API、核心引擎、公共组件和示例工程，避免业务直接感知引擎内部细节。</li>
<li><strong>Starter 接入：</strong>通过 Spring Boot Starter 支持 BPMN 资源自动加载、流程部署和运行时配置。</li>
<li><strong>任务能力：</strong>封装任务查询、办理、变量管理、流程实例状态和业务状态同步。</li>
<li><strong>质量保障：</strong>引入 Checkstyle、JaCoCo、Surefire/Failsafe，让工作流这种状态复杂的模块更可控。</li>
</ul>

流程引擎最容易被低估的是“状态一致性”。监听器、业务表状态和流程实例状态必须有明确边界，否则排查会非常痛苦。
