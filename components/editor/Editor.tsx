"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MakingItem, MediaItem, MediaLayout, MediaPlacement, Project, StoryKey } from "@/lib/types";
import siteJson from "@/content/site.json";
import { embedUrl } from "@/lib/embed";
import type { SiteContent } from "@/lib/types";

// Read site.json directly (not lib/content): saving projects.json in the Studio then doesn't reload this page.
const site = siteJson as SiteContent;
import type { EditorBackend } from "./backend";
import styles from "./editor.module.css";

type Tab = "projects" | "making";
type Entry = Project | MakingItem;

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/webm,video/quicktime";
const EXTENSIONS = new Map([
  ["jpg", "image"], ["jpeg", "image"], ["png", "image"], ["gif", "image"], ["webp", "image"], ["avif", "image"],
  ["mp4", "video"], ["webm", "video"], ["mov", "video"],
] as const);
/** GitHub refuses larger files when they're sent from a browser. */
const MAX_BYTES = 30 * 1024 * 1024;
/** Photos are resized to this many pixels on the longest side before upload. */
const MAX_EDGE = 2560;

const LAYOUTS: { value: MediaLayout; label: string }[] = [
  { value: "full", label: "Full column" },
  { value: "wide", label: "Edge to edge" },
  { value: "half", label: "Half" },
  { value: "detail", label: "Cropped detail" },
];

const PLACEMENTS: { value: MediaPlacement; label: string }[] = [
  { value: "hero", label: "Under the cover" },
  ...site.story.map((s) => ({ value: s.key as MediaPlacement, label: s.title })),
  { value: "gallery", label: "Gallery strip" },
];

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

function keyOf(e: Entry) {
  return "slug" in e ? e.slug : e.id;
}

function probe(file: File): Promise<{ width?: number; height?: number }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const done = (width?: number, height?: number) => {
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    if (file.type.startsWith("video")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done(v.videoWidth || undefined, v.videoHeight || undefined);
      v.onerror = () => done();
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => done(img.naturalWidth, img.naturalHeight);
      img.onerror = () => done();
      img.src = url;
    }
  });
}

/**
 * Shrink large JPG/PNG/WebP photos before upload: longest side 2560px, re-encoded
 * (JPEG, or WebP when the image has transparency). GIFs keep their animation and
 * are left alone, as are files already small enough.
 */
async function optimizeImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let transparent = false;
  if (file.type !== "image/jpeg") {
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4 * 64) {
      if (data[i] < 250) {
        transparent = true;
        break;
      }
    }
  }
  const type = transparent ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.86));
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, transparent ? ".webp" : ".jpg");
  return new File([blob], name, { type });
}

/**
 * Add, arrange and remove images and videos, and edit project text.
 * Nothing is written until "Publish"/"Save": then every change goes out together.
 */
export function Editor({
  backend,
  initial,
  onClose,
  publishLabel = "Publish",
}: {
  backend: EditorBackend;
  initial?: { tab: Tab; key?: string };
  onClose?: () => void;
  publishLabel?: string;
}) {
  const [tab, setTab] = useState<Tab>(initial?.tab ?? "projects");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [making, setMaking] = useState<MakingItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState("");
  // Files waiting to be published, keyed by their final src, plus their local preview URLs.
  const pending = useRef(new Map<string, { file: File; url: string }>());
  const deletes = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    backend
      .load()
      .then((d) => {
        setProjects(d.projects);
        setMaking(d.making);
        if (initial?.key) {
          const list = (initial.tab === "making" ? d.making : d.projects) as Entry[];
          const i = list.findIndex((e) => keyOf(e) === initial.key);
          if (i >= 0) setSelected(i);
        }
      })
      .catch((e: Error) => setError(e.message));
    const urls = pending.current;
    return () => urls.forEach((p) => URL.revokeObjectURL(p.url));
  }, [backend, initial?.key, initial?.tab]);

  const list: Entry[] = tab === "projects" ? (projects ?? []) : making;
  const entry = list[selected] as Entry | undefined;
  const project = tab === "projects" ? (entry as Project | undefined) : undefined;
  const item = tab === "making" ? (entry as MakingItem | undefined) : undefined;

  const patch = useCallback(
    (fn: (e: Entry) => Entry) => {
      if (tab === "projects") setProjects((ps) => ps && ps.map((p, i) => (i === selected ? (fn(p) as Project) : p)));
      else setMaking((ms) => ms.map((m, i) => (i === selected ? (fn(m) as MakingItem) : m)));
      setDirty(true);
      setStatus("");
    },
    [selected, tab],
  );

  const setField = (key: string, value: unknown) => patch((e) => ({ ...e, [key]: value }));
  const setMedia = (fn: (m: MediaItem[]) => MediaItem[]) => patch((e) => ({ ...e, media: fn(e.media) }));
  const updateMedia = (id: string, fields: Partial<MediaItem>) => setMedia((ms) => ms.map((x) => (x.id === id ? { ...x, ...fields } : x)));

  const preview = (src: string) => pending.current.get(src)?.url ?? backend.mediaUrl(src);

  /** Pick a file name that no other media item uses. */
  const uniqueSrc = (folder: string, name: string) => {
    const dot = name.lastIndexOf(".");
    const ext = name.slice(dot + 1).toLowerCase();
    const base = slugify(name.slice(0, dot)) || "file";
    const taken = new Set([...(projects ?? []), ...making].flatMap((e) => e.media.map((m) => m.src)));
    let src = `${folder}/${base}.${ext}`;
    for (let n = 2; taken.has(src) || pending.current.has(src); n++) src = `${folder}/${base}-${n}.${ext}`;
    return src;
  };

  const addFiles = async (files: FileList | File[]) => {
    if (!entry) return;
    setError("");
    const folder = `media/${tab}/${keyOf(entry)}`;
    const added: MediaItem[] = [];
    const problems: string[] = [];
    setStatus(files.length > 1 ? "Preparing files…" : "Preparing file…");
    for (const original of Array.from(files)) {
      const ext = original.name.split(".").pop()?.toLowerCase() ?? "";
      const type = EXTENSIONS.get(ext as never);
      if (!type) {
        problems.push(`${original.name}: use JPG, PNG, GIF, WebP, AVIF, MP4, WebM or MOV`);
        continue;
      }
      const file = type === "image" ? await optimizeImage(original) : original;
      if (file.size > MAX_BYTES) {
        const mb = Math.round(file.size / 1048576);
        problems.push(
          type === "video"
            ? `${original.name} is ${mb} MB; the limit is 30 MB. Compress it (HandBrake, "Fast 1080p30") or add it as a YouTube/Vimeo link below`
            : `${original.name} is ${mb} MB; the limit is 30 MB`,
        );
        continue;
      }
      const src = uniqueSrc(folder, file.name);
      pending.current.set(src, { file, url: URL.createObjectURL(file) });
      added.push({ id: shortId(), src, type, caption: "", placement: "gallery", layout: "full", ...(await probe(file)) });
    }
    setStatus("");
    if (problems.length) setError(problems.join(". ") + ".");
    if (!added.length) return;
    patch((e) => {
      const next = { ...e, media: [...e.media, ...added] };
      if ("cover" in next && !next.cover) next.cover = added[0].src;
      return next;
    });
  };

  const addLink = () => {
    if (!entry) return;
    const url = link.trim();
    if (!embedUrl(url)) {
      setError("That isn't a YouTube or Vimeo video link. Copy the link from the video's page or its Share button.");
      return;
    }
    setError("");
    setLink("");
    setMedia((ms) => [...ms, { id: shortId(), src: url, type: "embed", caption: "", placement: "gallery", layout: "full", width: 16, height: 9 }]);
  };

  const removeMedia = (m: MediaItem) => {
    const label = m.type === "embed" ? "this video link" : m.src.split("/").pop();
    if (!confirm(`Remove ${label}? It's deleted from the site when you ${publishLabel.toLowerCase()}.`)) return;
    const p = pending.current.get(m.src);
    if (p) {
      URL.revokeObjectURL(p.url);
      pending.current.delete(m.src);
    } else if (m.type !== "embed") {
      deletes.current.add(m.src);
    }
    patch((e) => {
      const next = { ...e, media: e.media.filter((x) => x.id !== m.id) };
      if ("cover" in next && next.cover === m.src) next.cover = next.media[0]?.src ?? "";
      return next;
    });
  };

  const move = (i: number, d: -1 | 1) =>
    setMedia((ms) => {
      const j = i + d;
      if (j < 0 || j >= ms.length) return ms;
      const copy = [...ms];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const publish = useCallback(async () => {
    if (!projects || busy) return;
    setBusy(true);
    setError("");
    setStatus(publishLabel === "Publish" ? "Publishing…" : "Saving…");
    const uploads = [...pending.current.entries()].map(([src, p]) => ({ src, file: p.file }));
    const changed = [...new Set(uploads.map((u) => u.src.split("/")[2]))].filter(Boolean);
    try {
      const result = await backend.save({
        projects,
        making,
        uploads,
        deletes: [...deletes.current],
        message: changed.length ? `Update media for ${changed.join(", ")}` : "Update portfolio content",
      });
      pending.current.clear();
      deletes.current.clear();
      setDirty(false);
      setStatus(result.note);
      result.live?.then((ok) => {
        if (ok === true) setStatus("Live on ajitart.github.io/work. Reload a page to see it.");
        else if (ok === false) setError("Saved to GitHub, but the site build failed, so this change isn't live yet. Ask Claude to look at the latest deploy.");
        else setStatus(result.note);
      });
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, [backend, busy, making, projects, publishLabel]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) publish();
      }
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("beforeunload", leave);
    };
  }, [publish, dirty]);

  const close = () => {
    if (dirty && !confirm(`You have changes that aren't ${publishLabel === "Publish" ? "published" : "saved"}. Close anyway?`)) return;
    onClose?.();
  };

  const addEntry = () => {
    if (tab === "projects") {
      const title = prompt("Project name");
      if (!title || !projects) return;
      let slug = slugify(title) || shortId();
      while (projects.some((p) => p.slug === slug)) slug = `${slug}-2`;
      setProjects([
        ...projects,
        { slug, title, subtitle: "", client: "", studio: "", period: "", start: null, categories: [], featured: false, statement: "", description: "", cover: "", story: {}, media: [] },
      ]);
      setSelected(projects.length);
    } else {
      const kind = prompt("What kind of process work is this? (for example: Sketch, Wireframe, Moodboard)");
      if (!kind) return;
      let id = slugify(kind) || shortId();
      while (making.some((m) => m.id === id)) id = `${id}-2`;
      setMaking([...making, { id, kind, title: "", project: "", status: "", year: "", media: [] }]);
      setSelected(making.length);
    }
    setDirty(true);
  };

  const deleteEntry = () => {
    if (!entry) return;
    const name = ("title" in entry && entry.title) || keyOf(entry);
    if (!confirm(`Delete “${name}” and its ${entry.media.length} file(s) from the site?`)) return;
    entry.media.forEach((m) => {
      if (pending.current.has(m.src)) pending.current.delete(m.src);
      else if (m.type !== "embed") deletes.current.add(m.src);
    });
    if (tab === "projects") setProjects((ps) => ps && ps.filter((_, i) => i !== selected));
    else setMaking((ms) => ms.filter((_, i) => i !== selected));
    setSelected(0);
    setDirty(true);
  };

  const pageUrl = useMemo(() => (project ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/${project.slug}/` : ""), [project]);

  if (!projects) {
    return (
      <div className={styles.fatal}>
        {error || "Loading…"}
        {onClose && (
          <button className={styles.link} onClick={onClose}>
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.studio}>
      <aside className={styles.side}>
        <div className={styles.brand}>
          <strong>Edit</strong>
          <span>{backend.label}</span>
        </div>
        <div className={styles.tabs} role="tablist">
          {(["projects", "making"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={styles.tab}
              onClick={() => {
                setTab(t);
                setSelected(0);
              }}
            >
              {t === "projects" ? `Projects (${projects.length})` : `The making (${making.length})`}
            </button>
          ))}
        </div>
        <ol className={styles.list}>
          {list.map((e, i) => (
            <li key={keyOf(e)}>
              <button className={styles.listItem} aria-current={i === selected} onClick={() => setSelected(i)}>
                <span>{"slug" in e ? e.title : e.title || e.kind}</span>
                <span className={styles.count}>
                  {"featured" in e && e.featured ? "Selected · " : ""}
                  {e.media.length} {e.media.length === 1 ? "file" : "files"}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <button className={styles.add} onClick={addEntry}>
          {tab === "projects" ? "Add project" : "Add process item"}
        </button>
      </aside>

      <main className={styles.main}>
        <div className={styles.bar}>
          <div>
            <h1 className={styles.h1}>{project?.title || item?.kind || "Nothing selected"}</h1>
            {project && (
              <a className={styles.view} href={pageUrl} target="_blank" rel="noreferrer">
                Open page in a new tab
              </a>
            )}
          </div>
          <div className={styles.actions}>
            <span className={styles.status} aria-live="polite">
              {error ? <span className={styles.err}>{error}</span> : dirty ? `Changes not ${publishLabel === "Publish" ? "published" : "saved"} yet` : status}
            </span>
            <button className={styles.primary} onClick={publish} disabled={!dirty || busy}>
              {busy ? "Working…" : publishLabel}
            </button>
            {onClose && (
              <button className={styles.close} onClick={close} aria-label="Close editor">
                Close
              </button>
            )}
          </div>
        </div>

        {entry && (
          <>
            <section className={styles.panel}>
              <h2 className={styles.h2}>Images and videos</h2>
              <div
                className={styles.drop}
                data-over={dragging || undefined}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
                }}
              >
                <p>
                  Drop JPG, PNG, GIF, WebP or video files (MP4, WebM, MOV) here, or{" "}
                  <button className={styles.link} onClick={() => fileInput.current?.click()}>
                    choose files
                  </button>
                  .
                </p>
                <p className={styles.hint}>
                  Up to 30 MB each; large photos are resized to 2560px automatically. Videos without controls play muted on a loop, like a GIF.
                  Nothing goes live until you press {publishLabel}.
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.length) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              <div className={styles.linkRow}>
                <label className={styles.field}>
                  <span>Or add a YouTube or Vimeo video (no size limit)</span>
                  <input
                    value={link}
                    placeholder="https://www.youtube.com/watch?v=…"
                    onChange={(e) => setLink(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLink()}
                  />
                </label>
                <button className={styles.close} onClick={addLink} disabled={!link.trim()}>
                  Add video link
                </button>
              </div>

              <ol className={styles.media}>
                {entry.media.map((m, i) => (
                  <li key={m.id} className={styles.card}>
                    <div className={styles.preview}>
                      {m.type === "embed" ? (
                        <iframe src={embedUrl(m.src) ?? undefined} title={m.caption || "Video"} loading="lazy" allowFullScreen />
                      ) : m.type === "video" ? (
                        <video src={preview(m.src)} muted loop playsInline autoPlay preload="metadata" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview(m.src)} alt="" />
                      )}
                      {project && project.cover === m.src && <span className={styles.badge}>Cover</span>}
                      {pending.current.has(m.src) && <span className={`${styles.badge} ${styles.badgeNew}`}>New</span>}
                    </div>
                    <div className={styles.cardBody}>
                      <p className={styles.file}>
                        {m.type === "embed" ? m.src : m.src.split("/").pop()}
                        {m.width && m.type !== "embed" ? ` · ${m.width}×${m.height}` : ""}
                      </p>
                      <label className={styles.field}>
                        <span>Caption</span>
                        <input value={m.caption ?? ""} placeholder="Optional. Also used as the alt text." onChange={(e) => updateMedia(m.id, { caption: e.target.value })} />
                      </label>
                      {project && (
                        <div className={styles.row}>
                          <label className={styles.field}>
                            <span>Place in page</span>
                            <select value={m.placement ?? "gallery"} onChange={(e) => updateMedia(m.id, { placement: e.target.value as MediaPlacement })}>
                              {PLACEMENTS.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span>Size</span>
                            <select value={m.layout ?? "full"} onChange={(e) => updateMedia(m.id, { layout: e.target.value as MediaLayout })}>
                              {LAYOUTS.map((l) => (
                                <option key={l.value} value={l.value}>
                                  {l.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}
                      {m.type === "video" && (
                        <label className={styles.check}>
                          <input type="checkbox" checked={!!m.controls} onChange={(e) => updateMedia(m.id, { controls: e.target.checked })} />
                          Show player controls and sound
                        </label>
                      )}
                      <div className={styles.cardActions}>
                        {project && project.cover !== m.src && m.type !== "embed" && (
                          <button className={styles.link} onClick={() => setField("cover", m.src)}>
                            Use as cover
                          </button>
                        )}
                        <button className={styles.link} onClick={() => move(i, -1)} disabled={i === 0}>
                          Move up
                        </button>
                        <button className={styles.link} onClick={() => move(i, 1)} disabled={i === entry.media.length - 1}>
                          Move down
                        </button>
                        <button className={`${styles.link} ${styles.danger}`} onClick={() => removeMedia(m)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              {entry.media.length === 0 && <p className={styles.hint}>No files yet. The page shows an empty frame until you add one.</p>}
            </section>

            {project && (
              <section className={styles.panel}>
                <h2 className={styles.h2}>Details</h2>
                <div className={styles.grid}>
                  <Text label="Title" value={project.title} onChange={(v) => setField("title", v)} />
                  <Text label="Subtitle" value={project.subtitle} onChange={(v) => setField("subtitle", v)} />
                  <Text label="Client" value={project.client} onChange={(v) => setField("client", v)} />
                  <Text label="Studio / agency" value={project.studio} onChange={(v) => setField("studio", v)} />
                  <Text label="Years shown" value={project.period} placeholder="2025 — Present" onChange={(v) => setField("period", v)} />
                  <Text
                    label="Start year (for sorting and filters)"
                    value={project.start === null ? "" : String(project.start)}
                    placeholder="2025"
                    onChange={(v) => setField("start", v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v))}
                  />
                </div>
                <fieldset className={styles.chips}>
                  <legend>Disciplines</legend>
                  {site.categories.map((c) => (
                    <label key={c} className={styles.chip}>
                      <input
                        type="checkbox"
                        checked={project.categories.includes(c)}
                        onChange={(e) => setField("categories", e.target.checked ? [...project.categories, c] : project.categories.filter((x) => x !== c))}
                      />
                      {c}
                    </label>
                  ))}
                </fieldset>
                <label className={styles.check}>
                  <input type="checkbox" checked={project.featured} onChange={(e) => setField("featured", e.target.checked)} />
                  Show in Selected work (every project is in the Archive)
                </label>
                <Area label="Statement (one line under the title)" value={project.statement} onChange={(v) => setField("statement", v)} />
                <Area label="Overview" value={project.description} onChange={(v) => setField("description", v)} />
                <Area
                  label="Recognition (one per line)"
                  value={(project.recognition ?? []).join("\n")}
                  onChange={(v) => setField("recognition", v.split("\n").map((s) => s.trim()).filter(Boolean))}
                />
              </section>
            )}

            {project && (
              <section className={styles.panel}>
                <h2 className={styles.h2}>Case study</h2>
                <p className={styles.hint}>Leave a beat empty to show its placeholder. Media placed in a beat appears under its text.</p>
                {site.story.map((s) => (
                  <Area
                    key={s.key}
                    label={s.title}
                    value={project.story[s.key as StoryKey] ?? ""}
                    onChange={(v) => setField("story", { ...project.story, [s.key]: v })}
                  />
                ))}
              </section>
            )}

            {item && (
              <section className={styles.panel}>
                <h2 className={styles.h2}>Details</h2>
                <div className={styles.grid}>
                  <Text label="Kind" value={item.kind} onChange={(v) => setField("kind", v)} />
                  <Text label="Title" value={item.title} onChange={(v) => setField("title", v)} />
                  <label className={styles.field}>
                    <span>Project</span>
                    <select value={item.project} onChange={(e) => setField("project", e.target.value)}>
                      <option value="">None</option>
                      {projects.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Text label="Stamp (for example Rejected, Unfinished)" value={item.status} onChange={(v) => setField("status", v)} />
                  <Text label="Year" value={item.year} onChange={(v) => setField("year", v)} />
                </div>
              </section>
            )}

            <div className={styles.footer}>
              <button className={`${styles.link} ${styles.danger}`} onClick={deleteEntry}>
                Delete this {tab === "projects" ? "project" : "item"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea value={value} rows={3} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
