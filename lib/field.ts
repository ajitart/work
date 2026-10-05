import type { FieldTargets, ParticleField } from "@/components/particles/engine";

// A tiny shared handle so any section can steer the one particle field.
let engine: ParticleField | null = null;
let pending: FieldTargets = {};
const ready: ((e: ParticleField) => void)[] = [];

export const field = {
  attach(e: ParticleField) {
    engine = e;
    if (process.env.NODE_ENV === "development") (window as unknown as { __field: ParticleField }).__field = e;
    e.setTargets(pending);
    pending = {};
    ready.splice(0).forEach((fn) => fn(e));
  },
  detach(e: ParticleField) {
    if (engine === e) engine = null;
  },
  get(): ParticleField | null {
    return engine;
  },
  target(t: FieldTargets) {
    if (engine) engine.setTargets(t);
    else Object.assign(pending, t);
  },
  whenReady(fn: (e: ParticleField) => void) {
    if (engine) fn(engine);
    else ready.push(fn);
  },
};

/** Remembers, for this page load only, that the visitor has already entered. */
export const journey = { begun: false, timeline: 0 };
