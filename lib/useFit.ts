"use client";
import { useEffect, type RefObject } from "react";

/**
 * Sizes a block of display lines so the widest line fills the container,
 * without the block growing taller than `maxHeight` (a fraction of the viewport).
 * Lines are the element's children marked [data-fit-line].
 */
export function useFit(ref: RefObject<HTMLElement | null>, { maxHeight = 0.62, max = 400, lineHeight = 0.86 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;

    const fit = () => {
      const lines = Array.from(el.querySelectorAll<HTMLElement>("[data-fit-line]"));
      if (!lines.length) return;
      // Measure at the final letter width, whatever an animation is doing right now.
      el.dataset.measuring = "";
      el.style.fontSize = "100px";
      const widest = Math.max(...lines.map((l) => l.getBoundingClientRect().width));
      delete el.dataset.measuring;
      const byWidth = (100 * el.clientWidth) / Math.max(widest, 1);
      const byHeight = (window.innerHeight * maxHeight) / (lines.length * lineHeight);
      el.style.fontSize = `${Math.floor(Math.min(byWidth, byHeight, max) * 0.995)}px`;
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    document.fonts?.ready.then(schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [ref, maxHeight, max, lineHeight]);
}
