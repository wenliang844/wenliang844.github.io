(function () {
  /* ------------------------------------------------------------------------
   * 文章分享：分享到 X、复制链接、微信二维码。
   *
   * 数据来自每个 .post-share 的 data-share-url / data-share-title。列表页每篇
   * 面板各有一条分享条，用事件委托统一处理，切换文章时取当前那条的数据即可。
   * 二维码由本地 js/vendor/qrcode.min.js（全局 qrcode）生成，不依赖外部服务。
   * ---------------------------------------------------------------------- */
  var bars = document.querySelectorAll(".post-share");
  if (!bars.length) {
    return;
  }

  // 站点根地址，用于把 /post/xxx/ 拼成可分享的绝对 URL。
  var origin = window.location.origin;

  function absUrl(path) {
    if (/^https?:/i.test(path)) {
      return path;
    }
    return origin + path;
  }

  // execCommand 兜底：用于 clipboard API 不存在、或其写入被拒（如页面失焦）时。
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      try {
        var area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand("copy");
        area.remove();
        ok ? resolve() : reject(new Error("execCommand copy failed"));
      } catch (error) {
        reject(error);
      }
    });
  }

  // ---- 剪贴板：优先 Clipboard API，被拒时自动降级到 execCommand --------------
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  // 复制成功反馈用的对勾 SVG（与模板图标同为 24×24 / currentColor）。
  var CHECK_SVG = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

  // 短暂地把按钮图标换成“对勾”，给出已复制反馈。
  function flashCopied(button) {
    if (button.classList.contains("copied")) {
      return;
    }
    var prev = button.innerHTML;
    button.innerHTML = CHECK_SVG;
    button.classList.add("copied");
    window.setTimeout(function () {
      button.innerHTML = prev;
      button.classList.remove("copied");
    }, 1600);
  }

  // ---- 微信二维码浮层 ------------------------------------------------------
  var overlay = null;

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

  function showQr(url, title) {
    closeOverlay();

    var svg = "";
    if (typeof window.qrcode === "function") {
      try {
        var qr = window.qrcode(0, "M"); // type 0 = 自适应版本，M 级纠错
        qr.addData(url);
        qr.make();
        svg = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
      } catch (error) {
        svg = "";
      }
    }

    overlay = document.createElement("div");
    overlay.className = "share-qr-overlay";
    overlay.innerHTML =
      '<div class="share-qr-card" role="dialog" aria-modal="true" aria-label="微信扫码分享">' +
      '<button class="share-qr-close" type="button" aria-label="关闭"><i class="fas fa-times" aria-hidden="true"></i></button>' +
      '<p class="share-qr-title">微信扫一扫，分享文章</p>' +
      '<div class="share-qr-code">' + (svg || '<p class="share-qr-fail">二维码生成失败，可改用“复制链接”。</p>') + "</div>" +
      '<p class="share-qr-name"></p>' +
      "</div>";

    // 用 textContent 写标题，避免把标题当 HTML 注入。
    overlay.querySelector(".share-qr-name").textContent = title || "";

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay || event.target.closest(".share-qr-close")) {
        closeOverlay();
      }
    });

    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKeydown);
  }

  // ---- 事件委托：所有分享条共用一个监听 ------------------------------------
  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-share]");
    if (!trigger) {
      return;
    }
    var bar = trigger.closest(".post-share");
    if (!bar) {
      return;
    }

    var url = absUrl(bar.getAttribute("data-share-url") || window.location.pathname);
    var title = bar.getAttribute("data-share-title") || document.title;
    var kind = trigger.getAttribute("data-share");

    if (kind === "x") {
      var intent = "https://twitter.com/intent/tweet?text=" +
        encodeURIComponent(title) + "&url=" + encodeURIComponent(url);
      event.preventDefault();
      window.open(intent, "_blank", "noopener");
      return;
    }

    if (kind === "weibo") {
      var weibo = "https://service.weibo.com/share/share.php?url=" +
        encodeURIComponent(url) + "&title=" + encodeURIComponent(title);
      event.preventDefault();
      window.open(weibo, "_blank", "noopener");
      return;
    }

    if (kind === "copy") {
      event.preventDefault();
      copyText(url).then(function () {
        flashCopied(trigger);
      }).catch(function () {
        // 两种方式都失败时，退而求其次：弹二维码让用户长按/扫码取链接。
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
