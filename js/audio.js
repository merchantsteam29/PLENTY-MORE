// Procedural WebAudio: ambience beds, foley, voice (recorded files when available, synthesized murmur otherwise), music.
G.Audio = (function () {
  let ctx = null, master, sfx, musicBus, voiceBus, rev, noiseBuf, comp;
  const A = { vol: { master: 0.9, music: 0.7, voice: 1 } };
  const L = {};
  const now = () => ctx.currentTime;
  const web = /^https?:/.test(location.protocol);
  function impulse(dur, decay) { const len = (ctx.sampleRate * dur) | 0, b = ctx.createBuffer(2, len, ctx.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
  function setPos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
  function at(x, y, z, ref = 2, roll = 1.2, dest) { const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = roll; setPos(p, x, y, z); p.connect(dest || sfx); return p; }
  function tone(freq, dur, o = {}) {
    const t = now() + (o.when || 0), osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t); if (o.freq2) osc.frequency.exponentialRampToValueAtTime(o.freq2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || sfx); if (o.rev) g.connect(rev); osc.start(t); osc.stop(t + dur + 0.05); return osc;
  }
  function noise(dur, o = {}) {
    const t = now() + (o.when || 0), s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1000, t); f.Q.value = o.q || 1; if (o.freq2) f.frequency.exponentialRampToValueAtTime(o.freq2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.dest || sfx); if (o.rev) g.connect(rev); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function loopNoise(type, freq, q, dest) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(dest || sfx); s.start(); return { g, f }; }

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = A.vol.master;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master); musicBus = ctx.createGain(); musicBus.gain.value = A.vol.music; musicBus.connect(master); voiceBus = ctx.createGain(); voiceBus.gain.value = A.vol.voice; voiceBus.connect(master);
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    const conv = ctx.createConvolver(); conv.buffer = impulse(2.4, 2.6); rev = ctx.createGain(); rev.gain.value = 0.3; rev.connect(conv); conv.connect(master);
    L.wind = loopNoise('lowpass', 500, 0.7); L.room = loopNoise('lowpass', 160, 0.5); L.rain = loopNoise('bandpass', 2400, 0.4); L.rainIn = loopNoise('lowpass', 700, 0.6);
    L.drone = { g: ctx.createGain() }; L.drone.g.gain.value = 0; L.drone.g.connect(sfx);
    { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.connect(L.drone.g); [41, 43.2, 61.7].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.3; o.connect(g); g.connect(lp); o.start(); }); }
    L.fliesPan = at(-6.3, -1.8, 2.1, 0.8, 1.6); L.flies = { g: ctx.createGain() }; L.flies.g.gain.value = 0; L.flies.g.connect(L.fliesPan);
    { const fb = ctx.createBiquadFilter(); fb.type = 'bandpass'; fb.frequency.value = 900; fb.Q.value = 2; fb.connect(L.flies.g); [182, 197, 211].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lfo = ctx.createOscillator(); lfo.frequency.value = 3 + i * 1.7; const lg = ctx.createGain(); lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency); lfo.start(); o.connect(fb); o.start(); }); }
    L.genPan = at(-1.75, -2.6, -0.05, 3, 0.8); L.gen = { g: ctx.createGain() }; L.gen.g.gain.value = 0; L.gen.g.connect(L.genPan);
    { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.connect(L.gen.g); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58; const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 29.3; const g2 = ctx.createGain(); g2.gain.value = 0.3; o.connect(lp); o2.connect(g2); g2.connect(lp); o.start(); o2.start(); const n = loopNoise('bandpass', 180, 1.2, lp); n.g.gain.value = 0.5; }
    L.sizzlePan = at(0.65, 1.0, -6.45, 1.2, 1.4); L.sizzle = loopNoise('highpass', 3000, 0.7, L.sizzlePan);
    L.firePan = at(9.3, 0.5, 1.5, 1.5, 1.3); L.fire = loopNoise('lowpass', 300, 0.8, L.firePan);
    L.crickets = { g: ctx.createGain() }; L.crickets.g.gain.value = 0; L.crickets.g.connect(sfx);
    { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4400; bp.Q.value = 8; bp.connect(L.crickets.g); const o = ctx.createOscillator(); o.frequency.value = 4400; const am = ctx.createGain(); am.gain.value = 0; const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 22; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain); const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.7; const lg2 = ctx.createGain(); lg2.gain.value = 0.5; lfo2.connect(lg2); lg2.connect(am.gain); o.connect(am); am.connect(bp); o.start(); lfo.start(); lfo2.start(); }
  };
  A.ready = () => !!ctx;
  A.ctx = () => ctx;
  A.setVol = (k, v) => { A.vol[k] = v; if (!ctx) return; if (k === 'master') master.gain.value = v; if (k === 'music') musicBus.gain.value = v; if (k === 'voice') voiceBus.gain.value = v; };
  A.listener = function (cam) {
    if (!ctx) return; const l = ctx.listener, p = cam.position, f = A._f || (A._f = new THREE.Vector3()); cam.getWorldDirection(f);
    if (l.positionX) { l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z; l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  };
  const set = (lp, v, tc = 0.6) => { if (ctx) lp.g.gain.setTargetAtTime(v, now(), tc); };
  A.mix = function (o) {
    if (!ctx) return;
    set(L.wind, o.wind || 0); set(L.room, o.room || 0); set(L.drone, o.drone || 0, o.droneTc || 1.2); set(L.flies, o.flies || 0); set(L.sizzle, o.sizzle || 0, 0.3);
    set(L.fire, o.fire || 0); set(L.rain, o.rain || 0, 1.5); set(L.rainIn, o.rainIn || 0, 1.5); set(L.gen, o.gen || 0, 0.8); set(L.crickets, o.crickets || 0, 2);
  };
  let crackT = 0, birdT = 2, owlT = 20, creakT = 8;
  A.tick = function (dt, o) {
    if (!ctx) return;
    crackT -= dt; if (o.fire && crackT <= 0) { crackT = 0.05 + Math.random() * 0.4; noise(0.03, { type: 'highpass', freq: 2500, gain: 0.04 * o.fire * Math.random() + 0.001, dest: L.firePan }); }
    if (o.sizzle && Math.random() < dt * 14) noise(0.02, { type: 'highpass', freq: 5000, gain: 0.03, dest: L.sizzlePan });
    birdT -= dt; if (o.birds && birdT <= 0) { birdT = 3 + Math.random() * 7; const p = at(o.px + (Math.random() - 0.5) * 50, 8, o.pz + (Math.random() - 0.5) * 50, 6, 0.8), f = 2200 + Math.random() * 1800; for (let i = 0; i < 2 + (Math.random() * 4 | 0); i++) tone(f * (1 + Math.random() * 0.2), 0.09, { freq2: f * 1.4, gain: 0.05 * o.birds, when: i * 0.13, dest: p }); }
    owlT -= dt; if (o.night && owlT <= 0) { owlT = 25 + Math.random() * 30; const p = at(o.px + (Math.random() - 0.5) * 80, 10, o.pz + (Math.random() - 0.5) * 80, 8, 0.6); tone(390, 0.35, { freq2: 360, gain: 0.05, attack: 0.08, dest: p }); tone(380, 0.6, { freq2: 330, gain: 0.05, attack: 0.1, when: 0.5, dest: p }); }
    creakT -= dt; if (o.inside && o.night && creakT <= 0) { creakT = 9 + Math.random() * 18; const p = at(o.px + (Math.random() - 0.5) * 10, o.py + 2, o.pz + (Math.random() - 0.5) * 10, 2, 1); tone(180 + Math.random() * 80, 0.6, { type: 'sawtooth', freq2: 120, gain: 0.02, attack: 0.15, dest: p }); }
    if (o.rain && Math.random() < dt * 8) noise(0.02, { type: 'highpass', freq: 3000, gain: 0.02 * o.rain });
  };

  // ---------------- foley ----------------
  A.step = function (surface, vol = 1) {
    if (!ctx) return;
    if (surface === 'grass') noise(0.13, { type: 'bandpass', freq: 2200, q: 0.8, gain: 0.05 * vol, attack: 0.02 });
    else if (surface === 'dirt') { noise(0.1, { type: 'bandpass', freq: 1300, q: 0.9, gain: 0.06 * vol, attack: 0.01 }); noise(0.05, { freq: 500, gain: 0.04 * vol }); }
    else if (surface === 'gravel') { for (let i = 0; i < 3; i++) noise(0.04, { type: 'bandpass', freq: 2500 + Math.random() * 2000, q: 2, gain: 0.05 * vol, when: i * 0.02 }); }
    else if (surface === 'wood') { tone(110, 0.09, { freq2: 70, gain: 0.12 * vol }); noise(0.05, { freq: 900, gain: 0.05 * vol }); if (Math.random() < 0.15) tone(320, 0.25, { type: 'triangle', freq2: 260, gain: 0.015, attack: 0.05 }); }
    else { noise(0.06, { type: 'bandpass', freq: 1800, q: 1.5, gain: 0.08 * vol, rev: true }); tone(90, 0.06, { gain: 0.06 * vol }); }
  };
  A.npcStep = function (x, y, z, surface) {
    if (!ctx) return; const p = at(x, y, z, 1.5, 1.4);
    if (surface === 'grass' || surface === 'dirt') noise(0.12, { type: 'bandpass', freq: surface === 'grass' ? 2000 : 1200, gain: 0.05, attack: 0.02, dest: p });
    else { tone(100, 0.08, { freq2: 65, gain: 0.12, dest: p }); noise(0.05, { freq: 800, gain: 0.04, dest: p }); }
  };
  A.chop = function (x, y, z, muffled) {
    if (!ctx) return; const p = at(x, y, z, muffled ? 4 : 3, 1); let d = p;
    if (muffled) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350; f.connect(p); d = f; }
    tone(170, 0.18, { freq2: 60, gain: muffled ? 0.5 : 0.4, dest: d }); noise(0.12, { freq: muffled ? 500 : 2500, type: 'lowpass', gain: muffled ? 0.4 : 0.3, dest: d });
    if (muffled) noise(0.15, { freq: 300, gain: 0.25, when: 0.03, dest: d }); else { noise(0.25, { type: 'bandpass', freq: 700, q: 2, gain: 0.12, when: 0.04, dest: d }); }
  };
  A.split = function () { if (!ctx) return; tone(140, 0.2, { freq2: 50, gain: 0.45 }); noise(0.18, { freq: 2200, gain: 0.35 }); noise(0.3, { type: 'bandpass', freq: 900, q: 3, gain: 0.15, when: 0.05 }); tone(320, 0.15, { type: 'triangle', freq2: 200, gain: 0.08, when: 0.12 }); };
  A.water = function () { if (!ctx) return; for (let i = 0; i < 8; i++) noise(0.35, { type: 'bandpass', freq: 1200 + Math.random() * 1200, q: 3, gain: 0.08, when: i * 0.16, attack: 0.05 }); };
  A.pump = function () { if (!ctx) return; tone(520 + Math.random() * 80, 0.25, { type: 'sawtooth', freq2: 380, gain: 0.03, attack: 0.05 }); noise(0.3, { type: 'bandpass', freq: 600, q: 2, gain: 0.08, when: 0.2 }); };
  A.splash = function () { if (!ctx) return; noise(0.6, { type: 'bandpass', freq: 900, q: 0.8, gain: 0.2, attack: 0.02, freq2: 400 }); };
  A.pull = function () { if (!ctx) return; noise(0.25, { type: 'bandpass', freq: 700, q: 1, gain: 0.18, freq2: 2000, attack: 0.05 }); tone(300, 0.08, { freq2: 600, gain: 0.05, when: 0.22 }); };
  A.dig = function () { if (!ctx) return; noise(0.2, { type: 'lowpass', freq: 800, gain: 0.25 }); noise(0.15, { type: 'bandpass', freq: 400, gain: 0.2, when: 0.1 }); };
  A.squish = function () { if (!ctx) return; noise(0.15, { type: 'lowpass', freq: 900, gain: 0.2 }); tone(220, 0.1, { freq2: 120, gain: 0.06 }); };
  A.pick = function () { if (!ctx) return; noise(0.08, { type: 'highpass', freq: 3000, gain: 0.08 }); tone(900, 0.06, { freq2: 1400, gain: 0.02 }); };
  A.sip = function () { if (!ctx) return; noise(0.5, { type: 'bandpass', freq: 1800, q: 4, gain: 0.05, attack: 0.15 }); };
  A.chew = function () { if (!ctx) return; for (let i = 0; i < 5; i++) noise(0.12, { type: 'lowpass', freq: 600 + Math.random() * 400, gain: 0.12, when: i * 0.26, attack: 0.03 }); tone(800, 0.05, { type: 'triangle', gain: 0.03 }); };
  A.clink = function () { if (!ctx) return; tone(2600, 0.3, { gain: 0.04 }); tone(3400, 0.25, { gain: 0.02 }); };
  A.creak = function (x, y, z) { if (!ctx) return; const p = at(x, y, z, 2, 1); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 6; f.connect(p); tone(140, 1.1, { type: 'sawtooth', freq2: 95, gain: 0.22, attack: 0.1, dest: f }); tone(210, 0.9, { type: 'sawtooth', freq2: 170, gain: 0.1, attack: 0.15, dest: f }); };
  A.doorShut = function (x, y, z) { if (!ctx) return; const p = at(x, y, z, 2, 1); tone(80, 0.3, { freq2: 45, gain: 0.45, dest: p }); noise(0.1, { freq: 1500, gain: 0.2, dest: p }); };
  A.locked = function () { if (!ctx) return; for (let i = 0; i < 3; i++) { noise(0.05, { type: 'bandpass', freq: 3000, q: 4, gain: 0.15, when: i * 0.09 }); tone(900, 0.04, { type: 'square', gain: 0.02, when: i * 0.09 }); } };
  A.pop = function () { if (!ctx) return; tone(500, 0.12, { freq2: 900, gain: 0.06, type: 'triangle' }); };
  A.page = function () { if (!ctx) return; noise(0.25, { type: 'highpass', freq: 2500, gain: 0.07, attack: 0.05, freq2: 5000 }); };
  A.buzz = function (x, y, z) { if (!ctx) return; const p = x !== undefined ? at(x, y, z, 1, 1.2) : sfx; for (let i = 0; i < 2; i++) { tone(175, 0.3, { type: 'square', gain: 0.03, when: i * 0.45, dest: p }); noise(0.3, { type: 'bandpass', freq: 175, q: 4, gain: 0.08, when: i * 0.45, dest: p }); } };
  A.chime = function () { if (!ctx) return; tone(1318, 0.5, { gain: 0.04 }); tone(1760, 0.6, { gain: 0.03, when: 0.12 }); };
  A.radio = function (dur = 3) { if (!ctx) return; noise(dur, { type: 'bandpass', freq: 1800, q: 0.5, gain: 0.12, attack: 0.1 }); for (let i = 0; i < 8; i++) tone(600 + Math.random() * 900, 0.05, { type: 'square', gain: 0.01, when: Math.random() * dur }); };
  A.whoosh = function () { if (!ctx) return; noise(1.2, { type: 'bandpass', freq: 300, q: 0.8, gain: 0.12, attack: 0.4, freq2: 900 }); };
  A.heartbeat = function (v) { if (!ctx) return; tone(55, 0.16, { gain: 0.6 * v, freq2: 33 }); tone(50, 0.2, { gain: 0.42 * v, freq2: 30, when: 0.22 }); };
  A.thunderish = function () { if (!ctx) return; noise(3, { type: 'lowpass', freq: 200, gain: 0.3, attack: 0.3, freq2: 60 }); };
  A.scrape = function (x, y, z) { if (!ctx) return; const p = x !== undefined ? at(x, y, z, 1.5, 1.2) : sfx; noise(0.45, { type: 'bandpass', freq: 3800, q: 3, gain: 0.07, attack: 0.15, freq2: 2600, dest: p }); };
  A.knock = function () { if (!ctx) return; for (let i = 0; i < 3; i++) { tone(130, 0.12, { freq2: 70, gain: 0.35, when: i * 0.22 }); noise(0.05, { freq: 1200, gain: 0.15, when: i * 0.22 }); } };
  A.drip = function (x, y, z) { if (!ctx) return; const p = at(x, y, z, 1, 1.3); tone(1400 + Math.random() * 400, 0.08, { freq2: 600, gain: 0.04, dest: p }); };
  A.plastic = function () { if (!ctx) return; for (let i = 0; i < 10; i++) noise(0.08, { type: 'highpass', freq: 2500 + Math.random() * 3000, gain: 0.07, when: i * 0.06 }); };
  A.sting = function () {
    if (!ctx) return; const ws = ctx.createWaveShaper(), curve = new Float32Array(256); for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 3); ws.curve = curve; ws.connect(sfx); ws.connect(rev);
    [233, 247, 349, 370, 494].forEach(f => tone(f, 3.2, { type: 'sawtooth', gain: 0.045, attack: 0.25, freq2: f * 0.96, dest: ws }));
    noise(2.5, { type: 'bandpass', freq: 3200, q: 6, gain: 0.12, attack: 0.3, freq2: 1800 }); tone(38, 3, { gain: 0.6, freq2: 30, attack: 0.1 });
  };
  A.axeHit = function () {
    if (!ctx) return; noise(0.35, { type: 'highpass', freq: 800, gain: 1.0 }); noise(0.6, { type: 'lowpass', freq: 400, gain: 0.9 }); tone(55, 1.2, { gain: 1.0, freq2: 25 });
    tone(140, 0.25, { type: 'square', freq2: 50, gain: 0.3 }); noise(0.3, { type: 'bandpass', freq: 600, q: 2, gain: 0.5, when: 0.05 }); tone(3600, 7, { gain: 0.05, attack: 0.3, when: 0.4 }); tone(3640, 7, { gain: 0.03, attack: 0.4, when: 0.4 });
  };
  A.thud = function () { if (!ctx) return; tone(45, 0.8, { gain: 0.8, freq2: 28 }); noise(0.3, { freq: 200, gain: 0.5 }); };

  // ---------------- music ----------------
  const BOX = [76, 74, 72, 71, 72, 69, 0, 64, 69, 71, 72, 74, 71, 0, 76, 74, 72, 71, 72, 69, 68, 69];
  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
  A.musicBox = function (dur, o = {}) {
    if (!ctx) return; const step = o.step || 0.42;
    for (let i = 0, t = 0; t < dur; i++, t += step) { const n = BOX[i % BOX.length]; if (!n) continue; const f = mtof(n) * (1 - t * (o.detune || 0.0025)); tone(f, 1.4, { gain: 0.05, when: t, rev: true, dest: musicBus }); tone(f * 2.01, 0.6, { gain: 0.012, when: t, type: 'triangle', dest: musicBus }); }
  };
  // Mom humming the music-box tune (formant-filtered, positional)
  A.hum = function (x, y, z, bars = 1) {
    if (!ctx) return; const p = at(x, y, z, 1.5, 1.1), f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 450; f1.Q.value = 3; f1.connect(p); const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 900; f2.Q.value = 5; f2.connect(p);
    const step = 0.5, notes = BOX.slice(0, 14 * bars);
    notes.forEach((n, i) => { if (!n) return; const t = now() + i * step, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(n - 12), t); o.frequency.linearRampToValueAtTime(mtof(n - 12) * 1.01, t + step);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + step * 0.95); o.connect(g); g.connect(f1); g.connect(f2); o.start(t); o.stop(t + step); });
  };
  let musicNodes = [], musicName = null;
  A.music = function (name) {
    if (!ctx || name === musicName) return; musicName = name;
    const t = now(); musicNodes.forEach(n => { try { n.g.gain.setTargetAtTime(0, t, 1.5); n.stop(t + 6); } catch (e) { /* ignore */ } }); musicNodes = [];
    if (!name) return;
    const chords = { home: [[57, 64, 69, 72], [53, 60, 65, 69], [55, 62, 67, 71], [52, 59, 64, 67]], unease: [[57, 60, 63, 68], [56, 59, 62, 67]], dread: [[45, 46, 52, 58]] }[name];
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(name === 'dread' ? 0.07 : 0.045, t, 3); g.connect(musicBus); g.connect(rev);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = name === 'home' ? 1400 : 700; lp.connect(g);
    const oscs = []; for (let i = 0; i < 4; i++) for (const d of [-4, 4]) { const o = ctx.createOscillator(); o.type = name === 'dread' ? 'sawtooth' : 'triangle'; o.detune.value = d; o.connect(lp); o.start(); oscs.push([o, i]); }
    const node = { g, stop: (w) => oscs.forEach(([o]) => o.stop(w)) }; musicNodes.push(node);
    let ci = 0; const per = name === 'home' ? 6 : 9;
    const step = () => { if (!musicNodes.includes(node)) return; const ch = chords[ci % chords.length]; ci++; const tt = now(); oscs.forEach(([o, i]) => o.frequency.setTargetAtTime(mtof(ch[i] - (name === 'dread' ? 12 : 0)), tt, 0.8));
      if (name === 'home') for (let k = 0; k < 3; k++) { const n = ch[(k * 2 + ci) % 4] + 12; tone(mtof(n), 2.2, { gain: 0.025, when: k * 1.9 + 0.3, rev: true, dest: musicBus }); tone(mtof(n) * 2, 0.8, { gain: 0.006, when: k * 1.9 + 0.3, type: 'triangle', dest: musicBus }); }
      setTimeout(step, per * 1000); };
    step();
  };

  // ---------------- voice ----------------
  // Recorded lines: voice/manifest.js sets G.VOICE_FILES = { "<id>": "file.mp3" }.
  A.hasVoice = id => !!(G.VOICE_FILES && G.VOICE_FILES[id]);
  A.voice = function (id, pos) {
    const file = G.VOICE_FILES && G.VOICE_FILES[id]; if (!file) return null;
    const el = new Audio('voice/' + file); el.preload = 'auto';
    const h = { el, done: false, lvl: 0, analyser: null, data: null, stop() { try { el.pause(); } catch (e) { /* ignore */ } h.done = true; } };
    el.addEventListener('ended', () => (h.done = true)); el.addEventListener('error', () => (h.done = true));
    if (ctx && web) {
      try { const src = ctx.createMediaElementSource(el), an = ctx.createAnalyser(); an.fftSize = 256; h.analyser = an; h.data = new Uint8Array(an.fftSize); const dest = pos ? at(pos.x, pos.y, pos.z, 2, 0.6, voiceBus) : voiceBus; src.connect(an); an.connect(dest); } catch (e) { el.volume = A.vol.voice; }
    } else el.volume = A.vol.voice * A.vol.master;
    el.play().catch(() => (h.done = true));
    h.level = () => { if (h.done) return 0; if (h.analyser) { h.analyser.getByteTimeDomainData(h.data); let s = 0; for (let i = 0; i < h.data.length; i++) { const v = (h.data[i] - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / h.data.length) * 5); } return el.paused ? 0 : 0.35 + 0.35 * Math.sin(performance.now() * 0.03); };
    return h;
  };
  // Synthesized murmur: one formant-filtered syllable per call, pitched per character.
  const VOW = [[800, 1200], [400, 2200], [300, 2700], [500, 900], [350, 800], [650, 1700]];
  A.syllable = function (who, o = {}) {
    if (!ctx) return; const ch = G.CHARS[who]; if (!ch) return; const v = ch.voice, t = now(), dur = o.yell ? 0.13 : 0.1, f0 = v.f0 * (o.yell ? 1.35 : 1) * (0.94 + Math.random() * 0.12), vw = VOW[(Math.random() * VOW.length) | 0];
    const dest = o.pos ? at(o.pos.x, o.pos.y, o.pos.z, 2, 0.8, voiceBus) : voiceBus;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f0, t); osc.frequency.linearRampToValueAtTime(f0 * (o.q ? 1.12 : 0.95), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((o.yell ? 0.16 : o.whisper ? 0.03 : 0.07), t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = vw[0] * v.form; b1.Q.value = 4; const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = vw[1] * v.form; b2.Q.value = 6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.thought ? 900 : 3500;
    osc.connect(b1); osc.connect(b2); b1.connect(g); b2.connect(g); g.connect(lp); lp.connect(dest); osc.start(t); osc.stop(t + dur + 0.02);
    if (Math.random() < 0.35) noise(0.03, { type: 'highpass', freq: 3500, gain: o.yell ? 0.03 : 0.012, dest });
  };
  A.stopAll = function () { A.mix({}); A.music(null); };
  return A;
})();
