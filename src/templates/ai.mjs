import { buildPageJsonLd, renderPage } from "./layout.mjs";
import { renderRelayContent } from "./relay.mjs";

const GROUPS = [
  {
    title: "对话与搜索",
    titleEn: "Chat & Search",
    desc: "快速问答、联网检索、资料交叉验证和日常灵感整理。",
    descEn: "Fast answers, web research, source checking and everyday idea shaping.",
    icon: "fa-comments",
    tools: [
      {
        name: "ChatGPT",
        url: "https://chatgpt.com/",
        desc: "通用 AI 助手，适合写作、分析、代码讨论和多模态任务。",
        descEn: "General AI assistant for writing, analysis, coding discussion and multimodal work.",
        tags: ["OpenAI", "对话", "多模态"],
        tagsEn: ["OpenAI", "Chat", "Multimodal"],
      },
      {
        name: "Claude",
        url: "https://claude.ai/",
        desc: "长上下文对话和严谨推理，适合方案梳理、文档阅读与架构讨论。",
        descEn: "Long-context assistant with strong reasoning for planning, docs and architecture.",
        tags: ["Anthropic", "长上下文", "推理"],
        tagsEn: ["Anthropic", "Long Context", "Reasoning"],
      },
      {
        name: "Gemini",
        url: "https://gemini.google.com/",
        desc: "Google 的 AI 助手，适合搜索生态、图片理解和多端协作。",
        descEn: "Google's AI assistant for search workflows, image understanding and cross-device work.",
        tags: ["Google", "搜索", "多模态"],
        tagsEn: ["Google", "Search", "Multimodal"],
      },
      {
        name: "Perplexity",
        url: "https://www.perplexity.ai/",
        desc: "带引用来源的 AI 搜索，适合查资料、追踪新技术和快速验证结论。",
        descEn: "AI search with citations for research, tech tracking and quick validation.",
        tags: ["AI搜索", "引用", "研究"],
        tagsEn: ["AI Search", "Citations", "Research"],
      },
    ],
  },
  {
    title: "编程与开发",
    titleEn: "Coding & Development",
    desc: "从仓库级代码修改到前端原型、补全、调试和工程执行。",
    descEn: "Repo-level edits, frontend prototypes, completion, debugging and engineering execution.",
    icon: "fa-code",
    tools: [
      {
        name: "OpenAI Codex",
        url: "https://chatgpt.com/codex",
        desc: "面向真实代码仓库的编码智能体，适合改代码、跑测试和处理工程任务。",
        descEn: "Coding agent for real repositories, useful for edits, tests and engineering tasks.",
        tags: ["编码智能体", "仓库", "测试"],
        tagsEn: ["Coding Agent", "Repo", "Tests"],
      },
      {
        name: "Cursor",
        url: "https://www.cursor.com/",
        desc: "AI 原生代码编辑器，适合日常开发、重构、解释代码和快速补全。",
        descEn: "AI-native code editor for daily development, refactors, explanations and completion.",
        tags: ["IDE", "补全", "重构"],
        tagsEn: ["IDE", "Completion", "Refactor"],
      },
      {
        name: "GitHub Copilot",
        url: "https://github.com/features/copilot",
        desc: "集成在编辑器和 GitHub 工作流中的代码补全与编程助手。",
        descEn: "Code completion and programming assistant integrated into editors and GitHub workflows.",
        tags: ["GitHub", "补全", "PR"],
        tagsEn: ["GitHub", "Completion", "PR"],
      },
      {
        name: "v0",
        url: "https://v0.dev/",
        desc: "用自然语言生成前端界面和组件，适合快速搭建产品原型。",
        descEn: "Generate frontend interfaces and components from natural language for fast prototyping.",
        tags: ["前端", "原型", "组件"],
        tagsEn: ["Frontend", "Prototype", "Components"],
      },
    ],
  },
  {
    title: "创作与设计",
    titleEn: "Creation & Design",
    desc: "图片、视频、演示文稿和视觉内容的快速生成与编辑。",
    descEn: "Fast generation and editing for images, video, decks and visual content.",
    icon: "fa-palette",
    tools: [
      {
        name: "Midjourney",
        url: "https://www.midjourney.com/",
        desc: "高质量图像生成工具，适合视觉概念、海报和风格探索。",
        descEn: "High-quality image generation for visual concepts, posters and style exploration.",
        tags: ["图片", "设计", "风格"],
        tagsEn: ["Image", "Design", "Style"],
      },
      {
        name: "Runway",
        url: "https://runwayml.com/",
        desc: "AI 视频生成与编辑平台，适合短视频、分镜和动态素材制作。",
        descEn: "AI video generation and editing for shorts, storyboards and motion assets.",
        tags: ["视频", "生成", "剪辑"],
        tagsEn: ["Video", "Generation", "Editing"],
      },
      {
        name: "Gamma",
        url: "https://gamma.app/",
        desc: "AI 演示文稿与网页生成工具，适合快速整理方案和汇报材料。",
        descEn: "AI decks and web pages for quickly shaping proposals and presentations.",
        tags: ["PPT", "网页", "汇报"],
        tagsEn: ["Decks", "Web", "Presentation"],
      },
      {
        name: "Canva AI",
        url: "https://www.canva.com/ai/",
        desc: "在线设计套件中的 AI 能力，适合海报、社媒图和轻量设计。",
        descEn: "AI features inside Canva for posters, social graphics and lightweight design.",
        tags: ["设计", "模板", "海报"],
        tagsEn: ["Design", "Templates", "Poster"],
      },
    ],
  },
  {
    title: "效率与知识库",
    titleEn: "Productivity & Knowledge",
    desc: "笔记整理、资料阅读、知识问答和多模型聚合入口。",
    descEn: "Notes, document reading, knowledge Q&A and multi-model access points.",
    icon: "fa-layer-group",
    tools: [
      {
        name: "Notion AI",
        url: "https://www.notion.so/product/ai",
        desc: "把 AI 嵌入笔记和项目管理，用于总结、改写和知识库问答。",
        descEn: "AI inside notes and project management for summaries, rewrites and knowledge Q&A.",
        tags: ["笔记", "知识库", "总结"],
        tagsEn: ["Notes", "Knowledge", "Summary"],
      },
      {
        name: "NotebookLM",
        url: "https://notebooklm.google/",
        desc: "围绕上传资料建立问答和摘要，适合读论文、文档和长资料。",
        descEn: "Q&A and summaries over uploaded sources, useful for papers, docs and long material.",
        tags: ["资料", "阅读", "问答"],
        tagsEn: ["Sources", "Reading", "Q&A"],
      },
      {
        name: "Poe",
        url: "https://poe.com/",
        desc: "多模型聚合平台，适合在不同模型之间快速切换和对比输出。",
        descEn: "Multi-model hub for switching between models and comparing outputs quickly.",
        tags: ["多模型", "聚合", "对比"],
        tagsEn: ["Multi-model", "Hub", "Compare"],
      },
      {
        name: "秘塔AI搜索",
        url: "https://metaso.cn/",
        desc: "中文 AI 搜索工具，适合资料检索、报告生成和中文信息整理。",
        descEn: "Chinese AI search for research, report drafting and Chinese information workflows.",
        tags: ["中文搜索", "报告", "资料"],
        tagsEn: ["Chinese Search", "Reports", "Research"],
      },
    ],
  },
  {
    title: "国产模型与工具",
    titleEn: "Chinese Models & Tools",
    desc: "中文语境友好的模型和应用，适合日常问答、写作和本地信息场景。",
    descEn: "Chinese-language friendly models and apps for Q&A, writing and local information tasks.",
    icon: "fa-compass",
    tools: [
      {
        name: "DeepSeek",
        url: "https://chat.deepseek.com/",
        desc: "推理和代码能力突出的国产模型，适合技术问答、算法和代码分析。",
        descEn: "Chinese model with strong reasoning and coding ability for technical Q&A and code analysis.",
        tags: ["推理", "代码", "中文"],
        tagsEn: ["Reasoning", "Code", "Chinese"],
      },
      {
        name: "Kimi",
        url: "https://www.kimi.com/",
        desc: "长文档阅读和中文资料整理能力强，适合上传文件后提问和总结。",
        descEn: "Strong long-document reading and Chinese source synthesis for file-based Q&A.",
        tags: ["长文档", "文件", "总结"],
        tagsEn: ["Long Docs", "Files", "Summary"],
      },
      {
        name: "豆包",
        url: "https://www.doubao.com/",
        desc: "字节跳动 AI 助手，适合日常问答、写作、图片理解和轻量创作。",
        descEn: "ByteDance AI assistant for daily Q&A, writing, image understanding and creation.",
        tags: ["助手", "写作", "多模态"],
        tagsEn: ["Assistant", "Writing", "Multimodal"],
      },
      {
        name: "通义千问",
        url: "https://tongyi.aliyun.com/qianwen/",
        desc: "阿里云通义系列入口，适合中文办公、开发问答和云生态相关任务。",
        descEn: "Alibaba Tongyi entry point for Chinese office work, developer Q&A and cloud tasks.",
        tags: ["阿里云", "办公", "中文"],
        tagsEn: ["Alibaba Cloud", "Office", "Chinese"],
      },
    ],
  },
];

function attr(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(value) {
  return attr(value).replace(/'/g, "&#39;");
}

function renderTags(tool, groupIndex, toolIndex) {
  return tool.tags
    .map((tag, index) => {
      const en = tool.tagsEn && tool.tagsEn[index] ? tool.tagsEn[index] : tag;
      return `<span data-i18n="ai.g${groupIndex}.t${toolIndex}.tag${index}" data-i18n-en="${attr(en)}">${tag}</span>`;
    })
    .join("");
}

function renderTool(tool, groupIndex, toolIndex) {
  return `            <a class="ai-tool-card" href="${attr(tool.url)}" target="_blank" rel="noopener noreferrer">
              <span class="ai-tool-open" aria-hidden="true"><i class="fas fa-external-link-alt"></i></span>
              <h3>${tool.name}</h3>
              <p data-i18n="ai.g${groupIndex}.t${toolIndex}.desc" data-i18n-en="${attr(tool.descEn)}">${tool.desc}</p>
              <div class="ai-tool-tags">${renderTags(tool, groupIndex, toolIndex)}</div>
            </a>`;
}

function renderGroup(group, groupIndex) {
  return `        <section class="ai-category" aria-labelledby="ai-category-${groupIndex}">
          <div class="ai-category-head">
            <span class="ai-category-icon" aria-hidden="true"><i class="fas ${group.icon}"></i></span>
            <div>
              <h2 id="ai-category-${groupIndex}" data-i18n="ai.group.${groupIndex}.title" data-i18n-en="${attr(group.titleEn)}">${group.title}</h2>
              <p data-i18n="ai.group.${groupIndex}.desc" data-i18n-en="${attr(group.descEn)}">${group.desc}</p>
            </div>
          </div>
          <div class="ai-tool-grid">
${group.tools.map((tool, toolIndex) => renderTool(tool, groupIndex, toolIndex)).join("\n")}
          </div>
        </section>`;
}

export function renderAiPage() {
  const description = "中转站排行榜与常用 AI 网站导航，支持快速对比 AI 中转站路由、模型、健康状态、成功率和响应耗时。";
  const main = `    <main id="main-content" class="content">
      <section class="ai-nav-page container">
        <header class="ai-nav-hero">
          <span class="eyebrow" data-i18n="ai.eyebrow" data-i18n-en-html='<i class="fas fa-robot" aria-hidden="true"></i> AI Toolkit' data-i18n-html><i class="fas fa-robot" aria-hidden="true"></i> AI Toolkit</span>
          <h1 data-i18n="ai.h1" data-i18n-en="Relay Ranking">中转站排名</h1>
          <p class="lead" data-i18n="ai.lead" data-i18n-en="${text("Relay rankings for comparing available AI proxy routes, with a hand-picked directory of AI websites and tools.")}">优先展示中转站排行榜，同时保留常用 AI 网站和工具导航，方便在一个页面内快速查找和对比。</p>
        </header>
        <div class="ai-tabs">
          <div class="ai-tab-list" role="tablist" aria-label="AI 页面内容">
            <button class="ai-tab active" id="ai-tab-relay" type="button" role="tab" data-ai-tab="relay" aria-controls="ai-panel-relay" aria-selected="true" data-i18n="ai.tab.relay" data-i18n-html data-i18n-en-html='<i class="fas fa-network-wired" aria-hidden="true"></i> Relay Ranking'><i class="fas fa-network-wired" aria-hidden="true"></i> 中转站排行榜</button>
            <button class="ai-tab" id="ai-tab-nav" type="button" role="tab" data-ai-tab="nav" aria-controls="ai-panel-nav" aria-selected="false" tabindex="-1" data-i18n="ai.tab.nav" data-i18n-html data-i18n-en-html='<i class="fas fa-compass" aria-hidden="true"></i> AI Websites'><i class="fas fa-compass" aria-hidden="true"></i> AI导航网站</button>
          </div>
          <div class="ai-tab-panels">
            <span id="relay" class="sr-only">中转站排行榜</span>
            <section class="ai-tab-panel relay-page ai-relay-panel active" id="ai-panel-relay" data-ai-panel="relay" role="tabpanel" aria-labelledby="ai-tab-relay">
${renderRelayContent({ includeHero: false })}
            </section>
            <section class="ai-tab-panel" id="ai-panel-nav" data-ai-panel="nav" role="tabpanel" aria-labelledby="ai-tab-nav" hidden>
              <span id="nav" class="sr-only">AI导航网站</span>
${GROUPS.map(renderGroup).join("\n")}
            </section>
          </div>
        </div>
      </section>
    </main>`;

  return renderPage({
    title: "中转站排名 :: CWLBlog",
    description,
    active: "ai",
    scripts: ["/js/relay.js", "/js/ai-tabs.js"],
    page: "ai",
    jsonLd: buildPageJsonLd({
      type: "CollectionPage",
      name: "CWLBlog AI 中转站排名",
      description,
      path: "/ai/",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: GROUPS.reduce((sum, group) => sum + group.tools.length, 0),
        itemListElement: GROUPS.flatMap((group) => group.tools).map((tool, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: tool.name,
          url: tool.url,
        })),
      },
    }),
    main,
    og: {
      title: "中转站排名 :: CWLBlog",
      description: "中转站排行榜与常用 AI 网站导航，支持快速查找和对比。",
      path: "/ai/",
    },
  });
}
