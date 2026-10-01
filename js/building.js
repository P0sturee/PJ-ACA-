/* ==========================================================================
   VÉRTICE — Obra 3D
   Um edifício que gira 360° enquanto é construído, guiado pela rolagem.
   Expõe window.Building.init(canvas) -> controller
   ========================================================================== */
(function () {
  'use strict';

  const T = window.THREE;

  /* ---------- utilitários ---------- */
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const seg = (p, a, b) => clamp01((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    back: (t) => {
      const c = 1.9;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
  };

  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  /* ---------- dimensões do edifício ---------- */
  const PODIUM_FLOORS = 3;
  const TOWER_FLOORS = 11;
  const FLOORS = PODIUM_FLOORS + TOWER_FLOORS;
  const FH_P = 1.15; // pé-direito do embasamento
  const FH_T = 0.95; // pé-direito da torre
  const SLAB = 0.16;
  const floorY = (i) =>
    i <= PODIUM_FLOORS ? i * FH_P : PODIUM_FLOORS * FH_P + (i - PODIUM_FLOORS) * FH_T;
  const floorH = (i) => (i < PODIUM_FLOORS ? FH_P : FH_T);
  const TOP = floorY(FLOORS);

  // envelopes (limites da laje)
  const PODIUM = { x0: -5.3, x1: 5.3, z0: -4.3, z1: 4.3 };
  const TOWER = { x0: -5.3, x1: 1.3, z0: -4.3, z1: 2.3 };
  const CORE = { x: -2, z: -1, w: 2.4, d: 2.0 };
  const CRANE = { x: 6.4, z: -5.9 };

  const PODIUM_COLS_X = [-5, -3, -1, 1, 3, 5];
  const PODIUM_COLS_Z = [-4, -2, 0, 2, 4];
  const TOWER_COLS_X = [-5, -3, -1, 1];
  const TOWER_COLS_Z = [-4, -2, 0, 2];

  /* ---------- cronograma (progresso 0 → 1) ---------- */
  const T_STRUCT = (i) => 0.14 + i * 0.03;
  const D_STRUCT = 0.028;
  const T_FACADE = (i) => 0.29 + i * 0.026;
  const D_FACADE = 0.05;
  const T_CROWN = 0.64;
  const T_CLEAN = 0.8;
  const T_GREEN = 0.84;
  const T_LIGHTS = 0.9;

  /* ---------- geometrias base (pivô na base) ---------- */
  const BOX = new T.BoxGeometry(1, 1, 1);
  BOX.translate(0, 0.5, 0);
  const CENTER_BOX = new T.BoxGeometry(1, 1, 1);

  const dummy = new T.Object3D();
  const UP = new T.Vector3(0, 1, 0);

  function placeItem(it, t, out) {
    let sx = it.sx, sy = it.sy, sz = it.sz;
    let x = it.x, y = it.y, z = it.z;
    if (t <= 0 || out >= 1) {
      sx = sy = sz = 0;
    } else {
      const m = it.m || 'grow';
      if (m === 'grow') {
        sy *= ease.out(t);
      } else if (m === 'hang') {
        const e = ease.out(t);
        y += sy * (1 - e);
        sy *= e;
      } else if (m === 'drop') {
        const e = ease.out(t);
        y += (1 - e) * 2.4;
        const s = lerp(0.8, 1, e);
        sx *= s;
        sz *= s;
      } else if (m === 'rise') {
        y -= (1 - ease.out(t)) * (sy + 0.5);
      } else if (m === 'pop') {
        const e = ease.back(t);
        sx *= e;
        sy *= e;
        sz *= e;
      }
      if (out > 0) {
        const o = 1 - ease.in(out);
        sx *= o;
        sy *= o;
        sz *= o;
      }
    }
    dummy.position.set(x, y, z);
    dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    dummy.scale.set(sx || 1e-4, sy || 1e-4, sz || 1e-4);
    dummy.updateMatrix();
  }

  // Um "kit" = InstancedMesh cujas peças surgem de acordo com o progresso
  function makeKit(geo, mat, items, opts = {}) {
    const mesh = new T.InstancedMesh(geo, mat, items.length);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = opts.receive !== false;
    mesh.frustumCulled = false;
    const c = new T.Color();
    items.forEach((it, i) => {
      if (it.color) mesh.setColorAt(i, c.set(it.color));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return {
      mesh,
      update(p) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const t = seg(p, it.a, it.a + (it.d || 0.03));
          const out = it.oa != null ? seg(p, it.oa, it.oa + (it.od || 0.03)) : 0;
          placeItem(it, t, out);
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      },
    };
  }

  // Peças estáticas definidas por pontos (treliças do guindaste)
  function beamsMesh(list, mat, thickness) {
    const mesh = new T.InstancedMesh(BOX, mat, list.length);
    const m = new T.Matrix4();
    const q = new T.Quaternion();
    const s = new T.Vector3();
    const dir = new T.Vector3();
    list.forEach((b, i) => {
      const a = new T.Vector3(...b[0]);
      const e = new T.Vector3(...b[1]);
      dir.subVectors(e, a);
      const len = dir.length();
      q.setFromUnitVectors(UP, dir.normalize());
      const th = b[2] || thickness;
      s.set(th, len, th);
      m.compose(a, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /* ---------- texturas procedurais ---------- */
  function windowTexture(cols, rows, density, warm) {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#07080a';
    g.fillRect(0, 0, cv.width, cv.height);
    const cw = cv.width / cols;
    const rh = cv.height / rows;
    const tones = warm
      ? ['#ffd49a', '#ffe7c2', '#fff4e0', '#ffc877', '#ffdcae']
      : ['#e8f1ff', '#fff4e0', '#ffe2b5', '#d6e6ff'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() < density) {
          g.globalAlpha = 0.55 + rand() * 0.45;
          g.fillStyle = tones[Math.floor(rand() * tones.length)];
          g.fillRect(c * cw + 2, r * rh + 3, cw - 4, rh - 6);
        }
      }
    }
    g.globalAlpha = 1;
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    return tex;
  }

  function radialAlphaTexture() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, '#fff');
    grd.addColorStop(0.46, '#fff');
    grd.addColorStop(1, '#000');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new T.CanvasTexture(cv);
  }

  /* ==========================================================================
     Construção da cena
     ========================================================================== */
  function buildScene(isMobile) {
    const scene = new T.Scene();
    const site = new T.Group(); // tudo que gira
    scene.add(site);

    const mats = {
      concrete: new T.MeshStandardMaterial({ color: '#cfc8bd', roughness: 0.86 }),
      core: new T.MeshStandardMaterial({ color: '#bdb5a9', roughness: 0.9 }),
      footing: new T.MeshStandardMaterial({ color: '#8f887d', roughness: 0.95 }),
      glass: new T.MeshStandardMaterial({
        color: '#8fb3c7',
        metalness: 0.92,
        roughness: 0.06,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        envMapIntensity: 1.6,
      }),
      mullion: new T.MeshStandardMaterial({ color: '#2a2b2f', metalness: 0.6, roughness: 0.35 }),
      fin: new T.MeshStandardMaterial({ color: '#a8603a', roughness: 0.6, metalness: 0.1 }),
      crane: new T.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.45, metalness: 0.3 }),
      steel: new T.MeshStandardMaterial({ color: '#34363b', roughness: 0.5, metalness: 0.7 }),
      white: new T.MeshStandardMaterial({ color: '#ece8e1', roughness: 0.6 }),
      fence: new T.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.7 }),
      dirt: new T.MeshStandardMaterial({ color: '#5a4636', roughness: 1, flatShading: true }),
      plot: new T.MeshStandardMaterial({ color: '#4a3b2f', roughness: 1 }),
      lawn: new T.MeshStandardMaterial({ color: '#5d8a3f', roughness: 0.95 }),
      trunk: new T.MeshStandardMaterial({ color: '#5b4331', roughness: 1 }),
      leaf: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }),
      pool: new T.MeshStandardMaterial({
        color: '#39b6d6',
        roughness: 0.08,
        metalness: 0.2,
        emissive: '#0b5f7a',
        emissiveIntensity: 0.25,
      }),
      lamp: new T.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffcf8a', emissiveIntensity: 0 }),
      beacon: new T.MeshStandardMaterial({ color: '#ff3b1f', emissive: '#ff2a00', emissiveIntensity: 0 }),
    };

    const kits = [];
    const add = (kit) => {
      kits.push(kit);
      site.add(kit.mesh);
      return kit;
    };

    /* ----- chão, grade e anel giratório ----- */
    const ground = new T.Mesh(
      new T.CircleGeometry(30, 96),
      new T.MeshStandardMaterial({
        color: '#15171a',
        roughness: 1,
        transparent: true,
        alphaMap: radialAlphaTexture(),
        depthWrite: true,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    site.add(ground);

    const grid = new T.GridHelper(40, 40, '#4d7cff', '#4d7cff');
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    grid.material.depthWrite = false;
    grid.position.y = 0.01;
    site.add(grid);

    const plot = new T.Mesh(new T.PlaneGeometry(17.4, 15.4), mats.plot);
    plot.rotation.x = -Math.PI / 2;
    plot.position.set(0, 0.012, 0.2);
    plot.receiveShadow = true;
    site.add(plot);
    const plotDirt = new T.Color('#4a3b2f');
    const plotPaved = new T.Color('#9a948a');

    // anel com marcações de grau (reforça o giro de 360°)
    const ringItems = [];
    for (let k = 0; k < 72; k++) {
      const ang = (k / 72) * Math.PI * 2;
      const major = k % 6 === 0;
      const r = 12.8;
      ringItems.push({
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        y: 0.02,
        sx: major ? 0.9 : 0.45,
        sy: 0.02,
        sz: major ? 0.07 : 0.04,
        ry: -ang,
        a: 0,
        d: 0.0001,
      });
    }
    const ringMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 });
    const ring = makeKit(BOX, ringMat, ringItems, { cast: false, receive: false });
    add(ring);
    const ringLine = new T.Mesh(
      new T.RingGeometry(12.18, 12.22, 128),
      new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, side: T.DoubleSide })
    );
    ringLine.rotation.x = -Math.PI / 2;
    ringLine.position.y = 0.02;
    site.add(ringLine);

    /* ----- fundação ----- */
    const mound = new T.Mesh(new T.ConeGeometry(2.6, 1.4, 7, 1), mats.dirt);
    mound.position.set(-6.6, 0, 5.4);
    mound.castShadow = mound.receiveShadow = true;
    site.add(mound);
    const mound2 = mound.clone();
    mound2.position.set(-4.4, 0, 6.2);
    mound2.scale.set(0.6, 0.6, 0.6);
    site.add(mound2);

    const footings = [];
    let k = 0;
    PODIUM_COLS_X.forEach((x) =>
      PODIUM_COLS_Z.forEach((z) => {
        footings.push({ x, z, y: -0.32, sx: 0.95, sy: 0.34, sz: 0.95, m: 'rise', a: 0.025 + k * 0.0022, d: 0.03 });
        k++;
      })
    );
    add(makeKit(BOX, mats.footing, footings));

    /* ----- estrutura: pilares, lajes e núcleo ----- */
    const columns = [];
    const slabs = [];
    const core = [];
    for (let i = 0; i < FLOORS; i++) {
      const y = floorY(i) + SLAB;
      const h = floorH(i) - SLAB;
      const t0 = T_STRUCT(i);
      const podium = i < PODIUM_FLOORS;
      let n = 0;
      if (podium) {
        PODIUM_COLS_X.forEach((x) =>
          PODIUM_COLS_Z.forEach((z) => {
            columns.push({ x, z, y, sx: 0.3, sy: h, sz: 0.3, a: t0 + n++ * 0.0005, d: D_STRUCT });
          })
        );
      } else {
        TOWER_COLS_X.forEach((x) =>
          TOWER_COLS_Z.forEach((z) => {
            const edge = x === -5 || x === 1 || z === -4 || z === 2;
            if (edge) columns.push({ x, z, y, sx: 0.3, sy: h, sz: 0.3, a: t0 + n++ * 0.0008, d: D_STRUCT });
          })
        );
      }
      core.push({
        x: CORE.x,
        z: CORE.z,
        y: floorY(i),
        sx: CORE.w,
        sy: floorH(i) + 0.001,
        sz: CORE.d,
        a: t0 - 0.014,
        d: 0.03,
      });
    }
    // lajes: 0 = piso térreo, 1..14 = sobre cada pavimento
    for (let i = 0; i <= FLOORS; i++) {
      const env = i <= PODIUM_FLOORS ? PODIUM : TOWER;
      const a = i === 0 ? 0.105 : T_STRUCT(i - 1) + 0.02;
      slabs.push({
        x: (env.x0 + env.x1) / 2,
        z: (env.z0 + env.z1) / 2,
        y: floorY(i),
        sx: env.x1 - env.x0,
        sy: SLAB,
        sz: env.z1 - env.z0,
        m: i === 0 ? 'grow' : 'drop',
        a,
        d: 0.03,
      });
    }
    // casa de máquinas no topo do núcleo
    core.push({ x: CORE.x, z: CORE.z, y: TOP, sx: CORE.w, sy: 1.25, sz: CORE.d, a: 0.6, d: 0.03 });
    add(makeKit(BOX, mats.concrete, columns));
    add(makeKit(BOX, mats.concrete, slabs));
    add(makeKit(BOX, mats.core, core));

    /* ----- fechamento: vidro, montantes, brises ----- */
    const glass = [];
    const mullions = [];
    const fins = [];
    const interiors = [];
    const texWarm = windowTexture(22, 3, 0.72, true);
    const texShop = windowTexture(10, 2, 0.95, true);

    for (let i = 0; i < FLOORS; i++) {
      const podium = i < PODIUM_FLOORS;
      const env = podium ? PODIUM : TOWER;
      const x0 = env.x0 + 0.14, x1 = env.x1 - 0.14, z0 = env.z0 + 0.14, z1 = env.z1 - 0.14;
      const y = floorY(i) + SLAB;
      const h = floorH(i) - SLAB;
      const a = T_FACADE(i);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const w = x1 - x0, dpt = z1 - z0;

      // 4 panos de vidro
      glass.push({ x: cx, z: z0, y, sx: w, sy: h, sz: 0.04, a, d: D_FACADE });
      glass.push({ x: x1, z: cz, y, sx: 0.04, sy: h, sz: dpt, a: a + 0.004, d: D_FACADE });
      glass.push({ x: cx, z: z1, y, sx: w, sy: h, sz: 0.04, a: a + 0.008, d: D_FACADE });
      glass.push({ x: x0, z: cz, y, sx: 0.04, sy: h, sz: dpt, a: a + 0.012, d: D_FACADE });

      // montantes finos em todos os lados
      const step = podium ? (i === 0 ? 1.3 : 0.9) : 0.66;
      const sides = [
        { axis: 'x', fixed: z0, from: x0, to: x1, out: -1, name: 'S' },
        { axis: 'z', fixed: x1, from: z0, to: z1, out: 1, name: 'E' },
        { axis: 'x', fixed: z1, from: x0, to: x1, out: 1, name: 'N' },
        { axis: 'z', fixed: x0, from: z0, to: z1, out: -1, name: 'W' },
      ];
      sides.forEach((s, si) => {
        const len = s.to - s.from;
        const n = Math.max(2, Math.round(len / step));
        for (let j = 0; j <= n; j++) {
          const pos = s.from + (len * j) / n;
          const deepFin = !podium && (s.name === 'S' || s.name === 'E') && j > 0 && j < n;
          const depth = deepFin ? 0.42 : 0.1;
          const off = s.out * (depth / 2 + 0.02);
          const item = {
            x: s.axis === 'x' ? pos : s.fixed + off,
            z: s.axis === 'x' ? s.fixed + off : pos,
            y,
            sx: s.axis === 'x' ? (deepFin ? 0.07 : 0.05) : depth,
            sy: h,
            sz: s.axis === 'x' ? depth : deepFin ? 0.07 : 0.05,
            m: deepFin ? 'hang' : 'grow',
            a: a + 0.01 + si * 0.004 + (deepFin ? 0.03 : 0),
            d: D_FACADE,
          };
          (deepFin ? fins : mullions).push(item);
        }
        // faixas horizontais no embasamento (peitoris em madeira)
        if (podium && i > 0) {
          fins.push({
            x: s.axis === 'x' ? (s.from + s.to) / 2 : s.fixed + s.out * 0.09,
            z: s.axis === 'x' ? s.fixed + s.out * 0.09 : (s.from + s.to) / 2,
            y,
            sx: s.axis === 'x' ? len + 0.1 : 0.12,
            sy: 0.26,
            sz: s.axis === 'x' ? 0.12 : len + 0.1,
            a: a + 0.03 + si * 0.004,
            d: D_FACADE,
          });
        }
      });

      // volume interno iluminado (acende na entrega)
      const tex = (podium ? texShop : texWarm).clone();
      tex.needsUpdate = true;
      tex.offset.set(rand(), rand());
      tex.repeat.set(podium ? 1.4 : 1, 1);
      const mat = new T.MeshStandardMaterial({
        color: '#111316',
        roughness: 0.9,
        emissive: '#ffffff',
        emissiveMap: tex,
        emissiveIntensity: 0,
      });
      const box = new T.Mesh(BOX, mat);
      box.position.set(cx, y + 0.02, cz);
      box.userData = { sx: w - 0.5, sy: h - 0.06, sz: dpt - 0.5, a, floor: i };
      box.scale.set(1e-4, 1e-4, 1e-4);
      box.receiveShadow = true;
      site.add(box);
      interiors.push(box);
    }

    /* ----- coroamento ----- */
    const crown = [];
    const CH = 1.5;
    TOWER_COLS_X.forEach((x) =>
      TOWER_COLS_Z.forEach((z) => {
        const edge = x === -5 || x === 1 || z === -4 || z === 2;
        if (edge) crown.push({ x, z, y: TOP + SLAB, sx: 0.28, sy: CH, sz: 0.28, a: T_CROWN + rand() * 0.02, d: 0.04 });
      })
    );
    const cyTop = TOP + SLAB + CH;
    const tw = TOWER.x1 - TOWER.x0, td = TOWER.z1 - TOWER.z0;
    const tcx = (TOWER.x0 + TOWER.x1) / 2, tcz = (TOWER.z0 + TOWER.z1) / 2;
    crown.push({ x: tcx, z: TOWER.z0 + 0.15, y: cyTop, sx: tw, sy: 0.3, sz: 0.3, m: 'drop', a: T_CROWN + 0.04, d: 0.04 });
    crown.push({ x: tcx, z: TOWER.z1 - 0.15, y: cyTop, sx: tw, sy: 0.3, sz: 0.3, m: 'drop', a: T_CROWN + 0.05, d: 0.04 });
    crown.push({ x: TOWER.x0 + 0.15, z: tcz, y: cyTop, sx: 0.3, sy: 0.3, sz: td, m: 'drop', a: T_CROWN + 0.06, d: 0.04 });
    crown.push({ x: TOWER.x1 - 0.15, z: tcz, y: cyTop, sx: 0.3, sy: 0.3, sz: td, m: 'drop', a: T_CROWN + 0.07, d: 0.04 });
    // pergolado de lâminas no topo
    for (let j = 0; j < 9; j++) {
      crown.push({
        x: TOWER.x0 + 0.5 + (j * (tw - 1)) / 8,
        z: tcz,
        y: cyTop + 0.3,
        sx: 0.1,
        sy: 0.12,
        sz: td - 0.3,
        m: 'drop',
        a: T_CROWN + 0.08 + j * 0.003,
        d: 0.03,
      });
    }
    // parapeito do embasamento (terraço)
    crown.push({ x: 3.3, z: PODIUM.z0 + 0.06, y: floorY(3) + SLAB, sx: 4, sy: 0.35, sz: 0.1, a: 0.62, d: 0.03 });
    crown.push({ x: PODIUM.x1 - 0.06, z: 0, y: floorY(3) + SLAB, sx: 0.1, sy: 0.35, sz: 8.6, a: 0.625, d: 0.03 });
    crown.push({ x: 0, z: PODIUM.z1 - 0.06, y: floorY(3) + SLAB, sx: 10.6, sy: 0.35, sz: 0.1, a: 0.63, d: 0.03 });
    add(makeKit(BOX, mats.glass, glass, { cast: false, receive: false }));
    add(makeKit(BOX, mats.mullion, mullions));
    add(makeKit(BOX, mats.fin, fins));
    add(makeKit(BOX, mats.concrete, crown));

    // equipamentos de cobertura + antena
    const roofEq = [
      { x: -4.2, z: 1.3, y: TOP + SLAB, sx: 0.9, sy: 0.5, sz: 0.7, m: 'pop', a: 0.7, d: 0.03, color: '#9aa0a8' },
      { x: 0.2, z: 1.2, y: TOP + SLAB, sx: 0.8, sy: 0.45, sz: 0.8, m: 'pop', a: 0.71, d: 0.03, color: '#9aa0a8' },
      { x: 0.2, z: -3.2, y: TOP + SLAB, sx: 1.0, sy: 0.4, sz: 0.6, m: 'pop', a: 0.72, d: 0.03, color: '#8a9098' },
      { x: CORE.x, z: CORE.z, y: TOP + 1.25, sx: 0.08, sy: 2.4, sz: 0.08, a: 0.73, d: 0.04, color: '#d9d3c9' },
    ];
    add(makeKit(BOX, mats.white, roofEq));
    const beacon = new T.Mesh(new T.SphereGeometry(0.11, 12, 8), mats.beacon);
    beacon.position.set(CORE.x, TOP + 1.25 + 2.45, CORE.z);
    beacon.visible = false;
    site.add(beacon);

    /* ----- canteiro: tapume, contêineres, materiais ----- */
    const fence = [];
    const FX0 = -8.4, FX1 = 8.4, FZ0 = -7.4, FZ1 = 7.8;
    let f = 0;
    const pushFence = (x, z, horiz, len) => {
      fence.push({
        x, z, y: 0, sx: horiz ? len : 0.06, sy: 0.55, sz: horiz ? 0.06 : len,
        a: 0.004 + f * 0.0012, d: 0.02, oa: T_CLEAN + f * 0.0012, od: 0.02,
      });
      f++;
    };
    for (let x = FX0 + 1; x <= FX1 - 1 + 0.01; x += 2) pushFence(x, FZ0, true, 1.96);
    for (let z = FZ0 + 1; z <= FZ1 - 1 + 0.01; z += 2.03) pushFence(FX1, z, false, 2);
    for (let x = FX1 - 1; x >= FX0 + 1 - 0.01; x -= 2) pushFence(x, FZ1, true, 1.96);
    for (let z = FZ1 - 1; z >= FZ0 + 1 - 0.01; z -= 2.03) pushFence(FX0, z, false, 2);
    add(makeKit(BOX, mats.fence, fence));

    const siteGear = [
      { x: -6.6, z: -5.6, y: 0, sx: 2.4, sy: 0.95, sz: 1.0, m: 'drop', a: 0.02, d: 0.03, oa: T_CLEAN + 0.02, color: '#ece8e1' },
      { x: -6.6, z: -5.6, y: 0.97, sx: 2.4, sy: 0.95, sz: 1.0, m: 'drop', a: 0.035, d: 0.03, oa: T_CLEAN + 0.02, color: '#ff6a1a' },
      { x: -3.6, z: -6.3, y: 0, sx: 2.4, sy: 0.95, sz: 1.0, m: 'drop', a: 0.05, d: 0.03, oa: T_CLEAN + 0.025, color: '#dcd7cf' },
      { x: 7.0, z: 3.0, y: 0, sx: 1.6, sy: 0.25, sz: 0.9, m: 'pop', a: 0.06, d: 0.03, oa: T_CLEAN + 0.03, color: '#6b4f3a' },
      { x: 7.0, z: 4.4, y: 0, sx: 1.4, sy: 0.4, sz: 0.8, m: 'pop', a: 0.07, d: 0.03, oa: T_CLEAN + 0.03, color: '#8b8378' },
      { x: 6.8, z: 5.8, y: 0, sx: 1.2, sy: 0.55, sz: 1.2, m: 'pop', a: 0.08, d: 0.03, oa: T_CLEAN + 0.035, color: '#7c7468' },
      { x: 2.5, z: 6.4, y: 0, sx: 3.2, sy: 0.12, sz: 0.5, m: 'pop', a: 0.09, d: 0.03, oa: T_CLEAN + 0.035, color: '#3b3d42' },
      { x: 2.5, z: 6.4, y: 0.12, sx: 3.2, sy: 0.12, sz: 0.5, m: 'pop', a: 0.1, d: 0.03, oa: T_CLEAN + 0.035, color: '#3b3d42' },
    ];
    add(makeKit(BOX, mats.white, siteGear));

    /* ----- paisagismo ----- */
    const TERRACE_Y = floorY(3) + SLAB;
    const lawns = [
      { x: -6.4, z: 5.9, y: 0.01, sx: 3.2, sy: 0.06, sz: 2.6, a: T_GREEN, d: 0.03 },
      { x: 6.5, z: 5.6, y: 0.01, sx: 3.0, sy: 0.06, sz: 3.0, a: T_GREEN + 0.01, d: 0.03 },
      { x: -6.8, z: -3.2, y: 0.01, sx: 2.4, sy: 0.06, sz: 5.0, a: T_GREEN + 0.02, d: 0.03 },
      { x: 6.9, z: -2.5, y: 0.01, sx: 2.2, sy: 0.06, sz: 5.4, a: T_GREEN + 0.03, d: 0.03 },
      { x: 3.3, z: 3.3, y: TERRACE_Y, sx: 3.8, sy: 0.08, sz: 1.8, a: T_GREEN + 0.02, d: 0.03 },
      { x: -2.0, z: 3.3, y: TERRACE_Y, sx: 6.4, sy: 0.08, sz: 1.8, a: T_GREEN + 0.03, d: 0.03 },
      { x: 4.4, z: -0.5, y: TERRACE_Y, sx: 1.4, sy: 0.08, sz: 5.4, a: T_GREEN + 0.035, d: 0.03 },
    ];
    add(makeKit(BOX, mats.lawn, lawns));
    const pool = { x: 2.6, z: -1.4, y: TERRACE_Y, sx: 1.7, sy: 0.1, sz: 4.2, a: T_GREEN + 0.05, d: 0.03 };
    add(makeKit(BOX, mats.pool, [pool], { cast: false }));

    const treeSpots = [];
    for (let x = -7.2; x <= 7.3; x += 2.05) treeSpots.push([x, 0, 7.0]);
    for (let z = -5.2; z <= 5.2; z += 2.1) treeSpots.push([-7.5, 0, z]);
    for (let x = -5.6; x <= 4.5; x += 2.5) treeSpots.push([x, 0, -6.6]);
    for (let z = -3.5; z <= 5; z += 2.2) treeSpots.push([7.6, 0, z]);
    [[4.5, 3.2], [2.2, 3.4], [-0.6, 3.4], [-3.0, 3.4], [-4.8, 3.3], [4.6, 1.4], [4.6, -3.4]].forEach(([x, z]) =>
      treeSpots.push([x, TERRACE_Y + 0.05, z])
    );
    const trunks = [];
    const leaves = [];
    const greens = ['#5f8f3e', '#4f7d35', '#6d9c48', '#3f6b2e', '#7aa64f'];
    treeSpots.forEach(([x, y, z], idx) => {
      const s = 0.75 + rand() * 0.55;
      const a = T_GREEN + 0.01 + idx * 0.0022;
      trunks.push({ x, z, y, sx: 0.12 * s, sy: 0.55 * s, sz: 0.12 * s, m: 'pop', a, d: 0.035 });
      leaves.push({
        x, z, y: y + 0.45 * s, sx: 0.9 * s, sy: 1.05 * s, sz: 0.9 * s, ry: rand() * 3,
        m: 'pop', a: a + 0.004, d: 0.04, color: greens[idx % greens.length],
      });
    });
    add(makeKit(new T.CylinderGeometry(0.5, 0.6, 1, 6).translate(0, 0.5, 0), mats.trunk, trunks));
    add(makeKit(new T.IcosahedronGeometry(0.6, 0).translate(0, 0.6, 0), mats.leaf, leaves));

    const lamps = [];
    const lampHeads = [];
    for (let x = -6; x <= 6.1; x += 3) {
      lamps.push({ x, z: 7.9, y: 0, sx: 0.05, sy: 0.9, sz: 0.05, a: T_GREEN + 0.03, d: 0.03, color: '#2a2b2f' });
      lampHeads.push({ x, z: 7.9, y: 0.9, sx: 0.22, sy: 0.08, sz: 0.22, a: T_GREEN + 0.04, d: 0.03 });
    }
    add(makeKit(BOX, mats.steel, lamps));
    add(makeKit(BOX, mats.lamp, lampHeads, { cast: false }));

    /* ----- guindaste de torre ----- */
    const crane = buildCrane(mats);
    site.add(crane.group);

    /* ----- modelo fantasma (projeto BIM em linhas) ----- */
    const ghostMat = new T.LineBasicMaterial({ color: '#6f96ff', transparent: true, opacity: 0.55 });
    const ghost = new T.Group();
    const edgeBox = (cx, y0, cz, w, h, d) => {
      const g = new T.BoxGeometry(w, h, d);
      const e = new T.LineSegments(new T.EdgesGeometry(g), ghostMat);
      e.position.set(cx, y0 + h / 2, cz);
      ghost.add(e);
    };
    edgeBox(0, 0, 0, 10.6, floorY(3), 8.6);
    edgeBox(tcx, floorY(3), tcz, tw, TOP - floorY(3) + SLAB, td);
    edgeBox(tcx, TOP + SLAB, tcz, tw, CH + 0.3, td);
    edgeBox(CORE.x, 0, CORE.z, CORE.w, TOP + 1.25, CORE.d);
    for (let i = 1; i < FLOORS; i++) {
      const env = i <= PODIUM_FLOORS ? PODIUM : TOWER;
      edgeBox((env.x0 + env.x1) / 2, floorY(i), (env.z0 + env.z1) / 2, env.x1 - env.x0, 0.001, env.z1 - env.z0);
    }
    site.add(ghost);

    return {
      scene, site, mats, kits, interiors, crane, ghost, ghostMat, grid, plot,
      plotDirt, plotPaved, mound, mound2, beacon, ringMat,
    };
  }

  function buildCrane(shared) {
    // materiais próprios para poder "apagar" o guindaste na desmontagem
    const mats = {
      crane: shared.crane.clone(),
      steel: shared.steel.clone(),
      white: shared.white.clone(),
      footing: shared.footing.clone(),
    };
    const lineMat = (color) => {
      const m = new T.LineBasicMaterial({ color });
      fade.push(m);
      return m;
    };
    const fade = Object.values(mats);
    const group = new T.Group();
    group.position.set(CRANE.x, 0, CRANE.z);

    const base = new T.Mesh(BOX, mats.footing);
    base.scale.set(1.9, 0.45, 1.9);
    base.position.y = -0.15;
    base.castShadow = base.receiveShadow = true;
    group.add(base);

    // mastro em treliça (seções de 1 unidade)
    const MAX = 22;
    const S = 0.62;
    const h = S / 2;
    const list = [];
    for (let s = 0; s < MAX; s++) {
      const y = s;
      const flip = s % 2 ? -1 : 1;
      [[-h, -h], [h, -h], [h, h], [-h, h]].forEach(([x, z]) => list.push([[x, y, z], [x, y + 1, z], 0.075]));
      list.push([[-h, y + 1, -h], [h, y + 1, -h], 0.04]);
      list.push([[-h, y + 1, h], [h, y + 1, h], 0.04]);
      list.push([[-h, y + 1, -h], [-h, y + 1, h], 0.04]);
      list.push([[h, y + 1, -h], [h, y + 1, h], 0.04]);
      list.push([[-h * flip, y, -h], [h * flip, y + 1, -h], 0.035]);
      list.push([[h * flip, y, h], [-h * flip, y + 1, h], 0.035]);
      list.push([[-h, y, -h * flip], [-h, y + 1, h * flip], 0.035]);
      list.push([[h, y, h * flip], [h, y + 1, -h * flip], 0.035]);
    }
    const PER = 12;
    const mast = beamsMesh(list, mats.crane, 0.05);
    mast.count = 8 * PER;
    group.add(mast);

    // cabeça giratória
    const head = new T.Group();
    group.add(head);
    const hb = [];
    // torre de topo (pirâmide)
    const apex = [0, 2.5, 0];
    [[-h, 0.3, -h], [h, 0.3, -h], [h, 0.3, h], [-h, 0.3, h]].forEach((p) => hb.push([p, apex, 0.07]));
    // lança (seção triangular)
    const JL = 11.6;
    const step = 0.72;
    hb.push([[0.3, 0.3, -0.26], [JL, 0.3, -0.26], 0.07]);
    hb.push([[0.3, 0.3, 0.26], [JL, 0.3, 0.26], 0.07]);
    hb.push([[0.3, 0.82, 0], [JL - 0.3, 0.82, 0], 0.07]);
    for (let x = 0.3; x < JL - 0.4; x += step) {
      [-0.26, 0.26].forEach((z) => {
        hb.push([[x, 0.3, z], [x + step / 2, 0.82, 0], 0.035]);
        hb.push([[x + step / 2, 0.82, 0], [x + step, 0.3, z], 0.035]);
      });
      hb.push([[x, 0.3, -0.26], [x, 0.3, 0.26], 0.035]);
    }
    // contra-lança
    const CL = -4.2;
    hb.push([[0, 0.3, -0.32], [CL, 0.3, -0.32], 0.08]);
    hb.push([[0, 0.3, 0.32], [CL, 0.3, 0.32], 0.08]);
    for (let x = 0; x > CL; x -= 0.7) hb.push([[x, 0.3, -0.32], [x - 0.7, 0.3, 0.32], 0.035]);
    head.add(beamsMesh(hb, mats.crane, 0.05));

    const turntable = new T.Mesh(BOX, mats.steel);
    turntable.scale.set(1.0, 0.3, 1.0);
    turntable.castShadow = true;
    head.add(turntable);
    const cab = new T.Mesh(BOX, mats.white);
    cab.scale.set(0.55, 0.5, 0.5);
    cab.position.set(0.35, 0.3, 0.62);
    cab.castShadow = true;
    head.add(cab);
    const deck = new T.Mesh(BOX, mats.steel);
    deck.scale.set(4.2, 0.06, 0.7);
    deck.position.set(-2.1, 0.27, 0);
    head.add(deck);
    const counterweight = new T.Mesh(BOX, mats.footing);
    counterweight.scale.set(1.1, 1.0, 0.8);
    counterweight.position.set(-3.6, -0.55, 0);
    counterweight.castShadow = true;
    head.add(counterweight);

    // tirantes
    const tieGeo = new T.BufferGeometry();
    tieGeo.setAttribute(
      'position',
      new T.Float32BufferAttribute([0, 2.5, 0, 7.5, 0.82, 0, 0, 2.5, 0, 3.6, 0.82, 0, 0, 2.5, 0, CL, 0.3, 0], 3)
    );
    head.add(new T.LineSegments(tieGeo, lineMat('#1b1c1f')));

    // carrinho, cabo, gancho e carga
    const trolley = new T.Mesh(BOX, mats.steel);
    trolley.scale.set(0.5, 0.18, 0.5);
    head.add(trolley);
    const cableGeo = new T.BufferGeometry();
    cableGeo.setAttribute('position', new T.Float32BufferAttribute(new Array(12).fill(0), 3));
    const cable = new T.LineSegments(cableGeo, lineMat('#111214'));
    cable.frustumCulled = false;
    head.add(cable);
    const hook = new T.Mesh(BOX, mats.crane);
    hook.scale.set(0.24, 0.32, 0.2);
    hook.castShadow = true;
    head.add(hook);
    const load = new T.Group();
    const beam = new T.Mesh(CENTER_BOX, mats.steel);
    beam.scale.set(2.6, 0.16, 0.22);
    beam.castShadow = true;
    load.add(beam);
    const slingGeo = new T.BufferGeometry();
    slingGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0.9, 0, -1.1, 0.08, 0, 0, 0.9, 0, 1.1, 0.08, 0], 3));
    load.add(new T.LineSegments(slingGeo, lineMat('#111214')));
    head.add(load);

    return { group, mast, head, trolley, cable, cableGeo, hook, load, PER, MAX, fade, fading: false };
  }

  /* ==========================================================================
     Controlador
     ========================================================================== */
  function init(canvas) {
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
      return null;
    }
    if (!renderer.getContext()) return null;

    const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);

    const W = buildScene(isMobile);
    const { scene, site, crane } = W;

    const pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.75;
    pmrem.dispose();

    const hemi = new T.HemisphereLight('#cfe0ff', '#3b2f26', 0.7);
    scene.add(hemi);
    const sun = new T.DirectionalLight('#fff0d8', 2.4);
    sun.position.set(14, 24, 11);
    sun.target.position.set(0, 3, 0);
    sun.castShadow = true;
    const sm = isMobile ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -17;
    sc.right = sc.top = 17;
    sc.near = 2;
    sc.far = 70;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    const rim = new T.DirectionalLight('#7fa2ff', 0.0);
    rim.position.set(-16, 10, -14);
    scene.add(rim);

    const camera = new T.PerspectiveCamera(32, 1, 0.5, 200);
    const BASE_ROT = -0.75;

    const sunDay = new T.Color('#fff0d8');
    const sunDusk = new T.Color('#ff8a4c');
    const hemiDay = new T.Color('#cfe0ff');
    const hemiDusk = new T.Color('#5a5f9a');

    let progress = 0;
    let dirty = true;
    let running = false;
    let raf = 0;
    let width = 1, height = 1, aspect = 1;
    let viewShift = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const drag = { active: false, lastX: 0, value: 0, target: 0 };
    let craneHeight = 8;

    /* ---------- aplica o progresso na cena ---------- */
    function apply(p) {
      W.kits.forEach((k) => k.update(p));

      // montes de terra somem com a terraplanagem
      const dig = 1 - ease.inOut(seg(p, 0.0, 0.1));
      W.mound.scale.setScalar(Math.max(dig, 1e-4));
      W.mound2.scale.setScalar(Math.max(dig * 0.6, 1e-4));

      // volumes internos acompanham o vidro
      W.interiors.forEach((b) => {
        const u = b.userData;
        const t = ease.out(seg(p, u.a + 0.01, u.a + D_FACADE));
        if (t <= 0) b.scale.set(1e-4, 1e-4, 1e-4);
        else b.scale.set(u.sx, u.sy * t, u.sz);
        const on = ease.out(seg(p, T_LIGHTS + u.floor * 0.0045, T_LIGHTS + 0.03 + u.floor * 0.0045));
        b.material.emissiveIntensity = on * 1.9;
      });

      // modelo fantasma e grade se dissolvem conforme a obra se materializa
      W.ghostMat.opacity = 0.55 * (1 - ease.inOut(seg(p, 0.08, 0.74)));
      W.ghost.visible = W.ghostMat.opacity > 0.005;
      W.grid.material.opacity = 0.2 * (1 - seg(p, 0.72, 0.9));
      W.grid.visible = W.grid.material.opacity > 0.005;

      // terreno: terra → piso acabado
      W.plot.material.color.copy(W.plotDirt).lerp(W.plotPaved, ease.inOut(seg(p, T_CLEAN, T_CLEAN + 0.08)));

      // luz de fim de tarde
      const dusk = ease.inOut(seg(p, 0.86, 0.99));
      sun.color.copy(sunDay).lerp(sunDusk, dusk);
      sun.intensity = lerp(2.4, 1.1, dusk);
      sun.position.set(14, lerp(24, 9, dusk), 11);
      hemi.color.copy(hemiDay).lerp(hemiDusk, dusk);
      hemi.intensity = lerp(0.7, 0.35, dusk);
      rim.intensity = dusk * 1.2;
      scene.environmentIntensity = lerp(0.75, 0.3, dusk);
      W.mats.lamp.emissiveIntensity = dusk * 3;
      W.mats.pool.emissiveIntensity = 0.25 + dusk * 1.4;
      W.ringMat.opacity = 0.35 * (1 - dusk * 0.5);

      // topo atual da obra → altura do guindaste (sobe seção a seção)
      let top = 0;
      for (let i = 0; i < FLOORS; i++) if (p >= T_STRUCT(i)) top = floorY(i + 1);
      if (p >= T_CROWN) top = TOP + 1.8;
      crane.target = Math.min(crane.MAX, Math.max(8, Math.ceil(top + 4.6)));

      W.beacon.visible = p > 0.95;
      W.beacon.userData.on = p > 0.95;
    }

    /* ---------- enquadramento de câmera ---------- */
    function frame(p) {
      const intro = ease.inOut(seg(p, 0, 0.12));
      const g = ease.inOut(seg(p, 0.12, 0.72));
      const tanH = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      const H = p < 0.12 ? lerp(26, 23, intro) : lerp(23, 28, g);
      const Wd = aspect < 1 ? (p < 0.12 ? lerp(21, 18, intro) : lerp(18, 16.5, g)) : lerp(27, 29, g);
      const effAspect = aspect * (1 + viewShift * 2);
      const dist = Math.max(H / 2 / tanH, Wd / 2 / (tanH * effAspect));
      const lookY = H * 0.3 + (aspect < 1 ? 1.2 : 0);
      const elev = lerp(lerp(0.5, 0.44, intro), 0.3, g) - pointer.y * 0.05;
      const yaw = pointer.x * 0.08;
      camera.position.set(Math.sin(yaw) * dist, lookY + Math.sin(elev) * dist, Math.cos(yaw) * Math.cos(elev) * dist);
      camera.lookAt(0, lookY, 0);
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(r.width));
      height = Math.max(1, Math.round(r.height));
      aspect = width / height;
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      // em telas largas desloca a obra para a direita, deixando espaço ao texto
      viewShift = aspect > 1.25 ? 0.11 : 0;
      if (viewShift) camera.setViewOffset(width * (1 + viewShift * 2), height, 0, 0, width, height);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      dirty = true;
      if (!running) renderOnce();
    }

    /* ---------- animações contínuas (guindaste, gancho, drag) ---------- */
    const cablePos = crane.cableGeo.attributes.position;
    function idle(t, p) {
      // guindaste sobe acompanhando a obra
      craneHeight += (crane.target - craneHeight) * 0.08;
      const sections = Math.min(crane.MAX, Math.round(craneHeight));
      crane.mast.count = sections * crane.PER;
      crane.head.position.y += (sections - crane.head.position.y) * 0.2;

      // desmontagem: a lança gira para fora do terreno e o guindaste se apaga
      const rm = ease.inOut(seg(p, T_CLEAN - 0.01, T_CLEAN + 0.05));
      crane.group.position.y = -rm * 2.5;
      crane.group.visible = rm < 0.999;
      const fading = rm > 0;
      if (fading !== crane.fading) {
        crane.fading = fading;
        crane.fade.forEach((m) => {
          m.transparent = fading;
          m.depthWrite = !fading;
          m.needsUpdate = true;
        });
        crane.group.traverse((o) => (o.castShadow = !fading && o.isMesh));
      }
      if (fading) crane.fade.forEach((m) => (m.opacity = 1 - rm));

      const away = ease.inOut(seg(p, T_CLEAN - 0.07, T_CLEAN - 0.005));
      const slew = lerp(2.35 + Math.sin(t * 0.22) * 0.75 + Math.sin(t * 0.07) * 0.3, 0.75, away);
      crane.head.rotation.y = slew;
      const tx = 6.2 + Math.sin(t * 0.31) * 2.4;
      const drop = 2.6 + (Math.sin(t * 0.47 + 1.3) + 1) * 1.6;
      crane.trolley.position.set(tx, 0.12, 0);
      crane.hook.position.set(tx, -drop, 0);
      crane.load.position.set(tx, -drop - 0.95, 0);
      crane.load.rotation.y = Math.sin(t * 0.6) * 0.5;
      cablePos.setXYZ(0, tx, 0.15, -0.05);
      cablePos.setXYZ(1, tx, -drop + 0.3, -0.05);
      cablePos.setXYZ(2, tx, 0.15, 0.05);
      cablePos.setXYZ(3, tx, -drop + 0.3, 0.05);
      cablePos.needsUpdate = true;

      // farol de balizamento piscando
      if (W.beacon.userData.on) W.mats.beacon.emissiveIntensity = Math.sin(t * 4) > 0.2 ? 4 : 0.2;

      // arrasto (spin extra) volta suavemente ao zero
      if (!drag.active) drag.target *= 0.94;
      drag.value += (drag.target - drag.value) * 0.12;

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
    }

    function renderOnce() {
      if (dirty) {
        apply(progress);
        dirty = false;
      }
      site.rotation.y = BASE_ROT + progress * Math.PI * 2 + drag.value;
      frame(progress);
      renderer.render(scene, camera);
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      idle(now / 1000, progress);
      renderOnce();
    }

    /* ---------- interação: arrastar para girar, mouse para inclinar ---------- */
    canvas.addEventListener('pointerdown', (e) => {
      drag.active = true;
      drag.lastX = e.clientX;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (drag.active) {
        drag.target += (e.clientX - drag.lastX) * 0.012;
        drag.lastX = e.clientX;
      }
    });
    const endDrag = () => (drag.active = false);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => {
      endDrag();
      pointer.tx = pointer.ty = 0;
    });

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    window.addEventListener('resize', resize);
    resize();

    return {
      setProgress(p) {
        p = clamp01(p);
        if (p !== progress) {
          progress = p;
          dirty = true;
          if (!running) renderOnce();
        }
      },
      start() {
        if (running) return;
        running = true;
        raf = requestAnimationFrame(loop);
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
      },
      resize,
      floorsDone(p) {
        let n = 0;
        for (let i = 0; i < FLOORS; i++) if (p >= T_STRUCT(i) + D_STRUCT) n++;
        return n;
      },
      FLOORS,
    };
  }

  window.Building = { init };
})();
