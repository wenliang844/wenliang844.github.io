import { LOCAL_DATA_ITEMS, SECURITY_SUMMARY, THIRD_PARTY_SERVICES, TRUST_STATS, USER_CONTROLS } from "../trust-data.mjs";
import { stylesForRoute } from "../page-assets.mjs";
import { escapeAttr, escapeHtml } from "../lib/format.mjs";
import { buildPageJsonLd, renderPage } from "./layout.mjs";

function i18nAttrs(key, valueEn) {
  return ` data-i18n="${key}" data-i18n-en="${escapeAttr(valueEn)}"`;
}

function renderStats() {
  return TRUST_STATS.map((stat, index) => `          <div class="trust-stat">
            <strong${i18nAttrs(`trust.stat.${index}.value`, stat.value)}>${escapeHtml(stat.value)}</strong>
            <span${i18nAttrs(`trust.stat.${index}.label`, stat.labelEn)}>${escapeHtml(stat.label)}</span>
          </div>`).join("\n");
}

function renderLocalDataItem(item, index) {
  return `          <article class="trust-card rank-board">
            <span class="rank-board-icon trust-icon" aria-hidden="true"><i class="fas ${item.icon}"></i></span>
            <h3${i18nAttrs(`trust.local.${index}.title`, item.titleEn)}>${escapeHtml(item.title)}</h3>
            <p class="trust-storage">${escapeHtml(item.storage)}</p>
            <p${i18nAttrs(`trust.local.${index}.description`, item.descriptionEn)}>${escapeHtml(item.description)}</p>
            <p class="trust-control"${i18nAttrs(`trust.local.${index}.controls`, item.controlsEn)}>${escapeHtml(item.controls)}</p>
          </article>`;
}

function renderService(service, index) {
  const data = service.data.join("、");
  const dataEn = service.dataEn.join(", ");
  return `          <article class="trust-service rank-board">
            <div class="trust-service-head">
              <h3${i18nAttrs(`trust.service.${index}.name`, service.nameEn)}>${escapeHtml(service.name)}</h3>
              <code>${escapeHtml(service.host)}</code>
            </div>
            <dl class="trust-service-facts">
              <div>
                <dt data-i18n="trust.service.purpose" data-i18n-en="Purpose">用途</dt>
                <dd${i18nAttrs(`trust.service.${index}.purpose`, service.purposeEn)}>${escapeHtml(service.purpose)}</dd>
              </div>
              <div>
                <dt data-i18n="trust.service.trigger" data-i18n-en="Trigger">触发时机</dt>
                <dd${i18nAttrs(`trust.service.${index}.trigger`, service.triggerEn)}>${escapeHtml(service.trigger)}</dd>
              </div>
              <div>
                <dt data-i18n="trust.service.data" data-i18n-en="Data">数据</dt>
                <dd${i18nAttrs(`trust.service.${index}.data`, dataEn)}>${escapeHtml(data)}</dd>
              </div>
              <div>
                <dt data-i18n="trust.service.control" data-i18n-en="User control">用户控制</dt>
                <dd${i18nAttrs(`trust.service.${index}.control`, service.userControlEn)}>${escapeHtml(service.userControl)}</dd>
              </div>
            </dl>
          </article>`;
}

function renderControl(item, index) {
  return `          <li>
            <h3${i18nAttrs(`trust.control.${index}.title`, item.titleEn)}>${escapeHtml(item.title)}</h3>
            <p${i18nAttrs(`trust.control.${index}.body`, item.bodyEn)}>${escapeHtml(item.body)}</p>
          </li>`;
}

function renderSecurityItem(item, index) {
  return `          <li class="trust-security-item">
            <h3${i18nAttrs(`trust.security.${index}.title`, item.titleEn)}>${escapeHtml(item.title)}</h3>
            <p${i18nAttrs(`trust.security.${index}.body`, item.bodyEn)}>${escapeHtml(item.body)}</p>
          </li>`;
}

export function renderTrustPage() {
  const description = "本站本机数据、第三方服务、AI 助手、工具箱、订阅、评论和反馈的数据流说明。";
  const descriptionEn = "How local data, third-party services, the AI assistant, toolbox, subscriptions, comments and feedback behave on this site.";
  const main = `    <main id="main-content" class="content">
      <section class="trust-page rank-page container" aria-labelledby="trust-title">
        <header class="trust-hero rank-hero">
          <span class="eyebrow" data-i18n="trust.eyebrow" data-i18n-html data-i18n-en-html="&lt;i class=&quot;fas fa-shield-alt&quot; aria-hidden=&quot;true&quot;&gt;&lt;/i&gt; Privacy &amp; Trust"><i class="fas fa-shield-alt" aria-hidden="true"></i> 隐私与信任</span>
          <h1 id="trust-title" data-i18n="trust.title" data-i18n-en="How this site handles data">本站如何处理数据</h1>
          <p class="lead" data-i18n="trust.lead" data-i18n-en="A short, practical map of what stays in your browser, which third-party services may be contacted, and how you can clear or control local data.">这里集中说明哪些数据留在你的浏览器、哪些第三方服务可能被连接，以及你可以怎样清理或控制本机数据。</p>
        </header>

        <div class="trust-stats timeline-stats" aria-label="Trust summary" data-i18n-aria="trust.stats.aria">
${renderStats()}
        </div>

        <section class="trust-section" aria-labelledby="trust-local-title">
          <div class="trust-section-head">
            <span class="eyebrow" data-i18n="trust.local.eyebrow" data-i18n-en="Local first">本机优先</span>
            <h2 id="trust-local-title" data-i18n="trust.local.title" data-i18n-en="Data stored in this browser">保存在本机的数据</h2>
            <p data-i18n="trust.local.lead" data-i18n-en="The site uses browser storage for convenience features. These records are scoped to this browser profile and can be cleared by you.">站点会用浏览器存储支持便捷功能；这些记录限定在当前浏览器配置中，可由你清理。</p>
          </div>
          <div class="trust-card-grid rank-grid">
${LOCAL_DATA_ITEMS.map(renderLocalDataItem).join("\n")}
          </div>
        </section>

        <section class="trust-section" aria-labelledby="trust-services-title">
          <div class="trust-section-head">
            <span class="eyebrow" data-i18n="trust.services.eyebrow" data-i18n-en="Third-party services">第三方服务</span>
            <h2 id="trust-services-title" data-i18n="trust.services.title" data-i18n-en="When external services may be contacted">可能连接外部服务的场景</h2>
            <p data-i18n="trust.services.lead" data-i18n-en="External requests are tied to visible features such as subscriptions, comments, sponsor links, optional feedback delivery and gesture assets.">外部请求与订阅、评论、赞助、可选在线反馈和手势工具资源等可见功能相关。</p>
          </div>
          <div class="trust-service-list rank-grid">
${THIRD_PARTY_SERVICES.map(renderService).join("\n")}
          </div>
        </section>

        <div class="trust-columns">
          <section class="trust-section trust-control-section" aria-labelledby="trust-control-title">
            <div class="trust-section-head">
              <span class="eyebrow" data-i18n="trust.control.eyebrow" data-i18n-en="Your controls">用户控制</span>
              <h2 id="trust-control-title" data-i18n="trust.control.title" data-i18n-en="What you can control">你可以控制什么</h2>
            </div>
            <ul class="trust-control-list insight-list">
${USER_CONTROLS.map(renderControl).join("\n")}
            </ul>
          </section>

          <section class="trust-section trust-security-section" aria-labelledby="trust-security-title">
            <div class="trust-section-head">
              <span class="eyebrow" data-i18n="trust.security.eyebrow" data-i18n-en="Security posture">安全摘要</span>
              <h2 id="trust-security-title" data-i18n="trust.security.title" data-i18n-en="Security notes">安全说明</h2>
            </div>
            <ul class="trust-security-list insight-list">
${SECURITY_SUMMARY.map(renderSecurityItem).join("\n")}
            </ul>
          </section>
        </div>

        <section class="trust-report rank-board" aria-labelledby="trust-report-title">
          <h2 id="trust-report-title" data-i18n="trust.report.title" data-i18n-en="Report a concern">反馈安全或隐私问题</h2>
          <p data-i18n="trust.report.body" data-i18n-en="If something here looks inaccurate, or you find a security or privacy issue, please send a note through the contact page.">如果这里的说明不准确，或你发现安全/隐私问题，请通过联系页留言。</p>
          <a class="trust-report-link" href="/contact/" data-i18n="trust.report.link" data-i18n-html data-i18n-en-html="Contact <i class=&quot;fas fa-arrow-right&quot; aria-hidden=&quot;true&quot;&gt;&lt;/i&gt;">联系反馈 <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
        </section>
      </section>
    </main>`;

  return renderPage({
    title: "隐私与信任 :: CWLBlog",
    description,
    titleEn: "Privacy & Trust :: CWLBlog",
    descriptionEn,
    active: "trust",
    scripts: [],
    styles: stylesForRoute("/trust/"),
    bodyClass: "colorscheme-dark",
    page: "trust",
    jsonLd: buildPageJsonLd({
      type: "WebPage",
      name: "CWLBlog 隐私与信任",
      description,
      path: "/trust/",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: THIRD_PARTY_SERVICES.length,
        itemListElement: THIRD_PARTY_SERVICES.map((service, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: service.name,
          item: {
            "@type": "Service",
            name: service.name,
            serviceType: service.purpose,
            url: `https://${service.host.split(" / ")[0]}`,
          },
        })),
      },
    }),
    main,
    og: {
      title: "隐私与信任 :: CWLBlog",
      description,
      path: "/trust/",
    },
  });
}
