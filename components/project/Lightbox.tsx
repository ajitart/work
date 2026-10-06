"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MediaItem } from "@/lib/types";
import { asset } from "@/lib/content";
import styles from "./lightbox.module.css";

/**
 * The whole creative, as large as the screen allows. Arrow keys, swipe or the
 * buttons move through every image and video on the page; Esc closes.
 */
export function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: MediaItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const item = items[index];
  const count = items.length;

  const go = useCallback((d: number) => onIndex((index + d + count) % count), [index, count, onIndex]);

  useEffect(() => {
    const html = document.documentElement;
    const wasLocked = html.classList.contains("is-locked");
    html.classList.add("is-locked");
    const previous = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    return () => {
      if (!wasLocked) html.classList.remove("is-locked");
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab" && root.current) {
        const f = root.current.querySelectorAll<HTMLElement>("button, video[controls]");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, onClose]);

  if (!item) return null;

  return (
    <div
      ref={root}
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={`Image ${index + 1} of ${count}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
      }}
    >
      <div className={styles.bar}>
        <span className={styles.count}>
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
        <button ref={closeBtn} type="button" className={styles.close} onClick={onClose}>
          Close
        </button>
      </div>

      <figure className={styles.stage} onClick={(e) => e.target === e.currentTarget && onClose()}>
        {item.type === "video" ? (
          <video key={item.src} className={styles.media} src={asset(item.src)} controls autoPlay playsInline loop={!item.controls} muted={!item.controls} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={item.src} className={styles.media} src={asset(item.src)} alt={item.caption ?? ""} decoding="async" />
        )}
        {item.caption && <figcaption className={styles.caption}>{item.caption}</figcaption>}
      </figure>

      {count > 1 && (
        <>
          <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={() => go(-1)} aria-label="Previous">
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" className={`${styles.nav} ${styles.next}`} onClick={() => go(1)} aria-label="Next">
            <span aria-hidden="true">→</span>
          </button>
        </>
      )}
    </div>
  );
}
