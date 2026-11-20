// Procedural WebAudio: ambience per area, foley, voice blips, stingers, music box.
G.Audio = (function () {
  let ctx = null, master, rev, noiseBuf;
  const A = {};
  const L = {}; // loops

  const now = () => ctx.currentTime;
  function impulse(dur, decay) {
    const len = (ctx.sampleRate * dur) | 0, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function setPos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
  function at(x, y, z, ref = 2, roll = 1.2) {
    const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = roll;
    setPos(p, x, y, z); p.connect(master); return p;
  }
  function tone(freq, dur, o = {}) {
    const t = now() + (o.when || 0), osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t); if (o.freq2) osc.frequency.exponentialRampToValueAtTime(o.freq2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || master); if (o.rev) g.connect(rev);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o = {}) {
    const t = now() + (o.when || 0), s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q || 1;
    if (o.freq2) f.frequency.exponentialRampToValueAtTime(o.freq2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.dest || master); if (o.rev) g.connect(rev);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function loopNoise(type, freq, q, gain) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); s.start();
    return { g, f, base: gain };
  }

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    const conv = ctx.createConvolver(); conv.buffer = impulse(2.2, 2.6);
    rev = ctx.createGain(); rev.gain.value = 0.35; rev.connect(conv); conv.connect(master);

    L.wind = loopNoise('lowpass', 500, 0.7, 0.09); L.wind.g.connect(master);
    L.room = loopNoise('lowpass', 180, 0.5, 0.05); L.room.g.connect(master);
    // basement drone
    L.drone = { g: ctx.createGain(), base: 0.12 }; L.drone.g.gain.value = 0; L.drone.g.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.connect(L.drone.g);
    [41, 43.2, 61.7].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.3; o.connect(g); g.connect(lp); o.start(); });
    // flies (positional)
    L.fliesPan = at(-2.5, -1.8, 0.3, 0.8, 1.6);
    L.flies = { g: ctx.createGain(), base: 0.05 }; L.flies.g.gain.value = 0; L.flies.g.connect(L.fliesPan);
    const fb = ctx.createBiquadFilter(); fb.type = 'bandpass'; fb.frequency.value = 900; fb.Q.value = 2; fb.connect(L.flies.g);
    [182, 197, 211].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 3 + i * 1.7; const lg = ctx.createGain(); lg.gain.value = 18;
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(); o.connect(fb); o.start();
    });
    // sizzle (positional, stove)
    L.sizzlePan = at(-2.15, 1.0, -4.5, 1.2, 1.4);
    L.sizzle = loopNoise('highpass', 3000, 0.7, 0.12); L.sizzle.g.connect(L.sizzlePan);
    // fire crackle bed (positional, fireplace)
    L.firePan = at(5.5, 0.5, 0, 1.5, 1.3);
    L.fire = loopNoise('lowpass', 300, 0.8, 0.12); L.fire.g.connect(L.firePan);
  };
  A.ready = () => !!ctx;

  A.listener = function (cam) {
    if (!ctx) return;
    const l = ctx.listener, p = cam.position, f = new THREE.Vector3(); cam.getWorldDirection(f);
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  };
  const set = (lp, v, tc = 0.6) => { if (ctx) lp.g.gain.setTargetAtTime(v, now(), tc); };
  A.mix = function (o) {
    if (!ctx) return;
    set(L.wind, o.wind || 0); set(L.room, o.room || 0); set(L.drone, o.drone || 0, o.droneTc || 1.2);
    set(L.flies, o.flies || 0); set(L.sizzle, o.sizzle || 0, 0.3); set(L.fire, o.fire || 0);
  };
  let crackT = 0, birdT = 2;
  A.tick = function (dt, o) {
    if (!ctx) return;
    crackT -= dt;
    if (o.fire && crackT <= 0) { crackT = 0.05 + Math.random() * 0.4; noise(0.03, { type: 'highpass', freq: 2500, gain: 0.04 * o.fire * Math.random(), dest: L.firePan }); }
    if (o.sizzle && Math.random() < dt * 14) noise(0.02, { type: 'highpass', freq: 5000, gain: 0.03, dest: L.sizzlePan });
    birdT -= dt;
    if (o.birds && birdT <= 0) {
      birdT = 3 + Math.random() * 7;
      const p = at(o.px + (Math.random() - 0.5) * 50, 8, o.pz + (Math.random() - 0.5) * 50, 6, 0.8), f = 2200 + Math.random() * 1800;
      for (let i = 0; i < 2 + (Math.random() * 4 | 0); i++) tone(f * (1 + Math.random() * 0.2), 0.09, { freq2: f * 1.4, gain: 0.05 * o.birds, when: i * 0.13, dest: p });
    }
  };

  A.step = function (surface) {
    if (!ctx) return;
    if (surface === 'grass') noise(0.12, { type: 'bandpass', freq: 2200, q: 0.8, gain: 0.05, attack: 0.02 });
    else if (surface === 'wood') { tone(110, 0.09, { freq2: 70, gain: 0.12 }); noise(0.05, { freq: 900, gain: 0.05 }); if (Math.random() < 0.15) tone(320, 0.25, { type: 'triangle', freq2: 260, gain: 0.015, attack: 0.05 }); }
    else { noise(0.06, { type: 'bandpass', freq: 1800, q: 1.5, gain: 0.08, rev: true }); tone(90, 0.06, { gain: 0.06 }); }
  };
  A.npcStep = function (x, y, z, surface) {
    if (!ctx) return;
    const p = at(x, y, z, 1.5, 1.4);
    if (surface === 'grass') noise(0.12, { type: 'bandpass', freq: 2000, gain: 0.05, attack: 0.02, dest: p });
    else { tone(100, 0.08, { freq2: 65, gain: 0.12, dest: p }); noise(0.05, { freq: 800, gain: 0.04, dest: p }); }
  };
  A.blip = function (pitch, loud) {
    if (!ctx) return;
    tone(pitch * (0.92 + Math.random() * 0.16), 0.05, { type: 'square', gain: loud ? 0.06 : 0.025 });
  };
  A.chop = function (x, y, z, muffled) {
    if (!ctx) return;
    const p = at(x, y, z, muffled ? 4 : 3, 1);
    let d = p;
    if (muffled) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350; f.connect(p); d = f; }
    tone(170, 0.18, { freq2: 60, gain: muffled ? 0.5 : 0.4, dest: d });
    noise(0.12, { freq: muffled ? 500 : 2500, type: 'lowpass', gain: muffled ? 0.4 : 0.3, dest: d });
    if (muffled) noise(0.15, { freq: 300, gain: 0.25, when: 0.03, dest: d });
  };
  A.water = function () {
    if (!ctx) return;
    for (let i = 0; i < 6; i++) noise(0.35, { type: 'bandpass', freq: 1200 + Math.random() * 1200, q: 3, gain: 0.08, when: i * 0.18, attack: 0.05 });
  };
  A.pull = function () {
    if (!ctx) return;
    noise(0.25, { type: 'bandpass', freq: 700, q: 1, gain: 0.18, freq2: 2000, attack: 0.05 });
    tone(300, 0.08, { freq2: 600, gain: 0.05, when: 0.22 });
  };
  A.squish = function () { if (ctx) { noise(0.15, { type: 'lowpass', freq: 900, gain: 0.2 }); tone(220, 0.1, { freq2: 120, gain: 0.06 }); } };
  A.sip = function () { if (ctx) noise(0.5, { type: 'bandpass', freq: 1800, q: 4, gain: 0.05, attack: 0.15 }); };
  A.chew = function () {
    if (!ctx) return;
    for (let i = 0; i < 4; i++) noise(0.12, { type: 'lowpass', freq: 600 + Math.random() * 400, gain: 0.12, when: i * 0.28, attack: 0.03 });
    tone(800, 0.05, { type: 'triangle', gain: 0.03 });
  };
  A.clink = function () { if (ctx) { tone(2600, 0.3, { gain: 0.04 }); tone(3400, 0.25, { gain: 0.02 }); } };
  A.creak = function (x, y, z) {
    if (!ctx) return;
    const p = at(x, y, z, 2, 1);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 6; f.connect(p);
    tone(140, 1.1, { type: 'sawtooth', freq2: 95, gain: 0.25, attack: 0.1, dest: f });
    tone(210, 0.9, { type: 'sawtooth', freq2: 170, gain: 0.12, attack: 0.15, dest: f });
  };
  A.doorShut = function (x, y, z) { if (ctx) { const p = at(x, y, z, 2, 1); tone(80, 0.3, { freq2: 45, gain: 0.5, dest: p }); noise(0.1, { freq: 1500, gain: 0.2, dest: p }); } };
  A.locked = function () { if (!ctx) return; for (let i = 0; i < 3; i++) { noise(0.05, { type: 'bandpass', freq: 3000, q: 4, gain: 0.15, when: i * 0.09 }); tone(900, 0.04, { type: 'square', gain: 0.02, when: i * 0.09 }); } };
  A.pop = function () { if (ctx) tone(500, 0.12, { freq2: 900, gain: 0.06, type: 'triangle' }); };
  A.whoosh = function () { if (ctx) noise(1.2, { type: 'bandpass', freq: 300, q: 0.8, gain: 0.12, attack: 0.4, freq2: 900 }); };
  A.heartbeat = function (v) { if (ctx) { tone(55, 0.16, { gain: 0.6 * v, freq2: 33 }); tone(50, 0.2, { gain: 0.42 * v, freq2: 30, when: 0.22 }); } };
  A.sting = function () {
    if (!ctx) return;
    const ws = ctx.createWaveShaper(), curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 3);
    ws.curve = curve; ws.connect(master); ws.connect(rev);
    [233, 247, 349, 370, 494].forEach(f => tone(f, 3.2, { type: 'sawtooth', gain: 0.045, attack: 0.25, freq2: f * 0.96, dest: ws }));
    noise(2.5, { type: 'bandpass', freq: 3200, q: 6, gain: 0.12, attack: 0.3, freq2: 1800 });
    tone(38, 3, { gain: 0.6, freq2: 30, attack: 0.1 });
  };
  A.axeHit = function () {
    if (!ctx) return;
    noise(0.35, { type: 'highpass', freq: 800, gain: 1.0 });
    noise(0.6, { type: 'lowpass', freq: 400, gain: 0.9 });
    tone(55, 1.2, { gain: 1.0, freq2: 25 });
    tone(140, 0.25, { type: 'square', freq2: 50, gain: 0.3 });
    noise(0.3, { type: 'bandpass', freq: 600, q: 2, gain: 0.5, when: 0.05 });
    tone(3600, 7, { gain: 0.05, attack: 0.3, when: 0.4 });
    tone(3640, 7, { gain: 0.03, attack: 0.4, when: 0.4 });
  };
  A.thud = function () { if (ctx) { tone(45, 0.8, { gain: 0.8, freq2: 28 }); noise(0.3, { freq: 200, gain: 0.5 }); } };
  A.musicBox = function (dur) {
    if (!ctx) return;
    const notes = [76, 74, 72, 71, 72, 69, 0, 64, 69, 71, 72, 74, 71, 0, 76, 74, 72, 71, 72, 69, 68, 69];
    const step = 0.42;
    for (let i = 0, t = 0; t < dur; i++, t += step) {
      const n = notes[i % notes.length]; if (!n) continue;
      const f = 440 * Math.pow(2, (n - 69) / 12) * (1 - t * 0.0025);
      tone(f, 1.4, { gain: 0.05, when: t, rev: true }); tone(f * 2.01, 0.6, { gain: 0.012, when: t, type: 'triangle' });
    }
  };
  A.stopAll = function () { A.mix({}); };
  return A;
})();
