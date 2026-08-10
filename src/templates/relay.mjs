export function renderRelayContent({ includeHero = true } = {}) {
  return `${includeHero ? `        <header class="relay-hero">
          <span class="eyebrow"><i class="fas fa-network-wired" aria-hidden="true"></i> AI Relay</span>
          <h1>中转站排行榜</h1>
          <p class="lead">优先选择官方订阅，也可以通过自建 sub2api 与可信成员拼车；商业中转站榜单由 GitHub Actions 对接外部数据自动更新。</p>
        </header>
` : ""}        <section class="relay-access" aria-labelledby="relay-access-title">
          <header class="relay-access-head">
            <span class="eyebrow"><i class="fas fa-link" aria-hidden="true"></i> Access</span>
            <h2 id="relay-access-title">订阅与拼车方式</h2>
          </header>
          <div class="relay-access-grid">
            <article class="relay-access-card">
              <div class="relay-access-icon"><i class="fas fa-star" aria-hidden="true"></i></div>
              <div>
                <span class="relay-access-type">官方订阅</span>
                <h3>ChatGPT 官方订阅</h3>
                <p>通过 OpenAI 官方方案订阅，适合使用 ChatGPT 与 Codex，账号、账单和用量由官方直接管理。</p>
              </div>
              <a class="relay-access-link" href="https://chatgpt.com/pricing" target="_blank" rel="noopener noreferrer">查看官方方案 <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
            </article>
            <article class="relay-access-card">
              <div class="relay-access-icon warm"><i class="fas fa-code" aria-hidden="true"></i></div>
              <div>
                <span class="relay-access-type">官方订阅</span>
                <h3>Claude 官方订阅</h3>
                <p>通过 Anthropic 官方方案订阅，适合使用 Claude 与 Claude Code，权益和额度以官方页面为准。</p>
              </div>
              <a class="relay-access-link" href="https://claude.com/pricing" target="_blank" rel="noopener noreferrer">查看官方方案 <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
            </article>
            <article class="relay-access-card">
              <div class="relay-access-icon"><i class="fas fa-comments" aria-hidden="true"></i></div>
              <div>
                <span class="relay-access-type">拼车方式</span>
                <h3>sub2api 自建拼车</h3>
                <p>由车主自行部署 sub2api，将订阅能力转换为 API 后为成员分配密钥。加入前应确认额度、隐私、费用和退出规则。</p>
              </div>
              <a class="relay-access-link" href="https://github.com/Wei-Shaw/sub2api" target="_blank" rel="noopener noreferrer">查看 sub2api <i class="fab fa-github" aria-hidden="true"></i></a>
            </article>
          </div>
        </section>
        <section class="relay-score-note" aria-label="评分规则">
          <strong>评分</strong>
          <span>健康状态 40 + 最近成功率 30 + 响应速度 15 + 数据新鲜度 10 + 当前使用/排序 5 - 失败惩罚。</span>
        </section>
        <section class="relay-toolbar" aria-label="中转站筛选">
          <div class="relay-filters" role="group" aria-label="格式与状态筛选">
            <button class="active" type="button" data-relay-filter="all">全部</button>
            <button type="button" data-relay-filter="chatgpt">ChatGPT格式</button>
            <button type="button" data-relay-filter="claude">Claude格式</button>
            <button type="button" data-relay-filter="healthy">可用</button>
            <button type="button" data-relay-filter="unhealthy">异常</button>
          </div>
          <label class="relay-search">
            <span data-i18n="relay.search.label" data-i18n-en="Search">搜索</span>
            <input id="relay-search-input" type="search" autocomplete="off" placeholder="名称、端点或模型" aria-label="搜索中转站" data-i18n-aria="relay.search.aria" data-i18n-en-aria="Search relay providers">
          </label>
        </section>
        <section class="relay-stats" aria-label="榜单概览">
          <div><strong id="relay-total">0</strong><span>路由</span></div>
          <div><strong id="relay-commercial-total">0</strong><span>商业站</span></div>
          <div><strong id="relay-healthy">0</strong><span>可用</span></div>
          <div><strong id="relay-current">0</strong><span>当前使用</span></div>
        </section>
        <section class="relay-site-grid relay-site-grid-single" aria-label="商业中转站榜单">
          <section class="relay-site" data-relay-site="commercial">
            <header class="relay-site-head">
              <div>
                <h2>商业站</h2>
                <p>由 GitHub Actions 自动同步外部数据。</p>
              </div>
              <span id="relay-commercial-updated" class="relay-site-updated">等待同步</span>
            </header>
            <div id="relay-list-commercial" class="relay-list" aria-live="polite">
              <p class="relay-loading">正在加载商业站数据...</p>
            </div>
          </section>
        </section>`;
}
