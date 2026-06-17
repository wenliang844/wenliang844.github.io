/**
 * 前端日志收集器
 * 收集用户操作和错误日志，支持批量上传
 */
(function () {
  

  const Logger = {
    // 日志队列
    queue: [],
    maxQueueSize: 100,

    // 上传端点（需配置）
    endpoint: '',

    // 是否启用
    enabled: false,

    /**
     * 记录日志
     */
    log: function (level, category, message, data) {
      const entry = {
        timestamp: Date.now(),
        level: level,
        category: category,
        message: message,
        data: data || null,
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      this.queue.push(entry);

      // 队列满时自动上传
      if (this.queue.length >= this.maxQueueSize) {
        this.flush();
      }

      return entry;
    },

    /**
     * 记录信息
     */
    info: function (category, message, data) {
      return this.log('info', category, message, data);
    },

    /**
     * 记录警告
     */
    warn: function (category, message, data) {
      return this.log('warn', category, message, data);
    },

    /**
     * 记录错误
     */
    error: function (category, message, data) {
      return this.log('error', category, message, data);
    },

    /**
     * 上传日志
     */
    flush: function () {
      if (!this.enabled || !this.endpoint || this.queue.length === 0) {
        return;
      }

      const logs = this.queue.slice();
      this.queue = [];

      // 使用 sendBeacon 确保页面关闭时也能发送
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          this.endpoint,
          JSON.stringify({ logs: logs })
        );
      } else {
        fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: logs }),
          keepalive: true
        }).catch(function () {
          // Upload failed, ignore
        });
      }
    },

    /**
     * 清空日志队列
     */
    clear: function () {
      this.queue = [];
    }
  };

  // 页面关闭前上传日志
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      Logger.flush();
    }
  });

  window.addEventListener('pagehide', function () {
    Logger.flush();
  });

  // 导出到全局
  window.CWLLogger = Logger;
})();
