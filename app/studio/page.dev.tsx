"use client";

// The Studio: a local editor for projects and their media. It only exists
// while running `npm run dev` (see pageExtensions in next.config.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MakingItem, MediaItem, MediaLayout, MediaPlacement, Project, SiteContent, StoryKey } from "@/lib/types";
import styles from "./studio.module.css";

type Tab = "projects" | "making";
type Entry = Project | MakingItem;

interface Upload {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/webm,video/quicktime";
const LAYOUTS: { value: MediaLayout; label: string }[] = [
  { value: "full", label: "Full column" },
  { value: "wide", label: "Edge to edge" },
  { value: "half", label: "Half" },
  { value: "detail", label: "Cropped detail" },
];

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const api = (p: string) => `${base}/api/studio/${p}`;
const pub = (src: string) => `${base}/${src}`;

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function shortId() {
  return Math.random().toString(36).slice(2, 10);
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

function send(file: File, collection: Tab, slug: string, onProgress: (p: number) => void) {
  return new Promise<{ src: string; type: "image" | "video" }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    form.append("collection", collection);
    form.append("slug", slug);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body: { src?: string; type?: "image" | "video"; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.src) resolve({ src: body.src, type: body.type! });
      else reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("The Studio server didn't answer. Is `npm run dev` still running?"));
    xhr.open("POST", api("upload"));
    xhr.send(form);
  });
}

export default function Studio() {
  const [tab, setTab] = useState<Tab>("projects");
  const [site, setSite] = useState<SiteContent | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [making, setMaking] = useState<MakingItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Always-current copies for async upload handlers.
  const latest = useRef({ projects, making });
  latest.current = { projects, making };

  useEffect(() => {
    Promise.all(["site", "projects", "making"].map((c) => fetch(api(`content?collection=${c}`)).then((r) => r.json())))
      .then(([s, p, m]) => {
        setSite(s);
        setProjects(p);
        setMaking(m);
      })
      .catch(() => setError("Couldn't load content. Start the Studio with `npm run dev`."));
  }, []);

  const list: Entry[] = tab === "projects" ? projects : making;
  const entry = list[selected] as Entry | undefined;
  const entryKey = entry ? ("slug" in entry ? entry.slug : entry.id) : "";

  const save = useCallback(
    async (which: Tab = tab, data?: Entry[]) => {
      const body = data ?? (which === "projects" ? latest.current.projects : latest.current.making);
      setStatus("Saving…");
      setError("");
      const res = await fetch(api(`content?collection=${which}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Couldn't save. Your changes are still here; try again.");
        setStatus("");
        return false;
      }
      setDirty(false);
      setStatus(`Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      return true;
    },
    [tab],
  );

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
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
  }, [save, dirty]);

  /** Apply a change to the selected entry. */
  const patch = useCallback(
    (fn: (e: Entry) => Entry) => {
      const index = selected;
      if (tab === "projects") setProjects((ps) => ps.map((p, i) => (i === index ? (fn(p) as Project) : p)));
      else setMaking((ms) => ms.map((m, i) => (i === index ? (fn(m) as MakingItem) : m)));
      setDirty(true);
    },
    [selected, tab],
  );

  const setField = <K extends string>(key: K, value: unknown) => patch((e) => ({ ...e, [key]: value }));

  const setMedia = (fn: (m: MediaItem[]) => MediaItem[]) => patch((e) => ({ ...e, media: fn(e.media) }));

  const upload = async (files: FileList | File[]) => {
    if (!entry) return;
    const arr = Array.from(files);
    const collection = tab;
    const slug = entryKey;
    const index = selected;
    for (const file of arr) {
      const id = shortId();
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      try {
        const [dims, res] = await Promise.all([
          probe(file),
          send(file, collection, slug, (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x)))),
        ]);
        const item: MediaItem = {
          id,
          src: res.src,
          type: res.type,
          caption: "",
          placement: "gallery",
          layout: "full",
          ...dims,
        };
        // Add to the entry it was dropped on, then save straight away so the file is never orphaned.
        if (collection === "projects") {
          const next = latest.current.projects.map((p, i) =>
            i === index ? { ...p, media: [...p.media, item], cover: p.cover || item.src } : p,
          );
          setProjects(next);
          latest.current.projects = next;
          await save("projects", next);
        } else {
          const next = latest.current.making.map((m, i) => (i === index ? { ...m, media: [...m.media, item] } : m));
          setMaking(next);
          latest.current.making = next;
          await save("making", next);
        }
        setUploads((u) => u.filter((x) => x.id !== id));
      } catch (e) {
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: (e as Error).message } : x)));
      }
    }
  };

  const removeMedia = async (m: MediaItem) => {
    if (!confirm(`Remove ${m.src.split("/").pop()} from this ${tab === "projects" ? "project" : "item"}? The file moves to public/media/_trash.`)) return;
    patch((e) => {
      const next = { ...e, media: e.media.filter((x) => x.id !== m.id) };
      if ("cover" in next && next.cover === m.src) next.cover = next.media[0]?.src ?? "";
      return next;
    });
    await fetch(api("trash"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ src: m.src }) });
    setTimeout(() => save(), 0);
  };

  const move = (i: number, d: -1 | 1) =>
    setMedia((ms) => {
      const j = i + d;
      if (j < 0 || j >= ms.length) return ms;
      const copy = [...ms];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const addEntry = () => {
    if (tab === "projects") {
      const title = prompt("Project name");
      if (!title) return;
      let slug = slugify(title) || shortId();
      while (projects.some((p) => p.slug === slug)) slug = `${slug}-2`;
      const p: Project = {
        slug, title, subtitle: "", client: "", studio: "", period: "", start: null, categories: [],
        featured: false, statement: "", description: "", cover: "", story: {}, media: [],
      };
      setProjects((ps) => [...ps, p]);
      setSelected(projects.length);
    } else {
      const kind = prompt("What kind of process work is this? (for example: Sketch, Wireframe, Moodboard)");
      if (!kind) return;
      let id = slugify(kind) || shortId();
      while (making.some((m) => m.id === id)) id = `${id}-2`;
      setMaking((ms) => [...ms, { id, kind, title: "", project: "", status: "", year: "", media: [] }]);
      setSelected(making.length);
    }
    setDirty(true);
  };

  const deleteEntry = () => {
    if (!entry) return;
    const name = "title" in entry && entry.title ? entry.title : entryKey;
    if (!confirm(`Delete “${name}” from the site? Its media files stay in public/media.`)) return;
    if (tab === "projects") setProjects((ps) => ps.filter((_, i) => i !== selected));
    else setMaking((ms) => ms.filter((_, i) => i !== selected));
    setSelected(0);
    setDirty(true);
  };

  const placements = useMemo(() => {
    const story = site?.story ?? [];
    return [
      { value: "hero", label: "Under the cover" },
      ...story.map((s) => ({ value: s.key, label: s.title })),
      { value: "gallery", label: "Gallery strip" },
    ] as { value: MediaPlacement; label: string }[];
  }, [site]);

  if (error && !site) return <div className={styles.fatal}>{error}</div>;
  if (!site) return <div className={styles.fatal}>Loading the Studio…</div>;

  const project = tab === "projects" ? (entry as Project | undefined) : undefined;
  const item = tab === "making" ? (entry as MakingItem | undefined) : undefined;

  return (
    <div className={styles.studio}>
      <aside className={styles.side}>
        <div className={styles.brand}>
          <strong>Studio</strong>
          <span>Ajit / Work</span>
        </div>
        <div className={styles.tabs} role="tablist">
          {(["projects", "making"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={styles.tab}
              onClick={() => {
                if (dirty && !confirm("You have unsaved changes. Switch anyway?")) return;
                setTab(t);
                setSelected(0);
                setDirty(false);
              }}
            >
              {t === "projects" ? `Projects (${projects.length})` : `The making (${making.length})`}
            </button>
          ))}
        </div>
        <ol className={styles.list}>
          {list.map((e, i) => {
            const label = "slug" in e ? e.title : e.title || e.kind;
            const count = e.media.length;
            return (
              <li key={"slug" in e ? e.slug : e.id}>
                <button className={styles.listItem} aria-current={i === selected} onClick={() => setSelected(i)}>
                  <span>{label}</span>
                  <span className={styles.count}>
                    {"featured" in e && e.featured ? "Selected · " : ""}
                    {count} {count === 1 ? "file" : "files"}
                  </span>
                </button>
              </li>
            );
          })}
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
              <a className={styles.view} href={`${base}/${project.slug}/`} target="_blank" rel="noreferrer">
                Open page in a new tab
              </a>
            )}
          </div>
          <div className={styles.actions}>
            <span className={styles.status} aria-live="polite">
              {error ? <span className={styles.err}>{error}</span> : dirty ? "Unsaved changes" : status}
            </span>
            <button className={styles.primary} onClick={() => save()} disabled={!dirty}>
              Save changes
            </button>
          </div>
        </div>

        {entry && (
          <>
            {/* ---------- media ---------- */}
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
                  if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
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
                  Saved to <code>public/media/{tab}/{entryKey}/</code>. Videos without controls play muted on a loop, like a GIF. Keep each file under 95 MB.
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.length) upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {uploads.length > 0 && (
                <ul className={styles.uploads}>
                  {uploads.map((u) => (
                    <li key={u.id} data-error={u.error ? "" : undefined}>
                      <span>{u.name}</span>
                      {u.error ? (
                        <>
                          <span className={styles.err}>{u.error}</span>
                          <button className={styles.link} onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))}>
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <progress value={u.progress} max={1} />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <ol className={styles.media}>
                {entry.media.map((m, i) => (
                  <li key={m.id} className={styles.card}>
                    <div className={styles.preview}>
                      {m.type === "video" ? (
                        <video src={pub(m.src)} muted loop playsInline autoPlay preload="metadata" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pub(m.src)} alt="" />
                      )}
                      {project && project.cover === m.src && <span className={styles.badge}>Cover</span>}
                    </div>
                    <div className={styles.cardBody}>
                      <p className={styles.file}>
                        {m.src.split("/").pop()}
                        {m.width ? ` · ${m.width}×${m.height}` : ""}
                      </p>
                      <label className={styles.field}>
                        <span>Caption</span>
                        <input
                          value={m.caption ?? ""}
                          placeholder="Optional. Also used as the alt text."
                          onChange={(e) => setMedia((ms) => ms.map((x) => (x.id === m.id ? { ...x, caption: e.target.value } : x)))}
                        />
                      </label>
                      {project && (
                        <div className={styles.row}>
                          <label className={styles.field}>
                            <span>Place in page</span>
                            <select
                              value={m.placement ?? "gallery"}
                              onChange={(e) => setMedia((ms) => ms.map((x) => (x.id === m.id ? { ...x, placement: e.target.value as MediaPlacement } : x)))}
                            >
                              {placements.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span>Size</span>
                            <select
                              value={m.layout ?? "full"}
                              onChange={(e) => setMedia((ms) => ms.map((x) => (x.id === m.id ? { ...x, layout: e.target.value as MediaLayout } : x)))}
                            >
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
                          <input
                            type="checkbox"
                            checked={!!m.controls}
                            onChange={(e) => setMedia((ms) => ms.map((x) => (x.id === m.id ? { ...x, controls: e.target.checked } : x)))}
                          />
                          Show player controls and sound
                        </label>
                      )}
                      <div className={styles.cardActions}>
                        {project && project.cover !== m.src && (
                          <button className={styles.link} onClick={() => setField("cover", m.src)}>
                            Use as cover
                          </button>
                        )}
                        <button className={styles.link} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier">
                          Move up
                        </button>
                        <button className={styles.link} onClick={() => move(i, 1)} disabled={i === entry.media.length - 1} aria-label="Move later">
                          Move down
                        </button>
                        <button className={`${styles.link} ${styles.danger}`} onClick={() => removeMedia(m)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              {entry.media.length === 0 && <p className={styles.hint}>No files yet. The site shows an empty frame until you add one.</p>}
            </section>

            {/* ---------- details ---------- */}
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
                        onChange={(e) =>
                          setField("categories", e.target.checked ? [...project.categories, c] : project.categories.filter((x) => x !== c))
                        }
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
