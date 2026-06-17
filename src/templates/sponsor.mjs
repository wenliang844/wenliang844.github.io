import { SPONSOR_LINKS, renderPage } from "./layout.mjs";

export function renderSponsorPage() {
  const main = `    <main class="content">
      <section class="sponsor-page container" aria-labelledby="sponsor-title">
        <div class="sponsor-hero">
          <span class="eyebrow" data-i18n="sponsor.eyebrow" data-i18n-html><i class="fas fa-heart" aria-hidden="true"></i> Independent work</span>
          <h1 id="sponsor-title" data-i18n="sponsor.title">Support This Project ☕</h1>
          <p class="lead" data-i18n="sponsor.lead">This project is built and maintained by an independent developer.</p>
        </div>

        <div class="sponsor-layout">
          <section class="sponsor-panel sponsor-panel-main" aria-labelledby="sponsor-pay-title">
            <div class="sponsor-trust">
              <h2 id="sponsor-pay-title" data-i18n="sponsor.trust.title">你的支持会用于</h2>
              <ul>
                <li data-i18n="sponsor.trust.api"><i class="fas fa-robot" aria-hidden="true"></i> API 费用（OpenAI / Claude）</li>
                <li data-i18n="sponsor.trust.server"><i class="fas fa-server" aria-hidden="true"></i> 服务器与站点运行成本</li>
                <li data-i18n="sponsor.trust.dev"><i class="fas fa-code" aria-hidden="true"></i> 持续开发、维护与内容更新</li>
              </ul>
            </div>

            <div class="sponsor-amounts" aria-label="Suggested support" data-i18n-aria="sponsor.amounts.aria">
              <span data-i18n="sponsor.amounts.label">Suggested support:</span>
              <strong data-i18n="sponsor.amounts.coffee">¥5 (Coffee)</strong>
              <strong data-i18n="sponsor.amounts.supporter">¥20 (Supporter)</strong>
              <strong data-i18n="sponsor.amounts.backer">¥50 (Backer)</strong>
            </div>

            <div class="sponsor-method sponsor-method-primary">
              <div>
                <span class="sponsor-method-kicker" data-i18n="sponsor.afdian.kicker">💳 爱发电（主推荐）</span>
                <h2 data-i18n="sponsor.afdian.title">支持持续更新</h2>
                <p data-i18n="sponsor.afdian.desc">适合国内用户，跳转到爱发电完成赞助。</p>
              </div>
              <a class="sponsor-pay-btn sponsor-pay-primary" href="${SPONSOR_LINKS.afdian}" target="_blank" rel="noopener noreferrer" data-i18n="sponsor.afdian.btn">☕ Sponsor via Afdian</a>
            </div>

            <div class="sponsor-method">
              <div>
                <span class="sponsor-method-kicker" data-i18n="sponsor.paypal.kicker">🌍 PayPal（国际用户）</span>
                <h2 data-i18n="sponsor.paypal.title">International support</h2>
                <p data-i18n="sponsor.paypal.desc">For readers outside mainland China, PayPal is the simplest path.</p>
              </div>
              <a class="sponsor-pay-btn sponsor-pay-secondary" href="${SPONSOR_LINKS.paypal}" target="_blank" rel="noopener noreferrer" data-i18n="sponsor.paypal.btn">💳 Support via PayPal</a>
            </div>
          </section>

          <aside class="sponsor-side" aria-label="Sponsor progress and domestic QR options" data-i18n-aria="sponsor.side.aria">
            <section class="sponsor-goal" aria-labelledby="sponsor-goal-title">
              <h2 id="sponsor-goal-title" data-i18n="sponsor.goal.title">Monthly goal: ¥2000</h2>
              <div class="sponsor-progress" aria-label="Monthly sponsor goal progress 72%" data-i18n-aria="sponsor.goal.aria">
                <span style="width: 72%"></span>
              </div>
              <p data-i18n="sponsor.goal.percent">72% funded this month</p>
            </section>

            <section class="sponsor-domestic" aria-labelledby="sponsor-domestic-title">
              <h2 id="sponsor-domestic-title" data-i18n="sponsor.domestic.title">🇨🇳 国内支付</h2>
              <p data-i18n="sponsor.domestic.desc">微信 / 支付宝二维码可在这里接入；当前保留扫码位，避免伪造不存在的收款码。</p>
              <div class="sponsor-qr-grid" aria-label="Domestic QR placeholders" data-i18n-aria="sponsor.domestic.aria">
                <div class="sponsor-qr-placeholder">
                  <i class="fab fa-weixin" aria-hidden="true"></i>
                  <span data-i18n="sponsor.domestic.wechat">微信扫码</span>
                </div>
                <div class="sponsor-qr-placeholder">
                  <i class="fas fa-qrcode" aria-hidden="true"></i>
                  <span data-i18n="sponsor.domestic.alipay">支付宝扫码</span>
                </div>
              </div>
            </section>

            <section class="sponsor-thanks" aria-labelledby="sponsor-thanks-title">
              <h2 id="sponsor-thanks-title" data-i18n="sponsor.thanks.title">Thank you to all supporters ❤️</h2>
              <p data-i18n="sponsor.thanks.desc">每一次支持都会帮助这个项目继续运行、继续写下去。</p>
            </section>
          </aside>
        </div>
      </section>
    </main>`;

  return renderPage({
    title: "Sponsor :: CWLBlog",
    description: "Support CWLBlog via Afdian, PayPal, WeChat or Alipay.",
    titleEn: "Sponsor :: CWLBlog",
    descriptionEn: "Support CWLBlog via Afdian, PayPal, WeChat or Alipay.",
    active: "sponsor",
    scripts: [],
    bodyClass: "colorscheme-dark",
    page: "sponsor",
    main,
    og: {
      title: "Sponsor CWLBlog",
      description: "Support this independent developer project via Afdian, PayPal or domestic scan payments.",
      path: "/sponsor/",
    },
  });
}
