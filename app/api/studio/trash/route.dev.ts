import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { MEDIA_DIR, resolveMedia } from "@/lib/server/studio";

/** Removing media never deletes it: the file moves to public/media/_trash (git-ignored). */
export async function POST(req: Request) {
  const { src } = (await req.json()) as { src?: string };
  if (!src) return NextResponse.json({ error: "No file given" }, { status: 400 });
  let abs: string;
  try {
    abs = resolveMedia(src);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const trash = path.join(MEDIA_DIR, "_trash");
  await fs.mkdir(trash, { recursive: true });
  const dest = path.join(trash, `${Date.now()}-${path.basename(abs)}`);
  try {
    await fs.rename(abs, dest);
  } catch {
    return NextResponse.json({ ok: true, note: "File was already gone" });
  }
  return NextResponse.json({ ok: true });
}
