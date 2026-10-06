import type { MakingItem, Project } from "@/lib/types";

export interface ContentData {
  projects: Project[];
  making: MakingItem[];
}

export interface SaveRequest extends ContentData {
  /** New files, keyed by their final path under /public (e.g. "media/projects/drs/a.jpg"). */
  uploads: { src: string; file: File }[];
  /** Media paths under /public to remove. */
  deletes: string[];
  message: string;
}

export interface SaveResult {
  /** Shown after saving, e.g. "Published. Live in about a minute." */
  note: string;
  /** true once the change is live, false if the deploy failed, null if it can't be told. */
  live?: Promise<boolean | null>;
}

/**
 * Where the editor reads and writes content. The same editor UI runs against
 * the local dev server (Studio) or the GitHub repository (Edit on the live site).
 */
export interface EditorBackend {
  label: string;
  load(): Promise<ContentData>;
  save(req: SaveRequest): Promise<SaveResult>;
  /** URL to preview an already-saved media file. */
  mediaUrl(src: string): string;
}
