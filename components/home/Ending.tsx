"use client";

import { useRef } from "react";
import { site } from "@/lib/content";
import { useFit } from "@/lib/useFit";
import styles from "./ending.module.css";

/** Back to the particles: the mark re-forms above the last words. */
export function Ending({ onRestart }: { onRestart: () => void }) {
  const { lines, name, role, place, links, last } = site.ending;
  const heading = useRef<HTMLHeadingElement>(null);
  useFit(heading, { maxHeight: 0.26, max: 220 });

  return (
    <section id="ending" className={styles.ending} aria-labelledby="ending-h">
      <h2 ref={heading} id="ending-h" className={`display ${styles.heading}`}>
        {lines.map((l, i) => (
          <span key={i} data-fit-line>
            {l}
          </span>
        ))}
      </h2>

      <div className={styles.sign}>
        <p className={styles.name}>{name}</p>
        <p className={styles.role}>{role}</p>
        <p className={styles.place}>{place}</p>
      </div>

      <ul className={styles.links}>
        {links.map((l) =>
          l.href ? (
            <li key={l.label}>
              <a href={l.href} className={styles.link} {...(l.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
                {l.label}
              </a>
            </li>
          ) : (
            <li key={l.label}>
              <span className={`${styles.link} placeholder-text`} title="Link to be added">
                {l.label} [URL]
              </span>
            </li>
          ),
        )}
      </ul>

      <div className={styles.foot}>
        <p className="meta">{last}</p>
        <button type="button" className={`meta ${styles.restart}`} onClick={onRestart}>
          Begin again
        </button>
      </div>
    </section>
  );
}
