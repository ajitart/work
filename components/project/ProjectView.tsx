"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { MediaItem, Project } from "@/lib/types";
import { coverOf, site } from "@/lib/content";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { useFit } from "@/lib/useFit";
import { useTransitionTo } from "@/components/shell/Transition";
import { Media, MediaSlot } from "@/components/Media";
import styles from "./project.module.css";

function MediaBlock({ items }: { items: MediaItem[] }) {
  if (!items.length) return null;
  return (
    <div className={styles.mediaBlock}>
      {items.map((m) => (
        <figure key={m.id} className={styles.figure} data-layout={m.layout ?? "full"} data-reveal>
          <div className={styles.frame}>
            <Media item={m} sizes={m.layout === "half" || m.layout === "detail" ? "50vw" : "100vw"} />
          </div>
          {m.caption && <figcaption className="meta">{m.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

/**
 * A case study told in eight beats. Each beat can hold text and any number of
 * images or videos (placed through the Studio). Missing text shows its slot.
 */
export function ProjectView({ project: p, next }: { project: Project; next: Project }) {
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const go = useTransitionTo();
  useFit(title, { maxHeight: 0.42, max: 320 });

  const cover = coverOf(p);
  const hero = p.media.filter((m) => m.placement === "hero" && m.src !== cover?.src);
  const gallery = p.media.filter((m) => !m.placement || m.placement === "gallery");
  const hasStory = Object.values(p.story).some(Boolean) || p.media.some((m) => site.story.some((s) => s.key === m.placement));
  const showStory = p.featured || hasStory;
  const steps = site.story;

  useEffect(() => {
    const el = root.current!;
    const reduced = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (!reduced) {
        gsap.from(el.querySelectorAll("[data-hero]"), { autoAlpha: 0, y: 30, duration: 1.1, stagger: 0.08, delay: 0.5 });
        // Images uncover as they arrive: the project is discovered, not dumped.
        el.querySelectorAll<HTMLElement>("[data-reveal]").forEach((f) => {
          gsap.fromTo(
            f.querySelector(`.${styles.frame}`),
            { clipPath: "inset(12% 6% 12% 6%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: f, start: "top 88%" } },
          );
        });
      }

      // Step rail: highlight the beat being read.
      const links = el.querySelectorAll<HTMLElement>("[data-step-link]");
      el.querySelectorAll<HTMLElement>("[data-step]").forEach((s, i) => {
        gsap.timeline({
          scrollTrigger: {
            trigger: s,
            start: "top 55%",
            end: "bottom 55%",
            onToggle: (self) => links[i]?.toggleAttribute("data-on", self.isActive),
          },
        });
      });

      // Gallery: vertical scroll drives a horizontal strip on wide screens.
      const track = strip.current;
      if (track && !reduced) {
        const mm = gsap.matchMedia();
        mm.add("(min-width: 761px)", () => {
          const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
          if (distance() < 40) return;
          gsap.to(track, {
            x: () => -distance(),
            ease: "none",
            scrollTrigger: { trigger: track.parentElement, start: "center center", end: () => `+=${distance()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true },
          });
        });
      }
    }, el);
    return () => ctx.revert();
  }, [p.slug]);

  const meta = [
    { label: "Client", value: p.client },
    { label: "Studio", value: p.studio },
    { label: "Year", value: p.period },
    { label: "Discipline", value: p.categories.join(", ") },
  ].filter((m) => m.value);

  return (
    <article ref={root} className={styles.project}>
      <header className={styles.hero}>
        <p className={`meta ${styles.kicker}`} data-hero>
          {p.subtitle}
        </p>
        <h1 ref={title} className={`display ${styles.title}`}>
          <span data-fit-line>{p.title}</span>
        </h1>
        <div className={styles.lede}>
          <p className={styles.statement} data-hero>
            {p.statement || <span className="placeholder-text">[Project statement]</span>}
          </p>
          <dl className={styles.meta} data-hero>
            {meta.map((m) => (
              <div key={m.label}>
                <dt>{m.label}</dt>
                <dd>{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className={styles.cover} data-reveal>
        <div className={styles.frame}>{cover ? <Media item={cover} eager sizes="100vw" /> : <MediaSlot label="[Cover image or video]" ratio="16 / 8" />}</div>
      </div>

      {(p.description || p.recognition?.length) && (
        <section className={styles.overview}>
          {p.description && <p className={styles.description}>{p.description}</p>}
          {p.recognition?.length ? (
            <div>
              <p className="meta">Recognition</p>
              <ul className={styles.recognition}>
                {p.recognition.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      <MediaBlock items={hero} />

      {showStory && (
        <div className={styles.story}>
          <nav className={styles.steps} aria-label="Case study">
            <ol>
              {steps.map((s, i) => (
                <li key={s.key}>
                  <a href={`#${s.key}`} data-step-link>
                    <span>{String(i + 1).padStart(2, "0")}</span> {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className={styles.beats}>
            {steps.map((s, i) => {
              const text = p.story[s.key];
              const items = p.media.filter((m) => m.placement === s.key);
              return (
                <section key={s.key} id={s.key} className={styles.beat} data-step aria-labelledby={`${s.key}-h`}>
                  <p className={`meta ${styles.beatNo}`}>{String(i + 1).padStart(2, "0")}</p>
                  <h2 id={`${s.key}-h`} className={`display ${styles.beatTitle}`}>
                    {s.title}
                  </h2>
                  <p className={styles.beatText}>{text || <span className="placeholder-text">[Project description]</span>}</p>
                  <MediaBlock items={items} />
                </section>
              );
            })}
          </div>
        </div>
      )}

      {gallery.length > 0 && (
        <section className={styles.gallery} aria-label="Gallery">
          <div ref={strip} className={styles.strip}>
            {gallery.map((m) => (
              <figure key={m.id} className={styles.slide}>
                <Media item={m} sizes="60vw" />
                {m.caption && <figcaption className="meta">{m.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {!showStory && gallery.length === 0 && !cover && (
        <p className={`${styles.pending} placeholder-text`}>[Images and videos for this work will be added here]</p>
      )}

      <footer className={styles.next}>
        <p className="meta">Next project</p>
        <Link
          href={`/${next.slug}/`}
          className={`display ${styles.nextTitle}`}
          data-cursor="Open"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            go(`/${next.slug}`, { from: e.currentTarget.getBoundingClientRect(), label: next.title });
          }}
        >
          {next.title}
        </Link>
        <Link href="/#work" className={`meta ${styles.back}`}>
          All selected work
        </Link>
      </footer>
    </article>
  );
}
