// Layout constants shared by the particle engine and the DOM laid over it.
// Kept apart from engine.ts so importing them doesn't pull Three.js into the first load.

/** Share of viewport width the timeline spans on each side of centre (CSS mirrors this as --span). */
export function lineSpanFraction(width: number) {
  return width < 700 ? 0.84 : 0.8;
}

/** Logo placement as fractions of the viewport: centre above the middle (of half-height), and total height. */
export const LOGO_INTRO = { y: 0.22, height: 0.26 };
export const LOGO_ENDING = { y: 0.52, height: 0.15 };
