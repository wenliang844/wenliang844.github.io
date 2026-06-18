(function () {
  const DATA_URL = "/data/relay-providers.json";
  const HEALTH_LABELS = {
    healthy: "可用",
    degraded: "慢",
    down: "异常",
    unknown: "未知",
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function formatRate(value) {
    return value === null || value === undefined ? "无数据" : value + "%";
  }

  function formatLatency(value) {
    return value ? value + " ms" : "无数据";
  }

  function formatTime(value) {
    if (!value) {
      return "无数据";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "无数据";
    }
    return date.toLocaleString("zh-CN", { hour12: false });
  }

  function matchFilter(provider, filter) {
    if (filter === "chatgpt" || filter === "claude") {
      return provider.format === filter;
    }
    if (filter === "healthy") {
      return provider.healthStatus === "healthy" || provider.healthStatus === "degraded";
    }
    if (filter === "unhealthy") {
      return provider.healthStatus === "down" || provider.healthStatus === "unknown";
    }
    return true;
  }

  function matchSearch(provider, query) {
    if (!query) {
      return true;
    }
    const haystack = [
      provider.name,
      provider.formatLabel,
      provider.endpoint,
      provider.websiteUrl,
      provider.siteLabel,
      (provider.models || []).join(" "),
      (provider.tags || []).join(" "),
    ].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function copyText(text, status) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        status.textContent = "已复制配置";
      });
    }

    const textarea = el("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      status.textContent = "已复制配置";
    } catch {
      status.textContent = "复制失败";
    } finally {
      textarea.remove();
    }
    return Promise.resolve();
  }

  function renderProvider(provider, index) {
    const card = el("article", "relay-card");
    const head = el("div", "relay-card-head");
    const rank = el("span", "relay-rank", String(index + 1));
    const titleWrap = el("div", "relay-title");
    const title = el("h2", "", provider.name);
    const meta = el("div", "relay-meta");
    meta.appendChild(el("span", "relay-format " + provider.format, provider.formatLabel));
    meta.appendChild(el("span", "relay-health " + provider.healthStatus, HEALTH_LABELS[provider.healthStatus] || "未知"));
    if (provider.isCurrent) {
      meta.appendChild(el("span", "relay-current", "当前使用"));
    }
    (provider.tags || []).forEach(function (tag) {
      meta.appendChild(el("span", "relay-warning", tag));
    });
    titleWrap.appendChild(title);
    titleWrap.appendChild(meta);

    const score = el("div", "relay-score");
    score.appendChild(el("strong", "", String(provider.score)));
    score.appendChild(el("span", "", "分"));

    head.appendChild(rank);
    head.appendChild(titleWrap);
    head.appendChild(score);

    const rows = el("dl", "relay-fields");
    [
      ["端点", provider.endpoint || "无数据"],
      ["官网/控制台", provider.websiteUrl || "无数据"],
      ["模型", provider.models && provider.models.length ? provider.models.join(", ") : "无数据"],
      ["成功率", formatRate(provider.successRate)],
      ["响应耗时", formatLatency(provider.latencyMs)],
      ["最近测试", formatTime(provider.lastTestedAt)],
      ["失败摘要", provider.failureSummary || "无"],
    ].forEach(function (item) {
      rows.appendChild(el("dt", "", item[0]));
      if (item[0] === "官网/控制台" && provider.websiteUrl) {
        const dd = el("dd");
        const link = el("a", "", provider.websiteUrl);
        link.href = provider.websiteUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        dd.appendChild(link);
        rows.appendChild(dd);
      } else {
        rows.appendChild(el("dd", "", item[1]));
      }
    });

    const actions = el("div", "relay-actions");
    const copy = el("button", "relay-copy", "复制配置");
    copy.type = "button";
    const status = el("span", "relay-copy-status");
    copy.addEventListener("click", function () {
      const payload = {
        format: provider.format === "claude" ? "anthropic" : "openai",
        endpoint: provider.endpoint,
        model: provider.models && provider.models.length ? provider.models[0] : "",
        stream: false,
      };
      copyText(JSON.stringify(payload, null, 2), status);
    });
    actions.appendChild(copy);
    actions.appendChild(status);

    card.appendChild(head);
    card.appendChild(rows);
    card.appendChild(actions);
    return card;
  }

  function setStats(linuxdoProviders, commercialProviders) {
    const total = document.getElementById("relay-total");
    const linuxdo = document.getElementById("relay-linuxdo-total");
    const commercial = document.getElementById("relay-commercial-total");
    const healthy = document.getElementById("relay-healthy");
    const current = document.getElementById("relay-current");
    const providers = linuxdoProviders.concat(commercialProviders);
    if (total) {
      total.textContent = String(providers.length);
    }
    if (linuxdo) {
      linuxdo.textContent = String(linuxdoProviders.length);
    }
    if (commercial) {
      commercial.textContent = String(commercialProviders.length);
    }
    if (healthy) {
      healthy.textContent = String(providers.filter(function (item) {
        return item.healthStatus === "healthy" || item.healthStatus === "degraded";
      }).length);
    }
    if (current) {
      current.textContent = String(providers.filter(function (item) { return item.isCurrent; }).length);
    }
  }

  function updatedLabel(value) {
    const text = formatTime(value);
    return text === "无数据" ? "等待同步" : "更新于 " + text;
  }

  function getSectionMeta(data, section) {
    const sections = data && data.meta && data.meta.sections ? data.meta.sections : {};
    return sections[section] || {};
  }

  function normalizeSections(data) {
    const linuxdoMeta = getSectionMeta(data, "linuxdo");
    const commercialMeta = getSectionMeta(data, "commercial");
    return {
      linuxdo: (Array.isArray(data.providers) ? data.providers : []).map(function (provider) {
        return { ...provider, site: "linuxdo", siteLabel: linuxdoMeta.label || "LinuxDo 站" };
      }),
      commercial: (Array.isArray(data.commercialProviders) ? data.commercialProviders : []).map(function (provider) {
        return { ...provider, site: "commercial", siteLabel: commercialMeta.label || "商业站" };
      }),
      linuxdoUpdatedAt: linuxdoMeta.generatedAt || data.meta && data.meta.generatedAt,
      commercialUpdatedAt: commercialMeta.generatedAt || data.commercialMeta && data.commercialMeta.generatedAt,
    };
  }

  function init() {
    const linuxdoList = document.getElementById("relay-list-linuxdo");
    const commercialList = document.getElementById("relay-list-commercial");
    const search = document.getElementById("relay-search-input");
    const filters = Array.from(document.querySelectorAll("[data-relay-filter]"));
    if (!linuxdoList || !commercialList) {
      return;
    }

    let sections = {
      linuxdo: [],
      commercial: [],
      linuxdoUpdatedAt: null,
      commercialUpdatedAt: null,
    };
    let activeFilter = "all";

    function visibleProviders(providers) {
      const query = search ? search.value.trim() : "";
      return providers.filter(function (provider) {
        return matchFilter(provider, activeFilter) && matchSearch(provider, query);
      });
    }

    function renderList(list, providers, emptyText) {
      const visible = visibleProviders(providers);
      list.textContent = "";
      if (!visible.length) {
        list.appendChild(el("p", "relay-empty", emptyText));
        return;
      }
      visible.forEach(function (provider, index) {
        list.appendChild(renderProvider(provider, index));
      });
    }

    function render() {
      renderList(linuxdoList, sections.linuxdo, "没有匹配的 LinuxDo 站中转。");
      renderList(commercialList, sections.commercial, sections.commercial.length ? "没有匹配的商业站中转。" : "商业站数据等待 GitHub Actions 同步。");
    }

    filters.forEach(function (button) {
      button.addEventListener("click", function () {
        activeFilter = button.getAttribute("data-relay-filter") || "all";
        filters.forEach(function (item) {
          item.classList.toggle("active", item === button);
        });
        render();
      });
    });
    if (search) {
      search.addEventListener("input", render);
    }

    fetch(DATA_URL, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        sections = normalizeSections(data || {});
        setStats(sections.linuxdo, sections.commercial);
        const linuxdoUpdated = document.getElementById("relay-linuxdo-updated");
        const commercialUpdated = document.getElementById("relay-commercial-updated");
        if (linuxdoUpdated) {
          linuxdoUpdated.textContent = updatedLabel(sections.linuxdoUpdatedAt);
        }
        if (commercialUpdated) {
          commercialUpdated.textContent = updatedLabel(sections.commercialUpdatedAt);
        }
        render();
      })
      .catch(function () {
        linuxdoList.textContent = "";
        commercialList.textContent = "";
        linuxdoList.appendChild(el("p", "relay-empty", "LinuxDo 站数据加载失败。"));
        commercialList.appendChild(el("p", "relay-empty", "商业站数据加载失败。"));
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
