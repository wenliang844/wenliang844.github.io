import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://wenliang844.github.io",
  output: "static",
  outDir: "./temp/astro-dist",
  publicDir: "./temp/astro-public",
  compressHTML: false,
  build: {
    format: "directory",
  },
});
