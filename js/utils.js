/**
 * 公共工具函数
 * 避免在多个文件中重复实现相同的功能
 */
(function (window) {
  

  const Utils = {};

  /**
   * HTML 转义函数，防止 XSS 攻击
   * @param {string} value - 需要转义的字符串
   * @returns {string} 转义后的安全字符串
   */
  Utils.escapeHtml = function (value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  /**
   * 复制文本到剪贴板（带降级处理）
   * @param {string} text - 需要复制的文本
   * @returns {Promise<void>}
   */
  Utils.copyText = function (text) {
    // 优先使用现代 Clipboard API
    try {
      const clipboard = window.navigator && window.navigator.clipboard;
      if (clipboard && typeof clipboard.writeText === "function") {
        return clipboard.writeText(text).catch(function (_clipboardError) {
          // Clipboard API 失败时降级到 execCommand
          return Utils.legacyCopy(text);
        });
      }
    } catch (_clipboardError) {
      return Utils.legacyCopy(text);
    }
    // 不支持 Clipboard API，直接使用 execCommand
    return Utils.legacyCopy(text);
  };

  /**
   * 使用 execCommand 复制文本（兜底方案）
   * @param {string} text - 需要复制的文本
   * @returns {Promise<void>}
   */
  Utils.legacyCopy = function (text) {
    return new Promise(function (resolve, reject) {
      let area = null;
      try {
        area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.left = "-9999px";
        area.style.top = "-9999px";
        area.style.opacity = "0";
        area.setAttribute("readonly", "");
        document.body.appendChild(area);
        area.select();
        area.setSelectionRange(0, text.length);
        const success = document.execCommand("copy");
        if (success) {
          resolve();
        } else {
          reject(new Error("execCommand copy failed"));
        }
      } catch (error) {
        reject(error);
      } finally {
        if (area && area.parentNode) {
          area.parentNode.removeChild(area);
        }
      }
    });
  };

  /**
   * 节流函数：限制函数执行频率
   * @param {Function} func - 需要节流的函数
   * @param {number} wait - 等待时间（毫秒）
   * @returns {Function} 节流后的函数
   */
  Utils.throttle = function (func, wait) {
    let timeout = null;
    let previous = 0;

    return function () {
      const now = Date.now();
      const remaining = wait - (now - previous);
      const context = this;
      const args = arguments;

      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        func.apply(context, args);
      } else if (!timeout) {
        timeout = setTimeout(function () {
          previous = Date.now();
          timeout = null;
          func.apply(context, args);
        }, remaining);
      }
    };
  };

  /**
   * 防抖函数：延迟执行，重复调用会重置计时器
   * @param {Function} func - 需要防抖的函数
   * @param {number} wait - 等待时间（毫秒）
   * @param {boolean} immediate - 是否立即执行
   * @returns {Function} 防抖后的函数
   */
  Utils.debounce = function (func, wait, immediate) {
    let timeout;
    return function () {
      const context = this;
      const args = arguments;
      const later = function () {
        timeout = null;
        if (!immediate) {
          func.apply(context, args);
        }
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) {
        func.apply(context, args);
      }
    };
  };

  /**
   * 安全地从 localStorage 读取数据
   * @param {string} key - 存储键名
   * @returns {string|null} 存储的值或 null
   */
  Utils.storageGet = function (key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn("localStorage.getItem failed:", error);
      return null;
    }
  };

  /**
   * 安全地写入数据到 localStorage
   * @param {string} key - 存储键名
   * @param {string} value - 存储的值
   * @returns {boolean} 是否成功
   */
  Utils.storageSet = function (key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn("localStorage.setItem failed:", error);
      return false;
    }
  };

  /**
   * 数字限制在指定范围内
   * @param {number} value - 输入值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 限制后的值
   */
  Utils.clamp = function (value, min, max) {
    return Math.min(max, Math.max(min, value));
  };

  /**
   * 检查当前是否在编辑状态（焦点在输入框等元素上）
   * @returns {boolean}
   */
  Utils.isEditing = function () {
    const activeElement = document.activeElement;
    if (!activeElement) {
      return false;
    }
    const tag = activeElement.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      activeElement.isContentEditable
    );
  };

  // 导出到全局
  window.CWLUtils = Utils;
})(window);
