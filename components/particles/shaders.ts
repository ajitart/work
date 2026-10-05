// Simplex noise: Ashima Arts / Stefan Gustavson (MIT).
const noise = /* glsl */ `
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

/*
 * Every particle carries three "homes" and the uniforms blend between them:
 *   aField  the open particle field (normalised x/y, world z)
 *   aLogo   a point inside Ajit's mark (only for particles with aRole = 1)
 *   aLine   a point on the career timeline (x along the line, -1..1)
 * Order of blending: field → dust → logo → implode (core) → pulse → line.
 */
export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform float uDpr;
uniform float uSize;
uniform vec2  uHalf;
uniform float uLogo;
uniform float uLogoScale;
uniform vec2  uLogoOffset;
uniform float uImplode;
uniform float uPulse;
uniform float uLine;
uniform float uLineSpan;
uniform float uDust;
uniform float uPlayhead;
uniform float uOpacity;
uniform vec2  uMouse;
uniform float uMouseForce;

attribute vec3 aField;
attribute vec3 aLogo;
attribute vec3 aLine;
attribute vec2 aRing;
attribute vec4 aRand;
attribute float aRole;

varying float vAlpha;

${noise}

float ease(float t){ return t * t * (3.0 - 2.0 * t); }

void main() {
  float t = uTime * uMotion;

  vec3 field = vec3(aField.xy * uHalf, aField.z);
  vec3 q = field * 0.16 + vec3(0.0, 0.0, t * 0.035);
  vec3 flow = vec3(
    snoise(q),
    snoise(q + vec3(17.1, 3.2, 0.0)),
    snoise(q + vec3(-9.3, 11.7, 0.0))
  );
  vec3 p = field + flow * 0.6;

  // Dust: the field pushed back and thinned, used behind the chapters.
  vec3 dust = vec3(field.xy * 1.12, field.z - 1.5) + flow * 1.4;
  p = mix(p, dust, uDust);

  // Logo: breathing gently in place.
  float breath = sin(t * 0.8 + aRand.y * 6.2831) * 0.012;
  vec3 logo = vec3(aLogo.xy * uLogoScale + uLogoOffset, aLogo.z) + flow * (0.02 + breath);
  float tLogo = ease(clamp(uLogo * 1.4 - aRand.z * 0.4, 0.0, 1.0)) * aRole;
  p = mix(p, logo, tLogo);

  // Implode: everything spirals into a small, dense core.
  float ti = ease(clamp(uImplode * 1.6 - aRand.w * 0.6, 0.0, 1.0));
  float ang = ti * 3.4 + aRand.y * 6.2831 + t * 0.6;
  float r = (0.08 + pow(aRand.x, 0.7) * 0.42) * (1.0 - ti * 0.45);
  vec3 core = vec3(cos(ang) * r, sin(ang) * r * 0.55, (aRand.z - 0.5) * 0.25);
  p = mix(p, core, ti);

  // Pulse: a shockwave outwards from the core.
  p += normalize(p + vec3(0.0001)) * uPulse * (0.4 + aRand.x * 2.2);

  // Line: particles stretch out from the centre to their place on the timeline.
  vec3 line = vec3(aLine.x * uLineSpan + aRing.x * uHalf.y, (aLine.y + aRing.y) * uHalf.y, aLine.z);
  line.y += sin(aLine.x * 7.0 + t * 0.5) * 0.01 * (1.0 - abs(aLine.y) * 8.0);
  float nx = clamp(abs(aLine.x), 0.0, 1.6) / 1.6;
  float tl = ease(clamp(uLine * 1.8 - nx * 0.8, 0.0, 1.0));
  p = mix(p, line, tl);

  // Cursor: particles part around the pointer.
  vec2 d = p.xy - uMouse;
  float dl = length(d);
  p.xy += (d / (dl + 0.001)) * smoothstep(1.3, 0.0, dl) * 0.42 * uMouseForce * (1.0 - tl * 0.8);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float size = mix(0.55 + aRand.x * 1.35, 0.5 + aRand.x * 0.55, tLogo);
  size = mix(size, 0.55 + aRand.x * 0.7, tl);
  size *= 1.0 + uPulse * 1.6;
  gl_PointSize = size * uSize * uDpr * (10.0 / -mv.z);

  float depth = smoothstep(-19.0, -7.0, mv.z);
  float a = (0.18 + 0.82 * depth) * (0.4 + 0.6 * aRand.y);
  a = mix(a, 0.95, tLogo);
  // The core is thousands of points on top of each other: keep it glowing, not blown out.
  a *= mix(1.0, 0.22, ti);
  // On the timeline the years not yet reached sit quieter.
  float played = smoothstep(uPlayhead + 0.08, uPlayhead - 0.08, line.x);
  a *= mix(1.0, mix(0.28, 1.0, played), tl);
  a *= 1.0 - uDust * 0.5;
  vAlpha = a * uOpacity;
}
`;

export const fragmentShader = /* glsl */ `
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float m = smoothstep(0.5, 0.06, d);
  float alpha = m * vAlpha;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vec3(1.0), alpha);
}
`;
