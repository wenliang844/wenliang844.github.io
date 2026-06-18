/**
 * 性能监控工具
 * 监控页面性能指标并提供诊断信息
 */
(function () {
  

  const PerformanceMonitor = {
    // 性能指标收集
    metrics: {
      navigation: null,
      resources: [],
      marks: {},
      measures: {}
    },

    // 是否启用（生产环境可设为 false）
    enabled: false,

    /**
     * 初始化性能监控
     */
    init: function () {
      if (!this.enabled || !window.performance) {
        return;
      }

      // 监控页面加载性能
      if (window.PerformanceObserver) {
        this.observeResources();
        this.observeLCP();
        this.observeFID();
        this.observeCLS();
      }

      // 页面完全加载后收集导航时序
      if (document.readyState === 'complete') {
        this.collectNavigationTiming();
      } else {
        window.addEventListener('load', this.collectNavigationTiming.bind(this));
      }
    },

    /**
     * 收集导航时序指标
     */
    collectNavigationTiming: function () {
      if (!window.performance || !window.performance.getEntriesByType) {
        return;
      }

      const nav = window.performance.getEntriesByType("navigation")[0];
      if (!nav) {
        return;
      }

      const duration = function (end, start) {
        return Math.max(0, Math.round(end - start));
      };

      const navigation = {
        // DNS 查询时间
        dns: duration(nav.domainLookupEnd, nav.domainLookupStart),
        // TCP 连接时间
        tcp: duration(nav.connectEnd, nav.connectStart),
        // 请求响应时间
        request: duration(nav.responseEnd, nav.requestStart),
        // DOM 解析时间
        domParse: duration(nav.domInteractive, nav.responseEnd),
        // 资源加载时间
        resourceLoad: duration(nav.loadEventStart, nav.domContentLoadedEventEnd),
        // 总时间
        total: Math.max(0, Math.round(nav.duration || nav.loadEventEnd || 0))
      };

      this.metrics.navigation = navigation;

      if (this.enabled) {
        console.info('[Performance] Navigation Timing:', navigation);
      }
    },

    /**
     * 监控资源加载性能
     */
    observeResources: function () {
      const self = this;
      try {
        const observer = new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (entry) {
            if (entry.duration > 1000) {
              // 资源加载超过 1 秒时记录
              self.metrics.resources.push({
                name: entry.name,
                duration: entry.duration,
                size: entry.transferSize || 0,
                type: entry.initiatorType
              });

              if (self.enabled) {
                console.warn('[Performance] Slow resource:', entry.name, entry.duration + 'ms');
              }
            }
          });
        });

        observer.observe({ entryTypes: ['resource'] });
      } catch (error) {
        // PerformanceObserver not supported
      }
    },

    /**
     * 监控最大内容绘制 (LCP)
     */
    observeLCP: function () {
      const self = this;
      try {
        const observer = new PerformanceObserver(function (list) {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          self.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;

          if (self.enabled) {
            console.info('[Performance] LCP:', self.metrics.lcp + 'ms');
          }
        });

        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        // LCP not supported
      }
    },

    /**
     * 监控首次输入延迟 (FID)
     */
    observeFID: function () {
      const self = this;
      try {
        const observer = new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (entry) {
            self.metrics.fid = entry.processingStart - entry.startTime;

            if (self.enabled) {
              console.info('[Performance] FID:', self.metrics.fid + 'ms');
            }
          });
        });

        observer.observe({ entryTypes: ['first-input'] });
      } catch (error) {
        // FID not supported
      }
    },

    /**
     * 监控累积布局偏移 (CLS)
     */
    observeCLS: function () {
      const self = this;
      let clsValue = 0;

      try {
        const observer = new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (entry) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              self.metrics.cls = clsValue;

              if (self.enabled) {
                console.info('[Performance] CLS:', clsValue.toFixed(4));
              }
            }
          });
        });

        observer.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        // CLS not supported
      }
    },

    /**
     * 标记性能时间点
     */
    mark: function (name) {
      if (!window.performance || !window.performance.mark) {
        return;
      }

      try {
        window.performance.mark(name);
        this.metrics.marks[name] = window.performance.now();
      } catch (error) {
        // Mark failed
      }
    },

    /**
     * 测量两个标记之间的时间
     */
    measure: function (name, startMark, endMark) {
      if (!window.performance || !window.performance.measure) {
        return;
      }

      try {
        window.performance.measure(name, startMark, endMark);
        const entry = window.performance.getEntriesByName(name)[0];
        if (entry) {
          this.metrics.measures[name] = entry.duration;

          if (this.enabled) {
            console.info('[Performance] Measure:', name, entry.duration + 'ms');
          }
        }
      } catch (error) {
        // Measure failed
      }
    },

    /**
     * 获取性能报告
     */
    getReport: function () {
      return {
        navigation: this.metrics.navigation,
        resources: this.metrics.resources,
        webVitals: {
          lcp: this.metrics.lcp,
          fid: this.metrics.fid,
          cls: this.metrics.cls
        },
        marks: this.metrics.marks,
        measures: this.metrics.measures,
        memory: window.performance.memory ? {
          used: window.performance.memory.usedJSHeapSize,
          total: window.performance.memory.totalJSHeapSize,
          limit: window.performance.memory.jsHeapSizeLimit
        } : null
      };
    }
  };

  // 导出到全局
  window.CWLPerformance = PerformanceMonitor;

  // 自动初始化
  PerformanceMonitor.init();
})();
