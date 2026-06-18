// 鉴赏页：科技研究 / 影视作品 / 娱乐项目三张「排行榜」，并列展示。
// 与 ai.mjs 同构——数据驱动 + 双语 data-i18n-en 内联，复用 layout 外壳。
import { buildPageJsonLd, renderPage } from "./layout.mjs";
import { escapeAttr, escapeHtml } from "../lib/format.mjs";

// 三张榜单。每个 item 至少有 name（中文/默认显示），可选：
//   nameEn  英文名（如影视英文标题）；缺省时英文环境沿用 name（适合 Codex/Java 等专有名词）
//   note / noteEn  次级说明（中/英）；缺省则只渲染名称一行
const BOARDS = [
  {
    title: "科技研究排行榜",
    titleEn: "Tech & Research",
    sub: "日常贴身协作的工具与语言，按顺手程度排个位次。",
    subEn: "The tools and languages I lean on daily, ranked by how often I reach for them.",
    icon: "fa-microchip",
    items: [
      { name: "Codex", note: "OpenAI · 读懂整个仓库的编码智能体", noteEn: "OpenAI · a coding agent that reads the whole repo" },
      { name: "Claude", note: "Anthropic · 超长上下文与严谨推理", noteEn: "Anthropic · long context and rigorous reasoning" },
      { name: "AI", note: "这一轮重塑世界的浪潮本身", noteEn: "The wave reshaping the world itself" },
      { name: "Java", note: "最顺手的后端主力语言", noteEn: "My most natural backend workhorse" },
      { name: "Python", note: "数据、脚本与 AI 生态的万能胶", noteEn: "The glue for data, scripts and the AI stack" },
    ],
  },
  {
    title: "影视作品排行榜",
    titleEn: "Film & TV",
    sub: "反复重看也不腻的剧集，凭私心排名。",
    subEn: "Series I rewatch without tiring, ranked on pure bias.",
    icon: "fa-film",
    items: [
      { name: "无耻之徒", nameEn: "Shameless", note: "混乱又滚烫的家庭群像", noteEn: "A chaotic, warm-blooded family portrait" },
      { name: "大西洋帝国", nameEn: "Boardwalk Empire", note: "禁酒令时代的权力与野心", noteEn: "Power and ambition in the Prohibition era" },
      { name: "豪斯医生", nameEn: "House M.D.", note: "毒舌天才的推理诊断", noteEn: "A brilliant, acid-tongued diagnostician" },
      { name: "风骚律师", nameEn: "Better Call Saul", note: "好人如何滑向深渊", noteEn: "How a good man slides into the abyss" },
      { name: "绝命毒师", nameEn: "Breaking Bad", note: "化学老师的黑化史诗", noteEn: "A chemistry teacher's dark epic" },
      { name: "恶搞之家", nameEn: "Family Guy", note: "百无禁忌的动画吐槽", noteEn: "Animated comedy with no taboos" },
      { name: "IT狂人", nameEn: "The IT Crowd", note: "地下机房的极客喜剧", noteEn: "Geek comedy from the basement" },
    ],
  },
  {
    title: "娱乐项目排行榜",
    titleEn: "Joys of Life",
    sub: "让一天值得过的小事，按幸福权重排序。",
    subEn: "The small things that make a day worth it, ranked by how much they lift me.",
    icon: "fa-compass",
    items: [
      { name: "和有意思的人交流", nameEn: "Talking with interesting people" },
      { name: "做成一件挑战性事件得到超出预期的回报", nameEn: "Pulling off a challenge for a payoff beyond expectations" },
      { name: "得到提高身体健康的方法", nameEn: "Finding a way to get healthier" },
      { name: "想出一个能有回报的套路", nameEn: "Cracking a play that actually pays off" },
      { name: "学得一项新技能", nameEn: "Learning a new skill" },
      { name: "推翻一个之前错误的想法", nameEn: "Overturning a belief I had wrong" },
      { name: "独处", nameEn: "Time alone" },
      { name: "正向影响到身边的人", nameEn: "Having a positive effect on people around me" },
      { name: "得到多数人的认可", nameEn: "Earning the recognition of most people" },
      { name: "旅游看世界", nameEn: "Traveling and seeing the world" },
      { name: "获得一个高质量朋友", nameEn: "Gaining one high-quality friend" },
      { name: "时间得到充实", nameEn: "A day that felt full" },
      { name: "大脑得到充分的休息", nameEn: "A well-rested mind" },
      { name: "没有负面消息的一天", nameEn: "A day with no bad news" },
    ],
  },
];

function renderItem(item, boardIndex, itemIndex) {
  const key = `appr.b${boardIndex}.i${itemIndex}`;
  const nameEnAttr = item.nameEn ? ` data-i18n-en="${escapeAttr(item.nameEn)}"` : "";
  const lines = [
    `            <li class="rank-item">`,
    `              <span class="rank-num" aria-hidden="true">${itemIndex + 1}</span>`,
    `              <div class="rank-body">`,
    `                <span class="rank-name" data-i18n="${key}.name"${nameEnAttr}>${escapeHtml(item.name)}</span>`,
  ];
  if (item.note) {
    lines.push(`                <span class="rank-note" data-i18n="${key}.note" data-i18n-en="${escapeAttr(item.noteEn || "")}">${escapeHtml(item.note)}</span>`);
  }
  lines.push(`              </div>`);
  lines.push(`            </li>`);
  return lines.join("\n");
}

function renderBoard(board, boardIndex) {
  return `        <section class="rank-board" aria-labelledby="rank-board-${boardIndex}">
          <div class="rank-board-head">
            <span class="rank-board-icon" aria-hidden="true"><i class="fas ${board.icon}"></i></span>
            <div>
              <h2 id="rank-board-${boardIndex}" data-i18n="appr.b${boardIndex}.title" data-i18n-en="${escapeAttr(board.titleEn)}">${escapeHtml(board.title)}</h2>
              <p data-i18n="appr.b${boardIndex}.sub" data-i18n-en="${escapeAttr(board.subEn)}">${escapeHtml(board.sub)}</p>
            </div>
          </div>
          <ol class="rank-list">
${board.items.map((item, itemIndex) => renderItem(item, boardIndex, itemIndex)).join("\n")}
          </ol>
        </section>`;
}

export function renderAppreciationPage() {
  const description = "个人鉴赏榜单：科技研究、影视作品与娱乐项目三张并列排行榜。";
  const main = `    <main class="content">
      <section class="rank-page container">
        <header class="rank-hero">
          <span class="eyebrow" data-i18n="appr.eyebrow" data-i18n-en-html='<i class="fas fa-star" aria-hidden="true"></i> Appreciation' data-i18n-html><i class="fas fa-star" aria-hidden="true"></i> Appreciation</span>
          <h1 data-i18n="appr.h1" data-i18n-en="Appreciation">鉴赏</h1>
          <p class="lead" data-i18n="appr.lead" data-i18n-en="${escapeHtml("A personal list of what I love in tech, film, TV, and everyday fun, each set ranked by where it sits in my heart.")}">一份私人的「偏爱」清单：科技、影视与娱乐项目里那些值得反复回味的东西，各自排个心中的位次。</p>
        </header>
        <div class="rank-grid">
${BOARDS.map(renderBoard).join("\n")}
        </div>
      </section>
    </main>`;

  return renderPage({
    title: "鉴赏 :: CWLBlog",
    description,
    active: "appreciation",
    page: "appreciation",
    jsonLd: buildPageJsonLd({
      type: "CollectionPage",
      name: "CWLBlog 鉴赏榜单",
      description,
      path: "/appreciation/",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: BOARDS.reduce((sum, board) => sum + board.items.length, 0),
        itemListElement: BOARDS.flatMap((board) => board.items).map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.nameEn || item.name,
          item: { "@type": "Thing", name: item.name, alternateName: item.nameEn || item.name },
        })),
      },
    }),
    main,
    og: {
      title: "鉴赏 :: CWLBlog",
      description: "个人鉴赏榜单：科技、影视与娱乐项目三张并列排行榜。",
      path: "/appreciation/",
    },
  });
}
