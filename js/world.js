// The mountain homestead: terrain, cabin, garden, basement. Static geometry is merged per material.
G.buildWorld = function (scene, T) {
  const W = { colliders: [], chores: { water: [], weed: [], potato: [], tomato: [] }, plates: {}, seats: {} };
  const V3 = THREE.Vector3;

  // ---------- static merge builder ----------
  const groups = new Map();
  function addStatic(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, cast = true) {
    const m = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(1, 1, 1));
    geo = geo.index ? geo : geo; geo.applyMatrix4(m);
    const k = mat.uuid + (cast ? 'c' : '');
    if (!groups.has(k)) groups.set(k, { mat, cast, list: [] });
    groups.get(k).list.push(geo);
  }
  function boxUV(g, w, h, d, tile) {
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0] / tile, uv.getY(j) * dims[f][1] / tile);
    }
  }
  function box(mat, x0, y0, z0, x1, y1, z1, o = {}) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const g = new THREE.BoxGeometry(w, h, d);
    if (mat.userData.tile) boxUV(g, w, h, d, mat.userData.tile);
    addStatic(g, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o.rx || 0, o.ry || 0, o.rz || 0, o.cast !== false);
    if (o.col) W.colliders.push({ x0, z0, x1, z1, y0, y1 });
  }
  const phong = (map, tile, color, shin = 6) => { const m = new THREE.MeshPhongMaterial({ map, color: color || 0xffffff, shininess: shin }); m.userData.tile = tile; return m; };
  const M = {
    logs: phong(T.logs, 1.3), planks: phong(T.planks, 1.6), floor: phong(T.planks, 1.2, 0xb08a68), ceil: phong(T.planks, 1.4, 0x8a6a50),
    roof: phong(T.roof, 1.4), stone: phong(T.stone, 1.3), concrete: phong(T.concrete, 2.2), wood: phong(T.planks, 0.8, 0xd0a070),
    dark: phong(T.planks, 0.8, 0x6a4a32), soil: phong(T.soil, 1.2), iron: G.mat('#2a2a2c', 30), white: G.mat('#dcd8d0', 20),
    trim: phong(T.planks, 1, 0x5a3c26), beam: phong(T.logs, 1.0, 0x8a6a4a)
  };
  const solid = c => G.mat(c);

  // ---------- sky, ground, mountains, trees ----------
  W.skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), new THREE.ShaderMaterial({
    uniforms: W.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top, bot; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 2.2 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, h), 1.0); }'
  }));
  sky.renderOrder = -1; scene.add(sky); W.sky = sky;

  // Ground: flat inner square (with a hole under the cabin) + undulating outer ring.
  const IN0 = -36, IN1 = 42; // inner flat square, aligned to the 6m outer grid
  const hillY = (x, z) => { const d = Math.max(IN0 - x, x - IN1, IN0 - z, z - IN1, 0); return (Math.sin(x * 0.05) * Math.cos(z * 0.06) * 0.5 + 0.5) * d * 0.18; };
  W.hillY = hillY;
  const grassM = new THREE.MeshLambertMaterial({ map: T.grass });
  {
    const gg = new THREE.PlaneGeometry(420, 420, 70, 70).toNonIndexed(); gg.rotateX(-Math.PI / 2);
    const p = gg.attributes.position, uv = gg.attributes.uv, keepP = [], keepU = [];
    for (let i = 0; i < p.count; i += 3) {
      const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      if (cx > IN0 && cx < IN1 && cz > IN0 && cz < IN1) continue;
      for (let k = 0; k < 3; k++) { const x = p.getX(i + k), z = p.getZ(i + k); keepP.push(x, hillY(x, z), z); keepU.push(uv.getX(i + k) * 105, uv.getY(i + k) * 105); }
    }
    const og = new THREE.BufferGeometry();
    og.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3)); og.setAttribute('uv', new THREE.Float32BufferAttribute(keepU, 2));
    og.computeVertexNormals();
    const outer = new THREE.Mesh(og, grassM); outer.receiveShadow = true; scene.add(outer);
    const sh = new THREE.Shape(); sh.moveTo(IN0, -IN1); sh.lineTo(IN1, -IN1); sh.lineTo(IN1, -IN0); sh.lineTo(IN0, -IN0); sh.lineTo(IN0, -IN1);
    const hole = new THREE.Path(); hole.moveTo(-6.15, -5.15); hole.lineTo(-6.15, 5.15); hole.lineTo(6.15, 5.15); hole.lineTo(6.15, -5.15); hole.lineTo(-6.15, -5.15);
    sh.holes.push(hole);
    const ig = new THREE.ShapeGeometry(sh); ig.rotateX(-Math.PI / 2);
    const iu = ig.attributes.uv; for (let i = 0; i < iu.count; i++) iu.setXY(i, iu.getX(i) * 0.25, iu.getY(i) * 0.25);
    const inner = new THREE.Mesh(ig, grassM); inner.receiveShadow = true; scene.add(inner);
  }

  {
    const mg = [], R = G.rngF(7);
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + R() * 0.2, d = 150 + R() * 80, h = 60 + R() * 70, r = 45 + R() * 40;
      const cone = new THREE.ConeGeometry(r, h, 7, 1); cone.translate(Math.cos(a) * d, h / 2 - 4, Math.sin(a) * d);
      const snow = new THREE.ConeGeometry(r * 0.32, h * 0.32, 7, 1); snow.translate(Math.cos(a) * d, h - 4 - h * 0.16 + 0.5, Math.sin(a) * d);
      const col = (g, c) => { const n = g.attributes.position.count, a2 = new Float32Array(n * 3); for (let j = 0; j < n; j++) { a2[j * 3] = c[0]; a2[j * 3 + 1] = c[1]; a2[j * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a2, 3)); };
      const t = 0.85 + R() * 0.2; col(cone, [0.33 * t, 0.36 * t, 0.42 * t]); col(snow, [0.95, 0.96, 1]);
      mg.push(cone.toNonIndexed(), snow.toNonIndexed());
    }
    const mgeo = THREE.BufferGeometryUtils.mergeBufferGeometries(mg);
    mgeo.computeVertexNormals(); // non-indexed -> per-face normals = faceted low-poly look
    const mm = new THREE.Mesh(mgeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.add(mm);
  }
  {
    const parts = [];
    const colorize = (g, c) => { g = g.toNonIndexed(); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let j = 0; j < n; j++) { const v = 0.9 + Math.random() * 0.2; a[j * 3] = c[0] * v; a[j * 3 + 1] = c[1] * v; a[j * 3 + 2] = c[2] * v; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const trunk = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6); trunk.translate(0, 1.1, 0); parts.push(colorize(trunk, [0.32, 0.22, 0.14]));
    [[2.1, 3.2, 1.6], [1.7, 2.8, 3.0], [1.25, 2.4, 4.3], [0.75, 1.8, 5.4]].forEach(([r, h, y]) => { const c = new THREE.ConeGeometry(r, h, 7); c.translate(0, y, 0); parts.push(colorize(c, [0.12, 0.24, 0.15])); });
    const tg = THREE.BufferGeometryUtils.mergeBufferGeometries(parts);
    const count = 340, inst = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true }), count);
    const R = G.rngF(11), m4 = new THREE.Matrix4(); let n = 0;
    W.trees = [];
    while (n < count) {
      const x = (R() - 0.5) * 200, z = (R() - 0.5) * 200;
      const r = Math.hypot(x - 2, z - 1);
      if (r < 16 || (x > 5 && x < 19 && z > -5 && z < 9) || (x > -12 && x < 2 && z > 2 && z < 14)) continue;
      const s = 0.8 + R() * 0.9, y = hillY(x, z);
      m4.compose(new V3(x, y - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new V3(s, s * (0.9 + R() * 0.4), s));
      inst.setMatrixAt(n++, m4);
      if (r < 40) W.colliders.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35, y0: 0, y1: 3 });
    }
    inst.castShadow = true; inst.receiveShadow = true; scene.add(inst);
  }

  // ---------- cabin ----------
  const WH = 2.7;
  function wallZ(z, x0, x1, holes, mat = M.logs, t = 0.24, y0 = 0, y1 = WH) {
    let x = x0;
    holes = holes.slice().sort((a, b) => a[0] - b[0]);
    for (const [a, b, ha, hb] of holes) {
      if (a > x) box(mat, x, y0, z - t / 2, a, y1, z + t / 2, { col: true });
      if (ha > y0) box(mat, a, y0, z - t / 2, b, ha, z + t / 2, { col: true });
      if (hb < y1) box(mat, a, hb, z - t / 2, b, y1, z + t / 2, { col: true });
      x = b;
    }
    if (x < x1) box(mat, x, y0, z - t / 2, x1, y1, z + t / 2, { col: true });
  }
  function wallX(x, z0, z1, holes, mat = M.logs, t = 0.24, y0 = 0, y1 = WH) {
    let z = z0;
    holes = holes.slice().sort((a, b) => a[0] - b[0]);
    for (const [a, b, ha, hb] of holes) {
      if (a > z) box(mat, x - t / 2, y0, z, x + t / 2, y1, a, { col: true });
      if (ha > y0) box(mat, x - t / 2, y0, a, x + t / 2, ha, b, { col: true });
      if (hb < y1) box(mat, x - t / 2, hb, a, x + t / 2, y1, b, { col: true });
      z = b;
    }
    if (z < z1) box(mat, x - t / 2, y0, z, x + t / 2, y1, z1, { col: true });
  }
  // floor slab with stair opening
  box(M.floor, -6, -0.22, -3.6, 6, 0, 5);
  box(M.floor, -6, -0.22, -5, 0.8, 0, -3.6);
  box(M.floor, 4.8, -0.22, -5, 6, 0, -3.6);
  box(M.stone, -6.3, -0.6, -5.3, 6.3, -0.22, 5.3, { cast: false });
  // walls
  wallZ(5, -6.12, 6.12, [[-0.6, 0.6, 0, 2.15], [-4.1, -2.9, 1.0, 2.0], [2.9, 4.1, 1.0, 2.0]]);
  wallZ(-5, -6.12, 6.12, [[-4.4, -3.2, 1.25, 2.05]]);
  wallX(-6, -4.88, 4.88, [[-0.9, 0.9, 1.0, 2.0]]);
  wallX(6, -4.88, 4.88, []);
  // window frames + glass
  const glass = new THREE.MeshPhongMaterial({ color: 0x9ab0c0, transparent: true, opacity: 0.25, shininess: 90, depthWrite: false });
  W.windowGlow = [];
  const win = (x, y, z, w, h, ry) => {
    const g = new THREE.PlaneGeometry(w, h); addStatic(g, glass, x, y, z, 0, ry, 0, false);
    const f = 0.06;
    const fr = (a, e, c, h2) => { const gg2 = new THREE.BoxGeometry(c - a, h2 - e, 0.3); gg2.translate((a + c) / 2, (e + h2) / 2, 0); addStatic(gg2, M.trim, x, y, z, 0, ry, 0); };
    fr(-w / 2 - f, -h / 2 - f, w / 2 + f, -h / 2); fr(-w / 2 - f, h / 2, w / 2 + f, h / 2 + f);
    fr(-w / 2 - f, -h / 2, -w / 2, h / 2); fr(w / 2, -h / 2, w / 2 + f, h / 2); fr(-0.02, -h / 2, 0.02, h / 2);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0, depthWrite: false }));
    glow.position.set(x, y, z); glow.rotation.y = ry; scene.add(glow); W.windowGlow.push(glow);
  };
  win(-3.5, 1.5, 5, 1.2, 1.0, 0); win(3.5, 1.5, 5, 1.2, 1.0, 0); win(-3.8, 1.65, -5, 1.2, 0.8, 0); win(-6, 1.5, 0, 1.8, 1.0, Math.PI / 2);
  // gables (stepped logs) + roof
  for (const gx of [-6, 6]) for (let i = 0; i < 5; i++) {
    const y = WH + i * 0.32, half = 5 - (i + 0.5) * (5 / 5.2);
    box(M.logs, gx - 0.12, y, -half, gx + 0.12, y + 0.32, half);
  }
  const rl = Math.hypot(5.7, 1.75), ra = Math.atan2(1.75, 5.7);
  for (const sgn of [1, -1]) {
    const g = new THREE.BoxGeometry(13.2, 0.18, rl); boxUV(g, 13.2, 0.18, rl, 1.4);
    addStatic(g, M.roof, 0, 4.45 - 0.875 + 0.05, sgn * 2.85, sgn * ra, 0, 0);
  }
  box(M.beam, -6.6, 4.3, -0.15, 6.6, 4.55, 0.15);
  box(M.ceil, -5.9, WH, -4.9, 5.9, WH + 0.08, 4.9, { cast: false });
  for (let x = -4.5; x <= 4.6; x += 1.8) box(M.beam, x - 0.1, WH - 0.18, -4.9, x + 0.1, WH, 4.9);
  // porch
  box(M.planks, -4.2, -0.12, 5.12, 4.2, 0.03, 7.4, { cast: false });
  for (const px of [-4, 4, -1.4, 1.4]) box(M.beam, px - 0.1, 0, 7.2, px + 0.1, 2.6, 7.4, { col: true });
  { const g = new THREE.BoxGeometry(8.8, 0.12, 2.6); boxUV(g, 8.8, 0.12, 2.6, 1.4); addStatic(g, M.roof, 0, 2.75, 6.35, 0.2, 0, 0); }
  box(M.dark, -3.6, 0, 5.3, -1.6, 0.45, 5.75, { col: true }); box(M.dark, -3.6, 0.45, 5.15, -1.6, 0.9, 5.3);
  W.seats.porch = { x: -2.6, z: 5.55, yaw: 0 };
  // lantern on porch
  W.lantern = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
  W.lantern.position.set(1.4, 2.1, 7.08); scene.add(W.lantern);
  // chimney outside + fireplace inside
  box(M.stone, 6.05, 0, -0.8, 6.85, 5.4, 0.8, { col: true });
  box(M.stone, 5.2, 0, -1.15, 5.95, 1.5, -0.7, { col: true }); box(M.stone, 5.2, 0, 0.7, 5.95, 1.5, 1.15, { col: true });
  box(M.stone, 5.2, 1.0, -0.7, 5.95, 1.5, 0.7, { col: true }); box(M.stone, 5.75, 0, -0.7, 5.95, 1.0, 0.7, { col: true });
  box(M.stone, 4.85, 0, -1.3, 5.95, 0.08, 1.3, { cast: false });
  box(M.dark, 5.05, 1.5, -1.35, 5.95, 1.6, 1.35); box(M.stone, 5.45, 1.6, -0.8, 5.95, WH, 0.8);
  W.colliders.push({ x0: 4.95, z0: -0.7, x1: 5.95, z1: 0.7, y0: 0, y1: 1 });
  {
    const logsM = G.mat('#3a2616'); const lg = new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6);
    for (const [y, r] of [[0.15, 0.4], [0.15, -0.4], [0.27, 0]]) { const g = lg.clone(); addStatic(g, logsM, 5.5, y, 0, 0, r, Math.PI / 2); }
    W.fire = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.12 - i * 0.015, 0.45 - i * 0.05, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd27a : 0xff7a1a, transparent: true, opacity: 0.9, depthWrite: false }));
      f.position.set(5.5, 0.4, -0.2 + i * 0.13); scene.add(f); W.fire.push(f);
    }
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshPhongMaterial({ map: T.photo }));
    photo.position.set(5.43, 1.95, 0); photo.rotation.y = -Math.PI / 2; scene.add(photo);
    box(M.dark, 5.43, 1.66, -0.4, 5.47, 2.24, 0.4);
  }
  // kitchen
  box(M.dark, -5.85, 0, -4.88, -2.65, 0.88, -4.25, { col: true });
  box(M.wood, -5.88, 0.88, -4.9, -2.62, 0.94, -4.2);
  box(M.iron, -2.62, 0, -4.85, -1.7, 0.9, -4.2, { col: true });
  box(G.mat('#1a1a1a', 40), -2.6, 0.9, -4.83, -1.72, 0.93, -4.22);
  { const pipe = new THREE.CylinderGeometry(0.07, 0.07, 1.8, 8); addStatic(pipe, M.iron, -2.15, 1.85, -4.7); }
  box(M.dark, -5.85, 1.6, -4.88, -4.6, 2.3, -4.5); box(M.dark, -3.0, 1.6, -4.88, -2.65, 2.3, -4.5);
  box(G.mat('#8a8a8a', 50), -5.4, 0.89, -4.75, -4.7, 0.95, -4.35);
  { const pan = new THREE.CylinderGeometry(0.2, 0.17, 0.06, 12); addStatic(pan, G.mat('#151515', 40), -2.15, 0.96, -4.5); const h = new THREE.BoxGeometry(0.3, 0.03, 0.04); addStatic(h, G.mat('#151515'), -1.85, 0.97, -4.5); }
  W.panMeat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.15), new THREE.MeshPhongMaterial({ map: T.meat, shininess: 40 }));
  W.panMeat.position.set(-2.15, 1.0, -4.5); W.panMeat.visible = false; scene.add(W.panMeat);
  const jars = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8);
  for (let i = 0; i < 6; i++) addStatic(jars.clone(), G.mat(['#8a3a2a', '#c8a040', '#5a7a3a'][i % 3], 40), -5.7 + i * 0.18, 2.4, -4.7);
  box(M.dark, -5.85, 2.3, -4.88, -4.6, 2.32, -4.5);
  // kitchen pendant
  { const c = new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4); addStatic(c, M.iron, -2.5, 2.45, -2.6, 0, 0, 0, false);
    const sh = new THREE.ConeGeometry(0.22, 0.18, 10, 1, true); addStatic(sh, G.mat('#2d3a2e', 30), -2.5, 2.12, -2.6, 0, 0, 0, false);
    W.bulbK = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); W.bulbK.position.set(-2.5, 2.04, -2.6); scene.add(W.bulbK); }
  // dining table + chairs
  box(M.wood, -1.25, 0.72, -0.27, 1.25, 0.79, 0.87);
  for (const [x, z] of [[-1.15, -0.17], [1.15, -0.17], [-1.15, 0.77], [1.15, 0.77]]) box(M.dark, x - 0.04, 0, z - 0.04, x + 0.04, 0.72, z + 0.04);
  W.colliders.push({ x0: -1.3, z0: -0.32, x1: 1.3, z1: 0.92, y0: 0, y1: 0.8 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), new THREE.MeshPhongMaterial({ map: T.rug, shininess: 2 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0.3); rug.receiveShadow = true; scene.add(rug);
  const seatDefs = { linda: [-1.65, 0.3, Math.PI / 2], leon: [1.65, 0.3, -Math.PI / 2], luke: [-0.55, -0.72, 0], lily: [0.55, -0.72, 0], rose: [-0.55, 1.32, Math.PI], spare: [0.55, 1.32, Math.PI] };
  for (const k in seatDefs) {
    const [x, z, yaw] = seatDefs[k]; W.seats[k] = { x, z, yaw };
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    box(M.dark, x - 0.23, 0.43, z - 0.23, x + 0.23, 0.48, z + 0.23);
    for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) box(M.dark, x + a - 0.025, 0, z + b - 0.025, x + a + 0.025, 0.43, z + b + 0.025);
    const bx0 = x - fx * 0.21, bz0 = z - fz * 0.21;
    if (Math.abs(fx) > 0.5) box(M.dark, bx0 - 0.025, 0.48, z - 0.22, bx0 + 0.025, 1.05, z + 0.22);
    else box(M.dark, x - 0.22, 0.48, bz0 - 0.025, x + 0.22, 1.05, bz0 + 0.025);
    if (k !== 'leon') W.colliders.push({ x0: x - 0.24, z0: z - 0.24, x1: x + 0.24, z1: z + 0.24, y0: 0, y1: 1 });
    // plate + steak (dynamic)
    const px = x + fx * 0.48, pz = z + fz * 0.48;
    const plate = new THREE.Group(); plate.position.set(px, 0.795, pz); scene.add(plate);
    const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.02, 14), G.mat('#e8e4da', 40)); plate.add(pm);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.12), new THREE.MeshPhongMaterial({ map: T.steak, shininess: 45 }));
    st.position.y = 0.025; st.rotation.y = 0.4; plate.add(st);
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), G.mat('#c9a65a')); p.position.set(-0.08 + i * 0.03, 0.025, 0.07); plate.add(p); }
    plate.visible = false; W.plates[k] = { group: plate, steak: st, x: px, z: pz };
  }
  // candle
  { const cm = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8); addStatic(cm, G.mat('#efe6cc'), 0, 0.87, 0.3);
    W.flame = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6), new THREE.MeshBasicMaterial({ color: 0xffc060 })); W.flame.position.set(0, 0.99, 0.3); scene.add(W.flame); }
  // couch, bookshelf
  box(G.mat('#4a5a3a', 4), 2.6, 0, 1.3, 3.3, 0.45, 3.6, { col: true }); box(G.mat('#4a5a3a', 4), 2.4, 0, 1.3, 2.62, 0.9, 3.6);
  box(G.mat('#43532f', 4), 2.4, 0, 1.15, 3.3, 0.65, 1.32); box(G.mat('#43532f', 4), 2.4, 0, 3.58, 3.3, 0.65, 3.75);
  box(M.dark, -5.95, 0, 2.0, -5.6, 2.0, 3.8, { col: true });
  for (let s = 0; s < 4; s++) for (let i = 0; i < 9; i++) {
    const h = 0.22 + ((i * 7 + s * 3) % 5) * 0.02;
    box(G.mat(['#6a2a22', '#2a4a5a', '#5a4a2a', '#3a3a3a'][(i + s) % 4]), -5.88, 0.05 + s * 0.48, 2.1 + i * 0.18, -5.66, 0.05 + s * 0.48 + h, 2.24 + i * 0.18);
  }
  // beds area (left back): two bunk beds
  for (const bz of [-3.2, -1.6]) {
    box(M.dark, -5.9, 0, bz - 0.5, -3.9, 0.4, bz + 0.5, { col: true }); box(G.mat('#7a6a8a', 4), -5.85, 0.4, bz - 0.45, -3.95, 0.52, bz + 0.45);
    box(M.dark, -5.9, 1.3, bz - 0.5, -3.9, 1.4, bz + 0.5); box(G.mat('#6a7a5a', 4), -5.85, 1.4, bz - 0.45, -3.95, 1.52, bz + 0.45);
    box(M.dark, -3.95, 0, bz - 0.5, -3.88, 1.6, bz - 0.43); box(M.dark, -3.95, 0, bz + 0.43, -3.88, 1.6, bz + 0.5);
  }
  // front door (open) + door frame
  const doorM = phong(T.planks, 0.6, 0x7a5232);
  { const g = new THREE.BoxGeometry(1.15, 2.12, 0.06); boxUV(g, 1.15, 2.12, 0.06, 0.6); addStatic(g, doorM, -0.6, 1.06, 5.55, 0, Math.PI / 2 + 0.25, 0); }

  // ---------- basement stair + door ----------
  box(M.planks, 0.8, -2.8, -3.68, 4.85, WH, -3.53, { col: true });
  box(M.planks, 0.7, 0, -4.88, 0.85, WH, -3.6, { col: true });
  box(M.planks, 4.85, 2.12, -3.68, 5.82, WH, -3.53, { col: true });
  box(M.planks, 5.82, 0, -3.68, 6.0, WH, -3.53, { col: true });
  for (let i = 0; i < 14; i++) {
    const x0 = 0.8 + i * (4 / 14), top = -2.8 + (i + 1) * 0.2;
    box(M.dark, x0, -2.8, -4.85, x0 + 4 / 14 + 0.01, top, -3.68);
  }
  W.colliders.push({ x0: 0.8, z0: -3.53, x1: 6, z1: -3.45, y0: -2.8, y1: -0.3 });
  W.bDoor = new THREE.Group(); W.bDoor.position.set(5.8, 0, -3.6); scene.add(W.bDoor);
  { const d = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.1, 0.05), new THREE.MeshPhongMaterial({ map: T.planks, color: 0x6a4a30 }));
    d.position.set(-0.475, 1.05, 0); d.castShadow = true; W.bDoor.add(d);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), G.mat('#b89040', 60)); kn.position.set(-0.85, 1.0, 0.05); W.bDoor.add(kn); }
  W.bDoorCol = { x0: 4.85, z0: -3.66, x1: 5.82, z1: -3.54, y0: 0, y1: 2.1, on: true }; W.colliders.push(W.bDoorCol);
  W.bDoorOpen = 0; W.bDoorTarget = 0;
  W.setDoor = (open) => { W.bDoorTarget = open ? 1 : 0; W.bDoorCol.on = !open; };

  // ---------- basement ----------
  box(M.concrete, -5.95, -2.95, -4.95, 5.95, -2.8, 4.95, { cast: false });
  wallZ(-4.85, -5.95, 5.95, [], M.stone, 0.24, -2.8, -0.22);
  wallZ(4.85, -5.95, 5.95, [], M.stone, 0.24, -2.8, -0.22);
  wallX(-5.85, -4.85, 4.85, [], M.stone, 0.24, -2.8, -0.22);
  wallX(5.85, -4.85, 4.85, [], M.stone, 0.24, -2.8, -0.22);
  for (let x = -4.2; x <= 4; x += 2.1) box(M.beam, x - 0.12, -0.5, -3.4, x + 0.12, -0.22, 4.85);
  // butcher table
  box(M.dark, -3.65, -1.95 - 0.1, -0.2, -1.35, -1.95, 0.8, {});
  for (const [x, z] of [[-3.55, -0.1], [-1.45, -0.1], [-3.55, 0.7], [-1.45, 0.7]]) box(M.dark, x - 0.05, -2.8, z - 0.05, x + 0.05, -2.05, z + 0.05);
  W.colliders.push({ x0: -3.7, z0: -0.25, x1: -1.3, z1: 0.85, y0: -2.8, y1: -1.9 });
  // meat hooks along west wall
  const meatM = new THREE.MeshPhongMaterial({ map: T.meat, shininess: 55 });
  box(M.iron, -5.5, -0.62, -3, -5.42, -0.55, 3);
  for (let i = 0; i < 4; i++) {
    const z = -2.3 + i * 1.4;
    const ch = new THREE.CylinderGeometry(0.008, 0.008, 0.4, 4); addStatic(ch, M.iron, -5.46, -0.8, z, 0, 0, 0, false);
    const chunk = new THREE.DodecahedronGeometry(0.22 + (i % 2) * 0.06, 0); chunk.scale(0.8, 1.5, 0.6);
    addStatic(chunk, meatM, -5.46, -1.3, z, 0, i, 0);
  }
  box(G.mat('#e0e0dc', 30), -5.6, -2.8, 3.1, -4.3, -2.0, 4.6, { col: true });
  box(M.dark, 5.3, -2.8, 0, 5.8, -0.6, 3, { col: true });
  for (let s = 0; s < 3; s++) for (let i = 0; i < 8; i++) addStatic(jars.clone(), G.mat(s === 1 ? '#5a0a0a' : '#7a2a1a', 60), 5.5, -2.15 + s * 0.6, 0.2 + i * 0.35);
  { const b = new THREE.CylinderGeometry(0.2, 0.17, 0.4, 10, 1, true); addStatic(b, G.mat('#6a6a6a', 30), -1.0, -2.6, 0.9);
    const lid = new THREE.CircleGeometry(0.19, 10); addStatic(lid, G.mat('#4a0303', 80), -1.0, -2.45, 0.9, -Math.PI / 2); }
  // cleaver on table
  { const cl = new THREE.BoxGeometry(0.22, 0.01, 0.1); addStatic(cl, G.mat('#9a8a8a', 70), -1.8, -1.94, 0.65, 0, 0.6, 0);
    const hd = new THREE.BoxGeometry(0.14, 0.03, 0.03); addStatic(hd, G.mat('#2a1a10'), -1.62, -1.935, 0.75, 0, 0.6, 0); }
  // axe on wall near stairs bottom
  W.wallAxe = G.makeAxe(); W.wallAxe.position.set(-0.5, -2.2, -4.7); W.wallAxe.rotation.set(0, Math.PI / 2, 0.15); scene.add(W.wallAxe);
  // blood decals
  W.decals = new THREE.Group(); scene.add(W.decals);
  const decal = (tex, x, y, z, w, h, rx, ry = 0, op = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhongMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, shininess: 90, specular: 0x441111, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; W.decals.add(m); return m;
  };
  const F = -2.795, flat = -Math.PI / 2;
  decal(T.pool, -2.5, F, 0.3, 3.0, 2.4, flat);
  decal(T.pool2, -2.3, F + 0.001, 1.8, 2.4, 1.9, flat, 0.4);
  decal(T.pool, -0.6, F + 0.002, -2.0, 1.9, 1.9, flat, 1.2);
  decal(T.smear, -0.1, F + 0.003, -2.4, 2.8, 0.7, flat, -0.98);
  decal(T.smear, -1.7, F + 0.003, -0.8, 2.2, 0.6, flat, 2.2);
  decal(T.spatter, -5.72, -1.5, 0.4, 2.6, 2.6, 0, Math.PI / 2);
  decal(T.spatter, -2.6, -1.5, 4.72, 2.2, 2.2, 0, Math.PI);
  decal(T.drips, -1.35, -2.4, 0.3, 0.9, 0.8, 0, Math.PI / 2);
  decal(T.pool2, -2.5, -1.944, 0.3, 2.0, 0.95, flat);
  decal(T.spatter, 0.5, -1.4, -3.66, 1.6, 1.6, 0, 0, 0.8);
  // bulb (swinging)
  W.bulb = new THREE.Group(); W.bulb.position.set(-1.8, -0.22, 0.4); scene.add(W.bulb);
  { const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.55, 4), M.iron); cord.position.y = -0.27; W.bulb.add(cord);
    W.bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c0 })); W.bulbMesh.position.y = -0.58; W.bulb.add(W.bulbMesh); }
  // flies
  {
    const n = 40, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    W.flies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x050505, size: 0.025 }));
    W.flies.frustumCulled = false; W.fliesPh = Array.from({ length: n }, () => [Math.random() * 6, Math.random() * 6, 0.8 + Math.random()]);
    scene.add(W.flies);
  }

  // ---------- yard ----------
  // chopping block + woodpile
  { const st = new THREE.CylinderGeometry(0.32, 0.36, 0.55, 10); addStatic(st, G.mat('#6a4a2e'), -8, 0.275, 7.5);
    W.colliders.push({ x0: -8.3, z0: 7.2, x1: -7.7, z1: 7.8, y0: 0, y1: 0.6 });
    const lg = new THREE.CylinderGeometry(0.13, 0.13, 1.2, 7);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 6 - r; i++) addStatic(lg.clone(), G.mat(i % 2 ? '#7a5634' : '#6a4a2a'), -10.2, 0.13 + r * 0.24, 4.2 + i * 0.27 + r * 0.13, Math.PI / 2, 0, 0);
    W.colliders.push({ x0: -10.9, z0: 3.9, x1: -9.5, z1: 6.0, y0: 0, y1: 1 });
    W.blockAxe = G.makeAxe(); W.blockAxe.position.set(-8.05, 0.5, 7.5); W.blockAxe.rotation.set(0.3, 0.5, 0.25); W.blockAxe.visible = false; scene.add(W.blockAxe); }
  // outhouse
  box(M.planks, -9.2, 0, -8.2, -7.8, 2.3, -6.8, { col: true });
  { const g = new THREE.BoxGeometry(1.7, 0.1, 1.7); addStatic(g, M.roof, -8.5, 2.4, -7.5, 0.15); }
  // clothesline
  for (const x of [-6, -1]) box(M.beam, x - 0.06, 0, 10.4, x + 0.06, 2.0, 10.52, { col: true });
  { const l = new THREE.CylinderGeometry(0.008, 0.008, 5, 4); addStatic(l, M.white, -3.5, 1.9, 10.46, 0, 0, Math.PI / 2, false); }
  const cloth = new THREE.MeshPhongMaterial({ color: 0xe8e4d8, side: THREE.DoubleSide });
  W.sheets = [];
  for (const [x, c] of [[-5, 0xe8e4d8], [-3.9, 0xa8b8d0], [-2.6, 0xd8b0b8]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0, 4, 4), c === 0xe8e4d8 ? cloth : new THREE.MeshPhongMaterial({ color: c, side: THREE.DoubleSide }));
    s.position.set(x, 1.4, 10.46); s.castShadow = true; scene.add(s); W.sheets.push(s);
  }
  // rain barrel, path stones
  { const b = new THREE.CylinderGeometry(0.38, 0.34, 0.95, 12); addStatic(b, G.mat('#5a3e26'), 8, 0.475, -2.3);
    W.colliders.push({ x0: 7.6, z0: -2.7, x1: 8.4, z1: -1.9, y0: 0, y1: 1 }); }
  { const R = G.rngF(5); for (let i = 0; i < 14; i++) { const t = i / 13, x = 0 + t * 8.5 + (R() - 0.5) * 0.3, z = 7.8 - Math.sin(t * Math.PI) * 1.2 - t * 5.8;
    const g = new THREE.CylinderGeometry(0.28 + R() * 0.1, 0.3, 0.06, 7); addStatic(g, G.mat('#77736a'), x, 0.02, z, 0, R() * 3, 0, false); } }

  // ---------- garden ----------
  const GX0 = 8.4, GX1 = 15.6, GZ0 = -1.2, GZ1 = 5.4;
  const post = (x, z) => box(M.beam, x - 0.06, 0, z - 0.06, x + 0.06, 1.0, z + 0.06, { col: true });
  const rail = (x0, z0, x1, z1) => { for (const y of [0.45, 0.85]) box(M.beam, Math.min(x0, x1) - 0.03, y, Math.min(z0, z1) - 0.03, Math.max(x0, x1) + 0.03, y + 0.06, Math.max(z0, z1) + 0.03); W.colliders.push({ x0: Math.min(x0, x1) - 0.05, z0: Math.min(z0, z1) - 0.05, x1: Math.max(x0, x1) + 0.05, z1: Math.max(z0, z1) + 0.05, y0: 0, y1: 1 }); };
  for (let x = GX0; x <= GX1 + 0.01; x += 1.2) { post(x, GZ0); post(x, GZ1); }
  for (let z = GZ0; z <= GZ1 + 0.01; z += 1.1) { post(GX1, z); if (z < 1.4 || z > 2.8) post(GX0, z); }
  rail(GX0, GZ0, GX1, GZ0); rail(GX0, GZ1, GX1, GZ1); rail(GX1, GZ0, GX1, GZ1);
  rail(GX0, GZ0, GX0, 1.4); rail(GX0, 2.8, GX0, GZ1);
  const rows = [0, 2, 4];
  for (const z of rows) box(M.soil, 9.0, -0.05, z - 0.45, 15.0, 0.06, z + 0.45, { cast: false });
  box(G.mat('#7a5a34'), 8.7, 0, 2.3, 9.2, 0.25, 2.75);
  W.basket = { x: 8.95, z: 2.5 };
  const xs = [9.6, 11.0, 12.4, 13.8];
  const leafM = G.mat('#4f8a2e'), leafDry = G.mat('#9a8a3a'), carrotM = G.mat('#e07a1a'), potLeaf = G.mat('#3a6a28'), potM = G.mat('#b08a5a'), tomM = G.mat('#d0201a', 40), stakeM = G.mat('#8a6a42'), weedM = G.mat('#2e4a1a'), wetM = G.mat('#22160c');
  xs.forEach((x, i) => {
    // carrots: dry until watered
    const g = new THREE.Group(); g.position.set(x, 0.06, 0); scene.add(g);
    const leaves = [];
    for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.35, 4), leafDry); l.position.set((k - 2) * 0.03, 0.17, (k % 2) * 0.03); l.rotation.z = (k - 2) * 0.5; leaves.push(l); g.add(l); }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.05, 6), carrotM); top.position.y = 0.01; g.add(top);
    const wet = new THREE.Mesh(new THREE.CircleGeometry(0.4, 10), wetM); wet.rotation.x = -Math.PI / 2; wet.position.set(x, 0.062, 0); wet.visible = false; scene.add(wet);
    W.chores.water.push({ x, y: 0.2, z: 0, group: g, leaves, wet, done: false, leafM });
    // potatoes
    const pg = new THREE.Group(); pg.position.set(x, 0.06, 2); scene.add(pg);
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), potLeaf); bush.scale.set(1, 0.6, 1); bush.position.y = 0.15; bush.castShadow = true; pg.add(bush);
    const tubers = [];
    for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), potM); p.position.set((k - 1) * 0.1, 0.0, 0.05); p.visible = false; pg.add(p); tubers.push(p); }
    W.chores.potato.push({ x, y: 0.2, z: 2, group: pg, bush, tubers, done: false });
    // tomatoes
    const tg = new THREE.Group(); tg.position.set(x, 0.06, 4); scene.add(tg);
    const stake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.04), stakeM); stake.position.y = 0.55; tg.add(stake);
    const tb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), potLeaf); tb.scale.set(0.9, 1.6, 0.9); tb.position.y = 0.45; tb.castShadow = true; tg.add(tb);
    const toms = [];
    for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), tomM); t.position.set(Math.cos(k * 1.7) * 0.2, 0.3 + k * 0.12, Math.sin(k * 1.7) * 0.2); tg.add(t); toms.push(t); }
    W.chores.tomato.push({ x, y: 0.5, z: 4, group: tg, toms, done: false });
  });
  for (const [x, z] of [[10.3, 1.0], [13.1, 3.0], [11.8, -0.75], [14.4, 1.1]]) {
    const g = new THREE.Group(); g.position.set(x, 0.02, z); scene.add(g);
    for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.25 + (k % 3) * 0.06, 3), weedM); s.position.set(Math.cos(k) * 0.06, 0.12, Math.sin(k) * 0.06); s.rotation.set(Math.sin(k * 3) * 0.5, 0, Math.cos(k * 2) * 0.5); g.add(s); }
    W.chores.weed.push({ x, y: 0.1, z, group: g, done: false });
  }

  // ---------- lights ----------
  W.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x5a4a32, 0.6); scene.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xffeedd, 1); W.sun.castShadow = true;
  W.sun.shadow.mapSize.set(2048, 2048); W.sun.shadow.bias = -0.0006; W.sun.shadow.normalBias = 0.02;
  const sc = W.sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 120;
  W.sun.target.position.set(2, 0, 1); scene.add(W.sun, W.sun.target);
  W.fireLight = new THREE.PointLight(0xff8a3a, 1, 9, 1.6); W.fireLight.position.set(5.0, 0.7, 0); scene.add(W.fireLight);
  W.kLight = new THREE.PointLight(0xffd9a0, 0.8, 10, 1.5); W.kLight.position.set(-2.5, 1.9, -2.6); scene.add(W.kLight);
  W.cLight = new THREE.PointLight(0xffb060, 0.6, 5, 1.8); W.cLight.position.set(0, 1.15, 0.3); scene.add(W.cLight);
  W.bLight = new THREE.PointLight(0xffe2b0, 1.3, 10, 1.4); W.bLight.castShadow = true;
  W.bLight.shadow.mapSize.set(512, 512); W.bLight.shadow.camera.near = 0.1; W.bLight.shadow.camera.far = 9; W.bLight.shadow.bias = -0.004;
  scene.add(W.bLight);

  // ---------- presets ----------
  const PRE = {
    day1: { top: 0x5d93cf, bot: 0xe9dcc0, fog: 0xd6d4c6, fn: 30, ff: 210, sun: 0xffe6c0, si: 1.1, sp: [30, 38, 18], hs: 0xcfe0ff, hg: 0x6b5a3a, hi: 0.62, fire: 0.5, k: 0, c: 0, glow: 0, birds: 1, wind: 0.07 },
    eve: { top: 0x26305a, bot: 0xe08850, fog: 0x8a6a62, fn: 20, ff: 150, sun: 0xff9a5a, si: 0.55, sp: [-34, 9, 22], hs: 0x8a90c0, hg: 0x4a3426, hi: 0.4, fire: 1.2, k: 0.9, c: 0.7, glow: 0.55, birds: 0.2, wind: 0.08 },
    day2: { top: 0x858f98, bot: 0xb6bbbf, fog: 0xa6acb0, fn: 12, ff: 120, sun: 0xdfe4ea, si: 0.32, sp: [12, 40, 10], hs: 0xc8ccd2, hg: 0x5a5448, hi: 0.78, fire: 0.8, k: 0.4, c: 0, glow: 0.15, birds: 0.3, wind: 0.13 },
    day3: { top: 0x2a1c38, bot: 0xc9573a, fog: 0x7a4840, fn: 14, ff: 130, sun: 0xff6a3a, si: 0.75, sp: [-36, 8, 6], hs: 0x9a6a8a, hg: 0x3a2420, hi: 0.42, fire: 0.9, k: 0.6, c: 0, glow: 0.35, birds: 0, wind: 0.1 },
    night: { top: 0x04050b, bot: 0x0f1220, fog: 0x0a0c14, fn: 6, ff: 70, sun: 0x7080b0, si: 0.1, sp: [20, 40, -15], hs: 0x30385a, hg: 0x101010, hi: 0.14, fire: 1.4, k: 1.0, c: 1.0, glow: 0.8, birds: 0, wind: 0.05 }
  };
  W.pre = PRE.day1;
  W.setTime = function (name) {
    const p = PRE[name]; W.pre = p;
    W.skyU.top.value.set(p.top); W.skyU.bot.value.set(p.bot);
    scene.fog.color.set(p.fog); scene.fog.near = p.fn; scene.fog.far = p.ff;
    W.sun.color.set(p.sun); W.sun.position.set(2 + p.sp[0], p.sp[1], 1 + p.sp[2]);
    W.hemi.color.set(p.hs); W.hemi.groundColor.set(p.hg);
    W.kLight.intensity = p.k; W.bulbK.visible = p.k > 0;
    W.cLight.userData.base = p.c; W.flame.visible = p.c > 0;
    W.windowGlow.forEach(g => g.material.opacity = p.glow * 0.6);
    W.lantern.material.color.set(p.glow > 0.3 ? 0xffc070 : 0x5a4a30);
  };

  // ---------- helpers ----------
  W.heightAt = (x, z, y) => {
    if (z > -4.85 && z < -3.68 && x > 0.8 && x < 4.85) return -2.8 + (x - 0.8) / 4.05 * 2.8;
    return y < -1.4 ? -2.8 : 0;
  };
  W.region = (x, y, z) => (y < -1.0 ? 'base' : (x > -6 && x < 6 && z > -5 && z < 5) ? 'in' : 'out');

  let t = 0;
  W.update = function (dt, region) {
    t += dt;
    const f = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
    W.fireLight.intensity = W.pre.fire * f;
    W.fire.forEach((m, i) => { m.scale.set(1, 0.8 + Math.sin(t * (9 + i * 2) + i) * 0.25, 1); m.visible = W.pre.fire > 0; });
    W.cLight.intensity = (W.cLight.userData.base || 0) * (0.9 + Math.sin(t * 17) * 0.06);
    W.flame.scale.y = 1 + Math.sin(t * 15) * 0.15;
    const sw = Math.sin(t * 0.9) * 0.12; W.bulb.rotation.z = sw; W.bulb.rotation.x = Math.cos(t * 0.7) * 0.06;
    W.bulbMesh.getWorldPosition(W.bLight.position);
    const fl = region === 'base' ? (Math.random() < 0.015 ? 0.2 : 1) : 1;
    W.bLight.intensity = region === 'base' ? 1.3 * fl : 0; // never toggle .visible on lights (forces shader recompiles)
    W.bDoorOpen += (W.bDoorTarget - W.bDoorOpen) * Math.min(1, dt * 4); W.bDoor.rotation.y = -W.bDoorOpen * 1.6;
    if (region === 'base' || W.flies.visible) {
      const p = W.flies.geometry.attributes.position;
      W.fliesPh.forEach((q, i) => {
        q[0] += dt * q[2] * 2.3; q[1] += dt * q[2] * 1.7;
        p.setXYZ(i, -2.6 + Math.sin(q[0]) * 0.6 + Math.sin(q[1] * 2.1) * 0.15, -1.6 + Math.sin(q[1]) * 0.3, 0.3 + Math.cos(q[0] * 1.3) * 0.35);
      });
      p.needsUpdate = true;
    }
    W.sheets.forEach((s, i) => { s.rotation.x = Math.sin(t * 1.7 + i) * 0.12 * (W.pre.wind * 8); });
  };

  // ---------- finalize merged statics ----------
  for (const { mat, cast, list } of groups.values()) {
    const geo = THREE.BufferGeometryUtils.mergeBufferGeometries(list.map(g => g.index ? g.toNonIndexed() : g));
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = cast; mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh);
  }
  return W;
};

G.rngF = function (seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
