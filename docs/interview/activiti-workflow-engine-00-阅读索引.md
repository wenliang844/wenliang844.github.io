# Activiti 工作流平台面试材料阅读索引

源项目：`D:\java\lianqian\code\my\terminus-activiti`

本组文档专门基于 Activiti 7 工作流平台内核生成。为避免和目录中已有的其它项目面试材料混淆，文件统一使用 `activiti-workflow-engine-*` 前缀。

## 文档目录

1. `activiti-workflow-engine-01-项目深度分析文档.md`
   - 项目背景、整体架构、模块说明、核心链路、缓存设计、异步 Job、Connector、安全策略、优化方向。

2. `activiti-workflow-engine-02-简历项目经历.md`
   - Java 后端、平台服务、工作流审批、性能优化等不同方向的简历写法。

3. `activiti-workflow-engine-03-面试讲解稿.md`
   - 3 分钟、5 分钟、10 分钟三个可直接开口讲的版本。

4. `activiti-workflow-engine-04-面试问答库.md`
   - 覆盖架构、Spring Boot、MyBatis、缓存、Redis、MQ、ES、Dubbo/Nacos、事务、可靠性、扩展性和代码质量。

5. `activiti-workflow-engine-05-项目亮点包装.md`
   - 15 个可被追问的亮点，每个亮点包含业务价值、技术实现、可追问点和回答思路。

## 面试主线

建议主线：

> 这是一个基于 Activiti 7 的企业流程平台内核，不是普通 CRUD。它用 BPMN 2.0 把审批、工单、内容审核等业务流程配置化，通过 `ProcessRuntime/TaskRuntime` 暴露运行时 API，底层用 Command + Agenda 推进流程，用 MyBatis 持久化 ACT 表，用命令级 EntityCache 优化事务内查询，用 Connector 对接外部业务服务，用异步 Job 处理定时和异步节点。

## 重要口径

- 当前仓库实际包含 Java 11、Spring Boot 2.6.2、Spring Security、MyBatis 3.5.7、BPMN 2.0、H2/MySQL/Postgres/Oracle/MSSQL/DB2/HSQL 脚本。
- 当前仓库未直接接入 Dubbo、Nacos、RocketMQ、Redis、Elasticsearch、Trantor。面试中可以讲扩展点，不要说已经使用。
- 可量化数据来自代码扫描：4,874 个文件、2,836 个 Java 文件、801 个测试 Java 文件、66 个 POM、1,227 个 BPMN 资源、59 个扩展 JSON、20 个 spring.factories、30 个缓存 matcher、27 个 MyBatis 实体 XML、336 个 SQL 脚本。
