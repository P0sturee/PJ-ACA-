/* ==========================================================================
   VÉRTICE — Ilustrações geradas por código
   Skylines do hero e "fotos" dos projetos (SVG procedural, sem imagens).
   Para usar fotos reais, troque o <div class="proj__img"> por um <img>.
   ========================================================================== */
(function () {
  'use strict';

  function rng(seed) {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  }

  /* ---------- skyline do hero ---------- */
  const LAYERS = {
    far: { fill: '#16181d', lit: 0.05, minH: 120, maxH: 330, minW: 40, maxW: 110, seed: 3 },
    mid: { fill: '#111317', lit: 0.12, minH: 70, maxH: 250, minW: 50, maxW: 130, seed: 17 },
    near: { fill: '#0b0c0e', lit: 0.0, minH: 30, maxH: 110, minW: 70, maxW: 190, seed: 29 },
  };

  function skyline(svg) {
    const L = LAYERS[svg.dataset.layer];
    if (!L) return;
    const r = rng(L.seed);
    let out = '';
    let x = -20;
    while (x < 1620) {
      const w = L.minW + r() * (L.maxW - L.minW);
      const h = L.minH + r() * (L.maxH - L.minH);
      const y = 420 - h;
      out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w + 1).toFixed(1)}" height="${h + 2}" fill="${L.fill}"/>`;
      if (r() < 0.25 && h > 140) {
        out += `<rect x="${(x + w / 2 - 1).toFixed(1)}" y="${(y - 26).toFixed(1)}" width="2" height="26" fill="${L.fill}"/>`;
      }
      if (L.lit) {
        for (let wy = y + 12; wy < 410; wy += 14) {
          for (let wx = x + 8; wx < x + w - 10; wx += 12) {
            if (r() < L.lit) {
              const o = (0.25 + r() * 0.5).toFixed(2);
              out += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="5" height="7" fill="#ffc98a" opacity="${o}"/>`;
            }
          }
        }
      }
      x += w + (svg.dataset.layer === 'near' ? 0 : r() * 14);
    }
    svg.innerHTML = out;
  }

  /* ---------- "fotos" dos projetos ---------- */
  const defs = (id, stops, extra = '') =>
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
      .map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`)
      .join('')}</linearGradient>
      <filter id="${id}-n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .22 0"/></filter>
      <radialGradient id="${id}-v" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>${extra}</defs>`;

  const overlay = (id) =>
    `<rect width="400" height="500" filter="url(#${id}-n)"/><rect width="400" height="500" fill="url(#${id}-v)"/>`;

  function windows(r, x0, y0, x1, y1, cw, ch, p, color, gap = 3) {
    let s = '';
    for (let y = y0; y < y1 - ch + 0.1; y += ch) {
      for (let x = x0; x < x1 - cw + 0.1; x += cw) {
        if (r() < p) {
          s += `<rect x="${(x + gap / 2).toFixed(1)}" y="${(y + gap / 2).toFixed(1)}" width="${(cw - gap).toFixed(1)}" height="${(ch - gap).toFixed(1)}" fill="${color}" opacity="${(0.45 + r() * 0.55).toFixed(2)}"/>`;
        }
      }
    }
    return s;
  }

  const ART = {
    tower(id, r) {
      let s = defs(id, ['#1b1530', '#4a2a48', '#b4503f', '#ff9b57']);
      s += `<rect width="400" height="500" fill="url(#${id})"/>`;
      s += `<circle cx="292" cy="372" r="74" fill="#ffc58a" opacity=".9"/>`;
      s += `<rect x="0" y="372" width="400" height="128" fill="#2a1a26" opacity=".35"/>`;
      s += `<path d="M0 420h40v-70h36v40h30v-90h28v120h40V500H0z" fill="#1d1420"/>`;
      s += `<path d="M300 500V330h34v-40h30v60h36v150z" fill="#1d1420"/>`;
      s += `<rect x="140" y="70" width="128" height="430" fill="#181320"/>`;
      s += windows(r, 146, 96, 262, 470, 14.5, 18, 0.55, '#ffd49a');
      for (let x = 140; x <= 268; x += 14.5) s += `<rect x="${x}" y="78" width="2.4" height="422" fill="#b8673d" opacity=".85"/>`;
      for (let y = 96; y < 500; y += 18) s += `<rect x="140" y="${y}" width="128" height="1.6" fill="#0d0a12"/>`;
      s += `<path d="M136 70h136M136 50h136M150 50v20M258 50v20M204 50V20" stroke="#cdbfb2" stroke-width="3" fill="none"/>`;
      s += `<circle cx="204" cy="18" r="3" fill="#ff3b1f"/>`;
      s += `<rect x="0" y="470" width="400" height="30" fill="#120d14"/>`;
      return s + overlay(id);
    },
    warehouse(id, r) {
      let s = defs(id, ['#5b6f8a', '#9fb4c8', '#e6d3bd', '#f3dcc0']);
      s += `<rect width="400" height="500" fill="url(#${id})"/>`;
      s += `<ellipse cx="90" cy="120" rx="120" ry="18" fill="#fff" opacity=".25"/><ellipse cx="300" cy="80" rx="90" ry="12" fill="#fff" opacity=".2"/>`;
      s += `<path d="M0 330l60-30 70 22 90-40 80 30 100-26v60H0z" fill="#7d8a9a" opacity=".55"/>`;
      let roof = 'M-10 340';
      for (let x = -10; x < 410; x += 46) roof += `L${x + 36} 300L${x + 36} 322L${x + 46} 322`;
      s += `<path d="${roof}L410 340V430H-10z" fill="#e9e4dc"/>`;
      s += `<rect x="-10" y="340" width="420" height="90" fill="#dcd6cc"/>`;
      s += `<rect x="-10" y="340" width="420" height="10" fill="#ff6a1a"/>`;
      for (let x = 10; x < 400; x += 38) s += `<rect x="${x}" y="372" width="26" height="58" fill="#5d6470"/><rect x="${x}" y="372" width="26" height="4" fill="#3b4048"/>`;
      s += `<rect x="0" y="430" width="400" height="70" fill="#3e4148"/>`;
      for (let x = 0; x < 400; x += 40) s += `<rect x="${x + 6}" y="462" width="22" height="3" fill="#e9e4dc" opacity=".7"/>`;
      [[30, 'ffffff'], [150, 'ff6a1a'], [270, 'ffffff']].forEach(([x, c]) => {
        s += `<rect x="${x}" y="402" width="70" height="30" fill="#${c}"/><rect x="${x + 70}" y="410" width="22" height="22" fill="#2b2f36"/>`;
        s += `<circle cx="${x + 14}" cy="434" r="6" fill="#16181b"/><circle cx="${x + 58}" cy="434" r="6" fill="#16181b"/><circle cx="${x + 82}" cy="434" r="6" fill="#16181b"/>`;
      });
      return s + overlay(id);
    },
    twins(id, r) {
      let s = defs(id, ['#050a1a', '#0d1d3d', '#1d3b6e', '#2f5590']);
      s += `<rect width="400" height="500" fill="url(#${id})"/>`;
      for (let i = 0; i < 60; i++) s += `<circle cx="${(r() * 400).toFixed(1)}" cy="${(r() * 220).toFixed(1)}" r="${(r() * 1.2 + 0.3).toFixed(2)}" fill="#fff" opacity="${(r() * 0.7 + 0.2).toFixed(2)}"/>`;
      s += `<circle cx="320" cy="80" r="20" fill="#e8eefc" opacity=".9"/>`;
      s += `<path d="M0 500V380h50v-50h40v170zM330 500V350h30v-30h40v180z" fill="#081226"/>`;
      s += `<rect x="70" y="110" width="110" height="390" fill="#0c1a33"/><rect x="215" y="60" width="115" height="440" fill="#0e1f3d"/>`;
      s += windows(r, 76, 120, 176, 500, 12.5, 15, 0.6, '#dbe8ff', 3);
      s += windows(r, 221, 70, 326, 500, 13, 15, 0.6, '#fff2d6', 3);
      s += `<rect x="180" y="250" width="35" height="36" fill="#132a52"/><rect x="180" y="256" width="35" height="24" fill="#ffcf8a" opacity=".7"/>`;
      s += `<path d="M70 110h110M215 60h115" stroke="#6f96ff" stroke-width="2"/>`;
      s += `<rect x="0" y="470" width="400" height="30" fill="#050a14"/>`;
      return s + overlay(id);
    },
    terraces(id, r) {
      let s = defs(id, ['#f3a46b', '#f7c58f', '#ffe1b3', '#ffeccc']);
      s += `<rect width="400" height="500" fill="url(#${id})"/>`;
      s += `<circle cx="96" cy="150" r="50" fill="#fff4dc" opacity=".8"/>`;
      s += `<path d="M0 380q100-50 200-10t200-20V500H0z" fill="#d79a6a" opacity=".5"/>`;
      const steps = [[60, 400, 360], [90, 340, 300], [120, 280, 240], [150, 220, 180], [180, 160, 120]];
      steps.forEach(([x, w, y], i) => {
        const h = 500 - y;
        s += `<rect x="${x - 20}" y="${y}" width="${w}" height="${h}" fill="${i % 2 ? '#efe6da' : '#e6dccf'}"/>`;
        s += `<rect x="${x - 20}" y="${y}" width="${w}" height="8" fill="#b07a4f"/>`;
        s += windows(r, x - 10, y + 16, x - 20 + w - 8, y + 56, 22, 40, 0.9, '#7d6a58', 6);
        for (let k = 0; k < Math.floor(w / 26); k++) {
          const cx = x - 10 + k * 26 + r() * 8;
          s += `<circle cx="${cx.toFixed(1)}" cy="${y - 6}" r="${(8 + r() * 6).toFixed(1)}" fill="${['#6b8f45', '#58803a', '#7ea356'][k % 3]}"/>`;
        }
      });
      s += `<rect x="0" y="470" width="400" height="30" fill="#8f6a4a"/>`;
      return s + overlay(id);
    },
    bridge(id, r) {
      let s = defs(id, ['#23363d', '#4e6f78', '#a9c6c2', '#d9e6e1']);
      s += `<rect width="400" height="500" fill="url(#${id})"/>`;
      s += `<path d="M0 250q60-40 130-20t140-30 130 10V320H0z" fill="#3e5a61" opacity=".55"/>`;
      s += `<path d="M0 290q80-30 170-6t230-16V340H0z" fill="#2f4a51" opacity=".7"/>`;
      s += `<rect x="0" y="330" width="400" height="170" fill="#1f3238"/>`;
      for (let i = 0; i < 26; i++) {
        const y = 340 + r() * 150, x = r() * 400, w = 20 + r() * 80;
        s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="1.5" fill="#cfe2de" opacity="${(0.15 + r() * 0.3).toFixed(2)}"/>`;
      }
      s += `<path d="M-10 262H410V274H-10z" fill="#e8e3da"/>`;
      s += `<path d="M30 274Q200 120 370 274" stroke="#ff6a1a" stroke-width="6" fill="none"/>`;
      for (let x = 60; x <= 340; x += 28) {
        const t = (x - 30) / 340;
        const y = 274 - Math.sin(t * Math.PI) * 154 * 0.98;
        s += `<path d="M${x} 262V${y.toFixed(1)}" stroke="#e8e3da" stroke-width="2"/>`;
      }
      s += `<rect x="20" y="274" width="20" height="70" fill="#d0cabf"/><rect x="360" y="274" width="20" height="70" fill="#d0cabf"/>`;
      s += `<path d="M30 340Q200 450 370 340" stroke="#ff6a1a" stroke-width="3" fill="none" opacity=".25"/>`;
      return s + overlay(id);
    },
    retrofit(id, r) {
      let s = defs(id, ['#b0705a', '#d49a78', '#e8c39e', '#f3dcc2']);
      s += `<rect width="400" height="500" fill="url(#${id})"/>`;
      s += `<rect x="70" y="60" width="260" height="70" fill="#9fc3d1" opacity=".85"/>`;
      for (let x = 70; x <= 330; x += 26) s += `<rect x="${x}" y="60" width="2" height="70" fill="#2a2b2f"/>`;
      s += `<rect x="60" y="128" width="280" height="10" fill="#efe3d3"/>`;
      s += `<rect x="70" y="138" width="260" height="362" fill="#e9dccb"/>`;
      s += `<rect x="60" y="138" width="280" height="14" fill="#d8c8b4"/>`;
      for (let row = 0; row < 4; row++) {
        for (let c = 0; c < 5; c++) {
          const x = 88 + c * 48, y = 170 + row * 72;
          s += `<path d="M${x} ${y + 50}V${y + 16}a14 14 0 0 1 28 0V${y + 50}z" fill="#3a2f2a"/>`;
          if (r() < 0.6) s += `<path d="M${x + 3} ${y + 47}V${y + 17}a11 11 0 0 1 22 0V${y + 47}z" fill="#ffcf8a" opacity=".55"/>`;
          s += `<rect x="${x - 4}" y="${y + 50}" width="36" height="4" fill="#cdbba5"/>`;
        }
      }
      s += `<path d="M180 500V452a20 20 0 0 1 40 0V500z" fill="#2a221e"/>`;
      s += `<path d="M44 500V100M356 500V100M44 100H356M44 220H356M44 340H356M44 100L70 160M356 100L330 160" stroke="#ff6a1a" stroke-width="2" opacity=".55" fill="none"/>`;
      s += `<rect x="0" y="484" width="400" height="16" fill="#8a6650"/>`;
      return s + overlay(id);
    },
  };

  function project(el, idx) {
    const type = el.dataset.art;
    if (!ART[type]) return;
    const id = 'pa' + idx;
    el.innerHTML = `<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${ART[type](id, rng(101 + idx * 13))}</svg>`;
  }

  window.Art = { skyline, project };
})();
