(function () {
  /* ------------------------------------------------------------------------
   * 邮件订阅：页脚表单 + 导航弹窗，提交到 Buttondown embed 端点（无后端）。
   * 存储 / 发送 / 退订 / 双重确认全部由 Buttondown 托管；本文件只负责前端提交。
   * 范式对齐 search.js：弹窗动态创建 overlay + .open class 切换 + ESC/遮罩关闭。
   * ---------------------------------------------------------------------- */

  // 注册 https://buttondown.com 后，把你的 username 填到这里（全站唯一一处）。
  // 留空则页脚订阅表单和弹窗自动禁用，不会向无效端点发请求。
  var BUTTONDOWN_USERNAME = "cwl";

  var username = BUTTONDOWN_USERNAME.trim();
  var ENDPOINT = "https://buttondown.com/api/emails/embed-subscribe/";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  /* ---- 共用提交函数 ------------------------------------------------------ */
  // 校验 + no-cors 提交 + i18n 状态提示，页脚表单和弹窗都调这个。
  // setStatus: function(text) 用于更新状态文本
  // btn: 提交按钮 DOM（可选，用于禁用/恢复）
  // onSuccess: 成功后回调（可选，弹窗里用于延迟关闭）
  function submitEmail(email, setStatus, btn, onSuccess) {
    email = email.trim();
    if (!EMAIL_RE.test(email)) {
      setStatus(t("subscribe.invalid", "请输入有效的邮箱地址。"));
      return;
    }

    if (btn) btn.disabled = true;
    setStatus(t("subscribe.sending", "提交中…"));

    var body = new FormData();
    body.append("email", email);
    body.append("embed", "1");

    fetch(ENDPOINT + encodeURIComponent(username), {
      method: "POST",
      mode: "no-cors",
      body: body
    }).then(function () {
      setStatus(t("subscribe.success", "差一步！请查收确认邮件完成订阅。"));
      if (onSuccess) onSuccess();
    }).catch(function () {
      setStatus(t("subscribe.fail", "提交失败，请稍后重试。"));
    }).then(function () {
      if (btn) btn.disabled = false;
    });
  }

  /* ---- 页脚表单 --------------------------------------------------------- */
  var footerRoot = document.querySelector(".subscribe");
  if (footerRoot) {
    var footerForm = footerRoot.querySelector(".subscribe-form");
    var footerInput = footerRoot.querySelector(".subscribe-input");
    var footerBtn = footerRoot.querySelector(".subscribe-btn");
    var footerStatus = footerRoot.querySelector(".subscribe-status");

    function setFooterStatus(text) {
      if (footerStatus) footerStatus.textContent = text || "";
    }

    // 未配置 username：禁用并提示
    if (!username && footerForm) {
      footerInput.disabled = true;
      if (footerBtn) footerBtn.disabled = true;
      var showDisabled = function () {
        setFooterStatus(t("subscribe.disabled", "订阅暂未开通。"));
      };
      showDisabled();
      document.addEventListener("cwl:langchange", showDisabled);
    } else if (footerForm && footerInput) {
      footerForm.addEventListener("submit", function (e) {
        e.preventDefault();
        submitEmail(footerInput.value, setFooterStatus, footerBtn, function () {
          footerForm.reset();
        });
      });
    }

    // 语言切换时清空状态
    document.addEventListener("cwl:langchange", function () {
      setFooterStatus("");
    });
  }

  /* ---- 订阅弹窗 --------------------------------------------------------- */
  if (!username) {
    // 未配置 username 时弹窗不创建，导航按钮点击也无效
    return;
  }

  var overlay = document.createElement("div");
  overlay.className = "subscribe-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "subscribe-modal-title");

  overlay.innerHTML =
    '<div class="subscribe-modal-card">' +
    '<div class="subscribe-modal-head">' +
    '<h2 id="subscribe-modal-title" data-i18n="subscribe.title">订阅更新 · 新文章邮件提醒</h2>' +
    '<button class="subscribe-modal-close" type="button" aria-label="关闭" data-i18n-aria="subscribe.close">' +
    '<i class="fas fa-times"></i>' +
    '</button>' +
    '</div>' +
    '<form class="subscribe-modal-form" novalidate>' +
    '<input class="subscribe-modal-input" type="email" name="email" required autocomplete="email" ' +
    'placeholder="输入你的邮箱" data-i18n-ph="subscribe.ph" aria-label="Email">' +
    '<button class="subscribe-modal-btn" type="submit" data-i18n="subscribe.btn">订阅</button>' +
    '</form>' +
    '<p class="subscribe-modal-status" role="status" aria-live="polite"></p>' +
    '</div>';

  var modalInput = overlay.querySelector(".subscribe-modal-input");
  var modalBtn = overlay.querySelector(".subscribe-modal-btn");
  var modalStatus = overlay.querySelector(".subscribe-modal-status");
  var modalForm = overlay.querySelector(".subscribe-modal-form");
  var closeBtn = overlay.querySelector(".subscribe-modal-close");

  var lastActive = null;
  var oldOverflow = "";

  document.body.appendChild(overlay);

  function setModalStatus(text) {
    if (modalStatus) modalStatus.textContent = text || "";
  }

  function openModal() {
    lastActive = document.activeElement;
    oldOverflow = document.body.style.overflow;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    setModalStatus("");
    applyI18n();
    // 等可见性切换生效后再聚焦，否则 visibility:hidden→visible 过渡中 focus 无效。
    requestAnimationFrame(function () {
      modalInput.focus();
    });
  }

  function closeModal() {
    overlay.classList.remove("open");
    document.body.style.overflow = oldOverflow;
    if (lastActive && lastActive.focus) {
      lastActive.focus();
    }
    modalForm.reset();
    setModalStatus("");
  }

  function applyI18n() {
    var title = overlay.querySelector("#subscribe-modal-title");
    if (title) {
      title.textContent = t("subscribe.title", "订阅更新 · 新文章邮件提醒");
    }
    if (modalInput) {
      modalInput.setAttribute("placeholder", t("subscribe.ph", "输入你的邮箱"));
    }
    if (modalBtn) {
      modalBtn.textContent = t("subscribe.btn", "订阅");
    }
    if (closeBtn) {
      closeBtn.setAttribute("aria-label", t("subscribe.close", "关闭"));
    }
  }

  // 导航按钮点击打开
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-subscribe-open]");
    if (btn) {
      e.preventDefault();
      openModal();
    }
  });

  // 表单提交
  modalForm.addEventListener("submit", function (e) {
    e.preventDefault();
    submitEmail(modalInput.value, setModalStatus, modalBtn, function () {
      // 成功后 1.2s 延迟关闭，让用户看到成功提示
      setTimeout(function () {
        closeModal();
      }, 1200);
    });
  });

  // 关闭按钮 / 遮罩点击 / ESC
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      closeModal();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) {
      closeModal();
    }
  });

  // 语言切换时更新弹窗文案
  document.addEventListener("cwl:langchange", function () {
    if (overlay.classList.contains("open")) {
      applyI18n();
    }
    setModalStatus("");
  });
})();
