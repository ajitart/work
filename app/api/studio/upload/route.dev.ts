import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ALLOWED, MAX_BYTES, MEDIA_DIR, safeFilename, safeSegment } from "@/lib/server/studio";

/** Save one uploaded file to public/media/<collection>/<slug>/<name>. */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const collection = safeSegment(String(form.get("collection") ?? ""));
  const slug = safeSegment(String(form.get("slug") ?? ""));
  if (!(file instanceof File)) return NextResponse.json({ error: "No file was sent" }, { status: 400 });
  if (!["projects", "making"].includes(collection) || !slug) {
    return NextResponse.json({ error: "Choose a project before uploading" }, { status: 400 });
  }
  const { base, ext } = safeFilename(file.name);
  const type = ALLOWED.get(ext);
  if (!type) {
    return NextResponse.json({ error: `${ext || "This file type"} is not supported. Use JPG, PNG, GIF, WebP, AVIF, MP4, WebM or MOV.` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Files over 95 MB can't be published to GitHub. Compress the video and try again." }, { status: 413 });
  }

  const dir = path.join(MEDIA_DIR, collection, slug);
  await fs.mkdir(dir, { recursive: true });
  let name = `${base}${ext}`;
  for (let n = 2; ; n++) {
    try {
      await fs.access(path.join(dir, name));
      name = `${base}-${n}${ext}`;
    } catch {
      break;
    }
  }
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ src: `media/${collection}/${slug}/${name}`, type, bytes: file.size });
}
