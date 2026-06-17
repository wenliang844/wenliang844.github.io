# Terminus LowCode Engine 面试材料阅读索引

生成时间：2026-06-17  
源码目录：`D:\java\lianqian\code\my\terminus-lowcode-engine`  
文档目录：`D:\java\lianqian\code\my\wenliang844.github.io\docs\interview`

## 先说结论

`terminus-lowcode-engine` 不是 Java Spring Boot 后端项目，也没有在当前仓库中发现 `pom.xml`、Controller、Service、DAO、Mapper、`application.yml`、Dubbo、Nacos、RocketMQ、Redis、MySQL、Elasticsearch、MyBatis、Trantor 等后端代码或配置。

它的真实定位是一套 TypeScript monorepo 低代码引擎：以 schema 协议为中心，提供设计器内核、插件体系、物料解析、React/Rax 渲染器、设计态模拟器和代码生成工具链。面试时最稳的讲法是把它定位为“企业级中后台低代码平台底座”，而不是“Java 微服务业务系统”。

## 文档清单

| 文档 | 用途 |
| --- | --- |
| `terminus-lowcode-engine-01-项目深度分析文档.md` | 系统讲清项目背景、架构、模块、核心链路、性能优化、缓存设计、服务化落地和风险优化 |
| `terminus-lowcode-engine-02-简历项目经历.md` | 生成可放进简历的 4 个版本，覆盖低代码平台、出码工具链、物料工程、平台服务化表达 |
| `terminus-lowcode-engine-03-面试讲解稿.md` | 3 分钟、5 分钟、10 分钟版本，可直接照着讲 |
| `terminus-lowcode-engine-04-面试问答库.md` | 高频追问和参考回答，包含架构、性能、缓存、MQ/Redis/DB 等后端技术如何如实应对 |
| `terminus-lowcode-engine-05-项目亮点包装.md` | 12 个亮点，每个包含业务价值、技术实现、量化口径和可追问点 |

## 最推荐的背诵顺序

1. 先背 `03-面试讲解稿` 的 3 分钟版本，形成完整项目主线。
2. 再背 `05-项目亮点包装` 里的前 6 个亮点：微内核插件、schema 协议、模型分层、模拟器渲染、出码链路、缓存设计。
3. 最后用 `04-面试问答库` 准备追问，尤其是“为什么不是 Java 微服务项目”“Redis/MQ/MySQL 在哪里”“性能优化怎么落地”这几类问题。

## 面试表达边界

建议坚持三个原则：

1. 能从仓库证实的内容，直接说：15 个核心 packages、2 个 modules、1034 个 TS/JS/TSX/JSX 源码文件、72 个测试文件、74 个出码插件源码、265 个出码测试样例目录。
2. 仓库没有的后端中间件，不要硬说“项目使用了 Redis/MQ/MySQL/Dubbo”。可以说“这个仓库是低代码前端引擎，正式落地时可以把 code-generator 和 material-parser 独立成 Node/Java 服务，再接入 Redis、MQ、MySQL、ES 等基础设施”。
3. 业务成果要分清“仓库可验证指标”和“你真实参与落地后的业务指标”。如果没有真实线上数据，就不要背具体 QPS、P95、转化率之类数字。

