// Server-side helpers for the local Studio. Imported only by *.dev.ts routes,
// so none of this exists in the published static site.
import { promises as fs } from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();
export const CONTENT_DIR = path.join(ROOT, "content");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const MEDIA_DIR = path.join(PUBLIC_DIR, "media");

export const COLLECTIONS = ["projects", "making", "site"] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const ALLOWED = new Map<string, "image" | "video">([
  [".jpg", "image"],
  [".jpeg", "image"],
  [".png", "image"],
  [".gif", "image"],
  [".webp", "image"],
  [".avif", "image"],
  [".mp4", "video"],
  [".webm", "video"],
  [".mov", "video"],
]);

/** GitHub refuses files over 100 MB. */
export const MAX_BYTES = 95 * 1024 * 1024;

export function isCollection(v: string | null): v is Collection {
  return !!v && (COLLECTIONS as readonly string[]).includes(v);
}

export function safeSegment(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function safeFilename(name: string) {
  const ext = path.extname(name).toLowerCase();
  const base = safeSegment(path.basename(name, ext)) || "file";
  return { base, ext };
}

/** Write JSON atomically, keeping the previous version in content/.backup. */
export async function writeJson(collection: Collection, data: unknown) {
  const file = path.join(CONTENT_DIR, `${collection}.json`);
  const backupDir = path.join(CONTENT_DIR, ".backup");
  await fs.mkdir(backupDir, { recursive: true });
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.copyFile(file, path.join(backupDir, `${collection}-${stamp}.json`));
  } catch {
    /* first write */
  }
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  await fs.rename(tmp, file);
}

export async function readJson(collection: Collection) {
  return JSON.parse(await fs.readFile(path.join(CONTENT_DIR, `${collection}.json`), "utf8"));
}

/** Resolve a public media path and make sure it stays inside public/media. */
export function resolveMedia(src: string) {
  const abs = path.resolve(PUBLIC_DIR, src.replace(/^\//, ""));
  if (!abs.startsWith(MEDIA_DIR + path.sep)) throw new Error("Path is outside public/media");
  return abs;
}
