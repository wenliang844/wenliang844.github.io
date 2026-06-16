/**
 * 智能加载代码高亮库
 * 仅在页面包含代码块时才加载 highlight.js (120KB)
 * 性能优化：避免在无代码页面加载不必要的库
 */
(function () {
  // 检查是否有代码块需要高亮
  var codeBlocks = document.querySelectorAll('pre code');

  if (codeBlocks.length === 0) {
    // 无代码块，跳过加载
    return;
  }

  // 检查是否已加载
  if (window.hljs) {
    return;
  }

  // 动态加载 highlight.js
  var script = document.createElement('script');
  script.src = '/js/vendor/highlight.min.js';
  script.async = true;

  script.onload = function () {
    if (!window.hljs) {
      return;
    }

    // 配置高亮选项
    window.hljs.configure({
      ignoreUnescapedHTML: true,
      languages: ['javascript', 'java', 'python', 'bash', 'sql', 'html', 'css', 'json', 'xml']
    });

    // 高亮所有代码块
    codeBlocks.forEach(function (block) {
      try {
        window.hljs.highlightElement(block);
      } catch (error) {
        console.warn('Failed to highlight code block:', error);
      }
    });
  };

  script.onerror = function () {
    console.warn('Failed to load highlight.js');
  };

  document.head.appendChild(script);
})();
