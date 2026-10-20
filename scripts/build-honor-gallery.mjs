import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeAttr, escapeHtml } from "../src/lib/format.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const GALLERY_BLOCK = /(<!-- honor-gallery:start -->)[\s\S]*?(<!-- honor-gallery:end -->)/;

export async function renderHonorPhotos(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const images = entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));

  if (!images.length) {
    return `        <div class="honor-gallery-empty" id="honor-gallery-grid">
          <i class="fas fa-images" aria-hidden="true"></i>
          <p data-i18n="home.gallery.empty">荣誉证书照片正在整理中，敬请期待。</p>
        </div>`;
  }

  const cards = images.map((name) => {
    const title = name.slice(0, -extname(name).length).replace(/[-_]+/g, " ").trim() || "荣誉证书";
    const src = escapeAttr(`/images/honors/${encodeURIComponent(name)}`);
    return `          <li class="honor-photo">
            <a href="${src}" target="_blank" rel="noopener noreferrer">
              <figure>
                <div class="honor-photo-image"><img src="${src}" alt="${escapeAttr(title)}" loading="lazy" decoding="async"></div>
                <figcaption>${escapeHtml(title)}</figcaption>
              </figure>
            </a>
          </li>`;
  });

  return `        <ul class="honor-gallery-grid" id="honor-gallery-grid">\n${cards.join("\n")}\n        </ul>`;
}

export async function buildHonorGallery(root = ROOT) {
  const path = join(root, "index.html");
  const source = await readFile(path, "utf8");
  if (!GALLERY_BLOCK.test(source)) throw new Error("Homepage honor gallery markers are missing.");
  const gallery = await renderHonorPhotos(join(root, "images", "honors"));
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const output = source.replace(GALLERY_BLOCK, (_match, start, end) =>
    `${start}${newline}${gallery.replaceAll("\n", newline)}${newline}        ${end}`);
  if (output !== source) await writeFile(path, output, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildHonorGallery().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
