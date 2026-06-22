// 鉴赏页：科技研究 / 影视作品 / 娱乐项目 / 食物 / 座右铭「排行榜」，并列展示。
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
      { name: "黑道家族", nameEn: "The Sopranos" },
      { name: "黄石", nameEn: "Yellowstone" },
      { name: "毒枭", nameEn: "Narcos" },
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
      { name: "做出对自己最有利的事", nameEn: "Doing what serves my own best interests" },
    ],
  },
  {
    title: "食物排行榜",
    titleEn: "Food",
    sub: "日常高频、营养密度和满足感都在线的食物清单。",
    subEn: "Everyday foods with solid nutrition, frequency and satisfaction.",
    icon: "fa-utensils",
    items: [
      { name: "鸡蛋", nameEn: "Eggs" },
      { name: "牛肉", nameEn: "Beef" },
      { name: "坚果", nameEn: "Nuts" },
      { name: "三文鱼", nameEn: "Salmon" },
      { name: "虾", nameEn: "Shrimp" },
      { name: "土豆", nameEn: "Potatoes" },
      { name: "酸奶", nameEn: "Yogurt" },
    ],
  },
  {
    title: "座右铭排行榜",
    titleEn: "Mottos",
    sub: "提醒自己看清世界、放慢判断、借助工具的几句话。",
    subEn: "Lines that remind me to read the world clearly, slow down and use tools well.",
    icon: "fa-quote-left",
    items: [
      { name: "所有的问题都是经济问题", nameEn: "All problems are economic problems" },
      { name: "批判性思维", nameEn: "Critical thinking" },
      { name: "所有人都支持的一件事必然错误(乌合之众)", nameEn: "Anything everyone supports is likely wrong (The Crowd)" },
      { name: "心理暗示可以操纵摇摆州", nameEn: "Suggestion can manipulate swing states" },
      { name: "事缓则圆,用AI分析得到建议", nameEn: "Slow things down and use AI analysis for advice" },
      { name: "每个人都有漏洞,可以通过观察得到", nameEn: "Everyone has weaknesses; observation can reveal them" },
      { name: "有些东西装着可以成真,有些装不了", nameEn: "Some things can become true if you pretend; some cannot" },
      { name: "三岁小孩能说出平板是用来学习的", nameEn: "Even a three-year-old can say a tablet is for studying" },
      { name: "人不会改变，只会装作改变", nameEn: "People do not change; they only pretend to change" },
      { name: "吃苦不利于思考", nameEn: "Suffering is not good for thinking" },
      { name: "世界就是一个巨大的草台班子", nameEn: "The world is one giant makeshift troupe" },
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
  const description = "个人鉴赏榜单：科技研究、影视作品、娱乐项目、食物与座右铭排行榜。";
  const main = `    <main id="main-content" class="content">
      <section class="rank-page container">
        <header class="rank-hero">
          <span class="eyebrow" data-i18n="appr.eyebrow" data-i18n-en-html='<i class="fas fa-star" aria-hidden="true"></i> Appreciation' data-i18n-html><i class="fas fa-star" aria-hidden="true"></i> Appreciation</span>
          <h1 data-i18n="appr.h1" data-i18n-en="Appreciation">鉴赏</h1>
          <p class="lead" data-i18n="appr.lead" data-i18n-en="${escapeHtml("A personal list of what I love in tech, film, TV, food and mottos, each set ranked by where it sits in my heart.")}">一份私人的「偏爱」清单：科技、影视、娱乐项目、食物与座右铭里那些值得反复回味的东西，各自排个心中的位次。</p>
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
      description: "个人鉴赏榜单：科技、影视、娱乐项目、食物与座右铭排行榜。",
      path: "/appreciation/",
    },
  });
}
