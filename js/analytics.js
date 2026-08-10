(function () {
  // Set provider to "umami" or "plausible" when the corresponding account is ready.
  // Keeping it empty guarantees that local development and production send no analytics requests.
  const CONFIG = Object.freeze({
    provider: "",
    websiteId: "",
    domain: "wenliang844.github.io"
  });
  const provider = String(CONFIG.provider || "").toLowerCase();
  const privateBrowsingSignal = navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  const valid = (provider === "umami" && Boolean(CONFIG.websiteId))
    || (provider === "plausible" && Boolean(CONFIG.domain));
  let ready = false;

  function cleanProperties(properties) {
    const clean = {};
    Object.keys(properties || {}).slice(0, 12).forEach(function (key) {
      const value = properties[key];
      if (["string", "number", "boolean"].indexOf(typeof value) !== -1) {
        clean[String(key).slice(0, 40)] = typeof value === "string" ? value.slice(0, 160) : value;
      }
    });
    return clean;
  }

  function track(name, properties) {
    if (!ready || !name) { return false; }
    const eventName = String(name).slice(0, 80);
    const props = cleanProperties(properties);
    if (provider === "umami" && window.umami && typeof window.umami.track === "function") {
      window.umami.track(eventName, props);
      return true;
    }
    if (provider === "plausible" && typeof window.plausible === "function") {
      window.plausible(eventName, { props: props });
      return true;
    }
    return false;
  }

  window.CWLAnalytics = Object.freeze({
    enabled: valid && !privateBrowsingSignal,
    provider: valid && !privateBrowsingSignal ? provider : "none",
    track: track
  });

  if (!valid || privateBrowsingSignal) { return; }

  const script = document.createElement("script");
  script.defer = true;
  script.dataset.analyticsProvider = provider;
  if (provider === "umami") {
    script.src = "https://cloud.umami.is/script.js";
    script.dataset.websiteId = CONFIG.websiteId;
  } else {
    window.plausible = window.plausible || function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
    script.src = "https://plausible.io/js/script.js";
    script.dataset.domain = CONFIG.domain;
  }
  script.addEventListener("load", function () { ready = true; });
  document.head.appendChild(script);

  document.addEventListener("cwl:subscribe-success", function () {
    track("subscribe_success", { page: window.location.pathname });
  });

  document.addEventListener("click", function (event) {
    const target = event.target.closest && event.target.closest("[data-analytics-event]");
    if (!target) { return; }
    track(target.dataset.analyticsEvent, {
      target: target.dataset.analyticsTarget || target.getAttribute("href") || "",
      page: window.location.pathname
    });
  });

  const article = document.querySelector("article[data-post-slug]");
  if (article) {
    const milestones = { 75: false, 95: false };
    let scheduled = false;
    const measure = function () {
      scheduled = false;
      const rect = article.getBoundingClientRect();
      const read = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / Math.max(rect.height, 1)));
      [75, 95].forEach(function (milestone) {
        if (!milestones[milestone] && read >= milestone / 100) {
          milestones[milestone] = true;
          track(milestone === 95 ? "reading_complete" : "reading_75", {
            slug: article.dataset.postSlug
          });
        }
      });
    };
    window.addEventListener("scroll", function () {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(measure);
      }
    }, { passive: true });
    measure();
  }
})();
