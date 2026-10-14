// V4 page logic (home + process page). Nothing here moves the page on its own: scroll position picks the process
// step, clicks jump to it. Each step plays a short timed sequence ("phases"); the 3D part and the HTML cards both follow it.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = () => matchMedia('(max-width: 820px)').matches;
  const headH = () => $('.head').offsetHeight;
  const PART = new URL('part.js', document.currentScript.src).href;

  /* reveal on enter (content is visible without JS; the class is only added when JS runs) */
  if (!reduce && 'IntersectionObserver' in window) {
    const els = $$('.sec-head, .fam, .materials, .qcol, .teaser-copy, .teaser-view, .cap, .lt-row, .q-grid article, .person, .reach-col, .rfq, .faq-list');
    els.forEach(el => el.classList.add('reveal'));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    els.forEach(el => io.observe(el));
  }
  $$('.tl').forEach(tl => $$('li', tl).forEach((li, i) => li.style.setProperty('--i', i)));
  $$('.qparts').forEach(q => $$('i', q).forEach((p, i) => p.style.setProperty('--i', i)));

  /* header: highlight the section you're in (home page anchors only) */
  const navLinks = $$('.head nav a').filter(a => a.getAttribute('href').startsWith('#'));
  const navSecs = navLinks.map(a => $(a.getAttribute('href')));

  /* ---------- process walkthrough (process.html) ---------- */
  const view = $('.j-grid .stage-view'), visual = $('.j-visual'), steps = $$('.step'), bar = $$('.stagebar button');
  // phase start times (s) for each step's sequence
  const SEQ = { 0: [0, .5, 1.1, 1.7, 2.6], 1: [0], 2: [0, 2.4, 4.8, 6.8], 3: [0, .7, 2.0, 3.3, 4.6, 5.9, 7.2], 4: [0, 1.3, 2.4] };
  const RO = ['Drawing review', 'Swiss turning', ['Ultrasonic clean', 'Blasting', 'Second clean', 'Citric passivation · stainless', 'Anodize · through a partner'], 'Measuring every dimension', 'Label · CoC · ship'];
  let cur = -1, timers = [];
  function setPhase(s, p) {
    $$(`[data-for="${s}"] [data-p], [data-for="${s}"][data-p]`).forEach(el => el.classList.toggle('on', +el.dataset.p <= p));
    $$(`[data-for="${s}"] [data-phase]`).forEach(b => b.setAttribute('aria-pressed', +b.dataset.phase === p));
    const ro = RO[s]; if (view) $('.ro-v', view).textContent = Array.isArray(ro) ? ro[Math.max(0, p)] : ro;
    dispatchEvent(new CustomEvent('rpm:phase', { detail: { stage: s, phase: p } }));
  }
  function play(s, from = 0) {
    timers.forEach(clearTimeout); timers = [];
    if (s < 0) return;
    const seq = SEQ[s];
    if (reduce) return setPhase(s, seq.length - 1);
    setPhase(s, from);
    seq.forEach((t, k) => { if (k > from) timers.push(setTimeout(() => setPhase(s, k), (t - seq[from]) * 1000)); });
  }
  function setStage(i) {
    if (i === cur || !view) return; cur = i;
    view.dataset.stage = i;
    $$('[data-for]', view).forEach(el => el.classList.toggle('show', +el.dataset.for === i));
    steps.forEach((s, k) => s.classList.toggle('on', k === i));
    bar.forEach((b, k) => { b.removeAttribute('aria-current'); if (k === i) b.setAttribute('aria-current', 'step'); b.classList.toggle('done', k < i); });
    $('.ro-k', view).textContent = 'Step 0' + (i + 1);
    visual.style.setProperty('--prog', (i + 1) / 5);
    dispatchEvent(new CustomEvent('rpm:stage', { detail: i }));
    play(i);
  }
  const line = () => phone() ? headH() + visual.offsetHeight + 100 : innerHeight * .5;
  function pickStage() {
    if (!view) return;
    const y = line(); let i = 0;
    steps.forEach((s, k) => { if (s.getBoundingClientRect().top <= y) i = k; });
    setStage(i);
  }
  const goStep = (i, smooth = true) => {
    const top = steps[i].getBoundingClientRect().top + scrollY - (phone() ? headH() + visual.offsetHeight - 1 : headH());
    scrollTo({ top, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    setStage(i);
  };
  if (view) {
    // phones: the documents sit in the text instead of covering the part
    $$('[data-doc]', view).forEach(d => { const c = d.cloneNode(true); c.classList.add('doc-inline'); c.removeAttribute('aria-hidden'); steps[+d.dataset.doc].appendChild(c); });
    bar.forEach((b, i) => b.addEventListener('click', () => goStep(i)));
    $('.stagebar').addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return;
      const k = Math.max(0, Math.min(4, bar.indexOf(document.activeElement) + d)); bar[k].focus(); bar[k].click();
    });
    $$('[data-mat]').forEach(b => b.addEventListener('click', () => {
      $$('[data-mat]').forEach(x => x.setAttribute('aria-pressed', x === b)); dispatchEvent(new CustomEvent('rpm:mat', { detail: b.dataset.mat }));
    }));
    $$('[data-phase]').forEach(b => b.addEventListener('click', () => {
      const p = +b.dataset.phase;
      if (p < SEQ[2].length) play(2, p); else { timers.forEach(clearTimeout); timers = []; setPhase(2, p); } // anodize is a stop of its own
    }));
    $('.replay', view).addEventListener('click', () => { dispatchEvent(new Event('rpm:replay')); play(cur); });
    // arriving from a step link on the home page
    const ids = steps.map(s => s.id), h = location.hash.slice(1);
    if (ids.includes(h)) requestAnimationFrame(() => goStep(ids.indexOf(h), false));
  }

  /* scroll work, batched to one frame */
  const mbar = $('.mbar'), contact = $('#contact');
  let ticking = false;
  function onScroll() {
    ticking = false; pickStage();
    const y = scrollY + headH() + 40; let on = -1;
    navSecs.forEach((s, k) => { if (s && s.offsetTop <= y && s.offsetTop + s.offsetHeight > y) on = k; });
    navLinks.forEach((a, k) => a.classList.toggle('on', k === on));
    if (contact) { const q = contact.getBoundingClientRect(); mbar.classList.toggle('away', q.top < innerHeight && q.bottom > 0); }
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll); onScroll();

  /* contact form (prototype: validates, never sends) */
  const form = $('.rfq');
  if (form) {
    const msg = $('.form-msg'), drop = $('.drop'), fileIn = $('.drop input'), empty = drop.querySelector('span').innerHTML;
    fileIn.addEventListener('change', () => { const n = fileIn.files.length; drop.querySelector('span').innerHTML = n ? `<b>${n} file${n > 1 ? 's' : ''} attached</b> · ${[...fileIn.files].map(f => f.name).slice(0, 3).join(', ')}${n > 3 ? '…' : ''}` : empty; });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, () => drop.classList.add('over')));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = form.elements, say = (t, el) => { msg.textContent = t; el.focus(); };
      if (!f.name.value.trim()) return say('Please add your name.', f.name);
      const em = f.email.value.trim(), ph = f.phone.value.trim();
      if (!em && !ph) return say('Please add an email or a phone number so we can get back to you.', f.email);
      if (em && !/^\S+@\S+\.\S+$/.test(em)) return say('That email address looks incomplete.', f.email);
      if (!f.message.value.trim()) return say('Please tell us a little about what you need.', f.message);
      msg.textContent = 'Prototype only: nothing was sent. On the live site this goes straight to sales@rpm-precision.com.';
    });
  }

  /* 3D: only if WebGL works; load three.js after first paint, and only when a canvas is near the screen */
  const gl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  if (!gl) return;
  let mod;
  const load = () => mod || (mod = import(PART));
  const lazy = (el, fn) => el && new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); load().then(fn).catch(err => console.error(err)); } }, { rootMargin: '400px' }).observe(el);
  const start = () => {
    lazy($('.hero-part'), m => m.initHero($('.hero-part')));
    lazy(view, m => { m.initProcess(view); dispatchEvent(new CustomEvent('rpm:stage', { detail: cur })); play(cur); });
    lazy($('.teaser-view .stage-view'), m => m.initProcess($('.teaser-view .stage-view'), { loop: true }));
  };
  ('requestIdleCallback' in window) ? requestIdleCallback(start, { timeout: 800 }) : setTimeout(start, 200);
})();
