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
- **Studio** (add images and videos locally): http://localhost:3000/work/studio/

The Studio and its upload API exist only in `npm run dev`. On the live site, editing works through Settings → Edit (below).

## Adding and deleting images, GIFs and videos

### On the live site (any computer or phone)

1. Open ajitart.github.io/work → **Index** → **Settings**.
2. Follow the steps there to create a GitHub fine-grained token for `ajitart/work`
   (Contents: Read and write; Actions: Read-only), paste it, and press **Connect**. This is a one-time step per browser.
3. An **Edit** button appears at the bottom right of every page (only in your browser). On a project page it opens that project.
4. Drop JPG, PNG, GIF, WebP, AVIF, MP4, WebM or MOV files (up to 95 MB each), then set each file's
   placement (under the cover, one of the eight story beats, or the gallery strip), size, caption, cover, order, or **Delete** it.
5. Press **Publish**. Everything goes to GitHub as one commit, and the site rebuilds itself; the editor says when it's live (about a minute).

The token is stored only in that browser. **Settings → Turn off editing on this browser** removes it.
Deleted files stay recoverable in the repository's git history.

### On this computer (Studio)

`npm run dev`, then open http://localhost:3000/work/studio/. It's the same editor; **Save** writes to this folder
(removed files go to `public/media/_trash/`, previous JSON to `content/.backup/`). Commit and push to publish.

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
| Editor (live Edit button and local Studio) | `components/editor/`, `app/studio/page.dev.tsx`, `app/api/studio/*/route.dev.ts` |

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
