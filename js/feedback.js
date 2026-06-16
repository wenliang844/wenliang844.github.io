(function () {
  /* ------------------------------------------------------------------------
   * Optional: deliver feedback to your inbox via Web3Forms (no signup needed).
   * Go to https://web3forms.com, enter your email to get an Access Key, then
   * paste it below. Leave empty to keep feedback local-only (stored in the
   * visitor's browser).
   * ---------------------------------------------------------------------- */
  var WEB3FORMS_ACCESS_KEY = "610d0f9e-1439-4f74-afb5-708163036a63";
  var WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

  var storageKey = "wenliang-feedback";
  var form = document.getElementById("feedback-form");
  var nameInput = document.getElementById("fb-name");
  var contactInput = document.getElementById("fb-contact");
  var messageInput = document.getElementById("fb-message");
  var statusEl = document.getElementById("feedback-status");
  var listEl = document.getElementById("feedback-list");

  if (!form || !messageInput || !listEl) {
    return;
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(storageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function save(entries) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch (error) {}
  }

  function formatTime(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) {
      return "";
    }
    var pad = function (n) { return n < 10 ? "0" + n : String(n); };
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
      " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function render() {
    var entries = load();
    if (!entries.length) {
      listEl.innerHTML = '<li class="feedback-empty">还没有留言，来做第一个吧。</li>';
      return;
    }

    listEl.innerHTML = entries.map(function (entry) {
      var who = entry.name ? escapeHtml(entry.name) : "匿名";
      var when = formatTime(entry.time);
      return '<li class="feedback-item" data-id="' + entry.id + '">' +
        '<div class="meta"><strong>' + who + "</strong>" +
        '<span>' + escapeHtml(when) +
        ' · <button type="button" data-remove="' + entry.id + '">删除</button></span></div>' +
        '<p class="body">' + escapeHtml(entry.message) + "</p>" +
        "</li>";
    }).join("");
  }

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text || "";
    }
  }

  listEl.addEventListener("click", function (event) {
    var id = event.target && event.target.getAttribute("data-remove");
    if (!id) {
      return;
    }
    var entries = load().filter(function (entry) {
      return String(entry.id) !== String(id);
    });
    save(entries);
    render();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var message = messageInput.value.trim();
    if (!message) {
      setStatus("请输入反馈内容。");
      messageInput.focus();
      return;
    }

    var entry = {
      id: String(Date.now()) + Math.random().toString(16).slice(2, 6),
      name: nameInput ? nameInput.value.trim() : "",
      contact: contactInput ? contactInput.value.trim() : "",
      message: message,
      time: new Date().toISOString()
    };

    var entries = load();
    entries.unshift(entry);
    save(entries);
    render();

    messageInput.value = "";
    setStatus("已保存到本地。感谢你的反馈！");

    // Best-effort delivery to the site owner via Web3Forms when a key is set.
    if (WEB3FORMS_ACCESS_KEY) {
      fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: "博客新反馈" + (entry.name ? "（来自 " + entry.name + "）" : ""),
          from_name: entry.name || "匿名访客",
          name: entry.name || "匿名访客",
          contact: entry.contact || "（未填写）",
          message: entry.message
        })
      }).then(function (response) {
        return response.json().catch(function () { return { success: response.ok }; });
      }).then(function (result) {
        setStatus(result && result.success
          ? "已提交并发送给站长，感谢！"
          : "已保存到本地（在线提交失败，可稍后重试）。");
      }).catch(function () {
        setStatus("已保存到本地（当前离线或提交失败）。");
      });
    }
  });

  render();
})();
