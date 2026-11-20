// Engine: renderer, player, NPCs + navigation, dialogue (voice / murmur / live pixel portraits), interactions, menus, saves.
(function () {
  const $ = id => document.getElementById(id);
  const A = G.Audio, IN = G.Input, V3 = THREE.Vector3;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const store = { get(k, d) { try { const v = localStorage.getItem('plentymore.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('plentymore.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } } };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const SET = Object.assign({ quality: isTouch ? 'low' : 'high', sens: 1, invert: false, text: 'normal', vol: 0.9, music: 0.7, fov: 72 }, store.get('settings', {}));
  const QL = {
    low: { tex: 0.5, face: 256, body: 256, aniso: 2, trees: 420, grass: 2200, flowers: 500, shadow: 1024, pool: 2, pr: 0.85, aa: false, rain: 1100, baseShadow: false, soft: false },
    medium: { tex: 0.75, face: 512, body: 512, aniso: 4, trees: 700, grass: 6000, flowers: 1100, shadow: 1536, pool: 3, pr: 1.0, aa: true, rain: 2000, baseShadow: true, soft: true },
    high: { tex: 1, face: 512, body: 512, aniso: 8, trees: 900, grass: 10000, flowers: 1600, shadow: 2048, pool: 4, pr: 1.5, aa: true, rain: 2600, baseShadow: true, soft: true }
  };
  const Q = QL[SET.quality] || QL.high;
  IN.sens = SET.sens; IN.invert = SET.invert;

  let renderer, scene, camera, T, W, leonP, vm, portrait;
  const P = { x: 8.6, y: 3, z: 6, yaw: 0, pitch: 0, vx: 0, vz: 0, eye: 1.42, locked: false, cine: false, seat: null, bed: null, bob: 0, stepD: 0, warned: 0, sway: 0 };
  let gtime = 0, started = false, paused = false, ended = false, menuOpen = true;
  const timers = [], watchers = [], tweens = [], inters = new Set(), npcs = {};
  let dlg = null, focus = null, hemiK = 1, mixT = 0, prPerf = 0, frameN = 0, holdP = 0, choice = null, reading = null, timing = null;

  // ================= setup =================
  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: Q.aa, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr)); P.pr = renderer.getPixelRatio();
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    document.body.prepend(renderer.domElement);
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcccccc, 30, 260);
    camera = new THREE.PerspectiveCamera(SET.fov, 1, 0.04, 800); camera.rotation.order = 'YXZ'; scene.add(camera);
    T = G.makeTextures(Q);
    W = G.buildWorld(scene, T, Q);
    W.setTime('morning');
    [W.hemi, W.sun, W.bLight, ...W.pool].forEach(l => l.layers.enable(1));
    W.bodies = G.makeBodies(scene, T); W.bodies.group.visible = false;
    for (const k of ['linda', 'luke', 'lily', 'rose']) npcs[k] = new NPC(k);
    npcs.linda.P.style = { arm: 0.26, lean: 0.07, head: 0.1, bob: 0.8 }; npcs.linda.P.idle = 'clasp';
    npcs.luke.P.style = { arm: 0.32, lean: 0.06, slouch: 1, bob: 1 }; npcs.luke.P.idle = 'pockets';
    npcs.lily.P.style = { arm: 0.3, sway: 0.05, bob: 0.9 }; npcs.lily.P.idle = 'clasp';
    npcs.rose.P.style = { arm: 0.42, bob: 1.4 }; npcs.rose.P.idle = 'relax';
    npcs.luke.headset = G.makeProp('headset'); npcs.luke.headset.position.set(0, 0.055 * 1.86, 0.02); npcs.luke.headset.traverse(m => { if (m.isMesh) { m.castShadow = true; m.layers.enable(1); } }); npcs.luke.P.bones.neck.add(npcs.luke.headset);
    leonP = G.makePerson('leon', T); leonP.root.visible = false; scene.add(leonP.root);
    vm = G.makeViewmodel(T); vm.position.set(0.22, -0.26, -0.38); vm.visible = false; camera.add(vm);
    initPortrait();
    W.onDoor = (d, open) => { if (open) A.creak(d.cx, d.y + 1, d.cz); else A.doorShut(d.cx, d.y + 1, d.cz); };
    addEventListener('resize', resize); resize();
    bindUI();
    renderer.compile(scene, camera);
    requestAnimationFrame(loop);
  }
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }

  // ================= live pixel portraits =================
  function initPortrait() {
    const rt = new THREE.WebGLRenderTarget(72, 72, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 20); cam.layers.set(1);
    const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const qm = new THREE.ShaderMaterial({ uniforms: { map: { value: rt.texture } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main(){ vec3 c = texture2D(map, vUv).rgb; c *= 1.15; \n#ifdef TONE_MAPPING\n c = toneMapping(c);\n#endif\n vec4 o = linearToOutputTexel(vec4(c, 1.0)); o.rgb = floor(o.rgb * 9.0 + 0.5) / 9.0; gl_FragColor = o; }' });
    qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), qm));
    portrait = { rt, cam, qs, qc, clear: new THREE.Color() };
  }
  const _hp = new V3(), _hq = new THREE.Quaternion(), _fw = new V3(), _up = new V3();
  function renderPortrait(who) {
    const el = $('dport'); const r = el.getBoundingClientRect(); if (r.width < 4) return;
    const Pp = who === 'leon' ? leonP : npcs[who] && npcs[who].P; if (!Pp) return;
    let restore = false;
    if (who === 'leon') { restore = true; leonP.root.visible = true; leonP.root.position.set(P.x, P.y, P.z); leonP.root.rotation.y = P.yaw + Math.PI; leonP.root.updateMatrixWorld(true); }
    Pp.bones.head.getWorldPosition(_hp); Pp.bones.head.getWorldQuaternion(_hq);
    _fw.set(0, 0, 1).applyQuaternion(_hq); _up.set(0, 1, 0).applyQuaternion(_hq);
    const hc = _hp.clone().addScaledVector(_up, 0.075 * Pp.H / 1.75);
    portrait.cam.position.copy(hc).addScaledVector(_fw, 0.62).addScaledVector(_up, 0.02); portrait.cam.up.copy(_up); portrait.cam.lookAt(hc);
    portrait.clear.set(G.shade(G.CHARS[who].hair, -0.62)).convertSRGBToLinear();
    const oc = renderer.getClearColor(new THREE.Color()), oa = renderer.getClearAlpha(), fog = scene.fog; scene.fog = null;
    renderer.setRenderTarget(portrait.rt); renderer.setClearColor(portrait.clear, 1); renderer.clear(); renderer.render(scene, portrait.cam); renderer.setRenderTarget(null);
    scene.fog = fog; renderer.setClearColor(oc, oa);
    if (restore) leonP.root.visible = false;
    // blit (posterized) under the dialog box, then copy those pixels into the visible 2D portrait canvas
    const y = innerHeight - r.bottom; renderer.setScissorTest(true); renderer.setScissor(r.left, y, r.width, r.height); renderer.setViewport(r.left, y, r.width, r.height);
    renderer.autoClear = false; renderer.render(portrait.qs, portrait.qc); renderer.autoClear = true;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
    const pr = renderer.getPixelRatio(), g = portrait.g || (portrait.g = el.getContext('2d')); g.imageSmoothingEnabled = false;
    try { g.drawImage(renderer.domElement, Math.round(r.left * pr), Math.round(r.top * pr), Math.round(r.width * pr), Math.round(r.height * pr), 0, 0, el.width, el.height); } catch (e) { /* ignore */ }
  }

  // ================= NPC =================
  function NPC(key) {
    this.key = key; this.P = G.makePerson(key, T); scene.add(this.P.root); this.P.root.visible = false;
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.path = null; this.speed = 1.3; this.node = null; this.lookPlayer = false; this.lookTarget = null; this.wasSin = 0;
  }
  NPC.prototype.spot = function (s) { if (typeof s !== 'string') return s; return W.spots[s] || (W.seats[s] && Object.assign({ seat: true }, W.seats[s])) || (W.nav.nodes[s] && { x: W.nav.nodes[s][0], y: W.nav.nodes[s][1], z: W.nav.nodes[s][2], node: s }); };
  NPC.prototype.place = function (s, anim, yaw) {
    const sp = this.spot(s); if (!sp) { console.warn('no spot', s); return this; }
    this.x = sp.x; this.z = sp.z; this.y = sp.y !== undefined ? sp.y : 0; this.y = W.heightAt(this.x, this.z, this.y + 0.01);
    this.yaw = yaw !== undefined ? yaw : sp.yaw || 0; this.node = sp.node || W.nearestNode(this.x, this.y, this.z);
    this.P.seatH = sp.h || 0.46; this.P.bedH = sp.bedH !== undefined ? sp.bedH : this.P.bedH;
    this.P.anim = anim || (sp.seat ? 'sit' : 'stand'); this.P.animT = 0; this.path = null; this.P.root.visible = true; this.P.walkW = 0;
    this.P.root.position.set(this.x, this.y, this.z); this.P.root.rotation.y = this.yaw;
    for (const j in this.P.cur) { const c = this.P.cur[j]; c[0] = c[1] = c[2] = 0; }
    this.P.update(0.001); this.P.blendRate = 1000; this.P.update(0.016); this.P.blendRate = 10;
    return this;
  };
  NPC.prototype.hide = function () { this.P.root.visible = false; this.path = null; this.lookPlayer = false; return this; };
  NPC.prototype.anim = function (a) { if (this.P.anim !== a) { this.P.anim = a; this.P.animT = 0; } return this; };
  NPC.prototype.face = function (x, z) { if (typeof x === 'object') { z = x.z; x = x.x; } this.yaw = Math.atan2(x - this.x, z - this.z); return this; };
  NPC.prototype.facePlayer = function () { return this.face(P.x, P.z); };
  NPC.prototype.expr = function (e) { this.P.setExpr(e); return this; };
  Object.defineProperty(NPC.prototype, 'visible', { get() { return this.P.root.visible; } });
  const _head = new V3();
  NPC.prototype.headPos = function () { this.P.bones.head.getWorldPosition(_head); _head.y += 0.08; return _head; };
  NPC.prototype.update = function (dt) {
    if (!this.P.root.visible) return;
    let moving = false;
    if (this.path && this.path.length) {
      const tg = this.path[0], dx = tg.x - this.x, dz = tg.z - this.z, d = Math.hypot(dx, dz), s = Math.min(d, this.speed * dt);
      if (d > 1e-4) { this.x += dx / d * s; this.z += dz / d * s; moving = true; }
      this.yaw += wrapA(Math.atan2(dx, dz) - this.yaw) * Math.min(1, dt * 7);
      const hip = this.P.B.hip * this.P.H; this.P.walkPhase += s / (2.9 * hip) * Math.PI * 2;
      const sn = Math.sin(this.P.walkPhase); if (Math.sign(sn) !== Math.sign(this.wasSin) && Math.hypot(this.x - P.x, this.z - P.z) < 20) A.npcStep(this.x, this.y + 0.1, this.z, W.surface(this.x, this.y, this.z)); this.wasSin = sn;
      if (d < 0.05) { this.path.shift(); if (!this.path.length) { this.path = null; if (this.endYaw !== undefined && this.endYaw !== null) this.yawTo = this.endYaw; this.anim(this.endAnim || 'stand'); this.node = this.destNode || this.node; const r = this.onArrive; this.onArrive = null; if (r) r(); } }
    } else if (this.yawTo !== undefined && this.yawTo !== null) { const dy = wrapA(this.yawTo - this.yaw); this.yaw += dy * Math.min(1, dt * 6); if (Math.abs(dy) < 0.01) this.yawTo = null; }
    this.P.walkW += ((moving ? 1 : 0) - this.P.walkW) * Math.min(1, dt * 7); this.P.speed = moving ? this.speed : 0;
    this.y += (W.heightAt(this.x, this.z, this.y) - this.y) * Math.min(1, dt * 12);
    const r = this.P.root; r.position.set(this.x, this.y, this.z); r.rotation.y = this.yaw;
    const look = this.lookPlayer || (dlg && dlg.who === this.key && dlg.look);
    this.P.lookAt = look ? camera.position : this.lookTarget; this.P.gazeAt = look ? camera.position : this.lookTarget;
    const talking = dlg && dlg.who === this.key; this.P.talk += ((talking ? 1 : 0) - this.P.talk) * Math.min(1, dt * 3);
    if (!talking) this.P.talkLevel *= Math.max(0, 1 - dt * 12);
    const dist = Math.hypot(this.x - P.x, this.z - P.z);
    if (dist < 45 || talking) this.P.update(dt);
    if (this.P.anim === 'chop') { const u = (this.P.animT % 1.7) / 1.7; if ((this.lastU || 0) < 0.62 && u >= 0.62) { A.chop(this.x + Math.sin(this.yaw) * 0.6, this.y + 0.4, this.z + Math.cos(this.yaw) * 0.6); } this.lastU = u; }
  };

  // ================= input / menus =================
  function lock() { if (IN.mode === 'touch') return; const c = renderer.domElement; if (!c.requestPointerLock) return; try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
  let lastPauseT = 0;
  function setPaused(v) {
    if (ended) return; lastPauseT = performance.now(); paused = v; $('pause').style.display = v ? 'flex' : 'none';
    if (v) { if (document.pointerLockElement) document.exitPointerLock(); } else lock();
  }
  function bindUI() {
    const save = store.get('save', null);
    if (save && save.day > 1) { $('mcont').style.display = 'block'; $('mcont').textContent = 'CONTINUE — DAY ' + save.day; }
    const begin = (day) => {
      A.init(); A.setVol('master', SET.vol); A.setVol('music', SET.music);
      if (isTouch) IN.mode = 'touch';
      if (isTouch || 'ontouchstart' in window) { IN.initTouch(isTouch); }
      if (isTouch) { try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* ignore */ } }
      menuOpen = false; started = true; $('menu').style.display = 'none'; lock();
      G.story(E, day).catch(err => { console.error(err); });
    };
    $('mnew').addEventListener('click', () => begin(1));
    $('mcont').addEventListener('click', () => begin((store.get('save', { day: 1 }).day) || 1));
    $('mset').addEventListener('click', () => openSettings('menu'));
    $('presume').addEventListener('click', () => setPaused(false));
    $('pset').addEventListener('click', () => openSettings('pause'));
    $('pquit').addEventListener('click', () => location.reload());
    $('sback').addEventListener('click', () => { $('settings').style.display = 'none'; });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && started && !ended && !paused && IN.mode === 'kbm' && !menuOpen) setPaused(true); });
    document.addEventListener('click', e => { if (started && !paused && !ended && !menuOpen && !document.pointerLockElement && e.target.closest && !e.target.closest('.screen, #choices')) lock(); });
    $('controls').innerHTML = isTouch ? 'LEFT THUMB move &middot; DRAG look &middot; TAP or ✋ use<br>⏸ pause' : 'WASD move &middot; MOUSE look &middot; SHIFT jog &middot; E / CLICK use &amp; continue<br>Controller supported (A use, Start pause)';
  }
  function openSettings() {
    const s = $('settings'); s.style.display = 'flex';
    const q = $('squal'), sens = $('ssens'), inv = $('sinv'), txt = $('stext'), vol = $('svol'), mus = $('smus'), fov = $('sfov');
    q.value = SET.quality; sens.value = SET.sens; inv.checked = SET.invert; txt.value = SET.text; vol.value = SET.vol; mus.value = SET.music; fov.value = SET.fov;
    const apply = () => {
      const oldQ = SET.quality; SET.quality = q.value; SET.sens = +sens.value; SET.invert = inv.checked; SET.text = txt.value; SET.vol = +vol.value; SET.music = +mus.value; SET.fov = +fov.value;
      IN.sens = SET.sens; IN.invert = SET.invert; A.setVol('master', SET.vol); A.setVol('music', SET.music); camera.fov = SET.fov; camera.updateProjectionMatrix(); store.set('settings', SET);
      $('sqnote').style.display = oldQ !== SET.quality || $('sqnote').dataset.on ? 'block' : 'none'; if (oldQ !== SET.quality) $('sqnote').dataset.on = 1;
    };
    [q, sens, inv, txt, vol, mus, fov].forEach(el => (el.onchange = el.oninput = apply));
  }

  // ================= dialogue =================
  G.lineId = (who, text) => { let h = 2166136261; const s = who + '|' + text; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return who + '_' + (h >>> 0).toString(36); };
  function openDlg() {
    const ch = G.CHARS[dlg.who], box = $('dlg');
    box.style.setProperty('--c', ch.hair); box.style.setProperty('--bg', G.shade(ch.hair, -0.78)); box.style.setProperty('--bg2', G.shade(ch.hair, -0.6));
    $('dname').textContent = dlg.o.thought ? ch.name + ' (thinking)' : ch.name;
    $('dtext').className = (dlg.o.thought ? 'thought ' : '') + (dlg.o.yell ? 'yell ' : '') + (dlg.o.whisper ? 'whisper' : '');
    $('dtext').textContent = ''; $('dnext').style.opacity = 0; $('dhint').style.opacity = 0;
    box.style.display = 'flex'; box.classList.toggle('shake', !!dlg.o.yell);
    const n = npcs[dlg.who];
    if (n && dlg.o.mood) n.P.setExpr(dlg.o.mood); if (dlg.who === 'leon' && dlg.o.mood) leonP.setExpr(dlg.o.mood); else if (dlg.who === 'leon') leonP.setExpr(dlg.o.thought ? 'neutral' : 'neutral');
    if (n && dlg.o.anim) n.anim(dlg.o.anim);
    dlg.look = !!n && dlg.o.look !== false && Math.hypot(n.x - P.x, n.z - P.z) < 12;
    const hp = n ? n.headPos().clone() : null;
    for (const k in npcs) { const m = npcs[k]; if (m === n || !m.visible) continue; if (hp && Math.hypot(m.x - n.x, m.z - n.z) < 7 && !m.lookPlayer) { m._prevLook = m.lookTarget; m.lookTarget = hp; m._glance = true; } }
    dlg.id = dlg.o.id || G.lineId(dlg.who, dlg.text);
    dlg.voice = A.ready() ? A.voice(dlg.id, n ? n.headPos() : null) : null;
  }
  function closeDlg() {
    const d = dlg; dlg = null; $('dlg').style.display = 'none';
    if (d.voice) d.voice.stop();
    for (const k in npcs) { const m = npcs[k]; if (m._glance) { m.lookTarget = m._prevLook || null; m._glance = false; } }
    const n = npcs[d.who]; if (n && d.o.anim && d.o.animAfter !== false) n.anim(d.o.animAfter || 'stand');
    d.res();
  }
  function dlgPress() {
    if (!dlg || dlg.o.noSkip) return;
    if (dlg.t < 0.3) return;
    if (dlg.shown < dlg.text.length) { dlg.fast = true; return; }
    const voicePlaying = dlg.voice && !dlg.voice.done;
    if (dlg.doneT < 0.25) return;
    if (voicePlaying && !dlg.skipArm) { dlg.skipArm = 0.8; $('dhint').style.opacity = 1; return; }
    closeDlg();
  }
  function updateDlg(dt) {
    if (!dlg) return;
    dlg.t += dt;
    const n = npcs[dlg.who], P2 = n ? n.P : (dlg.who === 'leon' ? leonP : null);
    let cps = SET.text === 'fast' ? 62 : 38; if (dlg.o.yell) cps *= 1.4; if (dlg.o.speed) cps = dlg.o.speed;
    if (dlg.voice && dlg.voice.el && dlg.voice.el.duration > 0 && isFinite(dlg.voice.el.duration)) cps = Math.max(8, dlg.text.length / Math.max(0.5, dlg.voice.el.duration * 0.92));
    if (dlg.fast) cps *= 4;
    if (dlg.shown < dlg.text.length) {
      dlg.shown = Math.min(dlg.text.length, dlg.shown + dt * cps);
      const k = Math.floor(dlg.shown);
      for (let i = dlg.last; i < k; i++) { const c = dlg.text[i]; if (/[aeiouyAEIOUY]/.test(c) && !dlg.voice && !dlg.o.thought && (i - (dlg.lastSyl || -9)) > 1) { dlg.lastSyl = i; A.syllable(dlg.who, { pos: n ? n.headPos() : null, yell: dlg.o.yell, whisper: dlg.o.whisper, q: dlg.text.trim().endsWith('?') && i > dlg.text.length - 8 }); if (P2) P2.talkLevel = 0.55 + Math.random() * 0.35; } }
      dlg.last = k; $('dtext').textContent = dlg.text.slice(0, k);
      if (dlg.shown >= dlg.text.length) dlg.doneT = 0;
    } else {
      dlg.doneT += dt;
      $('dnext').style.opacity = dlg.o.auto !== undefined ? 0 : 1;
      if (dlg.o.auto !== undefined && dlg.doneT >= dlg.o.auto && (!dlg.voice || dlg.voice.done)) { closeDlg(); return; }
    }
    if (P2) { if (dlg.voice) P2.talkLevel = dlg.voice.level(); else if (dlg.o.thought) P2.talkLevel = 0; else P2.talkLevel *= Math.max(0, 1 - dt * 9); }
    if (dlg.skipArm) { dlg.skipArm -= dt; if (dlg.skipArm <= 0) { dlg.skipArm = 0; $('dhint').style.opacity = 0; } else if (IN.usePressed && dlg.skipArm < 0.75) { closeDlg(); return; } }
    if (dlg.voice && dlg.voice.done && dlg.shown >= dlg.text.length && dlg.o.auto === undefined && dlg.autoAdvance) closeDlg();
  }

  // ================= choices / reading / timing =================
  function updateChoice() {
    if (!choice) return;
    const n = choice.opts.length;
    if (IN.navPressed) { choice.i = (choice.i + IN.navPressed + n) % n; drawChoice(); A.pop(); }
    if (IN.digit && IN.digit <= n) { choice.i = IN.digit - 1; IN.digit = 0; drawChoice(); finishChoice(); return; }
    if (IN.usePressed && choice.t > 0.3) finishChoice();
  }
  function drawChoice() { [...$('choices').children].forEach((el, i) => el.classList.toggle('sel', i === choice.i)); }
  function finishChoice() { IN.usePressed = false; const c = choice; choice = null; $('choices').style.display = 'none'; A.clink(); c.res(c.i); }
  function updateReading(dt) { if (!reading) return; reading.t += dt; if (IN.usePressed && reading.t > 0.5) { IN.usePressed = false; const r = reading; reading = null; $('reader').style.display = 'none'; A.page(); r.res(); } }
  function updateTiming(dt) {
    if (!timing) return; const tm = timing; tm.t += dt; tm.u = (Math.sin(tm.t * tm.speed) + 1) / 2;
    $('tmark').style.left = (tm.u * 100) + '%';
    if (IN.usePressed && tm.t > 0.25) {
      const ok = Math.abs(tm.u - tm.c) < tm.w / 2;
      if (ok) { IN.usePressed = false; timing = null; $('timing').style.display = 'none'; tm.res(true); }
      else { tm.miss++; A.thud && A.dig(); $('timing').classList.add('miss'); setTimeout(() => $('timing').classList.remove('miss'), 200); if (tm.onMiss) tm.onMiss(tm.miss); }
    }
  }

  // ================= player =================
  const _seg = [];
  function pushOut(x, z, r, c) {
    const px = clamp(x, c.x0, c.x1), pz = clamp(z, c.z0, c.z1), dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return; if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; _seg[0] = x + dx * k; _seg[1] = z + dz * k; return true; }
    const m = Math.min(x - c.x0, c.x1 - x, z - c.z0, c.z1 - z);
    if (m === x - c.x0) { _seg[0] = c.x0 - r; _seg[1] = z; } else if (m === c.x1 - x) { _seg[0] = c.x1 + r; _seg[1] = z; } else if (m === z - c.z0) { _seg[0] = x; _seg[1] = c.z0 - r; } else { _seg[0] = x; _seg[1] = c.z1 + r; }
    return true;
  }
  function resolve(x, z, y) {
    const r = 0.27, lo = y + 0.3, hi = y + 1.45;
    for (let it = 0; it < 3; it++) {
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) for (const c of W.near(x + ox * 4, z + oz * 4)) {
        if (c.on === false || c.y1 < lo || c.y0 > hi) continue; if (x < c.x0 - r || x > c.x1 + r || z < c.z0 - r || z > c.z1 + r) continue;
        if (pushOut(x, z, r, c)) { x = _seg[0]; z = _seg[1]; }
      }
      for (const k in npcs) { const n = npcs[k]; if (!n.visible || Math.abs(n.y - y) > 1) continue; const dx = x - n.x, dz = z - n.z, d = Math.hypot(dx, dz); if (d < 0.5 && d > 1e-4) { x = n.x + dx / d * 0.5; z = n.z + dz / d * 0.5; } }
    }
    return [x, z];
  }
  function updatePlayer(dt) {
    if (P.cine) return;
    const look = IN.look, inUI = !!(dlg || choice || reading || timing);
    if (!paused) { P.yaw -= look.x; P.pitch = clamp(P.pitch - look.y, -1.4, 1.4); }
    if (P.seat) {
      const base = P.seat.yaw + Math.PI, d = wrapA(P.yaw - base); P.yaw = base + clamp(d, -1.4, 1.4); P.pitch = clamp(P.pitch, -0.9, 0.7);
      camera.position.set(P.seat.x, (P.seat.y || 0) + (P.seat.eye || 1.12), P.seat.z); camera.rotation.set(P.pitch, P.yaw, 0); return;
    }
    if (P.bed) {
      const b = P.bed, base = b.yaw, d = wrapA(P.yaw - base); P.yaw = base + clamp(d, -1.2, 1.2); P.pitch = clamp(P.pitch, -0.2, 1.3);
      camera.position.set(b.x, b.y, b.z); camera.rotation.set(P.pitch, P.yaw, b.roll || 0); return;
    }
    const mv = IN.move, mx0 = (P.locked || inUI) ? 0 : mv.x, my0 = (P.locked || inUI) ? 0 : mv.y;
    const rg = W.region(P.x, P.y, P.z), sp = (IN.sprint ? (rg === 'out' ? 3.6 : 2.9) : 2.0) * (P.slow || 1);
    const tx = (-Math.sin(P.yaw) * my0 + Math.cos(P.yaw) * mx0) * sp, tz = (-Math.cos(P.yaw) * my0 - Math.sin(P.yaw) * mx0) * sp;
    const acc = Math.hypot(mx0, my0) > 0.05 ? 10 : 12; P.vx += (tx - P.vx) * Math.min(1, dt * acc); P.vz += (tz - P.vz) * Math.min(1, dt * acc);
    const spd = Math.hypot(P.vx, P.vz);
    if (spd > 0.02) {
      const ox = P.x, oz = P.z; [P.x, P.z] = resolve(P.x + P.vx * dt, P.z + P.vz * dt, P.y);
      const bx = clamp(P.x, -46, 56), bz = clamp(P.z, -50, 69.5), rr = Math.hypot(P.x - 5, P.z - 5);
      if (bx !== P.x || bz !== P.z || rr > 78) { P.x = bx; P.z = bz; if (rr > 78) { P.x = 5 + (P.x - 5) * 78 / rr; P.z = 5 + (P.z - 5) * 78 / rr; } if (gtime - P.warned > 8) { P.warned = gtime; E.toast(P.z > 66 ? 'The road just... ends. There\'s nothing down there but rocks.' : 'Mom says never to wander into the woods.'); } }
      const moved = Math.hypot(P.x - ox, P.z - oz); P.bob += moved * 4.1; P.stepD += moved;
      if (P.stepD > (IN.sprint ? 0.85 : 0.68)) { P.stepD = 0; A.step(W.surface(P.x, P.y, P.z), IN.sprint ? 1.2 : 1); }
    } else P.bob += (Math.round(P.bob / Math.PI) * Math.PI - P.bob) * Math.min(1, dt * 4);
    const ty = W.heightAt(P.x, P.z, P.y); P.y += (ty - P.y) * Math.min(1, dt * 14);
    if (!E.allow.basement && P.y < -0.6) { E.teleport(-3.0, 0, -5.4, -Math.PI / 2); E.toast('You shouldn\'t be down there.'); }
    P.sway += ((-mx0 * 0.012) - P.sway) * Math.min(1, dt * 5);
    const bobA = 0.032 * Math.min(1, spd / 2);
    camera.position.set(P.x, P.y + P.eye + Math.sin(P.bob) * bobA, P.z); camera.rotation.set(P.pitch, P.yaw, P.sway + Math.cos(P.bob * 0.5) * bobA * 0.15);
    if (vm.visible) { vm.position.set(0.22 + Math.cos(P.bob * 0.5) * bobA * 0.5, -0.26 + Math.abs(Math.sin(P.bob * 0.5)) * bobA * 0.5 - (vm.drop || 0), -0.38); }
  }
  // occlusion test for interactions: segment vs collider boxes
  function blocked(ax, ay, az, bx, by, bz) {
    const seen = new Set();
    for (let k = 0; k <= 4; k++) { const t = k / 4, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (const c of W.near(x, z)) { if (seen.has(c) || c.on === false) continue; seen.add(c);
        if (bx >= c.x0 - 0.12 && bx <= c.x1 + 0.12 && bz >= c.z0 - 0.12 && bz <= c.z1 + 0.12 && by >= c.y0 - 0.12 && by <= c.y1 + 0.12) continue;
        let t0 = 0, t1 = 1, ok = true; const o = [ax, ay, az], d = [bx - ax, by - ay, bz - az], mn = [c.x0, c.y0, c.z0], mx = [c.x1, c.y1, c.z1];
        for (let i = 0; i < 3 && ok; i++) { if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) ok = false; } else { let u0 = (mn[i] - o[i]) / d[i], u1 = (mx[i] - o[i]) / d[i]; if (u0 > u1) [u0, u1] = [u1, u0]; t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) ok = false; } }
        if (ok && t1 > 0.02 && t0 < 0.97) return true; } }
    return false;
  }
  const _f = new V3();
  function updateFocus(dt) {
    const prev = focus; focus = null;
    if (dlg || P.cine || choice || reading || timing || !inters.size) { $('prompt').style.opacity = 0; $('ring').style.opacity = 0; holdP = 0; return; }
    camera.getWorldDirection(_f); const cp = camera.position; let bd = 0;
    for (const it of inters) {
      if (it.active && !it.active()) continue;
      const p = it.get ? it.get() : [it.x, it.y, it.z]; const dx = p[0] - cp.x, dy = p[1] - cp.y, dz = p[2] - cp.z, d = Math.hypot(dx, dy, dz);
      if (d > (it.r || 2.3)) continue; const dot = (dx * _f.x + dy * _f.y + dz * _f.z) / d;
      if (dot > (it.dot || 0.9) && dot > bd && !(it.noOcc ? false : blocked(cp.x, cp.y, cp.z, p[0], p[1], p[2]))) { bd = dot; focus = it; }
    }
    const pr = $('prompt');
    if (focus) { pr.innerHTML = `<b>${IN.glyph()}</b> ${focus.hold ? '(hold) ' : ''}${focus.label}`; pr.style.opacity = 1; } else pr.style.opacity = 0;
    if (focus !== prev) holdP = 0;
    if (focus && focus.hold) {
      if (IN.use) { holdP += dt / focus.hold; if (focus.tick) focus.tick(holdP, dt); } else holdP = Math.max(0, holdP - dt * 2);
      $('ring').style.opacity = holdP > 0 ? 1 : 0; $('ringc').style.strokeDashoffset = 113 * (1 - clamp(holdP, 0, 1));
      if (holdP >= 1) { holdP = 0; $('ring').style.opacity = 0; const f = focus; focus = null; f.cb(); }
    } else { $('ring').style.opacity = 0; if (focus && IN.usePressed) { const f = focus; focus = null; f.cb(); } }
  }

  // ================= loop =================
  let last = performance.now(), sunFrame = 0;
  const actors = [];
  function loop(now) {
    requestAnimationFrame(loop);
    const rdt = Math.min(0.1, (now - last) / 1000), dt = Math.min(0.05, rdt); last = now;
    IN.update(dt);
    if (innerWidth !== P.vw || innerHeight !== P.vh) { P.vw = innerWidth; P.vh = innerHeight; resize(); }
    if (IN.pausePressed && started && !ended && performance.now() - lastPauseT > 350) setPaused(!paused);
    if (started && !paused) {
      gtime += dt;
      for (let i = timers.length - 1; i >= 0; i--) if (gtime >= timers[i].t) { const r = timers[i].r; timers.splice(i, 1); r(); }
      for (let i = watchers.length - 1; i >= 0; i--) if (watchers[i].fn()) { const r = watchers[i].r; watchers.splice(i, 1); r(); }
      for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.ease ? tw.ease(k) : k); if (k >= 1) { tweens.splice(i, 1); tw.r(); } }
      if (dlg && IN.usePressed) { dlgPress(); IN.usePressed = false; }
      if (choice) choice.t += dt;
      updateChoice(); updateReading(dt); updateTiming(dt);
      updatePlayer(dt);
      for (const k in npcs) npcs[k].update(dt);
      updateDlg(dt);
      updateFocus(dt);
    }
    // world + lighting
    const cp = camera.position, rg = W.region(cp.x, cp.y, cp.z);
    actors.length = 0; actors.push({ x: P.x, y: P.y, z: P.z }); for (const k in npcs) if (npcs[k].visible) actors.push(npcs[k]);
    const hk = rg === 'out' ? 1 : rg === 'base' ? 0.035 : 0.42;
    hemiK += (hk - hemiK) * Math.min(1, dt * 3);
    W.hemi.intensity = W.pre.hi * hemiK + (rg === 'in' || rg === 'up' ? 0.05 : 0);
    W.sun.intensity = W.pre.si * (rg === 'base' ? 0 : 1);
    W.followSun(P.x, P.z);
    sunFrame++; W.sun.shadow.autoUpdate = rg === 'out' || (rg !== 'base' && sunFrame % 3 === 0) || E.forceShadow;
    W.bLight.shadow.autoUpdate = rg === 'base';
    W.update(dt, rg, actors); W.updateLights(cp, dt);
    if (E.phoneLight) { W.lightsSrc.phone.on = true; W.lightsSrc.phone.p.copy(E.phoneLight); } else W.lightsSrc.phone.on = false;
    mixT -= dt;
    if (mixT <= 0 && A.ready()) {
      mixT = 0.25; const pre = W.pre, inside = rg === 'in' || rg === 'up';
      A.mix({ wind: rg === 'out' ? pre.wind * (P.y > 3 ? 1.8 : 1) : inside ? pre.wind * 0.2 : 0, room: inside ? 0.05 : 0, fire: inside && W.lightsSrc.fire.on ? 0.12 : 0,
        drone: rg === 'base' ? 0.14 : (E.amb.dread || 0), flies: W.flies.visible && rg === 'base' ? 0.07 : 0, sizzle: E.amb.sizzle && inside ? 0.1 : 0, droneTc: E.amb.droneTc || 1.2,
        rain: pre.rain ? (rg === 'out' ? 0.16 : 0) : 0, rainIn: pre.rain && inside ? 0.12 : 0, gen: E.amb.gen ? 0.22 : 0, crickets: pre.night && rg !== 'base' ? (rg === 'out' ? 0.03 : 0.01) : 0 });
    }
    if (A.ready()) { A.listener(camera); A.tick(dt, { fire: (rg === 'in') && W.lightsSrc.fire.on ? 1 : 0, sizzle: E.amb.sizzle && rg === 'in', birds: rg === 'out' && !paused ? W.pre.birds : 0, night: W.pre.night, inside: rg !== 'out', rain: W.pre.rain && rg === 'out' ? 1 : 0, px: P.x, py: P.y, pz: P.z }); }
    // dynamic resolution
    frameN++; prPerf = prPerf * 0.95 + rdt * 0.05;
    if (frameN % 60 === 0 && started) { const cur = renderer.getPixelRatio(), maxPR = Math.min(window.devicePixelRatio || 1, Q.pr); let np = cur; if (prPerf > 1 / 45) np = Math.max(0.6, cur - 0.1); else if (prPerf < 1 / 58 && cur < maxPR) np = Math.min(maxPR, cur + 0.05); if (Math.abs(np - cur) > 0.01) renderer.setPixelRatio(np); }
    renderer.render(scene, camera);
    if (dlg) renderPortrait(dlg.who);
  }

  // ================= story API =================
  const E = G.E = {
    P, npc: npcs, get W() { return W; }, get T() { return T; }, get camera() { return camera; }, A, IN, amb: {}, allow: { basement: false }, flags: {}, get leonP() { return leonP; }, get vm() { return vm; },
    wait(s) { return new Promise(r => timers.push({ t: gtime + s, r })); },
    until(fn) { return new Promise(r => watchers.push({ fn, r })); },
    tween(dur, fn, ease) { return new Promise(r => tweens.push({ t: 0, dur, fn, r, ease })); },
    objective(t) { $('obj').textContent = t || ''; $('obj').style.opacity = t ? 1 : 0; if (t) A.ready() && A.chime(); },
    toast(t, dur = 3.5) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(el._t); el._t = setTimeout(() => (el.style.opacity = 0), dur * 1000); },
    async free() { while (dlg || choice || reading || timing) await E.wait(0.05); },
    async say(who, text, o = {}) { await E.free(); return new Promise(res => { dlg = { who, text, o, shown: 0, last: 0, t: 0, doneT: 0, res }; openDlg(); }); },
    think(text, o = {}) { return E.say('leon', text, Object.assign({ thought: true }, o)); },
    async choose(opts) { await E.free(); return new Promise(res => { choice = { opts, i: 0, t: 0, res }; const box = $('choices'); box.innerHTML = ''; opts.forEach((o, i) => { const d = document.createElement('div'); d.className = 'opt' + (i ? '' : ' sel'); d.textContent = (i + 1) + '. ' + o; d.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); if (!choice) return; choice.i = i; drawChoice(); finishChoice(); }); box.appendChild(d); }); box.style.display = 'flex'; }); },
    async read(o) { await E.free(); return new Promise(res => { reading = { t: 0, res }; const el = $('reader'); el.className = o.style || 'paper'; $('rtitle').textContent = o.title || ''; $('rbody').innerHTML = o.body || ''; $('rimg').style.display = o.img ? 'block' : 'none'; if (o.img) $('rimg').src = o.img; el.style.display = 'flex'; A.page(); }); },
    async timing(o) { await E.free(); return new Promise(res => { timing = { t: 0, u: 0, c: o.center || 0.5, w: o.width || 0.18, speed: o.speed || 3, miss: 0, res, onMiss: o.onMiss }; $('tlabel').textContent = o.label || ''; $('tzone').style.left = ((timing.c - timing.w / 2) * 100) + '%'; $('tzone').style.width = (timing.w * 100) + '%'; $('timing').style.display = 'block'; }); },
    interact(def) { return new Promise(r => { const it = Object.assign({}, def, { cb: () => { inters.delete(it); r(); } }); inters.add(it); }); },
    addInteract(def) { const it = Object.assign({}, def); it.cb = () => def.cb(it); inters.add(it); return { stop: () => inters.delete(it) }; },
    talk(n, label) { return E.interact({ label: label || 'Talk to ' + G.CHARS[n.key].name, r: 2.8, dot: 0.82, noOcc: true, get: () => [n.x, n.y + n.P.H * 0.85, n.z], active: () => n.visible }); },
    chat(n, sets, o = {}) {
      let i = 0, busy = false;
      const h = E.addInteract({ chat: true, label: o.label || 'Talk to ' + G.CHARS[n.key].name, r: 2.8, dot: 0.82, noOcc: true, get: () => [n.x, n.y + n.P.H * 0.85, n.z], active: () => n.visible && !busy && !dlg,
        cb: async () => { busy = true; const set = sets[Math.min(i, sets.length - 1)]; i++; const prevA = n.P.anim, prevYaw = n.yaw; if (o.turn !== false && !n.path) n.facePlayer(); n.lookPlayer = true;
          for (const l of set) { if (typeof l === 'function') await l(); else await E.say(l[0], l[1], l[2] || {}); }
          n.lookPlayer = false; if (o.turn !== false && !n.path) { n.yawTo = prevYaw; } if (prevA) n.anim(prevA); busy = false; if (o.once && i >= sets.length) h.stop(); } });
      return h;
    },
    go(n, dest, o = {}) {
      return new Promise(r => {
        const sp = typeof dest === 'string' ? NPC.prototype.spot.call(n, dest) : dest;
        if (!sp) { console.warn('bad dest', dest); r(); return; }
        const destNode = typeof dest === 'string' && W.nav.nodes[dest] ? dest : sp.node || W.nearestNode(sp.x, sp.y || 0, sp.z);
        let start = n.node && W.nav.nodes[n.node] && Math.hypot(W.nav.nodes[n.node][0] - n.x, W.nav.nodes[n.node][2] - n.z) < 4 ? n.node : W.nearestNode(n.x, n.y, n.z);
        const route = start === destNode ? [] : (W.path(start, destNode) || []);
        const pts = []; const sn = W.nav.nodes[start];
        if (o.direct) pts.push({ x: sp.x, z: sp.z }); else {
          if (Math.hypot(sn[0] - n.x, sn[2] - n.z) > 0.4 && !(route.length && Math.hypot(W.nav.nodes[route[0]][0] - n.x, W.nav.nodes[route[0]][2] - n.z) < Math.hypot(sn[0] - W.nav.nodes[route[0]][0], sn[2] - W.nav.nodes[route[0]][2]))) pts.push({ x: sn[0], z: sn[2] });
          for (const k of route) pts.push({ x: W.nav.nodes[k][0], z: W.nav.nodes[k][2] });
          if (!(typeof dest === 'string' && W.nav.nodes[dest])) pts.push({ x: sp.x, z: sp.z });
        }
        if (n.P.anim !== 'stand' && n.P.anim !== 'walk') n.anim('stand');
        n.path = pts; n.speed = o.speed || n.walkSpeed || 1.3; n.endAnim = o.anim || (sp.seat ? 'sit' : 'stand'); n.endYaw = o.yaw !== undefined ? o.yaw : sp.yaw !== undefined ? sp.yaw : null; n.destNode = destNode;
        if (sp.seat) { n.P.seatH = sp.h; }
        if (sp.bedH !== undefined) n.P.bedH = sp.bedH;
        if (n.onArrive) { const prev = n.onArrive; n.onArrive = null; prev(); }
        n.onArrive = r; if (!pts.length) { n.path = null; n.anim(n.endAnim); if (n.endYaw !== null) n.yawTo = n.endYaw; n.node = destNode; r(); }
      });
    },
    fade(to, dur = 1) { const el = $('fade'), from = parseFloat(el.style.opacity || 0); return E.tween(dur, k => (el.style.opacity = from + (to - from) * k)); },
    async title(a, b = '', dur = 3.5) { $('tmain').textContent = a; $('tsub').textContent = b; const el = $('title'); await E.tween(0.9, k => (el.style.opacity = k)); await E.wait(dur); await E.tween(0.9, k => (el.style.opacity = 1 - k)); },
    setTime(n, o) { W.setTime(n, o); },
    region() { return W.region(P.x, P.y, P.z); },
    inside() { const r = W.region(P.x, P.y, P.z); return r === 'in' || r === 'up'; },
    near(x, z, r, y) { return Math.hypot(P.x - x, P.z - z) < r && (y === undefined || Math.abs(P.y - y) < 1.2); },
    look(x, y, z, dur = 0.8) {
      const cp = camera.position, dx = x - cp.x, dy = y - cp.y, dz = z - cp.z, ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz));
      const dyaw = wrapA(ty - P.yaw), y0 = P.yaw, p0 = P.pitch;
      return E.tween(dur, k => { P.yaw = y0 + dyaw * k; P.pitch = p0 + (tp - p0) * k; }, k => k * k * (3 - 2 * k));
    },
    lookNpc(n, dur = 0.7) { const h = n.headPos(); return E.look(h.x, h.y - 0.06, h.z, dur); },
    lock(v) { P.locked = v; },
    sit(seat, o = {}) { const s = W.seats[seat] || seat; P.seat = Object.assign({ eye: 1.12 }, s, o); P.bed = null; P.yaw = s.yaw + Math.PI; P.pitch = o.pitch !== undefined ? o.pitch : -0.3; P.x = s.x; P.z = s.z; P.y = s.y || 0; },
    bed(o) { const b = W.beds.leon; P.bed = Object.assign({ x: b.x, y: b.y + 0.28, z: b.head - 0.3, yaw: 0, roll: 0 }, o); P.seat = null; P.yaw = P.bed.yaw; P.pitch = o && o.pitch !== undefined ? o.pitch : 0.95; },
    async getUp(x, z, yaw) { const c0 = camera.position.clone(), y0 = P.yaw, p0 = P.pitch; const ty = W.heightAt(x, z, 3.1) + P.eye; P.cine = true;
      await E.tween(1.2, k => { camera.position.set(c0.x + (x - c0.x) * k, c0.y + (ty - c0.y) * k + Math.sin(k * Math.PI) * 0.1, c0.z + (z - c0.z) * k); camera.rotation.set(p0 + (-0.1 - p0) * k, y0 + wrapA(yaw - y0) * k, 0); }, k => k * k * (3 - 2 * k));
      P.bed = null; P.seat = null; P.x = x; P.z = z; P.y = W.heightAt(x, z, 3.1); P.yaw = yaw; P.pitch = -0.1; P.cine = false; },
    stand(x, z, yaw) { P.seat = null; P.bed = null; P.x = x; P.z = z; P.y = W.heightAt(x, z, P.y); if (yaw !== undefined) P.yaw = yaw; },
    teleport(x, y, z, yaw, pitch = -0.1) { P.x = x; P.z = z; P.y = W.heightAt(x, z, y); P.yaw = yaw; P.pitch = pitch; P.seat = null; P.bed = null; P.vx = P.vz = 0; },
    give(name) { for (const k in vm.items) vm.items[k].visible = false; vm.visible = !!name; vm.item = name; if (!name) return; if (!vm.items[name]) { const it = G.makeProp(name === 'sketch' ? 'sketchbook' : name === 'potatoes' || name === 'tomatoes' ? 'basket' : name, T); vm.hand.add(it); vm.items[name] = it; const cfg = VMC[name] || VMC.def; it.position.set(...cfg[0]); it.rotation.set(...cfg[1]); it.scale.setScalar(cfg[2] || 1); } vm.items[name].visible = true; },
    async hit() {
      P.cine = true; const c0 = camera.position.clone(), y0 = P.yaw, p0 = P.pitch;
      A.axeHit(); IN.rumble(1, 1, 700); $('hurt').style.opacity = 1; renderer.domElement.style.filter = 'blur(2px) saturate(1.4)';
      await E.tween(0.14, k => { camera.position.set(c0.x - Math.sin(y0) * 0.25 * k, c0.y - 0.1 * k, c0.z - Math.cos(y0) * 0.25 * k); camera.rotation.set(p0 - 0.5 * k, y0, 0.15 * k); });
      $('drips').style.opacity = 1; const c1 = camera.position.clone(), floor = P.y + 0.16;
      await E.tween(1.1, k => { camera.position.set(c1.x, c1.y + (floor - c1.y) * k, c1.z); camera.rotation.set(p0 - 0.5 + 0.6 * k, y0 + 2.7 * k, 0.15 + 1.2 * k); }, k => k * k);
      A.thud(); IN.rumble(0.8, 0.3, 300); renderer.domElement.style.filter = 'blur(3px) saturate(1.6) brightness(0.8)'; $('hurt').style.opacity = 0.75;
    },
    cam(x, y, z, lx, ly, lz) { P.cine = true; camera.position.set(x, y, z); camera.up.set(0, 1, 0); camera.lookAt(lx, ly, lz); },
    camEnd() { P.cine = false; camera.rotation.order = 'YXZ'; },
    letterbox(on) { document.body.classList.toggle('lb', !!on); },
    clearFx() { $('hurt').style.opacity = 0; $('drips').style.opacity = 0; renderer.domElement.style.filter = ''; },
    music(n) { A.music(n); },
    save(day) { store.set('save', { day }); },
    end() { ended = true; store.set('save', { day: 1 }); $('menu').innerHTML = `<h1>PLENTY MORE</h1><div class="sub">there's plenty more.</div><div class="credits">a story about a family on a mountain</div><button class="mb" onclick="location.reload()">PLAY AGAIN</button>`; $('menu').style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock(); },
    hud(on) { document.body.classList.toggle('nohud', !on); },
    dbg: { get renderer() { return renderer; }, inters, get dlg() { return dlg; }, get choice() { return choice; }, timers, watchers, tweens, get gtime() { return gtime; } }
  };
  // viewmodel item placements (in the hand group's frame): pos, rot, scale
  const VMC = { def: [[0, 0.02, -0.08], [0, 0, 0]], can: [[0.0, 0.05, -0.1], [0, Math.PI / 2, 0], 0.9], mug: [[0, 0.05, -0.07], [-Math.PI / 2, 0, 0]], phone: [[0, 0.02, -0.08], [0.9, 0, 0]], bucket: [[0, 0.1, -0.06], [0, 0, 0], 0.8],
    crown: [[0, 0.03, -0.12], [0.4, 0, 0], 0.9], flowers: [[0, 0.02, -0.06], [-0.3, 0, 0]], log: [[0, 0.06, -0.15], [0, 0.3, 0], 0.9], basket: [[0, 0.24, -0.08], [0, 0, 0], 0.8], potatoes: [[0, 0.24, -0.08], [0, 0, 0], 0.8], tomatoes: [[0, 0.24, -0.08], [0, 0, 0], 0.8], sketch: [[0, 0.04, -0.1], [0, Math.PI / 2, -0.4]], axe: [[0.0, 0.02, -0.02], [-0.35, 0, 0.05], 0.85], knife: [[0, 0.02, -0.06], [0, 0, 0]] };

  init();
})();
