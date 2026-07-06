(function () {
  const bars = document.querySelectorAll(".post-share");
  if (!bars.length) {
    return;
  }

  function canonicalOrigin() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href) {
      try {
        return new URL(canonical.href).origin;
      } catch (error) {
        return window.location.origin;
      }
    }
    return window.location.origin;
  }

  function absUrl(path) {
    if (/^https?:/i.test(path)) {
      return path;
    }
    return new URL(path || "/", canonicalOrigin() + "/").href;
  }

  const t = window.CWLUtils.t;

  function shareTitle(bar) {
    if (window.cwlLang && window.cwlLang() === "en") {
      return bar.getAttribute("data-share-title-en") || bar.getAttribute("data-share-title") || document.title;
    }
    return bar.getAttribute("data-share-title") || document.title;
  }

  function shareUrl(bar) {
    return absUrl(bar.getAttribute("data-share-url") || window.location.pathname);
  }

  function xIntent(url, title) {
    return "https://x.com/intent/tweet?text=" +
      encodeURIComponent(title) + "&url=" + encodeURIComponent(url);
  }

  function updateXLink(bar) {
    const link = bar.querySelector('a[data-share="x"]');
    if (!link) {
      return;
    }
    link.setAttribute("href", xIntent(shareUrl(bar), shareTitle(bar)));
  }

  Array.prototype.forEach.call(bars, updateXLink);

  const copyText = window.CWLUtils && window.CWLUtils.copyText
    ? window.CWLUtils.copyText
    : function (_text) {
        return Promise.reject(new Error("CWLUtils.copyText is unavailable"));
      };

  const CHECK_SVG = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

  function flashCopied(button) {
    if (button.classList.contains("copied")) {
      return;
    }
    const prev = button.innerHTML;
    button.innerHTML = CHECK_SVG;
    button.classList.add("copied");
    window.setTimeout(function () {
      button.innerHTML = prev;
      button.classList.remove("copied");
    }, 1600);
  }

  let overlay = null;

  function closeOverlay() {
    if (overlay) {
      overlay.remove();
      overlay = null;
      document.removeEventListener("keydown", onKeydown);
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      closeOverlay();
    }
  }

  function createIcon(pathData) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "1em");
    svg.setAttribute("height", "1em");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    return svg;
  }

  function appendQrSvg(container, svg) {
    if (!svg || !window.DOMParser) {
      return false;
    }
    try {
      const parsed = new window.DOMParser().parseFromString(svg, "image/svg+xml");
      const svgEl = parsed.documentElement;
      if (!svgEl || svgEl.nodeName.toLowerCase() !== "svg") {
        return false;
      }
      container.appendChild(document.importNode(svgEl, true));
      return true;
    } catch (error) {
      return false;
    }
  }

  function showQr(url, title) {
    closeOverlay();

    let svg = "";
    if (typeof window.qrcode === "function") {
      try {
        const qr = window.qrcode(0, "M");
        qr.addData(url);
        qr.make();
        svg = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
      } catch (error) {
        svg = "";
      }
    }

    overlay = document.createElement("div");
    overlay.className = "share-qr-overlay";
    const card = document.createElement("div");
    card.className = "share-qr-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", t("post.qr.aria", "微信扫码分享"));

    const close = document.createElement("button");
    close.type = "button";
    close.className = "share-qr-close";
    close.setAttribute("aria-label", t("post.qr.close", "关闭"));
    close.appendChild(createIcon("M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"));

    const qrTitle = document.createElement("p");
    qrTitle.className = "share-qr-title";
    qrTitle.textContent = t("post.qr.title", "微信扫一扫，分享文章");

    const qrCode = document.createElement("div");
    qrCode.className = "share-qr-code";
    if (!appendQrSvg(qrCode, svg)) {
      const fail = document.createElement("p");
      fail.className = "share-qr-fail";
      fail.textContent = t("post.qr.fail", "二维码生成失败，可改用“复制链接”。");
      qrCode.appendChild(fail);
    }

    const name = document.createElement("p");
    name.className = "share-qr-name";
    name.textContent = title || "";

    card.appendChild(close);
    card.appendChild(qrTitle);
    card.appendChild(qrCode);
    card.appendChild(name);
    overlay.appendChild(card);

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay || event.target.closest(".share-qr-close")) {
        closeOverlay();
      }
    });

    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKeydown);
  }

  function fallbackWeibo(trigger, weibo, url, title) {
    if (trigger.tagName && trigger.tagName.toLowerCase() === "a") {
      trigger.setAttribute("href", weibo);
      trigger.setAttribute("target", "_blank");
      trigger.setAttribute("rel", "noopener");
    }
    copyText(weibo).then(function () {
      flashCopied(trigger);
    }).catch(function () {
      showQr(url, title);
    });
  }

  document.addEventListener("click", function (event) {
    const trigger = event.target.closest("[data-share]");
    if (!trigger) {
      return;
    }
    const bar = trigger.closest(".post-share");
    if (!bar) {
      return;
    }

    const url = shareUrl(bar);
    const title = shareTitle(bar);
    const kind = trigger.getAttribute("data-share");

    if (kind === "x") {
      if (trigger.tagName && trigger.tagName.toLowerCase() === "a") {
        trigger.setAttribute("href", xIntent(url, title));
        return;
      }
      return;
    }

    if (kind === "weibo") {
      const weibo = "https://service.weibo.com/share/share.php?url=" +
        encodeURIComponent(url) + "&title=" + encodeURIComponent(title);
      event.preventDefault();
      const opened = window.open(weibo, "_blank");
      if (opened) {
        opened.opener = null;
      } else {
        fallbackWeibo(trigger, weibo, url, title);
      }
      return;
    }

    if (kind === "copy") {
      event.preventDefault();
      copyText(url).then(function () {
        flashCopied(trigger);
      }).catch(function () {
        showQr(url, title);
      });
      return;
    }

    if (kind === "wechat") {
      event.preventDefault();
      showQr(url, title);
      return;
    }
  });
})();
