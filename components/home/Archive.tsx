"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { coverOf, projects, site } from "@/lib/content";
import { Flip, gsap, prefersReducedMotion } from "@/lib/motion";
import { useTransitionTo } from "@/components/shell/Transition";
import { Media } from "@/components/Media";
import { useFit } from "@/lib/useFit";
import type { Project } from "@/lib/types";
import styles from "./archive.module.css";

const ALL = "All";

/** Plate shapes used until real images (with their own proportions) are added. */
const RHYTHM = ["wide", "tall", "square", "square", "tall", "wide", "square", "tall", "square"] as const;

/** Newest first; undated work goes last. */
const ordered = [...projects].sort((a, b) => (b.start ?? -1) - (a.start ?? -1));

function matches(p: Project, category: string, era: string) {
  if (category !== ALL && !p.categories.includes(category)) return false;
  if (era === ALL) return true;
  const e = site.eras.find((x) => x.label === era);
  return !!e && p.start !== null && p.start >= e.from && p.start <= e.to;
}

/**
 * Everything, as a catalogue. Filters rearrange the plates in place (GSAP Flip)
 * rather than reloading a grid.
 */
export function Archive() {
  const [category, setCategory] = useState(ALL);
  const [era, setEra] = useState(ALL);
  const grid = useRef<HTMLOListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const go = useTransitionTo();
  useFit(heading, { maxHeight: 0.4 });

  const visible = useMemo(() => new Set(ordered.filter((p) => matches(p, category, era)).map((p) => p.slug)), [category, era]);

  const apply = (nextCategory: string, nextEra: string) => {
    const items = grid.current?.querySelectorAll<HTMLElement>("[data-entry]");
    if (!items || prefersReducedMotion()) {
      setCategory(nextCategory);
      setEra(nextEra);
      return;
    }
    const state = Flip.getState(items);
    setCategory(nextCategory);
    setEra(nextEra);
    // Let React commit the new visibility, then animate from the old layout.
    requestAnimationFrame(() => {
      Flip.from(state, {
        duration: 0.7,
        ease: "power3.inOut",
        absolute: true,
        nested: true,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.6, delay: 0.2 }),
      });
    });
  };

  const count = visible.size;

  return (
    <section id="archive" className={styles.archive} aria-labelledby="archive-h">
      <div className={styles.top}>
        <p className="meta">The archive</p>
        <p className="meta" aria-live="polite">
          {count} of {ordered.length} entries
        </p>
      </div>
      <h2 ref={heading} id="archive-h" className={`display ${styles.heading}`}>
        <span data-fit-line>The archive</span>
      </h2>

      <div className={styles.filters}>
        <div role="group" aria-label="Filter by discipline" className={styles.filterRow}>
          {[ALL, ...site.categories].map((c) => (
            <button key={c} type="button" className={styles.filter} aria-pressed={category === c} onClick={() => apply(c, era)}>
              {c}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filter by years" className={styles.filterRow}>
          {[ALL, ...site.eras.map((e) => e.label)].map((e) => (
            <button key={e} type="button" className={styles.filter} aria-pressed={era === e} onClick={() => apply(category, e)}>
              {e === ALL ? "All years" : e}
            </button>
          ))}
        </div>
      </div>

      <ol ref={grid} className={styles.grid}>
        {ordered.map((p, i) => {
          const cover = coverOf(p);
          const shape = cover?.width && cover?.height ? (cover.width / cover.height > 1.3 ? "wide" : cover.width / cover.height < 0.9 ? "tall" : "square") : RHYTHM[i % RHYTHM.length];
          return (
            <li
              key={p.slug}
              className={styles.entry}
              data-entry
              data-flip-id={p.slug}
              data-shape={shape}
              hidden={!visible.has(p.slug)}
            >
              <Link
                href={`/${p.slug}/`}
                className={styles.card}
                data-cursor="View"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  go(`/${p.slug}`, { from: e.currentTarget.getBoundingClientRect(), label: p.title });
                }}
              >
                <span className={styles.thumb}>
                  {cover ? (
                    <Media item={cover} sizes="(max-width: 760px) 50vw, 25vw" />
                  ) : (
                    <span className={styles.blank} aria-hidden="true">
                      {p.title}
                    </span>
                  )}
                </span>
                <span className={styles.caption}>
                  <span className={styles.catno}>A{String(ordered.length - i).padStart(3, "0")}</span>
                  <span className={styles.name}>{p.title}</span>
                  <span className={styles.sub}>
                    {[p.client !== p.title ? p.client : p.studio, p.period].filter(Boolean).join(", ")}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {count === 0 && (
        <p className={styles.empty}>
          Nothing in this combination yet.{" "}
          <button type="button" className={styles.reset} onClick={() => apply(ALL, ALL)}>
            Show all work
          </button>
        </p>
      )}
    </section>
  );
}
