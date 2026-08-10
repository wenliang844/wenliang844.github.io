(function () {
  const buttons = Array.from(document.querySelectorAll("[data-knowledge-filter]"));
  const nodes = Array.from(document.querySelectorAll(".knowledge-nodes [data-category]"));
  const edges = Array.from(document.querySelectorAll(".knowledge-edges line"));
  const rows = Array.from(document.querySelectorAll(".knowledge-inventory [data-category]"));
  if (!buttons.length) { return; }

  function apply(category) {
    buttons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.knowledgeFilter === category);
    });
    nodes.forEach(function (node) {
      node.classList.toggle("is-dimmed", category !== "all" && node.dataset.category !== category);
    });
    edges.forEach(function (edge) {
      const related = edge.dataset.sourceCategory === category || edge.dataset.targetCategory === category;
      edge.classList.toggle("is-dimmed", category !== "all" && !related);
    });
    rows.forEach(function (row) {
      row.hidden = category !== "all" && row.dataset.category !== category;
    });
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      apply(button.dataset.knowledgeFilter || "all");
    });
  });
})();
