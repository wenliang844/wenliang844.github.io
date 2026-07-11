export function renderRelayContent({ includeHero = true } = {}) {
  return `${includeHero ? `        <header class="relay-hero">
          <span class="eyebrow"><i class="fas fa-network-wired" aria-hidden="true"></i> AI Relay</span>
          <h1>中转站排行榜</h1>
          <p class="lead">中转站分为 LinuxDo 站和商业站。当前 LinuxDo 数据来自 CC Switch 脱敏导出，商业站通过 GitHub Actions 对接外部数据自动更新。</p>
        </header>
` : ""}        <section class="relay-score-note" aria-label="评分规则">
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
          <div><strong id="relay-linuxdo-total">0</strong><span>LinuxDo 站</span></div>
          <div><strong id="relay-commercial-total">0</strong><span>商业站</span></div>
          <div><strong id="relay-healthy">0</strong><span>可用</span></div>
          <div><strong id="relay-current">0</strong><span>当前使用</span></div>
        </section>
        <section class="relay-site-grid" aria-label="中转站分组榜单">
          <section class="relay-site" data-relay-site="linuxdo">
            <header class="relay-site-head">
              <div>
                <h2>LinuxDo 站</h2>
                <p>当前展示的手动脱敏榜单数据。</p>
              </div>
              <span id="relay-linuxdo-updated" class="relay-site-updated">等待加载</span>
            </header>
            <div id="relay-list-linuxdo" class="relay-list" aria-live="polite">
              <p class="relay-loading">正在加载 LinuxDo 站数据...</p>
            </div>
          </section>
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
