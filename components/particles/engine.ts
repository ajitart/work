import * as THREE from "three";
import { fragmentShader, vertexShader } from "./shaders";
import { LOGO_ENDING, LOGO_INTRO, lineSpanFraction } from "./layout";

export type FieldUniform =
  | "uLogo"
  | "uLogoScale"
  | "uImplode"
  | "uPulse"
  | "uLine"
  | "uDust"
  | "uPlayhead"
  | "uOpacity"
  | "uMouseForce";

export type FieldTargets = Partial<Record<FieldUniform, number>> & {
  logoY?: number;
};

const CAMERA_Z = 10;
const FOV = 45;


interface Options {
  reducedMotion: boolean;
  markPath: string;
  markViewBox: [number, number];
  /** Fractions 0..1 along the timeline where the year nodes sit. */
  nodes: number[];
}

function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function particleBudget() {
  const w = window.innerWidth;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (w < 700) return 6500;
  if (cores <= 4 || memory <= 4) return 10000;
  return 18000;
}

/** Cheap smooth pseudo-noise; its zero-crossings form the curving bands of the field. */
function bands(x: number, y: number, z: number) {
  return (
    Math.sin(x * 2.1 + Math.sin(y * 1.7 + z * 0.35) * 1.6) * 0.6 +
    Math.sin(y * 3.3 - x * 1.2 + Math.cos(z * 0.5) * 1.3) * 0.4
  );
}

/** Sample points inside the SVG mark by rasterising it once. */
function sampleMark(path: string, [vw, vh]: [number, number], count: number) {
  const h = 360;
  const w = Math.round((vw / vh) * h);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.scale(w / vw, h / vh);
  ctx.fillStyle = "#fff";
  ctx.fill(new Path2D(path));
  const data = ctx.getImageData(0, 0, w, h).data;
  const filled: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 140) filled.push(x, y);
    }
  }
  const out = new Float32Array(count * 3);
  const n = filled.length / 2;
  for (let i = 0; i < count; i++) {
    const k = Math.floor(Math.random() * n) * 2;
    out[i * 3] = (filled[k] + Math.random() - w / 2) / h;
    out[i * 3 + 1] = -(filled[k + 1] + Math.random() - h / 2) / h;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
  }
  return out;
}

export class ParticleField {
  readonly uniforms: Record<string, THREE.IUniform>;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private points: THREE.Points;
  private count: number;
  private raf = 0;
  private clock = new THREE.Timer();
  private targets: FieldTargets = {};
  private pointer = { x: 0, y: 0, nx: 0, ny: 0, active: false };
  private frameTimes: number[] = [];
  private degraded = false;
  private halfH = 1;
  private halfW = 1;
  private logoY = LOGO_INTRO.y;
  private reduced: boolean;
  private disposed = false;
  private observer: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, opts: Options) {
    this.reduced = opts.reducedMotion;
    this.count = particleBudget();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 1);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
    this.camera.position.set(0, 0, CAMERA_Z);

    this.uniforms = {
      uTime: { value: 0 },
      uMotion: { value: this.reduced ? 0 : 1 },
      uDpr: { value: 1 },
      uSize: { value: window.innerWidth < 700 ? 2.6 : 2.2 },
      uHalf: { value: new THREE.Vector2(1, 1) },
      uLogo: { value: 1 },
      uLogoScale: { value: 1 },
      uLogoOffset: { value: new THREE.Vector2(0, 0) },
      uImplode: { value: 0 },
      uPulse: { value: 0 },
      uLine: { value: 0 },
      uLineSpan: { value: 1 },
      uDust: { value: 0 },
      uPlayhead: { value: -100 },
      uOpacity: { value: 1 },
      uMouse: { value: new THREE.Vector2(99, 99) },
      uMouseForce: { value: this.reduced ? 0 : 1 },
    };

    this.buildGeometry(opts);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    this.resize();
    // The canvas, not the window, defines the layout width (it excludes any scrollbar).
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    document.addEventListener("pointerleave", this.onLeave);
    this.loop();
  }

  private buildGeometry(opts: Options) {
    const n = this.count;
    const field = new Float32Array(n * 3);
    const line = new Float32Array(n * 3);
    const ring = new Float32Array(n * 2);
    const rand = new Float32Array(n * 4);
    const role = new Float32Array(n);
    const logoShare = window.innerWidth < 700 ? 0.5 : 0.42;
    const logoCount = Math.floor(n * logoShare);
    const logoPts = sampleMark(opts.markPath, opts.markViewBox, logoCount);
    const logo = new Float32Array(n * 3);
    let li = 0;

    const nodes = opts.nodes.map((f) => -1 + 2 * f);

    for (let i = 0; i < n; i++) {
      // Field: fills the view frustum at every depth, gathered into slow flowing
      // bands (not an even star field), and thinner near the centre.
      let x = 0;
      let y = 0;
      let z = 0;
      for (let tries = 0; tries < 12; tries++) {
        z = -7 + Math.pow(Math.random(), 0.8) * 9.5;
        x = (Math.random() * 2 - 1) * 1.35;
        y = (Math.random() * 2 - 1) * 1.35;
        if (Math.random() < 0.14 || Math.abs(bands(x, y, z)) < 0.16) break;
      }
      const spread = (CAMERA_Z - z) / CAMERA_Z;
      const rr = Math.hypot(x, y * 1.4);
      if (rr < 0.45 && Math.random() < 0.6) {
        const k = 0.45 / Math.max(rr, 0.05);
        x *= k;
        y *= k;
      }
      field[i * 3] = x * spread;
      field[i * 3 + 1] = y * spread;
      field[i * 3 + 2] = z;

      rand[i * 4] = Math.random();
      rand[i * 4 + 1] = Math.random();
      rand[i * 4 + 2] = Math.random();
      rand[i * 4 + 3] = Math.random();

      // Roles are random per index so a reduced draw range keeps the same mix.
      if (li < logoCount && Math.random() < logoShare * 1.02) {
        role[i] = 1;
        logo[i * 3] = logoPts[li * 3];
        logo[i * 3 + 1] = logoPts[li * 3 + 1];
        logo[i * 3 + 2] = logoPts[li * 3 + 2];
        li++;
      }

      // Timeline: a fine line, rings at each year, and a faint haze left behind.
      const pick = Math.random();
      if (pick < 0.6) {
        line[i * 3] = Math.random() * 2 - 1;
        line[i * 3 + 1] = Math.random() < 0.85 ? gauss() * 0.0035 : gauss() * 0.02;
        line[i * 3 + 2] = gauss() * 0.04;
      } else if (pick < 0.9) {
        const node = nodes[Math.floor(Math.random() * nodes.length)];
        const a = Math.random() * Math.PI * 2;
        const onRing = Math.random() < 0.65;
        const radius = onRing ? 0.03 + gauss() * 0.002 : Math.random() * 0.008;
        line[i * 3] = node;
        line[i * 3 + 2] = 0;
        // Offsets in units of half-height so the rings stay round at any aspect ratio.
        ring[i * 2] = Math.cos(a) * radius;
        ring[i * 2 + 1] = Math.sin(a) * radius;
      } else {
        line[i * 3] = (Math.random() * 2 - 1) * 1.6;
        line[i * 3 + 1] = (Math.random() * 2 - 1) * 1.1;
        line[i * 3 + 2] = -1 - Math.random() * 5;
      }
    }

    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.geometry.setAttribute("aField", new THREE.BufferAttribute(field, 3));
    this.geometry.setAttribute("aLogo", new THREE.BufferAttribute(logo, 3));
    this.geometry.setAttribute("aLine", new THREE.BufferAttribute(line, 3));
    this.geometry.setAttribute("aRing", new THREE.BufferAttribute(ring, 2));
    this.geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));
    this.geometry.setAttribute("aRole", new THREE.BufferAttribute(role, 1));
  }

  private size = { w: 0, h: 0 };

  private resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    // Resizing clears the WebGL canvas for a frame. On phones the height changes constantly while
    // scrolling (the address bar), which reads as flicker: only react to real changes.
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && this.size.w === w && Math.abs(this.size.h - h) < 160) return;
    if (this.size.w === w && this.size.h === h) return;
    this.size = { w, h };
    const dpr = Math.min(window.devicePixelRatio || 1, this.degraded ? 1 : w < 700 ? 1.5 : 1.75);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAMERA_Z;
    this.halfW = this.halfH * this.camera.aspect;
    (this.uniforms.uHalf.value as THREE.Vector2).set(this.halfW, this.halfH);
    this.uniforms.uDpr.value = dpr;
    this.uniforms.uLineSpan.value = this.halfW * lineSpanFraction(w);
    this.layoutLogo();
  };

  private layoutLogo() {
    const ending = this.logoY > (LOGO_INTRO.y + LOGO_ENDING.y) / 2;
    const height = ending ? LOGO_ENDING.height : LOGO_INTRO.height;
    this.uniforms.uLogoScale.value = height * 2 * this.halfH;
    (this.uniforms.uLogoOffset.value as THREE.Vector2).set(0, this.logoY * this.halfH);
  }

  /** Convert a 0..1 position along the timeline into the shader's world x. */
  lineX(fraction: number) {
    return (-1 + 2 * fraction) * (this.uniforms.uLineSpan.value as number);
  }

  /** Ease uniforms towards these values every frame (used for scroll-driven states). */
  setTargets(t: FieldTargets) {
    Object.assign(this.targets, t);
    if (t.logoY !== undefined && t.logoY !== this.logoY) {
      this.logoY = t.logoY;
      this.layoutLogo();
    }
  }

  /** Stop easing; GSAP tweens drive the uniforms directly (the intro sequence). */
  clearTargets() {
    this.targets = {};
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.active = true;
    this.pointer.nx = (e.clientX / (this.canvas.clientWidth || window.innerWidth)) * 2 - 1;
    this.pointer.ny = -((e.clientY / (this.canvas.clientHeight || window.innerHeight)) * 2 - 1);
    this.pointer.x = this.pointer.nx * this.halfW;
    this.pointer.y = this.pointer.ny * this.halfH;
  };

  private onLeave = () => {
    this.pointer.active = false;
  };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.clock.update();
    this.frame(Math.min(this.clock.getDelta(), 0.1));
  };

  /** Advance and draw one frame. */
  frame(dt: number) {
    const u = this.uniforms;
    u.uTime.value += dt;

    const k = this.reduced ? 1 : 1 - Math.pow(0.0025, dt);
    for (const key in this.targets) {
      if (key === "logoY") continue;
      const target = this.targets[key as FieldUniform]!;
      const cur = u[key].value as number;
      u[key].value = Math.abs(target - cur) < 0.0005 ? target : cur + (target - cur) * k;
    }

    const mouse = u.uMouse.value as THREE.Vector2;
    const mk = 1 - Math.pow(0.002, dt);
    const mx = this.pointer.active ? this.pointer.x : 99;
    const my = this.pointer.active ? this.pointer.y : 99;
    mouse.x = Math.abs(mouse.x - mx) > 20 ? mx : mouse.x + (mx - mouse.x) * mk;
    mouse.y = Math.abs(mouse.y - my) > 20 ? my : mouse.y + (my - mouse.y) * mk;

    // Slight parallax in the open field; none on the timeline, so the line lines up with the labels.
    if (!this.reduced) {
      const free = 1 - Math.max(u.uLine.value as number, u.uImplode.value as number);
      const cx = this.pointer.nx * 0.35 * free;
      const cy = this.pointer.ny * 0.22 * free;
      this.camera.position.x += (cx - this.camera.position.x) * mk;
      this.camera.position.y += (cy - this.camera.position.y) * mk;
      this.camera.lookAt(0, 0, 0);
    }

    const visible = (u.uOpacity.value as number) > 0.003;
    this.canvas.style.visibility = visible ? "visible" : "hidden";
    if (!visible) return;

    this.renderer.render(this.scene, this.camera);
    this.watchPerformance(dt);
  }

  /** If the first couple of seconds run slow, draw fewer particles at a lower resolution. */
  private watchPerformance(dt: number) {
    if (this.degraded || this.frameTimes.length > 150) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 150) return;
    const avg = this.frameTimes.slice(30).reduce((a, b) => a + b, 0) / 120;
    if (avg > 1 / 40) {
      this.degraded = true;
      this.geometry.setDrawRange(0, Math.floor(this.count * 0.55));
      this.size = { w: 0, h: 0 }; // force the lower pixel ratio to apply
      this.resize();
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    window.removeEventListener("pointermove", this.onPointer);
    document.removeEventListener("pointerleave", this.onLeave);
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
