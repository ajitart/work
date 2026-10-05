"use client";

import { useEffect, useRef } from "react";
import { field } from "@/lib/field";
import { prefersReducedMotion } from "@/lib/motion";
import { MARK_PATH, MARK_VIEWBOX } from "@/lib/mark";
import { timelineNodes } from "@/lib/content";

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The single fixed WebGL canvas behind the home page. Three.js loads after first paint. */
export function FieldCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!webglAvailable()) {
      root.dataset.webgl = "off";
      return;
    }
    let disposed = false;
    let engine: import("./engine").ParticleField | null = null;

    import("./engine").then(({ ParticleField }) => {
      if (disposed || !canvas.current) return;
      try {
        engine = new ParticleField(canvas.current, {
          reducedMotion: prefersReducedMotion(),
          markPath: MARK_PATH,
          markViewBox: MARK_VIEWBOX,
          nodes: timelineNodes,
        });
        field.attach(engine);
        root.dataset.webgl = "on";
      } catch {
        root.dataset.webgl = "off";
      }
    });

    return () => {
      disposed = true;
      if (engine) {
        field.detach(engine);
        engine.dispose();
      }
    };
  }, []);

  return <canvas ref={canvas} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, display: "block" }} />;
}
