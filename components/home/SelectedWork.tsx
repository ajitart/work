"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { coverOf, featuredProjects } from "@/lib/content";
import { gsap, isFinePointer, prefersReducedMotion } from "@/lib/motion";
import { useTransitionTo } from "@/components/shell/Transition";
import { Media, MediaSlot } from "@/components/Media";
import { useFit } from "@/lib/useFit";
import styles from "./work.module.css";

/**
 * Selected work as a typographic index. On desktop a preview plate trails the
 * pointer and swaps to the project under it; on touch the covers sit inline.
 */
export function SelectedWork() {
  const heading = useRef<HTMLHeadingElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const go = useTransitionTo();
  useFit(heading, { maxHeight: 0.4 });

  useEffect(() => {
    const el = preview.current;
    if (!el || !isFinePointer()) return;
    const reduced = prefersReducedMotion();
    const x = gsap.quickTo(el, "x", { duration: reduced ? 0 : 0.7, ease: "power3" });
    const y = gsap.quickTo(el, "y", { duration: reduced ? 0 : 0.7, ease: "power3" });
    const move = (e: PointerEvent) => {
      x(e.clientX);
      y(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return (
    <section id="work" className={styles.work} aria-labelledby="work-h">
      <div className={styles.top}>
        <p className="meta">Selected work</p>
        <p className="meta">{String(featuredProjects.length).padStart(2, "0")} projects</p>
      </div>
      <h2 ref={heading} id="work-h" className={`display ${styles.heading}`}>
        <span data-fit-line>Selected</span>
        <br />
        <span data-fit-line>work</span>
      </h2>

      <ol className={styles.list} data-active={active !== null ? "" : undefined} onPointerLeave={() => setActive(null)}>
        {featuredProjects.map((p, i) => {
          const cover = coverOf(p);
          return (
            <li key={p.slug} className={styles.item} data-on={active === i ? "" : undefined}>
              <Link
                href={`/${p.slug}/`}
                className={styles.row}
                data-cursor="Open"
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  go(`/${p.slug}`, { from: e.currentTarget.getBoundingClientRect(), label: p.title });
                }}
              >
                <span className={`meta ${styles.no}`}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.titleBox} style={{ "--chars": p.title.length } as React.CSSProperties}>
                  <span className={styles.title}>{p.title}</span>
                </span>
                <span className={styles.info}>
                  <span>{p.subtitle}</span>
                  <span className={styles.dim}>{[p.client, p.studio].filter(Boolean).join(", ")}</span>
                  <span className={styles.dim}>{p.period || "[Year]"}</span>
                </span>
                <span className={styles.inlineCover}>
                  {cover ? <Media item={cover} sizes="100vw" /> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div ref={preview} className={styles.preview} data-on={active !== null ? "" : undefined} aria-hidden="true">
        {featuredProjects.map((p, i) => {
          const cover = coverOf(p);
          return (
            <div key={p.slug} className={styles.previewItem} data-on={active === i ? "" : undefined}>
              {cover ? <Media item={cover} sizes="32vw" /> : <MediaSlot label={`${p.title} cover`} ratio="4 / 3" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
