"use client";

import { useEffect, useRef } from "react";
import { getProject, making } from "@/lib/content";
import { gsap } from "@/lib/motion";
import { Media, MediaSlot } from "@/components/Media";
import { useFit } from "@/lib/useFit";
import styles from "./making.module.css";

/**
 * Process work on a long table. On wide screens the strip slides sideways as
 * you scroll down; on phones it is a swipeable row.
 */
export function Making() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLOListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useFit(heading, { maxHeight: 0.42 });

  useEffect(() => {
    const el = root.current!;
    const strip = track.current!;
    const mm = gsap.matchMedia();
    mm.add("(min-width: 761px) and (prefers-reduced-motion: no-preference)", () => {
      const distance = () => Math.max(0, strip.scrollWidth - window.innerWidth);
      const tween = gsap.to(strip, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: el.querySelector("[data-stage]"),
          start: "center center",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      // Each frame tilts back to straight as it passes the centre of the screen.
      strip.querySelectorAll<HTMLElement>("[data-frame]").forEach((f, i) => {
        gsap.fromTo(
          f,
          { rotate: i % 2 ? 2.4 : -1.8, y: i % 3 === 0 ? 24 : -12 },
          {
            rotate: 0,
            y: 0,
            ease: "none",
            scrollTrigger: { trigger: f, containerAnimation: tween, start: "left right", end: "center center", scrub: true },
          },
        );
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section ref={root} id="making" className={styles.making} aria-labelledby="making-h">
      <div className={styles.intro}>
        <div className={styles.top}>
          <p className="meta">The making</p>
          <p className="meta">Sketches, wireframes, explorations, rejects</p>
        </div>
        <h2 ref={heading} id="making-h" className={`display ${styles.heading}`}>
          <span data-fit-line>Not everything</span>
          <br />
          <span data-fit-line>made it to</span>
          <br />
          <span data-fit-line>the final.</span>
        </h2>
      </div>

      <div className={styles.stage} data-stage>
        <ol ref={track} className={styles.track}>
          {making.map((m, i) => {
            const project = m.project ? getProject(m.project) : undefined;
            const first = m.media[0];
            return (
              <li key={m.id} className={styles.frame} data-frame data-size={i % 3}>
                <figure>
                  <div className={styles.plate}>
                    {first ? <Media item={first} sizes="40vw" /> : <MediaSlot label={`${m.kind} to come`} ratio={i % 3 === 1 ? "3 / 4" : "4 / 3"} />}
                    {m.status && <span className={styles.stamp}>{m.status}</span>}
                  </div>
                  <figcaption className={styles.caption}>
                    <span className={styles.kind}>{m.kind}</span>
                    <span className={styles.desc}>
                      {[m.title, project?.title, m.year].filter(Boolean).join(", ")}
                    </span>
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
