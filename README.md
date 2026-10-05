# Ajit Shitole · Work

An interactive design archive: 20+ years of making, told as one continuous piece of motion.
Published at **ajitart.github.io/work** (extends the resume at ajitart.github.io/resume).

```
particles → mark → (click) → implode → timeline → chapters → selected work
          → project stories → archive → the making → still making → particles
```

Built with Next.js (static export), React, TypeScript, Three.js and GSAP.

## Run it

```bash
npm install
npm run dev
```

- Site: http://localhost:3000/work/
- **Studio** (add images and videos): http://localhost:3000/work/studio/

The Studio and its upload API exist only in `npm run dev`. They are never part of the published site.

## Adding images, GIFs and videos to a project

1. Run `npm run dev` and open `/work/studio/`.
2. Pick a project on the left (or **Add project**).
3. Drop files onto the drop zone: JPG, PNG, GIF, WebP, AVIF, MP4, WebM or MOV, up to 95 MB each.
   - Files are saved to `public/media/projects/<slug>/` and recorded in `content/projects.json` straight away.
   - The first file becomes the cover; **Use as cover** changes it.
4. For each file choose:
   - **Place in page**: under the cover, inside one of the eight story beats (The problem … The outcome), or the gallery strip.
   - **Size**: full column, edge to edge, half (two side by side), or cropped detail.
   - Videos play muted on a loop, like a GIF. Tick **Show player controls and sound** for a normal player.
5. Fill in the details and the case-study text, then **Save changes** (⌘S).
6. Commit and push. The GitHub Action builds and publishes the site.

Removing a file moves it to `public/media/_trash/` (not committed), so nothing is lost by accident.
Every save keeps the previous JSON in `content/.backup/`.

The Making tab works the same way for sketches, wireframes, rejected concepts and so on.

## Where things live

| What | Where |
| --- | --- |
| Words: intro, timeline, chapters, about, ending, index | `content/site.json` |
| Projects (Selected work and Archive) | `content/projects.json` |
| Process work (The making) | `content/making.json` |
| Media files | `public/media/` |
| Particle system (Three.js shaders and states) | `components/particles/` |
| Home sections | `components/home/` |
| Project page template | `components/project/` |
| Header, Index overlay, cursor, page transition | `components/shell/` |
| Studio (dev only) | `app/studio/page.dev.tsx`, `app/api/studio/*/route.dev.ts` |

A project with `"featured": true` appears in Selected work; every project appears in the Archive.
Empty fields show as clearly marked placeholders, for example `[Project description]`. Nothing is invented.

## Motion

- One WebGL canvas holds every particle. Each particle has three homes (field, mark, timeline);
  shader uniforms blend between them, so states change on the GPU without touching geometry.
- After the opening, scroll position alone decides the particle state (see `Experience.tsx`).
- The particle count adapts to the device and drops further if the first seconds run slow.
  Three.js loads after first paint.
- `prefers-reduced-motion` skips the transitions and scroll scrubbing; everything still works.
- If WebGL is unavailable, the SVG mark and a plain line stand in for the particles.

## Publish

1. Create a GitHub repository named `work` under `ajitart`, then push this folder to `main`.
2. In the repo: Settings → Pages → Source: **GitHub Actions**.
3. Every push to `main` deploys (`.github/workflows/deploy.yml`).

To build locally: `npm run build` writes the static site to `out/`, and `npm run preview` serves it.
