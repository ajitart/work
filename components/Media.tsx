"use client";

import { useEffect, useRef } from "react";
import type { MediaItem } from "@/lib/types";
import { asset, embedUrl } from "@/lib/content";
import styles from "./media.module.css";

/**
 * Renders a JPG/PNG/GIF/WebP image or a video. Images load lazily; videos load
 * only when near the viewport and play only while visible. Without controls a
 * video behaves like a GIF: muted, looping, inline.
 */
export function Media({
  item,
  className,
  sizes,
  eager = false,
  fit,
}: {
  item: MediaItem;
  className?: string;
  sizes?: string;
  eager?: boolean;
  fit?: "cover" | "contain";
}) {
  const video = useRef<HTMLVideoElement>(null);
  const src = asset(item.src);
  const ratio = item.width && item.height ? `${item.width} / ${item.height}` : undefined;

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!v.src) v.src = src;
          if (!item.controls) v.play().catch(() => {});
        } else if (!item.controls) {
          v.pause();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src, item.controls]);

  // Cropping is decided by the surrounding layout (CSS) unless a caller asks for it explicitly.
  const style = { aspectRatio: ratio, ...(fit ? { objectFit: fit } : {}) } as React.CSSProperties;

  if (item.type === "embed") {
    const player = embedUrl(item.src);
    if (!player) return null;
    return (
      <iframe
        className={`${styles.media} ${styles.embed} ${className ?? ""}`}
        src={player}
        title={item.caption || "Video"}
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        style={{ aspectRatio: ratio ?? "16 / 9" }}
      />
    );
  }

  if (item.type === "video") {
    return (
      <video
        ref={video}
        className={`${styles.media} ${className ?? ""}`}
        style={style}
        muted={!item.controls}
        loop={!item.controls}
        playsInline
        controls={item.controls}
        preload="none"
        aria-label={item.caption || undefined}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`${styles.media} ${className ?? ""}`}
      style={style}
      src={src}
      alt={item.caption ?? ""}
      width={item.width}
      height={item.height}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

/** A clearly marked empty slot, for work whose images have not been added yet. */
export function MediaSlot({ label, className, ratio = "16 / 10" }: { label: string; className?: string; ratio?: string }) {
  return (
    <div className={`${styles.slot} ${className ?? ""}`} style={{ aspectRatio: ratio }}>
      <span className={styles.slotLabel}>{label}</span>
    </div>
  );
}
