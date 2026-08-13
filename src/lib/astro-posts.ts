import { getCollection } from "astro:content";
import { buildPosts } from "../../scripts/build.mjs";

export type SitePost = {
  slug: string;
  date: string;
  modified: string;
  series: string;
  backlinks: SitePost[];
  [key: string]: unknown;
};

let publishedPosts: Promise<SitePost[]> | undefined;

export function getPublishedPosts(): Promise<SitePost[]> {
  publishedPosts ??= getCollection("posts").then((entries) => {
    const sources = entries.map((entry) => ({
      file: entry.id.endsWith(".md") ? entry.id : `${entry.id}.md`,
      data: entry.data,
      content: entry.body || "",
    }));
    return buildPosts(sources) as Promise<SitePost[]>;
  });
  return publishedPosts;
}
