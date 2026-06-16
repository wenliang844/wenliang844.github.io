(function () {
  /* ------------------------------------------------------------------------
   * Optional: deliver feedback to your inbox via Web3Forms. Static sites cannot
   * keep this key private, so the safe default is local-only feedback.
   * Set a key only if you explicitly accept public client-side form submission.
   * ---------------------------------------------------------------------- */
  var WEB3FORMS_ACCESS_KEY = "";
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

  function t(key, fallback) {
    return window.cwlT ? window.cwlT(key, fallback) : fallback;
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

  function render() {
    var entries = load();
    listEl.replaceChildren();

    if (!entries.length) {
      var empty = document.createElement("li");
      empty.className = "feedback-empty";
      empty.textContent = t("contact.fb.empty", "还没有留言，来做第一个吧。");
      listEl.appendChild(empty);
      return;
    }

    entries.forEach(function (entry) {
      var item = document.createElement("li");
      item.className = "feedback-item";
      item.dataset.id = entry.id;

      var meta = document.createElement("div");
      meta.className = "meta";

      var name = document.createElement("strong");
      name.textContent = entry.name || t("contact.fb.anon", "匿名");

      var metaRight = document.createElement("span");
      var when = formatTime(entry.time);
      metaRight.appendChild(document.createTextNode(when + " · "));

      var remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.remove = entry.id;
      remove.textContent = t("contact.fb.delete", "删除");
      metaRight.appendChild(remove);

      meta.appendChild(name);
      meta.appendChild(metaRight);

      var body = document.createElement("p");
      body.className = "body";
      body.textContent = entry.message || "";

      item.appendChild(meta);
      item.appendChild(body);
      listEl.appendChild(item);
    });
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
      setStatus(t("contact.fb.required", "请输入反馈内容。"));
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
    setStatus(t("contact.fb.saved", "已保存到本地。感谢你的反馈！"));

    // Best-effort delivery to the site owner via Web3Forms when a key is set.
    if (WEB3FORMS_ACCESS_KEY) {
      fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: t("contact.fb.subject", "博客新反馈") + (entry.name ? "（来自 " + entry.name + "）" : ""),
          from_name: entry.name || t("contact.fb.from", "匿名访客"),
          name: entry.name || t("contact.fb.from", "匿名访客"),
          contact: entry.contact || t("contact.fb.notProvided", "（未填写）"),
          message: entry.message
        })
      }).then(function (response) {
        return response.json().catch(function () { return { success: response.ok }; });
      }).then(function (result) {
        setStatus(result && result.success
          ? t("contact.fb.sent", "已提交并发送给站长，感谢！")
          : t("contact.fb.sendFail", "已保存到本地（在线提交失败，可稍后重试）。"));
      }).catch(function () {
        setStatus(t("contact.fb.offline", "已保存到本地（当前离线或提交失败）。"));
      });
    }
  });

  document.addEventListener("cwl:langchange", render);
  render();
})();
