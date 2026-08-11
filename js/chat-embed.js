(function () {
  const host = document.querySelector(".minnit-chat-sembed");
  if (!host) {
    return;
  }

  function labelFrame() {
    const frame = host.querySelector(".minnit-chat-iframe");
    if (!frame) {
      return false;
    }
    frame.title = "Minnit Chat";
    return true;
  }

  if (labelFrame()) {
    return;
  }

  const observer = new MutationObserver(function () {
    if (labelFrame()) {
      observer.disconnect();
    }
  });
  observer.observe(host, { childList: true, subtree: true });
  window.setTimeout(function () { observer.disconnect(); }, 15000);
}());
