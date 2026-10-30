import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { buildHonorGallery, renderHonorPhotos } from "../scripts/build-honor-gallery.mjs";

const ROOT = join(import.meta.dirname, "..");
const [home, runtime, utils, i18n] = await Promise.all([
  readFile(join(ROOT, "index.html"), "utf8"),
  readFile(join(ROOT, "js", "honor-gallery.js"), "utf8"),
  readFile(join(ROOT, "js", "utils.js"), "utf8"),
  readFile(join(ROOT, "js", "i18n.js"), "utf8"),
]);

async function fixture(t) {
  const base = join(ROOT, ".run");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "honor-gallery-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const images = join(root, "images", "honors");
  await mkdir(images, { recursive: true });
  await writeFile(join(root, "index.html"), home);
  return { root, images };
}

function galleryDOM(t, html = home) {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://wenliang844.github.io/" });
  t.after(() => dom.window.close());
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.eval(utils);
  dom.window.eval(i18n);
  return dom;
}

async function populatedDOM(t, count) {
  const { root, images } = await fixture(t);
  for (let i = 1; i <= count; i += 1) await writeFile(join(images, `${i}-证书.png`), "fixture");
  await buildHonorGallery(root);
  const dom = galleryDOM(t, await readFile(join(root, "index.html"), "utf8"));
  dom.window.eval(runtime);
  return dom;
}

test("gallery build discovers only supported local photos with natural order and safe filenames", async (t) => {
  const { root, images } = await fixture(t);
  const names = ["10-证书.JPG", "2-奖项 & 特别#.webp", "1-证书.png", "3-荣誉 & 成长.gif", "README.md", ".hidden.png"];
  for (const name of names) await writeFile(join(images, name), "fixture");
  await mkdir(join(images, "nested.png"));
  await writeFile(join(images, "nested.png", "nested.jpg"), "fixture");
  await buildHonorGallery(root);
  const output = await readFile(join(root, "index.html"), "utf8");
  const dom = galleryDOM(t, output);
  const document = dom.window.document;
  const photos = Array.from(document.querySelectorAll(".honor-photo"));
  assert.equal(photos.length, 4);
  assert.deepEqual(photos.map((photo) => photo.textContent.trim()), ["1 证书", "2 奖项 & 特别#", "3 荣誉 & 成长", "10 证书"]);
  assert.equal(photos[1].querySelector("img").getAttribute("src"), `/images/honors/${encodeURIComponent(names[1])}`);
  assert.equal(photos[2].querySelector("figcaption").children.length, 0);
  assert.equal(photos[2].querySelector("img").alt, "3 荣誉 & 成长");
  assert.match(photos[2].querySelector("figcaption").innerHTML, /&amp;/);
  assert.equal(photos[0].querySelector("img").getAttribute("loading"), "lazy");
  assert.equal(photos[0].querySelector("a").target, "_blank");
  assert.equal(document.querySelector("[data-honor-gallery]").nextElementSibling.getAttribute("aria-labelledby"), "honor-title");
  assert.equal(document.querySelector('[aria-labelledby="honor-title"]').nextElementSibling.getAttribute("aria-labelledby"), "ai-stack-title");
  const stripGallery = (html) => html.replace(/<!-- honor-gallery:start -->[\s\S]*?<!-- honor-gallery:end -->/, "GALLERY");
  assert.equal(stripGallery(output), stripGallery(home));
  await buildHonorGallery(root);
  assert.equal(await readFile(join(root, "index.html"), "utf8"), output, "repeated builds must be stable");
});

test("empty and single-page galleries hide pagination and remain readable without runtime", async (t) => {
  const { images } = await fixture(t);
  const empty = await renderHonorPhotos(images);
  const emptyDOM = galleryDOM(t, home.replace(/<!-- honor-gallery:start -->[\s\S]*?<!-- honor-gallery:end -->/, empty));
  emptyDOM.window.eval(runtime);
  assert.ok(emptyDOM.window.document.querySelector(".honor-gallery-empty"));
  assert.equal(emptyDOM.window.document.querySelector(".honor-gallery-pagination").hidden, true);

  const dom = await populatedDOM(t, 6);
  assert.equal(dom.window.document.querySelectorAll(".honor-photo:not([hidden])").length, 6);
  assert.equal(dom.window.document.querySelector(".honor-gallery-pagination").hidden, true);
});

test("pagination visits every photo and respects first/last boundaries", async (t) => {
  const dom = await populatedDOM(t, 14);
  const document = dom.window.document;
  const visible = () => Array.from(document.querySelectorAll(".honor-photo:not([hidden]) figcaption"), (node) => node.textContent);
  const previous = document.querySelector("[data-gallery-prev]");
  const next = document.querySelector("[data-gallery-next]");
  assert.equal(previous.disabled, true);
  assert.equal(next.disabled, false);
  assert.equal(visible().length, 6);
  next.click();
  assert.deepEqual(visible(), ["7 证书", "8 证书", "9 证书", "10 证书", "11 证书", "12 证书"]);
  next.click();
  assert.deepEqual(visible(), ["13 证书", "14 证书"]);
  assert.equal(next.disabled, true);
  next.click();
  assert.equal(visible().length, 2);
  previous.click();
  assert.equal(visible()[0], "7 证书");
  document.querySelector('[data-gallery-page="1"]').click();
  assert.equal(visible()[0], "1 证书");
  assert.equal(previous.disabled, true);
  assert.equal(document.querySelector('[aria-current="page"]').textContent, "1");
});

test("large galleries keep page controls compact and retain keyboard focus and language", async (t) => {
  const dom = await populatedDOM(t, 61);
  const document = dom.window.document;
  const last = document.querySelector('[data-gallery-page="11"]');
  last.focus();
  last.click();
  assert.equal(document.activeElement.dataset.galleryPage, "11");
  assert.ok(document.querySelectorAll("[data-gallery-page]").length <= 5);
  assert.equal(document.querySelectorAll(".honor-photo:not([hidden])").length, 1);
  dom.window.cwlSetLang("en");
  assert.equal(document.querySelector("[data-gallery-status]").textContent, "Page 11 of 11 · 61 photos");
  assert.equal(document.querySelector("[data-gallery-prev]").textContent, "Previous");
  assert.equal(document.querySelector('[aria-current="page"]').getAttribute("aria-label"), "Go to page 11");
  dom.window.cwlSetLang("zh");
  assert.equal(document.querySelector("[data-gallery-status]").textContent, "第 11 / 11 页 · 共 61 张");
});

test("gallery build reports missing source markers instead of silently skipping updates", async (t) => {
  const { root } = await fixture(t);
  await writeFile(join(root, "index.html"), "<!doctype html><h1>Missing gallery</h1>");
  await assert.rejects(buildHonorGallery(root), /gallery markers are missing/);
});
