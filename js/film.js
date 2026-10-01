/* ==========================================================================
   VÉRTICE — "Do traço ao skyline"
   Um curta em motion design feito 100% com SVG + GSAP (nenhum arquivo de vídeo).
   Expõe window.Film.create(playerEl) -> { play, pause, autoplay, tl }
   ========================================================================== */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    bg: '#0b0c0e',
    blueprint: '#0d2048',
    line: '#e8eefc',
    accent: '#ff6a1a',
    ink: '#160a03',
    concrete: '#d9d3c9',
    lit: '#ffcf8a',
  };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function rng(seed) {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  }

  const fmt = (t) => {
    t = Math.max(0, t);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  };

  // WAV silencioso em loop: no iOS coloca a página na categoria "mídia",
  // que toca mesmo com o botão de silencioso ligado
  function silentWav() {
    const n = 800;
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const w = (o, str) => str.split('').forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF');
    v.setUint32(4, 36 + n, true);
    w(8, 'WAVE');
    w(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true);
    v.setUint32(28, 8000, true);
    v.setUint16(32, 1, true);
    v.setUint16(34, 8, true);
    w(36, 'data');
    v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  /* ==========================================================================
     Trilha sonora sintetizada (WebAudio) — desligada por padrão
     ========================================================================== */
  const Sound = {
    ctx: null,
    master: null,
    padGain: null,
    on: false,
    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(ctx.destination);

      // pad grave contínuo
      this.padGain = ctx.createGain();
      this.padGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      filter.Q.value = 3;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();
      [55, 82.41, 110.3, 164.8].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = f;
        o.detune.value = (i - 1.5) * 6;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.5 : 0.22;
        o.connect(g).connect(filter);
        o.start();
      });
      filter.connect(this.padGain).connect(this.master);

      // buffer de ruído
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    },
    setOn(v) {
      this.on = v;
      if (v) {
        // iPhone: sem isto o botão de silencioso corta todo o áudio do site
        try {
          if (navigator.audioSession) navigator.audioSession.type = 'playback';
        } catch (e) {}
        if (!this.keepAlive) {
          this.keepAlive = new Audio(silentWav());
          this.keepAlive.loop = true;
          this.keepAlive.setAttribute('playsinline', '');
        }
        const k = this.keepAlive.play();
        if (k && k.catch) k.catch(() => {});
      } else if (this.keepAlive) {
        this.keepAlive.pause();
      }
      if (v && !this.ensure()) return;
      if (!this.ctx) return;
      if (v && this.ctx.state !== 'running') this.ctx.resume();
    },
    pad(playing) {
      this.playing = playing;
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const level = this.ducked ? 0.025 : 0.07;
      this.padGain.gain.cancelScheduledValues(t);
      this.padGain.gain.setTargetAtTime(this.on && playing ? level : 0, t, this.ducked ? 0.15 : 0.6);
    },
    // abaixa a trilha enquanto o narrador fala
    duck(v) {
      if (this.ducked === v) return;
      this.ducked = v;
      this.pad(this.playing);
    },
    hit(power = 1) {
      if (!this.on || !this.ctx) return;
      if (this.ducked) power *= 0.55;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.32);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.75 * power, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.6);
      this.noiseBurst(0.08 * power, 1800, 0.08);
    },
    tick() {
      if (!this.on || !this.ctx) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 1400 + Math.random() * 300;
      g.gain.setValueAtTime(0.03, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.06);
    },
    noiseBurst(vol, freq, dur) {
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.02);
    },
    whoosh() {
      if (!this.on || !this.ctx) return;
      const ctx = this.ctx, t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(4200, t + 0.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + 0.65);
    },
    chord() {
      if (!this.on || !this.ctx) return;
      const ctx = this.ctx, t = ctx.currentTime;
      [220, 277.18, 329.63, 440, 554.37].forEach((fq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = i < 3 ? 'triangle' : 'sine';
        o.frequency.value = fq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06, t + 0.4 + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + 4.3);
      });
    },
  };

  /* ==========================================================================
     Narração (ElevenLabs, voz "Lucas"): um clipe por cena, tocado em
     sincronia com a linha do tempo — inclusive ao arrastar, pausar ou pular
  ========================================================================== */
  const Voice = {
    cues: [],
    cur: null,
    node: null,
    done: null,
    loading: null,
    setup(list) {
      // nenhuma fala começa antes da anterior terminar
      let end = 0;
      this.cues = list.map((c) => {
        const start = Math.max(c.t, end + 0.12);
        end = start + c.d;
        return { url: c.src, d: c.d, start, buf: null, el: null };
      });
    },
    load() {
      if (this.loading || !Sound.ctx) return this.loading || Promise.resolve();
      const ctx = Sound.ctx;
      this.gain = ctx.createGain();
      this.gain.connect(Sound.master);
      this.loading = Promise.all(
        this.cues.map((c) =>
          fetch(c.url)
            .then((r) => {
              if (!r.ok) throw new Error(r.status);
              return r.arrayBuffer();
            })
            .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
            .then((buf) => (c.buf = buf))
            // sem fetch (ex.: abrindo o arquivo direto do disco): usa <audio>
            .catch(() => {
              c.el = new Audio(c.url);
              c.el.preload = 'auto';
            })
        )
      );
      return this.loading;
    },
    position() {
      const c = this.cur;
      if (!c) return 0;
      return c.el ? c.el.currentTime : Sound.ctx.currentTime - this.t0;
    },
    stop() {
      if (this.node) {
        this.node.onended = null;
        try {
          this.node.stop();
        } catch (e) {}
        this.node.disconnect();
        this.node = null;
      }
      if (this.cur && this.cur.el) this.cur.el.pause();
      this.cur = null;
      Sound.duck(false);
    },
    finished(cue) {
      if (this.cur !== cue) return;
      this.node = null;
      this.cur = null;
      this.done = cue;
      Sound.duck(false);
    },
    sync(t, active) {
      if (!active || !Sound.on || !Sound.ctx) {
        if (this.cur) this.stop();
        return;
      }
      const cue = this.cues.find((c) => (c.buf || c.el) && t >= c.start && t < c.start + c.d);
      if (!cue || cue === this.done) {
        if (this.cur && this.cur !== cue) this.stop();
        return;
      }
      const off = t - cue.start;
      if (this.cur === cue && Math.abs(this.position() - off) < 0.3) return;
      this.stop();
      this.cur = cue;
      Sound.duck(true);
      if (cue.buf) {
        const src = Sound.ctx.createBufferSource();
        src.buffer = cue.buf;
        src.connect(this.gain);
        src.onended = () => this.finished(cue);
        src.start(0, off);
        this.node = src;
        this.t0 = Sound.ctx.currentTime - off;
      } else {
        cue.el.currentTime = off;
        cue.el.onended = () => this.finished(cue);
        const p = cue.el.play();
        if (p && p.catch) p.catch(() => {});
      }
    },
    // depois de pular na linha do tempo, uma fala já ouvida pode tocar de novo
    reset() {
      this.done = null;
    },
  };

  /* ==========================================================================
     Construção do filme
     ========================================================================== */
  function create(player) {
    const gsap = window.gsap;
    const svg = player.querySelector('.reel');
    const typeLayer = player.querySelector('.reel__type');
    const chapterEl = player.querySelector('.reel__chapter');
    const tcEl = player.querySelector('.reel__tc');
    const r = rng(42);

    let playing = false;
    let scrubbing = false;
    const fx = (fn) => () => {
      if (playing && !scrubbing) fn();
    };

    /* ---------- defs ---------- */
    const defs = el('defs', null, svg);
    const sky = el('linearGradient', { id: 'reelSky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    const skyTop = el('stop', { offset: 0 }, sky);
    const skyBot = el('stop', { offset: 1 }, sky);
    skyTop.style.stopColor = '#16233f';
    skyBot.style.stopColor = '#e9875a';
    const shade = el('linearGradient', { id: 'reelShade', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#000', 'stop-opacity': 0 }, shade);
    el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.7 }, shade);
    const vig = el('radialGradient', { id: 'reelVig', cx: 0.5, cy: 0.5, r: 0.75 }, defs);
    el('stop', { offset: 0.6, 'stop-color': '#000', 'stop-opacity': 0 }, vig);
    el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.6 }, vig);

    /* ---------- camadas ---------- */
    const bg = el('rect', { width: 1600, height: 900, fill: C.bg }, svg);
    const grid = el('g', { stroke: C.line, 'stroke-width': 1, opacity: 0 }, svg);
    for (let x = 0; x <= 1600; x += 50) el('line', { x1: x, y1: 0, x2: x, y2: 900, 'stroke-opacity': x % 200 ? 0.06 : 0.14 }, grid);
    for (let y = 0; y <= 900; y += 50) el('line', { x1: 0, y1: y, x2: 1600, y2: y, 'stroke-opacity': y % 200 ? 0.06 : 0.14 }, grid);

    /* ===== CENA 1 — planta baixa ===== */
    const CX = 800, CY = 430;
    const s1outer = el('g', null, svg);
    const s1 = el('g', { fill: 'none', stroke: C.line, 'stroke-linecap': 'square' }, s1outer);
    const extWalls = [
      'M520 250 H640', 'M700 250 H860', 'M920 250 H1080', 'M1080 250 V400', 'M1080 460 V610',
      'M1080 610 H880', 'M820 610 H520', 'M520 610 V480', 'M520 420 V250',
    ].map((d) => el('path', { d, 'stroke-width': 7 }, s1));
    const intWalls = [
      'M760 250 V390', 'M520 430 H690', 'M760 470 V610', 'M940 250 V370', 'M940 470 V610', 'M940 470 H1080',
    ].map((d) => el('path', { d, 'stroke-width': 3.5 }, s1));
    const openings = [
      'M640 245 H700 M640 255 H700', 'M860 245 H920 M860 255 H920', 'M1075 400 V460 M1085 400 V460',
      'M820 605 H880 M820 615 H880', 'M515 420 V480 M525 420 V480',
      'M760 390 A70 70 0 0 1 830 460', 'M690 430 A60 60 0 0 1 630 490', 'M940 370 A60 60 0 0 0 1000 430',
    ].map((d) => el('path', { d, 'stroke-width': 1.6 }, s1));
    const furniture = [
      'M560 280 h120 v100 h-120 z M560 280 h120 v24 h-120', 'M560 470 h90 v110 h-90 z M560 470 h90 v22 h-90',
      'M800 520 h110 v40 h-110 z M800 520 v-60 h30 v60', 'M970 290 h90 v24 h-90 z M970 290 v70 h24 v-70',
      'M985 520 h70 v60 h-70 z', 'M870 330 m-34 0 a34 34 0 1 0 68 0 a34 34 0 1 0 -68 0',
    ].map((d) => el('path', { d, 'stroke-width': 1.2, 'stroke-opacity': 0.55 }, s1));
    const dims = el('g', { 'stroke-width': 1.2, 'stroke-opacity': 0.8 }, s1);
    const dimLines = [
      'M520 200 H1080 M520 188 V212 M1080 188 V212', 'M470 250 V610 M458 250 H482 M458 610 H482',
    ].map((d) => el('path', { d }, dims));
    const txtStyle = { fill: C.line, stroke: 'none', 'font-family': 'JetBrains Mono, monospace', 'font-size': 15, 'letter-spacing': 2 };
    const dimTop = el('text', Object.assign({ x: 800, y: 188, 'text-anchor': 'middle' }, txtStyle), s1);
    dimTop.textContent = '18,40 m';
    const dimLeft = el('text', Object.assign({ x: 455, y: 430, 'text-anchor': 'middle', transform: 'rotate(-90 455 430)' }, txtStyle), s1);
    dimLeft.textContent = '12,00 m';
    const rooms = [
      ['SUÍTE', 620, 400], ['QUARTO', 610, 600], ['ESTAR · 42 m²', 850, 420], ['COZINHA', 1010, 350], ['BANHO', 1010, 600],
    ].map(([t, x, y]) => {
      const e = el('text', Object.assign({}, txtStyle, { x, y, 'font-size': 12, 'text-anchor': 'middle', 'fill-opacity': 0.7 }), s1);
      e.textContent = t;
      return e;
    });
    const compass = el('g', { transform: 'translate(1140 230)' }, svg);
    el('circle', { r: 30, fill: 'none', stroke: C.line, 'stroke-opacity': 0.6 }, compass);
    el('path', { d: 'M0 -26 L8 8 L0 2 L-8 8 Z', fill: C.accent }, compass);
    const nTxt = el('text', Object.assign({}, txtStyle, { y: -38, 'text-anchor': 'middle', 'font-size': 13 }), compass);
    nTxt.textContent = 'N';
    const sheet = el('g', { fill: 'none', stroke: C.line, 'stroke-opacity': 0.5, 'stroke-width': 1 }, svg);
    el('rect', { x: 1190, y: 770, width: 350, height: 90 }, sheet);
    el('path', { d: 'M1190 800 H1540 M1350 800 V860' }, sheet);
    [['VÉRTICE ENGENHARIA', 1200, 791], ['PROJ. 024 · TORRE AURORA', 1200, 826], ['FOLHA 01/36', 1362, 848], ['ESC 1:100', 1200, 848]].forEach(
      ([t, x, y]) => {
        const e = el('text', Object.assign({}, txtStyle, { x, y, 'font-size': 11, 'fill-opacity': 0.75 }), sheet);
        e.textContent = t;
      }
    );

    /* ===== CENA 2 — estrutura axonométrica ===== */
    const ISO = { s: 0.55, sy: 0.577, oy: 170, rot: 45 };
    const iso = (x, y) => {
      const a = (ISO.rot * Math.PI) / 180;
      const dx = x - CX, dy = y - CY;
      const rx = dx * Math.cos(a) - dy * Math.sin(a);
      const ry = dx * Math.sin(a) + dy * Math.cos(a);
      return [CX + rx * ISO.s, CY + ISO.oy + ry * ISO.s * ISO.sy];
    };
    const FH = 30, NF = 10;
    const corners = [[520, 250], [1080, 250], [1080, 610], [520, 610]].map(([x, y]) => iso(x, y));
    const s2 = el('g', { fill: 'none', stroke: C.line }, svg);
    const colPts = [];
    for (let x = 520; x <= 1080; x += 140) colPts.push([x, 250], [x, 610]);
    for (let y = 370; y < 610; y += 120) colPts.push([520, y], [1080, y]);
    const columns = colPts.map(([x, y]) => {
      const [px, py] = iso(x, y);
      return el('path', { d: `M${px.toFixed(1)} ${py.toFixed(1)} V${(py - FH * NF).toFixed(1)}`, 'stroke-width': 1.6, 'stroke-opacity': 0.75 }, s2);
    });
    const floors = [];
    for (let k = 1; k <= NF; k++) {
      const d = 'M' + corners.map(([x, y]) => `${x.toFixed(1)} ${(y - k * FH).toFixed(1)}`).join(' L') + ' Z';
      floors.push(el('path', { d, 'stroke-width': k === NF ? 2.4 : 1.6, fill: C.line, 'fill-opacity': 0 }, s2));
    }
    const coreP = [[760, 390], [940, 390], [940, 470], [760, 470]].map(([x, y]) => iso(x, y));
    const core = el('path', {
      d: coreP.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z ' +
        coreP.map(([x, y]) => `M${x.toFixed(1)} ${y.toFixed(1)} V${(y - FH * (NF + 1)).toFixed(1)}`).join(' '),
      stroke: C.accent, 'stroke-width': 2,
    }, s2);
    const callouts = [
      { x1: 985, y1: 300, x2: 1020, y2: 270, t: 'FCK 40 MPA', anchor: 'start' },
      { x1: 965, y1: 420, x2: 1020, y2: 400, t: 'AÇO CA-50 · 182 T', anchor: 'start' },
      { x1: 640, y1: 360, x2: 590, y2: 330, t: 'CARGA 1.250 KN', anchor: 'end' },
      { x1: 650, y1: 520, x2: 590, y2: 560, t: 'ESTACA Ø 60 CM', anchor: 'end' },
    ].map((c) => {
      const g = el('g', null, s2);
      const ln = el('path', { d: `M${c.x1} ${c.y1} L${c.x2} ${c.y2} H${c.x2 + (c.anchor === 'start' ? 10 : -10)}`, stroke: C.accent, 'stroke-width': 1.2 }, g);
      el('circle', { cx: c.x1, cy: c.y1, r: 3.5, fill: C.accent, stroke: 'none' }, g);
      const t = el('text', Object.assign({}, txtStyle, { x: c.x2 + (c.anchor === 'start' ? 16 : -16), y: c.y2 + 5, 'text-anchor': c.anchor, 'font-size': 14 }), g);
      t.textContent = c.t;
      return { g, ln, t, text: c.t };
    });

    /* ===== CENA 3 — elevação em time-lapse ===== */
    const s3 = el('g', { opacity: 0 }, svg);
    el('rect', { width: 1600, height: 900, fill: 'url(#reelSky)' }, s3);
    const sun = el('circle', { r: 46, fill: '#fff0d2' }, s3);
    const sunGlow = el('circle', { r: 110, fill: '#ffd59a', opacity: 0.18 }, s3);
    const hills = el('path', { d: 'M0 700 Q200 640 420 690 T860 670 T1300 690 T1600 660 V900 H0Z', fill: '#2a2f3a', opacity: 0.6 }, s3);
    const cityG = el('g', null, s3); // prédios vizinhos (cena 4)
    const bldg = el('g', null, s3); // prédio principal
    const ground = el('rect', { x: 0, y: 760, width: 1600, height: 140, fill: '#101114' }, s3);
    el('rect', { x: 0, y: 758, width: 1600, height: 3, fill: C.accent }, s3);
    const shadeRect = el('rect', { x: 0, y: 560, width: 1600, height: 340, fill: 'url(#reelShade)' }, s3);
    const BX = 650, BW = 300, FLH = 36, NB = 14;
    const bFloors = [];
    const bWindows = [];
    for (let i = 0; i < NB; i++) {
      const y = 760 - (i + 1) * FLH;
      const g = el('g', null, bldg);
      el('rect', { x: BX, y, width: BW, height: FLH, fill: '#1b1d22' }, g);
      el('rect', { x: BX - 6, y: y + FLH - 5, width: BW + 12, height: 5, fill: C.concrete }, g);
      for (let w = 0; w < 7; w++) {
        const wr = el('rect', { x: BX + 12 + w * 41, y: y + 6, width: 30, height: FLH - 16, fill: '#2c323c' }, g);
        bWindows.push(wr);
      }
      el('rect', { x: BX + 268, y, width: 5, height: FLH - 5, fill: C.accent, opacity: 0.8 }, g);
      bFloors.push(g);
    }
    const roof = el('g', null, bldg);
    el('rect', { x: BX + 10, y: 760 - NB * FLH - 40, width: BW - 20, height: 6, fill: C.concrete }, roof);
    el('path', { d: `M${BX + 20} ${760 - NB * FLH} V${760 - NB * FLH - 34} M${BX + BW - 20} ${760 - NB * FLH} V${760 - NB * FLH - 34} M${BX + BW / 2} ${760 - NB * FLH - 40} V${760 - NB * FLH - 110}`, stroke: C.concrete, 'stroke-width': 5 }, roof);
    const beacon = el('circle', { cx: BX + BW / 2, cy: 760 - NB * FLH - 112, r: 6, fill: '#ff3b1f', opacity: 0 }, roof);

    // guindaste 2D
    const crane = el('g', { stroke: C.accent, fill: 'none', 'stroke-width': 3 }, s3);
    const MX = 1060, MTOP = 130;
    el('path', { d: `M${MX} 760 V${MTOP} M${MX + 26} 760 V${MTOP}` }, crane);
    let lat = '';
    for (let y = 760; y > MTOP; y -= 26) lat += `M${MX} ${y} L${MX + 26} ${y - 26} M${MX} ${y - 26} H${MX + 26}`;
    el('path', { d: lat, 'stroke-width': 1.4 }, crane);
    const jib = el('g', null, crane);
    el('path', { d: `M${MX + 13} ${MTOP} H${MX - 520} M${MX + 13} ${MTOP - 20} H${MX - 500} M${MX - 520} ${MTOP} L${MX - 500} ${MTOP - 20} M${MX + 13} ${MTOP - 70} L${MX - 300} ${MTOP - 20} M${MX + 13} ${MTOP - 70} V${MTOP} M${MX + 13} ${MTOP} H${MX + 170} M${MX + 13} ${MTOP - 70} L${MX + 170} ${MTOP - 14}` }, jib);
    let jl = '';
    for (let x = MX; x > MX - 500; x -= 24) jl += `M${x} ${MTOP} L${x - 12} ${MTOP - 20} L${x - 24} ${MTOP}`;
    el('path', { d: jl, 'stroke-width': 1.2 }, jib);
    el('rect', { x: MX + 120, y: MTOP, width: 50, height: 40, fill: C.accent, 'fill-opacity': 0.4 }, jib);
    const hookX = BX + BW / 2;
    const cable = el('path', { d: `M${hookX} ${MTOP} V300`, 'stroke-width': 1.5, stroke: C.line, 'stroke-opacity': 0.8 }, crane);
    const hook = el('g', null, crane);
    el('rect', { x: hookX - 8, y: 0, width: 16, height: 16, fill: C.accent, stroke: 'none' }, hook);
    el('path', { d: `M${hookX - 70} 46 L${hookX} 16 L${hookX + 70} 46 M${hookX - 90} 46 H${hookX + 90}`, 'stroke-width': 2, stroke: C.line }, hook);

    const counter = el('g', Object.assign({}, txtStyle), s3);
    const cFloor = el('text', { x: 120, y: 200, 'font-size': 18, fill: C.line }, counter);
    const cDay = el('text', { x: 120, y: 230, 'font-size': 14, fill: C.line, 'fill-opacity': 0.7 }, counter);
    cFloor.textContent = 'PAVIMENTO 00/14';
    cDay.textContent = 'DIA 000';

    // cidade (cena 4)
    const stars = el('g', { opacity: 0 }, s3);
    s3.insertBefore(stars, cityG);
    for (let i = 0; i < 80; i++) el('circle', { cx: (r() * 1600).toFixed(1), cy: (r() * 420).toFixed(1), r: (r() * 1.4 + 0.4).toFixed(2), fill: '#fff', opacity: (0.3 + r() * 0.7).toFixed(2) }, stars);
    const moon = el('circle', { cx: 1240, cy: 150, r: 34, fill: '#eef2ff', opacity: 0 }, s3);
    s3.insertBefore(moon, cityG);
    const cityBuildings = [];
    const cityWindows = [];
    const spots = [];
    for (let x = -40; x < 1640; ) {
      const w = 70 + r() * 120;
      if (!(x + w > 560 && x < 1040)) spots.push([x, w]);
      x += w + 6 + r() * 20;
    }
    spots.forEach(([x, w]) => {
      const h = 140 + r() * 420;
      const g = el('g', null, cityG);
      el('rect', { x, y: 760 - h, width: w, height: h, fill: r() < 0.5 ? '#151821' : '#1b1f2a' }, g);
      for (let wy = 760 - h + 14; wy < 750; wy += 20) {
        for (let wx = x + 10; wx < x + w - 14; wx += 16) {
          if (r() < 0.55) cityWindows.push(el('rect', { x: wx, y: wy, width: 8, height: 11, fill: C.lit, opacity: 0 }, g));
        }
      }
      cityBuildings.push({ g, dist: Math.abs(x + w / 2 - 800) });
    });
    cityBuildings.sort((a, b) => a.dist - b.dist);
    const pin = el('g', { opacity: 0 }, s3);
    el('path', { d: 'M800 225 c-26 0 -44 20 -44 44 c0 32 44 70 44 70 s44 -38 44 -70 c0 -24 -18 -44 -44 -44z', fill: C.accent }, pin);
    el('circle', { cx: 800, cy: 269, r: 14, fill: C.ink }, pin);

    /* ===== CENA 5/6 — números e marca ===== */
    // cortinas de transição: laranja entra pela esquerda, escura pela direita
    const wipe = el('rect', { x: 0, y: 0, width: 1600, height: 900, fill: C.accent }, svg);
    const wipe2 = el('rect', { x: 0, y: 0, width: 1600, height: 900, fill: C.bg }, svg);
    gsap.set(wipe, { scaleX: 0, transformOrigin: '0% 50%' });
    gsap.set(wipe2, { scaleX: 0, transformOrigin: '100% 50%' });

    const s6 = el('g', { opacity: 0 }, svg);
    const logo = el('g', { transform: 'translate(800 330) scale(5.2) translate(-20 -20)' }, s6);
    const logoV = el('path', { d: 'M5 7h9l6 18 6-18h9L24 35h-8z', fill: C.line, 'fill-opacity': 0, stroke: C.line, 'stroke-width': 0.6 }, logo);
    const logoSq = el('rect', { x: 30, y: 1, width: 6, height: 6, fill: C.accent }, logo);
    const logoLine = el('path', { d: 'M560 610 H1040', stroke: C.accent, 'stroke-width': 2 }, s6);

    el('rect', { width: 1600, height: 900, fill: 'url(#reelVig)', 'pointer-events': 'none' }, svg);

    /* ---------- tipografia (HTML sobre o SVG) ---------- */
    function caption(lines, pos, extra) {
      const d = document.createElement('div');
      d.className = 'reel__txt ' + (extra || '');
      d.innerHTML = lines.map((l) => `<span class="ln" style="display:block;overflow:hidden;white-space:nowrap;padding-bottom:.06em">${l}</span>`).join('');
      Object.assign(d.style, pos);
      typeLayer.appendChild(d);
      const split = new window.SplitText(d.querySelectorAll('.ln'), { type: 'words,chars', charsClass: 'char', wordsClass: 'word' });
      d._chars = split.chars;
      return d;
    }
    const capPos = { left: '6%', bottom: '11%' };
    const cap1 = caption(['Tudo começa', 'com um <em>traço</em>.'], capPos);
    const cap2 = caption(['Depois, a', '<em>precisão</em>.'], capPos);
    const cap3 = caption(['Então, o', '<em>concreto</em>.'], capPos);
    const cap4 = caption(['E a cidade ganha', 'um novo <em>endereço</em>.'], capPos);

    function bigNum(label, dark) {
      const wrap = document.createElement('div');
      wrap.className = 'reel__txt reel__txt--center' + (dark ? ' reel__txt--dark' : '');
      wrap.style.top = '28%';
      wrap.innerHTML = `<span class="ln" style="display:block;overflow:hidden"><span class="reel__txt--big" style="display:inline-block">0</span></span><span class="ln" style="display:block;overflow:hidden"><span class="reel__txt--sub" style="display:inline-block;position:static;visibility:inherit;color:inherit;opacity:.8">${label}</span></span>`;
      typeLayer.appendChild(wrap);
      wrap._num = wrap.querySelector('.reel__txt--big');
      wrap._sub = wrap.querySelectorAll('.ln > span')[1];
      return wrap;
    }
    const n1 = bigNum('obras entregues', true);
    const n2 = bigNum('metros quadrados construídos', false);
    const n3 = bigNum('anos erguendo cidades', true);

    const brand = caption(['VÉRTICE'], { left: '0', right: '0', top: '62%', textAlign: 'center' }, 'reel__txt--center');
    brand.style.letterSpacing = '0.04em';
    const tagline = caption(['Engenharia que fica de pé.'], { left: '0', right: '0', top: '76%', textAlign: 'center' }, 'reel__txt--sub');

    /* ==========================================================================
       Linha do tempo mestre
       ========================================================================== */
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

    const textIn = (d, at) => {
      tl.set(d, { visibility: 'visible' }, at);
      tl.fromTo(d._chars, { yPercent: 115 }, { yPercent: 0, duration: 0.8, stagger: 0.022, ease: 'expo.out' }, at);
    };
    const textOut = (d, at) => {
      tl.to(d._chars, { yPercent: -115, duration: 0.45, stagger: 0.008, ease: 'expo.in' }, at);
      tl.set(d, { visibility: 'hidden' }, at + 0.7);
    };

    const CHAPTERS = [
      { t: 0, name: 'O traço' },
      { t: 5.6, name: 'O cálculo' },
      { t: 11, name: 'A obra' },
      { t: 18.2, name: 'A cidade' },
      { t: 24.2, name: 'Os números' },
      { t: 31.4, name: 'A marca' },
    ];

    // --- Cena 1 ---
    tl.call(fx(() => Sound.whoosh()), null, 0.05);
    tl.to(bg, { attr: { fill: C.blueprint }, duration: 1, ease: 'power2.inOut' }, 0);
    tl.to(grid, { attr: { opacity: 1 }, duration: 1.2 }, 0.1);
    tl.fromTo(extWalls, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.4, stagger: 0.09, ease: 'power2.inOut' }, 0.3);
    tl.fromTo(intWalls, { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: 1, stagger: 0.1, ease: 'power2.inOut' }, 1.2);
    tl.fromTo(openings, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.8, stagger: 0.06 }, 1.8);
    tl.fromTo(furniture, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.2, stagger: 0.08, ease: 'power1.inOut' }, 2.2);
    tl.fromTo(dimLines, { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: 0.9, stagger: 0.15 }, 2.0);
    tl.fromTo([dimTop, dimLeft], { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.15 }, 2.5);
    tl.to(dimTop, { duration: 0.8, scrambleText: { text: '18,40 m', chars: '0123456789,', speed: 0.6 } }, 2.5);
    tl.to(dimLeft, { duration: 0.8, scrambleText: { text: '12,00 m', chars: '0123456789,', speed: 0.6 } }, 2.65);
    tl.fromTo(rooms, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.1 }, 2.6);
    tl.fromTo(compass, { opacity: 0, rotation: -120, svgOrigin: '1140 230' }, { opacity: 1, rotation: 0, svgOrigin: '1140 230', duration: 1.6, ease: 'back.out(1.6)' }, 1.0);
    tl.fromTo(sheet, { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.8 }, 2.8);
    textIn(cap1, 0.8);
    textOut(cap1, 4.9);

    // --- Cena 2 ---
    tl.call(fx(() => Sound.whoosh()), null, 5.5);
    tl.to([...rooms, sheet, dimTop, dimLeft, dims], { opacity: 0, duration: 0.5 }, 5.5);
    tl.to(furniture, { opacity: 0, duration: 0.6 }, 5.5);
    tl.to(compass, { opacity: 0, duration: 0.4 }, 5.5);
    tl.to(s1, { rotation: ISO.rot, svgOrigin: `${CX} ${CY}`, duration: 1.4, ease: 'power3.inOut' }, 5.6);
    tl.to(s1outer, { y: ISO.oy, scaleX: ISO.s, scaleY: ISO.s * ISO.sy, svgOrigin: `${CX} ${CY}`, duration: 1.4, ease: 'power3.inOut' }, 5.6);
    tl.to([...extWalls, ...intWalls, ...openings], { attr: { 'stroke-opacity': 0.55 }, duration: 0.6 }, 6.6);
    tl.fromTo(columns, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.4, stagger: 0.03, ease: 'power2.inOut' }, 6.8);
    tl.fromTo(core, { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.8, ease: 'power2.inOut' }, 6.8);
    floors.forEach((f, k) => {
      tl.fromTo(f, { drawSVG: '0%', attr: { 'fill-opacity': 0 } }, { drawSVG: '100%', attr: { 'fill-opacity': 0.04 }, duration: 0.5, ease: 'power2.out' }, 7.0 + k * 0.17);
      tl.call(fx(() => Sound.tick()), null, 7.0 + k * 0.17);
    });
    callouts.forEach((c, i) => {
      const at = 8.3 + i * 0.25;
      tl.fromTo(c.ln, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.5 }, at);
      tl.fromTo(c.g, { opacity: 0 }, { opacity: 1, duration: 0.3 }, at);
      tl.fromTo(c.t, { opacity: 0 }, { opacity: 1, duration: 0.2 }, at + 0.25);
      tl.to(c.t, { duration: 0.7, scrambleText: { text: c.text, chars: 'upperCase', speed: 0.5 } }, at + 0.25);
    });
    textIn(cap2, 6.6);
    textOut(cap2, 10.3);

    // --- Transição para a cena 3 ---
    tl.call(fx(() => Sound.whoosh()), null, 10.6);
    tl.to(wipe, { scaleX: 1, duration: 0.5, ease: 'expo.in' }, 10.6);
    tl.set([s1outer, s2, grid, compass, sheet], { opacity: 0 }, 11.1);
    tl.set(s3, { opacity: 1 }, 11.1);
    tl.to(wipe, { scaleX: 0, duration: 0.6, ease: 'expo.out' }, 11.1);

    // --- Cena 3 ---
    tl.fromTo(sun, { opacity: 1 }, { motionPath: { path: 'M260 760 Q800 -230 1340 760' }, duration: 6.4, ease: 'none' }, 11.1);
    tl.fromTo(sunGlow, { opacity: 0.18 }, { motionPath: { path: 'M260 760 Q800 -230 1340 760' }, duration: 6.4, ease: 'none' }, 11.1);
    tl.fromTo(skyTop, { stopColor: '#16233f' }, { stopColor: '#2f6aa8', duration: 2.6, ease: 'sine.inOut' }, 11.1);
    tl.fromTo(skyBot, { stopColor: '#e9875a' }, { stopColor: '#b9d6ec', duration: 2.6, ease: 'sine.inOut' }, 11.1);
    tl.to(skyTop, { stopColor: '#221a3d', duration: 2.4, ease: 'sine.inOut' }, 14.9);
    tl.to(skyBot, { stopColor: '#ff7a3c', duration: 2.4, ease: 'sine.inOut' }, 14.9);
    tl.fromTo(hills, { attr: { fill: '#2a2f3a' } }, { attr: { fill: '#3f5a73' }, duration: 2.6 }, 11.1);
    tl.to(hills, { attr: { fill: '#2b2238' }, duration: 2.4 }, 14.9);
    tl.fromTo(crane, { y: 700 }, { y: 0, duration: 1.1, ease: 'expo.out' }, 11.3);
    tl.fromTo(counter, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 11.6);
    const floorProxy = { f: 0, d: 0 };
    tl.fromTo(floorProxy, { f: 0, d: 0 }, {
      f: NB, d: 730, duration: 4.2, ease: 'none',
      onUpdate() {
        cFloor.textContent = 'PAVIMENTO ' + String(Math.floor(floorProxy.f)).padStart(2, '0') + '/14';
        cDay.textContent = 'DIA ' + String(Math.round(floorProxy.d)).padStart(3, '0');
      },
    }, 11.9);
    bFloors.forEach((f, i) => {
      const at = 11.9 + i * 0.3;
      tl.fromTo(f, { y: -420, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: 'back.out(1.3)' }, at);
      tl.call(fx(() => (i % 3 === 0 ? Sound.hit(0.35) : Sound.tick())), null, at + 0.3);
    });
    tl.fromTo(cable, { attr: { d: `M${hookX} ${MTOP} V320` } }, { attr: { d: `M${hookX} ${MTOP} V${760 - NB * FLH - 160}` }, duration: 4.2, ease: 'none' }, 11.9);
    tl.fromTo(hook, { y: 320 }, { y: 760 - NB * FLH - 160, duration: 4.2, ease: 'none' }, 11.9);
    tl.fromTo(roof, { y: -300, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.4)' }, 16.2);
    tl.to(jib, { scaleX: -1, svgOrigin: `${MX + 13} ${MTOP}`, duration: 1.4, ease: 'power2.inOut' }, 16.4);
    tl.to([cable, hook], { opacity: 0, duration: 0.3 }, 16.4);
    tl.to(bWindows, { attr: { fill: C.lit }, duration: 0.2, stagger: { each: 0.012, from: 'random' } }, 16.6);
    textIn(cap3, 11.7);
    textOut(cap3, 17.4);

    // --- Cena 4 ---
    tl.call(fx(() => Sound.whoosh()), null, 18.0);
    tl.to(counter, { opacity: 0, duration: 0.4 }, 18.0);
    tl.to(crane, { y: 800, duration: 0.9, ease: 'expo.in' }, 18.0);
    tl.to(bldg, { scale: 0.62, svgOrigin: '800 760', duration: 1.6, ease: 'power3.inOut' }, 18.2);
    tl.to(skyTop, { stopColor: '#050816', duration: 1.6 }, 18.2);
    tl.to(skyBot, { stopColor: '#1b2246', duration: 1.6 }, 18.2);
    tl.to(sun, { opacity: 0, duration: 0.6 }, 18.2);
    tl.to(sunGlow, { opacity: 0, duration: 0.6 }, 18.2);
    tl.to(hills, { attr: { fill: '#0e1222' }, duration: 1.6 }, 18.2);
    tl.to(stars, { opacity: 1, duration: 1.4 }, 18.8);
    tl.to(moon, { opacity: 0.9, duration: 1.2 }, 19.0);
    cityBuildings.forEach((b, i) => {
      tl.fromTo(b.g, { y: 620 }, { y: 0, duration: 1.1, ease: 'expo.out' }, 18.6 + i * 0.06);
    });
    tl.to(cityWindows, { opacity: 1, duration: 0.15, stagger: { amount: 2.4, from: 'random' } }, 19.6);
    tl.fromTo(pin, { opacity: 0, y: -60 }, { opacity: 1, y: 0, duration: 0.7, ease: 'back.out(2)' }, 20.4);
    tl.call(fx(() => Sound.hit(0.6)), null, 20.5);
    tl.to(beacon, { opacity: 1, duration: 0.1, repeat: 7, yoyo: true }, 20.4);
    textIn(cap4, 18.8);
    textOut(cap4, 23.2);

    // --- Cena 5: números (espaçados para caber a narração) ---
    const N1 = 24.3;
    const GAP = 2.6;
    const N2 = N1 + GAP;
    const N3 = N2 + GAP;
    const B = N3 + 1.6; // entrada da marca
    const numIn = (n, at, to, dec, suffix) => {
      tl.set(n, { visibility: 'visible' }, at);
      tl.fromTo(n._num, { yPercent: 110, scale: 1.3 }, { yPercent: 0, scale: 1, duration: 0.6, ease: 'expo.out' }, at);
      tl.fromTo(n._sub, { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: 'expo.out' }, at + 0.15);
      const p = { v: 0 };
      tl.fromTo(p, { v: 0 }, {
        v: to, duration: 1.1, ease: 'power3.out',
        onUpdate() {
          const v = dec ? p.v.toFixed(dec).replace('.', ',') : Math.round(p.v);
          n._num.textContent = v + suffix;
        },
      }, at);
      tl.call(fx(() => Sound.hit(0.9)), null, at + 0.05);
      tl.to([n._num, n._sub], { yPercent: -110, duration: 0.4, ease: 'expo.in' }, at + GAP - 0.6);
      tl.set(n, { visibility: 'hidden' }, at + GAP - 0.15);
    };
    tl.to(wipe, { scaleX: 1, duration: 0.55, ease: 'expo.inOut' }, 23.8);
    tl.call(fx(() => Sound.whoosh()), null, 23.8);
    tl.set(s3, { opacity: 0 }, 24.4);
    numIn(n1, N1, 320, 0, '+');
    tl.call(fx(() => Sound.whoosh()), null, N2 - 0.4);
    tl.to(wipe2, { scaleX: 1, duration: 0.5, ease: 'expo.inOut' }, N2 - 0.4);
    numIn(n2, N2, 1.8, 1, ' mi');
    tl.call(fx(() => Sound.whoosh()), null, N3 - 0.4);
    tl.to(wipe2, { scaleX: 0, duration: 0.5, ease: 'expo.inOut' }, N3 - 0.4);
    numIn(n3, N3, 26, 0, '');

    // --- Cena 6: marca ---
    tl.to(wipe2, { scaleX: 1, duration: 0.5, ease: 'expo.inOut' }, B);
    tl.set(s6, { opacity: 1 }, B + 0.5);
    tl.call(fx(() => { Sound.hit(1.2); Sound.chord(); }), null, B + 0.6);
    tl.fromTo(logoV, { drawSVG: '0%', attr: { 'fill-opacity': 0 } }, { drawSVG: '100%', duration: 1.2, ease: 'power2.inOut' }, B + 0.6);
    tl.to(logoV, { attr: { 'fill-opacity': 1 }, duration: 0.6 }, B + 1.6);
    tl.fromTo(logoSq, { scale: 0, svgOrigin: '33 4' }, { scale: 1, svgOrigin: '33 4', duration: 0.6, ease: 'back.out(3)' }, B + 1.7);
    tl.fromTo(logoLine, { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: 0.9, ease: 'expo.inOut' }, B + 1.7);
    textIn(brand, B + 1.8);
    textIn(tagline, B + 2.3);
    tl.to({}, { duration: 2.4 }, B + 2.7);

    // falas do narrador: início desejado (s) e duração do clipe (s)
    Voice.setup([
      { t: 0.9, d: 1.85, src: 'assets/audio/vo-01.mp3' },
      { t: 5.8, d: 5.12, src: 'assets/audio/vo-02.mp3' },
      { t: 11.6, d: 5.22, src: 'assets/audio/vo-03.mp3' },
      { t: 18.9, d: 2.27, src: 'assets/audio/vo-04.mp3' },
      { t: N1 + 0.1, d: 2.06, src: 'assets/audio/vo-05.mp3' },
      { t: N2 + 0.1, d: 2.48, src: 'assets/audio/vo-06.mp3' },
      { t: N3 + 0.1, d: 2.14, src: 'assets/audio/vo-07.mp3' },
      { t: B + 1.0, d: 2.48, src: 'assets/audio/vo-08.mp3' },
    ]);

    const DURATION = tl.duration();

    /* ==========================================================================
       Player
       ========================================================================== */
    const playBtn = player.querySelector('[data-act="play"]');
    const bigBtn = player.querySelector('.player__big');
    const bigLabel = bigBtn.querySelector('span');
    const soundBtn = player.querySelector('[data-act="sound"]');
    const voiceBtn = player.querySelector('.player__voice');
    const restartBtn = player.querySelector('[data-act="restart"]');
    const fsBtn = player.querySelector('[data-act="fs"]');
    const track = player.querySelector('.player__track');
    const fill = player.querySelector('.player__fill');
    const thumb = player.querySelector('.player__thumb');
    const cur = player.querySelector('.player__cur');
    const dur = player.querySelector('.player__dur');
    const chaptersEl = player.querySelector('.player__chapters');
    const screen = player.querySelector('.player__screen');
    dur.textContent = fmt(DURATION);
    bigLabel.textContent = 'Assistir · ' + fmt(DURATION);

    CHAPTERS.forEach((c) => {
      if (!c.t) return;
      const s = document.createElement('span');
      s.style.left = (c.t / DURATION) * 100 + '%';
      s.dataset.name = c.name;
      chaptersEl.appendChild(s);
    });

    let chapterIdx = -1;
    let userPaused = false;

    function updateUI() {
      const t = tl.time();
      const p = t / DURATION;
      fill.style.transform = `scaleX(${p})`;
      thumb.style.left = p * 100 + '%';
      cur.textContent = fmt(t);
      track.setAttribute('aria-valuenow', Math.round(p * 100));
      const frames = Math.floor((t % 1) * 24);
      tcEl.lastChild.nodeValue = 'TC 00:00:' + String(Math.floor(t)).padStart(2, '0') + ':' + String(frames).padStart(2, '0');
      let idx = 0;
      CHAPTERS.forEach((c, i) => { if (t >= c.t - 0.001) idx = i; });
      if (idx !== chapterIdx) {
        chapterIdx = idx;
        const label = 'CENA ' + String(idx + 1).padStart(2, '0') + ' — ' + CHAPTERS[idx].name.toUpperCase();
        if (playing && !scrubbing) gsap.to(chapterEl, { duration: 0.6, scrambleText: { text: label, chars: 'upperCase', speed: 0.6 } });
        else chapterEl.textContent = label;
      }
      Voice.sync(t, playing && !scrubbing);
    }

    tl.eventCallback('onUpdate', updateUI);
    tl.eventCallback('onComplete', () => {
      setPlaying(false);
      player.classList.remove('has-started');
      bigLabel.textContent = 'Assistir de novo';
    });

    function setPlaying(v) {
      playing = v;
      player.classList.toggle('is-playing', v);
      playBtn.setAttribute('aria-label', v ? 'Pausar' : 'Reproduzir');
      Sound.pad(v);
      if (!v) Voice.stop();
    }

    function play() {
      if (tl.progress() >= 1) Voice.reset();
      if (tl.progress() >= 1) tl.restart();
      else tl.play();
      player.classList.add('has-started');
      setPlaying(true);
    }

    function pause() {
      tl.pause();
      setPlaying(false);
    }

    function toggle() {
      if (playing) {
        userPaused = true;
        pause();
      } else {
        userPaused = false;
        play();
      }
    }

    playBtn.addEventListener('click', toggle);
    bigBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userPaused = false;
      play();
    });
    screen.addEventListener('click', toggle);
    restartBtn.addEventListener('click', () => {
      userPaused = false;
      Voice.reset();
      tl.restart();
      player.classList.add('has-started');
      setPlaying(true);
    });

    function setSound(on) {
      soundBtn.setAttribute('aria-pressed', String(on));
      player.classList.toggle('has-sound', on);
      Sound.setOn(on);
      Sound.pad(playing);
      if (on) Voice.load().then(updateUI);
      else Voice.stop();
    }
    soundBtn.addEventListener('click', () => setSound(soundBtn.getAttribute('aria-pressed') !== 'true'));
    // "Assistir com narração": liga o som e recomeça do início para ouvir tudo
    voiceBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setSound(true);
      userPaused = false;
      Voice.reset();
      tl.restart();
      player.classList.add('has-started');
      setPlaying(true);
    });

    fsBtn.addEventListener('click', () => {
      const doc = document;
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      } else if (player.requestFullscreen) {
        player.requestFullscreen();
      } else if (player.webkitRequestFullscreen) {
        player.webkitRequestFullscreen();
      } else {
        player.classList.toggle('is-fs');
      }
    });

    // arrastar na linha do tempo
    let wasPlaying = false;
    const seekFromEvent = (e) => {
      const rct = track.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (e.clientX - rct.left) / rct.width));
      Voice.reset();
      tl.progress(p);
      updateUI();
    };
    track.addEventListener('pointerdown', (e) => {
      scrubbing = true;
      wasPlaying = playing;
      tl.pause();
      track.setPointerCapture(e.pointerId);
      seekFromEvent(e);
      player.classList.add('has-started');
    });
    track.addEventListener('pointermove', (e) => {
      if (scrubbing) seekFromEvent(e);
    });
    const endScrub = () => {
      if (!scrubbing) return;
      scrubbing = false;
      if (wasPlaying && tl.progress() < 1) tl.play();
      else setPlaying(false);
    };
    track.addEventListener('pointerup', endScrub);
    track.addEventListener('pointercancel', endScrub);

    player.addEventListener('keydown', (e) => {
      if (e.target !== player && e.target !== track) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        Voice.reset();
        tl.time(Math.min(DURATION, Math.max(0, tl.time() + (e.key === 'ArrowRight' ? 5 : -5))));
        updateUI();
      }
    });

    updateUI();

    return {
      tl,
      play,
      pause,
      // chamado quando o player entra/sai da tela
      autoplay(inView) {
        if (inView) {
          if (!userPaused && !playing && tl.progress() < 1) play();
        } else if (playing) {
          pause();
        }
      },
    };
  }

  window.Film = { create };
})();
