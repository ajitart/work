"use client";

import { useEffect, useRef } from "react";
import type { Chapter as ChapterData } from "@/lib/types";
import { site } from "@/lib/content";
import { useFit } from "@/lib/useFit";
import { gsap, prefersReducedMotion, ScrollTrigger } from "@/lib/motion";
import styles from "./chapters.module.css";

/**
 * Each chapter's headline moves the way its sentence reads:
 *   reveal  "Making things look good."      lines are unveiled, condensed to full width
 *   drift   "Making digital move."          lines slide against each other as you scroll
 *   settle  "Making complex things simple." scattered letters settle into a straight line
 *   grid    "Designing systems."            letters snap into a modular grid
 */
function Chapter({ chapter, index }: { chapter: ChapterData; index: number }) {
  const root = useRef<HTMLElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);
  useFit(headline, { maxHeight: chapter.lines.length > 2 ? 0.6 : 0.5 });
  const split = chapter.motion === "settle" || chapter.motion === "grid";

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = root.current!;
    const lines = el.querySelectorAll<HTMLElement>("[data-fit-line]");
    const letters = el.querySelectorAll<HTMLElement>("[data-letter]");
    const details = el.querySelectorAll<HTMLElement>("[data-detail]");
    const ctx = gsap.context(() => {
      gsap.from(details, {
        autoAlpha: 0,
        y: 24,
        duration: 1,
        stagger: 0.06,
        scrollTrigger: { trigger: el.querySelector("[data-details]"), start: "top 85%" },
      });

      switch (chapter.motion) {
        case "reveal":
          gsap.fromTo(
            lines,
            { yPercent: 105, "--wdth": 70 },
            {
              yPercent: 0,
              "--wdth": 100,
              duration: 1.3,
              stagger: 0.12,
              ease: "expo.out",
              scrollTrigger: { trigger: headline.current, start: "top 78%" },
            },
          );
          break;
        case "drift":
          lines.forEach((line, i) => {
            const dir = i % 2 === 0 ? 1 : -1;
            gsap.fromTo(
              line,
              { xPercent: 22 * dir },
              {
                xPercent: -10 * dir,
                ease: "none",
                scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 },
              },
            );
          });
          break;
        case "settle":
          letters.forEach((l) => {
            gsap.fromTo(
              l,
              {
                yPercent: gsap.utils.random(-90, 90),
                xPercent: gsap.utils.random(-40, 40),
                rotate: gsap.utils.random(-28, 28),
                "--wdth": gsap.utils.random(62, 125),
              },
              {
                yPercent: 0,
                xPercent: 0,
                rotate: 0,
                "--wdth": 100,
                ease: "power2.out",
                scrollTrigger: { trigger: headline.current, start: "top 95%", end: "top 30%", scrub: 0.8 },
              },
            );
          });
          break;
        case "grid":
          gsap.fromTo(
            el.querySelectorAll("[data-grid-line]"),
            { scaleX: 0 },
            { scaleX: 1, duration: 1.4, stagger: 0.08, ease: "expo.inOut", scrollTrigger: { trigger: headline.current, start: "top 80%" } },
          );
          gsap.fromTo(
            letters,
            { autoAlpha: 0, "--wdth": 62, yPercent: 30 },
            {
              autoAlpha: 1,
              "--wdth": 100,
              yPercent: 0,
              duration: 0.9,
              ease: "steps(6)",
              stagger: { each: 0.05, grid: "auto", from: "start" },
              scrollTrigger: { trigger: headline.current, start: "top 75%" },
            },
          );
          break;
      }
    }, el);
    return () => ctx.revert();
  }, [chapter.motion]);

  const sentence = chapter.lines.join(" ");

  return (
    <section ref={root} id={chapter.id} className={styles.chapter} data-motion={chapter.motion} aria-labelledby={`${chapter.id}-h`}>
      <div className={styles.top}>
        <p className={`meta ${styles.no}`}>Chapter {String(index + 1).padStart(2, "0")}</p>
        <p className={`meta ${styles.period}`}>{chapter.period}</p>
      </div>

      <h2 ref={headline} id={`${chapter.id}-h`} className={`display ${styles.headline}`} aria-label={sentence}>
        {chapter.motion === "grid" && (
          <span className={styles.grid} aria-hidden="true">
            {chapter.lines.map((_, i) => (
              <span key={i} data-grid-line />
            ))}
          </span>
        )}
        {chapter.lines.map((line, i) => (
          <span key={i} className={styles.mask} aria-hidden="true">
            <span className={styles.line} data-fit-line>
              {split
                ? line.split("").map((ch, k) => (
                    <span key={k} className={styles.letter} data-letter>
                      {ch === " " ? " " : ch}
                    </span>
                  ))
                : line}
            </span>
          </span>
        ))}
      </h2>

      <div className={styles.details} data-details>
        <ul className={styles.disciplines} aria-label="Disciplines">
          {chapter.disciplines.map((d) => (
            <li key={d} data-detail>
              {d}
            </li>
          ))}
        </ul>

        <div className={styles.record}>
          <ol className={styles.roles} aria-label="Roles">
            {chapter.roles.map((r) => (
              <li key={r.org + r.years} data-detail>
                <span className={styles.role}>
                  {r.role}, <span className={styles.org}>{r.org}</span>
                </span>
                <span className={`meta ${styles.years}`}>{r.years}</span>
              </li>
            ))}
          </ol>
          {chapter.note && (
            <p className={styles.note} data-detail>
              {chapter.note}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** The timeline, docked to the bottom edge while the chapters play. */
function Rail() {
  const root = useRef<HTMLDivElement>(null);
  const { start, end, phases } = site.timeline;

  useEffect(() => {
    const el = root.current!;
    const fill = el.querySelector<HTMLElement>("[data-fill]")!;
    const year = el.querySelector<HTMLElement>("[data-year]")!;
    const triggers = site.chapters.map((c) =>
      ScrollTrigger.create({
        trigger: `#${c.id}`,
        start: "top 60%",
        end: "bottom 60%",
        onUpdate: (self) => {
          const y = c.from + (c.to - c.from) * self.progress;
          fill.style.transform = `scaleX(${(y - start) / (end - start)})`;
          year.textContent = String(Math.floor(y));
        },
      }),
    );
    const visible = ScrollTrigger.create({
      trigger: `#${site.chapters[0].id}`,
      endTrigger: `#${site.chapters[site.chapters.length - 1].id}`,
      start: "top 60%",
      end: "bottom 60%",
      toggleClass: { targets: el, className: styles.railOn },
    });
    return () => {
      triggers.forEach((t) => t.kill());
      visible.kill();
    };
  }, [start, end]);

  return (
    <div ref={root} className={styles.rail} aria-hidden="true">
      <span className={styles.railYear} data-year>
        {start}
      </span>
      <span className={styles.railTrack}>
        <span className={styles.railFill} data-fill />
        {phases.map((p) => (
          <span key={p.year} className={styles.railTick} style={{ left: `${((p.year - start) / (end - start)) * 100}%` }} />
        ))}
      </span>
      <span className={styles.railEnd}>{end}</span>
    </div>
  );
}

export function Chapters() {
  return (
    <>
      {site.chapters.map((c, i) => (
        <Chapter key={c.id} chapter={c} index={i} />
      ))}
      <Rail />
    </>
  );
}
