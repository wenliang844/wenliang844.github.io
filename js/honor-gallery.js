(function () {
  const gallery = document.querySelector("[data-honor-gallery]");
  if (!gallery) { return; }

  const photos = Array.from(gallery.querySelectorAll(".honor-photo"));
  if (!photos.length) { return; }

  const pageSize = 6;
  const totalPages = Math.ceil(photos.length / pageSize);
  const pagination = gallery.querySelector(".honor-gallery-pagination");
  const previous = gallery.querySelector("[data-gallery-prev]");
  const next = gallery.querySelector("[data-gallery-next]");
  const pages = gallery.querySelector("[data-gallery-pages]");
  const status = gallery.querySelector("[data-gallery-status]");
  let currentPage = 1;

  function render() {
    photos.forEach(function (photo, index) {
      photo.hidden = Math.floor(index / pageSize) !== currentPage - 1;
    });
    previous.disabled = currentPage === 1;
    next.disabled = currentPage === totalPages;
    pagination.hidden = totalPages <= 1;

    const focusedPage = pages.contains(document.activeElement);
    pages.replaceChildren();
    let lastPage = 0;
    for (let page = 1; page <= totalPages; page += 1) {
      if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) { continue; }
      if (lastPage && page - lastPage > 1) {
        const gap = document.createElement("span");
        gap.textContent = "…";
        gap.setAttribute("aria-hidden", "true");
        pages.appendChild(gap);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "honor-gallery-page";
      button.dataset.galleryPage = String(page);
      button.textContent = String(page);
      button.setAttribute("aria-controls", "honor-gallery-grid");
      button.setAttribute("aria-label", CWLUtils.t("home.gallery.page", "前往第 {page} 页").replace("{page}", String(page)));
      if (page === currentPage) { button.setAttribute("aria-current", "page"); }
      pages.appendChild(button);
      lastPage = page;
    }

    const values = { page: currentPage, pages: totalPages, count: photos.length };
    status.textContent = CWLUtils.t("home.gallery.status", "第 {page} / {pages} 页 · 共 {count} 张")
      .replace(/\{(page|pages|count)\}/g, function (_match, key) { return values[key]; });
    if (focusedPage) { pages.querySelector('[aria-current="page"]').focus({ preventScroll: true }); }
  }

  pagination.addEventListener("click", function (event) {
    const button = event.target.closest("button");
    if (!button || button.disabled) { return; }
    let targetPage = Number(button.dataset.galleryPage);
    if (button === previous) { targetPage = currentPage - 1; }
    if (button === next) { targetPage = currentPage + 1; }
    if (!Number.isInteger(targetPage) || targetPage < 1 || targetPage > totalPages) { return; }
    currentPage = targetPage;
    render();
    gallery.scrollIntoView({ block: "start" });
  });

  document.addEventListener("cwl:langchange", render);
  render();
})();
