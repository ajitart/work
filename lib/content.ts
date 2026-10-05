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

/**
 * Where each timeline role sits along the line (0..1). Roles are evenly spaced,
 * so close years (2019, 2021, 2023) still get room for their labels.
 */
export const timelineNodes = site.timeline.phases.map((_, i, all) => (all.length > 1 ? i / (all.length - 1) : 0));

/** The year at a point along the line, interpolated between the roles either side. */
export function timelineYearAt(f: number): number {
  const phases = site.timeline.phases;
  const nodes = timelineNodes;
  if (f <= 0) return phases[0].year;
  for (let i = 1; i < nodes.length; i++) {
    if (f <= nodes[i]) {
      const t = (f - nodes[i - 1]) / (nodes[i] - nodes[i - 1]);
      return phases[i - 1].year + t * (phases[i].year - phases[i - 1].year);
    }
  }
  return phases[phases.length - 1].year;
}
