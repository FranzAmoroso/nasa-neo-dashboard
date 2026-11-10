// Superfici procedurali dei pianeti: rumore 3D campionato sulla sfera,
// così le texture non hanno cuciture e non serve scaricare immagini.
import * as THREE from "three";

function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function noise3(x, y, z) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z),
    xf = x - xi,
    yf = y - yi,
    zf = z - zi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf),
    w = zf * zf * (3 - 2 * zf);
  const a = hash3(xi, yi, zi),
    b = hash3(xi + 1, yi, zi),
    c = hash3(xi, yi + 1, zi),
    d = hash3(xi + 1, yi + 1, zi),
    e = hash3(xi, yi, zi + 1),
    f = hash3(xi + 1, yi, zi + 1),
    g = hash3(xi, yi + 1, zi + 1),
    h = hash3(xi + 1, yi + 1, zi + 1);
  const x1 = a + (b - a) * u,
    x2 = c + (d - c) * u,
    x3 = e + (f - e) * u,
    x4 = g + (h - g) * u;
  const y1 = x1 + (x2 - x1) * v,
    y2 = x3 + (x4 - x3) * v;
  return y1 + (y2 - y1) * w;
}
export function fbm(x, y, z, oct) {
  let s = 0,
    a = 0.5,
    f = 1,
    n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function mix(o, c1, c2, t) {
  o[0] = c1[0] + (c2[0] - c1[0]) * t;
  o[1] = c1[1] + (c2[1] - c1[1]) * t;
  o[2] = c1[2] + (c2[2] - c1[2]) * t;
  return o;
}
function mixIn(o, c, t) {
  o[0] += (c[0] - o[0]) * t;
  o[1] += (c[1] - o[1]) * t;
  o[2] += (c[2] - o[2]) * t;
}
export function makeCanvasTex(w, h, fn, alpha) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const out = [0, 0, 0, 255];
  for (let j = 0; j < h; j++) {
    const lat = Math.PI / 2 - ((j + 0.5) / h) * Math.PI,
      cl = Math.cos(lat),
      sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      out[3] = 255;
      fn(out, cl * Math.cos(lon), sl, cl * Math.sin(lon), lat, lon);
      const k = (j * w + i) * 4;
      d[k] = out[0];
      d[k + 1] = out[1];
      d[k + 2] = out[2];
      d[k + 3] = alpha ? out[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}
function craterSet(n, seed, minR, maxR) {
  const list = [];
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1,
      t = rnd() * Math.PI * 2,
      r = Math.sqrt(1 - u * u);
    const R = minR + (maxR - minR) * Math.pow(rnd(), 3);
    list.push([r * Math.cos(t), u, r * Math.sin(t), R, Math.cos(R * 1.25)]);
  }
  return list;
}
function craterShade(cr, x, y, z) {
  let m = 1;
  for (let c = 0; c < cr.length; c++) {
    const k = cr[c];
    const dot = x * k[0] + y * k[1] + z * k[2];
    if (dot > k[4]) {
      const t = Math.acos(Math.min(1, dot)) / k[3];
      if (t < 0.85) m *= 0.82 + 0.1 * t;
      else if (t < 1.15) m *= 1.12 - (0.12 * Math.abs(t - 1)) / 0.15;
    }
  }
  return m;
}
const TEX = {
  sun(o, x, y, z) {
    const g = fbm(x * 14 + 3, y * 14, z * 14, 4),
      l = fbm(x * 3, y * 3 + 7, z * 3, 3);
    mix(o, [255, 226, 140], [255, 150, 48], clamp(g * 1.25 - 0.15 + (l - 0.5) * 0.6));
  },
  mercury() {
    const cr = craterSet(140, 7, 0.02, 0.22);
    return (o, x, y, z) => {
      const n = fbm(x * 3 + 1, y * 3, z * 3, 5);
      const v = (120 + 60 * n) * craterShade(cr, x, y, z);
      o[0] = v * 1.04;
      o[1] = v;
      o[2] = v * 0.93;
    };
  },
  venus(o, x, y, z, lat) {
    const n = fbm(x * 2 + 0.3, y * 5, z * 2, 5),
      s = fbm(x * 6 + n * 2, y * 3, z * 6, 3);
    mix(o, [226, 200, 146], [188, 150, 96], clamp(n * 1.1 + (s - 0.5) * 0.5 - 0.25 + Math.abs(lat) * 0.15));
  },
  earth(o, x, y, z, lat) {
    const n = fbm(x * 1.7 + 11, y * 1.7, z * 1.7, 6),
      d = fbm(x * 7, y * 7 + 3, z * 7, 3);
    const h = n + (d - 0.5) * 0.12;
    const al = Math.abs(lat);
    if (al > 1.2 + (d - 0.5) * 0.3) {
      o[0] = 236;
      o[1] = 241;
      o[2] = 246;
      return;
    }
    if (h < 0.53) {
      mix(o, [26, 74, 124], [5, 20, 48], clamp((0.53 - h) / 0.1));
      return;
    }
    const e = clamp((h - 0.53) / 0.14);
    mix(o, [44, 82, 40], [98, 102, 60], e);
    mixIn(o, [188, 156, 106], clamp(Math.exp(-Math.pow((al - 0.42) / 0.17, 2)) * (0.55 + (d - 0.5) * 1.8)));
    if (e > 0.75) mixIn(o, [128, 118, 108], clamp((e - 0.75) * 4));
    if (al > 0.95) mixIn(o, [150, 150, 138], clamp((al - 0.95) * 3));
  },
  clouds(o, x, y, z, lat) {
    const c = fbm(x * 2.6 + 5, y * 4.5, z * 2.6, 5),
      c2 = fbm(x * 9, y * 9, z * 9, 2);
    o[0] = o[1] = o[2] = 255;
    o[3] = sstep(0.5, 0.72, c + (c2 - 0.5) * 0.2) * (0.55 + 0.45 * Math.cos(lat * 2) ** 2) * 235;
  },
  mars(o, x, y, z, lat) {
    const n = fbm(x * 2.6 + 2, y * 2.6, z * 2.6, 6),
      a = fbm(x * 1.2, y * 1.6 + 4, z * 1.2, 4);
    mix(o, [196, 104, 62], [150, 76, 46], n);
    mixIn(o, [92, 56, 40], sstep(0.55, 0.66, a) * 0.8);
    if (Math.abs(lat) > 1.33 + (n - 0.5) * 0.3) {
      o[0] = 238;
      o[1] = 232;
      o[2] = 226;
    }
  },
  jupiter(o, x, y, z, lat, lon) {
    const tb = (fbm(x * 3 + 9, y * 3, z * 3, 4) - 0.5) * 0.2;
    const la = lat + tb * Math.cos(lat * 2);
    mix(o, [232, 214, 180], [196, 152, 108], Math.sin(la * 14) * 0.5 + 0.5);
    if (Math.abs(lat) < 1) mixIn(o, [148, 102, 72], (Math.sin(la * 33 + 1.3) * 0.5 + 0.5) * 0.35);
    mixIn(o, [128, 114, 104], sstep(0.95, 1.45, Math.abs(lat)));
    let dl = lon - 2.0;
    dl = Math.atan2(Math.sin(dl), Math.cos(dl));
    const e = (dl / 0.24) ** 2 + ((lat + 0.38) / 0.085) ** 2;
    if (e < 1.5) mixIn(o, [198, 104, 74], (1 - e / 1.5) * 0.95);
  },
  saturn(o, x, y, z, lat) {
    const la = lat + (fbm(x * 3 + 4, y * 3, z * 3, 3) - 0.5) * 0.08;
    mix(
      o,
      [230, 212, 168],
      [200, 174, 124],
      (Math.sin(la * 11) * 0.5 + 0.5) * 0.8 + (Math.sin(la * 27) * 0.5 + 0.5) * 0.2,
    );
    mixIn(o, [170, 164, 140], sstep(1, 1.45, Math.abs(lat)));
  },
  uranus(o, x, y, z, lat) {
    mix(
      o,
      [176, 216, 224],
      [150, 196, 210],
      (Math.sin(lat * 7) * 0.5 + 0.5) * 0.35 + fbm(x * 3, y * 8, z * 3, 3) * 0.15,
    );
  },
  neptune(o, x, y, z, lat, lon) {
    const tb = (fbm(x * 3, y * 3, z * 3 + 2, 3) - 0.5) * 0.12;
    mix(o, [66, 104, 200], [40, 70, 158], (Math.sin((lat + tb) * 9) * 0.5 + 0.5) * 0.55);
    if (fbm(x * 6 + 1, y * 14, z * 6, 3) > 0.66) mixIn(o, [220, 230, 250], 0.5);
    let dl = lon - 1;
    dl = Math.atan2(Math.sin(dl), Math.cos(dl));
    const e = (dl / 0.2) ** 2 + ((lat + 0.35) / 0.08) ** 2;
    if (e < 1) mixIn(o, [28, 40, 104], 1 - e);
  },
  moon() {
    const cr = craterSet(160, 3, 0.015, 0.2);
    return (o, x, y, z) => {
      const n = fbm(x * 2 + 1, y * 2, z * 2, 5),
        mare = sstep(0.5, 0.6, fbm(x * 1.4 + 5, y * 1.4, z * 1.4, 4));
      const v = (165 - 55 * mare + 40 * (n - 0.5)) * craterShade(cr, x, y, z);
      o[0] = v;
      o[1] = v * 0.99;
      o[2] = v * 0.96;
    };
  },
  rock() {
    const cr = craterSet(60, 11, 0.05, 0.3);
    return (o, x, y, z) => {
      const v = (95 + 50 * fbm(x * 3, y * 3, z * 3, 4)) * craterShade(cr, x, y, z);
      o[0] = v * 1.05;
      o[1] = v * 0.95;
      o[2] = v * 0.85;
    };
  },
  ice() {
    const cr = craterSet(90, 23, 0.02, 0.18);
    return (o, x, y, z) => {
      const v = (190 + 40 * fbm(x * 3 + 2, y * 3, z * 3, 4)) * craterShade(cr, x, y, z);
      o[0] = v * 0.98;
      o[1] = v;
      o[2] = v * 1.02;
    };
  },
  io(o, x, y, z) {
    const n = fbm(x * 4, y * 4, z * 4, 4),
      s = fbm(x * 10 + 3, y * 10, z * 10, 3);
    mix(o, [234, 208, 96], [208, 160, 64], n);
    if (s > 0.66) mixIn(o, [96, 44, 24], sstep(0.66, 0.72, s));
    else if (n > 0.62) mixIn(o, [242, 238, 206], 0.6);
  },
  europa(o, x, y, z) {
    const w = fbm(x * 3, y * 3, z * 3, 3);
    mix(o, [222, 212, 190], [196, 186, 168], w);
    const l = Math.abs(Math.sin((x * 7 + y * 5 + z * 9) * 2 + w * 12)),
      l2 = Math.abs(Math.sin((x * -5 + y * 8 + z * 4) * 2.3 + w * 9));
    if (l < 0.05 || l2 < 0.04) mixIn(o, [150, 96, 64], 0.75);
  },
  ganymede() {
    const cr = craterSet(80, 5, 0.02, 0.15);
    return (o, x, y, z) => {
      mix(o, [112, 102, 92], [178, 170, 158], sstep(0.45, 0.58, fbm(x * 2 + 4, y * 2, z * 2, 5)));
      const v = craterShade(cr, x, y, z);
      o[0] *= v;
      o[1] *= v;
      o[2] *= v;
    };
  },
  callisto() {
    const cr = craterSet(220, 9, 0.01, 0.12);
    return (o, x, y, z) => {
      let v = 78 + 34 * fbm(x * 3 + 6, y * 3, z * 3, 4);
      for (let c = 0; c < cr.length; c++) {
        const k = cr[c];
        if (x * k[0] + y * k[1] + z * k[2] > Math.cos(k[3] * 0.5)) {
          v *= 1.7;
          break;
        }
      }
      o[0] = v;
      o[1] = v * 0.93;
      o[2] = v * 0.85;
    };
  },
  titan(o, x, y, z, lat) {
    mix(o, [220, 160, 80], [188, 124, 56], fbm(x * 2 + 8, y * 2, z * 2, 4) * 0.6 + Math.abs(lat) * 0.15);
  },
  iapetus(o, x, y, z) {
    const n = fbm(x * 3, y * 3, z * 3, 4);
    mix(o, [214, 206, 190], [56, 40, 30], sstep(-0.2, 0.25, x + (n - 0.5) * 0.6));
  },
  triton(o, x, y, z, lat) {
    mix(o, [214, 196, 188], [190, 160, 150], fbm(x * 4 + 1, y * 4, z * 4, 4));
    if (lat < -0.4) mixIn(o, [232, 206, 198], 0.6);
  },
};
export const texFn = (key) => {
  const f = TEX[key];
  return f.length === 0 ? f() : f;
};
export { TEX };
