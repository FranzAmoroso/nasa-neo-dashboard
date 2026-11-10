// Scena 3D del sistema solare con Three.js.
//
// Flusso:
// 1. createScene() costruisce stelle, Sole, pianeti con le loro lune e le orbite;
// 2. le superfici vengono generate a passi (onProgress) per non bloccare la pagina;
// 3. setAsteroids() riceve gli asteroidi dal backend e crea per ognuno una roccia
//    con la sua traiettoria attorno al pianeta a cui passa vicino;
// 4. ogni fotogramma aggiorna posizioni (ora reale), etichette e camera;
// 5. i tocchi su pianeti, lune e asteroidi chiamano onPlanet / onMoon / onAsteroid.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PLANETS, PLANET_BY_ID } from "./planets";
import { DAY, RECENT_MS } from "./neo";
import { TEX, texFn, makeCanvasTex, noise3, fbm, mix, clamp } from "./textures";

const J2000 = Date.UTC(2000, 0, 1, 12);
const RAD = Math.PI / 180;

/** Distanza dal Sole in scala compressa, così Mercurio e Nettuno stanno nella stessa vista. */
const DIST = (au) => 30 * Math.pow(au, 0.45);
/** Raggio dei pianeti: proporzionale alla radice del diametro. */
const RADIUS = (D) => 0.5 + 0.9 * Math.sqrt(D / 12742);
/** Stessa scala per lune e asteroidi attorno a un pianeta: il confronto con le orbite resta corretto. */
const LOCAL = (p, km) => p.r * (1 + Math.pow(km / (p.D / 2), 0.45));

function seeded(seed) {
  let q = seed % 2147483647 || 1;
  return () => (q = (q * 16807) % 2147483647) / 2147483647;
}
function hashString(s) {
  let h = 7;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function createScene({
  canvas,
  labels,
  mobile,
  reduced,
  onPlanet,
  onMoon,
  onAsteroid,
  getPanelRect,
  onProgress,
}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.02, 4000);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enableDamping: true,
    dampingFactor: 0.08,
    minDistance: 1.5,
    maxDistance: 700,
    rotateSpeed: 0.6,
    enablePan: false,
  });
  const HOME_CAM = mobile ? new THREE.Vector3(0, 150, 300) : new THREE.Vector3(0, 92, 190);
  camera.position.copy(HOME_CAM);
  scene.add(new THREE.AmbientLight(0x8899bb, 0.07));
  scene.add(new THREE.PointLight(0xfff2e0, 2.4, 0, 0));

  // ---------- stelle ----------
  {
    const N = mobile ? 3500 : 6000;
    const pos = new Float32Array(N * 3),
      col = new Float32Array(N * 3);
    const rnd = seeded(42),
      axis = new THREE.Vector3(1, 0, 0.3).normalize(),
      v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const band = i < N * 0.45; // la Via Lattea: una fascia più densa
      if (band) {
        const t = rnd() * Math.PI * 2,
          g = (rnd() + rnd() + rnd() - 1.5) * 0.16;
        v.set(Math.cos(t), g, Math.sin(t));
      } else {
        const u = rnd() * 2 - 1,
          t = rnd() * Math.PI * 2,
          r = Math.sqrt(1 - u * u);
        v.set(r * Math.cos(t), u, r * Math.sin(t));
      }
      v.normalize().applyAxisAngle(axis, 1.05).multiplyScalar(1800);
      pos.set([v.x, v.y, v.z], i * 3);
      const b = Math.pow(rnd(), 2.2) * (band ? 0.55 : 1) + 0.08,
        t = rnd();
      col.set([b * (t < 0.2 ? 1 : 0.85 + t * 0.15), b * 0.93, b * (t > 0.8 ? 1.1 : 0.82 + t * 0.2)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    m.toneMapped = false;
    scene.add(new THREE.Points(g, m));
  }

  // ---------- Sole ----------
  const sun = new THREE.Mesh(new THREE.SphereGeometry(6.5, 64, 48), new THREE.MeshBasicMaterial({ color: 0xffcf7a }));
  sun.material.toneMapped = false;
  scene.add(sun);
  {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const g = cv.getContext("2d"),
      gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,236,190,1)");
    gr.addColorStop(0.18, "rgba(255,206,120,.55)");
    gr.addColorStop(0.45, "rgba(255,160,60,.14)");
    gr.addColorStop(1, "rgba(255,140,40,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cv),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    sp.material.toneMapped = false;
    sp.scale.set(60, 60, 1);
    scene.add(sp);
  }

  // ---------- pianeti ----------
  const sphereGeo = new THREE.SphereGeometry(1, 64, 48),
    smallGeo = new THREE.SphereGeometry(1, 32, 24);
  function orbitalPos(p, days, out) {
    const L = p.L0 * RAD + (2 * Math.PI * days) / p.P,
      node = p.node * RAD,
      inc = p.inc * RAD,
      u = L - node,
      r = DIST(p.a);
    const x = r * Math.cos(u),
      z = -r * Math.sin(u),
      y2 = -z * Math.sin(inc),
      z2 = z * Math.cos(inc);
    return out.set(x * Math.cos(node) + z2 * Math.sin(node), y2, -x * Math.sin(node) + z2 * Math.cos(node));
  }
  function ringTexture() {
    const cv = document.createElement("canvas");
    cv.width = 1024;
    cv.height = 4;
    const g = cv.getContext("2d"),
      img = g.createImageData(1024, 4);
    for (let i = 0; i < 1024; i++) {
      const r = i / 1023,
        n = noise3(r * 90, 0.5, 0.5),
        n2 = noise3(r * 400, 1.5, 0.5);
      // anelli C, B, divisione di Cassini, A
      let a =
        r < 0.2
          ? 0.16 + 0.1 * n
          : r < 0.62
            ? 0.82 + 0.12 * n
            : r < 0.665
              ? 0.04
              : r < 0.7
                ? 0.3
                : r < 0.965
                  ? 0.62 + 0.15 * n
                  : r < 0.975
                    ? 0.12
                    : (0.45 * (1 - r)) / 0.025;
      a *= 0.78 + 0.22 * n2;
      const c = mix([0, 0, 0], [176, 160, 134], [230, 214, 184], clamp(r * 1.2 - 0.1));
      for (let j = 0; j < 4; j++) {
        const k = (j * 1024 + i) * 4;
        img.data.set([c[0], c[1], c[2], clamp(a) * 255], k);
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function atmosphere(r) {
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader:
        "varying vec3 vN;varying vec3 vV;varying vec3 vW;varying vec3 vC;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);vW=(modelMatrix*vec4(position,1.)).xyz;vC=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;gl_Position=projectionMatrix*mv;}",
      fragmentShader:
        "varying vec3 vN;varying vec3 vV;varying vec3 vW;varying vec3 vC;void main(){float f=pow(1.-max(dot(vN,vV),0.),3.);float lit=smoothstep(-.35,.4,dot(normalize(vW-vC),normalize(-vW)));gl_FragColor=vec4(vec3(.35,.62,1.)*f*1.4*lit,1.);}",
    });
    m.toneMapped = false;
    const mesh = new THREE.Mesh(sphereGeo, m);
    mesh.scale.setScalar(r * 1.07);
    return mesh;
  }

  const bodies = PLANETS.map((def) => {
    const p = { def, id: def.id, D: def.D, r: RADIUS(def.D) };
    p.group = new THREE.Group();
    scene.add(p.group);
    p.tiltG = new THREE.Group();
    p.tiltG.rotation.z = def.tilt * RAD;
    p.group.add(p.tiltG);
    p.mesh = new THREE.Mesh(
      sphereGeo,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(def.orbit),
        roughness: def.id === "earth" ? 0.75 : 0.95,
        metalness: 0,
      }),
    );
    p.mesh.scale.setScalar(p.r);
    p.mesh.userData = { kind: "planet", id: def.id };
    p.tiltG.add(p.mesh);
    if (def.rings) {
      const inner = p.r * 1.28,
        outer = p.r * 2.35,
        rg = new THREE.RingGeometry(inner, outer, 160, 1);
      const uv = rg.attributes.uv,
        pos = rg.attributes.position;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner), 0.5);
      const ring = new THREE.Mesh(
        rg,
        new THREE.MeshStandardMaterial({
          map: ringTexture(),
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          roughness: 1,
          metalness: 0,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      p.tiltG.add(ring);
    }
    if (def.id === "earth") p.tiltG.add(atmosphere(p.r));
    const pts = [];
    for (let k = 0; k <= 256; k++)
      pts.push(orbitalPos({ ...def, L0: def.node + (k / 256) * 360 }, 0, new THREE.Vector3()));
    p.line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(def.orbit),
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    scene.add(p.line);
    p.moonsG = new THREE.Group();
    p.moonsG.visible = false;
    p.tiltG.add(p.moonsG);
    p.flyG = new THREE.Group();
    p.flyG.visible = false;
    p.group.add(p.flyG);
    p.texReady = false;
    p.moons = def.moons.map((m, i) => {
      const mm = {
        def: m,
        index: i,
        r: 0.16 + 0.36 * Math.sqrt(m.D / 5000),
        orbitR: LOCAL(p, m.a),
        phase: (i * 2.399 + def.id.length) % (Math.PI * 2),
      };
      mm.mesh = new THREE.Mesh(
        smallGeo,
        new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 1, metalness: 0 }),
      );
      mm.mesh.scale.setScalar(mm.r);
      mm.mesh.userData = { kind: "moon", id: def.id, index: i };
      p.moonsG.add(mm.mesh);
      const op = [];
      for (let k = 0; k <= 128; k++) {
        const t = (k / 128) * Math.PI * 2;
        op.push(new THREE.Vector3(Math.cos(t) * mm.orbitR, 0, -Math.sin(t) * mm.orbitR));
      }
      p.moonsG.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(op),
          new THREE.LineBasicMaterial({ color: 0xa8b8d0, transparent: true, opacity: 0.28, depthWrite: false }),
        ),
      );
      return mm;
    });
    return p;
  });
  const byId = Object.fromEntries(bodies.map((p) => [p.id, p]));

  // ---------- superfici, generate a passi ----------
  const TW = mobile ? 512 : 1024,
    TH = TW / 2,
    MW = mobile ? 256 : 512;
  const steps = [
    [
      "Sun",
      () => {
        sun.material.map = makeCanvasTex(MW, MW / 2, TEX.sun);
        sun.material.color.set(0xffffff);
        sun.material.needsUpdate = true;
      },
    ],
    [
      "Earth",
      () => {
        const p = byId.earth;
        p.mesh.material.map = makeCanvasTex(TW, TH, TEX.earth);
        p.mesh.material.color.set(0xffffff);
        p.mesh.material.needsUpdate = true;
        p.clouds = new THREE.Mesh(
          sphereGeo,
          new THREE.MeshStandardMaterial({
            map: makeCanvasTex(TW, TH, TEX.clouds, true),
            transparent: true,
            depthWrite: false,
            roughness: 1,
          }),
        );
        p.clouds.scale.setScalar(p.r * 1.012);
        p.tiltG.add(p.clouds);
      },
    ],
    ...["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"].map((id) => [
      PLANET_BY_ID[id].name,
      () => {
        const p = byId[id],
          big = id === "jupiter" || id === "saturn";
        p.mesh.material.map = makeCanvasTex(big ? TW : MW, big ? TH : MW / 2, texFn(id));
        p.mesh.material.color.set(0xffffff);
        p.mesh.material.needsUpdate = true;
      },
    ]),
  ];
  let stepIndex = 0,
    disposed = false;
  (function nextStep() {
    if (disposed) return;
    if (stepIndex >= steps.length) {
      onProgress?.(null);
      return;
    }
    onProgress?.(steps[stepIndex][0]);
    setTimeout(() => {
      try {
        steps[stepIndex][1]();
      } catch (e) {
        console.error(e);
      }
      stepIndex++;
      nextStep();
    }, 16);
  })();
  function ensureMoonTextures(p) {
    if (p.texReady) return;
    p.texReady = true;
    p.moons.forEach((m) => {
      m.mesh.material.map = makeCanvasTex(mobile ? 256 : 384, mobile ? 128 : 192, texFn(m.def.tex));
      m.mesh.material.color.set(0xffffff);
      m.mesh.material.needsUpdate = true;
    });
  }

  // ---------- etichette (pulsanti HTML sopra la scena) ----------
  const tags = [];
  function addTag(text, obj, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `tag ${cls || ""}`;
    b.innerHTML = '<span class="pin" aria-hidden="true"></span><span class="txt"></span>';
    b.querySelector(".txt").textContent = text;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    labels.appendChild(b);
    const tag = { el: b, obj };
    tags.push(tag);
    return tag;
  }
  function removeTag(tag) {
    tag.el.remove();
    tags.splice(tags.indexOf(tag), 1);
  }
  bodies.forEach((p) => {
    p.tag = addTag(p.def.name, p.mesh, "is-planet", () => onPlanet?.(p.id));
    p.moons.forEach((m) => {
      m.tag = addTag(m.def.name, m.mesh, "is-moon", () => onMoon?.(p.id, m.index));
      m.tag.el.hidden = true;
    });
  });

  // ---------- asteroidi ----------
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8076, roughness: 1, metalness: 0, flatShading: true });
  const recentMat = new THREE.MeshStandardMaterial({
    color: 0x6b7686,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    transparent: true,
    opacity: 0.6,
  });
  function rockGeo(seed) {
    const g = new THREE.IcosahedronGeometry(1, 2),
      pos = g.attributes.position,
      v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.multiplyScalar(1 + 0.55 * (fbm(v.x * 1.4 + seed, v.y * 1.4, v.z * 1.4, 3) - 0.5));
      v.x *= 1.25;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }
  let rocks = [];
  function setAsteroids(list) {
    rocks.forEach((r) => {
      r.parent.remove(r.mesh, r.line);
      r.mesh.geometry.dispose();
      r.line.geometry.dispose();
      r.line.material.dispose();
      removeTag(r.tag);
    });
    rocks = list
      .filter((a) => byId[a.body])
      .map((a) => {
        const p = byId[a.body],
          rnd = seeded(hashString(a.id));
        const dDisp = LOCAL(p, a.km),
          ang = rnd() * Math.PI * 2,
          el = (rnd() - 0.5) * 0.8;
        const p0 = new THREE.Vector3(Math.cos(ang) * Math.cos(el), Math.sin(el), Math.sin(ang) * Math.cos(el));
        const up = Math.abs(p0.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const dir = new THREE.Vector3()
          .crossVectors(p0, up)
          .normalize()
          .applyAxisAngle(p0, (rnd() - 0.5) * 1.2);
        const speed = dDisp * 0.75; // unità di scena al giorno: la traversata dura qualche giorno
        const mesh = new THREE.Mesh(rockGeo(rnd() * 50), rockMat);
        mesh.scale.setScalar(0.12 + 0.32 * Math.sqrt(a.D / 1000));
        mesh.userData = { kind: "ast", id: a.id };
        const c = p0.clone().multiplyScalar(dDisp);
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            c.clone().addScaledVector(dir, -speed * 3),
            c.clone().addScaledVector(dir, speed * 3),
          ]),
          new THREE.LineDashedMaterial({
            color: a.hazardous ? 0xf2a541 : 0x8fb8ff,
            dashSize: 0.35,
            gapSize: 0.3,
            transparent: true,
            opacity: a.hazardous ? 0.8 : 0.45,
            depthWrite: false,
          }),
        );
        line.computeLineDistances();
        p.flyG.add(mesh, line);
        const tag = addTag(a.name, mesh, a.hazardous ? "is-hazard" : "", () => onAsteroid?.(a.id));
        tag.el.hidden = true;
        return { a, p, parent: p.flyG, mesh, line, tag, p0, dir, dDisp, speed, recent: null };
      });
  }

  // ---------- focus, selezione, camera ----------
  let focus = null,
    selected = null;
  const tween = { active: false };
  const tmp = new THREE.Vector3(),
    tmp2 = new THREE.Vector3(),
    prevFocusPos = new THREE.Vector3(),
    wp = new THREE.Vector3();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function startTween(getAnchor, camTo, tgtTo) {
    const a = getAnchor();
    Object.assign(tween, {
      active: true,
      t0: performance.now(),
      dur: reduced ? 1 : 1400,
      getAnchor,
      camFrom: camera.position.clone().sub(a),
      tgtFrom: controls.target.clone().sub(a),
      camTo,
      tgtTo,
    });
  }
  function focusPlanet(id) {
    const p = byId[id];
    if (!p || focus === p) return;
    if (focus) {
      focus.moonsG.visible = false;
      focus.flyG.visible = false;
    }
    focus = p;
    ensureMoonTextures(p);
    p.moonsG.visible = true;
    p.flyG.visible = true;
    const now = Date.now();
    const near = rocks.filter((r) => r.p === p && r.a.t >= now && r.dDisp < p.r * 30).map((r) => r.dDisp * 1.15);
    const far = Math.max(p.r * 5, ...p.moons.filter((m) => m.orbitR < p.r * 40).map((m) => m.orbitR * 1.1), ...near);
    const dist = Math.min(far * 1.7, p.r * 45) * (mobile ? 1.4 : 1);
    p.mesh.getWorldPosition(prevFocusPos);
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (dir.y < 0.3) {
      dir.y = 0.4;
      dir.normalize();
    }
    startTween(() => p.mesh.getWorldPosition(new THREE.Vector3()), dir.multiplyScalar(dist), new THREE.Vector3());
    controls.minDistance = p.r * 1.6;
  }
  function home() {
    if (focus) {
      focus.moonsG.visible = false;
      focus.flyG.visible = false;
    }
    focus = null;
    select(null);
    controls.minDistance = 1.5;
    startTween(() => new THREE.Vector3(), HOME_CAM.clone(), new THREE.Vector3());
  }
  /** kind: "ast" con id, "moon" con {planetId, index}, null per togliere la selezione. */
  function select(kind, ref) {
    tags.forEach((t) => t.el.classList.remove("is-selected"));
    selected = null;
    if (kind === "ast") selected = rocks.find((r) => r.a.id === ref)?.tag || null;
    if (kind === "moon") selected = byId[ref.planetId]?.moons[ref.index]?.tag || null;
    selected?.el.classList.add("is-selected");
  }

  // ---------- tocchi nella scena ----------
  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2();
  let down = null;
  const onDown = (e) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    down = null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const list = bodies.map((p) => p.mesh);
    if (focus) {
      focus.moons.forEach((m) => list.push(m.mesh));
      rocks.forEach((k) => {
        if (k.p === focus && k.mesh.visible) list.push(k.mesh);
      });
    }
    const hit = ray.intersectObjects(list, false)[0];
    if (!hit) return;
    const u = hit.object.userData;
    if (u.kind === "planet") onPlanet?.(u.id);
    else if (u.kind === "moon") onMoon?.(u.id, u.index);
    else if (u.kind === "ast") onAsteroid?.(u.id);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  function resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- ciclo ----------
  let last = performance.now(),
    vox = 0,
    voy = 0,
    raf = 0;
  function frame(nowPerf) {
    const dt = Math.min(0.1, (nowPerf - last) / 1000);
    last = nowPerf;
    const now = Date.now(),
      days = (now - J2000) / DAY;
    bodies.forEach((p) => {
      orbitalPos(p.def, days, p.group.position);
      p.mesh.rotation.y = (((days * 24) / p.def.rotH) % 1) * Math.PI * 2;
      if (p.clouds) p.clouds.rotation.y = p.mesh.rotation.y * 1.04 + days * 0.02;
      if (p.moonsG.visible)
        p.moons.forEach((m) => {
          const t = m.phase + (2 * Math.PI * days) / m.def.P;
          m.mesh.position.set(Math.cos(t) * m.orbitR, 0, -Math.sin(t) * m.orbitR);
        });
      p.line.material.opacity = focus === p ? 0.55 : 0.2;
    });
    rocks.forEach((k) => {
      // in 3D solo gli asteroidi in arrivo e quelli passati nelle ultime 12 ore
      const recent = k.a.t < now && now - k.a.t <= RECENT_MS;
      const vis = focus === k.p && (k.a.t >= now || recent);
      k.mesh.visible = k.line.visible = vis;
      k.tag.el.hidden = !vis;
      if (!vis) return;
      if (k.recent !== recent) {
        k.recent = recent;
        k.mesh.material = recent ? recentMat : rockMat;
        k.line.material.color.set(recent ? 0x6b7686 : k.a.hazardous ? 0xf2a541 : 0x8fb8ff);
        k.line.material.opacity = recent ? 0.3 : k.a.hazardous ? 0.8 : 0.45;
        k.tag.el.classList.toggle("is-recent", recent);
      }
      k.mesh.position
        .copy(k.p0)
        .multiplyScalar(k.dDisp)
        .addScaledVector(k.dir, (k.speed * (now - k.a.t)) / DAY);
      k.mesh.rotation.x += dt * 0.6;
      k.mesh.rotation.y += dt * 0.4;
    });
    sun.rotation.y = (days / 25.4) * Math.PI * 2;

    if (tween.active) {
      const k = ease(Math.min(1, (nowPerf - tween.t0) / tween.dur)),
        a = tween.getAnchor();
      camera.position.copy(a).add(tmp.copy(tween.camFrom).lerp(tween.camTo, k));
      controls.target.copy(a).add(tmp2.copy(tween.tgtFrom).lerp(tween.tgtTo, k));
      if (k >= 1) tween.active = false;
      if (focus) focus.mesh.getWorldPosition(prevFocusPos);
    } else if (focus) {
      // la camera segue il pianeta mentre si muove sulla sua orbita
      focus.mesh.getWorldPosition(wp);
      tmp.copy(wp).sub(prevFocusPos);
      camera.position.add(tmp);
      controls.target.add(tmp);
      prevFocusPos.copy(wp);
    }
    controls.update();

    const w = window.innerWidth,
      h = window.innerHeight;
    bodies.forEach((p) => {
      p.tag.el.classList.toggle("is-dim", !!focus && focus !== p);
      p.moons.forEach((m) => {
        m.tag.el.hidden = focus !== p;
      });
    });
    tags.forEach((t) => {
      if (t.el.hidden) return;
      t.obj.getWorldPosition(wp);
      wp.project(camera);
      if (wp.z > 1 || wp.z < -1) {
        t.el.style.visibility = "hidden";
        return;
      }
      t.el.style.visibility = "visible";
      t.el.style.transform = `translate(${(wp.x * 0.5 + 0.5) * w}px,${(-wp.y * 0.5 + 0.5) * h}px)`;
    });

    // con la scheda aperta il pianeta va nella parte libera dello schermo:
    // sopra il foglio sul telefono, a sinistra della scheda sul computer
    let tx = 0,
      ty = 0;
    const pr = focus ? getPanelRect?.() : null;
    if (pr) {
      if (mobile) ty = h / 2 - (16 + pr.top) / 2;
      else tx = w / 2 - pr.left / 2;
    }
    const kk = reduced ? 1 : Math.min(1, dt * 5);
    vox += (tx - vox) * kk;
    voy += (ty - voy) * kk;
    if (Math.abs(vox) + Math.abs(voy) > 0.5) camera.setViewOffset(w, h, vox, voy, w, h);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    setAsteroids,
    focus: focusPlanet,
    home,
    select,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      tags.slice().forEach(removeTag);
      controls.dispose();
      renderer.dispose();
    },
  };
}
