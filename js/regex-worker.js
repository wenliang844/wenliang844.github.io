(function (root) {
  try {
    root.importScripts("/js/tools-core.js");
  } catch (error) {
    root.postMessage({
      ok: false,
      error: "正则 Worker 初始化失败：" + error.message,
      code: "regexWorker",
    });
  }

  root.onmessage = function (event) {
    const data = event.data || {};
    const tools = root.CWLToolsCore;
    if (!tools || typeof tools.testRegex !== "function") {
      root.postMessage({
        ok: false,
        error: "正则 Worker 未加载工具核心",
        code: "regexWorker",
      });
      return;
    }
    root.postMessage(tools.testRegex(data.pattern, data.flags, data.input));
  };
})(typeof self !== "undefined" ? self : this);
