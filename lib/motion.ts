"use client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";

let registered = false;
export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, Flip);
  gsap.defaults({ ease: "power3.out" });
  registered = true;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isFinePointer() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export { gsap, ScrollTrigger, Flip };

// Register before any component effect creates a ScrollTrigger.
registerGsap();
if (typeof window !== "undefined") ScrollTrigger.config({ ignoreMobileResize: true });
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as unknown as { __gsap: typeof gsap; __st: typeof ScrollTrigger }).__gsap = gsap;
  (window as unknown as { __st: typeof ScrollTrigger }).__st = ScrollTrigger;
}
