// Procedural textures: world materials, clothing atlases, faces (per expression), eyes, props, gore.
// Everything is painted once (faces lazily, per expression) and cached.
window.G = window.G || {};

G.C = h => new THREE.Color(h).convertSRGBToLinear();
G.shade = function (hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
};
G.mixHex = function (a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
};
G.rngF = function (seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

// face: jaw taper, nose height, nose width, chin, brow ridge, eye scale, lip width, cheek fullness
G.CHARS = {
  leon:  { name: 'Leon', age: 13, hair: '#2f7dff', skin: '#f1c7a5', iris: '#3f74c4', h: 1.52, build: 'kid',   style: 'spiky', base: 'neutral',
    face: { jaw: 0.3, nose: 0.15, noseW: 0.07, chin: 0.03, brow: 0.01, eye: 1.1, lip: 0.85, cheek: 0.05, bandaid: true }, voice: { f0: 265, form: 1.16 } },
  luke:  { name: 'Luke', age: 20, hair: '#7a1212', skin: '#e2b08e', iris: '#5a4632', h: 1.86, build: 'man',   style: 'messy', base: 'neutral',
    face: { jaw: 0.14, nose: 0.24, noseW: 0.078, chin: 0.07, brow: 0.045, eye: 0.95, lip: 0.95, cheek: -0.02, stubble: true }, voice: { f0: 112, form: 0.9 } },
  lily:  { name: 'Lily', age: 17, hair: '#ff6fb8', skin: '#f3cdb4', iris: '#5d8a56', h: 1.68, build: 'woman', style: 'long',  base: 'soft',
    face: { jaw: 0.28, nose: 0.17, noseW: 0.064, chin: 0.03, brow: 0.015, eye: 1.04, lip: 1.0, cheek: 0.02 }, voice: { f0: 215, form: 1.08 } },
  rose:  { name: 'Rose', age: 15, hair: '#2fbf5a', skin: '#efc4a2', iris: '#7a5a32', h: 1.6,  build: 'girl',  style: 'bob',   base: 'neutral',
    face: { jaw: 0.3, nose: 0.16, noseW: 0.064, chin: 0.035, brow: 0.015, eye: 1.06, lip: 0.92, cheek: 0.035, freckles: true }, voice: { f0: 238, form: 1.12 } },
  linda: { name: 'Mom',  age: 44, hair: '#6b4426', skin: '#e6bd9c', iris: '#4a3524', h: 1.7,  build: 'woman', style: 'bun',   base: 'tired', skirt: true, apron: true,
    face: { jaw: 0.24, nose: 0.21, noseW: 0.07, chin: 0.045, brow: 0.025, eye: 0.98, lip: 0.92, cheek: -0.03, tired: true }, voice: { f0: 182, form: 1.0 } }
};

G.makeTextures = function (Q) {
  Q = Q || { tex: 1, aniso: 4 };
  let sd = 98765;
  const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  // Painters draw in a fixed "design" space; the canvas itself is scaled by quality.
  const pc = (w, h) => { const k = Q.tex, [c, g] = cv(Math.max(16, Math.round(w * k)), Math.max(16, Math.round(h * k))); g.setTransform(c.width / w, 0, 0, c.height / h, 0, 0); return [c, g]; };
  const mk = (c, o = {}) => {
    const t = new THREE.CanvasTexture(c);
    t.encoding = o.linear ? THREE.LinearEncoding : THREE.sRGBEncoding;
    if (!o.clamp) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Q.aniso || 4;
    if (o.nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    return t;
  };
  const noise = (c, g, amt, mono = true) => {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      const n = (R() - 0.5) * amt;
      if (mono) { a[i] += n; a[i + 1] += n; a[i + 2] += n; } else { a[i] += n; a[i + 1] += (R() - 0.5) * amt; a[i + 2] += (R() - 0.5) * amt; }
    }
    g.putImageData(d, 0, 0); g.restore();
  };
  const blob = (g, x, y, r, col, n = 14, j = 0.45) => {
    g.fillStyle = col; g.beginPath();
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 - j / 2 + R() * j); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.fill();
  };
  const rg = (g, x, y, r0, r1, c0, c1) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); return gr; };
  const lg = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  const grain = (g, x, y, w, h, n, col, wav = 1.5) => {
    g.strokeStyle = col; g.lineWidth = 1;
    for (let k = 0; k < n; k++) {
      g.globalAlpha = 0.15 + R() * 0.3; g.beginPath();
      const yy = y + R() * h, ph = R() * 6;
      for (let xx = x; xx <= x + w; xx += 6) g.lineTo(xx, yy + Math.sin(xx * 0.05 + ph) * wav + Math.sin(xx * 0.17 + ph) * 0.6);
      g.stroke();
    }
    g.globalAlpha = 1;
  };
  const text = (g, s, x, y, font, col, align = 'center') => { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  const T = {};

  // ---------------- ground ----------------
  { const [c, g] = pc(512, 512); g.fillStyle = '#56702f'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 60; i++) { g.globalAlpha = 0.18; blob(g, R() * 512, R() * 512, 20 + R() * 50, R() < 0.5 ? '#3f5a24' : '#6d8238'); }
    g.globalAlpha = 1;
    for (let i = 0; i < 4200; i++) {
      const x = R() * 512, y = R() * 512;
      g.strokeStyle = `hsl(${72 + R() * 34},${28 + R() * 30}%,${16 + R() * 28}%)`; g.lineWidth = 1 + R();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 4, y - 3 - R() * 7); g.stroke();
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = R() < 0.5 ? '#5a4630' : '#6b5a40'; g.fillRect(R() * 512, R() * 512, 2, 2); }
    noise(c, g, 12); T.grass = mk(c); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#6b5238'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 300; i++) blob(g, R() * 256, R() * 256, 1 + R() * 3, ['#5a432c', '#7d6446', '#8a7660', '#4a3826'][i % 4], 8);
    for (let i = 0; i < 25; i++) { g.globalAlpha = 0.2; blob(g, R() * 256, R() * 256, 8 + R() * 20, '#4e3b28'); }
    g.globalAlpha = 1; noise(c, g, 18); T.dirt = mk(c); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#3a281a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) blob(g, R() * 256, R() * 256, 1 + R() * 4, R() < 0.5 ? '#2a1c11' : '#4d3725', 8);
    for (let y = 16; y < 256; y += 32) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 256, 5); g.fillStyle = 'rgba(120,90,60,0.15)'; g.fillRect(0, y - 6, 256, 4); }
    noise(c, g, 22); T.soil = mk(c); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#5d5a55'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 80; i++) { g.globalAlpha = 0.3; blob(g, R() * 256, R() * 256, 4 + R() * 24, ['#4a4844', '#77736b', '#6a665e'][i % 3]); }
    g.globalAlpha = 1; for (let i = 0; i < 50; i++) blob(g, R() * 256, R() * 256, 2 + R() * 5, R() < 0.5 ? '#7a8a4a' : '#a0a070', 8);
    noise(c, g, 22); T.rock = mk(c); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { const x = R() * 256; g.fillStyle = R() < 0.5 ? '#2e241a' : '#5d4a38'; g.fillRect(x, 0, 2 + R() * 5, 256); }
    for (let i = 0; i < 40; i++) { g.fillStyle = '#241c14'; g.fillRect(R() * 256, R() * 256, 1 + R() * 3, 6 + R() * 20); }
    noise(c, g, 20); T.bark = mk(c); }
  { const [c, g] = pc(128, 256); g.fillStyle = '#e8e4da'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 40; i++) { g.fillStyle = R() < 0.7 ? '#1e1c1a' : '#6a6660'; g.fillRect(R() * 128, R() * 256, 6 + R() * 30, 2 + R() * 3); }
    noise(c, g, 14); T.birch = mk(c); }

  // ---------------- building ----------------
  { const [c, g] = pc(512, 512);
    for (let i = 0; i < 8; i++) {
      const y0 = i * 64, t = 0.9 + R() * 0.2;
      g.fillStyle = lg(g, 0, y0, 0, y0 + 64, [[0, '#2a1a0d'], [0.1, G.shade('#6e4a2a', t - 1)], [0.45, G.shade('#9a6c42', t - 1)], [0.8, G.shade('#6a4526', t - 1)], [0.94, '#3a2614'], [1, '#bdb6a4']]);
      g.fillRect(0, y0, 512, 64);
      grain(g, 0, y0 + 8, 512, 44, 26, 'rgba(40,24,10,1)', 1.2);
      g.fillStyle = 'rgba(205,198,182,1)'; g.fillRect(0, y0 + 59, 512, 5);
      for (let k = 0; k < 30; k++) { g.fillStyle = 'rgba(120,115,100,0.6)'; g.fillRect(R() * 512, y0 + 59 + R() * 5, 3, 1); }
      if (R() < 0.7) { g.fillStyle = 'rgba(30,18,8,0.6)'; g.fillRect(R() * 512, y0 + 22 + R() * 20, 30 + R() * 80, 1.5); }
    }
    noise(c, g, 12); T.logs = mk(c); }
  { const [c, g] = pc(512, 512);
    for (let i = 0; i < 8; i++) {
      const x0 = i * 64, t = R();
      g.fillStyle = `hsl(${30 + t * 6},${42 + t * 12}%,${44 + t * 12}%)`; g.fillRect(x0, 0, 64, 512);
      g.save(); g.translate(x0, 0); g.rotate(Math.PI / 2); grain(g, 0, -60, 512, 56, 18, 'rgba(90,50,20,1)', 2.5); g.restore();
      if (R() < 0.6) { const ky = R() * 512; g.fillStyle = rg(g, x0 + 32, ky, 1, 7, 'rgba(80,40,15,0.9)', 'rgba(80,40,15,0)'); g.fillRect(x0 + 20, ky - 12, 24, 24); }
      g.fillStyle = 'rgba(40,20,8,0.85)'; g.fillRect(x0, 0, 2, 512);
      g.fillStyle = 'rgba(255,230,190,0.12)'; g.fillRect(x0 + 2, 0, 2, 512);
    }
    noise(c, g, 9); T.boards = mk(c); }
  { const [c, g] = pc(512, 512);
    for (let r = 0; r < 6; r++) {
      const y0 = r * 85.33; let x = -R() * 200;
      while (x < 512) {
        const w = 160 + R() * 200, t = R();
        g.fillStyle = `hsl(${26 + t * 8},${40 + t * 14}%,${28 + t * 12}%)`; g.fillRect(x, y0, w, 85.33);
        grain(g, x, y0 + 4, w, 78, 14, 'rgba(30,14,4,1)', 1.4);
        g.fillStyle = 'rgba(15,8,3,0.9)'; g.fillRect(x, y0, 2, 85.33);
        g.fillStyle = '#18100a'; g.fillRect(x + 8, y0 + 14, 3, 3); g.fillRect(x + 8, y0 + 68, 3, 3);
        x += w;
      }
      g.fillStyle = 'rgba(15,8,3,0.95)'; g.fillRect(0, y0, 512, 2);
    }
    g.fillStyle = rg(g, 256, 256, 30, 300, 'rgba(255,240,210,0.07)', 'rgba(0,0,0,0)'); g.fillRect(0, 0, 512, 512);
    noise(c, g, 9); T.floor = mk(c); }
  { const [c, g] = pc(512, 512); g.fillStyle = '#2a2420'; g.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 16; r++) { let x = -(r % 2) * 18 - R() * 10;
      while (x < 512) { const w = 22 + R() * 26; g.fillStyle = G.shade('#5d4e44', (R() - 0.5) * 0.45); g.fillRect(x + 1, r * 32, w - 2, 30);
        g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(x + 1, r * 32 + 24, w - 2, 6); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 1, r * 32, w - 2, 3);
        if (R() < 0.08) { g.globalAlpha = 0.6; blob(g, x + w / 2, r * 32 + 14, 6 + R() * 6, '#4f6a30', 10); g.globalAlpha = 1; }
        x += w; } }
    noise(c, g, 14); T.roof = mk(c); }
  { const [c, g] = pc(512, 512); g.fillStyle = '#4a443c'; g.fillRect(0, 0, 512, 512);
    let y = 0;
    while (y < 512) { const h = 34 + R() * 26; let x = -R() * 30;
      while (x < 512) { const w = 40 + R() * 50; const col = G.shade(['#7a746a', '#6e6052', '#857f76', '#5f5a52'][(R() * 4) | 0], (R() - 0.5) * 0.25);
        g.fillStyle = col; g.beginPath(); g.roundRect ? g.roundRect(x + 3, y + 3, w - 6, h - 6, 10) : g.rect(x + 3, y + 3, w - 6, h - 6); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 8, y + 5, w - 16, 3); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 6, y + h - 9, w - 12, 4);
        x += w; }
      y += h; }
    noise(c, g, 20); T.stone = mk(c); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#5a5751'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 30; i++) { g.globalAlpha = 0.12; blob(g, R() * 256, R() * 256, 8 + R() * 30, '#221e1a'); }
    g.globalAlpha = 0.5; g.strokeStyle = '#2a2622'; for (let i = 0; i < 6; i++) { g.beginPath(); let x = R() * 256, y = R() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    g.globalAlpha = 1; noise(c, g, 26); T.concrete = mk(c); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#9a968c'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#e8e4da' : '#d8d2c4'; g.fillRect(x * 32 + 2, y * 32 + 2, 28, 28); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x * 32 + 3, y * 32 + 3, 26, 3); }
    noise(c, g, 10); T.tile = mk(c); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#8a9a80'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const px = x * 64 + (y % 2) * 32 + 16, py = y * 64 + 32;
      g.fillStyle = '#6e7f66'; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.ellipse(px + Math.cos(a) * 6, py + Math.sin(a) * 6, 5, 3, a, 0, 7); g.fill(); }
      g.fillStyle = '#c9b07a'; g.beginPath(); g.arc(px, py, 2.5, 0, 7); g.fill();
      g.strokeStyle = '#71826a'; g.beginPath(); g.moveTo(px, py + 8); g.quadraticCurveTo(px + 8, py + 18, px + 2, py + 28); g.stroke();
    }
    for (let x = 0; x < 256; x += 32) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, 0, 2, 256); }
    g.fillStyle = 'rgba(120,100,60,0.12)'; g.fillRect(0, 0, 256, 256); noise(c, g, 10); T.wallpaper = mk(c); }
  { const [c, g] = pc(128, 128); g.fillStyle = '#3a3a3c'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, R() * 128, 128, 1); } noise(c, g, 14); T.metal = mk(c); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#6a4a32'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) { g.globalAlpha = 0.5; blob(g, R() * 256, R() * 256, 3 + R() * 18, ['#8a4a1e', '#4a2e1c', '#9a6a3a', '#3a3a34'][i % 4]); }
    g.globalAlpha = 1; noise(c, g, 22); T.rust = mk(c); }

  // ---------------- fabrics & decor ----------------
  const quilt = (a, b, c2, kind) => {
    const [c, g] = pc(256, 256); g.fillStyle = a; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const px = x * 64, py = y * 64, alt = (x + y) % 2;
      g.fillStyle = alt ? b : a; g.fillRect(px, py, 64, 64);
      if (kind === 'star') { g.fillStyle = c2; g.beginPath(); g.moveTo(px + 32, py + 8); g.lineTo(px + 40, py + 28); g.lineTo(px + 56, py + 32); g.lineTo(px + 40, py + 36); g.lineTo(px + 32, py + 56); g.lineTo(px + 24, py + 36); g.lineTo(px + 8, py + 32); g.lineTo(px + 24, py + 28); g.fill(); }
      if (kind === 'plaid') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px + 24, py, 16, 64); g.fillRect(px, py + 24, 64, 16); g.fillStyle = c2; g.fillRect(px + 30, py, 4, 64); g.fillRect(px, py + 30, 64, 4); }
      if (kind === 'flower') { g.fillStyle = c2; for (let k = 0; k < 6; k++) { const an = k / 6 * Math.PI * 2; g.beginPath(); g.ellipse(px + 32 + Math.cos(an) * 10, py + 32 + Math.sin(an) * 10, 8, 4, an, 0, 7); g.fill(); } g.fillStyle = '#f0d060'; g.beginPath(); g.arc(px + 32, py + 32, 5, 0, 7); g.fill(); }
      if (kind === 'leaf') { g.fillStyle = c2; g.beginPath(); g.ellipse(px + 32, py + 32, 20, 9, alt ? 0.7 : -0.7, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(px + 18, py + 44); g.lineTo(px + 46, py + 20); g.stroke(); }
      if (kind === 'ring') { g.strokeStyle = c2; g.lineWidth = 5; g.beginPath(); g.arc(px + 32, py + 32, 18, 0, 7); g.stroke(); g.lineWidth = 1; }
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.setLineDash([3, 3]); g.strokeRect(px + 3, py + 3, 58, 58); g.setLineDash([]);
    }
    noise(c, g, 10); return mk(c);
  };
  T.quilt = {
    leon: quilt('#2a4a8a', '#3a63b0', '#e8e0c8', 'star'), luke: quilt('#3a1414', '#5a1e1e', '#111', 'plaid'),
    lily: quilt('#e8d8dc', '#f0a8c8', '#ff6fb8', 'flower'), rose: quilt('#3a6a3a', '#cfe0b8', '#2f8a3a', 'leaf'),
    linda: quilt('#e6dcc6', '#c8b896', '#8a5a3a', 'ring')
  };
  { const [c, g] = pc(512, 512); g.fillStyle = '#3a2a22'; g.fillRect(0, 0, 512, 512);
    const cols = ['#7a2a22', '#3a5a6a', '#c9a35a', '#5a6a3a', '#8a6a4a', '#4a3a5a'];
    for (let r = 250, i = 0; r > 4; r -= 11, i++) { g.strokeStyle = cols[i % 6]; g.lineWidth = 10; g.beginPath(); g.ellipse(256, 256, r, r, 0, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let a = 0; a < 6.28; a += 0.12) { g.beginPath(); g.moveTo(256 + Math.cos(a) * (r - 5), 256 + Math.sin(a) * (r - 5)); g.lineTo(256 + Math.cos(a + 0.06) * (r + 5), 256 + Math.sin(a + 0.06) * (r + 5)); g.stroke(); } }
    noise(c, g, 14); T.rugRound = mk(c, { clamp: true }); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#6e1c1c'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#c9a35a'; g.lineWidth = 10; g.strokeRect(10, 10, 236, 236); g.lineWidth = 3; g.strokeStyle = '#2a1410'; g.strokeRect(26, 26, 204, 204);
    for (let y = 52; y < 220; y += 44) for (let x = 52; x < 220; x += 44) { g.fillStyle = (x + y) % 88 ? '#c9a35a' : '#3a5a6a'; g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 14, y); g.lineTo(x, y + 14); g.lineTo(x - 14, y); g.fill(); }
    noise(c, g, 16); T.rug = mk(c, { clamp: true }); }
  { const [c, g] = pc(256, 256); g.fillStyle = '#8a2a24'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 32) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(i, 0, 12, 256); g.fillRect(0, i, 256, 12); g.fillStyle = 'rgba(240,220,180,0.25)'; g.fillRect(i + 20, 0, 3, 256); g.fillRect(0, i + 20, 256, 3); }
    noise(c, g, 10); T.plaid = mk(c); }
  { const [c, g] = pc(256, 128); const cols = ['#6a2a22', '#2a4a5a', '#5a4a2a', '#3a3a3a', '#4a5a2a', '#7a5a3a', '#2a2a4a', '#8a7a5a'];
    let x = 0; while (x < 256) { const w = 10 + R() * 14, hh = 90 + R() * 38; g.fillStyle = cols[(R() * 8) | 0]; g.fillRect(x, 128 - hh, w, hh);
      g.fillStyle = 'rgba(255,230,160,0.5)'; g.fillRect(x + 2, 128 - hh + 10, w - 4, 2); g.fillRect(x + 2, 128 - 18, w - 4, 2); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + w - 1, 128 - hh, 1, hh); x += w; }
    noise(c, g, 12); T.books = mk(c); }

  // ---------------- story props ----------------
  { const [c, g] = pc(256, 384); g.fillStyle = lg(g, 0, 0, 0, 384, [[0, '#ff5fa8'], [0.6, '#7a3aa8'], [1, '#22123a']]); g.fillRect(0, 0, 256, 384);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.5})`; g.beginPath(); g.arc(R() * 256, R() * 384, 1 + R() * 2, 0, 7); g.fill(); }
    g.fillStyle = '#ffd0b0'; g.beginPath(); g.ellipse(128, 170, 44, 54, 0, 0, 7); g.fill();
    g.fillStyle = '#ffe14a'; g.beginPath(); g.ellipse(128, 140, 60, 52, 0, Math.PI, 0); g.fill(); g.fillRect(68, 140, 22, 110); g.fillRect(166, 140, 22, 110);
    g.fillStyle = '#222'; g.fillRect(70, 160, 14, 34); g.fillRect(172, 160, 14, 34); g.fillRect(84, 112, 88, 8);
    g.fillStyle = '#3a2030'; g.beginPath(); g.arc(112, 170, 5, 0, 7); g.arc(144, 170, 5, 0, 7); g.fill();
    g.fillStyle = '#d04070'; g.beginPath(); g.ellipse(128, 198, 12, 6, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#ff7ac0'; g.fillRect(84, 226, 88, 70);
    text(g, 'KAYLIE', 128, 318, 'bold 46px sans-serif', '#fff'); text(g, '♥ LIVE ♥', 128, 356, 'bold 24px sans-serif', '#ffe14a');
    noise(c, g, 8); T.posterKaylie = mk(c, { clamp: true }); }
  { const [c, g] = pc(256, 384); g.fillStyle = '#10141c'; g.fillRect(0, 0, 256, 384);
    g.fillStyle = lg(g, 0, 120, 0, 384, [[0, '#ff6a2a'], [1, '#2a0a3a']]); g.beginPath(); g.moveTo(0, 384); g.lineTo(80, 200); g.lineTo(140, 260); g.lineTo(210, 150); g.lineTo(256, 230); g.lineTo(256, 384); g.fill();
    g.fillStyle = '#000'; g.fillRect(118, 180, 14, 60); g.beginPath(); g.arc(125, 170, 10, 0, 7); g.fill(); g.fillRect(100, 200, 50, 6);
    text(g, 'DUSK', 128, 60, 'bold 54px sans-serif', '#ff8a3a'); text(g, 'RUNNER', 128, 108, 'bold 40px sans-serif', '#fff');
    noise(c, g, 10); T.posterGame = mk(c, { clamp: true }); }
  const paper = (draw, w = 256, h = 256) => { const [c, g] = pc(w, h); g.fillStyle = '#efe7d6'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,100,70,0.12)'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a2622'; g.fillStyle = '#2a2622'; g.lineCap = 'round'; draw(g); noise(c, g, 10); return mk(c, { clamp: true }); };
  T.sketchMountain = paper(g => { g.lineWidth = 2; g.beginPath(); g.moveTo(10, 190); g.lineTo(70, 90); g.lineTo(110, 140); g.lineTo(160, 60); g.lineTo(240, 180); g.stroke(); g.globalAlpha = 0.3; for (let i = 0; i < 40; i++) { g.beginPath(); g.moveTo(160 - i, 60 + i * 2); g.lineTo(165 - i * 0.6, 70 + i * 2); g.stroke(); } g.globalAlpha = 1; for (let i = 0; i < 9; i++) { const x = 20 + i * 26; g.beginPath(); g.moveTo(x, 240); g.lineTo(x + 8, 205); g.lineTo(x + 16, 240); g.stroke(); } });
  T.sketchFamily = paper(g => { g.lineWidth = 2; [[50, 1], [92, 0.9], [134, 0.82], [176, 0.78], [214, 0.7]].forEach(([x, s]) => { g.beginPath(); g.arc(x, 120 - 30 * s, 14 * s, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x, 134 - 30 * s); g.lineTo(x, 200); g.moveTo(x - 16 * s, 150); g.lineTo(x + 16 * s, 150); g.moveTo(x, 200); g.lineTo(x - 10, 236); g.moveTo(x, 200); g.lineTo(x + 10, 236); g.stroke(); }); g.font = '18px cursive'; g.fillText('us ♥', 100, 30); });
  T.sketchDoor = paper(g => { g.fillStyle = '#1a1612'; g.fillRect(70, 40, 116, 196); g.fillStyle = '#efe7d6'; g.fillRect(80, 50, 96, 176); g.globalAlpha = 0.55; g.fillStyle = '#2a2622'; for (let i = 0; i < 200; i++) g.fillRect(80 + R() * 96, 50 + R() * 176, 2, 2); g.globalAlpha = 1; g.fillStyle = '#1a1612'; g.beginPath(); g.ellipse(128, 120, 16, 20, 0, 0, 7); g.fill(); g.fillRect(112, 138, 32, 70); g.fillStyle = '#efe7d6'; g.fillRect(120, 116, 4, 3); g.fillRect(132, 116, 4, 3); g.font = '16px cursive'; g.fillStyle = '#2a2622'; g.fillText('she stands there every night', 20, 250); });
  T.sketchLeon = paper(g => { g.lineWidth = 2; g.beginPath(); g.ellipse(128, 130, 52, 64, 0, 0, 7); g.stroke(); for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(80 + i * 12, 82); g.lineTo(86 + i * 12, 50 + (i % 2) * 10); g.lineTo(92 + i * 12, 80); g.stroke(); } g.beginPath(); g.arc(108, 125, 6, 0, 7); g.arc(148, 125, 6, 0, 7); g.stroke(); g.beginPath(); g.arc(128, 160, 16, 0.2, 2.9); g.stroke(); g.font = '18px cursive'; g.fillText('Leon, age 13', 70, 228); });
  T.pressed = paper(g => { [[60, 80, '#c0407a'], [130, 70, '#5a5ac8'], [196, 90, '#e0a020'], [90, 170, '#7a9ae0'], [170, 170, '#c03030']].forEach(([x, y, col]) => { g.strokeStyle = '#4a6a2a'; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x + 4, y + 60); g.stroke(); g.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; g.beginPath(); g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 8, 4, a, 0, 7); g.fill(); } g.fillStyle = '#f0d060'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }); g.font = '14px cursive'; g.fillStyle = '#4a3a2a'; g.fillText('fireweed  lupine  arnica', 30, 236); });
  T.calendar = paper(g => { g.fillStyle = '#8a2a22'; g.fillRect(0, 0, 256, 44); text(g, 'SEPTEMBER', 128, 22, 'bold 22px serif', '#fff'); g.strokeStyle = '#6a5a4a'; g.lineWidth = 1;
    for (let r = 0; r < 5; r++) for (let k = 0; k < 7; k++) { const x = 8 + k * 34.5, y = 52 + r * 40; g.strokeRect(x, y, 34, 40); const d = r * 7 + k + 1; if (d <= 30) { text(g, '' + d, x + 6, y + 8, '10px sans-serif', '#4a3a2a', 'left'); if (d < 26) { g.strokeStyle = '#a02020'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, y + 14); g.lineTo(x + 28, y + 36); g.moveTo(x + 28, y + 14); g.lineTo(x + 6, y + 36); g.stroke(); g.strokeStyle = '#6a5a4a'; g.lineWidth = 1; } } }
    text(g, 'road out?', 128, 250, 'italic 14px serif', '#a02020'); });
  T.mapTopo = paper(g => { g.lineWidth = 1; for (let k = 0; k < 14; k++) { g.strokeStyle = k % 4 ? '#a08a6a' : '#7a5a3a'; g.beginPath(); for (let a = 0; a <= 6.3; a += 0.2) { const r = 12 + k * 9 + Math.sin(a * 3 + k) * 6; g.lineTo(120 + Math.cos(a) * r, 120 + Math.sin(a) * r * 0.8); } g.stroke(); } g.strokeStyle = '#a02020'; g.lineWidth = 3; g.beginPath(); g.moveTo(120, 120); g.quadraticCurveTo(160, 190, 200, 250); g.stroke(); g.beginPath(); g.moveTo(170, 200); g.lineTo(190, 214); g.moveTo(190, 200); g.lineTo(170, 214); g.stroke(); text(g, 'washed out', 200, 190, 'italic 12px serif', '#a02020'); });
  { const [c, g] = pc(256, 192); g.fillStyle = '#d8cdb0'; g.fillRect(0, 0, 256, 192);
    g.fillStyle = lg(g, 0, 0, 0, 120, [[0, '#8aa0b8'], [1, '#c8c0a8']]); g.fillRect(10, 10, 236, 172);
    g.fillStyle = '#6a7a8a'; g.beginPath(); g.moveTo(10, 110); g.lineTo(80, 50); g.lineTo(140, 90); g.lineTo(200, 40); g.lineTo(246, 90); g.lineTo(246, 182); g.lineTo(10, 182); g.fill();
    const fam = ['linda', 'luke', 'lily', 'rose', 'leon'];
    fam.forEach((k, i) => { const ch = G.CHARS[k], x = 40 + i * 44, hh = [86, 72, 80, 86, 96][i];
      g.fillStyle = ['#6e3a3c', '#222226', '#b9a4dc', '#4f71a8', '#c98f2a'][i]; g.beginPath(); g.roundRect ? g.roundRect(x - 13, hh, 26, 182 - hh, 6) : g.rect(x - 13, hh, 26, 182 - hh); g.fill();
      g.fillStyle = ch.skin; g.beginPath(); g.ellipse(x, hh - 13, 10, 12, 0, 0, 7); g.fill();
      g.fillStyle = ch.hair; g.beginPath(); g.ellipse(x, hh - 19, 11, 8, 0, Math.PI, 0); g.fill(); if (k === 'lily') g.fillRect(x - 11, hh - 19, 5, 30), g.fillRect(x + 6, hh - 19, 5, 30); if (k === 'linda') { g.beginPath(); g.arc(x, hh - 28, 5, 0, 7); g.fill(); }
      g.fillStyle = '#222'; g.fillRect(x - 5, hh - 14, 2, 2); g.fillRect(x + 3, hh - 14, 2, 2);
      g.strokeStyle = '#7a3030'; g.beginPath(); g.arc(x, hh - 8, 4, 0.3, 2.8); g.stroke(); });
    g.fillStyle = 'rgba(120,90,40,0.25)'; g.fillRect(0, 0, 256, 192); noise(c, g, 16); T.photo = mk(c, { clamp: true }); }

  // ---------------- gore ----------------
  const pool = (n, seed) => { sd = seed; const [c, g] = cv(256, 256); for (let i = 0; i < n; i++) blob(g, 128 + (R() - 0.5) * 120, 128 + (R() - 0.5) * 120, 26 + R() * 36, '#3a0202');
    blob(g, 128, 128, 72, '#3a0202'); g.globalAlpha = 0.6; for (let i = 0; i < n / 2; i++) blob(g, 128 + (R() - 0.5) * 80, 128 + (R() - 0.5) * 80, 12 + R() * 20, '#5e0505');
    g.globalAlpha = 0.5; for (let i = 0; i < 8; i++) blob(g, 128 + (R() - 0.5) * 80, 128 + (R() - 0.5) * 80, 3, '#b03030'); g.globalAlpha = 1; return mk(c, { clamp: true }); };
  T.pool = pool(10, 11); T.pool2 = pool(7, 23);
  { sd = 31; const [c, g] = cv(256, 256); blob(g, 128, 128, 20, '#4a0303');
    for (let i = 0; i < 200; i++) { const a = R() * Math.PI * 2, d = 18 + Math.pow(R(), 0.7) * 106, r = 1 + R() * 4.5 * (1 - d / 140);
      blob(g, 128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r, R() < 0.5 ? '#5a0404' : '#3a0202', 8);
      if (R() < 0.15) { g.strokeStyle = '#4a0303'; g.lineWidth = r; g.beginPath(); g.moveTo(128 + Math.cos(a) * d * 0.6, 128 + Math.sin(a) * d * 0.6); g.lineTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); g.stroke(); } }
    T.spatter = mk(c, { clamp: true }); }
  { const [c, g] = cv(256, 64); for (let i = 0; i < 28; i++) { g.strokeStyle = `rgba(${60 + R() * 30},2,2,${0.25 + R() * 0.5})`; g.lineWidth = 2 + R() * 7; g.beginPath(); const y = 14 + R() * 36; g.moveTo(R() * 20, y); for (let x = 0; x < 256; x += 16) g.lineTo(x, y + (R() - 0.5) * 6); g.stroke(); }
    g.globalCompositeOperation = 'destination-out'; const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.2)'); gr.addColorStop(0.8, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.9)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 64); const gv = g.createLinearGradient(0, 0, 0, 64); gv.addColorStop(0, 'rgba(0,0,0,1)'); gv.addColorStop(0.3, 'rgba(0,0,0,0)'); gv.addColorStop(0.7, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gv; g.fillRect(0, 0, 256, 64); g.globalCompositeOperation = 'source-over';
    T.smear = mk(c, { clamp: true }); }
  { const [c, g] = cv(128, 256); for (let i = 0; i < 20; i++) { const x = 10 + R() * 108, len = 30 + R() * 210, w = 1.5 + R() * 4; g.fillStyle = `rgba(${70 + R() * 30},3,3,${0.6 + R() * 0.4})`; g.fillRect(x, 0, w, len); g.beginPath(); g.arc(x + w / 2, len, w * 0.9, 0, 7); g.fill(); }
    blob(g, 64, 10, 40, 'rgba(70,3,3,0.9)'); T.drips = mk(c, { clamp: true }); }
  { const [c, g] = cv(128, 128); g.fillStyle = 'rgba(90,4,4,0.9)'; g.beginPath(); g.ellipse(64, 80, 24, 28, 0, 0, 7); g.fill();
    [[-22, -10, 0.5], [-10, -36, 0.2], [4, -40, 0], [17, -34, -0.2], [30, -18, -0.5]].forEach(([x, y, a]) => { g.save(); g.translate(64 + x, 70 + y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 6, 15, 0, 0, 7); g.fill(); g.restore(); });
    T.hand = mk(c, { clamp: true }); }
  { const [c, g] = cv(256, 256); g.fillStyle = '#8e1717'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) blob(g, R() * 256, R() * 256, 5 + R() * 16, R() < 0.5 ? '#6a0e0e' : '#a52222');
    g.strokeStyle = 'rgba(240,215,200,0.75)'; for (let i = 0; i < 22; i++) { g.lineWidth = 1 + R() * 4; g.beginPath(); let x = R() * 256, y = R() * 256; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 20; i++) blob(g, R() * 256, R() * 256, 3 + R() * 6, '#f0d8c8', 8);
    noise(c, g, 20); T.meat = mk(c); }
  { const [c, g] = cv(128, 128); g.fillStyle = '#5a2a13'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 16; i++) blob(g, R() * 128, R() * 128, 5 + R() * 10, R() < 0.5 ? '#7a2a18' : '#3e1a0a');
    g.strokeStyle = '#1a0a04'; g.lineWidth = 5; for (let k = -128; k < 256; k += 24) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 128, 128); g.stroke(); }
    g.strokeStyle = 'rgba(255,220,180,0.25)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(R() * 128, R() * 128); g.lineTo(R() * 128, R() * 128); g.stroke(); }
    noise(c, g, 18); T.steak = mk(c); }
  const bowlTex = (base, bits) => { const [c, g] = cv(128, 128); g.fillStyle = base; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 60; i++) blob(g, R() * 128, R() * 128, 2 + R() * 5, bits[i % bits.length], 8); noise(c, g, 14); return mk(c); };
  T.oats = bowlTex('#d8c8a0', ['#c8b890', '#e8dcc0', '#b8a070']);
  T.soup = bowlTex('#b8a060', ['#d8c890', '#8a7040', '#e8e0b0']);
  T.stew = bowlTex('#6a2a14', ['#8a3a1a', '#4a1a0a', '#c8a060', '#a04a20']);
  { const [c, g] = cv(128, 128); g.fillStyle = 'rgba(120,20,15,0.85)'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 26; i++) blob(g, R() * 128, R() * 128, 6 + R() * 12, R() < 0.5 ? '#8a1a14' : '#c84a3a'); for (let i = 0; i < 6; i++) blob(g, R() * 128, R() * 128, 4, '#f0e0c8', 8); noise(c, g, 16); T.jarMeat = mk(c); }
  { const [c, g] = cv(256, 256); g.fillStyle = 'rgba(230,235,240,0.35)'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(R() * 256, 0); g.quadraticCurveTo(R() * 256, 128, R() * 256, 256); g.stroke(); }
    for (let i = 0; i < 6; i++) { g.globalAlpha = 0.85; blob(g, 40 + R() * 180, 120 + R() * 120, 8 + R() * 22, '#5e0606'); }
    g.globalAlpha = 0.9; for (let i = 0; i < 6; i++) { g.fillStyle = '#5e0606'; g.fillRect(40 + R() * 180, 100 + R() * 60, 3, 40 + R() * 90); }
    g.globalAlpha = 1; T.plastic = mk(c, { clamp: true }); }
  { const [c, g] = cv(256, 256); g.fillStyle = '#d7d1c3'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 16; i++) { g.strokeStyle = 'rgba(120,110,95,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(R() * 256, 0); g.quadraticCurveTo(R() * 256, 128, R() * 256, 256); g.stroke(); }
    for (let i = 0; i < 8; i++) { g.globalAlpha = 0.85; blob(g, 50 + R() * 150, 50 + R() * 150, 26 + R() * 34, '#6e0909'); }
    g.globalAlpha = 0.7; for (let i = 0; i < 16; i++) blob(g, R() * 256, R() * 256, 6 + R() * 18, '#4a0505');
    g.globalAlpha = 1; noise(c, g, 10); T.sheet = mk(c); }

  // ---------------- fx ----------------
  { const [c, g] = cv(64, 64); g.fillStyle = rg(g, 32, 32, 0, 32, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'); g.fillRect(0, 0, 64, 64); T.glow = mk(c, { clamp: true, linear: true }); }
  { const [c, g] = cv(64, 64); g.fillStyle = rg(g, 32, 32, 4, 32, 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'); g.fillRect(0, 0, 64, 64); T.shadow = mk(c, { clamp: true, linear: true }); }
  { const [c, g] = cv(256, 128); for (let i = 0; i < 26; i++) { const x = 30 + R() * 196, y = 50 + R() * 40, r = 18 + R() * 30; g.fillStyle = rg(g, x, y, 0, r, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'); g.fillRect(x - r, y - r, r * 2, r * 2); } T.cloud = mk(c, { clamp: true }); }

  // ================= characters =================
  // Face atlas: head front is a planar projection (unit coords x,y in [-1,1] -> canvas centre +/- 0.47*S).
  // Corners hold the eyelash strip (top-left) and the mouth interior (bottom-right).
  const FS = Q.face || 512, FR = 0.47 * FS;
  const faceCache = {}, bodyCache = {}, eyeCache = {};
  const EX = {
    neutral: { sm: 0, op: 0 }, soft: { sm: 0.35, op: 0 }, happy: { sm: 0.8, op: 0.05, blush: 1 }, grin: { sm: 1, op: 0.25, blush: 1 },
    laugh: { sm: 1, op: 0.3, blush: 1.2 }, sad: { sm: -0.6, op: 0, rims: 1 }, worried: { sm: -0.35, op: 0.05 }, angry: { sm: -0.4, op: 0, tight: 1 },
    scared: { sm: -0.3, op: 0.2, rims: 0.6 }, tired: { sm: -0.1, op: 0 }, dark: { sm: -0.05, op: 0, dark: 1 }, creepy: { sm: 1.1, op: 0.15, dark: 0.7 },
    blood: { sm: 1.1, op: 0.15, dark: 0.7, blood: 1 }, yell: { sm: -0.2, op: 0.6 }, cry: { sm: -0.8, op: 0.1, rims: 1.4, tears: 1 },
    dead: { sm: -0.15, op: 0.05, dead: 1 }, rot: { sm: -0.3, op: 0.15, rot: 1 }, deadBlood: { sm: -0.15, op: 0.08, dead: 1, mouthBlood: 1 }
  };
  T.EX = EX;
  T.faceTex = function (key, expr) {
    const k = key + ':' + expr; if (faceCache[k]) return faceCache[k];
    const ch = G.CHARS[key], F = ch.face, e = EX[expr] || EX.neutral;
    const [c, g] = cv(FS, FS); g.scale(FS / 512, FS / 512);
    const S = 512, Rr = 0.47 * 512, X = ux => 256 + ux * Rr, Y = uy => 256 - uy * Rr;
    let skin = ch.skin;
    if (e.dead) skin = G.mixHex(ch.skin, '#c8c4c8', 0.55);
    if (e.rot) skin = '#8f9877';
    g.fillStyle = skin; g.fillRect(0, 0, S, S);
    // soft form colour: warmer cheeks/nose, cooler jaw, lighter forehead
    g.fillStyle = rg(g, X(0), Y(0.45), 10, 200, 'rgba(255,245,235,0.18)', 'rgba(255,245,235,0)'); g.fillRect(0, 0, S, S);
    g.fillStyle = rg(g, X(0), Y(-0.75), 10, 120, 'rgba(90,50,40,0.12)', 'rgba(90,50,40,0)'); g.fillRect(0, 0, S, S);
    if (!e.dead && !e.rot) { g.fillStyle = rg(g, X(0), Y(-0.18), 4, 60, 'rgba(220,110,95,0.22)', 'rgba(220,110,95,0)'); g.fillRect(0, 0, S, S); }
    // pores / mottling
    sd = key.length * 977 + 3; for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,70,50' : '255,235,220'},${0.03 + R() * 0.04})`; g.fillRect(R() * S, R() * S, 2, 2); }
    // eye sockets / under-eye
    const und = (F.tired ? 0.28 : 0.1) + (e.dark || 0) * 0.35 + (e.dead ? 0.25 : 0) + (e.rot ? 0.3 : 0);
    for (const s of [-1, 1]) {
      g.fillStyle = rg(g, X(s * 0.4), Y(0.06), 8, 62, `rgba(70,30,40,${0.18 + und * 0.5})`, 'rgba(70,30,40,0)'); g.fillRect(0, 0, S, S);
      g.fillStyle = rg(g, X(s * 0.4), Y(-0.06), 4, 40, `rgba(80,40,60,${und * 0.6})`, 'rgba(80,40,60,0)'); g.fillRect(X(s * 0.4) - 50, Y(-0.06) - 30, 100, 60);
      if (e.rims) { g.fillStyle = rg(g, X(s * 0.4), Y(0.06), 10, 38, `rgba(220,70,70,${0.3 * e.rims})`, 'rgba(220,70,70,0)'); g.fillRect(0, 0, S, S); }
    }
    // blush
    const bl = (e.blush || 0) * 0.32 + (F.cheek > 0 ? 0.12 : 0.05);
    if (!e.dead && !e.rot) for (const s of [-1, 1]) { g.fillStyle = rg(g, X(s * 0.5), Y(-0.22), 4, 70, `rgba(230,100,95,${bl})`, 'rgba(230,100,95,0)'); g.fillRect(0, 0, S, S); }
    // nose shading & nostrils
    for (const s of [-1, 1]) { g.fillStyle = rg(g, X(s * 0.1), Y(-0.05), 2, 40, 'rgba(110,60,45,0.16)', 'rgba(110,60,45,0)'); g.fillRect(0, 0, S, S); }
    g.fillStyle = e.rot ? '#2a2a1a' : '#5a2a22'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(X(s * 0.065), Y(-0.255), 8, 4.5, s * 0.4, 0, 7); g.fill(); }
    // freckles / stubble / wrinkles / bandaid
    if (F.freckles) { sd = 7; for (let i = 0; i < 70; i++) { const ux = (R() - 0.5) * 1.1, uy = -0.05 - R() * 0.3; if (Math.abs(ux) < 0.06 && uy > -0.2) continue; g.fillStyle = `rgba(150,80,50,${0.35 + R() * 0.35})`; g.beginPath(); g.arc(X(ux), Y(uy), 1.6 + R() * 1.6, 0, 7); g.fill(); } }
    if (F.stubble) { sd = 9; g.fillStyle = 'rgba(60,30,25,0.12)'; g.beginPath(); g.ellipse(X(0), Y(-0.68), 170, 95, 0, 0, 7); g.fill();
      for (let i = 0; i < 1600; i++) { const ux = (R() - 0.5) * 1.5, uy = -0.32 - R() * 0.7; if (Math.abs(ux) > 0.85 - (uy + 1) * 0.2) continue; if (uy > -0.42 && uy < -0.36) continue; g.fillStyle = `rgba(60,20,15,${0.25 + R() * 0.35})`; g.fillRect(X(ux), Y(uy), 1.5, 1.5); } }
    if (F.tired || e.rot) { g.strokeStyle = 'rgba(110,60,50,0.28)'; g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(s * 0.13), Y(-0.24)); g.quadraticCurveTo(X(s * 0.27), Y(-0.38), X(s * 0.25), Y(-0.5)); g.stroke(); for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(X(s * 0.62), Y(0.1 - k * 0.05)); g.lineTo(X(s * 0.74), Y(0.13 - k * 0.07)); g.stroke(); } }
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(X(-0.3), Y(0.48 + k * 0.06)); g.quadraticCurveTo(X(0), Y(0.5 + k * 0.06), X(0.3), Y(0.48 + k * 0.06)); g.stroke(); } }
    if (F.bandaid && !e.dead) { g.save(); g.translate(X(0.52), Y(-0.12)); g.rotate(-0.5); g.fillStyle = '#e0b890'; g.fillRect(-26, -9, 52, 18); g.fillStyle = '#c89a70'; g.fillRect(-9, -7, 18, 14); g.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = -22; i < 24; i += 6) g.fillRect(i, -6, 1.5, 1.5); g.restore(); }
    // lips
    const sm = e.sm || 0, lw = 0.235 * F.lip, my = -0.455, lipC = e.dead ? '#9a8a96' : e.rot ? '#4a2a2a' : G.mixHex(ch.skin, key === 'linda' ? '#9a4a46' : '#c0564e', 0.52);
    const cy = sm * 0.06, mid = -sm * 0.01;
    g.fillStyle = lipC;
    g.beginPath(); g.moveTo(X(-lw), Y(my + cy)); g.quadraticCurveTo(X(-lw * 0.5), Y(my + 0.075 + cy * 0.4), X(-0.035), Y(my + 0.068)); g.lineTo(X(0), Y(my + 0.055)); g.lineTo(X(0.035), Y(my + 0.068));
    g.quadraticCurveTo(X(lw * 0.5), Y(my + 0.075 + cy * 0.4), X(lw), Y(my + cy)); g.quadraticCurveTo(X(0), Y(my + mid + (e.tight ? 0 : 0.005)), X(-lw), Y(my + cy)); g.fill();
    g.fillStyle = G.shade(lipC, 0.08);
    g.beginPath(); g.moveTo(X(-lw * 0.92), Y(my + cy)); g.quadraticCurveTo(X(0), Y(my + mid - 0.012), X(lw * 0.92), Y(my + cy)); g.quadraticCurveTo(X(0), Y(my - (e.tight ? 0.06 : 0.11) + cy * 0.2), X(-lw * 0.92), Y(my + cy)); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(X(0), Y(my - 0.045), lw * Rr * 0.35, 4, 0, 0, 7); g.fill();
    g.strokeStyle = e.rot ? '#1a0a0a' : '#4a1818'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(-lw), Y(my + cy)); g.quadraticCurveTo(X(0), Y(my + mid - 0.01), X(lw), Y(my + cy)); g.stroke();
    if (sm > 0.5) { g.strokeStyle = 'rgba(110,60,50,0.3)'; g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.arc(X(s * (lw + 0.03)), Y(my + cy - 0.02), 10, s > 0 ? -1.2 : 1.9, s > 0 ? 1.0 : 4.2); g.stroke(); } }
    // gore overlays
    if (e.blood) { sd = 51; for (let i = 0; i < 70; i++) { const ux = 0.1 + (R() - 0.3) * 0.9, uy = (R() - 0.5) * 1.2; g.fillStyle = R() < 0.6 ? '#7a0606' : '#4a0303'; g.beginPath(); g.arc(X(ux), Y(uy), 1 + R() * 4, 0, 7); g.fill(); } g.fillStyle = 'rgba(110,4,4,0.8)'; g.fillRect(X(0.35), Y(-0.1), 3, 60); }
    if (e.mouthBlood) { g.fillStyle = '#5a0404'; g.beginPath(); g.moveTo(X(lw * 0.6), Y(my)); g.lineTo(X(lw * 0.85), Y(my - 0.4)); g.lineTo(X(lw * 0.5), Y(my - 0.1)); g.fill(); }
    if (e.rot) { sd = 61; for (let i = 0; i < 40; i++) { g.globalAlpha = 0.35; blob(g, R() * S, R() * S, 8 + R() * 26, R() < 0.5 ? '#4a4a5a' : '#3e4a2a'); }
      g.globalAlpha = 0.6; g.strokeStyle = '#2a3a3a'; g.lineWidth = 1.5; for (let i = 0; i < 26; i++) { g.beginPath(); let x = R() * S, y = R() * S; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = '#4a0505'; g.fillRect(X(0.05), Y(my), 5, 80); g.fillRect(X(-0.12), Y(my - 0.02), 3, 50); blob(g, X(-0.45), Y(0.5), 18, '#3a0a0a'); }
    if (e.tears) { g.fillStyle = 'rgba(200,220,255,0.35)'; for (const s of [-1, 1]) g.fillRect(X(s * 0.42) - 2, Y(-0.02), 4, 90); }
    // eyelash strip (top-left corner) and mouth interior (bottom-right corner)
    g.fillStyle = lg(g, 0, 0, 0, 64, [[0, skin], [0.7, G.shade(skin, -0.12)], [0.8, '#2a1a14'], [1, '#120a08']]); g.fillRect(0, 0, 18, 64);
    g.fillStyle = lg(g, 0, 448, 0, 512, [[0, '#2a0808'], [0.22, '#e8e2d4'], [0.36, '#d8d0c0'], [0.42, '#1a0404'], [0.8, '#4a0e10'], [1, '#7a2a2a']]); g.fillRect(448, 448, 64, 64);
    const t = mk(c, { clamp: true }); faceCache[k] = t; return t;
  };
  T.eyeTex = function (key, dead) {
    const k = key + (dead ? ':d' : ''); if (eyeCache[k]) return eyeCache[k];
    const ch = G.CHARS[key], [c, g] = cv(128, 64);
    g.fillStyle = dead ? '#d8d4cc' : '#f2eee8'; g.fillRect(0, 0, 128, 64);
    g.strokeStyle = 'rgba(200,80,80,0.35)'; for (let i = 0; i < 14; i++) { g.beginPath(); const x = R() < 0.5 ? 64 + R() * 60 : R() * 10; g.moveTo(x, 10 + R() * 44); g.lineTo(x + (R() - 0.5) * 14, 10 + R() * 44); g.stroke(); }
    const ix = 32, iy = 32, ir = 10.5;
    const iris = dead ? G.mixHex(ch.iris, '#a8aab0', 0.7) : ch.iris;
    g.fillStyle = rg(g, ix, iy, 2, ir, G.shade(iris, 0.25), G.shade(iris, -0.35)); g.beginPath(); g.arc(ix, iy, ir, 0, 7); g.fill();
    g.strokeStyle = G.shade(iris, -0.6); g.lineWidth = 1.2; g.beginPath(); g.arc(ix, iy, ir, 0, 7); g.stroke();
    for (let i = 0; i < 26; i++) { const a = i / 26 * 6.28; g.strokeStyle = `rgba(255,255,255,${0.1 + R() * 0.15})`; g.beginPath(); g.moveTo(ix + Math.cos(a) * 4, iy + Math.sin(a) * 4); g.lineTo(ix + Math.cos(a) * (ir - 1), iy + Math.sin(a) * (ir - 1)); g.stroke(); }
    g.fillStyle = dead ? 'rgba(30,30,30,0.5)' : '#080606'; g.beginPath(); g.arc(ix, iy, 4.2, 0, 7); g.fill();
    if (!dead) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(ix - 3, iy - 3, 1.6, 0, 7); g.fill(); }
    const t = mk(c); eyeCache[k] = t; return t;
  };

  // Body atlas (512): torso, legs, arms, shoes, skin, skirt, apron. u wraps around (0.5 = front), v runs bottom->top.
  T.REG = { torso: [0, 0, 256, 256], legs: [256, 0, 128, 256], arms: [384, 0, 128, 256], shoe: [0, 256, 128, 128], skin: [128, 256, 128, 128], skirt: [256, 256, 128, 128], apron: [384, 256, 128, 128] };
  T.bodyTex = function (key, variant = 'normal') {
    const k = key + ':' + variant; if (bodyCache[k]) return bodyCache[k];
    const ch = G.CHARS[key], BS = Q.body || 512, [c, g] = cv(BS, BS); g.scale(BS / 512, BS / 512);
    const rot = variant === 'rot', dead = variant === 'dead' || variant === 'deadRose';
    const skin = rot ? '#86906e' : dead ? G.mixHex(ch.skin, '#c8c4c8', 0.5) : ch.skin;
    const reg = n => { const [x, y, w, h] = T.REG[n]; return { x, y, w, h, U: u => x + u * w, V: v => y + (1 - v) * h }; };
    const fill = (r, col) => { g.fillStyle = col; g.fillRect(r.x, r.y, r.w, r.h); };
    const band = (r, v0, v1, col, u0 = 0, u1 = 1) => { g.fillStyle = col; g.fillRect(r.U(u0), r.V(v1), (u1 - u0) * r.w, (v1 - v0) * r.h); };
    const tv = yH => (yH - 0.47) / 0.395, lv = yH => (yH - 0.035) / 0.53, av = yH => (yH - 0.475) / 0.37;
    const knit = (r, v0, v1, col) => { for (let u = 0; u < 1; u += 0.05) { g.fillStyle = G.shade(col, -0.12); g.fillRect(r.U(u), r.V(v1), 2, (v1 - v0) * r.h); } };
    const denim = (r, v0, v1, col) => { band(r, v0, v1, col); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.08})`; g.fillRect(r.U(R()), r.V(v0 + R() * (v1 - v0)), 4, 1); } };
    const seam = (r, u, v0, v1, col = 'rgba(0,0,0,0.25)') => { g.fillStyle = col; g.fillRect(r.U(u) - 1, r.V(v1), 2, (v1 - v0) * r.h); };
    const T0 = reg('torso'), L = reg('legs'), A = reg('arms'), SH = reg('shoe'), SK = reg('skin'), SR = reg('skirt'), AP = reg('apron');
    fill(T0, skin); fill(L, skin); fill(A, skin); fill(SK, skin); fill(SR, '#5b4637'); fill(AP, '#ece4d2');
    if (rot) { sd = 77; for (const r of [T0, L, A, SK]) for (let i = 0; i < 30; i++) { g.globalAlpha = 0.4; blob(g, r.x + R() * r.w, r.y + R() * r.h, 4 + R() * 14, R() < 0.5 ? '#4a4a5a' : '#5e5a3a'); } g.globalAlpha = 1; }
    if (key === 'leon') {
      const H = '#c98f2a'; band(T0, tv(0.555), tv(0.83), H); knit(T0, tv(0.555), tv(0.575), H); band(T0, tv(0.555), tv(0.572), G.shade(H, -0.18));
      band(T0, tv(0.575), tv(0.65), G.shade(H, -0.1), 0.36, 0.64); g.strokeStyle = G.shade(H, -0.35); g.strokeRect(T0.U(0.36), T0.V(tv(0.65)), 0.28 * T0.w, (tv(0.65) - tv(0.575)) * T0.h);
      band(T0, tv(0.72), tv(0.83), '#e8e0c8', 0.47, 0.48); band(T0, tv(0.72), tv(0.83), '#e8e0c8', 0.52, 0.53);
      band(T0, tv(0.76), tv(0.835), G.shade(H, -0.25), 0, 0.14); band(T0, tv(0.76), tv(0.835), G.shade(H, -0.25), 0.86, 1);
      seam(T0, 0.25, tv(0.56), tv(0.82)); seam(T0, 0.75, tv(0.56), tv(0.82));
      denim(T0, 0, tv(0.555), '#3f5a86'); denim(L, lv(0.06), 1, '#3f5a86'); band(L, lv(0.25), lv(0.33), 'rgba(255,255,255,0.1)', 0.35, 0.65); seam(L, 0.25, 0, 1); seam(L, 0.75, 0, 1);
      band(A, 0.04, 1, H); band(A, 0.04, 0.11, G.shade(H, -0.18)); seam(A, 0.0, 0, 1);
      fill(SH, '#e8e8e8'); band(SH, 0, 0.3, '#3a3a40'); band(SH, 0.3, 0.42, '#2f7dff'); for (let i = 0; i < 4; i++) band(SH, 0.55 + i * 0.08, 0.58 + i * 0.08, '#888', 0.42, 0.58);
    } else if (key === 'luke') {
      const B = '#222226'; band(T0, tv(0.565), tv(0.825), B); band(T0, tv(0.81), tv(0.825), '#2e2e34');
      g.fillStyle = '#ff5fa8'; g.beginPath(); const hx = T0.U(0.5), hy = T0.V(tv(0.745)); g.moveTo(hx, hy + 16); g.bezierCurveTo(hx - 40, hy - 10, hx - 18, hy - 34, hx, hy - 16); g.bezierCurveTo(hx + 18, hy - 34, hx + 40, hy - 10, hx, hy + 16); g.fill();
      text(g, 'KAYLIE', T0.U(0.5), T0.V(tv(0.69)), 'bold 15px sans-serif', '#fff'); text(g, 'LIVE', T0.U(0.5), T0.V(tv(0.665)), 'bold 10px sans-serif', '#ffe14a');
      band(T0, tv(0.553), tv(0.568), '#4a3220'); band(T0, tv(0.553), tv(0.568), '#b0a070', 0.48, 0.52);
      denim(T0, 0, tv(0.553), '#545a3e'); denim(L, lv(0.08), 1, '#545a3e'); band(L, lv(0.3), lv(0.42), G.shade('#545a3e', -0.15), 0.18, 0.32); band(L, lv(0.3), lv(0.42), G.shade('#545a3e', -0.15), 0.68, 0.82); seam(L, 0.25, 0, 1); seam(L, 0.75, 0, 1);
      band(A, av(0.715), 1, B); band(A, av(0.715), av(0.73), '#2e2e34');
      for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(80,40,30,0.25)'; g.fillRect(A.U(R()), A.V(R() * av(0.7)), 1, 3); }
      fill(SH, '#5a3e28'); band(SH, 0, 0.25, '#2a1e14'); band(SH, 0.55, 1, '#4a3220');
    } else if (key === 'lily') {
      const S2 = '#b9a4dc'; band(T0, tv(0.54), tv(0.828), S2); for (let u = 0.04; u < 1; u += 0.09) { g.strokeStyle = G.shade(S2, -0.14); g.lineWidth = 3; g.beginPath(); for (let v = tv(0.54); v < tv(0.82); v += 0.02) g.lineTo(T0.U(u) + Math.sin(v * 60) * 3, T0.V(v)); g.stroke(); }
      band(T0, tv(0.805), tv(0.83), G.shade(S2, -0.1)); band(T0, tv(0.54), tv(0.56), G.shade(S2, -0.12));
      denim(T0, 0, tv(0.54), '#2f3754'); denim(L, lv(0.07), 1, '#2f3754'); seam(L, 0.25, 0, 1); seam(L, 0.75, 0, 1);
      band(A, 0.05, 1, S2); for (let u = 0.1; u < 1; u += 0.2) { g.fillStyle = G.shade(S2, -0.14); g.fillRect(A.U(u), A.V(1), 3, A.h); } band(A, 0.05, 0.12, G.shade(S2, -0.12));
      fill(SH, '#f0ece4'); band(SH, 0, 0.28, '#c8c0b0'); band(SH, 0.6, 0.64, '#ff6fb8');
    } else if (key === 'rose') {
      const W = '#ece8de', D = '#4f71a8'; band(T0, tv(0.5), tv(0.826), W); band(T0, tv(0.81), tv(0.826), '#d8d2c4');
      denim(T0, 0, tv(0.575), D); band(T0, tv(0.575), tv(0.74), D, 0.38, 0.62); band(T0, tv(0.575), tv(0.69), D, 0, 0.1); band(T0, tv(0.575), tv(0.69), D, 0.9, 1);
      band(T0, tv(0.74), tv(0.83), D, 0.4, 0.44); band(T0, tv(0.74), tv(0.83), D, 0.56, 0.6); band(T0, tv(0.62), tv(0.83), D, 0.05, 0.1); band(T0, tv(0.62), tv(0.83), D, 0.9, 0.95);
      g.fillStyle = '#e0c040'; for (const u of [0.42, 0.58]) { g.beginPath(); g.arc(T0.U(u), T0.V(tv(0.735)), 3, 0, 7); g.fill(); }
      const fx = T0.U(0.5), fy = T0.V(tv(0.67)); g.fillStyle = '#fff'; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; g.beginPath(); g.ellipse(fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, 5, 2.5, a, 0, 7); g.fill(); } g.fillStyle = '#f0c030'; g.beginPath(); g.arc(fx, fy, 3, 0, 7); g.fill();
      denim(L, lv(0.2), 1, D); band(L, lv(0.2), lv(0.24), G.shade(D, 0.15)); band(L, 0, lv(0.2), '#e8c020'); band(L, lv(0.18), lv(0.2), '#c8a010');
      band(A, av(0.725), 1, W); band(A, av(0.725), av(0.74), '#d8d2c4');
      fill(SH, '#e8c020'); band(SH, 0, 0.22, '#7a6010');
    } else if (key === 'linda') {
      const Bl = '#e5d8c4', Cd = '#6e3a3c'; band(T0, tv(0.58), tv(0.83), Cd); band(T0, tv(0.58), tv(0.835), Bl, 0.44, 0.56);
      g.fillStyle = '#b8a888'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(T0.U(0.5), T0.V(tv(0.62 + i * 0.05)), 2.5, 0, 7); g.fill(); }
      band(T0, tv(0.58), tv(0.835), G.shade(Cd, -0.2), 0.435, 0.445); band(T0, tv(0.58), tv(0.835), G.shade(Cd, -0.2), 0.555, 0.565); knit(T0, tv(0.58), tv(0.6), Cd);
      band(T0, 0, tv(0.58), '#5b4637');
      band(L, 0, 1, '#3b3232'); band(A, 0.04, 1, Cd); band(A, 0.04, 0.1, G.shade(Cd, -0.15));
      for (let u = 0; u < 1; u += 0.07) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(SR.U(u), SR.y, 4, SR.h); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(SR.U(u) + 5, SR.y, 3, SR.h); }
      fill(SH, '#3a2a22'); band(SH, 0, 0.2, '#1a120e');
      g.strokeStyle = '#b8ae98'; g.setLineDash([3, 3]); g.strokeRect(AP.x + 6, AP.y + 6, AP.w - 12, AP.h - 12); g.strokeRect(AP.x + 36, AP.y + 70, 56, 30); g.setLineDash([]);
      if (variant === 'blood') { sd = 91; for (let i = 0; i < 40; i++) blob(g, AP.x + 10 + R() * 108, AP.y + 20 + R() * 100, 3 + R() * 12, R() < 0.6 ? '#9c0c0c' : '#5e0505');
        for (let i = 0; i < 10; i++) { g.fillStyle = '#7a0707'; g.fillRect(AP.x + R() * 128, AP.y + 50 + R() * 40, 3, 20 + R() * 50); }
        for (let i = 0; i < 60; i++) blob(g, A.x + R() * A.w, A.y + R() * A.h * 0.4 + A.h * 0.55, 1 + R() * 3, '#7a0606', 8);
        g.globalAlpha = 0.85; blob(g, A.U(0.5), A.V(0.08), 22, '#6a0505'); g.globalAlpha = 1; }
    }
    if (rot) { sd = 81; for (let i = 0; i < 30; i++) { g.globalAlpha = 0.8; blob(g, T0.x + R() * T0.w, T0.y + R() * T0.h * 0.8 + 20, 8 + R() * 26, R() < 0.5 ? '#3a0505' : '#5a0a0a'); } g.globalAlpha = 1; for (let i = 0; i < 20; i++) blob(g, L.x + R() * L.w, L.y + R() * L.h, 4 + R() * 12, '#3a0505'); }
    if (dead) { sd = variant === 'deadRose' ? 93 : 95; for (let i = 0; i < 26; i++) { g.globalAlpha = 0.85; blob(g, T0.U(variant === 'deadRose' ? (R() < 0.7 ? R() * 0.2 + (R() < 0.5 ? 0 : 0.8) : R()) : R()), T0.V(tv(0.55 + R() * 0.28)), 6 + R() * 18, R() < 0.5 ? '#5e0505' : '#3a0303'); } g.globalAlpha = 1; }
    // skin region subtle detail (hands): knuckle shading + nails
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(150,80,60,0.08)'; g.fillRect(SK.x + R() * SK.w, SK.y + R() * SK.h, 6, 3); }
    noise(c, g, 10);
    const t = mk(c, { clamp: true }); bodyCache[k] = t; return t;
  };
  return T;
};
