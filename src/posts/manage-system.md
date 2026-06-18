---
title: "智能分析预警平台：从视频采集到业务告警的后端重构实践"
titleEn: "Intelligent Analysis Alert Platform: Backend Refactor from Video Capture to Business Alerts"
shortTitle: "智能分析预警平台重构"
shortTitleEn: "Alert Platform Refactor"
slug: "manage-system"
date: 2025-09-16
eyebrow: "System Refactor"
summary: "围绕视频采集、算法识别、标准事实落库、规则判定和正式告警生成，复盘智能分析预警平台后端重构。"
summaryEn: "A backend refactor retrospective covering video capture, algorithm recognition, standard fact persistence, rule judgment and formal alert creation."
description: "智能分析预警平台从视频采集到业务告警闭环的后端重构实践。"
descriptionEn: "Backend refactor practice for an intelligent analysis alert platform from video capture to business alert loop."
cover: "/images/posts/manage-system.png"
tags: [Java, Spring Boot, 视频分析, 规则引擎, ONNX Runtime]
tagsEn: [Java, Spring Boot, Video Analysis, Rule Engine, ONNX Runtime]
---

## 一、项目概述

`znfx-backend-restruct` 是一个面向重点场所智能视频分析预警的后端重构项目。项目从 `QtCollection`、`intelligent-analysis`、`wsdc-znfx-intelligentAnalysis`、`wsdc-znfx-web` 等多个历史工程中演进而来，目标是把原本分散的采集、算法、规则、告警和业务展示能力，收敛成一条职责清晰、可独立构建、可独立部署、可持续演进的后端主链路。

项目核心链路可以概括为：

```text
视频/图片采集 -> 算法识别 -> 标准事实落库 -> 规则引擎判定 -> 正式告警生成 -> 业务展示与处置
```

从业务视角看，该系统不是单纯的算法服务，也不是单纯的告警系统，而是一套支撑重点场所监管、异常行为识别、告警闭环处置和统计分析的智能分析平台。

## 二、业务价值

### 1. 将人工巡查转为智能预警

传统重点场所监管主要依赖人工看屏、抽查录像和事后复盘，容易出现响应慢、漏检多、取证难的问题。项目通过摄像头接入、图片采集、目标检测、人脸识别、姿态识别、OCR 等能力，把原始视频画面转换为结构化事实，再由规则引擎判断是否形成业务预警。

系统可支撑的典型场景包括：

- 人员离岗、脱岗识别
- 单人审讯、无人看管、人员聚集等场所规则判断
- 手机、目标物、人员身份等事实识别
- 海康事件、自研算法事件、第三方事件统一出警
- 告警列表、详情、统计、导出和后续处置

这使业务从“人找异常”变成“系统主动发现异常”，提升重点场所监管的实时性和可追溯性。

### 2. 统一业务口径，降低历史系统治理成本

重构前，采集、算法、规则和正式告警分散在多个工程中，存在模块边界不清、数据语义混用、告警入口分散、历史直写逻辑较多等问题。重构后，项目明确了四层主链路：

- 采集层负责素材进入系统
- 算法层负责生成标准事实
- 规则层负责基于事实做规则判定
- 业务域负责正式告警、查询展示和开放接口

这种分层让系统可以在不中断业务的前提下渐进替换历史逻辑，降低联调、排障和功能扩展成本。

### 3. 从“告警结果表”升级为“标准事实主链”

项目不再把历史 `t_abnormal_record` 作为唯一事实来源，而是引入 `t_analysis_record` 和 `t_analysis_target` 两张标准分析表：

- `t_analysis_record` 承载分析批次、算法执行记录、执行状态和统计摘要
- `t_analysis_target` 承载目标级识别结果，包括目标类型、置信度、bbox、身份、事件和属性

这让系统具备了更强的表达能力，可以支持多目标、多算法、多角色、多场所规则聚合，为后续规则复杂化和算法扩展打下基础。

## 三、技术架构

项目采用 Maven 父工程多模块架构，一级模块包括：

| 模块 | 角色 | 核心职责 |
| --- | --- | --- |
| `znfx-shared-common` | 公共基础层 | 公共 DTO、工具类、MQ 组件、统一告警客户端 |
| `znfx-collection-service` | 采集服务 | 摄像头接入、抓拍、取图、生成待分析任务 |
| `znfx-algorithm-service` | 算法服务 | 算法调度、模型推理、标准事实落库、规则任务触发 |
| `znfx-rule-engine-service` | 规则引擎 | 事实消费、规则上下文构造、窗口聚合、命中判断 |
| `znfx-business-domain-service` | 业务域服务 | 告警创建、查询展示、海康接入、配置管理、开放接口 |

业务域内部进一步拆分为 `znfx-admin-web`、`znfx-analysis-strategy`、`znfx-equipment-manage`、`znfx-warning-verification`、`znfx-hik-platform`、`znfx-third-part` 等子模块，将设备、策略、告警核查、第三方接入等能力按业务边界拆开。

技术栈上，项目主要使用：

- Java + Spring Boot
- Spring Data JPA、MyBatis / MyBatis Plus
- MySQL、Druid 连接池、Liquibase
- RabbitMQ、Redis
- Caffeine 本地缓存
- Micrometer + Prometheus 指标
- JavaCV、OpenCV、ONNX Runtime GPU
- Python FastAPI、InsightFace、YOLO、Pose、OCR、onnxruntime-gpu

## 四、核心业务链路设计

### 1. 采集到待分析任务

采集服务负责接入摄像头、海康平台、NVR、RTSP 等数据源，获取图片或视频素材，并将其转化为待分析任务。待分析任务进入 `t_abnormal_record_temp` 或标准分析任务表后，由算法服务进行认领和消费。

这一层的设计原则是只负责“素材进入系统”，不做业务规则判断，也不直接生成正式告警。

### 2. 算法调度与标准事实落库

算法服务通过 `AlgorithmDispatchService` 统一调度算法。调度过程不再硬编码单一算法，而是通过：

- `t_algorithm_registry` 注册算法
- `t_rule_algorithm_rel` 绑定规则和算法
- `entryKey -> AlgorithmExecutor` 路由具体执行器

当前已内置的执行器包括：

- `YOLO_DETECT`：通用目标检测
- `POSE_PERSON_DETECT`：姿态补充人员检测
- `FACE_RECOGNIZE`：人脸识别与身份回流
- `OCR_RECOGNIZE`：OCR 文本识别

算法执行后统一输出 `StandardAnalysisResultDto` 和 `StandardAnalysisTargetDto`，再落库到 `t_analysis_record`、`t_analysis_target`。这样新增算法时，主要改动被收敛在执行器层，业务主链路和规则链路不用反复改造。
