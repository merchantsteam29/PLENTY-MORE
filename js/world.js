// The homestead. Two-storey log cabin + basement, yard, garden, coop, shed, ridge, meadow, washed-out road.
// Static geometry is merged per material; vegetation is instanced; lights come from a small fixed pool.
G.buildWorld = function (scene, T, Q) {
  Q = Q || {};
  const W = { colliders: [], chores: { water: [], weed: [], potato: [], tomato: [], flower: [] }, plates: {}, seats: {}, spots: {}, doors: {}, lightsSrc: {}, state: {}, anim: [], toggles: {} };
  const V3 = THREE.Vector3, C = G.C;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const R0 = G.rngF(1234);

  // ---------- static merge builder ----------
  const groups = new Map();
  const VC = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 8, specular: new THREE.Color(0x111111) }), VCs = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: new THREE.Color(0x444444) });
  function addStatic(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, sc) {
    const m = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), sc || new V3(1, 1, 1));
    if (geo.index) geo = geo.toNonIndexed();
    if (geo.attributes.color) geo.deleteAttribute('color');
    geo.applyMatrix4(m);
    if (!mat.map && !mat.transparent && mat.side === THREE.FrontSide && mat.isMeshPhongMaterial && !(mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0)) {
      const n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = mat.color.r; a[i * 3 + 1] = mat.color.g; a[i * 3 + 2] = mat.color.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); mat = mat.shininess > 30 ? VCs : VC;
    }
    const k = mat.uuid + (cast ? 'c' : '');
    if (!groups.has(k)) groups.set(k, { mat, cast, list: [] });
    groups.get(k).list.push(geo);
  }
  function boxUV(g, w, h, d, tile) {
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0] / tile, uv.getY(j) * dims[f][1] / tile); }
  }
  function box(mat, x0, y0, z0, x1, y1, z1, o = {}) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0; if (w <= 0 || h <= 0 || d <= 0) return;
    const g = new THREE.BoxGeometry(w, h, d);
    if (mat.userData.tile) boxUV(g, w, h, d, mat.userData.tile);
    addStatic(g, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o.rx || 0, o.ry || 0, o.rz || 0, o.cast !== false);
    if (o.col) W.colliders.push({ x0, z0, x1, z1, y0: o.cy0 !== undefined ? o.cy0 : y0, y1: o.cy1 !== undefined ? o.cy1 : y1 });
  }
  const col = (x0, z0, x1, z1, y0, y1) => { const c = { x0, z0, x1, z1, y0, y1 }; W.colliders.push(c); return c; };
  const cyl = (mat, x, y, z, r0, r1, h, n = 10, o = {}) => { addStatic(new THREE.CylinderGeometry(r0, r1, h, n, 1, !!o.open), mat, x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, o.cast !== false); if (o.col) col(x - r1, z - r1, x + r1, z + r1, y - h / 2, y + h / 2); };
  const plane = (mat, x, y, z, w, h, rx = 0, ry = 0, rz = 0, cast = false) => addStatic(new THREE.PlaneGeometry(w, h), mat, x, y, z, rx, ry, rz, cast);
  const phong = (map, tile, color, shin = 6, o = {}) => { const m = new THREE.MeshPhongMaterial(Object.assign({ map, color: color !== undefined ? C(color) : 0xffffff, shininess: shin, specular: new THREE.Color(0x111111) }, o)); m.userData.tile = tile; return m; };
  const M = {
    logs: phong(T.logs, 2.0), boards: phong(T.boards, 1.6), floor: phong(T.floor, 2.4), ceil: phong(T.boards, 1.8, '#9a7a5a'),
    roof: phong(T.roof, 2.2), stone: phong(T.stone, 2.0), concrete: phong(T.concrete, 2.4), tile: phong(T.tile, 1.0, undefined, 40), paper: phong(T.wallpaper, 1.1),
    wood: phong(T.boards, 0.9, '#d8a878', 10), dark: phong(T.boards, 0.9, '#7a5638', 10), darker: phong(T.boards, 0.9, '#4e3626', 12), trim: phong(T.boards, 1.2, '#6a4a30'),
    beam: phong(T.logs, 1.2, '#9a7a5a'), soil: phong(T.soil, 1.4), dirt: phong(T.dirt, 2.0), metal: phong(T.metal, 1.0, '#8a8a8a', 40), iron: G.mat('#262628', 30),
    white: G.mat('#dcd8d0', 20), porcelain: G.mat('#eeeae4', 70), rust: phong(T.rust, 1.2), rock: phong(T.rock, 1.5), bark: phong(T.bark, 1.0)
  };

  // ================= terrain =================
  const terrainH = (x, z) => {
    const dx = Math.max(-26 - x, 0, x - 38), dz = Math.max(-20 - z, 0, z - 32), d = Math.hypot(dx, dz);
    let h = (Math.sin(x * 0.045) * Math.cos(z * 0.05) * 2.2 + Math.sin(x * 0.11 + z * 0.07) * 0.7 + Math.sin(z * 0.09 - x * 0.03) * 0.8) * sm(0, 16, d) + d * d * 0.0035;
    h += 7.2 * Math.exp(-((x - 31) ** 2 + (z + 31) ** 2) / 170);
    h += 0.35 * Math.sin(x * 0.3) * Math.cos(z * 0.27) * sm(14, 22, Math.hypot(x - 2, z - 1));
    if (z > 9 && z < 80) { const ry = z < 30 ? 0 : -(z - 30) * 0.07, m = sm(6, 2.6, Math.abs(x)); h = h * (1 - m) + ry * m; }
    if (z > 70) h -= 32 * sm(70.5, 74, z) * sm(130, 100, z);
    if (Math.abs(x) < 11.5 && z > -8.5 && z < 10.5) h = 0;
    return h;
  };
  W.terrainH = terrainH;
  const grassM = new THREE.MeshLambertMaterial({ map: T.grass });
  {
    const S = 1.5, N = 200, ox = -150, oz = -150, keepP = [], keepU = [];
    const inHole = (x, z) => x > -10.4 && x < 10.4 && z > -7.4 && z < 7.4;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x0 = ox + i * S, z0 = oz + j * S, x1 = x0 + S, z1 = z0 + S;
      if (inHole((x0 + x1) / 2, (z0 + z1) / 2)) continue;
      const P = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]].map(([x, z]) => [x, terrainH(x, z), z]);
      for (const t of [[0, 1, 2], [0, 2, 3]]) for (const k of t) { const p = P[k]; keepP.push(p[0], p[1], p[2]); keepU.push(p[0] / 4, p[2] / 4); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(keepU, 2));
    g.computeVertexNormals();
    // smooth normals across shared positions
    const p = g.attributes.position, n = g.attributes.normal, acc = new Map();
    for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(2) + ',' + p.getZ(i).toFixed(2); const a = acc.get(k) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(k, a); }
    for (let i = 0; i < p.count; i++) { const a = acc.get(p.getX(i).toFixed(2) + ',' + p.getZ(i).toFixed(2)), l = Math.hypot(a[0], a[1], a[2]); n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    const ground = new THREE.Mesh(g, grassM); ground.receiveShadow = true; ground.matrixAutoUpdate = false; scene.add(ground); W.ground = ground;
  }
  // path / dirt overlays (soft-edged strips following the ground)
  {
    const [c, g] = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; return [c, c.getContext('2d')]; })();
    const img = T.dirt.image; g.drawImage(img, 0, 0, 128, 128);
    const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.28, 'rgba(0,0,0,0)'); gr.addColorStop(0.72, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapT = THREE.RepeatWrapping;
    const pm = new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    W.paths = [];
    const strip = (pts, w) => {
      const pos = [], uv = []; let L = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len * w / 2, nz = (bx - ax) / len * w / 2, segs = Math.ceil(len / 1.2);
        for (let k = 0; k < segs; k++) {
          const t0 = k / segs, t1 = (k + 1) / segs, x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
          const v = [[x0 - nx, z0 - nz, 0, L + len * t0], [x0 + nx, z0 + nz, 1, L + len * t0], [x1 + nx, z1 + nz, 1, L + len * t1], [x1 - nx, z1 - nz, 0, L + len * t1]];
          for (const q of [0, 1, 2, 0, 2, 3]) { const [x, z, u, vv] = v[q]; pos.push(x, terrainH(x, z) + 0.02, z); uv.push(u, vv / 3); }
        }
        L += len; W.paths.push({ a: pts[i], b: pts[i + 1], w });
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, pm); m.receiveShadow = true; m.renderOrder = 1; scene.add(m);
    };
    strip([[0, 9.8], [0, 14], [1, 30], [0, 50], [0, 70.5]], 4.2);
    strip([[0.6, 10.2], [6, 10.5], [10.5, 7.5], [12, 2], [13.3, 0.3]], 1.3);
    strip([[-0.8, 10.4], [-6, 10.6], [-11, 7.8], [-13.5, 5]], 1.2);
    strip([[-13.5, 4], [-14, 0], [-13.4, -3.2]], 1.1);
    strip([[12.5, -1], [12.4, -6], [14.5, -8.3]], 1.1);
    strip([[13, -5], [18, -13], [23, -20], [27.5, -26.5], [30, -29.5]], 1.4);
    strip([[11, 9], [17, 14], [23, 18.5]], 1.1);
  }
  // distant mountains
  {
    const mg = [], R = G.rngF(7);
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2 + R() * 0.2, d = 200 + R() * 90, h = 70 + R() * 80, r = 55 + R() * 45;
      const cone = new THREE.ConeGeometry(r, h, 8, 3); const pp = cone.attributes.position;
      for (let k = 0; k < pp.count; k++) { const y = pp.getY(k); if (y < h / 2 - 1 && y > -h / 2 + 1) { pp.setX(k, pp.getX(k) * (0.85 + R() * 0.3)); pp.setZ(k, pp.getZ(k) * (0.85 + R() * 0.3)); } }
      cone.translate(Math.cos(a) * d, h / 2 - 8, Math.sin(a) * d);
      const g2 = cone.toNonIndexed(), n2 = g2.attributes.position.count, cc = new Float32Array(n2 * 3);
      for (let k = 0; k < n2; k++) { const y = g2.attributes.position.getY(k), snow = y > h * 0.62 - 8, t = 0.85 + R() * 0.15; const c = snow ? [0.85, 0.87, 0.92] : [0.12 * t, 0.15 * t, 0.2 * t]; cc[k * 3] = c[0]; cc[k * 3 + 1] = c[1]; cc[k * 3 + 2] = c[2]; }
      g2.setAttribute('color', new THREE.BufferAttribute(cc, 3)); mg.push(g2);
    }
    const mgeo = THREE.BufferGeometryUtils.mergeBufferGeometries(mg); mgeo.computeVertexNormals();
    const mm = new THREE.Mesh(mgeo, new THREE.MeshLambertMaterial({ vertexColors: true })); mm.matrixAutoUpdate = false; scene.add(mm);
  }
  // ---- vegetation (instanced, wind via shader) ----
  W.windU = { value: 0 };
  const windify = (mat, amt) => {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uWind = W.windU;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 ip = instanceMatrix[3];
        #else
          vec4 ip = vec4(0.0);
        #endif
        float ww = sin(uWind * 1.7 + ip.x * 0.35 + ip.z * 0.27) + 0.4 * sin(uWind * 3.1 + ip.x);
        transformed.x += ww * ${amt.toFixed(4)} * position.y * position.y; transformed.z += ww * ${(amt * 0.6).toFixed(4)} * position.y * position.y;`);
    };
    return mat;
  };
  const vcol = (g, c, j = 0.1) => { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) { const v = 1 - j / 2 + Math.random() * j; a[k * 3] = c[0] * v; a[k * 3 + 1] = c[1] * v; a[k * 3 + 2] = c[2] * v; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const blocked = (x, z) => (x > -12 && x < 12 && z > -9 && z < 11) || (Math.abs(x) < 4 && z > 8 && z < 76) || (x > 12 && x < 23 && z > -5 && z < 5) || (x > 11 && x < 18 && z > -12.5 && z < -7.5) || (x > -18.5 && x < -11 && z > -8 && z < 1) || (x > -10 && x < -2 && z > 12 && z < 21);
  // Split an InstancedMesh into spatial chunks with real bounding spheres, so the camera and the
  // shadow camera can cull them, plus distance culling (see W.update).
  W.chunks = [];
  const chunkify = (inst, cell, rad, maxD, cast) => {
    const map = new Map(), m = new THREE.Matrix4(), cols = inst.instanceColor;
    for (let i = 0; i < inst.count; i++) { inst.getMatrixAt(i, m); const e = m.elements, k = Math.floor(e[12] / cell) + ',' + Math.floor(e[14] / cell); if (!map.has(k)) map.set(k, []); map.get(k).push(i); }
    for (const list of map.values()) {
      let cx = 0, cy = 0, cz = 0; for (const i of list) { inst.getMatrixAt(i, m); cx += m.elements[12]; cy += m.elements[13]; cz += m.elements[14]; } cx /= list.length; cy /= list.length; cz /= list.length;
      let r = 0; for (const i of list) { inst.getMatrixAt(i, m); r = Math.max(r, Math.hypot(m.elements[12] - cx, m.elements[13] - cy, m.elements[14] - cz)); }
      const g = inst.geometry.clone(); g.boundingSphere = new THREE.Sphere(new V3(0, 0, 0), r + rad);
      const c = new THREE.InstancedMesh(g, inst.material, list.length), off = new THREE.Matrix4().makeTranslation(-cx, -cy, -cz), col = new THREE.Color();
      list.forEach((i, j) => { inst.getMatrixAt(i, m); c.setMatrixAt(j, off.clone().multiply(m)); if (cols) { inst.getColorAt(i, col); c.setColorAt(j, col); } });
      c.position.set(cx, cy, cz); c.castShadow = !!cast; c.receiveShadow = true; scene.add(c);
      W.chunks.push({ mesh: c, x: cx, z: cz, r: r + rad, maxD });
    }
    inst.geometry.dispose && 0;
  };
  // merge sibling meshes that share a material into one mesh (fewer draw calls)
  const mergeKids = (group, mat) => { const ks = group.children.filter(c => c.isMesh && c.material === mat); if (ks.length < 2) return ks[0];
    const gs = ks.map(k => { k.updateMatrix(); const g = k.geometry.index ? k.geometry.toNonIndexed() : k.geometry.clone(); g.applyMatrix4(k.matrix); return g; });
    ks.forEach(k => group.remove(k)); const m = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(gs), mat); m.castShadow = ks[0].castShadow; group.add(m); return m; };
  W.treePos = [];
  {
    const parts = [], trunk = new THREE.CylinderGeometry(0.14, 0.26, 2.4, 6); trunk.translate(0, 1.2, 0); parts.push(vcol(trunk, [0.3, 0.2, 0.13]));
    [[2.2, 3.6, 2.0], [1.65, 3.0, 3.7], [1.05, 2.4, 5.2], [0.5, 1.6, 6.5]].forEach(([r, h, y]) => { const c = new THREE.ConeGeometry(r, h, 7, 1, true); c.translate(0, y, 0); parts.push(vcol(c, [0.07, 0.17, 0.1], 0.35)); });
    const tg = THREE.BufferGeometryUtils.mergeBufferGeometries(parts); tg.computeVertexNormals();
    const count = Q.trees || 900, inst = new THREE.InstancedMesh(tg, windify(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.0012), count);
    const R = G.rngF(11), m4 = new THREE.Matrix4(); let n = 0, tries = 0;
    while (n < count && tries < 40000) {
      tries++;
      const a = R() * Math.PI * 2, d = 18 + Math.pow(R(), 0.6) * 150, x = Math.cos(a) * d + 4, z = Math.sin(a) * d + 4;
      if (blocked(x, z) || (x > 14 && x < 38 && z > 8 && z < 30) || Math.hypot(x - 30, z + 30) < 7 || (Math.hypot(x - 22, z + 21) < 2.5) || (z > 70 && z < 120 && Math.abs(x) < 30)) continue;
      if (d < 30 && R() < 0.5) continue;
      const s = 0.75 + R() * 0.9, y = terrainH(x, z);
      m4.compose(new V3(x, y - 0.15, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new V3(s, s * (0.85 + R() * 0.45), s));
      inst.setMatrixAt(n++, m4); W.treePos.push([x, z]);
      if (d < 90) col(x - 0.3 * s, z - 0.3 * s, x + 0.3 * s, z + 0.3 * s, y - 1, y + 4);
    }
    inst.count = n; chunkify(inst, 80, 8, 170, true);
  }
  {
    const parts = [], trunk = new THREE.CylinderGeometry(0.09, 0.13, 5, 6); trunk.translate(0, 2.5, 0);
    const tm = vcol(trunk, [0.85, 0.84, 0.8], 0.15); parts.push(tm);
    for (let i = 0; i < 6; i++) { const c = new THREE.IcosahedronGeometry(1.1 + (i % 3) * 0.3, 0); c.translate(Math.cos(i * 2) * 0.8, 3.6 + (i % 3) * 0.9, Math.sin(i * 2) * 0.8); parts.push(vcol(c, [0.17, 0.27, 0.07], 0.45)); }
    const tg = THREE.BufferGeometryUtils.mergeBufferGeometries(parts); tg.computeVertexNormals();
    const count = 130, inst = new THREE.InstancedMesh(tg, windify(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.003), count);
    const R = G.rngF(21), m4 = new THREE.Matrix4(); let n = 0, tries = 0;
    while (n < count && tries < 9000) { tries++; const a = R() * Math.PI * 2, d = 16 + R() * 60, x = Math.cos(a) * d + 4, z = Math.sin(a) * d + 4;
      if (blocked(x, z) || (x > 14 && x < 38 && z > 8 && z < 30) || Math.hypot(x - 30, z + 30) < 7) continue;
      const s = 0.8 + R() * 0.5, y = terrainH(x, z); m4.compose(new V3(x, y - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new V3(s, s, s)); inst.setMatrixAt(n++, m4); col(x - 0.2, z - 0.2, x + 0.2, z + 0.2, y - 1, y + 4); }
    inst.count = n; chunkify(inst, 80, 7, 120, true);
  }
  { // rocks
    const rg = new THREE.IcosahedronGeometry(1, 1), rp = rg.attributes.position, R = G.rngF(5);
    for (let i = 0; i < rp.count; i++) { const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i), h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453, k = 0.8 + (h - Math.floor(h)) * 0.35; rp.setXYZ(i, x * k, y * k * 0.7, z * k); }
    rg.computeVertexNormals();
    const list = [];
    for (let i = 0; i < 160; i++) { const a = R() * 6.28, d = 14 + R() * 100, x = Math.cos(a) * d + 3, z = Math.sin(a) * d + 3; if (blocked(x, z)) continue; list.push([x, z, 0.3 + R() * 0.9]); }
    [[33.6, -27.2, 1.5], [32.6, -33.2, 2.2], [27.4, -34.0, 1.2], [35.2, -30.6, 1.0], [24.4, -32.2, 0.9], [27.8, 22.5, 1.3], [-20, 14, 1.4], [20, 26, 1.1]].forEach(r => list.push(r));
    const inst = new THREE.InstancedMesh(rg, M.rock, list.length), m4 = new THREE.Matrix4();
    list.forEach(([x, z, s], i) => { const y = terrainH(x, z); m4.compose(new V3(x, y + s * 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 0.3, R() * 6, R() * 0.3)), new V3(s * (1 + R() * 0.5), s, s)); inst.setMatrixAt(i, m4); if (s > 0.8) col(x - s * 0.9, z - s * 0.9, x + s * 0.9, z + s * 0.9, y - 1, y + s * 1.2); });
    chunkify(inst, 80, 3, 140, true);
    W.signalRock = { x: 32.6, z: -33.2, top: terrainH(32.6, -33.2) + 2.2 };
  }
  { // grass tufts + wildflowers
    const blade = []; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.random(), h = 0.22 + Math.random() * 0.2, w = 0.035, cx = Math.cos(a) * 0.06, cz = Math.sin(a) * 0.06, lx = Math.cos(a + 1.57) * w, lz = Math.sin(a + 1.57) * w, tx = Math.cos(a) * 0.12, tz = Math.sin(a) * 0.12;
      blade.push(cx - lx, 0, cz - lz, cx + lx, 0, cz + lz, cx + tx, h, cz + tz); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(blade, 3)); bg.computeVertexNormals();
    const nb = bg.attributes.position.count, bc = new Float32Array(nb * 3); for (let k = 0; k < nb; k++) { const top = k % 3 === 2; bc[k * 3] = top ? 0.32 : 0.12; bc[k * 3 + 1] = top ? 0.45 : 0.22; bc[k * 3 + 2] = top ? 0.14 : 0.06; } bg.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    const gm = windify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.6);
    const N = Q.grass || 9000, R = G.rngF(3), quad = [[], [], [], []];
    for (let i = 0; i < N * 3 && quad.reduce((a, b) => a + b.length, 0) < N; i++) {
      const x = -30 + R() * 72, z = -24 + R() * 60;
      if ((x > -10.6 && x < 10.6 && z > -7.6 && z < 10.2) || (Math.abs(x) < 2.6 && z > 9) || (x > 13.2 && x < 21.8 && z > -3.8 && z < 3.8) || (x > -10 && x < -2 && z > 15 && z < 19.5)) continue;
      let onPath = false; for (const p of W.paths) { const [ax, az] = p.a, [bx, bz] = p.b, dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); if (Math.hypot(x - ax - dx * t, z - az - dz * t) < p.w * 0.45) { onPath = true; break; } }
      if (onPath) continue;
      quad[(x > 6 ? 1 : 0) + (z > 3 ? 2 : 0)].push([x, z]);
    }
    const m4 = new THREE.Matrix4();
    for (const qd of quad) { if (!qd.length) continue; const inst = new THREE.InstancedMesh(bg, gm, qd.length); qd.forEach(([x, z], i) => { const s = 0.7 + R() * 0.8; m4.compose(new V3(x, terrainH(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new V3(s, s * (0.8 + R() * 0.6), s)); inst.setMatrixAt(i, m4); }); chunkify(inst, 20, 1, 40, false); }
    // wildflowers (instanced, coloured per instance)
    const fl = []; const st = new THREE.CylinderGeometry(0.006, 0.008, 0.36, 3); st.translate(0, 0.18, 0); fl.push(vcol(st, [0.2, 0.35, 0.12]));
    const hd = new THREE.IcosahedronGeometry(0.045, 0); hd.scale(1, 0.55, 1); hd.translate(0, 0.37, 0); fl.push(vcol(hd, [1, 1, 1], 0));
    const fg = THREE.BufferGeometryUtils.mergeBufferGeometries(fl); fg.computeVertexNormals();
    const fpos = []; for (let i = 0; i < (Q.flowers || 1600); i++) { const a = R() * 6.28, d = Math.sqrt(R()) * 11; fpos.push([26 + Math.cos(a) * d * 1.3, 19 + Math.sin(a) * d]); }
    for (let i = 0; i < 260; i++) { const x = -25 + R() * 60, z = -18 + R() * 45; if (!blocked(x, z)) fpos.push([x, z]); }
    for (let i = 0; i < 90; i++) { const s = R() < 0.5 ? -1 : 1; fpos.push([s * (1.7 + R() * 4.8), 10.0 + R() * 0.55]); }
    const finst = new THREE.InstancedMesh(fg, windify(new THREE.MeshLambertMaterial({ vertexColors: true }), 1.2), fpos.length);
    const fcols = ['#ff4fa0', '#7a6aff', '#ffffff', '#ffd040', '#ff7040', '#c060ff', '#6aa0ff'].map(h => C(h));
    fpos.forEach(([x, z], i) => { const s = 0.7 + R() * 0.7; m4.compose(new V3(x, terrainH(x, z) + (z > 9.9 && z < 10.6 && Math.abs(x) < 7 ? 0.08 : 0), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new V3(s, s, s)); finst.setMatrixAt(i, m4); finst.setColorAt(i, fcols[(R() * fcols.length) | 0]); });
    chunkify(finst, 20, 1, 55, false);
  }

  // ================= cabin =================
  const WT = 0.3, X0 = -10, X1 = 10, Z0 = -7, Z1 = 7, CE1 = 2.8, FL2 = 3.0, CE2 = 5.6;
  function wallZ(z, x0, x1, holes, mat, t, y0, y1) {
    let x = x0; holes = holes.slice().sort((a, b) => a[0] - b[0]);
    for (const [a, b, ha, hb] of holes) { if (a > x) box(mat, x, y0, z - t / 2, a, y1, z + t / 2, { col: true }); if (ha > y0) box(mat, a, y0, z - t / 2, b, ha, z + t / 2, { col: true }); if (hb < y1) box(mat, a, hb, z - t / 2, b, y1, z + t / 2, { col: true }); x = b; }
    if (x < x1) box(mat, x, y0, z - t / 2, x1, y1, z + t / 2, { col: true });
  }
  function wallX(x, z0, z1, holes, mat, t, y0, y1) {
    let z = z0; holes = holes.slice().sort((a, b) => a[0] - b[0]);
    for (const [a, b, ha, hb] of holes) { if (a > z) box(mat, x - t / 2, y0, z, x + t / 2, y1, a, { col: true }); if (ha > y0) box(mat, x - t / 2, y0, a, x + t / 2, ha, b, { col: true }); if (hb < y1) box(mat, x - t / 2, hb, a, x + t / 2, y1, b, { col: true }); z = b; }
    if (z < z1) box(mat, x - t / 2, y0, z, x + t / 2, y1, z1, { col: true });
  }
  // outer walls (logs inside and out)
  const SW = [[-0.6, 0.6, 0, 2.2], [-7.6, -6.0, 1.0, 2.0], [3.6, 5.0, 1.0, 2.0], [6.8, 8.2, 1.0, 2.0], [-2.6, -1.4, 3.9, 4.9], [1.8, 2.8, 3.9, 4.9], [6.7, 7.7, 3.9, 4.9]];
  const NW = [[-2.2, -0.8, 1.2, 2.0], [0.0, 1.2, 3.9, 4.9], [-7.5, -6.5, 4.0, 4.8]];
  const WW = [[-3.6, -2.8, 1.5, 2.1], [-0.6, 0.6, 3.9, 4.8]];
  const EW = [[4.0, 5.4, 1.0, 2.0], [-3.4, -2.2, 1.0, 2.0], [1.0, 2.2, 3.9, 4.9]];
  wallZ(Z1, X0 - WT / 2, X1 + WT / 2, SW, M.logs, WT, 0, CE2);
  wallZ(Z0, X0 - WT / 2, X1 + WT / 2, NW, M.logs, WT, -3.0, CE2);
  wallX(X0, Z0 + WT / 2, Z1 - WT / 2, WW, M.logs, WT, 0, CE2);
  wallX(X1, Z0 + WT / 2, Z1 - WT / 2, EW, M.logs, WT, 0, CE2);
  // stone plinth around the base (hides the terrain seam) + foundation below grade
  box(M.stone, X0 - 0.5, -0.6, Z0 - 0.5, X1 + 0.5, 0.06, Z0 - WT / 2, { cast: false });
  box(M.stone, X0 - 0.5, -0.6, Z1 + WT / 2, X1 + 0.5, 0.06, Z1 + 0.5, { cast: false });
  box(M.stone, X0 - 0.5, -0.6, Z0 - WT / 2, X0 - WT / 2, 0.06, Z1 + WT / 2, { cast: false });
  box(M.stone, X1 + WT / 2, -0.6, Z0 - WT / 2, X1 + 0.5, 0.06, Z1 + WT / 2, { cast: false });
  // window frames, sills, glass, curtains
  const glass = new THREE.MeshPhongMaterial({ color: C('#9ab0c0'), transparent: true, opacity: 0.18, shininess: 90, specular: new THREE.Color(0x888888), depthWrite: false });
  W.windowGlow = [];
  const glowM = new THREE.MeshBasicMaterial({ color: C('#ffb060'), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const curt = phong(T.plaid, 0.8, undefined, 2, { side: THREE.DoubleSide });
  const win = (axis, w0, w1, h0, h1, pos, curtain) => {
    const w = w1 - w0, h = h1 - h0, cx = (w0 + w1) / 2, cy = (h0 + h1) / 2, f = 0.07;
    const B = (a0, a1, y0, y1, d0, d1) => axis === 'z' ? box(M.trim, a0, y0, pos + d0, a1, y1, pos + d1) : box(M.trim, pos + d0, y0, a0, pos + d1, y1, a1);
    { B(w0 - f, w1 + f, h0 - f, h0, -0.2, 0.2); B(w0 - f, w1 + f, h1, h1 + f, -0.2, 0.2); B(w0 - f, w0, h0, h1, -0.2, 0.2); B(w1, w1 + f, h0, h1, -0.2, 0.2); B(cx - 0.025, cx + 0.025, h0, h1, -0.03, 0.03); B(w0, w1, cy - 0.02, cy + 0.02, -0.03, 0.03); }
    B(w0 - 0.1, w1 + 0.1, h0 - 0.08, h0 - 0.03, -0.26, 0.26);
    plane(glass, axis === 'z' ? cx : pos, cy, axis === 'z' ? pos : cx, w, h, 0, axis === 'z' ? 0 : Math.PI / 2);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glowM.clone()); gl.position.set(axis === 'z' ? cx : pos, cy, axis === 'z' ? pos : cx); gl.rotation.y = axis === 'z' ? 0 : Math.PI / 2; scene.add(gl); W.windowGlow.push(gl);
    if (curtain) { const s = curtain; for (const e of [w0 - 0.15, w1 - 0.1]) { const g = new THREE.PlaneGeometry(0.28, h + 0.4, 6, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 40) * 0.025); addStatic(g, curt, axis === 'z' ? e + 0.12 : pos + s * 0.2, cy + 0.05, axis === 'z' ? pos + s * 0.2 : e + 0.12, 0, axis === 'z' ? 0 : Math.PI / 2, 0, false); }
      box(M.iron, axis === 'z' ? w0 - 0.25 : pos + s * 0.2 - 0.01, h1 + 0.25, axis === 'z' ? pos + s * 0.2 - 0.01 : w0 - 0.25, axis === 'z' ? w1 + 0.25 : pos + s * 0.2 + 0.01, h1 + 0.27, axis === 'z' ? pos + s * 0.2 + 0.01 : w1 + 0.25); }
  };
  SW.slice(1).forEach(([a, b, c, d]) => win('z', a, b, c, d, Z1, -1)); NW.forEach(([a, b, c, d]) => win('z', a, b, c, d, Z0, 1));
  WW.forEach(([a, b, c, d]) => win('x', a, b, c, d, X0, 1)); EW.forEach(([a, b, c, d]) => win('x', a, b, c, d, X1, -1));
  // floors / ceilings
  box(M.floor, X0 + 0.15, -0.2, -5.575, X1 - 0.15, 0, Z1 - 0.15, { cast: false });
  box(M.floor, -4.075, -0.2, Z0 + 0.15, X1 - 0.15, 0, -5.575, { cast: false });
  box(M.ceil, X0 + 0.15, CE1, Z0 + 0.15, 3.6, FL2 - 0.012, Z1 - 0.15, { cast: true });
  box(M.ceil, 3.6, CE1, -5.575, X1 - 0.15, FL2 - 0.012, Z1 - 0.15, { cast: true });
  box(M.floor, X0 + 0.15, FL2 - 0.01, Z0 + 0.15, 3.6, FL2, Z1 - 0.15, { cast: false });
  box(M.floor, 3.6, FL2 - 0.01, -5.575, X1 - 0.15, FL2, Z1 - 0.15, { cast: false });
  box(M.ceil, X0 + 0.15, CE2, Z0 + 0.15, X1 - 0.15, CE2 + 0.15, Z1 - 0.15, { cast: true });
  for (let x = -8.5; x <= 9; x += 2.2) { box(M.beam, x - 0.1, CE1 - 0.2, Z0 + 0.15, x + 0.1, CE1, Z1 - 0.15); box(M.beam, x - 0.1, CE2 - 0.18, Z0 + 0.15, x + 0.1, CE2, Z1 - 0.15); }
  // gables + roof + chimney
  for (const gx of [X0, X1]) for (let i = 0; i < 9; i++) { const y = CE2 + i * 0.32, half = 7.3 * (1 - (i + 0.5) / 9.2); box(M.logs, gx - WT / 2, y, -half, gx + WT / 2, y + 0.32, half); }
  { const rise = 2.9, run = 7.9, rl = Math.hypot(run, rise), ra = Math.atan2(rise, run);
    for (const s of [1, -1]) { const g = new THREE.BoxGeometry(21.4, 0.2, rl); boxUV(g, 21.4, 0.2, rl, 2.2); addStatic(g, M.roof, 0, CE2 + rise / 2 - 0.15 + 0.1, s * (run / 2 - 0.25), s * ra, 0, 0); }
    box(M.beam, -10.7, CE2 + rise - 0.2, -0.18, 10.7, CE2 + rise + 0.12, 0.18); }
  box(M.stone, X1 + WT / 2, -0.3, 0.6, 11.25, 9.0, 2.4, { col: true }); box(M.stone, X1 + WT / 2 + 0.1, 8.8, 0.5, 11.35, 9.1, 2.5);
  // ---- interior walls ----
  const IT = 0.15;
  wallX(-4, Z0 + WT / 2, Z1 - WT / 2, [[-6.75, -5.75, 0, 2.15], [-3.0, -2.1, 0, 2.15], [0.6, 1.5, 0, 2.15]], M.boards, IT, 0, CE1);
  wallZ(-5.5, X0 + WT / 2, -4.075, [], M.boards, IT, 0, CE1);
  wallZ(-1.0, X0 + WT / 2, -4.075, [], M.boards, IT, 0, CE1);
  wallX(-4, Z0 + WT / 2, Z1 - WT / 2, [[-6.2, -5.3, FL2, 5.1]], M.boards, IT, FL2, CE2);
  wallZ(-3.5, -3.925, X1 - WT / 2, [[-2.5, -1.6, FL2, 5.1], [1.0, 1.9, FL2, 5.1]], M.boards, IT, FL2, CE2);
  wallX(-0.075, -3.425, Z1 - WT / 2, [], M.boards, IT, FL2, CE2);
  // Mom's room wallpaper (thin inner skin), bathroom tile
  box(M.paper, X0 + 0.15, 0.0, -0.925, X0 + 0.17, CE1, Z1 - 0.15, { cast: false }); box(M.paper, -4.095, 0, -0.925, -4.075, CE1, 0.6, { cast: false }); box(M.paper, -4.095, 0, 1.5, -4.075, CE1, Z1 - 0.15, { cast: false });
  box(M.tile, X0 + 0.15, 0, -5.425, -4.075, 1.2, -5.405, { cast: false }); box(M.tile, X0 + 0.15, 0, -1.095, -4.075, 1.2, -1.075, { cast: false });
  // ---- stairs up (north wall, rising west) ----
  const ST = { x0: 3.6, x1: 9.0, z0: -6.85, z1: -5.6 };
  for (let i = 0; i < 15; i++) { const xa = ST.x1 - (i + 1) * 0.36, xb = ST.x1 - i * 0.36, top = (i + 1) * 0.2; box(M.dark, xa, top - 0.2, ST.z0, xb, top, ST.z1, { cast: true }); box(M.wood, xa - 0.02, top - 0.03, ST.z0, xb, top, ST.z1 + 0.02); }
  box(M.boards, ST.x0, 0, -5.6, 8.9, CE1, -5.5, { col: true, cy1: 2.9 });
  for (let x = 3.6; x <= 9.86; x += 0.45) box(M.dark, x - 0.025, FL2, -5.6, x + 0.025, FL2 + 0.95, -5.55);
  box(M.dark, 3.6, FL2 + 0.92, -5.62, X1 - 0.15, FL2 + 1.0, -5.52); col(3.6, -5.65, X1 - 0.15, -5.5, FL2, FL2 + 1.1);
  // ---- basement stairs (descending west) + stairwell ----
  const BS = { x0: -8.8, x1: -4.15, z0: -6.85, z1: -5.575 };
  for (let i = 0; i < 15; i++) { const xb = BS.x1 - i * 0.31, xa = xb - 0.31, top = -(i + 1) * 0.2; box(M.darker, xa, top - 0.2, BS.z0, xb, top, BS.z1); }
  box(M.concrete, X0 + 0.15, -3.15, -5.425, -0.15, -3.0, 3.95, { cast: false }); box(M.concrete, X0 + 0.15, -3.15, BS.z0, BS.x0, -3.0, BS.z1, { cast: false });
  wallZ(-5.5, X0 + WT / 2, -4.075, [[X0 + 0.15, -8.8, -3.0, -1.1]], M.stone, IT, -3.0, -0.2);
  wallX(-4, Z0 + WT / 2, -5.5, [], M.stone, IT, -3.0, 0);
  wallX(X0, Z0 + WT / 2, 4.1, [], M.stone, WT, -3.0, 0);
  wallX(-0.15, -5.5, 4.1, [], M.stone, WT, -3.0, -0.2);
  wallZ(4.0, X0, -0.15, [], M.stone, WT, -3.0, -0.2);
  box(M.stone, -3.55, -3.0, 0.6, -3.35, -0.2, 3.85, { col: true });
  for (let x = -9.2; x <= -1; x += 2.1) box(M.beam, x - 0.12, -0.5, -5.4, x + 0.12, -0.2, 3.85);
  box(M.beam, -5.3, -3.0, -2.6, -5.1, -0.5, -2.4, { col: true }); box(M.beam, -2.3, -3.0, -2.6, -2.1, -0.5, -2.4, { col: true });

  // ---- doors ----
  const doorM = phong(T.boards, 0.6, '#8a6040', 10), knobM = G.mat('#b89040', 60);
  const mkDoor = (name, hx, hz, w, axis, sign, opts = {}) => {
    const pivot = new THREE.Group(); pivot.position.set(hx, opts.y || 0, hz); scene.add(pivot);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, 2.1, 0.06), doorM); leaf.position.set(sign * w / 2, 1.05, 0); leaf.castShadow = true; pivot.add(leaf);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), knobM); kn.position.set(sign * (w - 0.1), 1.0, 0.05); pivot.add(kn); const kn2 = kn.clone(); kn2.position.z = -0.05; pivot.add(kn2);
    if (axis === 'x') pivot.rotation.y = Math.PI / 2;
    const y0 = opts.y || 0, c = axis === 'z' ? col(Math.min(hx, hx + sign * w), hz - 0.06, Math.max(hx, hx + sign * w), hz + 0.06, y0, y0 + 2.1) : col(hx - 0.06, Math.min(hz, hz - sign * w), hx + 0.06, Math.max(hz, hz - sign * w), y0, y0 + 2.1);
    const d = { pivot, col: c, cur: 0, target: 0, locked: !!opts.locked, auto: opts.auto !== false, openAng: opts.ang || 1.6, base: pivot.rotation.y, cx: axis === 'z' ? hx + sign * w / 2 : hx, cz: axis === 'z' ? hz : hz - sign * w / 2, y: y0, name, colLock: !!opts.colLock };
    W.doors[name] = d; return d;
  };
  mkDoor('front', 0.6, Z1 - 0.05, 1.2, 'z', -1, { ang: -1.7 });
  mkDoor('mom', -4, 1.5, 0.9, 'x', 1, { ang: 1.5 });
  mkDoor('bath', -4, -2.1, 0.9, 'x', 1, { ang: 1.5 });
  mkDoor('basement', -4, -5.75, 1.0, 'x', 1, { ang: -1.6, locked: true, auto: false });
  mkDoor('attic', -4, -5.3, 0.9, 'x', 1, { ang: 1.5, y: FL2 });
  { const d = W.doors.basement; const hasp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.05), G.mat('#444', 50)); hasp.position.set(0.9, 1.15, 0.06); d.pivot.add(hasp);
    W.padlock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.03), G.mat('#8a7a50', 70)); W.padlock.position.set(0.9, 1.08, 0.09); d.pivot.add(W.padlock); }
  W.setDoor = (name, open) => { const d = W.doors[name]; d.target = open ? 1 : 0; };
  W.lockDoor = (name, locked) => { W.doors[name].locked = locked; };

  // ================= furniture & props =================
  const shadowM = new THREE.MeshBasicMaterial({ map: T.shadow, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -1 });
  const blobs = [];
  const shade = (x, y, z, w, d) => blobs.push([x, y + 0.006, z, w, d]);
  const fabric = (c, s = 3) => G.mat(c, s);
  const bed = (x, z, y, len, wid, headDir, quiltTex, key) => { // headDir: +1 head at +z end
    const z0 = z - len / 2, z1 = z + len / 2;
    box(M.dark, x - wid / 2, y, z0, x + wid / 2, y + 0.32, z1, { col: true, cy1: y + 0.5 });
    const hz = headDir > 0 ? z1 : z0; box(M.dark, x - wid / 2 - 0.04, y, hz - 0.05, x + wid / 2 + 0.04, y + 0.95, hz + 0.05);
    const fz = headDir > 0 ? z0 : z1; box(M.dark, x - wid / 2 - 0.04, y, fz - 0.05, x + wid / 2 + 0.04, y + 0.55, fz + 0.05);
    box(M.white, x - wid / 2 + 0.03, y + 0.32, z0 + 0.06, x + wid / 2 - 0.03, y + 0.5, z1 - 0.06);
    const pz = hz - headDir * 0.28; const pg = new THREE.SphereGeometry(1, 10, 6); addStatic(pg, G.mat('#f0ece2', 4), x, y + 0.56, pz, 0, 0, 0, true, new V3(wid * 0.36, 0.07, 0.16));
    const qm = phong(quiltTex, 0.9, undefined, 3);
    const qg = new THREE.BoxGeometry(wid + 0.06, 0.08, len * 0.68, 6, 1, 8), qp = qg.attributes.position; for (let i = 0; i < qp.count; i++) { const xx = qp.getX(i), yy = qp.getY(i); if (Math.abs(xx) > wid / 2) qp.setY(i, yy - 0.16); qp.setY(i, qp.getY(i) + Math.sin(qp.getZ(i) * 9) * 0.012); } qg.computeVertexNormals();
    const qmesh = new THREE.Mesh(qg, qm); qmesh.position.set(x, y + 0.54, z - headDir * (len * 0.14)); qmesh.castShadow = qmesh.receiveShadow = true; scene.add(qmesh);
    shade(x, y, z, wid + 0.5, len + 0.4);
    W.beds = W.beds || {}; W.beds[key] = { x, z, y: y + 0.5, quilt: qmesh, head: hz, dir: headDir };
  };
  // ---------------- ground floor ----------------
  // Living room: fireplace on east wall
  box(M.stone, 8.95, 0, 0.3, X1 - 0.15, 1.5, 0.75, { col: true }); box(M.stone, 8.95, 0, 2.25, X1 - 0.15, 1.5, 2.7, { col: true });
  box(M.stone, 8.95, 1.0, 0.75, X1 - 0.15, 1.5, 2.25, { col: true }); box(M.stone, 9.55, 0, 0.75, X1 - 0.15, 1.0, 2.25);
  box(M.stone, 8.6, 0, 0.1, X1 - 0.15, 0.1, 2.9, { cast: false }); box(M.darker, 8.75, 1.5, 0.15, X1 - 0.15, 1.62, 2.85);
  box(M.stone, 9.25, 1.62, 0.6, X1 - 0.15, CE1, 2.4); col(8.9, 0.75, 9.55, 2.25, 0, 1);
  { const lg = new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6), lm = G.mat('#3a2616'); for (const [y, r] of [[0.15, 0.35], [0.15, -0.35], [0.27, 0]]) addStatic(lg.clone(), lm, 9.35, y, 1.5, 0, r, Math.PI / 2);
    W.fire = []; for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12 - i * 0.012, 0.5 - i * 0.05, 6), new THREE.MeshBasicMaterial({ color: C(i % 2 ? '#ffd27a' : '#ff7a1a'), transparent: true, opacity: 0.9, depthWrite: false })); f.position.set(9.35, 0.42, 1.2 + i * 0.15); scene.add(f); W.fire.push(f); }
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshPhongMaterial({ map: T.photo })); ph.position.set(9.18, 1.9, 1.5); ph.rotation.y = -Math.PI / 2; scene.add(ph); W.photo = ph;
    box(M.darker, 9.18, 1.62, 1.15, 9.24, 2.17, 1.85);
    cyl(G.mat('#efe6cc'), 9.0, 1.72, 0.6, 0.03, 0.03, 0.2, 8); cyl(G.mat('#efe6cc'), 9.0, 1.7, 2.4, 0.03, 0.03, 0.16, 8);
    box(M.darker, 8.85, 1.62, 2.55, 9.15, 1.95, 2.8); }
  // couch, coffee table, armchair, rug, bookshelf, radio, floor lamp, firewood basket
  { const cm = fabric('#5a6a46'), cm2 = fabric('#4a5a38'); box(cm, 6.0, 0, 0.2, 6.85, 0.48, 2.8, { col: true, cy1: 0.85 }); box(cm2, 5.82, 0, 0.2, 6.08, 0.95, 2.8, { col: true }); box(cm2, 5.82, 0, 0.0, 6.85, 0.68, 0.22); box(cm2, 5.82, 0, 2.78, 6.85, 0.68, 3.0);
    for (const z of [0.85, 2.1]) { const g = new THREE.SphereGeometry(1, 10, 6); addStatic(g, cm, 6.45, 0.56, z, 0, 0, 0, true, new V3(0.4, 0.09, 0.6)); }
    shade(6.4, 0, 1.5, 1.6, 3.4);
    box(M.dark, 7.3, 0.38, 0.9, 8.1, 0.44, 2.1); for (const [a, b] of [[7.35, 0.95], [8.05, 0.95], [7.35, 2.05], [8.05, 2.05]]) box(M.dark, a - 0.03, 0, b - 0.03, a + 0.03, 0.38, b + 0.03); col(7.3, 0.9, 8.1, 2.1, 0, 0.45);
    cyl(G.mat('#c8a040', 40), 7.7, 0.5, 1.3, 0.05, 0.06, 0.12, 8);
    const ac = fabric('#7a3a2a'); box(ac, 7.9, 0, 4.2, 8.8, 0.45, 5.1, { col: true, cy1: 0.9 }); box(ac, 8.65, 0, 4.2, 8.95, 1.05, 5.1); box(ac, 7.9, 0, 4.05, 8.95, 0.7, 4.22); box(ac, 7.9, 0, 5.08, 8.95, 0.7, 5.25); shade(8.4, 0, 4.65, 1.3, 1.4);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshPhongMaterial({ map: T.rugRound, shininess: 2 })); rug.rotation.x = -Math.PI / 2; rug.position.set(7.3, 0.007, 1.5); rug.scale.set(1, 1.3, 1); rug.receiveShadow = true; scene.add(rug);
    const bm = phong(T.books, 0.5); box(M.dark, 3.9, 0, 6.4, 5.9, 2.0, 6.85, { col: true });
    for (let s = 0; s < 4; s++) { const y = 0.1 + s * 0.48; box(M.darker, 3.95, y - 0.03, 6.42, 5.85, y, 6.82); const g = new THREE.PlaneGeometry(1.85, 0.32); addStatic(g, bm, 4.9, y + 0.16, 6.38, 0, Math.PI, 0, false); }
    box(M.dark, 5.3, 0, -0.35, 5.8, 0.6, 0.15, { col: true }); box(M.darker, 5.38, 0.6, -0.25, 5.72, 0.82, 0.05); cyl(G.mat('#c8c0a0', 50), 5.55, 0.71, 0.06, 0.04, 0.04, 0.005, 10, { rx: Math.PI / 2 });
    W.radio1 = { x: 5.55, y: 0.75, z: -0.1 };
    cyl(M.iron, 8.95, 0.8, 5.85, 0.015, 0.02, 1.6, 6); cyl(G.mat('#e8d8b0', 4), 8.95, 1.6, 5.85, 0.12, 0.2, 0.25, 12, { open: true }); cyl(M.iron, 8.95, 0.01, 5.85, 0.16, 0.16, 0.02, 10);
    cyl(G.mat('#8a6a3a'), 8.75, 0.2, 3.25, 0.25, 0.22, 0.4, 10); for (let i = 0; i < 4; i++) cyl(G.mat('#6a4a2a'), 8.68 + (i % 2) * 0.12, 0.45, 3.2 + (i > 1 ? 0.1 : -0.05), 0.06, 0.06, 0.5, 6, { rz: Math.PI / 2, ry: i });
    box(M.darker, 9.75, 1.6, -1.8, 9.83, 2.3, -1.2); }
  // entry: coat hooks + boots + mailbox key etc.
  box(M.dark, 1.2, 1.55, 6.78, 3.4, 1.65, 6.85);
  W.coats = {};
  [['linda', '#6e3a3c', 1.4], ['luke', '#5a1414', 1.85], ['lily', '#c8b8e8', 2.3], ['rose', '#d8b020', 2.75], ['leon', '#2a4a8a', 3.2]].forEach(([k, c, x]) => {
    const g = new THREE.CylinderGeometry(0.13, 0.2, 0.95, 8, 1); const m = new THREE.Mesh(g, G.mat(c, 4)); m.position.set(x, 1.12, 6.68); m.scale.z = 0.55; m.castShadow = true; scene.add(m); W.coats[k] = m;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), G.mat(c, 4)); hood.position.set(0, 0.5, -0.04); m.add(hood); });
  box(M.darker, 1.3, 0, 6.35, 3.3, 0.12, 6.8); for (let i = 0; i < 5; i++) { const x = 1.45 + i * 0.4; box(G.mat('#3a2a1e', 10), x - 0.06, 0.12, 6.45, x + 0.06, 0.3, 6.72); }
  // dining
  { box(M.wood, -1.45, 0.74, -0.8, 1.45, 0.8, 0.4); for (const [x, z] of [[-1.35, -0.7], [1.35, -0.7], [-1.35, 0.3], [1.35, 0.3]]) box(M.dark, x - 0.04, 0, z - 0.04, x + 0.04, 0.74, z + 0.04);
    col(-1.5, -0.85, 1.5, 0.45, 0, 0.82); shade(0, 0, -0.2, 3.8, 2.4);
    const seatDefs = { linda: [-1.9, -0.2, Math.PI / 2], leon: [1.9, -0.2, -Math.PI / 2], luke: [-0.65, -1.2, 0], lily: [0.65, -1.2, 0], rose: [-0.65, 0.8, Math.PI], spare: [0.65, 0.8, Math.PI] };
    for (const k in seatDefs) {
      const [x, z, yaw] = seatDefs[k]; W.seats[k] = { x, z, y: 0, yaw, h: 0.46 };
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      box(M.dark, x - 0.23, 0.42, z - 0.23, x + 0.23, 0.47, z + 0.23);
      for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) box(M.dark, x + a - 0.022, 0, z + b - 0.022, x + a + 0.022, 0.42, z + b + 0.022);
      const bx0 = x - fx * 0.21, bz0 = z - fz * 0.21;
      if (Math.abs(fx) > 0.5) { box(M.dark, bx0 - 0.025, 0.47, z - 0.22, bx0 + 0.025, 1.08, z + 0.22); } else { box(M.dark, x - 0.22, 0.47, bz0 - 0.025, x + 0.22, 1.08, bz0 + 0.025); }
      if (k !== 'leon') col(x - 0.24, z - 0.24, x + 0.24, z + 0.24, 0, 1);
      const px = x + fx * 0.5, pz = z + fz * 0.5;
      const plate = new THREE.Group(); plate.position.set(px, 0.805, pz); scene.add(plate);
      const pm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.018, 18), G.mat('#e8e4da', 50)); pm.receiveShadow = true; plate.add(pm);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), G.mat('#d8d0c0', 40, { side: THREE.DoubleSide })); bowl.position.y = 0.075; bowl.scale.y = 0.75; plate.add(bowl);
      const fill = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14), new THREE.MeshPhongMaterial({ map: T.oats, shininess: 30 })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.06; plate.add(fill);
      const steak = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.12, 3, 1, 3), new THREE.MeshPhongMaterial({ map: T.steak, shininess: 60, specular: new THREE.Color(0x221111) })); steak.position.y = 0.025; steak.rotation.y = 0.4; plate.add(steak);
      { const sp = steak.geometry.attributes.position; for (let i = 0; i < sp.count; i++) sp.setY(i, sp.getY(i) * (1 + Math.sin(sp.getX(i) * 30) * 0.2)); steak.geometry.computeVertexNormals(); }
      const pots = []; for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.028, 7, 5), G.mat('#c9a65a', 10)); p.position.set(-0.08 + i * 0.03, 0.025, 0.07); plate.add(p); pots.push(p); }
      const spoon = G.makeProp('spoon'); spoon.position.set(0.12, 0.012, 0); spoon.rotation.y = Math.PI / 2; plate.add(spoon);
      plate.visible = false;
      W.plates[k] = { group: plate, bowl, fill, steak, pots, x: px, z: pz };
    }
    W.food = (k, type) => { const p = W.plates[k]; if (!type) { p.group.visible = false; return; } p.group.visible = true; const bowlT = type === 'oats' || type === 'soup' || type === 'stew' || type === 'empty';
      p.bowl.visible = bowlT; p.fill.visible = bowlT && type !== 'empty'; p.steak.visible = type === 'steak'; p.pots.forEach(q => (q.visible = type === 'steak'));
      if (bowlT && type !== 'empty') { p.fill.material.map = T[type]; p.fill.scale.setScalar(1); p.fill.position.y = 0.06; }
      p.steak.scale.set(1, 1, 1); };
    W.eat = (k, f) => { const p = W.plates[k]; if (p.steak.visible) p.steak.scale.set(Math.max(0.05, 1 - f), 1, Math.max(0.1, 1 - f * 0.8)); if (p.fill.visible) { p.fill.position.y = 0.06 - f * 0.04; p.fill.scale.setScalar(Math.max(0.3, 1 - f * 0.5)); if (f >= 1) p.fill.visible = false; } };
    cyl(G.mat('#efe6cc'), 0, 0.88, -0.2, 0.03, 0.03, 0.16, 8); W.flame = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 6), new THREE.MeshBasicMaterial({ color: C('#ffc060') })); W.flame.position.set(0, 1.0, -0.2); scene.add(W.flame);
    cyl(M.iron, 0, 2.6, -0.2, 0.008, 0.008, 0.4, 4); cyl(G.mat('#2d3a2e', 30), 0, 2.32, -0.2, 0.08, 0.32, 0.2, 14, { open: true });
    W.lampD = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: C('#ffe0a0') })); W.lampD.position.set(0, 2.25, -0.2); scene.add(W.lampD);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.0), new THREE.MeshPhongMaterial({ map: T.rug, shininess: 2 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, -0.2); rug.receiveShadow = true; scene.add(rug);
    box(M.dark, -3.92, 0, 2.3, -3.4, 0.95, 4.2, { col: true }); box(M.dark, -3.92, 0.95, 2.35, -3.75, 2.1, 4.15); box(M.darker, -3.75, 1.3, 2.35, -3.4, 1.33, 4.15); box(M.darker, -3.75, 1.75, 2.35, -3.4, 1.78, 4.15);
    for (let i = 0; i < 5; i++) cyl(G.mat('#e8e4da', 40), -3.62, 1.47, 2.6 + i * 0.36, 0.13, 0.13, 0.02, 14, { rz: Math.PI / 2 - 0.15 });
  }
  // kitchen
  { box(M.dark, -3.0, 0, -6.85, 2.0, 0.86, -6.2, { col: true }); box(M.wood, -3.03, 0.86, -6.85, 2.03, 0.92, -6.17);
    for (let x = -2.9; x < 2.0; x += 0.6) box(M.darker, x + 0.04, 0.12, -6.2, x + 0.56, 0.8, -6.18);
    box(G.mat('#c8c8c4', 60), -2.1, 0.7, -6.75, -1.1, 0.93, -6.3); box(G.mat('#7a7a7a', 50), -2.0, 0.72, -6.7, -1.2, 0.92, -6.35); cyl(M.metal, -1.6, 1.08, -6.75, 0.012, 0.012, 0.3, 6);
    box(M.iron, 0.25, 0, -6.85, 1.35, 0.92, -6.1, { col: true }); box(G.mat('#141414', 40), 0.27, 0.92, -6.83, 1.33, 0.95, -6.12); cyl(M.iron, 1.0, 1.9, -6.65, 0.075, 0.075, 1.9, 8); cyl(M.iron, 1.0, CE1 - 0.05, -6.65, 0.1, 0.1, 0.1, 8);
    { const pan = new THREE.CylinderGeometry(0.19, 0.16, 0.06, 14); addStatic(pan, G.mat('#151515', 40), 0.65, 0.98, -6.45); addStatic(new THREE.BoxGeometry(0.3, 0.03, 0.04), G.mat('#151515'), 0.95, 0.99, -6.45); }
    W.panMeat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.15), new THREE.MeshPhongMaterial({ map: T.meat, shininess: 40 })); W.panMeat.position.set(0.65, 1.02, -6.45); W.panMeat.visible = false; scene.add(W.panMeat);
    W.pot = new THREE.Group(); { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.22, 14, 1, true), G.mat('#3a3a3c', 40, { side: THREE.DoubleSide })); p.position.y = 0.11; W.pot.add(p); const s = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), new THREE.MeshPhongMaterial({ map: T.soup, shininess: 60 })); s.rotation.x = -Math.PI / 2; s.position.y = 0.17; W.pot.add(s); W.potFill = s; }
    W.pot.position.set(1.05, 0.95, -6.35); scene.add(W.pot);
    box(M.dark, -3.0, 1.6, -6.85, -2.3, 2.4, -6.5); box(M.dark, -0.6, 1.6, -6.85, 0.1, 2.4, -6.5);
    box(M.darker, 1.5, 1.5, -6.85, 2.0, 1.53, -6.55); box(M.darker, 1.5, 1.9, -6.85, 2.0, 1.93, -6.55);
    // pantry: nearly empty
    box(M.dark, 2.1, 0, -6.85, 3.3, 2.2, -6.15, { col: true });
    for (let s = 0; s < 5; s++) box(M.darker, 2.15, 0.15 + s * 0.42, -6.8, 3.25, 0.18 + s * 0.42, -6.2);
    box(M.dark, 3.28, 0, -6.15, 3.32, 2.2, -5.45); box(M.dark, 2.08, 0, -6.15, 2.12, 2.2, -5.5);
    cyl(G.mat('#b04030', 40), 2.4, 1.04, -6.5, 0.05, 0.05, 0.12, 10); cyl(G.mat('#c8a040', 40), 2.95, 0.62, -6.5, 0.06, 0.06, 0.14, 10);
    W.meatJars = new THREE.Group(); scene.add(W.meatJars);
    { const jm = new THREE.MeshPhongMaterial({ map: T.jarMeat, shininess: 90, specular: new THREE.Color(0x553333) }), lid = G.mat('#c8b060', 60);
      for (let s = 1; s < 4; s++) for (let i = 0; i < 4; i++) { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.17, 10), jm); j.position.set(2.3 + i * 0.26, 0.18 + s * 0.42 + 0.09, -6.55); W.meatJars.add(j); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.02, 10), lid); l.position.set(0, 0.095, 0); j.add(l); } }
    W.meatJars.visible = false;
    box(M.dark, -1.3, 0, -4.9, 0.3, 0.88, -4.3, { col: true }); box(M.wood, -1.33, 0.88, -4.93, 0.33, 0.93, -4.27);
    box(G.mat('#b08a60', 10), -0.9, 0.93, -4.75, -0.4, 0.96, -4.45); W.prepMeat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.18), new THREE.MeshPhongMaterial({ map: T.meat, shininess: 50 })); W.prepMeat.position.set(-0.65, 0.99, -4.6); W.prepMeat.visible = false; scene.add(W.prepMeat);
    box(G.mat('#d0d0cc', 50), -3.9, 0, -4.6, -3.2, 1.7, -3.9, { col: true }); box(G.mat('#a8a8a4', 50), -3.21, 0.9, -4.55, -3.18, 1.5, -4.5);
    const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshPhongMaterial({ map: T.calendar })); cal.position.set(-3.915, 1.6, -4.95); cal.rotation.y = Math.PI / 2; scene.add(cal); W.calendar = cal;
    cyl(M.iron, -0.5, 2.6, -5.2, 0.008, 0.008, 0.4, 4); cyl(G.mat('#2d3a2e', 30), -0.5, 2.33, -5.2, 0.06, 0.25, 0.18, 12, { open: true });
    W.lampK = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: C('#ffe0a0') })); W.lampK.position.set(-0.5, 2.27, -5.2); scene.add(W.lampK);
    shade(-0.5, 0, -4.6, 2.0, 1.0); }
  // Mom's room
  { bed(-8.75, 2.75, 0, 2.1, 1.6, -1, T.quilt.linda, 'linda'); box(M.dark, X0 + 0.15, 0, 1.6, X0 + 0.22, 1.25, 3.9);
    W.beds.linda.x = -8.75;
    box(M.dark, -9.85, 0, 3.85, -9.35, 0.6, 4.35, { col: true }); cyl(G.mat('#e8d8b0', 4), -9.6, 0.8, 4.1, 0.08, 0.13, 0.18, 10, { open: true }); cyl(M.iron, -9.6, 0.65, 4.1, 0.015, 0.015, 0.1, 5);
    W.diary = { x: -9.5, y: 0.62, z: 3.95 }; box(G.mat('#5a2a3a', 8), -9.62, 0.6, 3.9, -9.42, 0.63, 4.05);
    box(M.dark, -8.6, 0, -0.9, -6.6, 1.0, -0.4, { col: true }); box(M.darker, -8.65, 1.0, -0.92, -6.55, 1.04, -0.36);
    box(G.mat('#a8b8c0', 90), -8.0, 1.2, -0.91, -7.2, 2.0, -0.89); box(M.darker, -8.06, 1.14, -0.92, -7.14, 2.06, -0.9);
    box(G.mat('#3a2a1e', 10), -6.9, 1.04, -0.7, -6.7, 1.06, -0.55);
    box(M.dark, -5.3, 0, 5.75, -4.15, 2.1, 6.85, { col: true }); box(M.darker, -4.73, 0.1, 5.73, -4.71, 2.0, 5.76);
    const rm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshPhongMaterial({ map: T.rug, shininess: 2 })); rm.rotation.x = -Math.PI / 2; rm.position.set(-6.6, 0.006, 2.8); scene.add(rm);
    box(M.dark, -6.0, 0.42, 5.4, -5.55, 0.46, 5.85); for (const [a, b] of [[-5.98, 5.42], [-5.57, 5.42], [-5.98, 5.83], [-5.57, 5.83]]) box(M.dark, a - 0.02, 0, b - 0.02, a + 0.02, 0.42, b + 0.02); cyl(G.mat('#a07a50', 5), -5.2, 0.15, 5.0, 0.18, 0.16, 0.25, 10);
    cyl(M.iron, -7, CE1 - 0.15, 3, 0.006, 0.006, 0.3, 4); }
  // bathroom
  { const tub = new THREE.CylinderGeometry(0.42, 0.38, 1.6, 16, 1, true, 0, Math.PI); addStatic(tub, M.porcelain, -9.35, 0.5, -4.0, Math.PI / 2, 0, Math.PI / 2); box(M.porcelain, -9.8, 0.08, -4.8, -8.9, 0.12, -3.2); col(-9.85, -4.85, -8.9, -3.15, 0, 0.7);
    for (const [x, z] of [[-9.7, -4.7], [-9.0, -4.7], [-9.7, -3.3], [-9.0, -3.3]]) cyl(G.mat('#b89040', 60), x, 0.05, z, 0.04, 0.03, 0.1, 6);
    box(M.porcelain, -7.0, 0, -1.6, -6.55, 0.42, -1.12, { col: true }); box(M.porcelain, -7.05, 0.42, -1.5, -6.5, 0.46, -1.1); box(M.porcelain, -7.05, 0.42, -1.2, -6.5, 0.9, -1.1);
    box(M.porcelain, -5.2, 0.75, -5.4, -4.5, 0.88, -5.0, { col: true, cy0: 0 }); cyl(M.porcelain, -4.85, 0.38, -5.25, 0.08, 0.1, 0.75, 8); box(G.mat('#a8b8c0', 90), -5.15, 1.2, -5.42, -4.55, 1.85, -5.40);
    cyl(G.mat('#8a8a8a', 40), -8.5, 0.2, -1.5, 0.17, 0.15, 0.4, 12, { open: true }); cyl(G.mat('#8a8a8a', 40), -8.1, 0.2, -1.45, 0.17, 0.15, 0.4, 12, { open: true });
    box(fabric('#a8c0c8'), -8.0, 1.1, -5.42, -7.4, 1.6, -5.38); cyl(M.iron, -7, CE1 - 0.15, -3.2, 0.006, 0.006, 0.3, 4); }
  // ---------------- upstairs ----------------
  { const Y = FL2;
    // hall
    box(M.dark, -3.9, Y, -6.85, -3.0, Y + 0.8, -6.3, { col: true }); cyl(G.mat('#e8d8b0', 4), -3.45, Y + 1.0, -6.55, 0.08, 0.13, 0.18, 10, { open: true });
    box(M.dark, 5.0, Y, -5.4, 6.4, Y + 0.55, -4.9, { col: true });
    const hr = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshPhongMaterial({ map: T.rug, shininess: 2 })); hr.rotation.x = -Math.PI / 2; hr.position.set(0.5, Y + 0.006, -4.6); scene.add(hr);
    // kids' bedroom: four beds
    bed(8.6, -2.4, Y, 2.0, 1.0, -1, T.quilt.luke, 'luke'); bed(5.8, -2.4, Y, 2.0, 1.0, -1, T.quilt.lily, 'lily');
    bed(5.8, 5.85, Y, 2.0, 1.0, 1, T.quilt.rose, 'rose'); bed(8.6, 5.85, Y, 2.0, 1.0, 1, T.quilt.leon, 'leon');
    // posters & sketches
    const poster = (tex, x, y, z, w, h, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhongMaterial({ map: tex, shininess: 10 })); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m; };
    poster(T.posterKaylie, 8.6, Y + 1.55, -3.41, 0.6, 0.9, 0); poster(T.posterGame, 9.83, Y + 1.5, -1.3, 0.55, 0.82, -Math.PI / 2); poster(T.posterKaylie, 7.55, Y + 1.7, -3.41, 0.4, 0.6, 0);
    poster(T.sketchMountain, 5.3, Y + 1.55, -3.41, 0.42, 0.42, 0.06); poster(T.sketchFamily, 5.85, Y + 1.7, -3.41, 0.42, 0.42, -0.04); poster(T.sketchLeon, 6.4, Y + 1.5, -3.41, 0.42, 0.42, 0.03);
    poster(T.pressed, 5.4, Y + 1.55, 6.84, 0.45, 0.45, Math.PI); poster(T.pressed, 6.2, Y + 1.65, 6.84, 0.35, 0.35, Math.PI);
    W.fairy = []; const fg2 = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ color: C('#ffb0e0') }); scene.add(fg2); for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), fm); b.position.set(5.15 + i * 0.1, Y + 1.98 - Math.sin(i / 13 * Math.PI) * 0.16, -3.38); fg2.add(b); } W.fairy.push(mergeKids(fg2, fm));
    // Luke's desk: dead laptop, crank charger, cans
    box(M.dark, 7.0, Y, -3.4, 7.7, Y + 0.75, -2.9, { col: true }); box(G.mat('#222', 40), 7.1, Y + 0.75, -3.35, 7.5, Y + 0.77, -3.05); box(G.mat('#222', 40), 7.1, Y + 0.77, -3.36, 7.5, Y + 1.0, -3.34);
    for (let i = 0; i < 3; i++) cyl(G.mat(['#3aa04a', '#c03030', '#3070c0'][i], 60), 7.58, Y + 0.81, -3.2 + i * 0.09, 0.025, 0.025, 0.12, 8);
    // Rose's plants on south sill + shelf
    W.rosePots = []; for (let i = 0; i < 4; i++) { const x = 6.85 + i * 0.25; cyl(G.mat('#b0603a', 10), x, Y + 0.93, 6.83, 0.06, 0.045, 0.11, 8); const pl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), G.mat(['#3a8a3a', '#4a9a3a', '#2a7a4a', '#5aa04a'][i], 5)); pl.position.set(x, Y + 1.05, 6.83); pl.scale.set(1, 1.3, 1); scene.add(pl); W.rosePots.push(pl);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), G.mat(['#7a6aff', '#ff4fa0', '#ffffff', '#7a6aff'][i], 10)); fl.position.set(0, 0.07, 0); pl.add(fl); }
    box(M.dark, 3.5, Y, 6.4, 4.6, Y + 1.2, 6.85, { col: true }); for (let i = 0; i < 3; i++) cyl(G.mat('#b0603a', 10), 3.7 + i * 0.4, Y + 1.27, 6.62, 0.08, 0.06, 0.14, 8);
    // Leon's corner: toys + comics
    box(M.dark, 9.3, Y, 3.6, 9.85, Y + 0.6, 4.6, { col: true }); for (let i = 0; i < 4; i++) box(G.mat(['#c03030', '#3060c0', '#e0b020', '#30a050'][i], 10), 9.35, Y + 0.6 + i * 0.015, 3.8 + i * 0.05, 9.7, Y + 0.615 + i * 0.015, 4.05 + i * 0.05);
    { const dino = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), G.mat('#3a9a4a', 20)); dino.position.set(9.6, Y + 0.68, 4.4); dino.rotation.z = Math.PI / 2; scene.add(dino); }
    // middle: rug, toy chest, Lily's easel, dresser
    const br = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), new THREE.MeshPhongMaterial({ map: T.rugRound, shininess: 2 })); br.rotation.x = -Math.PI / 2; br.position.set(7.2, Y + 0.006, 1.7); scene.add(br);
    box(M.dark, 2.6, Y, 0.6, 3.6, Y + 0.55, 1.2, { col: true }); box(M.darker, 2.58, Y + 0.55, 0.58, 3.62, Y + 0.6, 1.22);
    box(M.dark, 0.1, Y, 2.0, 0.6, Y + 1.1, 3.6, { col: true });
    box(M.dark, 1.7, Y, 6.25, 2.9, Y + 0.42, 6.85, { col: true }); box(G.mat('#c8a0b0', 3), 1.72, Y + 0.42, 6.27, 2.88, Y + 0.48, 6.83);
    for (const [a, b] of [[1.6, -1.5], [2.1, -1.5], [1.85, -1.1]]) cyl(M.dark, a, Y + 0.7, b, 0.015, 0.015, 1.45, 5, { rz: (a - 1.85) * 0.4, rx: (b + 1.4) * 0.3 });
    W.easel = poster(T.sketchMountain, 1.85, Y + 1.05, -1.42, 0.5, 0.5, 0.2);
    cyl(M.iron, 5, CE2 - 0.15, 1.7, 0.006, 0.006, 0.3, 4); W.lampB = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: C('#ffe0a0') })); W.lampB.position.set(5, CE2 - 0.35, 1.7); scene.add(W.lampB);
    cyl(G.mat('#e8d8b0', 4), 5, CE2 - 0.28, 1.7, 0.12, 0.25, 0.18, 12, { open: true });
    // props on beds (story toggles)
    W.lukePhone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.01, 0.15), G.mat('#151517', 60)); W.lukePhone.position.set(8.5, Y + 0.6, -2.1); W.lukePhone.rotation.y = 0.4; scene.add(W.lukePhone); W.lukePhone.visible = false;
    W.lukePhoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.13), new THREE.MeshBasicMaterial({ color: C('#9ab8ff') })); W.lukePhoneScreen.rotation.x = -Math.PI / 2; W.lukePhoneScreen.position.y = 0.006; W.lukePhone.add(W.lukePhoneScreen);
    W.lilyBook = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.32), G.mat('#2a3a4a', 8)); W.lilyBook.position.set(5.8, Y + 0.6, -1.8); W.lilyBook.rotation.y = -0.3; scene.add(W.lilyBook); W.lilyBook.visible = false;
    W.roseCrown = G.makeProp('crown'); W.roseCrown.position.set(5.8, Y + 0.6, 5.3); scene.add(W.roseCrown); W.roseCrown.visible = false;
    // study
    box(M.dark, -3.0, Y, 6.1, -1.0, Y + 0.78, 6.85, { col: true }); box(M.wood, -3.03, Y + 0.78, 6.08, -0.97, Y + 0.82, 6.85);
    box(G.mat('#3a3a34', 30), -2.5, Y + 0.82, 6.35, -1.6, Y + 1.12, 6.8); for (let i = 0; i < 4; i++) cyl(G.mat('#c8c8c0', 50), -2.35 + i * 0.22, Y + 0.97, 6.34, 0.03, 0.03, 0.02, 10, { rx: Math.PI / 2 });
    box(G.mat('#1a2a1a', 90), -2.45, Y + 0.95, 6.341, -2.1, Y + 1.07, 6.343);
    W.radio2 = { x: -2.05, y: Y + 1.0, z: 6.4 };
    cyl(G.mat('#2a2a2a', 40), -1.4, Y + 0.85, 6.45, 0.035, 0.05, 0.06, 8); cyl(M.iron, -1.4, Y + 0.95, 6.45, 0.006, 0.006, 0.15, 4);
    box(M.dark, -2.3, Y + 0.42, 5.3, -1.8, Y + 0.46, 5.8); for (const [a, b] of [[-2.28, 5.32], [-1.82, 5.32], [-2.28, 5.78], [-1.82, 5.78]]) box(M.dark, a - 0.02, Y, b - 0.02, a + 0.02, Y + 0.42, b + 0.02); box(M.dark, -2.3, Y + 0.46, 5.28, -1.8, Y + 1.0, 5.32);
    W.seats.study = { x: -2.05, z: 5.55, y: Y, yaw: 0, h: 0.46 };
    poster(T.mapTopo, -0.16, Y + 1.5, 3.5, 0.9, 0.9, -Math.PI / 2);
    box(M.dark, -3.92, Y + 1.1, 1.0, -3.85, Y + 1.9, 2.4); for (let i = 0; i < 3; i++) box(M.darker, -3.88, Y + 1.25 + i * 0.25, 1.1, -3.8, Y + 1.28 + i * 0.25, 2.3);
    { const gl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.01, 0.06, 1.1)), new THREE.LineBasicMaterial({ color: 0x2a1a10 })); gl.position.set(-3.83, Y + 1.4, 1.7); scene.add(gl); }
    box(M.dark, -0.6, Y, -3.4, -0.15, Y + 2.0, -1.4, { col: true }); for (let s = 0; s < 4; s++) { const y = Y + 0.1 + s * 0.48; const g = new THREE.PlaneGeometry(1.9, 0.32); addStatic(g, phong(T.books, 0.5), -0.61, y + 0.16, -2.4, 0, -Math.PI / 2, 0, false); }
    box(M.dark, -3.9, Y, -1.0, -3.3, Y + 0.75, 0.2, { col: true }); box(G.mat('#2a2a2a', 50), -3.85, Y + 0.75, -0.6, -3.4, Y + 1.0, -0.1);
    W.ledger = { x: -1.3, y: Y + 0.83, z: 6.3 }; box(G.mat('#6a4a2a', 6), -1.45, Y + 0.82, 6.22, -1.15, Y + 0.84, 6.45);
    cyl(G.mat('#e8d8b0', 4), -2.0, Y + 1.55, 6.3, 0.07, 0.12, 0.15, 10, { open: true });
    // attic storage
    const sheetM = G.mat('#cfc8b8', 3);
    [[-9.2, -5.8, 0.8], [-8.4, -6.2, 0.6], [-9.3, -4.6, 0.7], [-6.9, -6.4, 0.5], [-9.4, 5.6, 0.9], [-8.5, 6.1, 0.6], [-6.2, 6.3, 0.5]].forEach(([x, z, s]) => box(G.mat('#a08060', 5), x - s / 2, Y, z - s / 2, x + s / 2, Y + s, z + s / 2, { col: true }));
    box(M.darker, -9.7, Y, -1.5, -8.6, Y + 0.6, -0.9, { col: true });
    { const g = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); addStatic(g, sheetM, -7.0, Y, 3.0, 0, 0, 0, true, new V3(0.9, 1.3, 0.7)); col(-7.9, 2.3, -6.1, 3.7, Y, Y + 1.3);
      addStatic(g.clone(), sheetM, -8.8, Y, 2.0, 0, 0, 0, true, new V3(0.5, 1.6, 0.5)); col(-9.3, 1.5, -8.3, 2.5, Y, Y + 1.6); }
    for (const z of [-3.4, -2.6]) box(M.dark, -6.0, Y, z - 0.03, -5.0, Y + 0.9, z + 0.03); for (let x = -5.95; x <= -5.0; x += 0.12) box(M.dark, x, Y + 0.3, -3.4, x + 0.03, Y + 0.9, -2.6); col(-6.0, -3.45, -5.0, -2.55, Y, Y + 0.9);
  }

  // ---------------- basement ----------------
  { const Y = -3.0;
    // shelves of jars (preserves), chest freezer, workbench, furnace, wash tub, generator
    box(M.dark, -2.2, Y, -5.4, -0.3, Y + 2.0, -4.95, { col: true });
    const jm = new THREE.MeshPhongMaterial({ map: T.jarMeat, shininess: 90 }); for (let s = 0; s < 3; s++) { box(M.darker, -2.2, Y + 0.4 + s * 0.55, -5.4, -0.3, Y + 0.43 + s * 0.55, -4.95); for (let i = 0; i < 7; i++) { const g = new THREE.CylinderGeometry(0.06, 0.06, 0.17, 10); addStatic(g, s === 1 ? jm : G.mat('#7a5a2a', 60), -2.05 + i * 0.25, Y + 0.52 + s * 0.55, -5.15); } }
    box(G.mat('#e0e0dc', 40), -9.8, Y, -4.6, -8.5, Y + 0.9, -3.5, { col: true }); box(G.mat('#c8c8c4', 40), -9.82, Y + 0.9, -4.62, -8.48, Y + 0.95, -3.48);
    box(M.dark, -9.8, Y, -1.8, -9.2, Y + 0.9, 0.3, { col: true }); box(M.wood, -9.82, Y + 0.9, -1.82, -9.15, Y + 0.95, 0.32);
    for (let i = 0; i < 5; i++) box(M.iron, -9.84, Y + 1.3, -1.6 + i * 0.4, -9.82, Y + 1.9, -1.55 + i * 0.4);
    { const cl = new THREE.BoxGeometry(0.1, 0.01, 0.22); addStatic(cl, G.mat('#9a8a8a', 70), -9.45, Y + 0.96, -0.5, 0, 0.3, 0); addStatic(new THREE.BoxGeometry(0.03, 0.03, 0.14), G.mat('#2a1a10'), -9.45, Y + 0.97, -0.28, 0, 0.3, 0);
      const saw = new THREE.BoxGeometry(0.005, 0.1, 0.45); addStatic(saw, G.mat('#b0b0b0', 80), -9.83, Y + 1.5, -1.0, 0, 0, 0.1); }
    cyl(G.mat('#3a3a3c', 30), -1.2, Y + 0.9, -2.6, 0.45, 0.45, 1.8, 14, { col: true }); cyl(M.iron, -1.2, Y + 2.2, -2.6, 0.1, 0.1, 0.8, 8);
    cyl(G.mat('#7a7a7a', 40), -3.0, Y + 0.3, -1.2, 0.35, 0.3, 0.6, 14, { open: true, col: true }); { const w = new THREE.CircleGeometry(0.33, 14); addStatic(w, G.mat('#6a1a1a', 80), -3.0, Y + 0.5, -1.2, -Math.PI / 2); }
    box(G.mat('#c83a2a', 30), -2.2, Y, -0.4, -1.3, Y + 0.6, 0.3, { col: true }); box(G.mat('#2a2a2a', 30), -2.1, Y + 0.6, -0.3, -1.4, Y + 0.7, 0.2); W.generator = { x: -1.75, y: Y + 0.4, z: -0.05 };
    // meat hooks along the main beam
    const meatM = new THREE.MeshPhongMaterial({ map: T.meat, shininess: 55, specular: new THREE.Color(0x331111) });
    box(M.iron, -8.5, -0.75, -2.55, -3.5, -0.7, -2.45);
    for (let i = 0; i < 5; i++) { const x = -8.0 + i * 1.1; cyl(M.iron, x, -0.95, -2.5, 0.006, 0.006, 0.4, 4, { cast: false }); const ch = new THREE.DodecahedronGeometry(0.2 + (i % 2) * 0.06, 1); ch.scale(0.7, 1.5, 0.55); addStatic(ch, i === 2 ? G.mat('#d0c8b0', 4) : meatM, x, -1.45, -2.5, 0, i, 0); }
    // wall axe (taken in the finale)
    W.wallAxe = G.makeProp('axe'); W.wallAxe.position.set(-9.8, Y + 1.3, -3.0); W.wallAxe.rotation.set(-Math.PI / 2, 0, 0); scene.add(W.wallAxe);
    // drain + floor stains (main room)
    cyl(M.iron, -6.2, Y + 0.005, -2.0, 0.12, 0.12, 0.01, 12);
    // cold room: butcher table
    box(M.darker, -7.4, Y + 0.82, 1.6, -5.3, Y + 0.9, 2.6); for (const [x, z] of [[-7.3, 1.7], [-5.4, 1.7], [-7.3, 2.5], [-5.4, 2.5]]) box(M.dark, x - 0.05, Y, z - 0.05, x + 0.05, Y + 0.82, z + 0.05); col(-7.45, 1.55, -5.25, 2.65, Y, Y + 0.95);
    W.tableTop = Y + 0.9;
    cyl(G.mat('#7a7a7a', 40), -4.2, Y + 0.25, 3.3, 0.22, 0.19, 0.5, 12, { open: true }); { const l = new THREE.CircleGeometry(0.2, 12); addStatic(l, G.mat('#3a0303', 90), -4.2, Y + 0.45, 3.3, -Math.PI / 2); }
    // plastic curtain between main room and cold room
    W.curtain = new THREE.Group(); W.curtain.position.set(-9.85, Y, 0.6); scene.add(W.curtain);
    { const pm = new THREE.MeshPhongMaterial({ map: T.plastic, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, shininess: 80, specular: new THREE.Color(0x666666) });
      const g = new THREE.PlaneGeometry(6.3, 2.8, 24, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6) * 0.05); g.computeVertexNormals(); g.translate(3.15, 1.4, 0);
      W.curtainMesh = new THREE.Mesh(g, pm); W.curtain.add(W.curtainMesh); W.curtainCol = col(-9.85, 0.55, -3.55, 0.65, Y, Y + 2.8); }
    // bulbs
    W.bulb = new THREE.Group(); W.bulb.position.set(-5.2, -0.2, -2.0); scene.add(W.bulb);
    { const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.6, 4), M.iron); cord.position.y = -0.3; W.bulb.add(cord);
      W.bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: C('#fff0c0') })); W.bulbMesh.position.y = -0.62; W.bulb.add(W.bulbMesh); }
    W.bulb2 = new THREE.Group(); W.bulb2.position.set(-6.4, -0.2, 2.1); scene.add(W.bulb2);
    { const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), M.iron); cord.position.y = -0.25; W.bulb2.add(cord);
      W.bulb2Mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: C('#ffe8b0') })); W.bulb2Mesh.position.y = -0.52; W.bulb2.add(W.bulb2Mesh); }
    // gore (cold room + trail), shown in the finale
    W.decals = new THREE.Group(); scene.add(W.decals); W.decals.visible = false;
    const decal = (tex, x, y, z, w, h, rx, ry = 0, op = 1, rz = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhongMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, shininess: 90, specular: new THREE.Color(0x441111), polygonOffset: true, polygonOffsetFactor: -2 })); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.receiveShadow = true; W.decals.add(m); return m; };
    const F = Y + 0.006, flat = -Math.PI / 2;
    decal(T.pool, -6.3, F, 2.1, 3.0, 2.4, flat); decal(T.pool2, -8.4, F + 0.001, 2.4, 2.2, 1.8, flat, 0.4); decal(T.pool, -4.7, F + 0.002, 1.5, 1.8, 1.8, flat, 1.2);
    decal(T.smear, -5.0, F + 0.003, 0.3, 3.2, 0.7, flat, 0, 1, 1.4); decal(T.smear, -7.5, F + 0.003, -0.8, 2.6, 0.6, flat, 0, 1, 2.2); decal(T.smear, -8.8, F + 0.003, -3.6, 3.0, 0.7, flat, 0, 0.9, 1.7);
    decal(T.spatter, -9.83, Y + 1.5, 2.3, 2.6, 2.6, 0, Math.PI / 2); decal(T.spatter, -6.4, Y + 1.4, 3.83, 2.4, 2.4, 0, Math.PI); decal(T.spatter, -3.57, Y + 1.2, 2.0, 1.8, 1.8, 0, -Math.PI / 2);
    decal(T.drips, -5.3, Y + 0.45, 2.1, 0.9, 0.8, 0, Math.PI / 2); decal(T.pool2, -6.3, Y + 0.906, 2.1, 2.0, 0.95, flat);
    W.curtainGore = new THREE.Group(); W.curtain.add(W.curtainGore); W.curtainGore.visible = false;
    for (const [x, y, sz, op, rz] of [[4.65, 1.0, 0.22, 1, 0], [4.95, 0.7, 0.2, 0.9, 0.4], [3.2, 0.5, 0.5, 0.9, 0]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshPhongMaterial({ map: x === 3.2 ? T.drips : T.hand, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })); m.position.set(x, y, 0.06); m.rotation.z = rz; W.curtainGore.add(m); }
    decal(T.spatter, -8.6, F + 0.004, -2.6, 1.4, 1.4, flat);
    // flies
    { const n = 46, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      W.flies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x050505, size: 0.025 })); W.flies.frustumCulled = false; W.fliesPh = Array.from({ length: n }, () => [Math.random() * 6, Math.random() * 6, 0.8 + Math.random()]); scene.add(W.flies); W.flies.visible = false; }
  }

  // ================= exterior =================
  // porch
  box(M.floor, -7, -0.25, Z1 + WT / 2, 7, 0.02, 9.6, { cast: false }); box(M.dark, -1.2, -0.25, 9.6, 1.2, -0.08, 10.0, { cast: false });
  for (const px of [-6.8, -3.4, 3.4, 6.8]) box(M.beam, px - 0.1, 0, 9.35, px + 0.1, 2.9, 9.55, { col: true });
  { const g = new THREE.BoxGeometry(14.6, 0.14, 3.0); boxUV(g, 14.6, 0.14, 3.0, 2.2); addStatic(g, M.roof, 0, 2.98, 8.45, 0.16, 0, 0); }
  for (const [a, b] of [[-7, -1.2], [1.2, 7]]) { box(M.dark, a, 0.85, 9.42, b, 0.92, 9.5); box(M.dark, a, 0.4, 9.43, b, 0.45, 9.49); col(a, 9.38, b, 9.55, 0, 1); for (let x = a; x <= b; x += 0.4) box(M.dark, x - 0.02, 0, 9.43, x + 0.02, 0.85, 9.49); }
  for (const x of [-7, 7]) { box(M.dark, x - 0.04, 0.85, 7.2, x + 0.04, 0.92, 9.45); col(x - 0.08, 7.15, x + 0.08, 9.5, 0, 1); }
  box(M.dark, -5.6, 0.42, 7.2, -4.0, 0.48, 7.6); box(M.dark, -5.6, 0.48, 7.17, -4.0, 0.95, 7.22); for (const x of [-5.5, -4.1]) box(M.dark, x - 0.03, 0, 7.25, x + 0.03, 0.42, 7.55); col(-5.65, 7.15, -3.95, 7.65, 0, 0.9);
  W.seats.porch = { x: -4.8, z: 7.42, y: 0, yaw: 0, h: 0.48 };
  W.seats.step = { x: -0.3, z: 9.85, y: -0.08, yaw: 0, h: 0.0 };
  box(M.dark, 4.2, 0, 7.5, 4.9, 0.42, 8.1, { col: true, cy1: 0.9 }); box(M.dark, 4.15, 0.42, 7.45, 4.95, 1.0, 7.5);
  box(M.dark, 5.6, 0, 7.25, 6.8, 0.7, 7.8, { col: true }); for (let i = 0; i < 5; i++) cyl(G.mat('#7a5634'), 5.8 + i * 0.22, 0.75, 7.5, 0.08, 0.08, 0.5, 6, { rx: Math.PI / 2 });
  W.lantern = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), new THREE.MeshBasicMaterial({ color: C('#ffc070') })); W.lantern.position.set(1.4, 2.35, 9.3); scene.add(W.lantern);
  // Rose's flower beds in front of the porch
  for (const [a, b] of [[-6.6, -1.5], [1.5, 6.6]]) { box(M.soil, a, -0.05, 9.85, b, 0.08, 10.65, { cast: false }); box(M.dark, a - 0.05, -0.05, 9.8, b + 0.05, 0.12, 9.85); box(M.dark, a - 0.05, -0.05, 10.65, b + 0.05, 0.12, 10.7); }
  // well with hand pump
  { cyl(M.stone, 11, 0.4, 5.4, 0.7, 0.75, 0.8, 14, { col: true }); cyl(G.mat('#1a1a1a'), 11, 0.79, 5.4, 0.55, 0.55, 0.02, 14);
    box(G.mat('#3a5a4a', 40), 10.9, 0.8, 5.95, 11.1, 1.7, 6.15); W.pumpHandle = new THREE.Group(); W.pumpHandle.position.set(11.0, 1.65, 6.05); scene.add(W.pumpHandle);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), G.mat('#3a5a4a', 40)); h.rotation.x = Math.PI / 2; h.position.z = -0.32; W.pumpHandle.add(h);
    W.bucket = G.makeProp('bucket'); W.bucket.position.set(11.0, 0.3, 6.35); scene.add(W.bucket); }
  // garden
  { const GX0 = 13, GX1 = 22, GZ0 = -4, GZ1 = 4;
    const post = (x, z) => box(M.beam, x - 0.06, 0, z - 0.06, x + 0.06, 1.1, z + 0.06, { col: true });
    const rail = (x0, z0, x1, z1) => { for (const y of [0.45, 0.95]) box(M.beam, Math.min(x0, x1) - 0.03, y, Math.min(z0, z1) - 0.03, Math.max(x0, x1) + 0.03, y + 0.06, Math.max(z0, z1) + 0.03); col(Math.min(x0, x1) - 0.05, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, Math.max(z0, z1) + 0.05, 0, 1.1); };
    for (let x = GX0; x <= GX1 + 0.01; x += 1.5) { post(x, GZ0); post(x, GZ1); }
    for (let z = GZ0; z <= GZ1 + 0.01; z += 1.6) { post(GX1, z); if (z < -0.7 || z > 0.7) post(GX0, z); }
    post(GX0, -0.7); post(GX0, 0.7);
    rail(GX0, GZ0, GX1, GZ0); rail(GX0, GZ1, GX1, GZ1); rail(GX1, GZ0, GX1, GZ1); rail(GX0, GZ0, GX0, -0.7); rail(GX0, 0.7, GX0, GZ1);
    const rows = { water: -2.6, weed: -1.2, potato: 1.3, tomato: 2.7 };
    for (const k in rows) box(M.soil, 13.8, -0.05, rows[k] - 0.45, 21.2, 0.07, rows[k] + 0.45, { cast: false });
    const xs = [14.8, 16.4, 18.0, 19.6];
    const leafDry = G.mat('#8a7a3a'), leafM = G.mat('#4f8a2e'), carrotM = G.mat('#e07a1a'), potLeaf = G.mat('#3a6a28'), potM = G.mat('#b08a5a'), tomM = G.mat('#c8201a', 50), stakeM = G.mat('#8a6a42'), weedM = G.mat('#2e4a1a'), wetM = G.mat('#22160c'), deadM = G.mat('#5a4a2a');
    xs.forEach((x) => {
      const z = rows.water, g = new THREE.Group(); g.position.set(x, 0.07, z); scene.add(g); const leaves = [];
      for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.36, 4), leafDry); l.position.set((k - 2.5) * 0.03, 0.17, (k % 2) * 0.03); l.rotation.z = (k - 2.5) * 0.45; leaves.push(l); g.add(l); }
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.05, 6), carrotM); top.position.y = 0.01; g.add(top);
      leaves.length = 0; const lm = mergeKids(g, leafDry); lm.material = leafDry; leaves.push(lm);
      const wet = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), wetM.clone()); wet.rotation.x = -Math.PI / 2; wet.position.set(x, 0.075, z); wet.visible = false; scene.add(wet);
      W.chores.water.push({ x, y: 0.2, z, group: g, leaves, wet, done: false, leafM });
      const pg = new THREE.Group(); pg.position.set(x, 0.07, rows.potato); scene.add(pg);
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 1), potLeaf); bush.scale.set(1, 0.6, 1); bush.position.y = 0.15; bush.castShadow = true; pg.add(bush);
      const tubers = []; for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 5), potM); p.position.set((k - 1) * 0.1, 0, 0.05); p.visible = false; pg.add(p); tubers.push(p); }
      W.chores.potato.push({ x, y: 0.2, z: rows.potato, group: pg, bush, tubers, done: false });
      const tg = new THREE.Group(); tg.position.set(x, 0.07, rows.tomato); scene.add(tg);
      const stake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.04), stakeM); stake.position.y = 0.6; tg.add(stake);
      const tb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 1), potLeaf); tb.scale.set(0.9, 1.6, 0.9); tb.position.y = 0.48; tb.castShadow = true; tg.add(tb);
      const toms = []; for (let k = 0; k < 5; k++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.055, 9, 7), tomM); t.position.set(Math.cos(k * 1.7) * 0.21, 0.3 + k * 0.12, Math.sin(k * 1.7) * 0.21); tg.add(t); } toms.push(mergeKids(tg, tomM));
      W.chores.tomato.push({ x, y: 0.55, z: rows.tomato, group: tg, toms, done: false });
    });
    for (const [x, z] of [[15.5, -1.0], [17.2, -1.4], [19.0, -1.0], [20.4, -1.3], [14.3, -1.5]]) {
      const g = new THREE.Group(); g.position.set(x, 0.05, z); scene.add(g);
      for (let k = 0; k < 8; k++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.26 + (k % 3) * 0.07, 3), weedM); s.position.set(Math.cos(k) * 0.06, 0.12, Math.sin(k) * 0.06); s.rotation.set(Math.sin(k * 3) * 0.5, 0, Math.cos(k * 2) * 0.5); g.add(s); }
      mergeKids(g, weedM);
      W.chores.weed.push({ x, y: 0.1, z, group: g, done: false });
    }
    for (let i = 0; i < 10; i++) { const x = 14 + i * 0.75, z = -1.2 + (i % 2 ? 0.2 : -0.2); if (W.chores.weed.some(w => Math.abs(w.x - x) < 0.4)) continue; const g = new THREE.ConeGeometry(0.12, 0.25, 5); addStatic(g, deadM, x, 0.17, z, 0.2, i, 0.3); }
    // scarecrow in an old coat
    box(M.beam, 21.0, 0, 3.4, 21.08, 1.9, 3.48); box(M.beam, 20.6, 1.45, 3.4, 21.5, 1.52, 3.48);
    { const c = new THREE.CylinderGeometry(0.22, 0.3, 0.8, 8); addStatic(c, G.mat('#4a3a2a', 3), 21.04, 1.25, 3.44); const hd = new THREE.SphereGeometry(0.18, 8, 6); addStatic(hd, G.mat('#c8b080', 3), 21.04, 1.85, 3.44); const hat = new THREE.ConeGeometry(0.3, 0.25, 8); addStatic(hat, G.mat('#3a2a1a', 3), 21.04, 2.08, 3.44); }
    // basket by the gate
    W.basket = G.makeProp('basket'); W.basket.position.set(13.6, 0.32, 1.1); scene.add(W.basket);
  }
  // shed
  { const x0 = 12.5, x1 = 16.5, z0 = -11.5, z1 = -8.5;
    wallZ(z1, x0, x1, [[14.0, 15.1, 0, 2.0]], phong(T.boards, 1.6, '#8a7050'), 0.12, 0, 2.3); wallZ(z0, x0, x1, [], phong(T.boards, 1.6, '#8a7050'), 0.12, 0, 2.6);
    wallX(x0, z0, z1, [], phong(T.boards, 1.6, '#8a7050'), 0.12, 0, 2.5); wallX(x1, z0, z1, [], phong(T.boards, 1.6, '#8a7050'), 0.12, 0, 2.5);
    { const g = new THREE.BoxGeometry(4.6, 0.12, 3.8); boxUV(g, 4.6, 0.12, 3.8, 2.2); addStatic(g, M.roof, 14.5, 2.5, -10, -0.1, 0, 0); }
    box(M.dirt, x0, 0, z0, x1, 0.02, z1, { cast: false });
    box(M.dark, 12.6, 0, -11.4, 14.0, 0.85, -10.9, { col: true }); box(M.wood, 12.6, 0.85, -11.42, 14.0, 0.9, -10.88);
    for (let i = 0; i < 4; i++) { cyl(M.dark, 15.0 + i * 0.35, 1.1, -11.38, 0.018, 0.018, 1.6, 5, { rz: 0.08 }); box(M.metal, 14.92 + i * 0.35, 0.25, -11.42, 15.08 + i * 0.35, 0.5, -11.36); }
    W.canSpot = { x: 13.3, y: 0.98, z: -11.1 }; W.can = G.makeProp('can'); W.can.position.set(13.3, 0.98, -11.1); W.can.rotation.y = 0.4; scene.add(W.can);
    for (let i = 0; i < 3; i++) box(G.mat('#d8c8a0', 3), 16.0, 0, -11.3 + i * 0.5, 16.4, 0.25, -10.9 + i * 0.5); }
  // solar panel
  { box(M.dark, 8.4, 0, -11.2, 8.5, 1.4, -11.1); box(M.dark, 10.4, 0, -11.2, 10.5, 1.4, -11.1); box(G.mat('#1a2440', 90), 8.2, 1.2, -11.9, 10.7, 1.26, -10.5, { rx: 0.5 }); box(G.mat('#5a5a5a', 30), 9.2, 0, -10.6, 9.8, 0.5, -10.2, { col: true }); }
  // chicken coop (empty) + grave
  { const cm = phong(T.boards, 1.4, '#9a7a58');
    box(cm, -17.5, 0.5, -6.5, -14.5, 2.2, -3.5, { col: true, cy0: 0 }); for (const [x, z] of [[-17.4, -6.4], [-14.6, -6.4], [-17.4, -3.6], [-14.6, -3.6]]) box(M.beam, x - 0.06, 0, z - 0.06, x + 0.06, 0.5, z + 0.06);
    { const g = new THREE.BoxGeometry(3.4, 0.1, 3.6); boxUV(g, 3.4, 0.1, 3.6, 2.2); addStatic(g, M.roof, -16, 2.35, -5, 0.2, 0, 0); }
    box(G.mat('#1a1410'), -15.6, 0.6, -3.49, -14.9, 1.3, -3.47);
    box(M.dark, -15.4, 0, -3.4, -15.1, 0.55, -2.4, { rx: -0.5 });
    const wire = new THREE.MeshBasicMaterial({ color: 0x8a8a8a, wireframe: true, transparent: true, opacity: 0.4 });
    for (const [x0, z0, x1, z1] of [[-17.5, -3.5, -17.5, 0.5], [-17.5, 0.5, -12.5, 0.5], [-12.5, 0.5, -12.5, -3.5]]) { const len = Math.hypot(x1 - x0, z1 - z0); const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.2, Math.ceil(len * 6), 7), wire); m.position.set((x0 + x1) / 2, 0.6, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0); scene.add(m); col(Math.min(x0, x1) - 0.05, Math.min(z0, z1) - 0.05, Math.max(x0, x1) + 0.05, Math.max(z0, z1) + 0.05, 0, 1.2);
      for (let t = 0; t <= len + 0.01; t += 2) box(M.beam, x0 + (x1 - x0) * t / len - 0.04, 0, z0 + (z1 - z0) * t / len - 0.04, x0 + (x1 - x0) * t / len + 0.04, 1.25, z0 + (z1 - z0) * t / len + 0.04); }
    for (let i = 0; i < 12; i++) { const f = new THREE.PlaneGeometry(0.05, 0.12); addStatic(f, G.mat('#e8e0d0', 3, { side: THREE.DoubleSide }), -16.5 + Math.random() * 3.5, 0.01, -3.2 + Math.random() * 3.4, -Math.PI / 2, 0, Math.random() * 6, false); }
    box(M.soil, -13.1, -0.05, -8.2, -12.3, 0.15, -7.4, { cast: false }); box(M.beam, -12.75, 0, -8.15, -12.65, 0.6, -8.05); box(M.beam, -12.9, 0.38, -8.15, -12.5, 0.44, -8.05);
    W.grave = { x: -12.7, z: -7.8 }; }
  // woodpile + chopping block
  { cyl(G.mat('#6a4a2e'), -13.5, 0.28, 4.0, 0.34, 0.38, 0.56, 12); col(-13.85, 3.65, -13.15, 4.35, 0, 0.6);
    const lg = new THREE.CylinderGeometry(0.13, 0.13, 1.2, 7);
    for (let r = 0; r < 5; r++) for (let i = 0; i < 9 - r; i++) addStatic(lg.clone(), G.mat(i % 2 ? '#7a5634' : '#6a4a2a'), -16.2, 0.13 + r * 0.24, 0.6 + i * 0.27 + r * 0.13, Math.PI / 2, 0, 0);
    col(-16.9, 0.4, -15.5, 3.2, 0, 1.3); { const g = new THREE.BoxGeometry(1.8, 0.08, 3.2); addStatic(g, M.roof, -16.2, 1.45, 1.9, 0, 0, 0.12); }
    W.blockAxe = G.makeProp('axe'); W.blockAxe.position.set(-13.55, 0.58, 4.0); W.blockAxe.rotation.set(-2.2, 0.5, 0); scene.add(W.blockAxe);
    W.chopLogs = []; for (let i = 0; i < 4; i++) { const m = G.makeProp('log'); m.rotation.y = i; m.position.set(-14.4 + (i % 2) * 0.3, 0.11, 4.7 + i * 0.25); m.children[0].rotation.z = 0; m.children[0].rotation.x = Math.PI / 2; scene.add(m); W.chopLogs.push(m); }
    W.splitPile = new THREE.Group(); W.splitPile.position.set(-12.6, 0, 4.4); scene.add(W.splitPile); }
  // clothesline
  { for (const x of [-9, -3]) box(M.beam, x - 0.06, 0, 12.94, x + 0.06, 2.0, 13.06, { col: true }); cyl(M.white, -6, 1.92, 13, 0.006, 0.006, 6, 4, { rz: Math.PI / 2, cast: false });
    W.sheets = []; [['#e8e4d8', -8], ['#a8b8d0', -6.9], ['#d8b0b8', -5.6], ['#c98f2a', -4.4]].forEach(([c, x]) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.05, 4, 4), new THREE.MeshPhongMaterial({ color: C(c), side: THREE.DoubleSide })); s.geometry.translate(0, -0.52, 0); s.position.set(x, 1.92, 13); s.castShadow = true; scene.add(s); W.sheets.push(s); }); }
  // old truck
  { const tx = -6.5, tz = 17.5; box(M.rust, tx - 1.0, 0.55, tz - 2.6, tx + 1.0, 1.15, tz + 2.4, { col: true, cy0: 0 }); box(M.rust, tx - 0.95, 1.15, tz - 0.6, tx + 0.95, 1.95, tz + 0.9);
    box(G.mat('#1a2028', 90), tx - 0.96, 1.3, tz - 0.4, tx + 0.96, 1.85, tz + 0.7); box(G.mat('#2a2a2a'), tx - 1.0, 0.45, tz + 2.35, tx + 1.0, 0.7, tz + 2.5);
    for (const [x, z, f] of [[-1.0, -1.7, 0], [1.0, -1.7, 0], [-1.0, 1.6, 1], [1.0, 1.6, 0]]) cyl(G.mat('#1a1a1a', 10), tx + x, f ? 0.3 : 0.4, tz + z, 0.42, 0.42, 0.3, 12, { rz: Math.PI / 2 });
    box(M.rust, tx - 0.3, 1.15, tz + 0.9, tx + 0.3, 1.2, tz + 1.4); }
  // mailbox + washed-out road
  { box(M.beam, 3.2, 0, 12.0, 3.3, 1.1, 12.1); box(G.mat('#4a5a6a', 40), 3.05, 1.1, 11.8, 3.45, 1.35, 12.3);
    const z = 70.5, y = terrainH(0, 69);
    for (const x of [-2.0, 1.6]) { box(G.mat('#c8a020', 10), x - 0.6, y + 0.8, z - 1.4, x + 0.6, y + 0.98, z - 1.32); box(M.dark, x - 0.5, y, z - 1.4, x - 0.45, y + 0.8, z - 1.32); box(M.dark, x + 0.45, y, z - 1.4, x + 0.5, y + 0.8, z - 1.32); }
    box(G.mat('#3a3a3c', 20), -2.5, y - 1.6, z + 0.4, 2.2, y - 1.35, z + 3.4, { rx: 0.6 }); col(-6, z - 0.2, 6, z + 0.2, y - 3, y + 3);
    const sign = document.createElement('canvas'); sign.width = 256; sign.height = 64; const sg = sign.getContext('2d'); sg.fillStyle = '#e8e0d0'; sg.fillRect(0, 0, 256, 64); sg.fillStyle = '#b02020'; sg.font = 'bold 34px sans-serif'; sg.textAlign = 'center'; sg.fillText('ROAD CLOSED', 128, 44);
    const st = new THREE.CanvasTexture(sign); st.encoding = THREE.sRGBEncoding; const sm2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshPhongMaterial({ map: st })); sm2.position.set(-2.0, y + 1.15, z - 1.45); sm2.rotation.y = Math.PI; scene.add(sm2); box(M.dark, -2.05, y + 0.98, z - 1.4, -1.95, y + 1.3, z - 1.35); }
  // power poles along the road (dead line)
  for (let i = 0; i < 6; i++) { const z = 14 + i * 11, y = terrainH(4, z); box(M.beam, 3.9, y, z - 0.1, 4.1, y + 6, z + 0.1); box(M.beam, 3.2, y + 5.5, z - 0.06, 4.8, y + 5.6, z + 0.06); }

  // contact shadows (one merged transparent mesh)
  { const g = []; for (const [x, y, z, w, d] of blobs) { const p = new THREE.PlaneGeometry(w, d); p.rotateX(-Math.PI / 2); p.translate(x, y, z); g.push(p); }
    if (g.length) { const m = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(g), shadowM); m.renderOrder = 2; scene.add(m); } }

  // ================= spots + navigation =================
  const S = W.spots, sp = (n, x, y, z, yaw, node) => (S[n] = { x, y, z, yaw, node });
  sp('stove', 0.75, 0, -5.55, Math.PI, 'stove'); sp('sink', -1.6, 0, -5.6, Math.PI, 'sink'); sp('prep', -0.6, 0, -3.95, Math.PI, 'kitchen');
  sp('baseDoor', -3.45, 0, -6.25, -Math.PI / 2, 'baseDoor'); sp('fire', 8.2, 0, 1.5, Math.PI / 2, 'fire'); sp('couch', 6.45, 0, 1.5, Math.PI / 2, 'couchFront'); sp('armchair', 8.3, 0, 4.6, -2.4, 'living');
  sp('chop', -13.5, 0, 4.72, Math.PI, 'chop'); sp('clothes', -6.5, 0, 12.4, 0, 'clothes'); sp('well', 11, 0, 6.6, Math.PI, 'wellN'); sp('coop', -13.4, 0, -2.2, Math.PI, 'coop');
  sp('gate', 12.3, 0, 0, Math.PI / 2, 'gate'); sp('garden', 17.5, 0, 0, Math.PI / 2, 'garden'); sp('porch', 0, 0, 8.3, 0, 'porch'); sp('porchBench', -4.8, 0, 7.42, 0, 'porchW'); sp('step', -0.3, -0.08, 9.85, 0, 'porchS');
  sp('ridgeTop', 29.6, terrainH(29.6, -29.4), -29.4, -2.4, 'ridgeTop'); sp('meadow', 25.5, 0, 19.5, 0, 'meadow'); sp('meadowRock', 26.4, 0, 21.2, -0.9, 'meadowRock');
  sp('momBed', -8.75, 0, 2.75, 0, 'mom'); sp('momDesk', -9.0, 0, 4.1, -Math.PI / 2, 'mom'); sp('study', -2.05, FL2, 5.55, 0, 'study'); sp('radio', -2.05, FL2, 5.9, 0, 'study');
  sp('curtain', -6.6, -3, -0.1, Math.PI, 'curtain'); sp('baseIn', -9.3, -3, -4.6, Math.PI, 'baseIn'); sp('grave', -12.7, 0, -6.9, Math.PI, 'coop');
  sp('easel', 1.85, FL2, -0.9, Math.PI, 'bedroom'); sp('rosePots', 7.2, FL2, 6.2, 0, 'bedC'); sp('bedroomMid', 6.5, FL2, 1.5, 0, 'bedC');
  for (const k in W.beds) { const b = W.beds[k]; const H = G.CHARS[k].h, pel = b.head - b.dir * (0.47 * H + 0.08); S['bed_' + k] = { x: b.x, y: b.y, z: pel, yaw: b.dir > 0 ? Math.PI : 0, node: k === 'linda' ? 'mom' : 'bedC', bedH: b.y - (k === 'linda' ? 0 : FL2) };
    const side = k === 'luke' || k === 'leon' ? -1 : (k === 'linda' ? 1 : 1); S['bedSit_' + k] = { x: b.x + side * 0.62, y: k === 'linda' ? 0 : FL2, z: b.head - b.dir * 1.05, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, node: k === 'linda' ? 'mom' : 'bedC' };
    S['bedEdge_' + k] = { x: b.x + side * 0.28, y: k === 'linda' ? 0 : FL2, z: b.head - b.dir * 1.05, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, node: k === 'linda' ? 'mom' : 'bedC' }; }
  for (const k in W.seats) { const s = W.seats[k]; s.node = s.node || ({ linda: 'dineW', leon: 'dineE', luke: 'dineN', lily: 'dineN', rose: 'dineS', spare: 'dineS', porch: 'porchW', step: 'porchS', study: 'study' })[k]; }
  const tY = (x, z) => terrainH(x, z);
  const N = W.nav = { nodes: {
    yard: [0, 0, 12.5], porchS: [0, 0, 10.4], porch: [0, 0, 8.3], porchW: [-4.6, 0, 8.4], porchE: [4.6, 0, 8.4], door: [0, 0, 6.0],
    yardE: [8, 0, 11], wellN: [11.2, 0, 7.3], gate: [12.2, 0, 0], gardenIn: [14.0, 0, 0], garden: [17.5, 0, 0], gardenE: [20.5, 0, 0],
    nE: [11.6, 0, -9.0], nW: [-11.6, 0, -9.0], shed: [14.5, 0, -7.6], shedIn: [14.5, 0, -10.0], yardW: [-9, 0, 10.5], clothes: [-6.5, 0, 11.8], chop: [-13.5, 0, 5.3], woodpile: [-14.6, 0, 2.2], coop: [-13.3, 0, -1.5],
    road1: [0.3, 0, 22], road2: [0.6, tY(0.6, 42), 42], road3: [0.2, tY(0.2, 66), 66],
    ridge1: [17, tY(17, -12.5), -12.5], ridge2: [22.5, tY(22.5, -20), -20], ridge3: [27, tY(27, -26), -26], ridgeTop: [29.6, tY(29.6, -29.4), -29.4],
    meadowPath: [16, 0, 13.5], meadow: [24.5, 0, 18.5], meadowRock: [27.0, 0, 21.4],
    entry: [0, 0, 5.0], living: [6.8, 0, 4.0], couchFront: [7.0, 0, 3.4], fire: [8.2, 0, 3.3], stairsBot: [9.45, 0, -4.9], stairsBot2: [9.45, 0, -6.2], stairsTop: [3.1, FL2, -6.2],
    dineS: [0, 0, 1.45], dineW: [-2.4, 0, -0.2], dineE: [2.4, 0, -0.2], dineN: [0, 0, -1.75], kitchen: [-0.5, 0, -3.4], stove: [0.75, 0, -5.4], sink: [-1.6, 0, -5.45], baseDoor: [-3.45, 0, -6.25],
    hallW: [-3.35, 0, 1.05], momDoor: [-4.6, 0, 1.05], mom: [-6.6, 0, 1.6], bathHall: [-3.35, 0, -2.55], bathDoor: [-4.6, 0, -2.55], bath: [-6.6, 0, -3.2],
    hallUp: [3.1, FL2, -4.6], hallUpW: [-2.05, FL2, -4.6], bedDoor: [1.45, FL2, -4.25], bedDoorIn: [1.45, FL2, -2.7], bedroom: [3.4, FL2, 1.5], bedC: [7.2, FL2, 1.5],
    studyDoor: [-2.05, FL2, -4.2], studyIn: [-2.05, FL2, -2.7], study: [-2.0, FL2, 3.2], atticDoor: [-3.35, FL2, -5.75], atticIn: [-4.7, FL2, -5.75], attic: [-7, FL2, -2],
    baseTop: [-4.45, 0, -6.25], baseBot: [-9.3, -3, -6.2], baseIn: [-9.3, -3, -4.7], baseC: [-6.4, -3, -3.2], curtain: [-6.6, -3, -0.1], cold: [-6.6, -3, 1.0]
  }, edges: [
    ['yard', 'porchS'], ['porchS', 'porch'], ['porch', 'porchW'], ['porch', 'porchE'], ['porch', 'door'], ['door', 'entry'], ['yard', 'yardE'], ['yardE', 'wellN'], ['wellN', 'gate'], ['gate', 'gardenIn'], ['gardenIn', 'garden'], ['garden', 'gardenE'],
    ['porchE', 'yardE'], ['porchW', 'yardW'], ['yard', 'yardW'], ['yardW', 'clothes'], ['yard', 'clothes'], ['yardW', 'chop'], ['chop', 'woodpile'], ['woodpile', 'coop'], ['coop', 'nW'], ['nW', 'nE'], ['nE', 'shed'], ['shed', 'shedIn'], ['nE', 'gate'],
    ['yard', 'road1'], ['road1', 'road2'], ['road2', 'road3'], ['nE', 'ridge1'], ['shed', 'ridge1'], ['ridge1', 'ridge2'], ['ridge2', 'ridge3'], ['ridge3', 'ridgeTop'], ['yardE', 'meadowPath'], ['meadowPath', 'meadow'], ['meadow', 'meadowRock'],
    ['entry', 'living'], ['living', 'couchFront'], ['couchFront', 'fire'], ['living', 'fire'], ['entry', 'dineS'], ['dineS', 'dineW'], ['dineS', 'dineE'], ['dineW', 'dineN'], ['dineE', 'dineN'], ['dineN', 'kitchen'], ['kitchen', 'stove'], ['kitchen', 'sink'], ['kitchen', 'baseDoor'],
    ['dineW', 'hallW'], ['entry', 'hallW'], ['hallW', 'momDoor'], ['momDoor', 'mom'], ['dineW', 'bathHall'], ['bathHall', 'kitchen'], ['bathHall', 'bathDoor'], ['bathDoor', 'bath'], ['living', 'dineE'], ['dineE', 'stairsBot'], ['living', 'stairsBot'],
    ['stairsBot', 'stairsBot2'], ['stairsBot2', 'stairsTop'], ['stairsTop', 'hallUp'], ['hallUp', 'bedDoor'], ['bedDoor', 'bedDoorIn'], ['bedDoorIn', 'bedroom'], ['bedroom', 'bedC'], ['bedDoorIn', 'bedC'], ['hallUp', 'hallUpW'], ['hallUpW', 'studyDoor'], ['studyDoor', 'studyIn'], ['studyIn', 'study'], ['hallUpW', 'atticDoor'], ['atticDoor', 'atticIn'], ['atticIn', 'attic'],
    ['baseDoor', 'baseTop'], ['baseTop', 'baseBot'], ['baseBot', 'baseIn'], ['baseIn', 'baseC'], ['baseC', 'curtain'], ['curtain', 'cold']
  ] };
  N.adj = {}; for (const [a, b] of N.edges) { (N.adj[a] = N.adj[a] || []).push(b); (N.adj[b] = N.adj[b] || []).push(a); }
  W.path = (from, to) => {
    const nodes = N.nodes, dist = { [from]: 0 }, prev = {}, open = new Set([from]);
    while (open.size) { let u = null, bd = Infinity; for (const n of open) if (dist[n] < bd) { bd = dist[n]; u = n; } open.delete(u); if (u === to) break;
      for (const v of N.adj[u] || []) { const a = nodes[u], b = nodes[v], d = bd + Math.hypot(a[0] - b[0], (a[1] - b[1]) * 2, a[2] - b[2]); if (d < (dist[v] ?? Infinity)) { dist[v] = d; prev[v] = u; open.add(v); } } }
    const out = []; let c = to; while (c && c !== from) { out.unshift(c); c = prev[c]; } if (c !== from) return null; return out;
  };
  W.nearestNode = (x, y, z) => { let best = null, bd = Infinity; for (const k in N.nodes) { const n = N.nodes[k]; if (Math.abs(n[1] - y) > 1.4) continue; const d = Math.hypot(n[0] - x, n[2] - z); if (d < bd) { bd = d; best = k; } } return best; };

  // ================= lights =================
  W.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x5a4a32, 0.6); scene.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xffeedd, 1); W.sun.castShadow = true;
  const sms = Q.shadow || 2048; W.sun.shadow.mapSize.set(sms, sms); W.sun.shadow.bias = -0.0004; W.sun.shadow.normalBias = 0.03;
  const sc = W.sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 140; scene.add(W.sun, W.sun.target);
  W.bLight = new THREE.SpotLight(0xffe2b0, 0, 11, 1.25, 0.6, 1.3); W.bLight.castShadow = !!Q.baseShadow; W.bLight.shadow.mapSize.set(512, 512); W.bLight.shadow.camera.near = 0.1; W.bLight.shadow.camera.far = 11; W.bLight.shadow.bias = -0.002; scene.add(W.bLight, W.bLight.target);
  const LS = W.lightsSrc, L = (name, x, y, z, c, int, range, zone, o = {}) => (LS[name] = Object.assign({ name, p: new V3(x, y, z), c: new THREE.Color(c), int, range, zone, on: false, k: 1 }, o));
  L('fire', 9.15, 0.6, 1.5, 0xff8a3a, 1.6, 10, 'g', { flick: 2 }); L('kitchen', -0.5, 2.15, -5.2, 0xffd9a0, 1.1, 9, 'g', { mesh: W.lampK }); L('dining', 0, 2.1, -0.2, 0xffcf90, 1.0, 8, 'g', { mesh: W.lampD });
  L('candle', 0, 1.05, -0.2, 0xffb060, 0.6, 3.5, 'g', { flick: 1, mesh: W.flame }); L('living', 8.95, 1.5, 5.85, 0xffd0a0, 0.9, 7, 'g'); L('mom', -9.6, 0.9, 4.1, 0xffc890, 0.8, 6, 'g'); L('bath', -7, 2.5, -3.2, 0xfff0d0, 0.7, 5, 'g');
  L('hall', -3.45, FL2 + 1.0, -6.55, 0xffd9a0, 0.7, 7, 'u'); L('bedroom', 5, CE2 - 0.4, 1.7, 0xffd9b0, 1.0, 10, 'u', { mesh: W.lampB }); L('fairy', 5.8, FL2 + 1.8, -3.0, 0xff9ad0, 0.45, 3.8, 'u'); L('study', -2.0, FL2 + 1.45, 6.2, 0xffd090, 0.8, 5.5, 'u');
  L('phone', 0, 0, 0, 0x9ab8ff, 0.35, 2.2, 'x'); L('porch', 1.4, 2.25, 9.15, 0xffc070, 0.9, 8, 'o', { mesh: W.lantern }); L('cold', -6.4, -0.85, 2.1, 0xffe2b0, 1.2, 8, 'b', { flick: 3, mesh: W.bulb2Mesh });
  L('base', -5.2, -0.9, -2.0, 0xffe2b0, 0.5, 7, 'b', { mesh: W.bulbMesh });
  const PN = Q.pool || 4; W.pool = [];
  for (let i = 0; i < PN; i++) { const pl = new THREE.PointLight(0xffffff, 0, 8, 1.6); pl.userData = { src: null, k: 0 }; scene.add(pl); W.pool.push(pl); }
  W.setLight = (n, on) => { if (LS[n]) LS[n].on = on; };
  const zoneOf = (y, x, z) => (y < -1.2 ? 'b' : (x > -10.2 && x < 10.2 && z > -7.2 && z < 7.2) ? (y > 1.6 ? 'u' : 'g') : 'o');
  let lt = 0;
  W.updateLights = (cam, dt) => {
    lt += dt;
    const cz = zoneOf(cam.y, cam.x, cam.z), scored = [];
    for (const n in LS) { const s = LS[n]; if (!s.on) { if (s.mesh) s.mesh.material.color.setRGB(0.15, 0.13, 0.1); continue; } if (s.mesh) s.mesh.material.color.copy(s.c).multiplyScalar(1.4);
      const d = cam.distanceTo(s.p), zf = s.zone === cz || s.zone === 'x' ? 1 : (cz === 'o' && s.zone === 'g') || (cz === 'g' && (s.zone === 'o' || s.zone === 'u')) || (cz === 'u' && s.zone === 'g') ? 0.25 : 0.02;
      scored.push([s.int * zf / (1 + (d * d) / (s.range * s.range)), s]); }
    scored.sort((a, b) => b[0] - a[0]);
    const want = scored.slice(0, PN).map(x => x[1]);
    for (const pl of W.pool) { const u = pl.userData; if (u.src && !want.includes(u.src)) u.drop = true; }
    for (const s of want) { if (W.pool.some(pl => pl.userData.src === s)) continue; const free = W.pool.find(pl => !pl.userData.src || (pl.userData.drop && pl.userData.k < 0.02)); if (free) { free.userData.src = s; free.userData.drop = false; free.userData.k = 0; } }
    for (const pl of W.pool) { const u = pl.userData; if (!u.src) { pl.intensity = 0; continue; }
      u.k += ((u.drop ? 0 : 1) - u.k) * Math.min(1, dt * 6); if (u.drop && u.k < 0.02) { u.src = null; u.drop = false; pl.intensity = 0; continue; }
      const s = u.src; let f = 1; if (s.flick === 1) f = 0.9 + Math.sin(lt * 17) * 0.06; if (s.flick === 2) f = 0.85 + Math.sin(lt * 13) * 0.08 + Math.sin(lt * 7.3) * 0.07; if (s.flick === 3) f = Math.random() < 0.012 ? 0.15 : 1;
      pl.position.copy(s.p); pl.color.copy(s.c); pl.distance = s.range; pl.intensity = s.int * s.k * f * u.k; }
  };

  // ================= sky, stars, rain =================
  W.skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: new V3(0, 1, 0) }, sunCol: { value: new THREE.Color() } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
    uniforms: W.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: 'uniform vec3 top, bot, sunCol, sunDir; varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = clamp(d.y * 2.0 + 0.12, 0.0, 1.0); vec3 c = mix(bot, top, pow(h, 0.8)); float s = max(dot(d, normalize(sunDir)), 0.0); c += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.25); gl_FragColor = linearToOutputTexel(vec4(c, 1.0)); }'
  }));
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky); W.sky = sky;
  { const n = 1400, p = new Float32Array(n * 3), R = G.rngF(99); for (let i = 0; i < n; i++) { const u = R() * 2 - 1, a = R() * 6.283, r = Math.sqrt(1 - u * u); const y = Math.abs(u); p[i * 3] = Math.cos(a) * r * 420; p[i * 3 + 1] = y * 420; p[i * 3 + 2] = Math.sin(a) * r * 420; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    W.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false, depthWrite: false })); W.stars.frustumCulled = false; scene.add(W.stars);
    W.moon = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xe8ecf8, fog: false })); W.moon.position.set(-180, 260, -250); W.moon.lookAt(0, 0, 0); scene.add(W.moon); }
  { const n = Q.rain || 2600, p = new Float32Array(n * 6), R = G.rngF(4); for (let i = 0; i < n; i++) { const x = R() * 40 - 20, y = R() * 22, z = R() * 40 - 20; p.set([x, y, z, x, y, z], i * 6); }
    const e = new Float32Array(n * 2); for (let i = 0; i < n; i++) { e[i * 2] = 0; e[i * 2 + 1] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('end', new THREE.BufferAttribute(e, 1));
    W.rainU = { uT: { value: 0 }, uCam: { value: new V3() }, uAmt: { value: 0 } };
    W.rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms: W.rainU, transparent: true, depthWrite: false,
      vertexShader: `uniform float uT; uniform vec3 uCam; uniform float uAmt; attribute float end; varying float vA;
        void main(){ vec3 p = position; p.y = mod(p.y - uT * 14.0, 22.0) + uCam.y - 8.0 - end * 0.45; p.x = mod(p.x - uCam.x + 20.0, 40.0) - 20.0 + uCam.x + end * 0.05; p.z = mod(p.z - uCam.z + 20.0, 40.0) - 20.0 + uCam.z;
          vA = uAmt * (0.25 + 0.2 * end); if (p.x > -10.4 && p.x < 10.4 && p.z > -7.4 && p.z < 9.8 && p.y < 9.0) vA = 0.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: 'varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(0.75, 0.8, 0.9, vA); }' }));
    W.rain.frustumCulled = false; W.rain.visible = false; scene.add(W.rain); }

  // ================= presets =================
  const P = W.PRE = {
    morning: { top: 0x6d9fd6, bot: 0xf0dcc0, fog: 0xd8d6cc, fn: 40, ff: 260, sun: 0xffe0b8, si: 1.4, sp: [40, 26, 30], hs: 0xcfe0ff, hg: 0x6b5a3a, hi: 0.7, wind: 0.06, birds: 1, glow: 0, lights: ['fire'] },
    day: { top: 0x5d93cf, bot: 0xe9dcc0, fog: 0xd6d4c6, fn: 45, ff: 280, sun: 0xfff0d8, si: 1.6, sp: [30, 48, 22], hs: 0xcfe0ff, hg: 0x6b5a3a, hi: 0.75, wind: 0.07, birds: 1, glow: 0, lights: [] },
    afternoon: { top: 0x5a88c0, bot: 0xf0d0a0, fog: 0xd8c8b0, fn: 40, ff: 250, sun: 0xffd8a0, si: 1.45, sp: [-30, 30, 25], hs: 0xd0d8f0, hg: 0x6b5a3a, hi: 0.68, wind: 0.08, birds: 0.8, glow: 0, lights: [] },
    rain: { top: 0x6a7480, bot: 0x9aa2a8, fog: 0x8a9298, fn: 8, ff: 110, sun: 0xc8d0d8, si: 0.35, sp: [10, 40, 10], hs: 0xb8c0c8, hg: 0x4a4a44, hi: 0.85, wind: 0.16, birds: 0, glow: 0.25, rain: 1, lights: ['fire', 'kitchen'] },
    overcast: { top: 0x858f98, bot: 0xb6bbbf, fog: 0xa6acb0, fn: 14, ff: 150, sun: 0xdfe4ea, si: 0.45, sp: [12, 40, 10], hs: 0xc8ccd2, hg: 0x5a5448, hi: 0.85, wind: 0.12, birds: 0.3, glow: 0.15, lights: ['fire'] },
    evening: { top: 0x26305a, bot: 0xe08850, fog: 0x8a6a62, fn: 22, ff: 190, sun: 0xff9a5a, si: 0.85, sp: [-40, 9, 22], hs: 0x8a90c0, hg: 0x4a3426, hi: 0.42, wind: 0.08, birds: 0.2, glow: 0.55, lights: ['fire', 'kitchen', 'dining', 'porch', 'living'] },
    redEve: { top: 0x2a1c38, bot: 0xc9573a, fog: 0x7a4840, fn: 16, ff: 160, sun: 0xff6a3a, si: 0.9, sp: [-40, 8, 6], hs: 0x9a6a8a, hg: 0x3a2420, hi: 0.4, wind: 0.1, birds: 0, glow: 0.5, lights: ['fire', 'kitchen', 'dining', 'porch'] },
    redDawn: { top: 0x3a3050, bot: 0xd8784a, fog: 0x9a7060, fn: 20, ff: 180, sun: 0xff8a5a, si: 1.0, sp: [40, 10, 20], hs: 0xb08aa0, hg: 0x3a2a20, hi: 0.5, wind: 0.05, birds: 0.2, glow: 0.2, lights: ['fire'] },
    night: { top: 0x04050b, bot: 0x0f1220, fog: 0x0a0c14, fn: 8, ff: 90, sun: 0x7080b0, si: 0.22, sp: [-20, 40, -25], hs: 0x30385a, hg: 0x101010, hi: 0.16, wind: 0.05, birds: 0, glow: 0.8, stars: 1, night: 1, lights: ['fire', 'kitchen', 'dining', 'porch', 'living', 'bedroom', 'hall'] },
    lateNight: { top: 0x020308, bot: 0x080a14, fog: 0x06070c, fn: 6, ff: 70, sun: 0x6070a0, si: 0.18, sp: [-20, 40, -25], hs: 0x20283a, hg: 0x080808, hi: 0.1, wind: 0.04, birds: 0, glow: 0.2, stars: 1, night: 1, lights: ['fire'] }
  };
  W.pre = P.day; W.preName = 'day';
  W.setTime = function (name, o = {}) {
    const p = P[name]; W.pre = p; W.preName = name;
    W.skyU.top.value.set(p.top).convertSRGBToLinear(); W.skyU.bot.value.set(p.bot).convertSRGBToLinear();
    scene.fog.color.set(p.fog).convertSRGBToLinear(); scene.fog.near = p.fn; scene.fog.far = p.ff;
    W.sun.color.set(p.sun); W.sunOff = new V3(p.sp[0], p.sp[1], p.sp[2]);
    W.skyU.sunDir.value.copy(W.sunOff).normalize(); W.skyU.sunCol.value.set(p.night ? 0x000000 : p.sun).convertSRGBToLinear().multiplyScalar(p.si * 0.5);
    W.hemi.color.set(p.hs); W.hemi.groundColor.set(p.hg);
    for (const n in LS) LS[n].on = false; (o.lights || p.lights).forEach(n => { if (LS[n]) LS[n].on = true; });
    W.windowGlow.forEach(g => { g.material.opacity = p.glow * 0.5; g.visible = p.glow > 0; });
    W.lantern.material.color.set(LS.porch.on ? 0xffc070 : 0x5a4a30);
    W.stars.visible = W.moon.visible = !!p.stars; W.rain.visible = !!p.rain; W.rainU.uAmt.value = p.rain || 0;
    W.flame.visible = LS.candle.on;
    W.fairy.forEach(b => b.material.color.set(LS.fairy.on ? 0xffb0e0 : 0x3a3030));
    W.fire.forEach(f => (f.visible = LS.fire.on));
  };
  W.followSun = (x, z) => { const sx = Math.round(x / 4) * 4, sz = Math.round(z / 4) * 4; W.sun.target.position.set(sx, 0, sz); W.sun.position.set(sx + W.sunOff.x, W.sunOff.y, sz + W.sunOff.z); W.sun.target.updateMatrixWorld(); };

  // ================= queries =================
  const STU = { x0: 3.6, x1: 9.0, z0: -6.88, z1: -5.6 }, STB = { x0: -8.8, x1: -4.15, z0: -6.88, z1: -5.575 };
  W.heightAt = (x, z, y) => {
    if (z > STU.z0 && z < STU.z1 && x > STU.x0 - 0.05 && x < STU.x1 + 0.9) { const r = Math.max(0, Math.min(1, (STU.x1 - x) / (STU.x1 - STU.x0))) * FL2; if (Math.abs(y - r) < 1.0) return r; }
    if (z > STB.z0 && z < STB.z1 && x > -9.9 && x < STB.x1 + 0.3) { const r = -3 * Math.max(0, Math.min(1, (STB.x1 - x) / (STB.x1 - STB.x0))); if (Math.abs(y - r) < 1.0) return r; }
    const inside = x > X0 && x < X1 && z > Z0 && z < Z1;
    if (inside || y < -1.5) { if (y > 1.6) return FL2; if (y < -1.5) return -3; return 0; }
    if (z > Z1 && z < 9.65 && Math.abs(x) < 7.1) return 0.02;
    return terrainH(x, z);
  };
  W.region = (x, y, z) => (y < -1.2 ? 'base' : (x > X0 && x < X1 && z > Z0 && z < Z1) ? (y > 1.6 ? 'up' : 'in') : 'out');
  W.surface = (x, y, z) => {
    const r = W.region(x, y, z); if (r === 'base') return 'stone'; if (r !== 'out') return 'wood';
    if (z > Z1 && z < 9.7 && Math.abs(x) < 7.1) return 'wood';
    if (Math.abs(x) < 2.3 && z > 9.6) return 'gravel';
    for (const p of W.paths) { const [ax, az] = p.a, [bx, bz] = p.b, dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); if (Math.hypot(x - ax - dx * t, z - az - dz * t) < p.w * 0.45) return 'dirt'; }
    if (x > 13 && x < 22 && z > -4 && z < 4) return 'dirt';
    return 'grass';
  };
  // collider spatial hash
  const CH = new Map(), cs = 4;
  W.buildHash = () => { CH.clear(); for (const c of W.colliders) { for (let i = Math.floor(c.x0 / cs); i <= Math.floor(c.x1 / cs); i++) for (let j = Math.floor(c.z0 / cs); j <= Math.floor(c.z1 / cs); j++) { const k = i * 1000 + j; if (!CH.has(k)) CH.set(k, []); CH.get(k).push(c); } } };
  W.near = (x, z) => CH.get(Math.floor(x / cs) * 1000 + Math.floor(z / cs)) || [];

  // ================= per-frame =================
  let t = 0;
  W.update = function (dt, region, actors) {
    t += dt; W.windU.value = t * (0.6 + W.pre.wind * 6);
    W.cullT = (W.cullT || 0) - dt;
    if (W.cullT <= 0 && actors[0]) { W.cullT = 0.4; const a = actors[0], far = W.pre.ff + 10; for (const c of W.chunks) c.mesh.visible = Math.hypot(a.x - c.x, a.z - c.z) - c.r < Math.min(c.maxD, far) && region !== 'base'; }
    W.fire.forEach((m, i) => { m.scale.set(1, 0.8 + Math.sin(t * (9 + i * 2) + i) * 0.25, 1); });
    W.flame.scale.y = 1 + Math.sin(t * 15) * 0.15;
    if (region === 'base') {
      W.bulb.rotation.z = Math.sin(t * 0.9) * 0.1; W.bulb.rotation.x = Math.cos(t * 0.7) * 0.05; W.bulbMesh.getWorldPosition(W.bLight.position); W.bLight.target.position.set(W.bLight.position.x, -3, W.bLight.position.z); W.bLight.target.updateMatrixWorld();
      W.bulb2.rotation.z = Math.sin(t * 1.3) * 0.16; W.bulb2Mesh.getWorldPosition(LS.cold.p);
      W.bLight.intensity = LS.base.on ? (Math.random() < 0.01 ? 0.3 : 1.6) : 0;
    } else W.bLight.intensity = 0;
    if (W.flies.visible) { const p = W.flies.geometry.attributes.position; W.fliesPh.forEach((q, i) => { q[0] += dt * q[2] * 2.3; q[1] += dt * q[2] * 1.7; p.setXYZ(i, -6.3 + Math.sin(q[0]) * 0.8 + Math.sin(q[1] * 2.1) * 0.15, -1.75 + Math.sin(q[1]) * 0.3, 2.1 + Math.cos(q[0] * 1.3) * 0.4); }); p.needsUpdate = true; }
    W.sheets.forEach((s, i) => { s.rotation.x = Math.sin(t * 1.7 + i) * 0.1 * (W.pre.wind * 8) + 0.05; });
    if (W.rain.visible) W.rainU.uT.value = t;
    for (const n in W.doors) {
      const d = W.doors[n];
      if (d.auto && !d.locked) { let want = 0; for (const a of actors) if (Math.abs(a.y - d.y) < 1.2 && Math.hypot(a.x - d.cx, a.z - d.cz) < 1.5) { want = 1; break; } d.target = want; }
      const prev = d.cur; d.cur += (d.target - d.cur) * Math.min(1, dt * 5); d.pivot.rotation.y = d.base + d.cur * d.openAng;
      d.col.on = d.colLock ? true : d.cur < 0.35 || d.locked;
      if (prev < 0.05 && d.cur >= 0.05 && W.onDoor) W.onDoor(d, true); if (prev > 0.25 && d.cur <= 0.25 && d.target === 0 && W.onDoor) W.onDoor(d, false);
    }
  };

  // ---------- finalize merged statics ----------
  for (const { mat, cast, list } of groups.values()) {
    const geo = THREE.BufferGeometryUtils.mergeBufferGeometries(list);
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh);
  }
  W.buildHash();
  W.FL2 = FL2;
  return W;
};
