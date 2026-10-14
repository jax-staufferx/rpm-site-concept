// V4 3D part: a lathe-turned bone screw.
// Hero: slow turntable, tilts toward a fine pointer.
// Process: one scene that demonstrates each step (review, Swiss turning, finishing, inspection, shipping); see initProcess.
// Canvases live inside their sections and only render while on screen.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

/* ---------- geometry shared by both scenes (units: screw is 4.44 long, axis = local y, tip at -1.82) ---------- */
const R = .32, THR0 = 1.62, THR1 = -1.62, TURNS = 15, THR_R = R + .04, TUBE = .075;
const U_TIP = -1.82, U_HEAD = 2.62, U_MID = (U_TIP + U_HEAD) / 2;
const PROF = [[0, 2.62], [.28, 2.62], [.3, 2.45], [.62, 2.42], [.74, 2.3], [.76, 2.1], [.62, 1.92], [.36, 1.86], [R, 1.7],
  [R, -1.3], [.26, -1.55], [.12, -1.75], [.02, -1.82]];
const taper = t => t > .85 ? 1 - (t - .85) / .15 * .55 : 1;
function radiusAt(u) { // outer radius at axial position u, threads included
  let r = 0;
  for (let i = 0; i < PROF.length - 1; i++) {
    const [x0, y0] = PROF[i], [x1, y1] = PROF[i + 1];
    if (u <= y0 && u >= y1) { r = y0 === y1 ? Math.max(x0, x1) : x0 + (x1 - x0) * (y0 - u) / (y0 - y1); break; }
  }
  if (u < THR0 && u > THR1) r = Math.max(r, THR_R * taper((THR0 - u) / (THR0 - THR1)) + TUBE);
  return r;
}
class Helix extends THREE.Curve {
  getPoint(t, out = new THREE.Vector3()) {
    const a = t * TURNS * Math.PI * 2, k = taper(t);
    return out.set(Math.cos(a) * THR_R * k, THR0 + (THR1 - THR0) * t, Math.sin(a) * THR_R * k);
  }
}
const BODY = new THREE.LatheGeometry(PROF.map(([x, y]) => new THREE.Vector2(x, y)), 96);
const THREAD = new THREE.TubeGeometry(new Helix(), 900, TUBE, 8, false);
const C = { ti: new THREE.Color(0xaeb3ba), ss: new THREE.Color(0xd6dade), anod: new THREE.Color(0x3a6fd8), blastLift: new THREE.Color(0xffffff) };

function makeStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), .04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fc0f5, 1.5); rim.position.set(-6, 2, -4); scene.add(rim);
  return { renderer, scene, camera };
}

function makeScrew(clip) {
  const metal = new THREE.MeshPhysicalMaterial({ color: C.ti.clone(), metalness: 1, roughness: .26, clearcoat: .3, clearcoatRoughness: .25,
    side: THREE.DoubleSide, clippingPlanes: clip ? [clip] : null });
  const wire = new THREE.MeshBasicMaterial({ color: 0x7fc0f5, wireframe: true, transparent: true, opacity: 0 });
  const spin = new THREE.Group();
  const parts = [new THREE.Mesh(BODY, metal), new THREE.Mesh(THREAD, metal)];
  const wires = [new THREE.Mesh(BODY, wire), new THREE.Mesh(THREAD, wire)];
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .06, 6), new THREE.MeshStandardMaterial({ color: 0x0b1118, metalness: .6, roughness: .6, clippingPlanes: clip ? [clip] : null }));
  hex.position.y = 2.6;
  spin.add(...parts, ...wires, hex);
  const set = (solid, w) => {
    metal.transparent = solid < .99; metal.opacity = solid; parts.forEach(p => p.visible = solid > .02); hex.visible = solid > .5;
    wire.opacity = .5 * w; wires.forEach(p => p.visible = w > .02);
  };
  return { spin, metal, set };
}

// render only while on screen; resize with the box
function runner(box, canvas, renderer, camera, tick) {
  let on = false, raf = 0, last = performance.now();
  const size = () => { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; tick(0, true); };
  new ResizeObserver(size).observe(box); size();
  const loop = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; tick(dt); if (on && !reduce) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => {
    on = e.isIntersecting; cancelAnimationFrame(raf);
    if (on) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }, { rootMargin: '100px' }).observe(box);
  return { kick: () => { if (reduce) requestAnimationFrame(t => tick(0, true)); } };
}

/* ---------------- hero ---------------- */
export function initHero(fig) {
  const canvas = fig.querySelector('canvas');
  const { renderer, scene, camera } = makeStage(canvas);
  const s = makeScrew(); s.set(1, 0); s.spin.position.y = -U_MID;
  const tilt = new THREE.Group(); tilt.add(s.spin); scene.add(tilt);
  tilt.rotation.set(.3, 0, -.62);
  camera.position.set(0, 0, 9.6); camera.lookAt(0, 0, 0);
  const p = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  let grow = reduce ? 1 : 0;
  if (fine && !reduce) addEventListener('pointermove', e => { const r = fig.getBoundingClientRect(); p.x = (e.clientX - r.left) / r.width - .5; p.y = (e.clientY - r.top) / r.height - .5; }, { passive: true });
  let first = true;
  runner(fig, canvas, renderer, camera, (dt, still) => {
    camera.updateProjectionMatrix();
    cur.x += (p.x - cur.x) * .06; cur.y += (p.y - cur.y) * .06;
    grow = Math.min(1, grow + dt * 1.2);
    const e = 1 - Math.pow(1 - grow, 3);
    s.spin.rotation.y += reduce ? 0 : dt * .45;
    tilt.rotation.x = .3 + cur.y * .4; tilt.rotation.y = cur.x * .6;
    tilt.scale.setScalar(.82 + .18 * e);
    renderer.render(scene, camera);
    if (first) { first = false; fig.classList.add('has3d'); }
  });
}

/* ---------------- process ---------------- */
// Each step follows the page's conductor (app.js): 'rpm:stage' picks the step, 'rpm:phase' moves through its sequence.
// 0 Review: wireframe, dimensions draw in one by one, then a callout gets flagged.
// 1 Machine: Swiss turning (bar feeds past a fixed tool, chips, cutoff). With {loop:true} it repeats (home-page preview).
// 2 Finish: ultrasonic tank with bubbles, blast nozzle with grit, second clean, passivation bath; anodize on request.
// 3 Inspect: jaws close on each dimension in turn, the reading counts up, the balloon stays.
// 4 Ship: the part is bagged and sealed; the label and CoC are HTML cards.
const VALUES = [1.7482, .2995, .1189, .1262, .1718];
export function initProcess(view, opts = {}) {
  const loop = !!opts.loop;
  const canvas = view.querySelector('canvas'), svg = view.querySelector('.dims');
  const { renderer, scene, camera } = makeStage(canvas);
  const TOOL_X = -1.5;
  const clip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 99); // keeps x > -constant
  const s = makeScrew(clip);
  const axis = new THREE.Group(); axis.rotation.z = Math.PI / 2; axis.add(s.spin); scene.add(axis); // local u -> world x = offset - u
  const xOf = u => axis.position.x - u;
  const faded = m => { m.transparent = true; m.opacity = 0; return m; };

  /* machine: raw bar behind the tool, the support it slides through, the tool, chips */
  const stockMat = faded(new THREE.MeshPhysicalMaterial({ color: C.ti.clone(), metalness: 1, roughness: .5, side: THREE.DoubleSide }));
  const stock = new THREE.Mesh(new THREE.CylinderGeometry(.84, .84, 10, 64), stockMat); stock.rotation.z = Math.PI / 2; stock.position.x = TOOL_X - 5; scene.add(stock);
  const dark = faded(new THREE.MeshStandardMaterial({ color: 0x1b2a3a, metalness: .7, roughness: .45 }));
  const bush = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, .8, 48, 1, true), dark); housing.rotation.z = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, .16, 16, 64), dark); ring.rotation.y = Math.PI / 2; ring.position.x = .4;
  bush.add(housing, ring); bush.position.x = TOOL_X - .62; scene.add(bush);
  const insertMat = faded(new THREE.MeshStandardMaterial({ color: 0xd9ab45, metalness: .8, roughness: .3 }));
  const tool = new THREE.Group();
  const insert = new THREE.Mesh(new THREE.ConeGeometry(.13, .3, 3), insertMat); insert.rotation.x = Math.PI;
  const holder = new THREE.Mesh(new THREE.BoxGeometry(.34, 1.3, .34), dark); holder.position.y = .8;
  tool.add(insert, holder); tool.position.set(TOOL_X + .08, 1.3, 0); scene.add(tool);

  // a small particle system used for chips, bubbles and blast grit
  function particles(n, color, size) {
    const pos = new Float32Array(n * 3).fill(-99), vel = new Float32Array(n * 3), life = new Float32Array(n);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: .9, depthWrite: false });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    let next = 0;
    return {
      mat,
      emit(p, v, l) { const i = next = (next + 1) % n; pos.set(p, i * 3); vel.set(v, i * 3); life[i] = l; },
      step(dt, g = 0, ceil = Infinity) {
        for (let i = 0; i < n; i++) {
          if (life[i] <= 0) { pos[i * 3 + 1] = -99; continue; }
          life[i] -= dt; vel[i * 3 + 1] -= g * dt;
          for (let a = 0; a < 3; a++) pos[i * 3 + a] += vel[i * 3 + a] * dt;
          if (pos[i * 3 + 1] > ceil) life[i] = 0;
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  }
  const chips = particles(70, 0xe8c27a, .07);

  /* finish: an open-topped tank, its liquid, ultrasonic bubbles; a blast nozzle and grit */
  const TW = 5.6, TH = 2.1, TD = 1.9, TB = -1.1;
  const tank = new THREE.Group(); scene.add(tank);
  const glassMat = faded(new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, roughness: .1, side: THREE.DoubleSide, depthWrite: false }));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(TW, TH, TD), glassMat); glass.position.y = TB + TH / 2;
  const edgeMat = faded(new THREE.LineBasicMaterial({ color: 0x7fc0f5 }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(TW, TH, TD)), edgeMat); edges.position.copy(glass.position);
  const liqMat = faded(new THREE.MeshPhysicalMaterial({ color: 0x4f9fe0, roughness: .15, depthWrite: false }));
  const liquid = new THREE.Mesh(new THREE.BoxGeometry(TW - .08, 1, TD - .08), liqMat);
  tank.add(glass, edges, liquid);
  const bubbles = particles(220, 0xeaf6ff, .08);
  const nozzle = new THREE.Group();
  const nozMat = faded(new THREE.MeshStandardMaterial({ color: 0x2a3a4c, metalness: .6, roughness: .4 }));
  const hose = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.6, 16), nozMat); hose.position.y = .95;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(.05, .14, .4, 16), nozMat);
  nozzle.add(hose, tip); scene.add(nozzle);
  const grit = particles(320, 0xf4f7fa, .055);
  const LIQ = { clean: new THREE.Color(0x4f9fe0), pass: new THREE.Color(0xd8cf86) };

  /* ship: a clear bag that slides over the part, then a seal */
  const bagMat = faded(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .35, side: THREE.DoubleSide, depthWrite: false }));
  const bag = new THREE.Group();
  bag.add(new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.0, 1.1), bagMat));
  const bagEdgeMat = faded(new THREE.LineBasicMaterial({ color: 0xdfe8f0 }));
  bag.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5.6, 2.0, 1.1)), bagEdgeMat));
  const sealMat = faded(new THREE.MeshStandardMaterial({ color: 0xc9d3dd, roughness: .5 }));
  const seal = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.06, 1.16), sealMat); seal.position.x = 2.62; bag.add(seal);
  bag.position.x = 10; scene.add(bag);

  const STAGES = [
    { wire: 1, solid: 0, mach: 0, camW: 6.6, camY: 0, dims: 1, spin: .3 },
    { wire: 0, solid: 1, mach: 1, camW: 8.2, camY: .1, dims: 0, spin: .35 },
    { wire: 0, solid: 1, mach: 0, camW: 7.4, camY: .25, dims: 0, spin: .35 },
    { wire: 0, solid: 1, mach: 0, camW: 6.6, camY: -.75, dims: 1, spin: .12 },
    { wire: 0, solid: 1, mach: 0, camW: 7.2, camY: -.6, dims: 0, spin: 0 },
  ];
  const st = { stage: -1, phase: 0, pt: 0, wire: 1, solid: 0, mach: 0, camW: 6.6, camX: 0, camY: 0, offset: U_MID, dims: 0,
    feed: 1, cut: 1, hold: 0, spinV: .3, rough: .26, fill: 0, tankV: 0, nozV: 0, bagV: 0, bagX: 10 };
  const look = { mat: 'ti' };
  const col = C.ti.clone(), tmp = new THREE.Color();

  function setStage(i) {
    if (i === st.stage || i < 0) return;
    st.stage = i; st.phase = 0; st.pt = 0;
    if (i === 1) { st.feed = 0; st.cut = 0; st.hold = 0; }
    if (i === 4) st.bagX = 7;
    if (reduce) { Object.assign(st, STAGES[i]); st.feed = 1; st.cut = 1; st.pt = 99; }
    r.kick();
  }
  if (!loop) {
    addEventListener('rpm:stage', e => setStage(e.detail));
    addEventListener('rpm:phase', e => { if (e.detail.stage !== st.stage) setStage(e.detail.stage); st.phase = e.detail.phase; st.pt = reduce ? 99 : 0; r.kick(); });
    addEventListener('rpm:mat', e => { look.mat = e.detail; r.kick(); });
    addEventListener('rpm:replay', () => { if (st.stage === 1) { st.feed = 0; st.cut = 0; } if (st.stage === 4) st.bagX = 7; st.pt = 0; r.kick(); });
  }

  /* SVG overlay: dimensions, balloons, measuring jaws, reading, flag — positioned from projected 3D points */
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls, parent = svg) => { const n = document.createElementNS(NS, tag); if (cls) n.setAttribute('class', cls); parent.appendChild(n); return n; };
  const lines = Array.from({ length: 9 }, () => el('line'));
  const labels = ['L', 'ØH', 'H'].map(t => { const n = el('text'); n.textContent = t; return n; });
  const bals = [1, 2, 3, 4, 5].map(n => { const g = el('g', 'bal'); const l = el('line', '', g), c = el('circle', '', g), t = el('text', '', g); c.setAttribute('r', 11); t.textContent = n; return { g, l, c, t }; });
  const jaws = [el('line', 'jaw'), el('line', 'jaw')];
  const reading = el('text', 'reading');
  const flag = el('g', 'flag'); const fl = el('line', '', flag), fr = el('rect', '', flag), ft = el('text', '', flag);
  fr.setAttribute('width', 104); fr.setAttribute('height', 26); fr.setAttribute('rx', 5); ft.textContent = '⚑ Ra 0.4 µm';
  const v = new THREE.Vector3();
  let W = 1, H = 1;
  const P = (x, y) => { v.set(x, y, 0).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  const L = (n, a, b) => { n.setAttribute('x1', a[0]); n.setAttribute('y1', a[1]); n.setAttribute('x2', b[0]); n.setAttribute('y2', b[1]); };
  const show = (n, o) => n.style.opacity = o;
  function drawDims() {
    W = view.clientWidth; H = view.clientHeight; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const u = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16; // callouts scale with the page
    svg.style.opacity = st.dims.toFixed(3);
    if (st.dims < .01) return;
    const review = st.stage === 0, insp = st.stage === 3, p = st.phase;
    const xh = xOf(U_HEAD), xt = xOf(U_TIP), xn = xOf(1.78), xr = xOf(-.4), xhb = xOf(1.86), xd = xh - .42;
    L(lines[0], P(xh, 1.12), P(xt, 1.12)); L(lines[1], P(xh, .82), P(xh, 1.24)); L(lines[2], P(xt, .1), P(xt, 1.24));
    L(lines[3], P(xd, -.76), P(xd, .76)); L(lines[4], P(xd - .1, .76), P(xh - .04, .76)); L(lines[5], P(xd - .1, -.76), P(xh - .04, -.76));
    L(lines[6], P(xh, -1.08), P(xhb, -1.08)); L(lines[7], P(xh, -.8), P(xh, -1.2)); L(lines[8], P(xhb, -.4), P(xhb, -1.2));
    const put = (t, [x, y], dx = 0, dy = 0) => { t.setAttribute('x', x + dx * u); t.setAttribute('y', y + dy * u); };
    put(labels[0], P((xh + xt) / 2, 1.12), -6, -8); put(labels[1], P(xd, 0), -30, 4); put(labels[2], P((xh + xhb) / 2, -1.08), -6, 18);
    const active = insp && p >= 1 && p <= 5 ? p - 1 : -1;
    // dimension groups: drawn one by one in review; all present in inspect, the one being measured in orange
    [[0, 1, 2], [3, 4, 5], [6, 7, 8]].forEach((g, i) => {
      const on = review ? p >= i + 1 : 1;
      g.forEach(k => { show(lines[k], on); lines[k].setAttribute('class', (review ? 'dash' : '') + (active === i ? ' act' : '')); });
      show(labels[i], review && on ? 1 : 0);
    });
    const spots = [[P((xh + xt) / 2 + .5, 1.12), [0, -22]], [P(xd, .3), [-24, 0]], [P((xh + xhb) / 2 + .2, -1.08), [0, 22]],
      [P(xn, -.33), [0, 0], P(xn, -1.45)], [P(xr, -.44), [0, 0], P(xr, -1.45)]];
    bals.forEach((b, i) => {
      const [a, d, end] = spots[i]; const c = end ? end : [a[0] + d[0] * u, a[1] + d[1] * u];
      L(b.l, a, c); b.c.setAttribute('r', 11 * u); b.c.setAttribute('cx', c[0]); b.c.setAttribute('cy', c[1]); b.t.setAttribute('x', c[0]); b.t.setAttribute('y', c[1]);
      show(b.g, insp && p >= i + 1 ? 1 : 0); b.g.classList.toggle('act', i === active);
    });
    // measuring jaws close on the active characteristic, then the reading counts up
    if (active >= 0) {
      const c = Math.min(1, st.pt / .45), gap = .75 * (1 - c * c);
      const J = [
        () => [[P(xh - gap, -.5), P(xh - gap, .5)], [P(xt + gap, -.5), P(xt + gap, .5)], P(xt + gap + .15, .2)],
        () => [[P(xOf(2.4), .76 + gap), P(xOf(2.0), .76 + gap)], [P(xOf(2.4), -.76 - gap), P(xOf(2.0), -.76 - gap)], P(xOf(2.0) + .25, 1.05 + gap)],
        () => [[P(xh - gap, .45), P(xh - gap, 1.0)], [P(xOf(1.92) + gap, .45), P(xOf(1.92) + gap, 1.0)], P(xOf(1.92) + gap + .15, 1.15)],
        () => [[P(xOf(1.86), .32 + gap), P(xOf(1.7), .32 + gap)], [P(xOf(1.86), -.32 - gap), P(xOf(1.7), -.32 - gap)], P(xOf(1.7) + .2, .62 + gap)],
        () => [[P(xOf(-.15), .44 + gap), P(xOf(-.65), .44 + gap)], [P(xOf(-.15), -.44 - gap), P(xOf(-.65), -.44 - gap)], P(xOf(-.65) + .15, .75 + gap)],
      ][active]();
      L(jaws[0], ...J[0]); L(jaws[1], ...J[1]); jaws.forEach(j => show(j, 1));
      const val = VALUES[active] * Math.min(1, Math.max(0, (st.pt - .35) / .6));
      reading.textContent = val.toFixed(4); put(reading, J[2], 6, 0); show(reading, st.pt > .3 ? 1 : 0);
    } else { jaws.forEach(j => show(j, 0)); show(reading, 0); }
    // review: one callout gets flagged at quote
    const fOn = review && p >= 4;
    show(flag, fOn ? 1 : 0);
    if (fOn) { const a = P(xOf(.5), .45), b = P(xOf(.5) + .7, 1.5); L(fl, a, b); fr.setAttribute('width', 104 * u); fr.setAttribute('height', 26 * u); fr.setAttribute('x', b[0] - 4 * u); fr.setAttribute('y', b[1] - 24 * u); put(ft, b, 6, -7); }
  }

  let first = true;
  const r = runner(view, canvas, renderer, camera, (dt, still) => {
    const T = STAGES[Math.max(0, st.stage)];
    const k = reduce ? 1 : 1 - Math.pow(.02, dt); // frame-rate independent ease
    st.pt += dt;
    for (const key of ['wire', 'solid', 'mach', 'camW', 'dims']) st[key] += (T[key] - st[key]) * k;
    st.camY += ((matchMedia('(max-width: 820px)').matches ? 0 : T.camY) - st.camY) * k; // phones show the documents in the text

    // machining clock: feed the bar out past the tool, then part off (and, as a preview, start again)
    const machining = st.stage === 1;
    if (machining && !reduce) {
      if (st.feed < 1) st.feed = Math.min(1, st.feed + dt / 4.2);
      else if (st.cut < 1) st.cut = Math.min(1, st.cut + dt / .7);
      else if (loop && (st.hold += dt) > 1.2) { st.feed = 0; st.cut = 0; st.hold = 0; }
    }
    const fedOffset = TOOL_X + U_TIP + st.feed * (U_HEAD - U_TIP) + st.cut * .55;
    st.offset = machining ? fedOffset : st.offset + (U_MID - st.offset) * k;
    axis.position.x = st.offset;
    clip.constant = machining && st.cut < 1 ? -TOOL_X : 99;
    const cutting = machining && st.feed < 1;
    st.spinV += ((cutting ? 14 : T.spin) - st.spinV) * Math.min(1, dt * 3);
    if (!reduce) s.spin.rotation.y += dt * st.spinV;
    stockMat.opacity = dark.opacity = insertMat.opacity = st.mach;
    stock.visible = bush.visible = tool.visible = st.mach > .02;
    const uAtTool = st.offset - TOOL_X;
    const ty = cutting ? radiusAt(uAtTool) + .15 : 1.3;
    tool.position.y += (ty - tool.position.y) * Math.min(1, dt * 18 || 1);
    if (cutting && !reduce) for (let n = 0; n < 2; n++)
      chips.emit([TOOL_X + .12, radiusAt(uAtTool), .1], [1 + Math.random() * 2.2, 1.5 + Math.random() * 2.5, (Math.random() - .5) * 3], .9);
    chips.step(dt, 4.9);

    // finishing: which fixture shows depends on the phase
    const fin = st.stage === 2, ph = st.phase;
    const inTank = fin && (ph === 0 || ph === 2 || ph === 3), blasting = fin && ph === 1;
    st.tankV += ((inTank ? 1 : 0) - st.tankV) * k;
    st.fill += ((inTank && st.pt > .3 ? 1 : 0) - st.fill) * (reduce ? 1 : Math.min(1, dt * 2.5));
    st.nozV += ((blasting ? 1 : 0) - st.nozV) * k;
    tank.visible = st.tankV > .02; glassMat.opacity = .07 * st.tankV; edgeMat.opacity = .7 * st.tankV;
    const lh = Math.max(.001, st.fill * (TH - .25));
    liquid.scale.y = lh; liquid.position.y = TB + lh / 2; liqMat.opacity = .32 * st.tankV;
    liqMat.color.lerp(fin && ph === 3 ? LIQ.pass : LIQ.clean, k);
    const top = TB + lh;
    if (fin && (ph === 0 || ph === 2) && st.fill > .6 && !reduce) for (let n = 0; n < 5; n++)
      bubbles.emit([(Math.random() - .5) * (TW - .4), TB + .05, (Math.random() - .5) * (TD - .4)], [(Math.random() - .5) * .1, .8 + Math.random() * 1.2, 0], 3);
    bubbles.step(dt, 0, top); bubbles.mat.opacity = .85 * st.tankV;
    const nx = Math.sin(st.pt * 1.6) * 1.8;
    nozzle.position.set(nx + .6, 1.2, 1.0); nozzle.rotation.set(-.55, 0, .3); nozMat.opacity = st.nozV; nozzle.visible = st.nozV > .02;
    if (blasting && !reduce) for (let n = 0; n < 10; n++) {
      const sx = nozzle.position.x - .08, sy = nozzle.position.y - .2, sz = nozzle.position.z - .1;
      grit.emit([sx, sy, sz], [(-.8 + (Math.random() - .5) * 1.2) * 3, (-1.6 + (Math.random() - .5) * .8) * 3, (-1.4 + (Math.random() - .5) * .8) * 3], .34);
    }
    grit.step(dt); grit.mat.opacity = .8 * st.nozV;

    // ship: bag slides over the part, then seals
    const ship = st.stage === 4;
    st.bagV += ((ship ? 1 : 0) - st.bagV) * k;
    st.bagX += ((ship ? 0 : 7) - st.bagX) * (reduce ? 1 : Math.min(1, dt * 2.2));
    bag.position.x = st.bagX; bag.visible = st.bagV > .02;
    bagMat.opacity = .16 * st.bagV; bagEdgeMat.opacity = .6 * st.bagV; sealMat.opacity = ship && st.phase >= 1 ? st.bagV : 0;

    // look: material and surface, following the finishing sequence
    const base = look.mat === 'ss' ? C.ss : C.ti;
    let rough = look.mat === 'ss' ? .18 : .26, c = base;
    const blasted = (st.stage === 2 && ph >= 1) || st.stage >= 3;
    if (blasted) { tmp.copy(base).lerp(C.blastLift, .12); c = tmp; rough = st.stage === 2 && ph === 1 ? .26 + .36 * Math.min(1, st.pt / 1.8) : .62; }
    if (st.stage === 2 && ph === 4) { c = C.anod; rough = .38; }
    col.lerp(c, k); s.metal.color.copy(col); stockMat.color.copy(base);
    st.rough += (rough - st.rough) * k; s.metal.roughness = st.rough; s.metal.clearcoat = blasted ? .05 : .3;
    s.set(st.solid, st.wire);

    // camera framing that fits the width of each step's scene
    const fovT = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const z = Math.max(st.camW / (2 * fovT * camera.aspect), 3.6 / (2 * fovT));
    st.camX += (((st.mach > .5) ? .2 : 0) - st.camX) * k;
    camera.position.set(st.camX, st.camY + z * .14, z); camera.lookAt(st.camX, st.camY, 0); camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    drawDims();
    if (first) { first = false; view.classList.add('has3d'); }
  });
  setStage(loop ? 1 : Math.max(0, +view.dataset.stage || 0));
}
