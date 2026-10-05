export type StoryKey =
  | "problem"
  | "context"
  | "users"
  | "complexity"
  | "system"
  | "design"
  | "interaction"
  | "outcome";

/** Where a media file sits inside a project page. */
export type MediaPlacement = "hero" | StoryKey | "gallery";
export type MediaLayout = "full" | "wide" | "half" | "detail";

export interface MediaItem {
  id: string;
  /** Path under /public, e.g. "media/projects/drs/overview.jpg". */
  src: string;
  type: "image" | "video";
  caption?: string;
  placement?: MediaPlacement;
  layout?: MediaLayout;
  /** Videos only. Off = muted looping clip that plays like a GIF; on = player controls. */
  controls?: boolean;
  width?: number;
  height?: number;
}

export interface Project {
  slug: string;
  title: string;
  subtitle: string;
  client: string;
  studio: string;
  period: string;
  /** Year used for sorting and era filters. null when unknown. */
  start: number | null;
  categories: string[];
  /** Shown in Selected work. Every project appears in the Archive. */
  featured: boolean;
  statement: string;
  description: string;
  recognition?: string[];
  /** src of the media item used as the cover, or "". */
  cover: string;
  story: Partial<Record<StoryKey, string>>;
  media: MediaItem[];
}

export interface MakingItem {
  id: string;
  kind: string;
  title: string;
  project: string;
  status: string;
  year: string;
  media: MediaItem[];
}

export interface Chapter {
  id: string;
  motion: "reveal" | "drift" | "settle" | "grid";
  period: string;
  from: number;
  to: number;
  lines: string[];
  disciplines: string[];
  roles: { role: string; org: string; years: string }[];
  note: string;
}

export interface SiteContent {
  intro: { name: string; line: string; years: string; cta: string };
  timeline: { start: number; end: number; phases: { year: number; title: string }[] };
  chapters: Chapter[];
  about: { statement: string; facts: { label: string; value: string }[]; photo: string };
  ending: {
    lines: string[];
    name: string;
    role: string;
    place: string;
    links: { label: string; href: string }[];
    last: string;
  };
  index: { label: string; target: string }[];
  categories: string[];
  eras: { label: string; from: number; to: number }[];
  story: { key: StoryKey; title: string }[];
}
