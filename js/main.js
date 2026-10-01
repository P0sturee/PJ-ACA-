/* ==========================================================================
   VÉRTICE — orquestração das animações (GSAP + ScrollTrigger + ScrollSmoother)
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Configurações do site — edite aqui ---------- */
  const CONFIG = {
    whatsapp: '5541000000000', // DDI + DDD + número, apenas dígitos
    phone: '(41) 0000-0000',
    phoneHref: '+554100000000',
    email: 'contato@vertice.eng.br',
  };

  const gsap = window.gsap;
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, DrawSVGPlugin, ScrambleTextPlugin, MotionPathPlugin);

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ---------- conteúdo dinâmico ---------- */
  $$('.js-phone').forEach((a) => {
    a.textContent = CONFIG.phone;
    a.href = 'tel:' + CONFIG.phoneHref;
  });
  $$('.js-email').forEach((a) => {
    a.textContent = CONFIG.email;
    a.href = 'mailto:' + CONFIG.email;
  });
  $$('.js-year').forEach((e) => (e.textContent = new Date().getFullYear()));

  if (window.Art) {
    $$('.skyline').forEach(window.Art.skyline);
    $$('.proj__img').forEach((e, i) => window.Art.project(e, i));
  }

  // treliças do guindaste do hero
  (function craneLattice() {
    let d = '';
    for (let y = 620; y > 150; y -= 30) d += `M300 ${y} L330 ${y - 30} M300 ${y - 30} H330 `;
    $('.hc__lattice').setAttribute('d', d);
    let j = '';
    for (let x = 315; x > 40; x -= 22) j += `M${x} 150 L${x - 11} 128 L${x - 22} 150 `;
    $('.hc__jib-lattice').setAttribute('d', j);
  })();

  /* ---------- scroll suave ---------- */
  const smoother = reduced
    ? null
    : ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.15,
        effects: true,
        smoothTouch: false,
      });
  if (smoother) smoother.paused(true);

  function scrollToTarget(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (smoother) smoother.scrollTo(el, true, 'top top');
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }

  /* ==========================================================================
     Preloader + intro
     ========================================================================== */
  function runPreloader() {
    const num = $('.preloader__num');
    const counter = { v: 0 };
    const tl = gsap.timeline();
    tl.fromTo('.preloader__draw path', { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.5, stagger: 0.12, ease: 'power2.inOut' }, 0)
      .to(counter, {
        v: 100,
        duration: 1.9,
        ease: 'power2.inOut',
        onUpdate: () => (num.textContent = String(Math.round(counter.v)).padStart(3, '0')),
      }, 0)
      .to('.preloader__bar i', { scaleX: 1, duration: 1.9, ease: 'power2.inOut' }, 0);
    return new Promise((res) => tl.eventCallback('onComplete', res));
  }

  function heroIntro() {
    const tl = gsap.timeline();
    tl.from('.hero__title .line__in', { yPercent: 115, duration: 1.4, stagger: 0.1, ease: 'expo.out' }, 0)
      .from('.hero__eyebrow', { autoAlpha: 0, y: 20, duration: 0.9 }, 0.15)
      .from('.hero__lead, .hero__actions > *', { autoAlpha: 0, y: 30, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.45)
      .from('.skyline', { yPercent: 35, autoAlpha: 0, duration: 1.8, stagger: 0.12, ease: 'expo.out' }, 0)
      .from('.hero__crane', { yPercent: 25, autoAlpha: 0, duration: 1.8, ease: 'expo.out' }, 0.25)
      .from('.hero__ghost', { autoAlpha: 0, xPercent: 6, duration: 2.2, ease: 'power2.out' }, 0.2)
      .from('.nav', { autoAlpha: 0, y: -20, duration: 1 }, 0.5)
      .from('.hero__meta, .hero__scroll', { autoAlpha: 0, y: 12, duration: 0.8, stagger: 0.08 }, 0.8);
    return tl;
  }

  const fontsReady = document.fonts
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))])
    : Promise.resolve();
  const pageLoaded = new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));

  Promise.all([fontsReady, pageLoaded, runPreloader()]).then(() => {
    initSplits();
    ScrollTrigger.refresh();
    const tl = gsap.timeline({
      onComplete: () => {
        const pre = $('.preloader');
        if (pre) pre.remove();
      },
    });
    tl.to('.preloader__inner', { yPercent: -40, autoAlpha: 0, duration: 0.6, ease: 'power3.in' })
      .to('.preloader__bar', { autoAlpha: 0, duration: 0.3 }, '<')
      .to('.preloader__panel--top', { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, '-=0.1')
      .to('.preloader__panel--bottom', { yPercent: 100, duration: 1.2, ease: 'expo.inOut' }, '<')
      .add(() => {
        document.body.classList.remove('is-loading');
        if (smoother) smoother.paused(false);
        if (location.hash && $(location.hash)) setTimeout(() => scrollToTarget(location.hash), 600);
      }, '<0.3')
      .add(heroIntro(), '-=0.75');
  });

  /* ==========================================================================
     Navegação
     ========================================================================== */
  const nav = $('.nav');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 40);
      if (document.body.classList.contains('menu-open')) return;
      const hide = self.direction === 1 && y > 500;
      gsap.to(nav, { yPercent: hide ? -110 : 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    },
  });

  gsap.to('.scroll-progress i', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
  });

  // link ativo
  $$('.nav__links a').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  });

  // menu mobile
  const burger = $('.nav__burger');
  const menu = $('.menu');
  let menuTl = null;
  function buildMenuTl() {
    const r = burger.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 20;
    return gsap
      .timeline({ paused: true })
      .set(menu, { visibility: 'visible' })
      .fromTo('.menu__bg', { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)`, duration: 0.9, ease: 'expo.inOut' })
      .fromTo('.menu__links a span', { yPercent: 110 }, { yPercent: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out' }, '-=0.35')
      .fromTo('.menu__links small', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.05 }, '<')
      .fromTo('.menu__foot', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, '-=0.5');
  }
  function setMenu(open) {
    if (!menuTl) menuTl = buildMenuTl();
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    menu.setAttribute('aria-hidden', String(!open));
    if (open) {
      gsap.to(nav, { yPercent: 0, duration: 0.3 });
      menuTl.timeScale(1).play();
    } else {
      menuTl.timeScale(1.6).reverse();
    }
    if (smoother) smoother.paused(open);
  }
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  window.addEventListener('resize', () => {
    if (menuTl && !document.body.classList.contains('menu-open')) {
      menuTl.kill();
      menuTl = null;
      gsap.set(menu, { visibility: 'hidden' });
    }
  });

  // âncoras
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2 || !$(id)) return;
    e.preventDefault();
    const wasOpen = document.body.classList.contains('menu-open');
    if (wasOpen) setMenu(false);
    setTimeout(() => scrollToTarget(id), wasOpen ? 450 : 0);
  });

  $('.footer__top-btn').addEventListener('click', () => {
    if (smoother) smoother.scrollTo(0, true);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ==========================================================================
     Hero
     ========================================================================== */
  if (!reduced) {
    // guindaste: lança girando, carrinho e gancho
    gsap.to('.hc__jib', { scaleX: 0.55, svgOrigin: '315 150', duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.fromTo('.hc__trolley', { x: 90 }, { x: 250, duration: 5.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.fromTo('.hc__cable', { attr: { d: 'M0 158 V250' } }, { attr: { d: 'M0 158 V400' }, duration: 4.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.fromTo('.hc__hook', { y: -70 }, { y: 80, duration: 4.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    // saída do hero com parallax
    gsap.to('.hero__title .line', {
      y: (i) => -60 - i * 50,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to('.hero__content', {
      autoAlpha: 0,
      ease: 'power1.in',
      scrollTrigger: { trigger: '.hero', start: '20% top', end: '85% top', scrub: true },
    });

    // parallax com o mouse
    if (finePointer) {
      const layers = [
        ['.hero__ghost', 40],
        ['.skyline--far', 14],
        ['.skyline--mid', 26],
        ['.hero__crane', 34],
        ['.skyline--near', 44],
        ['.hero__grid', 10],
      ].map(([s, a]) => [gsap.quickTo(s, 'x', { duration: 1.2, ease: 'power3' }), a]);
      $('.hero').addEventListener('pointermove', (e) => {
        const nx = e.clientX / innerWidth - 0.5;
        layers.forEach(([fn, a]) => fn(-nx * a));
      });
    }
  }

  /* ==========================================================================
     Obra 3D — gira 360° enquanto é construída
     ========================================================================== */
  const buildSec = $('.build');
  const stage = $('.build__stage');
  const canvas = $('.build__canvas');
  let building = null;
  try {
    building = window.THREE && window.Building ? window.Building.init(canvas) : null;
  } catch (err) {
    console.warn('WebGL indisponível', err);
  }
  if (!building) buildSec.classList.add('no-webgl');

  const phases = $$('.hud__phases li');
  const ticks = $$('.hud__ticks li');
  const T = {};
  $$('[data-t]').forEach((e) => (T[e.dataset.t] = e));
  const hudFill = $('.hud__fill');
  const dialFill = $('.dial__fill');
  const needle = $('.dial__needle');

  // marcações do dial
  (function dialTicks() {
    const g = $('.dial__ticks');
    let html = '';
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      const r1 = k % 9 === 0 ? 40 : 45;
      html += `<line x1="${60 + Math.sin(a) * r1}" y1="${60 - Math.cos(a) * r1}" x2="${60 + Math.sin(a) * 48}" y2="${60 - Math.cos(a) * 48}"/>`;
    }
    g.innerHTML = html;
  })();

  const phaseSplits = phases.map((li) => {
    const num = li.querySelector('.hud__num');
    num.dataset.text = num.textContent;
    gsap.set(li, { autoAlpha: 0 });
    return SplitText.create(li.querySelector('h3'), { type: 'words,chars', mask: 'words' });
  });

  let currentPhase = -1;
  function switchPhase(idx) {
    const prev = currentPhase;
    currentPhase = idx;
    if (prev >= 0) gsap.to(phases[prev], { autoAlpha: 0, duration: 0.25, overwrite: true });
    const li = phases[idx];
    // estilos aplicados direto: este código roda dentro do onUpdate de outro tween
    gsap.killTweensOf(li);
    li.style.opacity = '1';
    li.style.visibility = 'inherit';
    gsap.fromTo(phaseSplits[idx].chars, { yPercent: 115 }, { yPercent: 0, duration: 0.9, stagger: 0.03, ease: 'expo.out', overwrite: true });
    gsap.fromTo(li.querySelector('p'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.12, ease: 'power3.out', overwrite: true });
    const num = li.querySelector('.hud__num');
    gsap.to(num, { duration: 0.7, scrambleText: { text: num.dataset.text, chars: '0123456789/', speed: 0.6 }, overwrite: true });
  }

  const pad = (n, l) => String(n).padStart(l, '0');
  function updateHud(p) {
    const deg = Math.round(p * 360);
    T.rot.textContent = pad(deg, 3) + '°';
    T.rot2.textContent = deg;
    T.floors.textContent = pad(building ? building.floorsDone(p) : Math.round(p * 14), 2) + '/14';
    T.day.textContent = pad(Math.round(p * 730), 3);
    T.conc.textContent = Math.round(Math.pow(p, 0.85) * 18400).toLocaleString('pt-BR') + ' m³';
    T.pct.textContent = Math.round(p * 100);
    hudFill.style.transform = `scaleX(${p})`;
    dialFill.style.strokeDasharray = `${p} 1`;
    needle.style.transform = `rotate(${deg}deg)`;
    const d = clamp01((p - 0.86) / 0.13);
    stage.style.setProperty('--dusk', (d < 0.5 ? 4 * d * d * d : 1 - Math.pow(-2 * d + 2, 3) / 2).toFixed(3));

    let idx = phases.findIndex((li) => p >= +li.dataset.from && p < +li.dataset.to);
    if (idx < 0) idx = phases.length - 1;
    if (idx !== currentPhase) {
      switchPhase(idx);
      ticks.forEach((t, i) => {
        t.classList.toggle('is-done', i <= idx);
        t.classList.toggle('is-current', i === idx);
      });
    }
  }

  const buildProxy = { p: 0 };
  const pinLength = () => Math.round(innerHeight * (innerWidth < 768 ? 4.6 : 6));
  gsap.to(buildProxy, {
    p: 1,
    ease: 'none',
    onUpdate() {
      if (building) building.setProgress(buildProxy.p);
      updateHud(buildProxy.p);
    },
    scrollTrigger: {
      trigger: buildSec,
      start: 'top top',
      end: () => '+=' + pinLength(),
      pin: stage,
      scrub: reduced ? true : 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  updateHud(0);

  if (building) {
    ScrollTrigger.create({
      trigger: buildSec,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? building.start() : building.stop()),
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) building.stop();
      else if (ScrollTrigger.isInViewport(buildSec)) building.start();
    });
  }

  gsap.from('.hud__head, .hud__foot, .hud__dial', {
    autoAlpha: 0,
    y: 20,
    duration: 1,
    stagger: 0.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: buildSec, start: 'top 60%' },
  });

  /* ==========================================================================
     Filme
     ========================================================================== */
  const playerEl = $('.player');
  const film = window.Film ? window.Film.create(playerEl) : null;
  if (film && !reduced) {
    ScrollTrigger.create({
      trigger: playerEl,
      start: 'top 65%',
      end: 'bottom 25%',
      onToggle: (self) => film.autoplay(self.isActive),
    });
  }
  if (!reduced) {
    gsap.fromTo(playerEl, { scale: 0.86, borderRadius: 40 }, {
      scale: 1,
      borderRadius: 14,
      ease: 'none',
      scrollTrigger: { trigger: playerEl, start: 'top bottom', end: 'top 25%', scrub: true },
    });
  }

  /* ==========================================================================
     Textos: títulos em linhas, manifesto palavra a palavra, contadores
     ========================================================================== */
  function initSplits() {
    $$('.split-lines').forEach((t) => {
      SplitText.create(t, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'split-line',
        autoSplit: true,
        onSplit(self) {
          return gsap.from(self.lines, {
            yPercent: 110,
            duration: 1.2,
            stagger: 0.1,
            ease: 'expo.out',
            scrollTrigger: { trigger: t, start: 'top 88%', once: true },
          });
        },
      });
    });

    const about = SplitText.create('.about__text', { type: 'words', wordsClass: 'word' });
    gsap.fromTo(about.words, { opacity: 0.12 }, {
      opacity: 1,
      stagger: 0.06,
      ease: 'none',
      scrollTrigger: { trigger: '.about__text', start: 'top 82%', end: 'bottom 45%', scrub: true },
    });
  }

  $$('.label, .section-head__lead, .services__hint').forEach((e) => {
    gsap.from(e, { autoAlpha: 0, y: 16, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: e, start: 'top 92%', once: true } });
  });

  $$('.stat__num').forEach((el) => {
    const to = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const o = { v: 0 };
    const render = () =>
      (el.textContent = o.v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suffix);
    render();
    gsap.to(o, { v: to, duration: 2.4, ease: 'power3.out', onUpdate: render, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  gsap.from('.stat', {
    y: 40,
    autoAlpha: 0,
    duration: 1,
    stagger: 0.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.stats', start: 'top 88%', once: true },
  });

  /* ==========================================================================
     Serviços — rolagem horizontal
     ========================================================================== */
  const track = $('.services__track');
  const hDist = () => Math.max(0, track.scrollWidth - innerWidth);
  const hTween = gsap.to(track, {
    x: () => -hDist(),
    ease: 'none',
    scrollTrigger: {
      trigger: '.services',
      start: 'top top',
      end: () => '+=' + hDist(),
      pin: '.services__pin',
      scrub: reduced ? true : 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  $$('.svc').forEach((card, i) => {
    const art = card.querySelectorAll('.svc__art path');
    gsap.fromTo(art, { drawSVG: '0%' }, {
      drawSVG: '100%',
      duration: 1.6,
      stagger: 0.07,
      ease: 'power2.inOut',
      scrollTrigger:
        i < 2
          ? { trigger: '.services', start: 'top 60%', once: true }
          : { trigger: card, containerAnimation: hTween, start: 'left 88%', once: true },
    });

    if (finePointer && !reduced) {
      const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
      const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
      gsap.set(card, { transformPerspective: 1000 });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', x * 100 + '%');
        card.style.setProperty('--my', y * 100 + '%');
        ry((x - 0.5) * 10);
        rx(-(y - 0.5) * 10);
      });
      card.addEventListener('pointerleave', () => {
        rx(0);
        ry(0);
      });
    }
  });

  /* ==========================================================================
     Projetos — revelação + parallax interno
     ========================================================================== */
  $$('.proj').forEach((proj) => {
    const media = proj.querySelector('.proj__media');
    const img = proj.querySelector('.proj__img');
    gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.4,
      ease: 'expo.inOut',
      scrollTrigger: { trigger: proj, start: 'top 88%', once: true },
    });
    gsap.from(proj.querySelector('.proj__info'), {
      autoAlpha: 0,
      y: 20,
      duration: 1,
      delay: 0.3,
      ease: 'power3.out',
      scrollTrigger: { trigger: proj, start: 'top 88%', once: true },
    });
    if (!reduced) {
      gsap.fromTo(img, { yPercent: -8 }, {
        yPercent: 8,
        ease: 'none',
        scrollTrigger: { trigger: media, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  });

  const mm = gsap.matchMedia();
  mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.to('.projects__col--offset', {
      y: -160,
      ease: 'none',
      scrollTrigger: { trigger: '.projects__grid', start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* ==========================================================================
     Processo — linha que se desenha
     ========================================================================== */
  gsap.to('.process__line i', {
    scaleY: 1,
    ease: 'none',
    scrollTrigger: { trigger: '.process__list', start: 'top 62%', end: 'bottom 62%', scrub: true },
  });
  $$('.step').forEach((step) => {
    ScrollTrigger.create({
      trigger: step,
      start: 'top 62%',
      onEnter: () => step.classList.add('is-active'),
      onLeaveBack: () => step.classList.remove('is-active'),
    });
    gsap.from(step.querySelectorAll('.step__num, h3, p'), {
      autoAlpha: 0,
      y: 30,
      duration: 1,
      stagger: 0.08,
      ease: 'power3.out',
      scrollTrigger: { trigger: step, start: 'top 85%', once: true },
    });
  });

  /* ==========================================================================
     Marquee — reage à velocidade da rolagem
     ========================================================================== */
  const marquees = $$('.marquee__row').map((row) => {
    const inner = row.querySelector('.marquee__inner');
    const copies = Math.max(2, Math.ceil((innerWidth * 2) / Math.max(1, inner.offsetWidth)) + 1);
    for (let i = 1; i < copies; i++) row.appendChild(inner.cloneNode(true));
    const dir = +row.dataset.dir || 1;
    const items = row.children;
    const tw =
      dir > 0
        ? gsap.fromTo(items, { xPercent: 0 }, { xPercent: -100, duration: 26, ease: 'none', repeat: -1 })
        : gsap.fromTo(items, { xPercent: -100 }, { xPercent: 0, duration: 26, ease: 'none', repeat: -1 });
    return tw;
  });
  if (!reduced) {
    ScrollTrigger.create({
      trigger: '.marquee',
      start: 'top bottom',
      end: 'bottom top',
      onUpdate(self) {
        const v = Math.min(8, 1 + Math.abs(self.getVelocity()) / 220);
        const s = self.direction;
        marquees.forEach((tw) => {
          gsap.to(tw, { timeScale: v * s, duration: 0.25, overwrite: true });
          gsap.to(tw, { timeScale: s, duration: 1.2, delay: 0.25, ease: 'power2.out' });
        });
      },
    });
  } else {
    marquees.forEach((tw) => tw.pause());
  }

  /* ==========================================================================
     Contato — formulário que abre o WhatsApp
     ========================================================================== */
  const form = $('.form');
  const area = $('#f-area');
  const areaOut = $('#f-area-out');
  const note = $('.form__note');
  const syncArea = () => {
    const v = +area.value;
    areaOut.textContent = v.toLocaleString('pt-BR') + (v >= +area.max ? '+' : '') + ' m²';
    area.style.setProperty('--p', ((v - area.min) / (area.max - area.min)) * 100 + '%');
  };
  area.addEventListener('input', syncArea);
  syncArea();

  const tel = $('#f-tel');
  tel.addEventListener('input', () => {
    const d = tel.value.replace(/\D/g, '').slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    tel.value = out;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = $('#f-nome');
    let ok = true;
    [[nome, nome.value.trim().length >= 2], [tel, tel.value.replace(/\D/g, '').length >= 10]].forEach(([input, valid]) => {
      input.closest('.field').classList.toggle('is-invalid', !valid);
      if (!valid) {
        ok = false;
        gsap.fromTo(input.closest('.field'), { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      }
    });
    if (!ok) {
      note.textContent = 'Preencha seu nome e um WhatsApp válido.';
      note.classList.add('is-error');
      return;
    }
    note.classList.remove('is-error');
    const tipo = (form.querySelector('input[name="tipo"]:checked') || {}).value || '';
    const msg = $('#f-msg').value.trim();
    const text = [
      `Olá! Meu nome é ${nome.value.trim()}.`,
      `Quero um orçamento para uma obra *${tipo}* de aproximadamente *${areaOut.textContent}*.`,
      msg && `Sobre o projeto: ${msg}`,
      `Meu WhatsApp: ${tel.value}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    note.textContent = 'Abrimos o WhatsApp com a sua mensagem. Obrigado!';
  });

  /* ==========================================================================
     Rodapé
     ========================================================================== */
  gsap.from('.footer__brand span', {
    yPercent: 100,
    duration: 1.3,
    stagger: 0.06,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.footer__brand', start: 'top 98%', once: true },
  });

  /* ==========================================================================
     Cursor customizado + botões magnéticos
     ========================================================================== */
  if (finePointer) {
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    const label = $('.cursor__label');
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
    window.addEventListener('pointermove', (e) => {
      cursor.classList.remove('is-hidden');
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
    });
    document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('pointerenter', () => cursor.classList.remove('is-hidden'));
    document.addEventListener('pointerover', (e) => {
      const t = e.target;
      const lab = t.closest('[data-cursor]');
      const onCanvas = t.closest('.build__canvas');
      const onScreen = t.closest('.player__screen');
      const text = lab ? lab.dataset.cursor : onCanvas ? 'Arraste' : onScreen ? 'Play / Pausa' : '';
      cursor.classList.toggle('is-label', !!text);
      if (text) label.textContent = text;
      cursor.classList.toggle('is-hover', !text && !!t.closest('a, button, .chips label, input, textarea, .player__track'));
    });

    if (!reduced) {
      $$('.magnetic').forEach((el) => {
        const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
        const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
          yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
        });
        el.addEventListener('pointerleave', () => {
          xTo(0);
          yTo(0);
        });
      });
    }
  }

  // recalcula tudo depois que as fontes chegam (métricas mudam)
  fontsReady.then(() => ScrollTrigger.refresh());
})();
