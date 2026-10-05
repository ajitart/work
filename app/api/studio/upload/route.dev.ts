import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ALLOWED, MAX_BYTES, resolveMedia } from "@/lib/server/studio";

/** Save one uploaded file at the path the editor chose: public/<src> (inside public/media). */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const src = String(form.get("src") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  let abs: string;
  try {
    abs = resolveMedia(src);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const ext = path.extname(abs).toLowerCase();
  if (!ALLOWED.has(ext)) return NextResponse.json({ error: `${ext || "This file type"} is not supported.` }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files over 95 MB can't be published to GitHub." }, { status: 413 });
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ src });
}
