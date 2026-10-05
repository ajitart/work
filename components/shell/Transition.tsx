"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap, prefersReducedMotion, registerGsap } from "@/lib/motion";
import styles from "./shell.module.css";

type Go = (href: string, opts?: { from?: DOMRect; label?: string }) => void;

const TransitionContext = createContext<Go>(() => {});

export function useTransitionTo() {
  return useContext(TransitionContext);
}

/**
 * Opening a project: a black plate grows out of the row that was clicked,
 * carrying the project name, then lifts away once the new page is in place.
 */
export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const plate = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const active = useRef(false);

  useEffect(registerGsap, []);

  const go = useCallback<Go>(
    (href, opts = {}) => {
      const el = plate.current;
      if (!el || prefersReducedMotion() || active.current) {
        router.push(href);
        return;
      }
      active.current = true;
      const r = opts.from;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const from = r
        ? `inset(${r.top}px ${vw - r.right}px ${vh - r.bottom}px ${r.left}px)`
        : "inset(100% 0% 0% 0%)";
      if (label.current) label.current.textContent = opts.label ?? "";
      gsap.set(el, { visibility: "visible", clipPath: from });
      gsap.set(label.current, { autoAlpha: 0, yPercent: 30 });
      gsap
        .timeline()
        .to(el, { clipPath: "inset(0px 0px 0px 0px)", duration: 0.75, ease: "power3.inOut" })
        .to(label.current, { autoAlpha: 1, yPercent: 0, duration: 0.5 }, "-=0.35")
        .add(() => router.push(href), "+=0.05");
    },
    [router],
  );

  // When the route has changed under the plate, lift it away.
  useEffect(() => {
    if (!active.current || !plate.current) return;
    const el = plate.current;
    const t = gsap
      .timeline({ delay: 0.15 })
      .to(label.current, { autoAlpha: 0, yPercent: -30, duration: 0.4, ease: "power2.in" })
      .to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.8, ease: "power3.inOut" }, "-=0.1")
      .add(() => {
        gsap.set(el, { visibility: "hidden" });
        active.current = false;
      });
    return () => {
      t.kill();
    };
  }, [pathname]);

  return (
    <TransitionContext.Provider value={go}>
      {children}
      <div ref={plate} className={styles.plate} aria-hidden="true">
        <span ref={label} className={`display ${styles.plateLabel}`} />
      </div>
    </TransitionContext.Provider>
  );
}
