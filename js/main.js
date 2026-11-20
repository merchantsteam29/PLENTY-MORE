// Engine: renderer, player, NPCs, dialogue, interactions, cutscene helpers. Story lives in story.js.
(function () {
  const $ = id => document.getElementById(id);
  const A = G.Audio;
  let renderer, scene, camera, T, W;
  const keys = {};
  const P = { x: 11.7, y: 0, z: 1.1, yaw: 0.35, pitch: -0.3, eye: 1.42, locked: false, cine: false, seat: null, bob: 0, stepD: 0, warned: 0 };
  let gtime = 0, started = false, paused = false, ended = false;
  const timers = [], watchers = [], tweens = [], inters = new Set(), npcs = {};
  let dlg = null, focus = null, hemiK = 1, mixT = 0, mug = null, mugT = 0;
  const portraits = {};

  // ---------- setup ----------
  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.prepend(renderer.domElement);
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xcccccc, 20, 200);
    camera = new THREE.PerspectiveCamera(68, 1, 0.05, 600); camera.rotation.order = 'YXZ'; scene.add(camera);
    T = G.makeTextures();
    W = G.buildWorld(scene, T);
    W.setTime('day1');
    W.bodies = G.makeBodies(scene, T); W.bodies.group.visible = false;
    for (const k of ['linda', 'luke', 'lily', 'rose']) npcs[k] = new NPC(k);
    mug = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 12), G.mat('#c84a3a', 30)); mug.add(cup);
    const coc = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), G.mat('#4a2a18', 60)); coc.rotation.x = -Math.PI / 2; coc.position.y = 0.045; mug.add(coc);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 4, 8), G.mat('#c84a3a', 30)); handle.position.x = 0.05; mug.add(handle);
    mug.position.set(0.2, -0.22, -0.42); mug.visible = false; camera.add(mug);
    addEventListener('resize', resize); resize();
    bindInput();
    renderer.compile(scene, camera);
    requestAnimationFrame(loop);
  }
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }

  // ---------- NPC ----------
  function NPC(key) {
    this.key = key; this.p = G.makePerson(key, T); scene.add(this.p.root);
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.anim = 'stand'; this.t = Math.random() * 10;
    this.path = null; this.speed = 1.35; this.lookP = false; this.stepAcc = 0; this.lastU = 0;
    this.axe = G.makeAxe(); this.axe.rotation.x = Math.PI / 2; this.axe.position.set(0, -0.02, -0.05); this.axe.visible = false; this.p.hands[1].add(this.axe);
    this.p.root.visible = false;
  }
  NPC.prototype.place = function (x, z, yaw, anim = 'stand', y) {
    this.x = x; this.z = z; this.yaw = yaw; this.y = y !== undefined ? y : 0; this.y = W.heightAt(x, z, this.y);
    this.anim = anim; this.path = null; this.p.root.visible = true; this.p.carry = false;
  };
  NPC.prototype.sit = function (seat, anim = 'sit') { const s = W.seats[seat]; this.place(s.x, s.z, s.yaw, anim, 0); };
  NPC.prototype.hide = function () { this.p.root.visible = false; this.path = null; };
  NPC.prototype.face = function (x, z) { this.yaw = Math.atan2(x - this.x, z - this.z); };
  NPC.prototype.update = function (dt) {
    if (!this.p.root.visible) return;
    this.t += dt;
    if (this.path && this.path.length) {
      const tg = this.path[0], dx = tg.x - this.x, dz = tg.z - this.z, d = Math.hypot(dx, dz);
      const s = Math.min(d, this.speed * dt);
      if (d > 1e-4) { this.x += dx / d * s; this.z += dz / d * s; }
      let dy = Math.atan2(dx, dz) - this.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      this.yaw += dy * Math.min(1, dt * 8);
      this.stepAcc += s;
      if (this.stepAcc > 0.62) {
        this.stepAcc = 0;
        if (Math.hypot(this.x - P.x, this.z - P.z) < 18) A.npcStep(this.x, this.y, this.z, W.region(this.x, this.y, this.z) === 'out' ? 'grass' : 'wood');
      }
      if (d < 0.06) { this.path.shift(); if (!this.path.length) { this.path = null; this.anim = this.endAnim || 'stand'; const r = this.onArrive; this.onArrive = null; if (r) r(); } }
    }
    this.y = W.heightAt(this.x, this.z, this.y);
    const r = this.p.root; r.position.set(this.x, this.y, this.z); r.rotation.y = this.yaw;
    this.p.head.rotation.set(0, 0, 0);
    G.pose(this.p, this.path ? 'walk' : this.anim, this.t, 1);
    if (this.anim === 'chop' && !this.path) {
      const u = (this.t % 1.7) / 1.7;
      if (this.lastU < 0.68 && u >= 0.68) A.chop(this.x, 0.5, this.z + 0.7);
      this.lastU = u;
    }
    if (this.lookP) {
      let a = Math.atan2(camera.position.x - this.x, camera.position.z - this.z) - this.yaw;
      while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
      this.p.head.rotation.y = Math.max(-1.1, Math.min(1.1, a));
    }
  };

  // ---------- input ----------
  function lock() {
    const c = renderer.domElement; if (!c.requestPointerLock) return;
    try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }
  function bindInput() {
    $('menu').addEventListener('click', () => {
      A.init();
      if (ended) { location.reload(); return; }
      if (!started) { started = true; $('menu').style.display = 'none'; G.story(E).then(() => {}); }
      lock();
    });
    $('pause').addEventListener('click', () => { lock(); });
    document.addEventListener('pointerlockchange', () => {
      const locked = !!document.pointerLockElement;
      if (!locked && started && !ended) { paused = true; $('pause').style.display = 'flex'; }
      if (locked) { paused = false; $('pause').style.display = 'none'; }
    });
    document.addEventListener('mousemove', e => {
      if (!document.pointerLockElement || P.cine || paused) return;
      P.yaw -= e.movementX * 0.0022; P.pitch -= e.movementY * 0.0022;
      P.pitch = Math.max(-1.35, Math.min(1.35, P.pitch));
      if (P.seat) {
        let d = P.yaw - (P.seat.yaw + Math.PI); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        P.yaw = P.seat.yaw + Math.PI + Math.max(-1.3, Math.min(1.3, d));
      }
    });
    document.addEventListener('mousedown', () => { if (document.pointerLockElement && !paused) press(); });
    addEventListener('keydown', e => {
      keys[e.code] = true;
      if (paused || !started) return;
      if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && !e.repeat) press();
    });
    addEventListener('keyup', e => { keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  }
  function press() {
    if (dlg) {
      if (dlg.o.noSkip) return;
      if (dlg.shown < dlg.text.length) { dlg.shown = dlg.text.length; return; }
      closeDlg(); return;
    }
    if (focus) { const f = focus; focus = null; f.cb(); }
  }

  // ---------- dialogue ----------
  function portrait(who, mood) {
    const k = who + ':' + (mood || '');
    return portraits[k] || (portraits[k] = T.portrait(who, mood));
  }
  function openDlg() {
    const ch = G.CHARS[dlg.who], box = $('dlg');
    box.style.setProperty('--c', ch.hair);
    box.style.setProperty('--bg', G.shade(ch.hair, -0.74));
    box.style.setProperty('--bg2', G.shade(ch.hair, -0.55));
    $('dname').textContent = dlg.o.thought ? ch.name + ' (thinking)' : ch.name;
    const c = $('dport'), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height); g.drawImage(portrait(dlg.who, dlg.o.mood), 0, 0, c.width, c.height);
    $('dtext').className = (dlg.o.thought ? 'thought ' : '') + (dlg.o.yell ? 'yell' : '');
    $('dtext').textContent = ''; $('dnext').style.opacity = 0;
    box.style.display = 'flex'; box.classList.toggle('shake', !!dlg.o.yell);
    const n = npcs[dlg.who]; if (n) n.lookP = true;
  }
  function closeDlg() {
    const d = dlg; dlg = null; $('dlg').style.display = 'none';
    const n = npcs[d.who]; if (n && !n.keepLook) n.lookP = false;
    d.res();
  }
  function updateDlg(dt) {
    if (!dlg) return;
    if (dlg.shown < dlg.text.length) {
      dlg.shown = Math.min(dlg.text.length, dlg.shown + dt * (dlg.o.speed || (dlg.o.yell ? 55 : 34)));
      const n = Math.floor(dlg.shown);
      for (let i = dlg.last; i < n; i++) if (i % 2 === 0 && /\w/.test(dlg.text[i]) && !dlg.o.thought) A.blip(G.CHARS[dlg.who].pitch, dlg.o.yell);
      dlg.last = n; $('dtext').textContent = dlg.text.slice(0, n);
    } else {
      $('dnext').style.opacity = dlg.o.auto !== undefined ? 0 : 1;
      if (dlg.o.auto !== undefined) { dlg.o.auto -= dt; if (dlg.o.auto <= 0) closeDlg(); }
    }
  }

  // ---------- player ----------
  function pushOut(x, z, r, c) {
    const px = Math.max(c.x0, Math.min(x, c.x1)), pz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return [x, z];
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; return [x + dx * k, z + dz * k]; }
    const m = Math.min(x - c.x0, c.x1 - x, z - c.z0, c.z1 - z);
    if (m === x - c.x0) return [c.x0 - r, z]; if (m === c.x1 - x) return [c.x1 + r, z];
    if (m === z - c.z0) return [x, c.z0 - r]; return [x, c.z1 + r];
  }
  function resolve(x, z, y) {
    const r = 0.28, lo = y + 0.25, hi = y + 1.5;
    for (let it = 0; it < 2; it++) {
      for (const c of W.colliders) {
        if (c.on === false || c.y1 < lo || c.y0 > hi) continue;
        if (x < c.x0 - r || x > c.x1 + r || z < c.z0 - r || z > c.z1 + r) continue;
        [x, z] = pushOut(x, z, r, c);
      }
      for (const k in npcs) {
        const n = npcs[k]; if (!n.p.root.visible || Math.abs(n.y - y) > 1) continue;
        const dx = x - n.x, dz = z - n.z, d = Math.hypot(dx, dz);
        if (d < 0.5 && d > 1e-4) { x = n.x + dx / d * 0.5; z = n.z + dz / d * 0.5; }
      }
    }
    return [x, z];
  }
  function updatePlayer(dt) {
    if (P.cine) return;
    if (P.seat) {
      camera.position.set(P.seat.x, 1.16, P.seat.z);
      camera.rotation.set(P.pitch, P.yaw, 0);
      return;
    }
    if (!P.locked && !dlg) {
      const k = c => (keys[c] ? 1 : 0);
      const f = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown'), s = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft');
      const sp = (keys.ShiftLeft ? 3.4 : 2.3);
      let mx = -Math.sin(P.yaw) * f + Math.cos(P.yaw) * s, mz = -Math.cos(P.yaw) * f - Math.sin(P.yaw) * s;
      const l = Math.hypot(mx, mz);
      if (l > 0) {
        mx = mx / l * sp * dt; mz = mz / l * sp * dt;
        const ox = P.x, oz = P.z;
        [P.x, P.z] = resolve(P.x + mx, P.z + mz, P.y);
        const lim = (v, a, b) => Math.max(a, Math.min(b, v));
        const nx = lim(P.x, -28, 32), nz = lim(P.z, -26, 30);
        if (nx !== P.x || nz !== P.z) { P.x = nx; P.z = nz; if (gtime - P.warned > 8) { P.warned = gtime; E.toast("Mom says never to wander into the woods."); } }
        const moved = Math.hypot(P.x - ox, P.z - oz);
        P.bob += moved * 4.2; P.stepD += moved;
        if (P.stepD > 0.7) { P.stepD = 0; const rg = W.region(P.x, P.y, P.z); A.step(rg === 'out' ? 'grass' : rg === 'in' || (P.y > -2.7 && P.y < -0.05) ? 'wood' : 'stone'); }
      }
    }
    const ty = W.heightAt(P.x, P.z, P.y);
    P.y += (ty - P.y) * Math.min(1, dt * 14);
    camera.position.set(P.x, P.y + P.eye + Math.sin(P.bob) * 0.035, P.z);
    camera.rotation.set(P.pitch, P.yaw, 0);
  }
  function updateFocus() {
    focus = null;
    if (dlg || P.cine || !inters.size) { $('prompt').textContent = ''; return; }
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    const cp = camera.position; let bd = 0;
    for (const it of inters) {
      if (it.active && !it.active()) continue;
      const p = it.get ? it.get() : [it.x, it.y, it.z];
      const dx = p[0] - cp.x, dy = p[1] - cp.y, dz = p[2] - cp.z, d = Math.hypot(dx, dy, dz);
      if (d > (it.r || 2.3)) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / d;
      if (dot > (it.dot || 0.9) && dot > bd) { bd = dot; focus = it; }
    }
    $('prompt').textContent = focus ? '[E] ' + focus.label : '';
  }

  // ---------- loop ----------
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (started && !paused) {
      gtime += dt;
      for (let i = timers.length - 1; i >= 0; i--) if (gtime >= timers[i].t) { const r = timers[i].r; timers.splice(i, 1); r(); }
      for (let i = watchers.length - 1; i >= 0; i--) if (watchers[i].fn()) { const r = watchers[i].r; watchers.splice(i, 1); r(); }
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur);
        tw.fn(tw.ease ? tw.ease(k) : k);
        if (k >= 1) { tweens.splice(i, 1); tw.r(); }
      }
      updatePlayer(dt);
      for (const k in npcs) npcs[k].update(dt);
      updateDlg(dt);
      updateFocus();
      if (mugT > 0) { mugT -= dt; if (mugT <= 0) mug.visible = false; }
    }
    const rg = W.region(camera.position.x, camera.position.y, camera.position.z);
    const hk = rg === 'out' ? 1 : rg === 'in' ? 0.85 : 0.02;
    hemiK += (hk - hemiK) * Math.min(1, dt * 3);
    W.hemi.intensity = W.pre.hi * hemiK + (rg === 'in' ? 0.08 : 0);
    W.sun.intensity = W.pre.si;
    // Only pay for the shadow maps that can actually be seen.
    W.sun.shadow.autoUpdate = rg !== 'base';
    W.bLight.shadow.autoUpdate = rg === 'base';
    W.update(dt, rg);
    mixT -= dt;
    if (mixT <= 0 && A.ready()) {
      mixT = 0.25;
      const pre = W.pre;
      A.mix({
        wind: rg === 'out' ? pre.wind : rg === 'in' ? pre.wind * 0.25 : 0,
        room: rg === 'in' ? 0.05 : 0, fire: rg === 'in' ? pre.fire * 0.12 : 0,
        drone: rg === 'base' ? 0.14 : (E.dread || 0), flies: rg === 'base' && W.bodies.group.visible ? 0.07 : 0,
        sizzle: E.sizzle && rg === 'in' ? 0.1 : 0, droneTc: E.droneTc || 1.2
      });
    }
    if (A.ready()) { A.listener(camera); A.tick(dt, { fire: rg === 'in' ? W.pre.fire : 0, sizzle: E.sizzle && rg === 'in', birds: rg === 'out' ? W.pre.birds : 0, px: P.x, pz: P.z }); }
    renderer.render(scene, camera);
  }

  // ---------- story API ----------
  const E = G.E = {
    P, npc: npcs, get W() { return W; }, get T() { return T; }, get camera() { return camera; }, A,
    sizzle: false, dread: 0,
    wait(s) { return new Promise(r => timers.push({ t: gtime + s, r })); },
    until(fn) { return new Promise(r => watchers.push({ fn, r })); },
    tween(dur, fn, ease) { return new Promise(r => tweens.push({ t: 0, dur, fn, r, ease })); },
    objective(t) { $('obj').textContent = t || ''; $('obj').style.opacity = t ? 1 : 0; },
    toast(t, dur = 3) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(el._t); el._t = setTimeout(() => el.style.opacity = 0, dur * 1000); },
    say(who, text, o = {}) { return new Promise(res => { dlg = { who, text, o, shown: 0, last: 0, res }; openDlg(); }); },
    interact(def) {
      return new Promise(r => { const it = Object.assign({}, def, { cb: () => { inters.delete(it); r(); } }); inters.add(it); });
    },
    talk(n, label = 'Talk to ' + G.CHARS[n.key].name) {
      return E.interact({ label, r: 2.6, dot: 0.85, get: () => [n.x, n.y + G.CHARS[n.key].h * 0.85, n.z] });
    },
    walk(n, pts, speed = 1.35, endAnim = 'stand') {
      return new Promise(r => { n.path = pts.map(p => ({ x: p[0], z: p[1] })); n.speed = speed; n.endAnim = endAnim; n.onArrive = r; });
    },
    fade(to, dur = 1) {
      const el = $('fade'), from = parseFloat(el.style.opacity || 0);
      return E.tween(dur, k => el.style.opacity = from + (to - from) * k);
    },
    async title(a, b = '', dur = 3.5) {
      $('tmain').textContent = a; $('tsub').textContent = b;
      const el = $('title');
      await E.tween(0.9, k => el.style.opacity = k);
      await E.wait(dur);
      await E.tween(0.9, k => el.style.opacity = 1 - k);
    },
    setTime(n) { W.setTime(n); },
    inside() { return W.region(P.x, P.y, P.z) === 'in'; },
    look(x, y, z, dur = 0.8) {
      const cp = camera.position, dx = x - cp.x, dy = y - cp.y, dz = z - cp.z;
      const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz));
      let dyaw = ty - P.yaw; while (dyaw > Math.PI) dyaw -= 2 * Math.PI; while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      const y0 = P.yaw, p0 = P.pitch;
      return E.tween(dur, k => { P.yaw = y0 + dyaw * k; P.pitch = p0 + (tp - p0) * k; }, k => k * k * (3 - 2 * k));
    },
    sit(key) { const s = W.seats[key]; P.seat = s; P.yaw = s.yaw + Math.PI; P.pitch = -0.32; },
    stand(x, z) { P.seat = null; P.x = x; P.z = z; P.y = 0; },
    teleport(x, z, yaw, pitch = -0.2) { P.x = x; P.z = z; P.y = W.heightAt(x, z, 0); P.yaw = yaw; P.pitch = pitch; P.seat = null; },
    showMug(on, dur) { mug.visible = on; mugT = dur || 0; },
    portrait,
    chore(type, upto, label) {
      const items = W.chores[type], count = () => items.filter(c => c.done).length;
      E.objective(label(count()));
      if (count() >= upto) return Promise.resolve();
      const VERB = { water: 'Water the carrot', weed: 'Pull the weed', potato: 'Dig up the potatoes', tomato: 'Pick the tomatoes' };
      return new Promise(res => {
        const its = [];
        for (const c of items) if (!c.done) {
          const it = {
            x: c.x, y: c.y, z: c.z, r: 2.4, dot: 0.88, label: VERB[type], cb: () => {
              inters.delete(it); c.done = true; E.choreFx[type](c);
              const n = count(); E.objective(label(n));
              if (n >= upto) { its.forEach(i => inters.delete(i)); res(); }
            }
          };
          its.push(it); inters.add(it);
        }
      });
    },
    choreFx: {
      water(c) {
        A.water(); c.wet.visible = true; c.wet.material = c.wet.material.clone(); c.wet.material.transparent = true;
        E.tween(1.4, k => { c.wet.material.opacity = k; c.leaves.forEach((l, i) => { l.rotation.z = (i - 2) * 0.5 * (1 - k * 0.7); l.material = k > 0.5 ? c.leafM : l.material; }); });
      },
      weed(c) { A.pull(); E.tween(0.5, k => { c.group.position.y = 0.02 + k * 0.6; c.group.scale.setScalar(1 - k); }).then(() => c.group.visible = false); },
      potato(c) {
        A.pull(); c.tubers.forEach(t => t.visible = true);
        E.tween(0.9, k => { c.bush.rotation.z = k * 1.2; c.bush.position.y = 0.15 + Math.sin(k * Math.PI) * 0.3; c.tubers.forEach((t, i) => t.position.y = Math.sin(k * Math.PI) * (0.25 + i * 0.05)); })
          .then(() => { A.pop(); c.bush.visible = false; c.tubers.forEach(t => t.visible = false); });
      },
      tomato(c) { c.toms.forEach((t, i) => setTimeout(() => { A.squish(); t.visible = false; }, i * 180)); }
    },
    async hit() {
      P.cine = true;
      const c0 = camera.position.clone(), y0 = P.yaw, p0 = P.pitch;
      A.axeHit();
      $('hurt').style.opacity = 1; renderer.domElement.style.filter = 'blur(2px) saturate(1.4)';
      await E.tween(0.14, k => { camera.position.set(c0.x - Math.sin(y0) * 0.25 * k, c0.y - 0.1 * k, c0.z - Math.cos(y0) * 0.25 * k); camera.rotation.set(p0 - 0.5 * k, y0, 0.15 * k); });
      $('drips').style.opacity = 1;
      const c1 = camera.position.clone(), floor = P.y + 0.16;
      await E.tween(1.1, k => {
        camera.position.set(c1.x, c1.y + (floor - c1.y) * k, c1.z);
        camera.rotation.set(p0 - 0.5 + (0.55 + 0.05) * k, y0 + 2.7 * k, 0.15 + 1.2 * k);
      }, k => k * k);
      A.thud();
      renderer.domElement.style.filter = 'blur(3px) saturate(1.6) brightness(0.8)';
      $('hurt').style.opacity = 0.75;
    },
    cam(x, y, z, lx, ly, lz) { P.cine = true; camera.position.set(x, y, z); camera.lookAt(lx, ly, lz); },
    clearFx() { $('hurt').style.opacity = 0; $('drips').style.opacity = 0; renderer.domElement.style.filter = ''; },
    end() {
      ended = true; $('menu').innerHTML = `<h1>PLENTY MORE</h1><div class="sub">the end</div><div class="go">[ click to play again ]</div>`;
      $('menu').style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
    }
  };

  init();
})();
