// 文章目录（TOC）交互
(function () {
  

  const tocSidebar = document.querySelector(".toc-sidebar");
  if (!tocSidebar) {return;}

  const tocToggle = tocSidebar.querySelector(".toc-toggle");
  const tocLinks = tocSidebar.querySelectorAll(".toc-nav a");
  const articleContent = document.querySelector(".article-content");

  // 展开/收起目录
  if (tocToggle) {
    const setTocOpen = (open) => {
      tocSidebar.classList.toggle("is-open", open);
      tocSidebar.classList.toggle("is-collapsed", !open);
      tocToggle.setAttribute("aria-expanded", String(open));
    };

    setTocOpen(tocToggle.getAttribute("aria-expanded") !== "false");

    tocToggle.addEventListener("click", () => {
      const expanded = tocToggle.getAttribute("aria-expanded") === "true";
      setTocOpen(!expanded);
    });
  }

  // 滚动高亮当前标题
  if (tocLinks.length > 0 && articleContent) {
    const headings = Array.from(articleContent.querySelectorAll("h2[id], h3[id]"));

    // 更新目录高亮的函数
    const updateActiveTocLink = function (id) {
      tocLinks.forEach((link) => {
        if (link.getAttribute("href") === `#${id}`) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      });
    };

    // 使用 Intersection Observer 检测标题可见性
    const observerOptions = {
      rootMargin: "-80px 0px -80% 0px",
      threshold: 0
    };

    let activeId = null;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeId = entry.target.id;
          updateActiveTocLink(activeId);
        }
      });
    }, observerOptions);

    headings.forEach((heading) => observer.observe(heading));

    // 点击目录链接平滑滚动
    tocLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetId = link.getAttribute("href").slice(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          const offset = 80; // 导航栏高度
          const elementPosition = targetElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });

          // 更新 URL hash（不触发滚动）
          history.replaceState(null, null, `#${targetId}`);
          activeId = targetId;
          updateActiveTocLink(targetId);
        }
      });
    });

    // 页面加载时检查 URL hash
    if (window.location.hash) {
      const targetId = window.location.hash.slice(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        setTimeout(() => {
          const offset = 80;
          const elementPosition = targetElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });

          activeId = targetId;
          updateActiveTocLink(targetId);
        }, 100);
      }
    }
  }
})();
