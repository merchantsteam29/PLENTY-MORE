// Low-poly characters with jointed limbs, face textures, poses, and props.
(function () {
  const geoCache = {}, matCache = {};
  G.boxGeo = (w, h, d) => {
    const k = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
    return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d));
  };
  G.matCache = (k, make) => matCache[k] || (matCache[k] = make());
  G.mat = (c, shin = 6) => {
    const k = c + ':' + shin;
    return matCache[k] || (matCache[k] = new THREE.MeshPhongMaterial({ color: new THREE.Color(c), shininess: shin }));
  };

  function bx(w, h, d, mat, parent, x, y, z) {
    const m = new THREE.Mesh(G.boxGeo(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  G.bx = bx;

  G.makeAxe = function () {
    const g = new THREE.Group();
    bx(0.04, 0.85, 0.04, G.mat('#7a5232'), g, 0, 0.42, 0);
    bx(0.03, 0.16, 0.2, G.mat('#5a5e62', 40), g, 0, 0.78, 0.08);
    bx(0.031, 0.14, 0.03, G.mat('#c8ccd0', 80), g, 0, 0.78, 0.19);
    return g;
  };

  G.makePerson = function (key, T, o = {}) {
    const ch = G.CHARS[key], s = ch.h / 1.75;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const skinM = G.mat(o.skin || ch.skin), shirt = G.mat(o.shirt || ch.shirt), pants = G.mat(ch.pants), shoe = G.mat('#2a1d14');
    // Hair glows slightly so each sibling's color stays readable under warm firelight.
    const hk = 'hair:' + ch.hair;
    const hairM = G.matCache(hk, () => new THREE.MeshPhongMaterial({ color: ch.hair, emissive: new THREE.Color(ch.hair).multiplyScalar(0.28), shininess: 14 }));
    const P = { key, ch, s, root, body, hips: [], knees: [], shoulders: [], hands: [], t: 0 };
    const legLen = 0.84 * s, thigh = legLen / 2;
    P.legLen = legLen;
    for (const side of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(side * 0.09 * s, legLen, 0); body.add(hip);
      bx(0.13 * s, thigh, 0.15 * s, pants, hip, 0, -thigh / 2, 0);
      const knee = new THREE.Group(); knee.position.set(0, -thigh, 0); hip.add(knee);
      bx(0.12 * s, thigh, 0.14 * s, pants, knee, 0, -thigh / 2, 0);
      bx(0.13 * s, 0.07 * s, 0.22 * s, shoe, knee, 0, -thigh + 0.035 * s, 0.035 * s);
      P.hips.push(hip); P.knees.push(knee);
    }
    const tH = 0.6 * s, tW = (ch.female ? 0.35 : 0.41) * s, tD = 0.21 * s;
    P.tW = tW; P.tH = tH; P.tD = tD;
    P.torso = bx(tW, tH, tD, shirt, body, 0, legLen + tH / 2, 0);
    if (ch.skirt) bx(tW + 0.05, 0.5 * s, tD + 0.08, G.mat(ch.skirt), body, 0, legLen - 0.17 * s, 0);
    for (const side of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(side * (tW / 2 + 0.055 * s), legLen + tH - 0.05 * s, 0); body.add(sh);
      bx(0.1 * s, 0.56 * s, 0.11 * s, shirt, sh, 0, -0.28 * s, 0);
      P.handMesh = bx(0.09 * s, 0.12 * s, 0.1 * s, skinM, sh, 0, -0.62 * s, 0);
      const hand = new THREE.Group(); hand.position.set(0, -0.64 * s, 0); sh.add(hand);
      P.shoulders.push(sh); P.hands.push(hand);
    }
    bx(0.1 * s, 0.08 * s, 0.1 * s, skinM, body, 0, legLen + tH + 0.04 * s, 0);
    const head = new THREE.Group(); head.position.set(0, legLen + tH + 0.07 * s, 0); body.add(head); P.head = head;
    const hw = 0.25 * s, hh = 0.28 * s, hd = 0.25 * s;
    P.faces = {}; P.faceMat = new THREE.MeshPhongMaterial({ map: T.face(ch, o.face || 'normal'), shininess: 5 });
    if (o.skin) P.faceMat.color.set(o.skin === ch.skin ? '#fff' : '#fff');
    const hm = new THREE.Mesh(G.boxGeo(hw, hh, hd), [skinM, skinM, hairM, skinM, P.faceMat, skinM]);
    hm.position.y = hh / 2; hm.castShadow = true; head.add(hm);
    const H = (w, h, d, x, y, z, rz = 0, rx = 0) => { const m = bx(w, h, d, hairM, head, x, y, z); m.rotation.z = rz; m.rotation.x = rx; return m; };
    H(hw + 0.03, 0.07 * s, hd + 0.03, 0, hh + 0.02 * s, 0);
    H(hw + 0.03, hh * 0.75, 0.04 * s, 0, hh * 0.62, -hd / 2 - 0.01);
    switch (ch.style) {
      case 'spiky':
        H(0.03, hh * 0.45, hd * 0.9, -hw / 2 - 0.012, hh * 0.72, -0.01); H(0.03, hh * 0.45, hd * 0.9, hw / 2 + 0.012, hh * 0.72, -0.01);
        for (let i = 0; i < 6; i++) H(0.06 * s, 0.08 * s, 0.06 * s, (i - 2.5) * 0.04 * s, hh + 0.06 * s, (i % 2 - 0.5) * 0.06 * s, (i - 2.5) * 0.25);
        H(hw, 0.05 * s, 0.03 * s, 0, hh - 0.03 * s, hd / 2 + 0.01);
        break;
      case 'messy':
        H(0.035, hh * 0.6, hd * 0.95, -hw / 2 - 0.015, hh * 0.65, -0.01); H(0.035, hh * 0.6, hd * 0.95, hw / 2 + 0.015, hh * 0.65, -0.01);
        H(hw * 0.6, 0.07 * s, 0.035 * s, -hw * 0.15, hh - 0.04 * s, hd / 2 + 0.012, 0.15); H(hw * 0.4, 0.05 * s, 0.03 * s, hw * 0.25, hh - 0.03 * s, hd / 2 + 0.01, -0.2);
        H(hw + 0.05, hh * 0.3, 0.05 * s, 0, hh * 0.2, -hd / 2 - 0.02);
        H(0.07 * s, 0.06 * s, 0.07 * s, 0.05 * s, hh + 0.07 * s, 0, 0.4); H(0.06 * s, 0.05 * s, 0.06 * s, -0.06 * s, hh + 0.06 * s, 0.03, -0.3);
        break;
      case 'long':
        H(0.035, hh * 1.3, hd * 0.9, -hw / 2 - 0.015, hh * 0.35, -0.02); H(0.035, hh * 1.3, hd * 0.9, hw / 2 + 0.015, hh * 0.35, -0.02);
        H(hw + 0.06, hh * 1.75, 0.05 * s, 0, hh * 0.15, -hd / 2 - 0.02);
        H(hw * 0.9, 0.06 * s, 0.03 * s, 0, hh - 0.04 * s, hd / 2 + 0.01);
        bx(0.05 * s, 0.03 * s, 0.03 * s, G.mat('#ffffff'), head, hw / 2, hh * 0.9, hd / 2 - 0.02);
        break;
      case 'bob':
        H(0.035, hh * 0.85, hd * 0.95, -hw / 2 - 0.015, hh * 0.5, -0.01); H(0.035, hh * 0.85, hd * 0.95, hw / 2 + 0.015, hh * 0.5, -0.01);
        H(hw + 0.05, hh * 0.9, 0.05 * s, 0, hh * 0.5, -hd / 2 - 0.02);
        H(hw * 0.75, 0.07 * s, 0.03 * s, -hw * 0.1, hh - 0.04 * s, hd / 2 + 0.012, 0.25);
        break;
      case 'bun':
        H(0.03, hh * 0.5, hd * 0.9, -hw / 2 - 0.012, hh * 0.7, -0.01); H(0.03, hh * 0.5, hd * 0.9, hw / 2 + 0.012, hh * 0.7, -0.01);
        H(0.13 * s, 0.13 * s, 0.12 * s, 0, hh * 0.95, -hd / 2 - 0.06);
        H(hw * 0.5, 0.04 * s, 0.02, -hw * 0.22, hh - 0.025 * s, hd / 2 + 0.01, 0.2); H(hw * 0.5, 0.04 * s, 0.02, hw * 0.22, hh - 0.025 * s, hd / 2 + 0.01, -0.2);
        break;
    }
    if (ch.apron) {
      const top = legLen + tH * 0.82, bot = legLen - 0.38 * s;
      P.apronMat = new THREE.MeshPhongMaterial({ map: T.apron, shininess: 4 });
      const ap = new THREE.Mesh(new THREE.PlaneGeometry(tW * 0.85, top - bot), P.apronMat);
      ap.position.set(0, (top + bot) / 2, tD / 2 + 0.045); body.add(ap);
    }
    P.setFace = (mode) => {
      if (!P.faces[mode]) P.faces[mode] = T.face(ch, mode);
      P.faceMat.map = P.faces[mode]; P.faceMat.needsUpdate = true;
    };
    P.faces[o.face || 'normal'] = P.faceMat.map;
    return P;
  };

  // pose(P, name, t, k) — t: animation clock, k: walk amount 0..1
  G.pose = function (P, name, t, k = 1) {
    const [hl, hr] = P.hips, [kl, kr] = P.knees, [sl, sr] = P.shoulders;
    hl.rotation.set(0, 0, 0); hr.rotation.set(0, 0, 0); kl.rotation.set(0, 0, 0); kr.rotation.set(0, 0, 0);
    sl.rotation.set(0, 0, 0.06); sr.rotation.set(0, 0, -0.06);
    P.body.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0);
    const breath = Math.sin(t * 2.1) * 0.006;
    switch (name) {
      case 'walk': {
        const ph = t * 7.5;
        hl.rotation.x = -Math.sin(ph) * 0.5 * k; hr.rotation.x = Math.sin(ph) * 0.5 * k;
        kl.rotation.x = Math.max(0, Math.sin(ph - 1.2)) * 0.8 * k; kr.rotation.x = Math.max(0, -Math.sin(ph - 1.2)) * 0.8 * k;
        sl.rotation.x = Math.sin(ph) * 0.4 * k; sr.rotation.x = -Math.sin(ph) * 0.4 * k;
        P.body.position.y = Math.abs(Math.cos(ph)) * 0.03 * k;
        if (P.carry) sr.rotation.x = -0.9;
        break;
      }
      case 'sit': case 'eat': {
        hl.rotation.x = hr.rotation.x = -Math.PI / 2; kl.rotation.x = kr.rotation.x = Math.PI / 2;
        P.body.position.y = 0.47 - P.legLen; P.body.position.z = -0.02;
        sl.rotation.x = sr.rotation.x = -0.75;
        if (name === 'eat') { sr.rotation.x = -1.35 + Math.sin(t * 2.4) * 0.45; P.head.rotation.x = Math.max(0, Math.sin(t * 2.4)) * 0.12; }
        P.body.position.y += breath;
        break;
      }
      case 'chop': {
        const u = (t % 1.7) / 1.7;
        let a;
        if (u < 0.6) { const e = u / 0.6; a = -0.4 - e * e * (3 - 2 * e) * 2.5; }
        else if (u < 0.7) a = -2.9 + (u - 0.6) / 0.1 * 2.3;
        else a = -0.6 + (u - 0.7) / 0.3 * 0.2;
        sl.rotation.x = sr.rotation.x = a; sl.rotation.z = 0.25; sr.rotation.z = -0.25;
        hl.rotation.z = 0.08; hr.rotation.z = -0.08;
        P.body.rotation.x = u > 0.6 && u < 0.85 ? 0.25 : 0.05;
        break;
      }
      case 'cook':
        sl.rotation.x = -0.7; sr.rotation.x = -0.8 + Math.sin(t * 3) * 0.15; sr.rotation.z = Math.sin(t * 3) * 0.15;
        P.body.position.y = breath; P.head.rotation.x = 0.35; break;
      case 'yell':
        sl.rotation.x = -2.2; sr.rotation.x = -2.2; sl.rotation.z = -0.5; sr.rotation.z = 0.5; P.head.rotation.x = -0.2; break;
      case 'axeUp':
        sl.rotation.x = sr.rotation.x = -2.9; sl.rotation.z = 0.2; sr.rotation.z = -0.2; P.body.rotation.x = -0.15; break;
      case 'axeDown':
        sl.rotation.x = sr.rotation.x = -0.5; sl.rotation.z = 0.2; sr.rotation.z = -0.2; P.body.rotation.x = 0.3; break;
      case 'carry':
        sr.rotation.x = -0.9; P.body.position.y = breath; break;
      case 'read':
        hl.rotation.x = hr.rotation.x = -Math.PI / 2; kl.rotation.x = kr.rotation.x = Math.PI / 2;
        P.body.position.y = 0.47 - P.legLen; sl.rotation.x = sr.rotation.x = -1.1; sl.rotation.z = -0.35; sr.rotation.z = 0.35;
        P.head.rotation.x = 0.4; break;
      case 'laundry':
        sl.rotation.x = -2.6 + Math.sin(t * 1.3) * 0.2; sr.rotation.x = -2.5 + Math.cos(t * 1.3) * 0.2; P.body.position.y = breath; break;
      default:
        P.body.position.y = breath;
    }
  };

  // ---- The basement ----
  G.makeBodies = function (scene, T) {
    const grp = new THREE.Group(); scene.add(grp);
    const red = G.mat('#6a0606', 60), darkRed = G.mat('#300303', 70), bone = G.mat('#e6dcc6', 30), meat = new THREE.MeshPhongMaterial({ map: T.meat, shininess: 50 });
    const holder = (x, y, z, ry) => { const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.y = ry; grp.add(h); return h; };
    const stump = (parent, x, y, z, rx) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.x = rx; parent.add(g);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.05, 8), meat); m.position.y = -0.02; g.add(m);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.09, 6), bone); b.position.y = -0.07; g.add(b);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.068, 0.012, 8), darkRed); d.position.y = -0.045; g.add(d);
    };

    // Luke — on the butcher table, rotting, partly butchered.
    const luke = G.makePerson('luke', T, { skin: '#8d9776', shirt: '#7f8a6c', face: 'rot' });
    G.pose(luke, 'stand', 0);
    const lh = holder(-1.55, -1.95 + luke.tD / 2 + 0.01, 0.3, Math.PI / 2);
    luke.root.rotation.x = -Math.PI / 2; lh.add(luke.root);
    luke.hips[1].visible = false; stump(luke.body, luke.hips[1].position.x, luke.legLen, 0, 0);
    luke.shoulders[0].visible = false; stump(luke.body, luke.shoulders[0].position.x, luke.shoulders[0].position.y, 0, 0);
    const cav = bx(luke.tW * 0.62, luke.tH * 0.62, 0.02, darkRed, luke.body, 0, luke.legLen + luke.tH * 0.5, luke.tD / 2 + 0.006);
    bx(luke.tW * 0.72, luke.tH * 0.7, 0.015, meat, luke.body, 0, luke.legLen + luke.tH * 0.5, luke.tD / 2 + 0.002);
    for (let i = 0; i < 4; i++) bx(luke.tW * 0.6, 0.018, 0.02, bone, luke.body, 0, luke.legLen + luke.tH * (0.35 + i * 0.1), luke.tD / 2 + 0.014);
    cav.castShadow = false;
    luke.shoulders[1].rotation.z = -0.35;
    luke.head.rotation.z = 0.5;

    // Lily — on the floor beside him, under a soaked sheet.
    const lily = G.makePerson('lily', T, { skin: '#d9c8bb', face: 'dead' });
    G.pose(lily, 'stand', 0);
    const yh = holder(-1.55, -2.8 + lily.tD / 2 + 0.005, 1.75, Math.PI / 2);
    lily.root.rotation.x = -Math.PI / 2; yh.add(lily.root);
    lily.head.rotation.z = -0.6;
    const sheetMat = new THREE.MeshPhongMaterial({ map: T.sheet, shininess: 12 });
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.07, 0.62), sheetMat);
    sheet.position.set(-2.25, -2.8 + 0.2, 1.75); sheet.rotation.set(0, 0.05, 0.02); sheet.castShadow = true; grp.add(sheet);
    const drape = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.18, 0.02), sheetMat);
    drape.position.set(-2.25, -2.8 + 0.1, 2.07); grp.add(drape);
    const drape2 = drape.clone(); drape2.position.z = 1.43; grp.add(drape2);

    // Rose — face down, reaching for the stairs, axe in her back.
    const rose = G.makePerson('rose', T, { skin: '#dccbbb', face: 'dead' });
    G.pose(rose, 'stand', 0);
    const dir = Math.atan2(0.6 - -1.2, -4.0 - -1.0);
    const rh = holder(-1.2, -2.8 + rose.tD / 2 + 0.005, -1.0, dir);
    rose.root.rotation.x = Math.PI / 2; rh.add(rose.root);
    rose.shoulders[1].rotation.x = Math.PI * 0.95; rose.shoulders[0].rotation.z = 0.25;
    rose.hips[0].rotation.z = 0.15; rose.hips[1].rotation.z = -0.1; rose.knees[1].rotation.x = 0.4;
    const axe = G.makeAxe();
    axe.position.set(0.04, rose.legLen + rose.tH * 0.72, -rose.tD / 2 + 0.12);
    axe.rotation.set(-Math.PI / 2 - 0.35, 0, 0.2); rose.body.add(axe);
    bx(0.14, 0.12, 0.012, darkRed, rose.body, 0.03, rose.legLen + rose.tH * 0.68, -rose.tD / 2 - 0.004);
    bx(0.2, 0.25, 0.008, red, rose.body, 0.02, rose.legLen + rose.tH * 0.55, -rose.tD / 2 - 0.002);

    return { group: grp, luke, lily, rose, roseAxe: axe };
  };
})();
