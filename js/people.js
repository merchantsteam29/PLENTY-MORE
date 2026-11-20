// Characters: procedurally sculpted, skinned (one skeleton, 4 draw calls per person), with eyes that look,
// lids that blink, brows, a talking mouth, expression textures and a blended procedural animation library.
(function () {
  const V3 = THREE.Vector3;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const matCache = {};
  G.matCache = (k, make) => matCache[k] || (matCache[k] = make());
  G.mat = (c, shin = 6, o = {}) => {
    const k = c + ':' + shin + ':' + (o.e || '') + ':' + (o.side || '');
    return matCache[k] || (matCache[k] = new THREE.MeshPhongMaterial({ color: G.C(c), shininess: shin, specular: new THREE.Color(shin > 30 ? 0x333333 : 0x0c0c0c), emissive: o.e ? G.C(o.e) : 0x000000, side: o.side || THREE.FrontSide }));
  };

  // ---------- skinned geometry accumulator ----------
  function Acc() { this.p = []; this.n = []; this.uv = []; this.c = []; this.si = []; this.sw = []; this.ix = []; this.count = 0; }
  Acc.prototype.v = function (p, n, uv, w, col) {
    this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(uv[0], uv[1]);
    this.c.push(col ? col[0] : 1, col ? col[1] : 1, col ? col[2] : 1);
    let tot = 0; for (let i = 0; i < w.length && i < 4; i++) tot += w[i][1];
    for (let i = 0; i < 4; i++) { const x = w[i]; this.si.push(x ? x[0] : 0); this.sw.push(x ? (tot > 0 ? x[1] / tot : (i ? 0 : 1)) : 0); }
    return this.count++;
  };
  Acc.prototype.geo = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.ix);
    return g;
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // Generic grid -> smooth-shaded triangles with outward normals (orientation decided against ctr(p)).
  function grid(acc, nr, nc, wrap, P, UV, Wf, ctr, colf) {
    const cols = wrap ? nc + 1 : nc, pos = [];
    for (let i = 0; i < nr; i++) for (let j = 0; j < cols; j++) pos.push(P(i, wrap ? j % nc : j));
    const id = (i, j) => i * cols + j, base = acc.count;
    for (let i = 0; i < nr; i++) for (let j = 0; j < cols; j++) {
      const p = pos[id(i, j)];
      const jm = wrap ? (j - 1 + nc) % nc : Math.max(0, j - 1), jp = wrap ? (j + 1) % nc : Math.min(cols - 1, j + 1);
      const im = Math.max(0, i - 1), ip = Math.min(nr - 1, i + 1);
      let n = cross(sub(pos[id(i, jp)], pos[id(i, jm)]), sub(pos[id(ip, j)], pos[id(im, j)]));
      const c = ctr(p);
      if (Math.hypot(n[0], n[1], n[2]) < 1e-12) n = sub(p, c);
      n = nrm(n); if (dot(n, sub(p, c)) < 0) n = [-n[0], -n[1], -n[2]];
      acc.v(p, n, UV(i, j), Wf(p, i, j), colf ? colf(p, i, j) : null);
    }
    const N = acc.n;
    for (let i = 0; i < nr - 1; i++) for (let j = 0; j < cols - 1; j++) {
      const a = base + id(i, j), b = base + id(i + 1, j), c = base + id(i + 1, j + 1), d = base + id(i, j + 1);
      for (const [x, y, z] of [[a, b, d], [b, c, d]]) {
        const P0 = acc.p.slice(x * 3, x * 3 + 3), P1 = acc.p.slice(y * 3, y * 3 + 3), P2 = acc.p.slice(z * 3, z * 3 + 3);
        const fn = cross(sub(P1, P0), sub(P2, P0));
        if (Math.hypot(fn[0], fn[1], fn[2]) < 1e-14) continue;
        const vn = [N[x * 3] + N[y * 3] + N[z * 3], N[x * 3 + 1] + N[y * 3 + 1] + N[z * 3 + 1], N[x * 3 + 2] + N[y * 3 + 2] + N[z * 3 + 2]];
        if (dot(fn, vn) >= 0) acc.ix.push(x, y, z); else acc.ix.push(x, z, y);
      }
    }
  }
  // resample a control profile [[t, r, wz, zo]] into n rows uniformly spaced in t
  function prof(ctrl, n) {
    const t0 = ctrl[0][0], t1 = ctrl[ctrl.length - 1][0], out = [];
    for (let i = 0; i < n; i++) {
      const t = t0 + (t1 - t0) * i / (n - 1); let k = 0;
      while (k < ctrl.length - 2 && ctrl[k + 1][0] < t) k++;
      const a = ctrl[k], b = ctrl[k + 1], f = clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1), e = f * f * (3 - 2 * f);
      out.push({ t, r: lerp(a[1], b[1], e), wz: lerp(a[2] || 1, b[2] || 1, f), zo: lerp(a[3] || 0, b[3] || 0, f) });
    }
    return out;
  }
  const rectUV = (r, u, v) => { const S = 512, [x, y, w, h] = r; return [(x + u * w) / S, 1 - (y + (1 - v) * h) / S]; };

  // ---------- proportions ----------
  const BUILD = {
    man:   { hip: 0.515, knee: 0.285, ank: 0.045, pel: 0.53, spine: 0.6, chest: 0.69, neck: 0.83, headJ: 0.87, sh: 0.815, el: 0.632, wr: 0.48, sw: 0.123, hx: 0.053, hs: 1.0, armR: 1.0, legR: 1.0, tor: 'm' },
    woman: { hip: 0.515, knee: 0.285, ank: 0.045, pel: 0.53, spine: 0.6, chest: 0.69, neck: 0.83, headJ: 0.87, sh: 0.815, el: 0.632, wr: 0.48, sw: 0.112, hx: 0.055, hs: 1.02, armR: 0.86, legR: 0.95, tor: 'f' },
    girl:  { hip: 0.51, knee: 0.282, ank: 0.045, pel: 0.525, spine: 0.595, chest: 0.685, neck: 0.825, headJ: 0.865, sh: 0.81, el: 0.628, wr: 0.478, sw: 0.11, hx: 0.052, hs: 1.06, armR: 0.84, legR: 0.9, tor: 'g' },
    kid:   { hip: 0.5, knee: 0.275, ank: 0.045, pel: 0.515, spine: 0.585, chest: 0.67, neck: 0.81, headJ: 0.85, sh: 0.795, el: 0.618, wr: 0.47, sw: 0.115, hx: 0.05, hs: 1.12, armR: 0.86, legR: 0.9, tor: 'k' }
  };
  const TORSO = {
    m: [[0, 0, 0.75], [0.012, 0.05, 0.75], [0.05, 0.08, 0.75], [0.15, 0.094, 0.72], [0.25, 0.09, 0.66], [0.38, 0.086, 0.62], [0.5, 0.09, 0.6], [0.63, 0.099, 0.6], [0.74, 0.106, 0.6], [0.82, 0.106, 0.6], [0.86, 0.095, 0.62], [0.895, 0.07, 0.72], [0.925, 0.044, 0.9], [0.96, 0.036, 0.95], [1.0, 0.034, 0.95], [1.02, 0, 0.95]],
    f: [[0, 0, 0.75], [0.012, 0.055, 0.78], [0.05, 0.088, 0.78], [0.15, 0.103, 0.74], [0.25, 0.09, 0.66], [0.37, 0.076, 0.64], [0.48, 0.08, 0.64], [0.6, 0.09, 0.66, 0.006], [0.69, 0.092, 0.66, 0.007], [0.78, 0.093, 0.6], [0.84, 0.09, 0.62], [0.88, 0.075, 0.7], [0.915, 0.048, 0.86], [0.95, 0.033, 0.94], [1.0, 0.031, 0.95], [1.02, 0, 0.95]],
    g: [[0, 0, 0.75], [0.012, 0.052, 0.77], [0.05, 0.084, 0.77], [0.15, 0.097, 0.73], [0.25, 0.088, 0.66], [0.37, 0.077, 0.63], [0.48, 0.08, 0.63], [0.6, 0.087, 0.64, 0.004], [0.69, 0.088, 0.64, 0.004], [0.78, 0.091, 0.6], [0.84, 0.088, 0.62], [0.88, 0.072, 0.7], [0.915, 0.046, 0.86], [0.95, 0.033, 0.94], [1.0, 0.031, 0.95], [1.02, 0, 0.95]],
    k: [[0, 0, 0.75], [0.012, 0.05, 0.77], [0.05, 0.08, 0.77], [0.15, 0.09, 0.72], [0.25, 0.086, 0.68], [0.38, 0.084, 0.66], [0.5, 0.087, 0.64], [0.63, 0.092, 0.62], [0.74, 0.097, 0.62], [0.82, 0.096, 0.63], [0.86, 0.085, 0.66], [0.895, 0.062, 0.76], [0.925, 0.04, 0.9], [0.96, 0.034, 0.95], [1.0, 0.033, 0.95], [1.02, 0, 0.95]]
  };
  const LEG = [[-0.02, 0], [0, 0.022], [0.03, 0.024], [0.12, 0.028], [0.24, 0.035], [0.33, 0.034], [0.44, 0.029], [0.51, 0.03], [0.58, 0.036], [0.75, 0.044], [0.88, 0.05], [1.0, 0.052], [1.08, 0.045], [1.12, 0]];
  const ARM = [[-0.015, 0], [0, 0.017], [0.06, 0.018], [0.2, 0.022], [0.33, 0.024], [0.45, 0.021], [0.55, 0.025], [0.72, 0.027], [0.88, 0.031], [0.97, 0.031], [1.0, 0.03], [1.02, 0.027], [1.035, 0.021], [1.046, 0.013], [1.052, 0]];
  const BONES = ['pelvis', 'spine', 'chest', 'neck', 'head', 'eyeL', 'eyeR', 'lidL', 'lidR', 'browL', 'browR', 'mouth', 'shL', 'elL', 'wrL', 'fgL', 'thL', 'shR', 'elR', 'wrR', 'fgR', 'thR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR'];
  const PARENT = { spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck', eyeL: 'head', eyeR: 'head', lidL: 'head', lidR: 'head', browL: 'head', browR: 'head', mouth: 'head', shL: 'chest', elL: 'shL', wrL: 'elL', fgL: 'wrL', thL: 'wrL', shR: 'chest', elR: 'shR', wrR: 'elR', fgR: 'wrR', thR: 'wrR', hipL: 'pelvis', knL: 'hipL', anL: 'knL', hipR: 'pelvis', knR: 'hipR', anR: 'knR' };
  const BI = {}; BONES.forEach((n, i) => (BI[n] = i));
  const JOINTS = ['pelvis', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'wrL', 'fgL', 'thL', 'shR', 'elR', 'wrR', 'fgR', 'thR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR'];

  // head sculpt on the unit sphere (x right, y up, z forward)
  function sculpt(x, y, z, F) {
    const jaw2 = 0.2 + F.jaw * 0.45, fz0 = sm(-0.2, 0.6, z);
    x *= 1 - 0.15 * sm(-0.05, -0.6, y) - jaw2 * sm(-0.45, -1.0, y) * (0.55 + 0.45 * fz0);
    if (y > 0.55) z *= 1 - (y - 0.55) * 0.12;
    if (z > 0) {
      const fz = sm(0.0, 0.5, z);
      z *= 1 - 0.07 * fz * Math.exp(-(x * x) / 0.2);
      for (const s of [-1, 1]) {
        const ex = x - s * 0.4, ey = y - 0.07;
        z -= 0.08 * Math.exp(-(ex * ex / 0.032 + ey * ey / 0.017)) * fz;
        z += (0.04 + F.cheek) * Math.exp(-((x - s * 0.52) ** 2 / 0.03 + (y + 0.12) ** 2 / 0.02)) * fz;
        z += 0.05 * Math.exp(-((x - s * 0.085) ** 2 / 0.002 + (y + 0.24) ** 2 / 0.0025)) * fz;
        z -= 0.03 * Math.exp(-((x - s * 0.3) ** 2 / 0.01 + (y + 0.35) ** 2 / 0.008)) * fz;
      }
      z += (F.brow + 0.02) * Math.exp(-((y - 0.25) ** 2) / 0.008) * Math.exp(-(x * x) / 0.3) * fz;
      const nw = F.noseW * lerp(0.75, 1.35, sm(0.2, -0.24, y)), nx = Math.exp(-(x * x) / (nw * nw));
      const ny = y > -0.25 ? sm(0.2, -0.22, y) : Math.exp(-((y + 0.25) ** 2) / 0.0022);
      z += F.nose * 1.45 * nx * ny * fz;
      z += 0.05 * Math.exp(-(x * x) / 0.006 - ((y + 0.2) ** 2) / 0.006) * fz;
      z += 0.045 * Math.exp(-(x * x) / 0.055) * Math.exp(-((y + 0.44) ** 2) / 0.007) * fz;
      z -= 0.03 * Math.exp(-(x * x) / 0.06) * Math.exp(-((y + 0.62) ** 2) / 0.004) * fz;
      z += (F.chin + 0.02) * Math.exp(-(x * x) / 0.06) * Math.exp(-((y + 0.8) ** 2) / 0.018) * fz;
    }
    return [x, y, z];
  }
  const HAIRLINE = { spiky: [0.5, -0.05, -0.62], messy: [0.48, -0.05, -0.6], long: [0.5, -0.02, -0.55], bob: [0.5, -0.05, -0.62], bun: [0.56, 0.0, -0.58] };
  const hairAbove = (st, x, y, z) => {
    const [fr, sd, bk] = HAIRLINE[st], f = sm(-0.15, 0.75, z), b = sm(0.1, -0.75, z);
    let lv = lerp(lerp(sd, fr, f), bk, b);
    if (z > 0.2 && Math.abs(x) > 0.55) lv += 0.08 * sm(0.55, 0.8, Math.abs(x)) * f; // temples
    return y - lv;
  };

  // ================= makePerson =================
  G.makePerson = function (key, T, o = {}) {
    const ch = G.CHARS[key], H = ch.h, B = BUILD[ch.build], F = ch.face, hsz = (H / 1.75) * B.hs;
    const variant = o.variant || 'normal';
    const P = { key, ch, H, B, root: new THREE.Group(), t: Math.random() * 10, anim: 'stand', animT: 0, walkPhase: 0, walkW: 0, speed: 0,
      expr: o.expr || ch.base, gazeAt: null, lookAt: null, talk: 0, talkLevel: 0, blinkT: 1 + Math.random() * 3, blink: 0, props: {}, idle: o.idle || 'relax', style: o.style || {} };
    // bone rest positions (absolute)
    const abs = {};
    const hc = [0, H * (B.headJ + 0.046 * B.hs), 0.008 * H]; // head centre
    const RX = 0.0435 * H * B.hs, RY = 0.064 * H * B.hs, RZ = 0.0555 * H * B.hs;
    const eyeR = 0.0118 * hsz * F.eye;
    const eyeC = s => { const [x, y, z] = sculpt(s * 0.4, 0.07, Math.sqrt(1 - 0.16 - 0.0049), F); return [hc[0] + x * RX, hc[1] + y * RY, hc[2] + z * RZ - eyeR * 0.5]; };
    const browC = s => { const [x, y, z] = sculpt(s * 0.38, 0.3, Math.sqrt(1 - 0.38 * 0.38 - 0.09), F); return [hc[0] + x * RX, hc[1] + y * RY, hc[2] + z * RZ]; };
    const mY = -0.455, mouthC = (() => { const [x, y, z] = sculpt(0, mY, Math.sqrt(1 - mY * mY), F); return [hc[0] + x * RX, hc[1] + y * RY, hc[2] + z * RZ]; })();
    Object.assign(abs, {
      pelvis: [0, B.pel * H, 0], spine: [0, B.spine * H, 0], chest: [0, B.chest * H, 0], neck: [0, B.neck * H, -0.004 * H], head: [0, B.headJ * H, 0],
      eyeL: eyeC(1), eyeR: eyeC(-1), lidL: eyeC(1), lidR: eyeC(-1), browL: browC(1), browR: browC(-1), mouth: mouthC
    });
    for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
      abs['sh' + L] = [s * B.sw * H, B.sh * H, -0.005 * H]; abs['el' + L] = [s * B.sw * H, B.el * H, -0.008 * H]; abs['wr' + L] = [s * B.sw * H, B.wr * H, 0];
      abs['fg' + L] = [s * B.sw * H, (B.wr - 0.052) * H, 0.001 * H]; abs['th' + L] = [s * (B.sw - 0.006) * H, (B.wr - 0.018) * H, 0.014 * H];
      abs['hip' + L] = [s * B.hx * H, B.hip * H, 0]; abs['kn' + L] = [s * B.hx * H, B.knee * H, 0.004 * H]; abs['an' + L] = [s * B.hx * H, B.ank * H, -0.004 * H];
    }
    const bones = BONES.map(n => { const b = new THREE.Bone(); b.name = n; return b; });
    BONES.forEach((n, i) => { const b = bones[i], p = abs[n], pp = PARENT[n] ? abs[PARENT[n]] : [0, 0, 0]; b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); if (PARENT[n]) bones[BI[PARENT[n]]].add(b); });
    P.bones = {}; BONES.forEach((n, i) => (P.bones[n] = bones[i]));
    P.rest = {}; BONES.forEach((n, i) => (P.rest[n] = bones[i].position.clone()));
    P.root.add(bones[0]);

    const body = new Acc(), head = new Acc(), hair = new Acc(), eyes = new Acc();
    const REG = T.REG;
    // ---- torso ----
    const tor = TORSO[B.tor], ty0 = 0.47 * H, ty1 = (B.headJ + 0.01) * H, rows = prof(tor, 30), nc = 22;
    const tw = (p) => {
      const y = p[1] / H, w = [];
      const a = (n, v) => { if (v > 0.001) w.push([BI[n], v]); };
      const pel = 1 - sm(B.pel + 0.03, B.spine + 0.03, y), spn = sm(B.pel + 0.03, B.spine + 0.03, y) * (1 - sm(B.spine + 0.04, B.chest + 0.01, y));
      const chs = sm(B.spine + 0.04, B.chest + 0.01, y) * (1 - sm(B.neck - 0.005, B.neck + 0.02, y)), nek = sm(B.neck - 0.005, B.neck + 0.02, y) * (1 - sm(B.headJ - 0.01, B.headJ + 0.01, y));
      a('pelvis', pel); a('spine', spn); a('neck', nek); a('head', sm(B.headJ - 0.01, B.headJ + 0.01, y));
      const side = p[0] > 0 ? 'shL' : 'shR', shw = sm(0.07 * H, 0.1 * H, Math.abs(p[0])) * sm(B.sh - 0.05, B.sh, y) * 0.45;
      a('chest', chs * (1 - shw)); a(side, chs * shw);
      return w;
    };
    grid(body, rows.length, nc, true, (i, j) => { const r = rows[i], a = Math.PI + j / nc * Math.PI * 2, y = ty0 + r.t * (ty1 - ty0); return [Math.sin(a) * r.r * H, y, Math.cos(a) * r.r * H * r.wz + r.zo * H]; },
      (i, j) => rectUV(REG.torso, j / nc, rows[i].t), tw, p => [0, clamp(p[1], ty0 + 0.04 * H, ty1 - 0.04 * H), 0]);
    P.torsoAt = yAbs => { const t = (yAbs - ty0) / (ty1 - ty0); for (let i = 1; i < rows.length; i++) if (rows[i].t >= t) { const a = rows[i - 1], b = rows[i], f = (t - a.t) / (b.t - a.t || 1); return [lerp(a.r, b.r, f) * H, lerp(a.wz, b.wz, f), lerp(a.zo, b.zo, f) * H]; } return [0, 1, 0]; };
    // ---- limbs ----
    const limb = (ctrl, y0, y1, cx, cz, rad, rect, wfn, n = 24, segs = 12, zs = 0.95) => {
      const rr = prof(ctrl, n);
      grid(body, rr.length, segs, true, (i, j) => { const r = rr[i], a = Math.PI + j / segs * Math.PI * 2; return [cx + Math.sin(a) * r.r * H * rad, y0 + r.t * (y1 - y0), cz + Math.cos(a) * r.r * H * rad * zs]; },
        (i, j) => rectUV(rect, j / segs, clamp((rr[i].t + 0.03) / 1.15, 0, 1)), p => wfn((p[1] - y0) / (y1 - y0), p),
        p => [cx, clamp(p[1], y0 + (y1 - y0) * rr[0].t + 0.03 * H, y0 + (y1 - y0) * rr[rr.length - 1].t - 0.03 * H), cz]);
    };
    for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
      const hip = BI['hip' + L], kn = BI['kn' + L], an = BI['an' + L], sh = BI['sh' + L], el = BI['el' + L], wr = BI['wr' + L], fg = BI['fg' + L], th = BI['th' + L];
      limb(LEG, B.ank * H, B.hip * H, s * B.hx * H, 0, B.legR, REG.legs, t => {
        const wk = 1 - sm(0.44, 0.58, t), wp = sm(0.98, 1.1, t) * 0.6;
        return [[kn, wk], [hip, (1 - wk) * (1 - wp)], [BI.pelvis, (1 - wk) * wp]];
      });
      const sx = s * B.sw * H;
      limb(ARM, B.wr * H, B.sh * H, sx, -0.004 * H, B.armR, REG.arms, t => {
        const we = 1 - sm(0.38, 0.55, t), ww = 1 - sm(-0.01, 0.04, t), wc = sm(0.97, 1.08, t) * 0.4;
        return [[wr, ww], [el, we * (1 - ww)], [sh, (1 - we) * (1 - wc)], [BI.chest, (1 - we) * wc]];
      }, 22, 12, 1.0);
      // hand: palm + 4 fingers + thumb
      const skinUV = () => rectUV(REG.skin, 0.5, 0.5);
      const wy = B.wr * H, hS = H * B.armR / 0.9;
      const pc = [sx - s * 0.002 * H, wy - 0.03 * hS, 0.003 * H], pr = [0.0095 * hS, 0.03 * hS, 0.022 * hS];
      grid(body, 10, 12, true, (i, j) => { const th2 = i / 9 * Math.PI, a = j / 12 * Math.PI * 2; return [pc[0] + Math.sin(th2) * Math.cos(a) * pr[0], pc[1] + Math.cos(th2) * pr[1], pc[2] + Math.sin(th2) * Math.sin(a) * pr[2]]; },
        skinUV, p => [[wr, 1]], () => pc);
      const fz = [0.0145, 0.005, -0.0045, -0.013], fl = [0.041, 0.047, 0.044, 0.035];
      fz.forEach((z, k) => {
        const x0 = sx - s * 0.0015 * H, y0 = wy - 0.05 * hS, len = fl[k] * hS, r0 = 0.0058 * hS;
        grid(body, 8, 8, true, (i, j) => { const t = i / 7, a = j / 8 * Math.PI * 2, rr = t < 0.85 ? r0 * (1 - t * 0.2) : r0 * 0.8 * Math.sqrt(Math.max(0, 1 - ((t - 0.85) / 0.15) ** 2)); return [x0 + Math.cos(a) * rr, y0 - t * len, z * hS + Math.sin(a) * rr]; },
          skinUV, (p) => { const t = (y0 - p[1]) / len; return [[fg, sm(0.0, 0.25, t)], [wr, 1 - sm(0.0, 0.25, t)]]; }, p => [x0, clamp(p[1], y0 - len * 0.8, y0 - len * 0.1), z * hS]);
      });
      { const b0 = [sx - s * 0.007 * H, wy - 0.02 * hS, 0.015 * hS], d = nrm([-s * 0.25, -0.75, 0.55]), len = 0.036 * hS, r0 = 0.0065 * hS;
        const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], ax = nrm(cross(d, up)), ay = cross(ax, d);
        grid(body, 8, 8, true, (i, j) => { const t = i / 7, a = j / 8 * Math.PI * 2, rr = t < 0.8 ? r0 * (1 - t * 0.25) : r0 * 0.8 * Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2)); return [b0[0] + d[0] * t * len + (ax[0] * Math.cos(a) + ay[0] * Math.sin(a)) * rr, b0[1] + d[1] * t * len + (ax[1] * Math.cos(a) + ay[1] * Math.sin(a)) * rr, b0[2] + d[2] * t * len + (ax[2] * Math.cos(a) + ay[2] * Math.sin(a)) * rr]; },
          skinUV, p => [[th, 0.85], [wr, 0.15]], p => { const t = clamp(dot(sub(p, b0), d) / len, 0, 1); return [b0[0] + d[0] * t * len, b0[1] + d[1] * t * len, b0[2] + d[2] * t * len]; }); }
      // shoe
      { const c = [s * B.hx * H, 0.026 * H, 0.03 * H], r = [0.03 * H * B.legR * 1.05, 0.026 * H, 0.074 * H * (H < 1.6 ? 1.05 : 1)];
        grid(body, 12, 14, true, (i, j) => { const th2 = i / 11 * Math.PI, a = j / 14 * Math.PI * 2; let y = c[1] + Math.cos(th2) * r[1]; y = Math.max(y, 0.004); return [c[0] + Math.sin(th2) * Math.cos(a) * r[0], y, c[2] + Math.sin(th2) * Math.sin(a) * r[2]]; },
          (i, j) => rectUV(REG.shoe, j / 14, 1 - i / 11), p => [[an, p[1] > 0.04 * H ? 0.8 : 1], [kn, p[1] > 0.04 * H ? 0.2 : 0]], () => c);
      }
    }
    // ---- skirt + apron ----
    const skirtR = y => { const t = clamp((y - 0.3 * H) / (0.32 * H), 0, 1); return [lerp(0.128, 0.084, Math.pow(t, 1.4)) * H, lerp(0.86, 0.68, t)]; };
    if (ch.skirt) {
      const y0 = 0.3 * H, y1 = 0.62 * H, n = 12, sg = 22;
      grid(body, n, sg, true, (i, j) => { const t = i / (n - 1), a = Math.PI + j / sg * Math.PI * 2, r = lerp(0.128, 0.084, Math.pow(t, 1.4)) * H, wz = lerp(0.86, 0.68, t); return [Math.sin(a) * r, lerp(y0, y1, t), Math.cos(a) * r * wz]; },
        (i, j) => rectUV(REG.skirt, j / sg, i / (n - 1)), p => { const t = 1 - (p[1] - y0) / (y1 - y0), side = clamp(0.5 + p[0] / (0.2 * H), 0, 1), legW = sm(0.15, 0.85, t) * 0.7; return [[BI.pelvis, 1 - legW], [BI.hipL, legW * side], [BI.hipR, legW * (1 - side)]]; }, p => [0, p[1], 0]);
    }
    if (ch.apron) {
      const y0 = 0.32 * H, y1 = 0.77 * H, n = 14, sg = 8;
      grid(body, n, sg, false, (i, j) => {
        const t = i / (n - 1), u = j / (sg - 1) - 0.5, y = lerp(y0, y1, t), w = (t > 0.62 ? 0.085 : 0.13) * H;
        let tr = y > 0.47 * H ? P.torsoAt(y) : [0, 1, 0];
        if (ch.skirt && y < 0.625 * H) { const sk = skirtR(y); if (sk[0] * sk[1] > tr[0] * tr[1] + tr[2]) tr = [sk[0], sk[1], 0]; }
        const a = u * w / Math.max(0.01, tr[0]), ac = clamp(a, -1.3, 1.3);
        return [Math.sin(ac) * tr[0] * 1.06, y, Math.cos(ac) * tr[0] * tr[1] * 1.06 + tr[2] + 0.004 * H];
      }, (i, j) => rectUV(REG.apron, j / (sg - 1), i / (n - 1)), p => {
        const y = p[1] / H; if (y > 0.6) return tw(p); const t = clamp((0.6 - y) / 0.25, 0, 1), side = clamp(0.5 + p[0] / (0.15 * H), 0, 1);
        return [[BI.pelvis, 1 - t * 0.7], [BI.hipL, t * 0.7 * side], [BI.hipR, t * 0.7 * (1 - side)]];
      }, p => [0, p[1], -0.05]);
    }

    // ---- head ----
    const hb = BI.head, nr = 34, ncH = 40;
    const uvFace = (x, y, z) => { if (z >= 0) return [0.5 + 0.47 * x, 0.5 + 0.47 * y]; const r = Math.hypot(x, y) || 1e-6; return [0.5 + 0.47 * x / r, 0.5 + 0.47 * y / r]; };
    const unitAt = (i, j) => { const lat = Math.PI / 2 - i / (nr - 1) * Math.PI, lon = j / ncH * Math.PI * 2; return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; };
    const headPos = u => { const s = sculpt(u[0], u[1], u[2], F); return [hc[0] + s[0] * RX, hc[1] + s[1] * RY, hc[2] + s[2] * RZ]; };
    grid(head, nr, ncH, true, (i, j) => headPos(unitAt(i, j)), (i, j) => { const u = unitAt(i, j % ncH); return uvFace(u[0], u[1], u[2]); },
      () => [[hb, 1]], () => hc);
    for (const s of [-1, 1]) { // ears
      const c = [hc[0] + s * RX * 0.95, hc[1] - 0.07 * RY, hc[2] - 0.1 * RZ], r = [0.01 * hsz, 0.027 * hsz, 0.018 * hsz];
      grid(head, 9, 12, true, (i, j) => { const th2 = i / 8 * Math.PI, a = j / 12 * Math.PI * 2; return [c[0] + Math.sin(th2) * Math.cos(a) * r[0], c[1] + Math.cos(th2) * r[1], c[2] + Math.sin(th2) * Math.sin(a) * r[2] - Math.cos(th2) * 0.004]; },
        () => [0.5 + s * 0.47, 0.5], () => [[hb, 1]], () => c);
    }
    // eyelids (upper on lid bones, lower on head)
    for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
      const c = abs['eye' + L], lb = BI['lid' + L], tilt = -0.35, cr = Math.cos(tilt), sr = Math.sin(tilt);
      grid(head, 7, 16, true, (i, j) => { const th2 = i / 6 * Math.PI / 2, a = j / 16 * Math.PI * 2, rr = eyeR * 1.09; const x = Math.sin(th2) * Math.cos(a), y = Math.cos(th2), z = Math.sin(th2) * Math.sin(a); return [c[0] + x * rr, c[1] + (y * cr - z * sr) * rr, c[2] + (y * sr + z * cr) * rr]; },
        (i) => [0.017, 1 - (i / 6) * 0.125], () => [[lb, 1]], () => c);
      grid(head, 6, 16, true, (i, j) => { const th2 = Math.PI - i / 5 * 1.2, a = j / 16 * Math.PI * 2, rr = eyeR * 1.06; return [c[0] + Math.sin(th2) * Math.cos(a) * rr, c[1] + Math.cos(th2) * rr, c[2] + Math.sin(th2) * Math.sin(a) * rr]; },
        (i) => [0.017, 1 - (i / 5) * 0.1], () => [[hb, 1]], () => c);
    }
    // mouth interior disc (scaled open by the mouth bone)
    { const mb = BI.mouth, N = 18, mw = 0.21 * F.lip, mh = 0.065, base = head.count, cen = headPos([0, mY, Math.sqrt(1 - mY * mY)]);
      const n0 = nrm(sub(cen, hc));
      const off = p => [p[0] + n0[0] * 0.0012, p[1] + n0[1] * 0.0012, p[2] + n0[2] * 0.0012];
      head.v(off(cen), n0, [0.9375, 0.0625], [[mb, 1]]);
      for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, ux = Math.cos(a) * mw, uy = mY + Math.sin(a) * mh; const p = headPos([ux, uy, Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy))]); head.v(off(p), n0, [0.9375 + Math.cos(a) * 0.055, 0.0625 + Math.sin(a) * 0.055], [[mb, 1]]); }
      for (let k = 0; k < N; k++) head.ix.push(base, base + 1 + k, base + 1 + (k + 1) % N); }
    // eyes
    for (const L of ['L', 'R']) {
      const c = abs['eye' + L], eb = BI['eye' + L];
      grid(eyes, 14, 20, true, (i, j) => { const th2 = i / 13 * Math.PI, u = j / 20; return [c[0] - Math.cos(u * Math.PI * 2) * Math.sin(th2) * eyeR, c[1] + Math.cos(th2) * eyeR, c[2] + Math.sin(u * Math.PI * 2) * Math.sin(th2) * eyeR]; },
        (i, j) => [j / 20, 1 - i / 13], () => [[eb, 1]], () => c);
    }

    // ---- hair ----
    const hcol = new THREE.Color(ch.hair).convertSRGBToLinear(), hairRGB = k => [hcol.r * k, hcol.g * k, hcol.b * k];
    const R = G.rngF(key.length * 131 + 7);
    const longHair = ch.style === 'long';
    const hairW = p => { if (!longHair) return [[hb, 1]]; const t = sm(hc[1] - 0.05 * H, hc[1] - 0.25 * H, p[1]); return [[hb, 1 - t * 0.7], [BI.chest, t * 0.7]]; };
    // shell
    grid(hair, nr, ncH, true, (i, j) => { const u = unitAt(i, j), a = hairAbove(ch.style, u[0], u[1], u[2]), p = headPos(u), d = nrm(sub(p, hc)), off = lerp(-0.012, 0.005, sm(-0.07, 0.05, a)) * hsz; return [p[0] + d[0] * off, p[1] + d[1] * off, p[2] + d[2] * off]; },
      () => [0, 0], hairW, () => hc, () => hairRGB(0.72));
    const pushOut = (p) => { // keep long hair outside the torso
      if (p[1] > (B.neck + 0.01) * H || p[1] < 0.48 * H) return p;
      const [r, wz, zo] = P.torsoAt(p[1]), rx = r * 1.1 + 0.01, rz = r * wz * 1.1 + 0.012, dz = p[2] - zo, d = Math.hypot(p[0] / rx, dz / rz);
      if (d < 1) return [p[0] / (d || 1), p[1], zo + dz / (d || 1)];
      return p;
    };
    const lock = (root, dir, len, w, thick, sag, curl, colK, out, tip = 0.8) => {
      const nS = 7, nR = 5, down = [0, -1, 0];
      const p1 = [root[0] + dir[0] * len * 0.45, root[1] + dir[1] * len * 0.45, root[2] + dir[2] * len * 0.45];
      const d2 = nrm([dir[0] * (1 - sag) + down[0] * sag + (curl ? curl[0] : 0), dir[1] * (1 - sag) + down[1] * sag + (curl ? curl[1] : 0), dir[2] * (1 - sag) + down[2] * sag + (curl ? curl[2] : 0)]);
      const p2 = [p1[0] + d2[0] * len * 0.55, p1[1] + d2[1] * len * 0.55, p1[2] + d2[2] * len * 0.55];
      const bez = t => { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; return [a * root[0] + b * p1[0] + c * p2[0], a * root[1] + b * p1[1] + c * p2[1], a * root[2] + b * p1[2] + c * p2[2]]; };
      const cen = []; for (let i = 0; i < nS; i++) { let q = bez(i / (nS - 1)); if (out) q = out(q); cen.push(q); }
      grid(hair, nS, nR, true, (i, j) => {
        const c = cen[i], tg = nrm(sub(cen[Math.min(nS - 1, i + 1)], cen[Math.max(0, i - 1)])), rad = nrm(sub(c, hc));
        const bx = nrm(cross(tg, rad)), by = cross(bx, tg), a = j / nR * Math.PI * 2, t = i / (nS - 1), ww = w * (1 - tip * Math.pow(t, 1.4));
        return [c[0] + (bx[0] * Math.cos(a) * ww + by[0] * Math.sin(a) * ww * thick), c[1] + (bx[1] * Math.cos(a) * ww + by[1] * Math.sin(a) * ww * thick), c[2] + (bx[2] * Math.cos(a) * ww + by[2] * Math.sin(a) * ww * thick)];
      }, () => [0, 0], hairW, p => { let best = cen[0], bd = 1e9; for (const c of cen) { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = c; } } return best; },
      (p, i) => hairRGB(colK * (0.8 + 0.35 * i / (nS - 1))));
    };
    const roots = []; { const n = 420, ga = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), a = ga * i; const u = [Math.cos(a) * r, y, Math.sin(a) * r]; if (hairAbove(ch.style, u[0], u[1], u[2]) > 0.02) roots.push(u); } }
    const rootAt = u => { const p = headPos(u), d = nrm(sub(p, hc)); return { p: [p[0] + d[0] * 0.004 * hsz, p[1] + d[1] * 0.004 * hsz, p[2] + d[2] * 0.004 * hsz], d, u }; };
    const take = (k) => { const out = []; const step = roots.length / k; for (let i = 0; i < k; i++) out.push(roots[Math.floor(i * step + R() * step * 0.8) % roots.length]); return out; };
    const S = hsz;
    if (ch.style === 'spiky') {
      for (const u of take(78)) { const r = rootAt(u); let d = nrm([r.d[0] * 0.8, r.d[1] * 0.8 + 0.55, r.d[2] * 0.8 - 0.35]);
        if (u[2] > 0.55 && u[1] < 0.75) d = nrm([r.d[0] * 0.3 + (R() - 0.5) * 0.3, 0.35, 0.9]);
        lock(r.p, d, (0.045 + R() * 0.035) * S, 0.012 * S, 0.5, 0.05, [(R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3], 0.95 + R() * 0.2); }
    } else if (ch.style === 'messy') {
      for (const u of take(96)) { const r = rootAt(u), tb = nrm(cross(r.d, [0, 1, 0.001])), td = nrm(cross(tb, r.d));
        let d = nrm([td[0] * 0.8 + r.d[0] * 0.15 + tb[0] * (R() - 0.5) * 0.7, td[1] * 0.8 + r.d[1] * 0.15 + (R() - 0.5) * 0.3, td[2] * 0.8 + r.d[2] * 0.15 + tb[2] * (R() - 0.5) * 0.7 - 0.25]);
        if (u[2] > 0.45 && u[1] > 0.2) d = nrm([(u[0] >= 0 ? 0.6 : -0.6) + (R() - 0.5) * 0.3, -0.35, 0.75]);
        lock(r.p, d, (0.06 + R() * 0.04) * S, 0.02 * S, 0.38, 0.65, [r.d[0] * 0.12, 0.02, r.d[2] * 0.12], 0.9 + R() * 0.25, null, 0.6); }
    } else if (ch.style === 'long') {
      for (const u of take(170)) { const r = rootAt(u); const front = u[2] > 0.62 && u[1] > 0.3;
        if (front) { lock(r.p, nrm([u[0] * 0.9 + 0.45, -0.4, 0.8]), (0.055 + R() * 0.02) * S, 0.022 * S, 0.3, 0.4, null, 1.0); continue; }
        const sideF = u[2] > 0.05, sx = u[0] >= 0 ? 1 : -1;
        if (sideF) { lock(r.p, nrm([sx * 0.55 + r.d[0] * 0.2, -0.6, -0.05]), (0.26 + R() * 0.06) * S, 0.024 * S, 0.3, 0.9, [sx * 0.25, 0, -0.1], 0.9 + R() * 0.25, pushOut); continue; }
        lock(r.p, nrm([r.d[0] * 0.4, -0.45, r.d[2] * 0.4 - 0.25]), (0.38 + R() * 0.1) * S, 0.026 * S, 0.3, 0.9, [r.d[0] * 0.15, 0, -0.18], 0.9 + R() * 0.25, pushOut); }
    } else if (ch.style === 'bob') {
      const jawY = hc[1] - 0.72 * RY;
      for (const u of take(140)) { const r = rootAt(u); const front = u[2] > 0.6 && u[1] > 0.28;
        if (front) { lock(r.p, nrm([0.55, -0.45, 0.7]), (0.085 + R() * 0.03) * S, 0.022 * S, 0.32, 0.3, null, 1.0); continue; }
        const len = Math.max(0.05 * S, (r.p[1] - jawY) * 1.12);
        lock(r.p, nrm([r.d[0] * 0.45, -0.75, r.d[2] * 0.45 - 0.05]), len, 0.024 * S, 0.34, 0.75, [-r.d[0] * 0.45, 0, -r.d[2] * 0.35], 0.9 + R() * 0.25); }
      // daisy clip over the left ear
      const cc = headPos([0.78, 0.38, 0.5]), dd = nrm(sub(cc, hc)); const ccp = [cc[0] + dd[0] * 0.012, cc[1] + dd[1] * 0.012, cc[2] + dd[2] * 0.012];
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, ax = nrm(cross(dd, [0, 0, 1])), ay = cross(dd, ax), pd = [ax[0] * Math.cos(a) + ay[0] * Math.sin(a), ax[1] * Math.cos(a) + ay[1] * Math.sin(a), ax[2] * Math.cos(a) + ay[2] * Math.sin(a)];
        const b0 = hair.count; lock(ccp, pd, 0.016 * S, 0.006 * S, 0.3, 0, null, 0, null); for (let q = b0; q < hair.count; q++) { hair.c[q * 3] = 1.3; hair.c[q * 3 + 1] = 1.3; hair.c[q * 3 + 2] = 1.2; } }
      grid(hair, 6, 8, true, (i, j) => { const th2 = i / 5 * Math.PI, a = j / 8 * Math.PI * 2; return [ccp[0] + Math.sin(th2) * Math.cos(a) * 0.005 * S + dd[0] * 0.003, ccp[1] + Math.cos(th2) * 0.005 * S + dd[1] * 0.003, ccp[2] + Math.sin(th2) * Math.sin(a) * 0.005 * S + dd[2] * 0.003]; }, () => [0, 0], () => [[hb, 1]], () => ccp, () => [0.95, 0.7, 0.1]);
    } else if (ch.style === 'bun') {
      const bunC = headPos([0, 0.5, -0.86]); bunC[1] += 0.01 * S; bunC[2] -= 0.03 * S;
      for (const u of take(70)) { const r = rootAt(u); if (u[2] < -0.5 && u[1] > 0.2) continue; const to = nrm(sub(bunC, r.p)), dd = nrm([to[0] + r.d[0] * 0.05, to[1] + r.d[1] * 0.05, to[2] + r.d[2] * 0.05]);
        const len = Math.hypot(...sub(bunC, r.p)) * 0.95; lock(r.p, dd, len, 0.014 * S, 0.35, 0, [r.d[0] * 0.12, r.d[1] * 0.12, r.d[2] * 0.12], R() < 0.15 ? 1.6 : 0.9 + R() * 0.2); }
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, ry = (R() - 0.5) * 0.6; const p = [bunC[0] + Math.cos(a) * 0.028 * S, bunC[1] + ry * 0.03 * S, bunC[2] + Math.sin(a) * 0.024 * S - 0.005];
        lock(p, nrm([-Math.sin(a), (R() - 0.5) * 0.4, Math.cos(a)]), 0.07 * S, 0.02 * S, 0.6, 0, [-Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6], 0.85 + R() * 0.2); }
      grid(hair, 10, 14, true, (i, j) => { const th2 = i / 9 * Math.PI, a = j / 14 * Math.PI * 2; return [bunC[0] + Math.sin(th2) * Math.cos(a) * 0.03 * S, bunC[1] + Math.cos(th2) * 0.027 * S, bunC[2] + Math.sin(th2) * Math.sin(a) * 0.026 * S]; }, () => [0, 0], () => [[hb, 1]], () => bunC, () => hairRGB(0.7));
      for (const s of [-1, 1]) { const r = rootAt([s * 0.76, 0.3, 0.55]); lock(r.p, nrm([s * 0.35, -0.8, 0.2]), 0.075 * S, 0.0045 * S, 0.5, 0.7, [s * 0.2, 0, 0], 1.1); }
    }
    if (ch.style === 'long') { // little white star clip
      const cc = headPos([-0.72, 0.42, 0.55]), dd = nrm(sub(cc, hc)), ccp = [cc[0] + dd[0] * 0.01, cc[1] + dd[1] * 0.01, cc[2] + dd[2] * 0.01];
      grid(hair, 5, 10, true, (i, j) => { const th2 = i / 4 * Math.PI, a = j / 10 * Math.PI * 2, rr = (j % 2 ? 0.004 : 0.009) * S; return [ccp[0] + Math.sin(th2) * Math.cos(a) * rr, ccp[1] + Math.cos(th2) * 0.003 * S, ccp[2] + Math.sin(th2) * Math.sin(a) * rr]; }, () => [0, 0], () => [[hb, 1]], () => ccp, () => [1.4, 1.4, 1.3]);
    }
    // brows (hair material, own bones)
    for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
      const bb = BI['brow' + L], N = 9;
      grid(hair, 3, N, false, (i, j) => {
        const t = j / (N - 1), ux = s * lerp(0.15, 0.64, t), arch = 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.25)), th = lerp(0.055, 0.02, t) * (key === 'luke' ? 1.25 : 1);
        const uy = 0.27 + arch + (i - 1) * th * 0.5 - t * 0.03; const p = headPos([ux, uy, Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy))]), d = nrm(sub(p, hc));
        const o2 = (i === 1 ? 0.0028 : 0.0016) * hsz; return [p[0] + d[0] * o2, p[1] + d[1] * o2, p[2] + d[2] * o2];
      }, () => [0, 0], () => [[bb, 1]], () => hc, () => hairRGB(0.35));
    }

    // ---- materials + meshes ----
    const skel = new THREE.Skeleton(bones);
    const mk = (acc, mat) => { const g = acc.geo(); g.boundingSphere = new THREE.Sphere(new V3(0, H * 0.5, 0), H * 0.95); const m = new THREE.SkinnedMesh(g, mat); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = true; m.layers.enable(1); P.root.add(m); return m; };
    P.bodyMat = new THREE.MeshPhongMaterial({ map: T.bodyTex(key, variant), skinning: true, shininess: 6, specular: new THREE.Color(0x0a0a0a) });
    P.headMat = new THREE.MeshPhongMaterial({ map: T.faceTex(key, P.expr), skinning: true, shininess: 18, specular: new THREE.Color(0x15110f) });
    P.hairMat = new THREE.MeshPhongMaterial({ vertexColors: true, skinning: true, shininess: 22, specular: new THREE.Color(0x1c1c1c), emissive: hcol.clone().multiplyScalar(0.1) });
    P.eyeMat = new THREE.MeshPhongMaterial({ map: T.eyeTex(key, o.deadEyes), skinning: true, shininess: 90, specular: new THREE.Color(0x777777) });
    P.meshes = [mk(body, P.bodyMat), mk(head, P.headMat), mk(hair, P.hairMat), mk(eyes, P.eyeMat)];
    P.root.updateMatrixWorld(true);
    P.meshes.forEach(m => m.bind(skel));
    P.skel = skel;
    // ---- pose state ----
    P.Q = {}; P.Qw = {}; P.cur = {};
    for (const j of JOINTS) { P.Q[j] = [0, 0, 0]; P.Qw[j] = [0, 0, 0]; P.cur[j] = [0, 0, 0]; }
    P.Q.pp = [0, 0, 0]; P.Qw.pp = [0, 0, 0]; P.cur.pp = [0, 0, 0];
    P.look = [0, 0]; P.gaze = [0, 0]; P.sacc = [0, 0]; P.saccT = 1;
    P.browRest = { L: P.rest.browL.clone(), R: P.rest.browR.clone() };
    P.hands = { L: P.bones.wrL, R: P.bones.wrR };
    P.eyeR = eyeR; P.headC = hc;
    P.setExpr = (e) => { if (!e || e === P.expr) return; P.expr = e; P.headMat.map = T.faceTex(key, e); P.headMat.needsUpdate = false; P.headMat.map.needsUpdate = false; };
    P.setVariant = (v) => { P.bodyMat.map = T.bodyTex(key, v); };
    P.hold = (prop, hand = 'R', pos, rot) => {
      P.drop(hand); const g = new THREE.Group(); g.add(prop); prop.traverse(m => { if (m.isMesh) { m.castShadow = true; m.layers.enable(1); } });
      const s = hand === 'L' ? 1 : -1, hy = -0.034 * H * B.armR / 0.9;
      g.position.set(pos ? pos[0] * s : -s * 0.004 * H, pos ? pos[1] : hy, pos ? pos[2] : 0.004 * H);
      if (rot) g.rotation.set(rot[0], rot[1] * s, rot[2] * s);
      P.hands[hand].add(g); P.props[hand] = g; P.grip = P.grip || {}; P.grip[hand] = 1; return g;
    };
    P.drop = (hand = 'R') => { const g = P.props[hand]; if (g) { g.parent.remove(g); P.props[hand] = null; if (P.grip) P.grip[hand] = 0; } };
    P.update = (dt, cam) => update(P, dt, cam);
    P.pose = (name, t) => { resetQ(P.Q, P); (ANIM[name] || ANIM.stand)(P.Q, t || 0, P); for (const j of JOINTS) { const q = P.Q[j]; P.bones[j].rotation.set(q[0], q[1], q[2]); P.cur[j][0] = q[0]; P.cur[j][1] = q[1]; P.cur[j][2] = q[2]; } const pp = P.Q.pp; P.bones.pelvis.position.set(P.rest.pelvis.x + pp[0], P.rest.pelvis.y + pp[1], P.rest.pelvis.z + pp[2]); };
    return P;
  };

  // ================= animation =================
  function resetQ(Q, P) {
    for (const j of JOINTS) { const q = Q[j]; q[0] = q[1] = q[2] = 0; }
    Q.pp[0] = Q.pp[1] = Q.pp[2] = 0;
    Q.shL[2] = 0.07; Q.shR[2] = -0.07; Q.elL[0] = -0.15; Q.elR[0] = -0.15;
    const g = P.grip || {};
    Q.fgL[2] = -(g.L ? 1.35 : 0.35); Q.fgR[2] = g.R ? 1.35 : 0.35; Q.thL[2] = g.L ? -0.5 : 0; Q.thR[2] = g.R ? 0.5 : 0;
  }
  const breathe = (Q, t, k = 1) => { const b = Math.sin(t * 1.7); Q.chest[0] += 0.015 * b * k; Q.shL[2] += 0.008 * b * k; Q.shR[2] -= 0.008 * b * k; Q.neck[0] -= 0.01 * b * k; };
  const setA = (Q, side, sx, sz, el, wr = 0, sy = 0) => { const s = side === 'L' ? 1 : -1; Q['sh' + side][0] = sx; Q['sh' + side][2] = sz * s; Q['sh' + side][1] = sy * s; Q['el' + side][0] = el; Q['wr' + side][0] = wr; };
  const sitBase = (Q, P, seatH) => {
    const H = P.H, B = P.B;
    Q.hipL[0] = Q.hipR[0] = -1.52; Q.knL[0] = Q.knR[0] = 1.5; Q.hipL[2] = 0.06; Q.hipR[2] = -0.06; Q.anL[0] = Q.anR[0] = 0.02;
    Q.pp[1] = seatH + 0.05 * H - B.hip * H; Q.pp[2] = -0.1 * H; Q.spine[0] = 0.05;
  };
  const ANIM = G.ANIM = {
    stand(Q, t, P) {
      breathe(Q, t);
      const w = Math.sin(t * 0.33), H = P.H;
      Q.pp[0] = 0.012 * H * w; Q.pelvis[2] = -0.035 * w; Q.spine[2] = 0.02 * w; Q.knL[0] = 0.06 + 0.1 * Math.max(0, -w); Q.knR[0] = 0.06 + 0.1 * Math.max(0, w); Q.hipL[0] = -0.04 * Math.max(0, -w); Q.hipR[0] = -0.04 * Math.max(0, w);
      Q.head[1] = 0.06 * Math.sin(t * 0.21); Q.head[0] = 0.02 * Math.sin(t * 0.29);
      const st = P.idle;
      if (st === 'clasp') { setA(Q, 'L', -0.35, -0.12, -0.95, 0.2, -0.3); setA(Q, 'R', -0.35, -0.12, -0.95, 0.2, -0.3); }
      else if (st === 'crossed') { setA(Q, 'L', -0.5, -0.2, -1.95, 0.1, -0.5); setA(Q, 'R', -0.55, -0.15, -1.85, 0.1, -0.5); }
      else if (st === 'pockets') { setA(Q, 'L', 0.12, 0.12, -0.35, 0.4); setA(Q, 'R', 0.12, 0.12, -0.35, 0.4); }
      else if (st === 'hips') { setA(Q, 'L', 0.15, 0.5, -1.5, 0.2, 0.9); setA(Q, 'R', 0.15, 0.5, -1.5, 0.2, 0.9); }
      if (P.style.slouch) { Q.spine[0] += 0.06; Q.neck[0] += 0.1; Q.head[0] += 0.05; }
    },
    sit(Q, t, P) { sitBase(Q, P, P.seatH || 0.46); breathe(Q, t); setA(Q, 'L', -0.3, 0.05, -0.95, 0.1, -0.2); setA(Q, 'R', -0.3, 0.05, -0.95, 0.1, -0.2); Q.head[1] = 0.05 * Math.sin(t * 0.25); },
    sitTable(Q, t, P) { sitBase(Q, P, P.seatH || 0.46); breathe(Q, t); Q.spine[0] = 0.12; setA(Q, 'L', -0.75, 0.1, -1.05, 0, -0.4); setA(Q, 'R', -0.75, 0.1, -1.05, 0, -0.4); Q.head[0] = 0.12; },
    eat(Q, t, P) {
      sitBase(Q, P, P.seatH || 0.46); breathe(Q, t); Q.spine[0] = 0.14;
      const u = (t * 0.42) % 1, lift = u < 0.35 ? sm(0, 0.35, u) : u < 0.55 ? 1 : 1 - sm(0.55, 0.85, u);
      setA(Q, 'L', -0.7, 0.12, -1.0, 0, -0.4);
      setA(Q, 'R', lerp(-0.72, -0.95, lift), lerp(0.05, -0.15, lift), lerp(-1.05, -2.15, lift), lerp(0.2, -0.3, lift), -0.2);
      Q.head[0] = lerp(0.3, 0.12, lift); Q.neck[0] = 0.08;
    },
    sitBed(Q, t, P) { sitBase(Q, P, 0.5); breathe(Q, t); setA(Q, 'L', -0.2, 0.2, -0.6, 0.3); setA(Q, 'R', -0.2, 0.2, -0.6, 0.3); Q.spine[0] = 0.1; Q.head[0] = 0.1; },
    lie(Q, t, P) {
      const H = P.H; Q.pelvis[0] = -Math.PI / 2; Q.pp[1] = (P.bedH !== undefined ? P.bedH : 0.55) + 0.06 * H - P.B.pel * H; Q.pp[2] = 0;
      Q.knL[0] = 0.08; Q.knR[0] = 0.06; Q.anL[0] = 0.5; Q.anR[0] = 0.45; Q.hipL[2] = 0.05; Q.hipR[2] = -0.05;
      setA(Q, 'L', 0.0, 0.12, -0.25); setA(Q, 'R', 0.0, 0.12, -0.25); Q.head[0] = 0.28; Q.neck[0] = 0.08; Q.chest[0] = 0.01 * Math.sin(t * 1.3);
      Q.head[1] = 0.25 * Math.sin(t * 0.1) * (P.sleep ? 0.3 : 1);
    },
    sitUp(Q, t, P) {
      const H = P.H; Q.hipL[0] = Q.hipR[0] = -1.45; Q.knL[0] = 0.1; Q.knR[0] = 0.15; Q.anL[0] = Q.anR[0] = 0.3; Q.pp[1] = (P.bedH !== undefined ? P.bedH : 0.55) + 0.03 * H - P.B.hip * H; Q.pp[2] = -0.04 * H;
      Q.spine[0] = 0.08; breathe(Q, t); setA(Q, 'L', -0.35, 0.15, -0.7, 0.2); setA(Q, 'R', -0.35, 0.15, -0.7, 0.2);
    },
    phone(Q, t, P) {
      ANIM.stand(Q, t, P); setA(Q, 'R', -0.42, -0.05, -1.55, 0.15, -0.35); setA(Q, 'L', -0.4, -0.1, -1.45, 0.1, -0.45);
      Q.head[0] = 0.42; Q.neck[0] = 0.15; Q.thR[0] = 0.12 * Math.max(0, Math.sin(t * 3.1));
      if (Math.sin(t * 0.7) > 0.95) { Q.chest[0] -= 0.05 * Math.sin(t * 30); }
    },
    phoneSit(Q, t, P) { sitBase(Q, P, P.seatH || 0.5); breathe(Q, t); Q.spine[0] = 0.18; setA(Q, 'R', -0.5, -0.05, -1.6, 0.15, -0.35); setA(Q, 'L', -0.48, -0.1, -1.5, 0.1, -0.45); Q.head[0] = 0.4; Q.neck[0] = 0.15; Q.thR[0] = 0.12 * Math.max(0, Math.sin(t * 3.1)); },
    phoneUp(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'R', -2.95, -0.1, -0.25, 0.1); setA(Q, 'L', 0.1, 0.45, -1.4, 0.2, 0.8); Q.head[0] = -0.5; Q.neck[0] = -0.15; Q.spine[0] = -0.06; Q.shR[0] += 0.06 * Math.sin(t * 1.4); },
    chop(Q, t, P) {
      const u = (t % 1.7) / 1.7; let a, sp = 0, kn = 0.1, wr = 0;
      if (u < 0.55) { const e = sm(0, 0.55, u); a = lerp(-0.55, -2.95, e); sp = lerp(0.15, -0.12, e); wr = lerp(0.6, -0.3, e); }
      else if (u < 0.66) { const e = (u - 0.55) / 0.11; a = lerp(-2.95, -0.55, e * e); sp = lerp(-0.12, 0.4, e); kn = 0.1 + 0.25 * e; wr = lerp(-0.3, 0.9, e); }
      else { const e = sm(0.66, 1, u); a = -0.55; sp = lerp(0.4, 0.15, e); kn = lerp(0.35, 0.1, e); wr = 0.6; }
      Q.shL[0] = a; Q.shR[0] = a; Q.shL[2] = -0.22; Q.shR[2] = 0.22; Q.elL[0] = Q.elR[0] = -0.35; Q.wrL[0] = Q.wrR[0] = wr;
      Q.spine[0] = sp; Q.chest[0] = sp * 0.5; Q.knL[0] = Q.knR[0] = kn; Q.hipL[0] = Q.hipR[0] = -kn * 0.6; Q.hipL[2] = 0.12; Q.hipR[2] = -0.12; Q.head[0] = 0.25;
    },
    cook(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'R', -0.75 + 0.08 * Math.sin(t * 3), -0.2 + 0.12 * Math.cos(t * 3), -1.15, 0.2, -0.3); setA(Q, 'L', -0.6, 0.15, -0.9, 0.2, -0.3); Q.head[0] = 0.38; Q.spine[0] = 0.08; },
    laundry(Q, t, P) { ANIM.stand(Q, t, P); const k = Math.sin(t * 1.2); setA(Q, 'R', -2.35 + 0.2 * k, -0.15, -0.55); setA(Q, 'L', -2.25 - 0.2 * k, -0.15, -0.6); Q.head[0] = -0.25; },
    sketch(Q, t, P) { sitBase(Q, P, P.seatH || 0.46); breathe(Q, t); Q.spine[0] = 0.15; setA(Q, 'L', -0.55, 0.05, -1.55, 0.2, -0.5); setA(Q, 'R', -0.5, -0.05, -1.5 + 0.12 * Math.sin(t * 5.3), 0.15 * Math.sin(t * 3.7), -0.3); Q.head[0] = 0.42; Q.head[1] = 0.12; },
    brush(Q, t, P) { ANIM.sitBed(Q, t, P); setA(Q, 'R', -1.4, -1.15, -1.9 + 0.35 * Math.sin(t * 2.4), 0.2); setA(Q, 'L', -0.3, 0.25, -0.8); Q.head[2] = -0.18; Q.head[0] = 0.05; },
    water(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'R', -0.95, -0.05, -0.6, 0.55 + 0.15 * Math.sin(t * 2), -0.2); Q.spine[0] = 0.22; Q.head[0] = 0.4; },
    crouch(Q, t, P) { const H = P.H; Q.hipL[0] = Q.hipR[0] = -1.95; Q.knL[0] = Q.knR[0] = 2.25; Q.anL[0] = Q.anR[0] = -0.35; Q.hipL[2] = 0.25; Q.hipR[2] = -0.25; Q.pp[1] = -0.3 * H; Q.pp[2] = -0.05 * H; Q.spine[0] = 0.45; setA(Q, 'L', -0.9, 0.1, -0.4); setA(Q, 'R', -1.0 + 0.15 * Math.sin(t * 2.2), -0.05, -0.35 + 0.2 * Math.sin(t * 2.2)); Q.head[0] = 0.35; },
    kneel(Q, t, P) { const H = P.H; Q.hipL[0] = -1.55; Q.knL[0] = 1.55; Q.hipR[0] = 0.05; Q.knR[0] = 1.55; Q.anR[0] = 0.6; Q.pp[1] = -0.245 * H; Q.spine[0] = 0.25; breathe(Q, t); setA(Q, 'L', -0.7, 0.1, -0.5); setA(Q, 'R', -0.8, -0.05, -0.4); Q.head[0] = 0.3; },
    carry(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'L', -0.5, -0.12, -1.35, 0, -0.3); setA(Q, 'R', -0.5, -0.12, -1.35, 0, -0.3); },
    carryR(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'R', -0.35, 0.0, -1.45, 0.0, -0.2); },
    hug(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'L', -1.15, -0.35, -1.15, 0.2); setA(Q, 'R', -1.15, -0.35, -1.15, 0.2); Q.spine[0] = 0.1; Q.head[0] = 0.25; Q.head[2] = 0.15; },
    wave(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'R', -0.4, 2.3, -0.7 - 0.4 * Math.sin(t * 8)); },
    point(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'R', -2.15, 0.1, -0.08); Q.head[0] = -0.35; },
    yell(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'L', -1.2, 0.4, -2.35, 0.3, -0.3); setA(Q, 'R', -1.2, 0.4, -2.35, 0.3, -0.3); Q.head[0] = -0.2; Q.spine[0] = -0.1; },
    crossed(Q, t, P) { const s = P.idle; P.idle = 'crossed'; ANIM.stand(Q, t, P); P.idle = s; },
    think(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'R', -0.55, -0.1, -2.3, 0.3, -0.3); setA(Q, 'L', -0.45, -0.2, -1.6, 0, -0.4); Q.head[0] = 0.15; },
    sad(Q, t, P) { ANIM.stand(Q, t, P); Q.head[0] = 0.45; Q.neck[0] = 0.2; Q.spine[0] = 0.12; Q.shL[2] = 0.02; Q.shR[2] = -0.02; },
    sharpen(Q, t, P) { sitBase(Q, P, P.seatH || 0.46); Q.spine[0] = 0.22; const k = Math.sin(t * 3.4); setA(Q, 'L', -0.65, 0.15, -1.15, 0.2, -0.4); setA(Q, 'R', -0.65 + 0.12 * k, 0.05, -1.05 + 0.25 * k, 0.1, -0.3); Q.head[0] = 0.42; },
    axeUp(Q, t, P) { ANIM.stand(Q, t, P); Q.shL[0] = Q.shR[0] = -2.85; Q.shL[2] = -0.2; Q.shR[2] = 0.2; Q.elL[0] = Q.elR[0] = -0.5; Q.wrL[0] = Q.wrR[0] = -0.3; Q.spine[0] = -0.12; Q.head[0] = 0.2; },
    axeDown(Q, t, P) { ANIM.stand(Q, t, P); Q.shL[0] = Q.shR[0] = -0.75; Q.shL[2] = -0.2; Q.shR[2] = 0.2; Q.elL[0] = Q.elR[0] = -0.2; Q.wrL[0] = Q.wrR[0] = 0.9; Q.spine[0] = 0.45; Q.knL[0] = Q.knR[0] = 0.3; Q.head[0] = 0.5; },
    scrub(Q, t, P) { ANIM.stand(Q, t, P); const k = Math.sin(t * 7); setA(Q, 'L', -0.75 + 0.05 * k, -0.25, -1.2, 0.2); setA(Q, 'R', -0.75 - 0.05 * k, -0.25, -1.2, 0.2); Q.spine[0] = 0.3; Q.head[0] = 0.4; },
    sitFloor(Q, t, P) { const H = P.H; Q.hipL[0] = Q.hipR[0] = -1.45; Q.knL[0] = 0.5; Q.knR[0] = 0.9; Q.hipR[2] = -0.1; Q.anL[0] = 0.3; Q.pp[1] = 0.05 * H - P.B.hip * H; Q.pp[2] = -0.08 * H; breathe(Q, t); setA(Q, 'L', 0.55, 0.2, -0.15, -0.9); setA(Q, 'R', 0.55, 0.2, -0.15, -0.9); Q.spine[0] = -0.12; },
    stargaze(Q, t, P) { ANIM.sitFloor(Q, t, P); Q.head[0] = -0.55; Q.neck[0] = -0.2; },
    sitStep(Q, t, P) { sitBase(Q, P, 0.22); Q.knL[0] = Q.knR[0] = 2.0; Q.hipL[0] = Q.hipR[0] = -1.75; breathe(Q, t); setA(Q, 'L', -0.55, 0.1, -1.2, 0.2, -0.3); setA(Q, 'R', -0.55, 0.1, -1.2, 0.2, -0.3); Q.spine[0] = 0.25; },
    lean(Q, t, P) { ANIM.stand(Q, t, P); Q.spine[0] = 0.25; setA(Q, 'L', -1.1, 0.2, -0.9, 0.3); setA(Q, 'R', -1.1, 0.2, -0.9, 0.3); },
    flinch(Q, t, P) { ANIM.stand(Q, t, P); setA(Q, 'L', -1.8, -0.3, -2.0); setA(Q, 'R', -1.8, -0.3, -2.0); Q.spine[0] = 0.2; Q.head[0] = 0.3; }
  };
  ANIM.walk = function (Q, t, P) {
    const ph = P.walkPhase, s = Math.sin(ph), c = Math.cos(ph), st = P.style, run = clamp((P.speed - 2.0) / 1.5, 0, 1);
    const A = (st.arm || 0.36) * (1 + run * 0.6), L = 0.42 * (1 + run * 0.35), H = P.H;
    Q.hipL[0] = -L * s; Q.hipR[0] = L * s;
    Q.knL[0] = 0.08 + (0.75 + run * 0.5) * Math.pow(Math.max(0, c), 1.5); Q.knR[0] = 0.08 + (0.75 + run * 0.5) * Math.pow(Math.max(0, -c), 1.5);
    Q.anL[0] = -(Q.hipL[0] + Q.knL[0]) * 0.7 - 0.12 * s; Q.anR[0] = -(Q.hipR[0] + Q.knR[0]) * 0.7 + 0.12 * s;
    Q.pp[1] = (0.011 * Math.cos(2 * ph) - 0.008) * H * (st.bob || 1) * (1 + run);
    Q.pelvis[1] = -0.09 * s; Q.pelvis[2] = (st.sway || 0.03) * c; Q.chest[1] = 0.13 * s; Q.head[1] = -0.05 * s;
    Q.spine[0] = (st.lean || 0.03) + run * 0.14; Q.neck[0] = st.head || 0;
    Q.shL[0] = A * s; Q.shR[0] = -A * s; Q.shL[2] = 0.08; Q.shR[2] = -0.08;
    Q.elL[0] = -0.22 - (0.35 + run * 0.8) * Math.max(0, -s); Q.elR[0] = -0.22 - (0.35 + run * 0.8) * Math.max(0, s);
    if (P.carryArm) setA(Q, 'R', -0.35, 0.0, -1.45, 0.0, -0.2);
    if (P.phoneWalk) { setA(Q, 'R', -0.42, -0.05, -1.55, 0.15, -0.35); Q.head[0] = 0.35; }
  };
  const GEST = (Q, t, P, amt) => { // additive talking gestures
    const a = Math.sin(t * 2.1) * 0.5 + Math.sin(t * 3.3) * 0.5, b = Math.sin(t * 1.7 + 1);
    if (!P.props.R) { Q.shR[0] += (-0.25 - 0.2 * a) * amt; Q.elR[0] += (-0.7 - 0.3 * b) * amt; Q.wrR[0] += 0.2 * a * amt; Q.shR[1] += -0.2 * amt; }
    if (!P.props.L) { Q.shL[0] += (-0.1 - 0.1 * b) * amt * 0.6; Q.elL[0] += (-0.35 - 0.2 * a) * amt * 0.6; }
    Q.head[0] += 0.05 * Math.sin(t * 4.7) * amt; Q.head[2] += 0.04 * Math.sin(t * 2.3) * amt;
  };
  const EXPR = G.EXPR = {
    neutral: [0, 0, 0, 0], soft: [0.05, 0.05, 0.05, 0], happy: [0.15, 0, 0.12, 0], grin: [0.2, 0, 0.15, 0.3], laugh: [0.3, 0.1, 0.35, 0.5],
    sad: [0.08, 0.4, 0.2, 0], cry: [0.1, 0.5, 0.3, 0.08], worried: [0.25, 0.35, -0.05, 0.03], angry: [-0.3, -0.4, 0.18, 0], scared: [0.5, 0.25, -0.3, 0.25],
    tired: [0, 0.15, 0.28, 0], dark: [-0.12, -0.1, 0.32, 0], creepy: [0.1, -0.05, -0.12, 0.08], blood: [0.1, -0.05, -0.12, 0.08], yell: [0.15, -0.25, -0.1, 0.7],
    dead: [0, 0, 0.55, 0.1], deadBlood: [0, 0, 0.6, 0.1], rot: [0, 0, 0.4, 0.3], sleep: [0, 0, 0.9, 0]
  };
  const tmpV = new V3(), tmpM = new THREE.Matrix4();
  function update(P, dt, camPos) {
    P.t += dt; P.animT += dt;
    const Q = P.Q, Qw = P.Qw;
    resetQ(Q, P); (ANIM[P.anim] || ANIM.stand)(Q, P.animT, P);
    const ww = P.walkW;
    if (ww > 0.001) { resetQ(Qw, P); ANIM.walk(Qw, P.t, P); for (const j of JOINTS) { const a = Q[j], b = Qw[j]; a[0] = lerp(a[0], b[0], ww); a[1] = lerp(a[1], b[1], ww); a[2] = lerp(a[2], b[2], ww); } for (let i = 0; i < 3; i++) Q.pp[i] = lerp(Q.pp[i], Qw.pp[i], ww); }
    const talkAmt = P.talk * (P.anim === 'stand' || P.anim === 'sit' || P.anim === 'sitTable' || P.anim === 'sitBed' ? 1 : 0.3) * (1 - ww);
    if (talkAmt > 0.01) GEST(Q, P.t, P, talkAmt);
    // head look-at (additive, clamped)
    let ly = 0, lp = 0;
    if (P.lookAt) {
      P.bones.chest.updateWorldMatrix(true, false);
      tmpM.copy(P.bones.chest.matrixWorld).invert(); tmpV.copy(P.lookAt).applyMatrix4(tmpM);
      const ny = P.bones.neck.position.y + P.bones.head.position.y + 0.05 * P.H;
      ly = clamp(Math.atan2(tmpV.x, tmpV.z), -1.15, 1.15); lp = clamp(-Math.atan2(tmpV.y - ny, Math.hypot(tmpV.x, tmpV.z)), -0.6, 0.6);
      if (Math.abs(Math.atan2(tmpV.x, tmpV.z)) > 2.2) { ly = 0; lp = 0; }
    }
    const lk = 1 - Math.exp(-dt * 5); P.look[0] += (ly - P.look[0]) * lk; P.look[1] += (lp - P.look[1]) * lk;
    Q.neck[1] += P.look[0] * 0.4; Q.head[1] += P.look[0] * 0.6; Q.neck[0] += P.look[1] * 0.4; Q.head[0] += P.look[1] * 0.6;
    // blend toward target pose
    const k = 1 - Math.exp(-dt * (P.blendRate || 10));
    for (const j of JOINTS) { const q = Q[j], c = P.cur[j]; c[0] += (q[0] - c[0]) * k; c[1] += (q[1] - c[1]) * k; c[2] += (q[2] - c[2]) * k; P.bones[j].rotation.set(c[0], c[1], c[2]); }
    for (let i = 0; i < 3; i++) P.cur.pp[i] += (Q.pp[i] - P.cur.pp[i]) * k;
    P.bones.pelvis.position.set(P.rest.pelvis.x + P.cur.pp[0], P.rest.pelvis.y + P.cur.pp[1], P.rest.pelvis.z + P.cur.pp[2]);
    face(P, dt);
  }
  function face(P, dt) {
    const e = EXPR[P.expr] || EXPR.neutral, H = P.H, noBlink = P.expr === 'dead' || P.expr === 'rot' || P.expr === 'deadBlood' || P.expr === 'sleep' || P.sleep;
    P.blinkT -= dt;
    if (P.blinkT <= 0 && !noBlink) { P.blink = 0.14; P.blinkT = 1.8 + Math.random() * 4.5; }
    let bl = 0; if (P.blink > 0) { P.blink -= dt; bl = Math.sin(clamp(1 - P.blink / 0.14, 0, 1) * Math.PI); }
    const lid = clamp(e[2] + (P.sleep ? 0.9 : 0) + bl * 0.95, -0.35, 0.82);
    P.bones.lidL.rotation.x = P.bones.lidR.rotation.x = lid;
    // gaze
    P.saccT -= dt; if (P.saccT <= 0) { P.saccT = 0.6 + Math.random() * 2.2; P.sacc[0] = (Math.random() - 0.5) * 0.25; P.sacc[1] = (Math.random() - 0.5) * 0.12; }
    let gy = P.sacc[0], gp = P.sacc[1];
    if (P.gazeAt && !noBlink) {
      P.bones.head.updateWorldMatrix(true, false); tmpM.copy(P.bones.head.matrixWorld).invert(); tmpV.copy(P.gazeAt).applyMatrix4(tmpM);
      tmpV.y -= P.headC[1] - P.rest.head.y - P.rest.neck.y - P.rest.chest.y - P.rest.spine.y - P.rest.pelvis.y;
      gy = clamp(Math.atan2(tmpV.x, tmpV.z), -0.55, 0.55) + P.sacc[0] * 0.2; gp = clamp(-Math.atan2(tmpV.y, Math.hypot(tmpV.x, tmpV.z)), -0.4, 0.4) + P.sacc[1] * 0.2;
    }
    if (noBlink) { gy = 0.05; gp = 0.15; }
    const gk = 1 - Math.exp(-dt * 18); P.gaze[0] += (gy - P.gaze[0]) * gk; P.gaze[1] += (gp - P.gaze[1]) * gk;
    for (const b of [P.bones.eyeL, P.bones.eyeR]) b.rotation.set(P.gaze[1], P.gaze[0], 0);
    // brows
    const raise = e[0] * 0.012 * H / 1.75 + P.talkLevel * 0.002, inner = e[1] * 0.45;
    P.bones.browL.position.set(P.browRest.L.x, P.browRest.L.y + raise, P.browRest.L.z); P.bones.browR.position.set(P.browRest.R.x, P.browRest.R.y + raise, P.browRest.R.z);
    P.bones.browL.rotation.z = -inner; P.bones.browR.rotation.z = inner;
    // mouth
    const open = clamp(e[3] + P.talkLevel * 0.85, 0, 1.4);
    P.mouthO = (P.mouthO || 0) + (open - (P.mouthO || 0)) * (1 - Math.exp(-dt * 25));
    P.bones.mouth.scale.set(1 - P.mouthO * 0.15, 0.03 + P.mouthO, 1);
  }

  // ================= props =================
  const M = (c, s, o) => G.mat(c, s, o);
  G.makeProp = function (name, T) {
    const g = new THREE.Group(), add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
    const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);
    switch (name) {
      case 'axe':
        add(cyl(0.017, 0.02, 0.82, 8), M('#8a5e38', 10), 0, 0, 0.3, Math.PI / 2);
        add(new THREE.BoxGeometry(0.03, 0.2, 0.09), M('#55595e', 50), 0, 0.06, 0.67);
        add(new THREE.BoxGeometry(0.012, 0.18, 0.04), M('#c8ccd0', 90), 0, 0.15, 0.67);
        break;
      case 'phone': {
        add(new THREE.BoxGeometry(0.075, 0.008, 0.15), M('#151517', 60), 0, 0, 0);
        g.screen = add(new THREE.PlaneGeometry(0.068, 0.14), new THREE.MeshBasicMaterial({ color: G.C('#9ab8ff') }), 0, 0.0045, 0, -Math.PI / 2);
        break; }
      case 'mug':
        add(cyl(0.045, 0.04, 0.1, 14), M('#c84a3a', 30), 0, 0, 0, Math.PI / 2);
        add(new THREE.TorusGeometry(0.026, 0.008, 6, 10), M('#c84a3a', 30), 0.05, 0, 0, 0, Math.PI / 2);
        break;
      case 'book': case 'sketchbook':
        add(new THREE.BoxGeometry(0.02, 0.24, 0.17), M(name === 'book' ? '#6a2a22' : '#2a3a4a', 8), 0, 0, 0);
        add(new THREE.BoxGeometry(0.018, 0.235, 0.165), M('#efe7d6', 5), 0.002, 0, 0.003);
        break;
      case 'brush': add(cyl(0.012, 0.012, 0.18, 6), M('#6a4a3a', 10), 0, 0, 0.06, Math.PI / 2); add(new THREE.BoxGeometry(0.05, 0.025, 0.08), M('#2a2a2a', 10), 0, 0.012, 0.17); break;
      case 'spoon': add(cyl(0.005, 0.005, 0.16, 5), M('#c8c8c8', 80), 0, 0, 0.05, Math.PI / 2); add(new THREE.SphereGeometry(0.018, 8, 6), M('#c8c8c8', 80), 0, 0.003, 0.14).scale.set(1, 0.3, 1.4); break;
      case 'fork': add(cyl(0.004, 0.005, 0.17, 5), M('#c8c8c8', 80), 0, 0, 0.05, Math.PI / 2); add(new THREE.BoxGeometry(0.02, 0.003, 0.04), M('#c8c8c8', 80), 0, 0, 0.15); break;
      case 'can':
        add(cyl(0.07, 0.08, 0.18, 14), M('#5a7a6a', 40), 0, 0, 0, Math.PI / 2);
        add(cyl(0.012, 0.015, 0.22, 6), M('#5a7a6a', 40), 0.0, 0.08, 0.14, Math.PI / 2 - 0.9);
        break;
      case 'knife': add(new THREE.BoxGeometry(0.02, 0.025, 0.11), M('#2a1a10', 10), 0, 0, 0.02); add(new THREE.BoxGeometry(0.004, 0.035, 0.2), M('#d0d4d8', 100), 0, 0.004, 0.17); break;
      case 'stone': add(new THREE.BoxGeometry(0.05, 0.025, 0.18), M('#6a6a70', 20), 0, 0, 0); break;
      case 'crown': {
        const ring = new THREE.TorusGeometry(0.1, 0.012, 6, 18); add(ring, M('#4a7a2a', 5), 0, 0, 0, Math.PI / 2);
        const cols = ['#ff4fa0', '#7a6aff', '#ffffff', '#ffd040', '#6aa0ff'];
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(new THREE.SphereGeometry(0.018, 6, 4), M(cols[i % 5], 10), Math.cos(a) * 0.1, 0.01, Math.sin(a) * 0.1).scale.set(1, 0.6, 1); }
        break; }
      case 'flowers': {
        const cols = ['#ff4fa0', '#7a6aff', '#ffffff', '#ffd040'];
        for (let i = 0; i < 7; i++) { const a = i * 0.9, x = Math.cos(a) * 0.02, y = Math.sin(a) * 0.02; add(cyl(0.003, 0.003, 0.3, 4), M('#3a6a2a', 5), x, y, 0.12, Math.PI / 2 + (Math.random() - 0.5) * 0.2); add(new THREE.SphereGeometry(0.022, 6, 4), M(cols[i % 4], 10), x * 2, y * 2, 0.28); }
        break; }
      case 'headset':
        add(new THREE.TorusGeometry(0.085, 0.01, 6, 16, Math.PI), M('#1a1a1e', 40), 0, 0, 0, Math.PI / 2 + 0.25, 0, Math.PI / 2);
        for (const s of [-1, 1]) add(cyl(0.032, 0.032, 0.025, 12), M('#ff5fa8', 30), s * 0.085, 0, 0, 0, 0, Math.PI / 2);
        break;
      case 'bucket':
        add(new THREE.CylinderGeometry(0.15, 0.12, 0.28, 14, 1, true), M('#8a8a8a', 50, { side: THREE.DoubleSide }), 0, -0.2, 0);
        add(new THREE.TorusGeometry(0.15, 0.005, 4, 14, Math.PI), M('#5a5a5a', 30), 0, -0.06, 0, 0, 0, 0);
        break;
      case 'basket':
        add(new THREE.CylinderGeometry(0.2, 0.15, 0.16, 12, 1, true), M('#a07a40', 5, { side: THREE.DoubleSide }), 0, -0.25, 0);
        add(new THREE.TorusGeometry(0.2, 0.012, 4, 14, Math.PI), M('#8a6a30', 5), 0, -0.17, 0);
        break;
      case 'log': add(cyl(0.11, 0.11, 0.42, 8), M('#7a5634', 6), 0, 0, 0, 0, 0, Math.PI / 2); break;
    }
    return g;
  };

  // ================= first-person hands =================
  G.makeViewmodel = function (T) {
    const ch = G.CHARS.leon, root = new THREE.Group(), arm = new THREE.Group(); root.add(arm);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.36, 10), G.mat('#c98f2a', 5)); sleeve.rotation.x = Math.PI / 2; sleeve.position.z = 0.2; arm.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.04, 10), G.mat('#a87420', 5)); cuff.rotation.x = Math.PI / 2; cuff.position.z = 0.02; arm.add(cuff);
    const skin = G.mat(ch.skin, 12), hand = new THREE.Group(); hand.position.z = -0.02; arm.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), skin); palm.scale.set(0.035, 0.016, 0.045); palm.position.z = -0.04; hand.add(palm);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.008, 0.06, 6), skin); f.rotation.x = Math.PI / 2 - 0.9; f.position.set(-0.024 + i * 0.016, -0.018, -0.088); hand.add(f); }
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.008, 0.05, 6), skin); th.rotation.set(Math.PI / 2, 0, 0.9); th.position.set(-0.035, 0.0, -0.05); hand.add(th);
    root.arm = arm; root.hand = hand; root.items = {};
    root.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
    return root;
  };

  // ================= the basement =================
  G.makeBodies = function (scene, T) {
    const grp = new THREE.Group(); scene.add(grp);
    const meat = new THREE.MeshPhongMaterial({ map: T.meat, shininess: 60, specular: new THREE.Color(0x331111) }), bone = G.mat('#e6dcc6', 30), dark = G.mat('#2a0303', 80);
    const stump = (parent, x, y, z, rx, rz, r) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, 0, rz); parent.add(g);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r, r * 0.9, 12), meat); m.position.y = -r * 0.2; g.add(m);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, r * 0.08, 12), dark); d.position.y = -r * 0.66; g.add(d);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.33, r * 1.1, 8), bone); b.position.y = -r * 0.85; g.add(b);
      const k = new THREE.Mesh(new THREE.SphereGeometry(r * 0.36, 8, 6), bone); k.position.y = -r * 1.4; g.add(k);
      return g;
    };
    const lay = (P, x, y, z, yaw) => { P.root.position.set(x, y, z); P.root.rotation.y = yaw; grp.add(P.root); P.root.updateMatrixWorld(true); };
    // Luke: on the butcher table, rotting, butchered.
    const luke = G.makePerson('luke', T, { variant: 'rot', expr: 'rot', deadEyes: true });
    luke.bedH = 0.0; luke.pose('lie', 0);
    luke.bones.head.rotation.set(0.1, 0.55, 0.15); luke.bones.shR.rotation.set(0.1, 0, -0.5); luke.bones.elR.rotation.x = -0.2; luke.bones.knL.rotation.x = 0.15;
    luke.bones.hipR.scale.setScalar(0.001); luke.bones.shL.scale.setScalar(0.001);
    stump(luke.bones.pelvis, -luke.B.hx * luke.H, (luke.B.hip - luke.B.pel) * luke.H - 0.02, 0.0, 0, 0, 0.075);
    stump(luke.bones.chest, luke.B.sw * luke.H * 0.95, (luke.B.sh - luke.B.chest) * luke.H, -0.005, 0, Math.PI / 2, 0.055);
    { const c = luke.bones.chest, H = luke.H, d = luke.torsoAt(0.72 * H);
      const cav = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), dark); cav.scale.set(d[0] * 0.75, 0.02, 0.16 * H); cav.rotation.x = Math.PI / 2; cav.position.set(0, 0.0, d[0] * d[1] + 0.002); c.add(cav);
      const flesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), meat); flesh.scale.set(d[0] * 0.85, 0.012, 0.18 * H); flesh.rotation.x = Math.PI / 2; flesh.position.set(0, 0.0, d[0] * d[1] - 0.004); c.add(flesh);
      for (let i = 0; i < 5; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(d[0] * 0.55, 0.0055, 4, 12, Math.PI * 0.8), bone); rib.position.set(0, -0.05 * H + i * 0.028 * H, d[0] * d[1] - 0.012); rib.rotation.set(0, 0, Math.PI * 0.1); rib.scale.set(1, 0.4, 1); c.add(rib); } }
    lay(luke, -6.45, -2.1, 2.1, -Math.PI / 2);
    // Lily: on the floor under a soaked sheet
    const lily = G.makePerson('lily', T, { variant: 'dead', expr: 'dead', deadEyes: true });
    lily.bedH = 0.0; lily.pose('lie', 0); lily.bones.head.rotation.set(0.25, -0.7, 0); lily.bones.shR.rotation.set(-0.1, 0, -0.8); lily.bones.elR.rotation.x = -0.4;
    lay(lily, -8.6, -3.0, 2.1, Math.PI + 0.1);
    const sheetM = new THREE.MeshPhongMaterial({ map: T.sheet, shininess: 14, side: THREE.DoubleSide });
    { const sg = new THREE.PlaneGeometry(1.75, 1.05, 16, 9), p = sg.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const body = Math.exp(-(y * y) / 0.05) * (x > -0.6 ? 1 : 0.6); p.setZ(i, 0.26 * body * (x > 0.7 ? Math.max(0, 1 - (x - 0.7) * 4) : 1) + 0.03 * Math.sin(x * 9) * Math.cos(y * 7)); if (Math.abs(y) > 0.42) p.setZ(i, p.getZ(i) * 0.25); }
      sg.computeVertexNormals(); const sh = new THREE.Mesh(sg, sheetM); sh.rotation.x = -Math.PI / 2; sh.rotation.z = -Math.PI / 2 + 0.1; sh.position.set(-8.62, -2.99, 2.0); sh.castShadow = sh.receiveShadow = true; grp.add(sh); }
    // Rose: face down, reaching for the stairs, axe in her back
    const rose = G.makePerson('rose', T, { variant: 'deadRose', expr: 'deadBlood', deadEyes: true });
    rose.pose('stand', 0); const rb = rose.bones;
    rb.pelvis.rotation.x = Math.PI / 2; rb.pelvis.position.y = 0.07 * rose.H; rb.head.rotation.set(-0.3, 0.9, 0); rb.shR.rotation.set(-2.7, 0, -0.25); rb.elR.rotation.x = -0.25; rb.shL.rotation.set(-0.3, 0, 0.5); rb.elL.rotation.x = -1.2;
    rb.hipL.rotation.set(0.0, 0, 0.18); rb.knL.rotation.x = 0.06; rb.hipR.rotation.set(-0.05, 0, -0.08); rb.knR.rotation.x = 0.02; rb.anL.rotation.x = 0.9; rb.anR.rotation.x = 0.7;
    lay(rose, -4.55, -3.0, 2.05, Math.PI * 0.97);
    const axe = G.makeProp('axe'); axe.rotation.set(0.55, 0.15, 0.25);
    { const depth = rose.torsoAt(0.72 * rose.H), edge = new V3(0, 0.13, 0.67).applyEuler(axe.rotation); axe.position.set(0.03, 0.04 * rose.H, -depth[0] * depth[1] + 0.035).sub(edge); }
    rb.chest.add(axe);
    { const wound = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), dark), d = rose.torsoAt(0.72 * rose.H); wound.position.set(0.03, 0.04 * rose.H, -d[0] * d[1] - 0.004); wound.rotation.y = Math.PI; wound.scale.set(1.6, 0.8, 1); rb.chest.add(wound); }
    return { group: grp, luke, lily, rose, roseAxe: axe };
  };
})();
