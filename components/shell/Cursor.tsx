"use client";

import { useEffect, useRef } from "react";
import { isFinePointer, prefersReducedMotion } from "@/lib/motion";
import styles from "./shell.module.css";

/**
 * A small dot that becomes a ring over anything interactive, and carries a
 * word ("Open", "View") over elements that set data-cursor. Desktop only;
 * every action still works without it.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isFinePointer()) return;
    const reduced = prefersReducedMotion();
    const root = document.documentElement;
    root.classList.add("has-custom-cursor");

    const pos = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let raf = 0;
    let shown = false;

    const move = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!shown) {
        ringPos.x = pos.x;
        ringPos.y = pos.y;
        shown = true;
        root.dataset.cursor = "on";
      }
      const target = (e.target as Element | null)?.closest<HTMLElement>(
        "a, button, [role='button'], input, select, textarea, label, [data-cursor]",
      );
      const label = target?.dataset.cursor ?? "";
      ring.current!.dataset.state = label ? "label" : target ? "hover" : "idle";
      if (word.current && word.current.textContent !== label) word.current.textContent = label;
    };
    const leave = () => {
      shown = false;
      root.dataset.cursor = "off";
    };
    const down = () => ring.current?.setAttribute("data-down", "");
    const up = () => ring.current?.removeAttribute("data-down");

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const k = reduced ? 1 : 0.2;
      ringPos.x += (pos.x - ringPos.x) * k;
      ringPos.y += (pos.y - ringPos.y) * k;
      dot.current!.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      ring.current!.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
    };
    tick();

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <div className={styles.cursor} aria-hidden="true">
      <div ref={ring} className={styles.ring} data-state="idle">
        <span ref={word} className={styles.word} />
      </div>
      <div ref={dot} className={styles.dot} />
    </div>
  );
}
