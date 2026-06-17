(function () {
  /* ------------------------------------------------------------------------
   * 页脚邮件订阅：提交到 Buttondown 的 embed 端点（无后端）。
   * 存储 / 发送 / 退订 / 双重确认全部由 Buttondown 托管；本文件只负责前端提交。
   * 范式对齐 js/feedback.js：配置常量写在文件内 + t(key) 做 i18n +
   * setStatus 内联提示 + 监听 cwl:langchange。
   * ---------------------------------------------------------------------- */

  // 注册 https://buttondown.com 后，把你的 username 填到这里（全站唯一一处）。
  // 留空则页脚订阅表单自动禁用，不会向无效端点发请求。
  const BUTTONDOWN_USERNAME = "cwl";

  const root = document.querySelector(".subscribe");
  if (!root) {
    return;
  }

  const form = root.querySelector(".subscribe-form");
  const input = root.querySelector(".subscribe-input");
  const btn = root.querySelector(".subscribe-btn");
  const statusEl = root.querySelector(".subscribe-status");
  const navButtons = document.querySelectorAll("[data-subscribe-open]");

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
  }

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text || "";
    }
  }

  navButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const menuToggle = document.querySelector(".menu-toggle");

      if (menuToggle) {
        menuToggle.checked = false;
      }

      root.scrollIntoView({ behavior: "smooth", block: "center" });
      root.classList.remove("subscribe--focus");
      window.setTimeout(function () {
        root.classList.add("subscribe--focus");
        if (input && !input.disabled) {
          input.focus({ preventScroll: true });
        }
        setStatus(t("subscribe.ready", "输入邮箱即可订阅更新。"));
      }, 180);
      window.setTimeout(function () {
        root.classList.remove("subscribe--focus");
      }, 1800);
    });
  });

  if (!form || !input) {
    return;
  }

  const username = BUTTONDOWN_USERNAME.trim();
  const ENDPOINT = "https://buttondown.com/api/emails/embed-subscribe/";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 未配置用户名：禁用输入与按钮并提示，避免提交打到无效端点。
  // 提示也随语言切换刷新，保持与全站 i18n 一致。
  if (!username) {
    input.disabled = true;
    if (btn) {
      btn.disabled = true;
    }
    const showDisabled = function () {
      setStatus(t("subscribe.disabled", "订阅暂未开通。"));
    };
    showDisabled();
    document.addEventListener("cwl:langchange", showDisabled);
    return;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = input.value.trim();
    if (!EMAIL_RE.test(email)) {
      setStatus(t("subscribe.invalid", "请输入有效的邮箱地址。"));
      input.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
    }
    setStatus(t("subscribe.sending", "提交中…"));

    const body = new FormData();
    body.append("email", email);
    body.append("embed", "1");

    // Buttondown embed 端点跨域不返回 CORS 头，用 no-cors 乐观提交：
    // 响应不可读，成功与否以 Buttondown 的确认邮件为准（没收到即未成功）。
    fetch(ENDPOINT + encodeURIComponent(username), {
      method: "POST",
      mode: "no-cors",
      body: body
    }).then(function () {
      setStatus(t("subscribe.success", "差一步！请查收确认邮件完成订阅。"));
      form.reset();
    }).catch(function () {
      setStatus(t("subscribe.fail", "提交失败，请稍后重试。"));
    }).then(function () {
      if (btn) {
        btn.disabled = false;
      }
    });
  });

  // 语言切换时清空状态，避免中英混杂的旧提示残留。
  document.addEventListener("cwl:langchange", function () {
    setStatus("");
  });
})();
