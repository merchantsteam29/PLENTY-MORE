// Procedural textures, faces and pixel portraits. Everything is drawn once at load.
window.G = window.G || {};

G.CHARS = {
  leon:  { name: 'Leon',  hair: '#2f7dff', skin: '#f1c9a8', iris: '#2d5aa0', shirt: '#b8652a', pants: '#3a4252', h: 1.5,  style: 'spiky', pitch: 560 },
  luke:  { name: 'Luke',  hair: '#7a1212', skin: '#e2b391', iris: '#4a3a2a', shirt: '#5a2f2a', pants: '#2b2f3a', h: 1.86, style: 'messy', pitch: 170 },
  lily:  { name: 'Lily',  hair: '#ff6fb8', skin: '#f4cdb3', iris: '#5a7a4a', shirt: '#d9c8ea', pants: '#3d3654', h: 1.68, style: 'long',  pitch: 640, female: true },
  rose:  { name: 'Rose',  hair: '#2fbf5a', skin: '#efc6a4', iris: '#6a4a2a', shirt: '#4f6a94', pants: '#2c2c30', h: 1.6,  style: 'bob',   pitch: 500, female: true },
  linda: { name: 'Mom',   hair: '#6b4426', skin: '#e8bf9e', iris: '#3a2a1a', shirt: '#6e5a4a', pants: '#4e4038', h: 1.7,  style: 'bun',   pitch: 300, female: true, skirt: '#5c4a3c', apron: true }
};

G.shade = function (hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
};

G.makeTextures = function () {
  let sd = 98765;
  const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, nearest) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    return t;
  };
  const noise = (g, w, h, amt) => {
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) { const n = (R() - 0.5) * amt; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
    g.putImageData(d, 0, 0);
  };
  const blob = (g, x, y, r, col) => {
    g.fillStyle = col; g.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2, rr = r * (0.75 + R() * 0.45);
      i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.fill();
  };
  const T = {};

  { const [c, g] = cv(128, 128); g.fillStyle = '#4b6a2b'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1400; i++) {
      const x = R() * 128, y = R() * 128;
      g.strokeStyle = `hsl(${78 + R() * 30},${30 + R() * 30}%,${18 + R() * 26}%)`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y - 2 - R() * 5); g.stroke();
    }
    noise(g, 128, 128, 14); T.grass = tex(c); }

  { const [c, g] = cv(128, 128); g.fillStyle = '#3a281a'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) blob(g, R() * 128, R() * 128, 1 + R() * 3.5, R() < 0.5 ? '#2a1c11' : '#4d3725');
    noise(g, 128, 128, 22); T.soil = tex(c); }

  { const [c, g] = cv(128, 128);
    for (let i = 0; i < 4; i++) {
      const y0 = i * 32, gr = g.createLinearGradient(0, y0, 0, y0 + 32);
      const base = 0.85 + R() * 0.25;
      gr.addColorStop(0, G.shade('#3e2814', 0)); gr.addColorStop(0.18, G.shade('#7a5230', base - 1));
      gr.addColorStop(0.5, G.shade('#9a6c40', base - 1)); gr.addColorStop(0.85, G.shade('#6a4526', 0)); gr.addColorStop(1, '#2a1a0c');
      g.fillStyle = gr; g.fillRect(0, y0, 128, 32);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(40,25,10,${0.2 + R() * 0.3})`; g.fillRect(R() * 128, y0 + 4 + R() * 24, 6 + R() * 20, 1); }
      if (R() < 0.6) { g.fillStyle = 'rgba(50,30,12,0.7)'; g.beginPath(); g.ellipse(R() * 128, y0 + 16, 4, 3, 0, 0, 7); g.fill(); }
    }
    noise(g, 128, 128, 12); T.logs = tex(c); }

  { const [c, g] = cv(128, 128);
    for (let i = 0; i < 4; i++) {
      const x0 = i * 32, t = R();
      g.fillStyle = `hsl(28,${38 + t * 12}%,${26 + t * 10}%)`; g.fillRect(x0, 0, 32, 128);
      for (let k = 0; k < 9; k++) {
        g.strokeStyle = `rgba(30,15,5,${0.15 + R() * 0.25})`; g.beginPath();
        const bx = x0 + 3 + R() * 26;
        for (let y = 0; y <= 128; y += 8) g.lineTo(bx + Math.sin(y * 0.08 + k) * 1.5, y);
        g.stroke();
      }
      g.fillStyle = '#1c0f06'; g.fillRect(x0, 0, 1, 128);
      const sy = R() * 128; g.fillRect(x0, sy, 32, 1);
      g.fillStyle = '#111'; g.fillRect(x0 + 4, sy + 4, 2, 2); g.fillRect(x0 + 26, sy + 4, 2, 2);
    }
    noise(g, 128, 128, 10); T.planks = tex(c); }

  { const [c, g] = cv(128, 128); g.fillStyle = '#221d1a'; g.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 8; r++) for (let k = -1; k < 7; k++) {
      const x = k * 21 + (r % 2) * 10 + R() * 2;
      g.fillStyle = G.shade('#4a3f38', (R() - 0.5) * 0.4); g.fillRect(x, r * 16, 20, 15);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, r * 16 + 12, 20, 3);
    }
    noise(g, 128, 128, 14); T.roof = tex(c); }

  { const [c, g] = cv(128, 128); g.fillStyle = '#2a2826'; g.fillRect(0, 0, 128, 128);
    let y = 0;
    while (y < 128) {
      const h = 14 + R() * 10; let x = -R() * 20;
      while (x < 128) {
        const w = 18 + R() * 24;
        g.fillStyle = G.shade('#6b6760', (R() - 0.5) * 0.45);
        g.beginPath(); g.roundRect ? g.roundRect(x + 1, y + 1, w - 2, h - 2, 4) : g.rect(x + 1, y + 1, w - 2, h - 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 3, y + 2, w - 6, 2);
        x += w;
      }
      y += h;
    }
    noise(g, 128, 128, 20); T.stone = tex(c); }

  { const [c, g] = cv(128, 128); g.fillStyle = '#56534d'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 18; i++) { g.globalAlpha = 0.12; blob(g, R() * 128, R() * 128, 6 + R() * 18, '#1e1a16'); }
    g.globalAlpha = 1; noise(g, 128, 128, 26); T.concrete = tex(c); }

  { const [c, g] = cv(128, 128); g.fillStyle = '#6e1c1c'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#c9a35a'; g.lineWidth = 6; g.strokeRect(6, 6, 116, 116);
    g.lineWidth = 2; g.strokeStyle = '#2a1410'; g.strokeRect(14, 14, 100, 100);
    for (let y = 26; y < 110; y += 22) for (let x = 26; x < 110; x += 22) {
      g.fillStyle = (x + y) % 44 ? '#c9a35a' : '#3a5a6a';
      g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.fill();
    }
    noise(g, 128, 128, 16); T.rug = tex(c); }

  const pool = (size, n) => {
    const [c, g] = cv(size, size), m = size / 2;
    for (let i = 0; i < n; i++) blob(g, m + (R() - 0.5) * size * 0.45, m + (R() - 0.5) * size * 0.45, size * (0.1 + R() * 0.14), '#3d0202');
    blob(g, m, m, size * 0.28, '#3d0202');
    g.globalAlpha = 0.6;
    for (let i = 0; i < n / 2; i++) blob(g, m + (R() - 0.5) * size * 0.3, m + (R() - 0.5) * size * 0.3, size * (0.05 + R() * 0.08), '#650606');
    g.globalAlpha = 0.5; for (let i = 0; i < 6; i++) blob(g, m + (R() - 0.5) * size * 0.3, m + (R() - 0.5) * size * 0.3, 2, '#c04040');
    g.globalAlpha = 1;
    return tex(c);
  };
  T.pool = pool(256, 10);
  T.pool2 = pool(256, 7);
  { const [c, g] = cv(256, 256);
    blob(g, 128, 128, 22, '#4a0303');
    for (let i = 0; i < 160; i++) {
      const a = R() * Math.PI * 2, d = 20 + Math.pow(R(), 0.7) * 105, r = 1 + R() * 4 * (1 - d / 140);
      blob(g, 128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, R() < 0.5 ? '#5a0404' : '#3a0202');
      if (R() < 0.15) { g.strokeStyle = '#4a0303'; g.lineWidth = r; g.beginPath(); g.moveTo(128 + Math.cos(a) * d * 0.6, 128 + Math.sin(a) * d * 0.6); g.lineTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); g.stroke(); }
    }
    T.spatter = tex(c); }
  { const [c, g] = cv(256, 64);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(${60 + R() * 30},2,2,${0.25 + R() * 0.5})`; g.lineWidth = 2 + R() * 7; g.beginPath();
      const y = 14 + R() * 36; g.moveTo(R() * 20, y);
      for (let x = 0; x < 256; x += 16) g.lineTo(x, y + (R() - 0.5) * 6);
      g.stroke();
    }
    const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = gr; g.globalAlpha = 0.6; g.fillRect(0, 0, 256, 64);
    T.smear = tex(c); }
  { const [c, g] = cv(128, 256);
    for (let i = 0; i < 18; i++) {
      const x = 10 + R() * 108, len = 30 + R() * 200, w = 1.5 + R() * 4;
      g.fillStyle = `rgba(${70 + R() * 30},3,3,${0.6 + R() * 0.4})`; g.fillRect(x, 0, w, len);
      g.beginPath(); g.arc(x + w / 2, len, w * 0.9, 0, 7); g.fill();
    }
    blob(g, 64, 10, 40, 'rgba(70,3,3,0.9)');
    T.drips = tex(c); }

  { const [c, g] = cv(128, 128); g.fillStyle = '#8e1717'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) blob(g, R() * 128, R() * 128, 3 + R() * 8, R() < 0.5 ? '#6a0e0e' : '#a52222');
    g.strokeStyle = 'rgba(240,215,200,0.75)';
    for (let i = 0; i < 14; i++) {
      g.lineWidth = 1 + R() * 3; g.beginPath(); let x = R() * 128, y = R() * 128; g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    noise(g, 128, 128, 20); T.meat = tex(c); }

  { const [c, g] = cv(64, 64); g.fillStyle = '#5a2a13'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 10; i++) blob(g, R() * 64, R() * 64, 3 + R() * 6, R() < 0.5 ? '#7a2a18' : '#3e1a0a');
    g.strokeStyle = '#1a0a04'; g.lineWidth = 3;
    for (let k = -64; k < 128; k += 13) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.stroke(); }
    noise(g, 64, 64, 18); T.steak = tex(c); }

  const apron = (stained) => {
    const [c, g] = cv(64, 128); g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, 64, 128);
    g.strokeStyle = '#b8ae98'; g.setLineDash([2, 2]); g.strokeRect(3, 3, 58, 122); g.strokeRect(16, 70, 32, 22); g.setLineDash([]);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(150,140,120,0.15)'; g.fillRect(R() * 64, 0, 2, 128); }
    if (stained) {
      for (let i = 0; i < 24; i++) blob(g, 10 + R() * 44, 30 + R() * 90, 2 + R() * 9, R() < 0.6 ? '#9c0c0c' : '#6a0505');
      for (let i = 0; i < 8; i++) { g.fillStyle = '#7a0707'; const x = R() * 64; g.fillRect(x, 60 + R() * 30, 2, 20 + R() * 40); }
      for (let i = 0; i < 30; i++) blob(g, R() * 64, R() * 128, 1 + R() * 1.5, '#8a0a0a');
    }
    noise(g, 64, 128, 8); return tex(c);
  };
  T.apron = apron(false); T.apronBlood = apron(true);

  { const [c, g] = cv(128, 128); g.fillStyle = '#d7d1c3'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(120,110,95,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(R() * 128, 0); g.quadraticCurveTo(R() * 128, 64, R() * 128, 128); g.stroke(); }
    for (let i = 0; i < 6; i++) { g.globalAlpha = 0.85; blob(g, 30 + R() * 70, 30 + R() * 70, 14 + R() * 18, '#6e0909'); }
    g.globalAlpha = 0.7; for (let i = 0; i < 12; i++) blob(g, R() * 128, R() * 128, 4 + R() * 10, '#4a0505');
    g.globalAlpha = 1; noise(g, 128, 128, 10); T.sheet = tex(c); }

  { const [c, g] = cv(128, 96); g.fillStyle = '#d8cdb0'; g.fillRect(0, 0, 128, 96);
    const fam = ['linda', 'luke', 'lily', 'rose', 'leon'];
    fam.forEach((k, i) => {
      const ch = G.CHARS[k], x = 16 + i * 24, hh = [60, 52, 56, 60, 66][i];
      g.fillStyle = ch.shirt; g.fillRect(x - 7, hh, 14, 96 - hh);
      g.fillStyle = ch.skin; g.fillRect(x - 5, hh - 14, 10, 12);
      g.fillStyle = ch.hair; g.fillRect(x - 6, hh - 16, 12, 5); g.fillRect(x - 6, hh - 13, 2, k === 'lily' ? 14 : 6); g.fillRect(x + 4, hh - 13, 2, k === 'lily' ? 14 : 6);
      g.fillStyle = '#222'; g.fillRect(x - 3, hh - 10, 2, 2); g.fillRect(x + 1, hh - 10, 2, 2);
    });
    g.fillStyle = 'rgba(80,60,30,0.25)'; g.fillRect(0, 0, 128, 96);
    noise(g, 128, 96, 18); T.photo = tex(c); }

  T.face = function (ch, mode) {
    const [c, g] = cv(32, 32), P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    let skin = ch.skin;
    if (mode === 'dead') skin = '#cdbfae';
    if (mode === 'rot') skin = '#8f9877';
    P(0, 0, 32, 32, skin);
    P(0, 0, 2, 32, G.shade(skin, -0.12)); P(30, 0, 2, 32, G.shade(skin, -0.12)); P(0, 29, 32, 3, G.shade(skin, -0.1));
    const hd = G.shade(ch.hair, -0.35), lid = G.shade(skin, -0.3);
    if (mode === 'dead' || mode === 'rot') {
      P(7, 14, 6, 1, lid); P(19, 14, 6, 1, lid);
      P(7, 15, 6, 1, G.shade(skin, -0.18)); P(19, 15, 6, 1, G.shade(skin, -0.18));
      P(12, 23, 8, 2, '#2a0a0a');
      if (mode === 'rot') {
        for (let i = 0; i < 14; i++) P(R() * 30 | 0, R() * 30 | 0, 2 + (R() * 3 | 0), 2, R() < 0.5 ? '#5a4a5a' : '#4f5a3a');
        P(13, 25, 2, 7, '#5a0505'); P(17, 25, 1, 5, '#5a0505'); P(14, 18, 1, 4, '#5a0505');
      }
    } else {
      P(7, 11, 6, 1, hd); P(19, 11, 6, 1, hd);
      const dark = mode === 'dark' || mode === 'smile';
      if (mode === 'dark') { P(7, 10, 2, 1, hd); P(23, 10, 2, 1, hd); }
      P(7, 13, 6, 4, dark ? '#140808' : '#f4f0ea'); P(19, 13, 6, 4, dark ? '#140808' : '#f4f0ea');
      if (!dark) { P(9, 13, 3, 4, ch.iris); P(21, 13, 3, 4, ch.iris); P(10, 14, 1, 2, '#000'); P(22, 14, 1, 2, '#000'); P(11, 13, 1, 1, '#fff'); P(23, 13, 1, 1, '#fff'); }
      else { P(10, 14, 1, 1, '#a01010'); P(22, 14, 1, 1, '#a01010'); P(7, 17, 6, 1, G.shade(skin, -0.25)); P(19, 17, 6, 1, G.shade(skin, -0.25)); }
      P(7, 12, 6, 1, lid); P(19, 12, 6, 1, lid);
      if (ch.female) { P(6, 12, 1, 1, '#1a1010'); P(25, 12, 1, 1, '#1a1010'); }
      P(15, 18, 2, 3, G.shade(skin, -0.14));
      if (mode === 'smile') {
        P(11, 23, 10, 1, '#5a1a18'); P(10, 22, 1, 1, '#5a1a18'); P(21, 22, 1, 1, '#5a1a18');
        P(19, 24, 2, 5, '#7a0606'); P(20, 29, 1, 2, '#7a0606');
      } else if (mode === 'scared') P(14, 22, 4, 3, '#2a0a0a');
      else P(12, 23, 8, 1, G.shade(skin, -0.35));
      if (ch.female) { P(7, 19, 3, 1, 'rgba(230,120,120,0.35)'); P(22, 19, 3, 1, 'rgba(230,120,120,0.35)'); }
    }
    return tex(c, true);
  };

  T.portrait = function (k, mood) {
    const ch = G.CHARS[k];
    const [c, g] = cv(32, 32), P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const H = ch.hair, Hl = G.shade(H, 0.3), Hd = G.shade(H, -0.35), S = ch.skin, Sd = G.shade(S, -0.15);
    P(0, 0, 32, 32, G.shade(H, -0.78)); P(0, 24, 32, 8, G.shade(H, -0.7));
    // hair behind face
    if (ch.style === 'long') { P(6, 9, 20, 19, H); P(5, 22, 3, 7, H); P(24, 22, 3, 7, H); }
    if (ch.style === 'bob') { P(7, 9, 18, 12, H); }
    P(6, 26, 20, 6, ch.shirt); P(8, 25, 16, 1, ch.shirt); P(6, 26, 20, 1, G.shade(ch.shirt, 0.15));
    if (ch.apron) { P(12, 27, 8, 5, '#e9e2cf'); if (mood === 'blood') { P(13, 28, 2, 2, '#9c0c0c'); P(17, 29, 2, 3, '#7a0707'); } }
    P(13, 21, 6, 5, Sd);
    P(10, 9, 12, 13, S); P(11, 22, 10, 1, S); P(9, 13, 1, 5, S); P(22, 13, 1, 5, S);
    P(21, 10, 1, 12, Sd); P(11, 21, 10, 1, Sd);
    // eyes
    const dark = mood === 'dark';
    if (dark) { P(12, 15, 3, 2, '#100'); P(17, 15, 3, 2, '#100'); P(13, 15, 1, 1, '#b01010'); P(18, 15, 1, 1, '#b01010'); P(12, 17, 3, 1, G.shade(S, -0.3)); P(17, 17, 3, 1, G.shade(S, -0.3)); }
    else if (mood === 'scared') { P(12, 14, 3, 3, '#fff'); P(17, 14, 3, 3, '#fff'); P(13, 15, 1, 1, '#000'); P(18, 15, 1, 1, '#000'); }
    else { P(12, 15, 3, 2, '#fff'); P(17, 15, 3, 2, '#fff'); P(13, 15, 2, 2, ch.iris); P(18, 15, 2, 2, ch.iris); P(14, 15, 1, 1, '#000'); P(19, 15, 1, 1, '#000'); }
    const bY = dark || mood === 'yell' ? 13 : 13;
    P(12, bY, 3, 1, Hd); P(17, bY, 3, 1, Hd);
    if (dark || mood === 'yell') { P(14, 14, 1, 1, Hd); P(17, 14, 1, 1, Hd); }
    P(15, 17, 2, 2, Sd);
    if (mood === 'yell') P(14, 19, 4, 2, '#3a0808');
    else if (mood === 'scared') P(15, 19, 2, 2, '#3a0808');
    else if (mood === 'smile' || mood === 'blood') { P(14, 19, 4, 1, '#8a3b35'); P(13, 18, 1, 1, '#8a3b35'); P(18, 18, 1, 1, '#8a3b35'); }
    else P(14, 19, 4, 1, '#8a3b35');
    if (k === 'linda') { P(11, 18, 1, 1, Sd); P(20, 18, 1, 1, Sd); }
    if (k === 'luke') { P(11, 19, 10, 3, 'rgba(60,20,10,0.25)'); }
    if (ch.female && !dark) { P(11, 18, 2, 1, 'rgba(230,110,110,0.4)'); P(19, 18, 2, 1, 'rgba(230,110,110,0.4)'); }
    // hair front
    switch (ch.style) {
      case 'spiky':
        P(9, 7, 14, 4, H); P(10, 6, 12, 1, H); P(10, 4, 2, 2, H); P(13, 3, 2, 3, H); P(16, 4, 2, 2, H); P(19, 5, 2, 2, H); P(21, 6, 2, 2, H);
        P(8, 9, 2, 5, H); P(22, 9, 2, 5, H); P(10, 11, 3, 1, H); P(14, 11, 2, 2, H); P(18, 11, 3, 1, H); P(11, 7, 5, 1, Hl); P(13, 4, 1, 2, Hl); break;
      case 'messy':
        P(8, 6, 16, 5, H); P(9, 5, 14, 1, H); P(7, 8, 2, 9, H); P(23, 8, 2, 9, H); P(10, 11, 4, 2, H); P(15, 11, 2, 1, H); P(19, 11, 3, 2, H);
        P(6, 10, 1, 4, H); P(11, 4, 3, 1, H); P(18, 4, 2, 1, H); P(10, 7, 6, 1, Hl); P(8, 9, 1, 6, Hd); break;
      case 'long':
        P(8, 6, 16, 5, H); P(9, 5, 14, 1, H); P(7, 9, 3, 17, H); P(22, 9, 3, 17, H); P(10, 11, 5, 2, H); P(17, 11, 5, 2, H); P(15, 11, 2, 1, H);
        P(10, 6, 7, 1, Hl); P(8, 12, 1, 10, Hl); P(22, 8, 2, 2, '#fff'); break;
      case 'bob':
        P(8, 6, 16, 5, H); P(9, 5, 14, 1, H); P(7, 9, 3, 12, H); P(22, 9, 3, 12, H); P(10, 10, 9, 2, H); P(10, 12, 4, 1, H);
        P(11, 6, 6, 1, Hl); P(7, 19, 3, 1, Hd); P(22, 19, 3, 1, Hd); break;
      case 'bun':
        P(9, 6, 14, 4, H); P(10, 5, 12, 1, H); P(12, 1, 8, 4, H); P(13, 0, 6, 1, H); P(8, 9, 2, 7, H); P(22, 9, 2, 7, H); P(10, 10, 3, 1, H); P(19, 10, 3, 1, H);
        P(16, 6, 1, 3, Hd); P(13, 1, 3, 1, Hl); P(9, 17, 1, 1, '#d8c070'); P(22, 17, 1, 1, '#d8c070'); break;
    }
    return c;
  };
  return T;
};
