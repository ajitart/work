"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { site } from "@/lib/content";
import { field, journey } from "@/lib/field";
import { gsap, prefersReducedMotion, ScrollTrigger } from "@/lib/motion";
import { LOGO_ENDING, LOGO_INTRO } from "@/components/particles/layout";
import { FieldCanvas } from "@/components/particles/FieldCanvas";
import { GOTO_EVENT } from "@/components/shell/Chrome";
import { Intro } from "./Intro";
import { Timeline } from "./Timeline";
import { Chapters } from "./Chapters";
import { SelectedWork } from "./SelectedWork";
import { Archive } from "./Archive";
import { Making } from "./Making";
import { About } from "./About";
import { Ending } from "./Ending";

type Phase = "intro" | "transition" | "journey";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lock() {
  const root = document.documentElement;
  root.classList.add("is-locked");
  root.dataset.intro = "1";
}

function unlock() {
  const root = document.documentElement;
  root.classList.remove("is-locked");
  delete root.dataset.intro;
}

function scrollToTarget(target: string, smooth: boolean) {
  const behavior: ScrollBehavior = smooth && !prefersReducedMotion() ? "smooth" : "auto";
  if (target === "top") return window.scrollTo({ top: 0, behavior });
  const pinned = ScrollTrigger.getById(target);
  const el = document.getElementById(target);
  if (!el) return;
  const top = pinned ? pinned.start : el.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: Math.max(0, top), behavior });
}

/**
 * The whole home page as one piece of motion:
 * particles → mark → (click) → implode → line → chapters → work → archive → making → particles.
 */
export function Experience() {
  const intro = useRef<HTMLDivElement>(null);
  const [phase, setPhaseState] = useState<Phase>(() => (journey.begun ? "journey" : "intro"));
  const [revealDelay, setRevealDelay] = useState<number | null>(() => (journey.begun ? 0 : null));
  const phaseRef = useRef<Phase>(phase);
  const firstRun = useRef(true);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const finish = useCallback(() => {
    setPhase("journey");
    unlock();
    ScrollTrigger.refresh();
  }, []);

  /** Click on the mark: the particles implode, flash, and stretch into the timeline. */
  const begin = useCallback(
    (quick = false) => {
      if (phaseRef.current !== "intro") return;
      setPhase("transition");
      journey.begun = true;
      const e = field.get();
      const el = intro.current;

      if (quick || prefersReducedMotion() || !e) {
        if (e) {
          e.clearTargets();
          const u = e.uniforms;
          u.uLogo.value = 0;
          u.uImplode.value = 0;
          u.uPulse.value = 0;
          u.uLine.value = 1;
          u.uDust.value = 0;
          u.uOpacity.value = 1;
          u.uMouseForce.value = 0;
        }
        if (el) gsap.to(el, { autoAlpha: 0, duration: quick ? 0 : 0.5 });
        setRevealDelay(0);
        finish();
        return;
      }

      e.clearTargets();
      const u = e.uniforms;
      const letters = el!.querySelectorAll("[data-intro-letter]");
      const fades = el!.querySelectorAll("[data-intro-fade], [data-intro-mark]");
      gsap
        .timeline({ onComplete: finish })
        .to(fades, { autoAlpha: 0, y: 8, duration: 0.45, ease: "power2.in" }, 0)
        .to(letters, { autoAlpha: 0, scale: 0.6, filter: "blur(6px)", duration: 0.6, ease: "power2.in", stagger: { each: 0.05, from: "center" } }, 0)
        .to(u.uMouseForce, { value: 0, duration: 0.5 }, 0)
        .to(u.uImplode, { value: 1, duration: 1.2, ease: "power3.in" }, 0.08)
        .set(el, { autoAlpha: 0 }, 0.75)
        .to(u.uPulse, { value: 1, duration: 0.24, ease: "power2.out" }, 1.22)
        .set(u.uLogo, { value: 0 }, 1.3)
        .to(u.uPulse, { value: 0, duration: 1.1, ease: "power2.inOut" }, 1.46)
        .to(u.uLine, { value: 1, duration: 1.9, ease: "expo.inOut" }, 1.32)
        .add(() => setRevealDelay(0.01), 2.5)
        .set(u.uImplode, { value: 0 }, 3.3);
    },
    [finish],
  );

  /** The opening: black, then the field, then the particles gather into the mark. */
  useEffect(() => {
    if (phase !== "intro") return;
    const el = intro.current!;
    const initial = firstRun.current;
    firstRun.current = false;
    if (initial && window.location.hash.length > 1) {
      begin(true);
      return;
    }
    lock();
    const reduced = prefersReducedMotion();
    const letters = el.querySelectorAll("[data-intro-letter]");
    const fades = el.querySelectorAll("[data-intro-fade]");
    gsap.set(el, { autoAlpha: 1 });
    gsap.set(el.querySelectorAll("[data-intro-mark]"), { autoAlpha: 1, y: 0 });
    const t = gsap.timeline({ delay: reduced ? 0 : 1.1 });
    t.fromTo(letters, { autoAlpha: 0, y: 18, scale: 1, filter: "blur(0px)" }, { autoAlpha: 1, y: 0, duration: reduced ? 0 : 1.2, ease: "expo.out", stagger: 0.07 });
    t.fromTo(fades, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: reduced ? 0 : 1, stagger: 0.15 }, "-=0.7");

    let gather: gsap.core.Timeline | null = null;
    field.whenReady((e) => {
      if (phaseRef.current !== "intro") return;
      e.clearTargets();
      e.setTargets({ logoY: LOGO_INTRO.y });
      e.clearTargets();
      const u = e.uniforms;
      u.uLine.value = 0;
      u.uDust.value = 0;
      u.uImplode.value = 0;
      u.uPulse.value = 0;
      u.uMouseForce.value = reduced ? 0 : 1;
      if (reduced) {
        u.uLogo.value = 1;
        u.uOpacity.value = 1;
        return;
      }
      u.uLogo.value = 0;
      u.uOpacity.value = 0;
      gather = gsap
        .timeline()
        .to(u.uOpacity, { value: 1, duration: 1.4, ease: "power1.out" })
        .to(u.uLogo, { value: 1, duration: 3, ease: "power2.inOut" }, 0.5);
    });

    const key = (ev: KeyboardEvent) => {
      if (ev.key === "Enter" && document.activeElement === document.body) begin();
    };
    window.addEventListener("keydown", key);
    return () => {
      t.kill();
      gather?.kill();
      window.removeEventListener("keydown", key);
    };
  }, [phase, begin]);

  /** After the transition, scroll position alone decides what the particles are doing. */
  useEffect(() => {
    const chapters = ScrollTrigger.create({ trigger: `#${site.chapters[0].id}`, start: "top bottom", end: "top 35%" });
    const work = ScrollTrigger.create({ trigger: "#work", start: "top 90%", end: "top 35%" });
    const ending = ScrollTrigger.create({ trigger: "#ending", start: "top 85%", end: "top 4%" });
    ScrollTrigger.sort();
    ScrollTrigger.refresh();

    const tick = () => {
      if (phaseRef.current !== "journey") return;
      const a = chapters.progress;
      const w = work.progress;
      const end = ending.progress;
      field.target({
        uLine: 1 - a,
        uDust: a * (1 - end),
        uOpacity: Math.max(lerp(1, 0.55, a) * (1 - w), end),
        uLogo: end,
        logoY: end > 0 ? LOGO_ENDING.y : LOGO_INTRO.y,
        uImplode: 0,
        uPulse: 0,
        uMouseForce: Math.max(end * 0.8, a * (1 - w) * 0.35),
      });
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      chapters.kill();
      work.kill();
      ending.kill();
    };
  }, []);

  /** Index navigation and deep links. */
  useEffect(() => {
    const onGoto = (ev: Event) => {
      const target = (ev as CustomEvent<string>).detail;
      const wasIntro = phaseRef.current === "intro";
      if (wasIntro) begin(true);
      requestAnimationFrame(() => scrollToTarget(target, !wasIntro));
    };
    const onHash = () => {
      const target = window.location.hash.slice(1);
      if (target) onGoto(new CustomEvent(GOTO_EVENT, { detail: target }));
    };
    window.addEventListener(GOTO_EVENT, onGoto);
    window.addEventListener("hashchange", onHash);
    const hash = window.location.hash.slice(1);
    if (hash) setTimeout(() => scrollToTarget(hash, false), 120);
    return () => {
      window.removeEventListener(GOTO_EVENT, onGoto);
      window.removeEventListener("hashchange", onHash);
    };
  }, [begin]);

  /** Which section is on screen, for the Index. */
  useEffect(() => {
    const ids = site.index.map((i) => i.target);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) document.documentElement.dataset.section = en.target.id;
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  useEffect(() => () => unlock(), []);

  /** "Begin again": fade the field out, return to the top, and replay the opening. */
  const restart = useCallback(() => {
    const e = field.get();
    const done = () => {
      window.scrollTo(0, 0);
      journey.begun = false;
      setRevealDelay(null);
      setPhase("intro");
    };
    if (!e || prefersReducedMotion()) return done();
    phaseRef.current = "transition";
    e.clearTargets();
    gsap.to(e.uniforms.uOpacity, { value: 0, duration: 0.7, ease: "power2.in", onComplete: done });
  }, []);

  return (
    <>
      <FieldCanvas />
      {phase !== "journey" && <Intro ref={intro} onBegin={() => begin()} />}
      <main id="top" inert={phase === "intro"} style={{ position: "relative", zIndex: 1, visibility: phase === "intro" ? "hidden" : "visible" }}>
        <Timeline revealDelay={revealDelay} />
        <Chapters />
        <SelectedWork />
        <Archive />
        <Making />
        <About />
        <Ending onRestart={restart} />
      </main>
    </>
  );
}
