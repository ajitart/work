import siteJson from "@/content/site.json";
import projectsJson from "@/content/projects.json";
import makingJson from "@/content/making.json";
import type { MakingItem, MediaItem, Project, SiteContent } from "./types";

// All content lives in /content as JSON so it can be edited by hand or through
// the local Studio (/studio, dev only) without touching components.
export const site = siteJson as SiteContent;
export const projects = projectsJson as Project[];
export const making = makingJson as MakingItem[];

export const featuredProjects = projects.filter((p) => p.featured);

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function coverOf(p: Project): MediaItem | undefined {
  if (p.cover) return p.media.find((m) => m.src === p.cover);
  return p.media.find((m) => m.placement === "hero") ?? p.media[0];
}

/** Prefix a /public path with the GitHub Pages base path. */
export function asset(src: string): string {
  if (/^(https?:|data:|blob:)/.test(src)) return src;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/${src.replace(/^\//, "")}`;
}
