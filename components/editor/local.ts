import type { ContentData, EditorBackend, SaveRequest } from "./backend";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const api = (p: string) => `${base}/api/studio/${p}`;

/** The Studio on your own computer: talks to the dev server's /api/studio routes. */
export const localBackend: EditorBackend = {
  label: "this computer",

  async load(): Promise<ContentData> {
    const [projects, making] = await Promise.all(
      ["projects", "making"].map((c) =>
        fetch(api(`content?collection=${c}`)).then((r) => {
          if (!r.ok) throw new Error("Couldn't load content. Is `npm run dev` running?");
          return r.json();
        }),
      ),
    );
    return { projects, making };
  },

  async save(req: SaveRequest) {
    for (const u of req.uploads) {
      const form = new FormData();
      form.append("file", u.file);
      form.append("src", u.src);
      const res = await fetch(api("upload"), { method: "POST", body: form });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Upload failed (${res.status})`);
    }
    for (const [collection, data] of [["projects", req.projects], ["making", req.making]] as const) {
      const res = await fetch(api(`content?collection=${collection}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save");
    }
    for (const src of req.deletes) {
      await fetch(api("trash"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ src }) });
    }
    return { note: "Saved on this computer. Commit and push to publish." };
  },

  mediaUrl: (src) => `${base}/${src}`,
};
