import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const date = z.union([z.string(), z.date()]).transform((value) => {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}).pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/posts" }),
  schema: z.object({
    title: z.string().min(1).max(200),
    titleEn: z.string().min(1).max(200).optional(),
    shortTitle: z.string().min(1).max(100),
    shortTitleEn: z.string().min(1).max(100).optional(),
    slug: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/).optional(),
    date,
    modified: date.optional(),
    category: z.enum(["ai-coding", "ai-systems", "backend-platform", "frontend-platform"]),
    series: z.enum(["ai-collaboration", "enterprise-platforms", "intelligent-analysis"]).optional(),
    order: z.number().int().positive().optional(),
    eyebrow: z.string().min(1).optional(),
    summary: z.string().min(1),
    summaryEn: z.string().min(1).optional(),
    description: z.string().min(1).max(500),
    descriptionEn: z.string().min(1).max(500).optional(),
    cover: z.string().min(1).optional(),
    coverAlt: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).default([]),
    tagsEn: z.array(z.string().min(1)).optional(),
    contentEn: z.string().optional(),
    draft: z.boolean().default(false),
  }).superRefine((data, context) => {
    if (data.series && data.order === undefined) {
      context.addIssue({ code: "custom", path: ["order"], message: "Series posts require a positive order." });
    }
    if (!data.series && data.order !== undefined) {
      context.addIssue({ code: "custom", path: ["order"], message: "Order requires a series." });
    }
    if (data.cover && !data.coverAlt) {
      context.addIssue({ code: "custom", path: ["coverAlt"], message: "Cover images require accessible alternative text." });
    }
  }),
});

export const collections = { posts };
