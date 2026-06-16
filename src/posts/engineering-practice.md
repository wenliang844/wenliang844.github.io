---
title: "工程化习惯：多模块、Starter 与质量工具链"
shortTitle: "工程化习惯沉淀"
slug: "engineering-practice"
date: 2026-01-12
eyebrow: "Engineering"
summary: "把项目中反复出现的能力沉淀为公共组件、自动配置和检查流程，让交付质量更稳定。"
description: "多模块架构、Spring Boot Starter、数据库适配和质量工具链的工程化沉淀。"
tags: [Maven, Spring Boot Starter, Docker, Jenkins, JaCoCo]
---
今年的几个项目都反复证明一件事：工程化不是额外负担，而是复杂业务能持续迭代的底座。多模块、Starter、自动化测试和代码检查，最终都是为了减少隐性沟通成本。

## 沉淀方向

<ul class="insight-list">
<li><strong>公共组件：</strong>把搜索、通知、导入导出、流程接入等重复能力抽成可复用模块。</li>
<li><strong>自动配置：</strong>通过 <code>@ConfigurationProperties</code> 和 AutoConfiguration 暴露统一接入方式，业务侧只关心参数和接口。</li>
<li><strong>数据库适配：</strong>在 Kingbase/PostgreSQL 等环境里处理 SQL 函数、分页、字段类型和变更脚本兼容。</li>
<li><strong>质量工具：</strong>用 Checkstyle、JaCoCo 和 CI 流程把代码风格、测试覆盖和构建结果固定下来。</li>
</ul>

我现在越来越倾向于把“可维护性”拆成具体动作：边界清楚、命名稳定、配置统一、失败可排查。它们比宏大的架构词更可靠。
