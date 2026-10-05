"use client";

import type { Ref } from "react";
import { asset, site } from "@/lib/content";
import styles from "./intro.module.css";

/**
 * The opening frame. The mark itself is drawn by the particle field; this layer
 * holds the name, the dates, and the invisible button that starts the journey.
 */
export function Intro({ ref, onBegin }: { ref: Ref<HTMLDivElement>; onBegin: () => void }) {
  const { name, line, years, cta } = site.intro;
  return (
    <div ref={ref} className={styles.intro} onClick={onBegin} data-cursor="Begin">
      {/* Fallback while WebGL loads, or if it is unavailable. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.mark} src={asset("ajit-mark.svg")} alt="" aria-hidden="true" data-intro-mark />

      <button
        type="button"
        className={styles.begin}
        aria-label={`${name}. ${line}, ${years}. ${cta}.`}
        onClick={(e) => {
          e.stopPropagation();
          onBegin();
        }}
        data-cursor="Begin"
      />

      <h1 className={styles.name} aria-hidden="true">
        {name.split("").map((ch, i) => (
          <span key={i} data-intro-letter>
            {ch}
          </span>
        ))}
      </h1>

      <div className={styles.sub} aria-hidden="true" data-intro-fade>
        <p className={styles.line}>{line}</p>
        <p className={styles.years}>{years}</p>
      </div>

      <p className={styles.cta} aria-hidden="true" data-intro-fade>
        {cta}
      </p>
    </div>
  );
}
