"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { site } from "@/lib/content";
import { gsap, prefersReducedMotion } from "@/lib/motion";
import { SETTINGS_EVENT } from "@/components/editor/events";
import styles from "./shell.module.css";

export const GOTO_EVENT = "journey:goto";

/** Persistent, quiet navigation: the name top-left, the Index top-right. */
export function Chrome() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const onHome = pathname === "/";
  // Back returns to where you were if you came from inside the site; otherwise to Selected work.
  const firstPath = useRef(pathname);
  const movedWithinSite = useRef(false);
  useEffect(() => {
    if (pathname !== firstPath.current) movedWithinSite.current = true;
  }, [pathname]);

  const back = () => {
    if (movedWithinSite.current) router.back();
    else router.push("/#work");
  };

  const goto = useCallback(
    (target: string) => {
      if (onHome) window.dispatchEvent(new CustomEvent(GOTO_EVENT, { detail: target }));
      else router.push(`/#${target}`);
    },
    [onHome, router],
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const items = el.querySelectorAll("li");
    if (open) {
      setCurrent(document.documentElement.dataset.section ?? null);
      document.documentElement.classList.add("is-locked");
      gsap.set(el, { visibility: "visible" });
      if (prefersReducedMotion()) {
        gsap.set(el, { clipPath: "inset(0% 0% 0% 0%)" });
      } else {
        gsap.fromTo(el, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.7, ease: "power3.inOut" });
        gsap.fromTo(items, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.7, stagger: 0.035, delay: 0.25 });
      }
      el.querySelector<HTMLElement>("a, button")?.focus();
    } else if (el.style.visibility === "visible") {
      if (!document.documentElement.dataset.intro) document.documentElement.classList.remove("is-locked");
      gsap.to(el, {
        clipPath: "inset(100% 0% 0% 0%)",
        duration: prefersReducedMotion() ? 0 : 0.55,
        ease: "power3.inOut",
        onComplete: () => {
          gsap.set(el, { visibility: "hidden" });
        },
      });
      button.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>("a, button");
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, close]);

  useEffect(close, [pathname, close]);

  return (
    <>
      <header className={styles.chrome}>
        <div className={styles.left}>
          {!onHome && (
            <button type="button" className={styles.back} onClick={back}>
              <span aria-hidden="true">←</span> Back
            </button>
          )}
        <Link
          href="/"
          className={styles.home}
          onClick={(e) => {
            if (onHome) {
              e.preventDefault();
              goto("top");
            }
          }}
        >
          Ajit <span aria-hidden="true">/</span> Work
        </Link>
        </div>
        <button
          ref={button}
          type="button"
          className={styles.indexButton}
          aria-expanded={open}
          aria-controls="site-index"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Index"}
        </button>
      </header>

      <div
        ref={panel}
        id="site-index"
        className={styles.index}
        role="dialog"
        aria-modal="true"
        aria-label="Index"
        hidden={false}
        style={{ visibility: "hidden" }}
      >
        <nav aria-label="Sections">
          <ol className={styles.indexList}>
            {site.index.map((item, i) => (
              <li key={item.target}>
                <button
                  type="button"
                  className={styles.indexItem}
                  aria-current={current === item.target ? "location" : undefined}
                  onClick={() => {
                    setOpen(false);
                    goto(item.target);
                  }}
                >
                  <span className={styles.indexNo}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.indexLabel}>{item.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <p className={`meta ${styles.indexFoot}`}>
          Ajit Shitole · Design Lead, CCTech ·{" "}
          <a href="https://ajitart.github.io/resume/" className={styles.inlineLink}>
            Resume
          </a>{" "}
          ·{" "}
          <button
            type="button"
            className={styles.inlineLink}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(SETTINGS_EVENT));
            }}
          >
            Settings
          </button>
        </p>
      </div>
    </>
  );
}
