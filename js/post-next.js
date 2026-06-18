// 下一篇浮动推荐：滚动接近文章底部时，从右下角滑入 .next-popup。
// 推荐目标由构建期 prev/next 导航数据渲染到 data-next-url / 链接 href。
(function () {
  const popup = document.querySelector(".next-popup");
  if (!popup) {
    return;
  }

  const article = document.querySelector("article.article");
  if (!article) {
    return;
  }

  const link = popup.querySelector(".next-popup-link");
  const nextUrl = popup.dataset.nextUrl || (link ? link.getAttribute("href") : "") || window.location.pathname;
  if (link && !link.getAttribute("href")) {
    link.setAttribute("href", nextUrl);
  }
  const dismissKey = "cwl-next-dismissed:" + nextUrl;

  function dismissed() {
    try {
      return window.sessionStorage.getItem(dismissKey) === "1";
    } catch (error) {
      return false;
    }
  }

  function remember() {
    try {
      window.sessionStorage.setItem(dismissKey, "1");
    } catch (error) {
      // sessionStorage 不可用时静默降级
    }
  }

  if (dismissed()) {
    return;
  }

  let shown = false;

  function reveal() {
    if (shown) {
      return;
    }
    shown = true;
    popup.hidden = false;
    // 下一帧再加 class，触发滑入过渡
    window.requestAnimationFrame(function () {
      popup.classList.add("is-visible");
    });
  }

  function hide(persist) {
    popup.classList.remove("is-visible");
    shown = true; // 关闭后本页不再自动弹出
    if (persist) {
      remember();
    }
    window.setTimeout(function () {
      popup.hidden = true;
    }, 320);
  }

  const closeBtn = popup.querySelector(".next-popup-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      hide(true);
    });
  }

  if (link) {
    link.addEventListener("click", function () {
      remember();
    });
  }

  // 文章底部进入视口下方约 60% 处时触发。
  function onScroll() {
    if (shown) {
      return;
    }
    const rect = article.getBoundingClientRect();
    const trigger = window.innerHeight * 0.85;
    if (rect.bottom <= trigger) {
      reveal();
    }
  }

  const throttled = window.CWLUtils && window.CWLUtils.throttle
    ? window.CWLUtils.throttle(onScroll, 150)
    : onScroll;

  window.addEventListener("scroll", throttled, { passive: true });
  window.addEventListener("resize", throttled);
  onScroll();
})();
