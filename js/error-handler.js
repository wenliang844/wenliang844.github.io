/**
 * 全局错误处理和日志管理
 * 捕获未处理的错误并提供用户友好的反馈
 */
(function () {
  'use strict';

  var ErrorHandler = {
    // 是否启用调试模式（生产环境应设为 false）
    debug: false,

    // 错误日志存储（最多保留 50 条）
    logs: [],
    maxLogs: 50,

    /**
     * 记录错误
     * @param {Error} error - 错误对象
     * @param {string} context - 错误上下文
     */
    log: function (error, context) {
      var entry = {
        time: new Date().toISOString(),
        context: context || 'unknown',
        message: error.message || String(error),
        stack: error.stack || '',
        userAgent: navigator.userAgent
      };

      this.logs.push(entry);

      // 保持日志数量限制
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }

      // 开发模式下输出到控制台
      if (this.debug) {
        console.error('[ErrorHandler]', context, error);
      }

      return entry;
    },

    /**
     * 显示用户友好的错误提示
     * @param {string} message - 用户可读的错误消息
     */
    showUserMessage: function (message) {
      // 检查是否已有错误提示
      var existing = document.querySelector('.global-error-toast');
      if (existing) {
        existing.remove();
      }

      var toast = document.createElement('div');
      toast.className = 'global-error-toast';
      toast.setAttribute('role', 'alert');
      toast.setAttribute('aria-live', 'assertive');

      var content = document.createElement('div');
      content.className = 'error-toast-content';

      var icon = document.createElement('i');
      icon.className = 'fas fa-exclamation-circle';
      icon.setAttribute('aria-hidden', 'true');

      var text = document.createElement('span');
      text.textContent = message;

      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'error-toast-close';
      close.setAttribute('aria-label', '关闭');

      var closeIcon = document.createElement('i');
      closeIcon.className = 'fas fa-times';
      closeIcon.setAttribute('aria-hidden', 'true');
      close.appendChild(closeIcon);

      content.appendChild(icon);
      content.appendChild(text);
      content.appendChild(close);
      toast.appendChild(content);

      close.addEventListener('click', function () {
        toast.remove();
      });

      document.body.appendChild(toast);

      // 5秒后自动消失
      setTimeout(function () {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 5000);
    },

    /**
     * 获取错误日志
     */
    getLogs: function () {
      return this.logs.slice();
    },

    /**
     * 清空错误日志
     */
    clearLogs: function () {
      this.logs = [];
    }
  };

  // 全局未捕获错误处理
  window.addEventListener('error', function (event) {
    ErrorHandler.log(event.error || new Error(event.message), 'window.onerror');

    // 显示用户友好的消息
    ErrorHandler.showUserMessage('页面遇到了一个问题，已自动记录。请刷新页面重试。');

    // 阻止默认错误显示
    event.preventDefault();
  });

  // Promise 未捕获拒绝处理
  window.addEventListener('unhandledrejection', function (event) {
    ErrorHandler.log(
      new Error(event.reason || 'Promise rejected'),
      'unhandledrejection'
    );

    ErrorHandler.showUserMessage('操作失败，请稍后重试。');

    event.preventDefault();
  });

  // 资源加载失败处理
  window.addEventListener('error', function (event) {
    if (event.target !== window) {
      var target = event.target;
      var tagName = target.tagName ? target.tagName.toLowerCase() : 'unknown';
      var src = target.src || target.href || 'unknown';

      ErrorHandler.log(
        new Error('Resource failed to load: ' + src),
        'resource-error:' + tagName
      );

      // 对关键资源加载失败给出提示
      if (tagName === 'script' && src.includes('vendor')) {
        ErrorHandler.showUserMessage('部分功能加载失败，页面功能可能受限。');
      }
    }
  }, true);

  // 导出到全局
  window.CWLErrorHandler = ErrorHandler;

  // 添加样式
  var style = document.createElement('style');
  style.textContent = `
    .global-error-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
    }

    .error-toast-content {
      background: #f44336;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .error-toast-content i.fa-exclamation-circle {
      font-size: 20px;
      flex-shrink: 0;
    }

    .error-toast-content span {
      flex: 1;
      font-size: 14px;
      line-height: 1.5;
    }

    .error-toast-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 4px;
      opacity: 0.8;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }

    .error-toast-close:hover {
      opacity: 1;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @media (max-width: 480px) {
      .global-error-toast {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }
    }
  `;
  document.head.appendChild(style);
})();
