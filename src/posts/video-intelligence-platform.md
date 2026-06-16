---
title: "视频智能侦测系统：从采集到正式告警的链路重构"
titleEn: "Video Intelligence System: Refactoring the Pipeline from Capture to Formal Alerts"
shortTitle: "视频智能侦测系统重构"
shortTitleEn: "Video Intelligence System Refactor"
slug: "video-intelligence-platform"
date: 2026-06-16
eyebrow: "System Refactor"
summary: "围绕“采集 -> 算法 -> 规则 -> 正式告警”重整后端结构，让智能分析链路从能跑变成好维护、好扩展、好迁移。"
summaryEn: "A backend refactor around the capture -> algorithm -> rules -> formal alert pipeline, turning a runnable intelligent-analysis flow into one that is easier to maintain, extend and migrate."
description: "围绕采集、算法、规则和正式告警的视频智能侦测系统后端重构复盘。"
descriptionEn: "A backend refactor retrospective for a video intelligence system covering capture, algorithms, rules and formal alerts."
tags: [Java, Spring Boot, Maven 多模块, ONNX Runtime, RabbitMQ]
tagsEn: [Java, Spring Boot, Maven multi-module, ONNX Runtime, RabbitMQ]
contentEn: |
  One of the most valuable things to review this year was reorganizing the scattered capture service, algorithm service, rule engine and business alert entry point in the video intelligence system into a clearer backend project. This was not just a directory reshuffle; it was a chance to decide where data should be produced, persisted and interpreted.

  ## Refactor Focus

  <ul class="insight-list">
  <li><strong>Module boundaries:</strong> Split shared capabilities, capture, algorithms, rules and business domains under a Maven parent project to reduce direct cross-module dependencies.</li>
  <li><strong>Data layering:</strong> Persist analysis tasks, standard analysis results, compatibility facts and formal alerts in separate layers, so legacy table structures no longer absorb new business meaning.</li>
  <li><strong>Algorithm platformization:</strong> Support algorithm registration, rule-to-algorithm binding, pluggable executors and unified result writing, leaving extension points for face, pose, object detection, OCR and other capabilities.</li>
  <li><strong>Migration strategy:</strong> Run the new pipeline on standard analysis results while keeping the old fact pipeline as a fallback to reduce business risk during the refactor.</li>
  </ul>

  The biggest reminder from this work is that refactoring a complex system is not just about making the new architecture look elegant. It matters more to stabilize the key terms across the pipeline. Once naming becomes stable, APIs, table structures and troubleshooting paths gradually become stable too.
---
今年最值得复盘的一件事，是把视频智能侦测系统里分散的采集服务、算法服务、规则引擎和业务告警入口重新梳理成一个更清晰的后端工程。它不是单纯换目录，而是重新确认数据应该在哪里产生、在哪里沉淀、在哪里被解释。

## 重构重点

<ul class="insight-list">
<li><strong>模块边界：</strong>用 Maven 父工程拆出公共能力、采集、算法、规则和业务域模块，减少跨模块直接依赖。</li>
<li><strong>数据分层：</strong>将待分析任务、标准分析结果、兼容事实和正式告警分层落库，避免历史表结构继续吞掉新业务语义。</li>
<li><strong>算法平台化：</strong>支持算法注册、规则绑定算法、执行器插件化和统一结果写入，为人脸、姿态、目标检测、OCR 等能力留扩展口。</li>
<li><strong>迁移策略：</strong>新链路基于标准分析结果运行，旧事实链路保留兜底，降低重构期间的业务风险。</li>
</ul>

这次经验给我的最大提醒是：复杂系统的重构不只追求“新架构漂亮”，更重要的是把链路上的关键名词固定下来。命名稳定了，接口、表结构和排查路径才会慢慢稳定。
