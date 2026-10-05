"use client";

import { useEffect, useRef } from "react";
import { site } from "@/lib/content";
import { field, journey } from "@/lib/field";
import { gsap, prefersReducedMotion, ScrollTrigger } from "@/lib/motion";
import styles from "./timeline.module.css";

const { start, end, phases } = site.timeline;
const fractions = phases.map((p) => (p.year - start) / (end - start));
/** Share of the pinned scroll used to travel the line; the rest holds on 2026. */
const TRAVEL = 0.88;

/**
 * The career line the particles stretch into. Scrolling moves a playhead
 * along it; the phase it reaches takes over the headline.
 */
export function Timeline({ revealDelay }: { revealDelay: number | null }) {
  const root = useRef<HTMLElement>(null);

  // Pin the section and drive the playhead from scroll.
  useEffect(() => {
    const el = root.current!;
    const titles = Array.from(el.querySelectorAll<HTMLElement>("[data-phase-title]"));
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-node]"));
    const yearEl = el.querySelector<HTMLElement>("[data-year]")!;
    const noEl = el.querySelector<HTMLElement>("[data-phase-no]")!;
    const fill = el.querySelector<HTMLElement>("[data-fill]")!;
    const reduced = prefersReducedMotion();
    let active = -1;

    const show = (i: number) => {
      if (i === active) return;
      const prev = active;
      active = i;
      noEl.textContent = String(i + 1).padStart(2, "0");
      nodes.forEach((n, k) => n.toggleAttribute("data-active", k <= i));
      titles.forEach((t, k) => {
        const on = k === i;
        t.setAttribute("aria-hidden", on ? "false" : "true");
        if (reduced) {
          gsap.set(t, { autoAlpha: on ? 1 : 0 });
          return;
        }
        if (on) gsap.fromTo(t, { autoAlpha: 0, yPercent: k > prev ? 40 : -40, "--wdth": 70 }, { autoAlpha: 1, yPercent: 0, "--wdth": 100, duration: 0.8 });
        else if (k === prev) gsap.to(t, { autoAlpha: 0, yPercent: k < i ? -40 : 40, duration: 0.5, ease: "power2.in" });
      });
    };

    const update = (progress: number) => {
      journey.timeline = progress;
      const f = Math.min(progress / TRAVEL, 1);
      yearEl.textContent = String(Math.round(start + f * (end - start)));
      fill.style.transform = `scaleX(${f})`;
      let i = 0;
      fractions.forEach((fr, k) => {
        if (f + 0.002 >= fr) i = k;
      });
      show(i);
      const e = field.get();
      if (e) field.target({ uPlayhead: e.lineX(f) });
    };

    titles.forEach((t) => gsap.set(t, { autoAlpha: 0 }));
    update(0);

    const st = ScrollTrigger.create({
      id: "timeline",
      trigger: el,
      start: "top top",
      end: "+=220%",
      pin: true,
      onUpdate: (self) => update(self.progress),
    });
    return () => st.kill();
  }, []);

  // Labels arrive once the particles have become the line.
  useEffect(() => {
    const el = root.current!;
    const items = el.querySelectorAll("[data-node]");
    const head = el.querySelectorAll("[data-tl-reveal]");
    if (revealDelay === null) {
      gsap.set([items, head], { autoAlpha: 0 });
      return;
    }
    if (prefersReducedMotion() || revealDelay === 0) {
      gsap.set([items, head], { autoAlpha: 1, y: 0 });
      return;
    }
    const t = gsap.timeline({ delay: revealDelay });
    t.fromTo(items, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: { each: 0.09, from: "center" } });
    t.fromTo(head, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.2);
    return () => {
      t.kill();
    };
  }, [revealDelay]);

  const scrollToPhase = (i: number) => {
    const st = ScrollTrigger.getById("timeline");
    if (!st) return;
    const y = st.start + (st.end - st.start) * fractions[i] * TRAVEL;
    window.scrollTo({ top: y + 1, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  return (
    <section ref={root} id="timeline" className={styles.timeline} aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="visually-hidden">
        Career timeline, {start} to {end}
      </h2>

      <div className={styles.head}>
        <p className="meta" data-tl-reveal>
          Phase <span data-phase-no>01</span> of {String(phases.length).padStart(2, "0")}
        </p>
        <p className={styles.year} data-tl-reveal aria-hidden="true">
          <span data-year>{start}</span>
        </p>
      </div>

      <div className={styles.titles} data-tl-reveal>
        {phases.map((p) => (
          <p key={p.year} className={`display ${styles.title}`} data-phase-title aria-hidden="true">
            {p.title}
          </p>
        ))}
      </div>

      <div className={styles.rule} aria-hidden="true">
        <span data-fill />
      </div>

      <ol className={styles.nodes}>
        {phases.map((p, i) => (
          <li key={p.year} data-node style={{ "--x": -1 + 2 * fractions[i] } as React.CSSProperties}>
            <button type="button" onClick={() => scrollToPhase(i)} className={styles.node}>
              <span className={styles.nodeYear}>{p.year}</span>
              <span className={styles.nodeTitle}>{p.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <p className={`meta ${styles.hint}`} data-tl-reveal>
        Scroll to travel the line
      </p>
    </section>
  );
}
