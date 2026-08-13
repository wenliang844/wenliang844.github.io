import { initArticleEnhancements } from "./article-enhancements";
import { initArticleReading } from "./article-reading";
import { initCodeHighlight } from "./code-highlight";
import { initNextPost } from "./next-post";

export function initArticleRuntime(
  doc: Document = document,
  win: Window & typeof globalThis = window,
) {
  if (doc.documentElement.dataset.articleRuntimeReady === "true") return;
  if (!doc.querySelector("article.article")) return;
  doc.documentElement.dataset.articleRuntimeReady = "true";
  initArticleEnhancements(doc, win);
  initArticleReading(doc, win);
  initCodeHighlight(doc, win);
  initNextPost(doc, win);
}
