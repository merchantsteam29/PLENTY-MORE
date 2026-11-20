// Unified input: keyboard + mouse (pointer lock), gamepad (standard mapping) and touch (virtual stick + look pad + buttons).
G.Input = (function () {
  const I = { mode: 'kbm', move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, sprint: false, use: false, usePressed: false, pausePressed: false, nav: 0, navPressed: 0, touch: false, sens: 1, invert: false };
  const keys = {}; let mdx = 0, mdy = 0, mouseDown = false, useEdge = false, pauseEdge = false, navEdge = 0;
  const $ = id => document.getElementById(id);
  I.keys = keys;
  addEventListener('keydown', e => {
    if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
    keys[e.code] = true; I.mode = 'kbm';
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') useEdge = true;
    if (e.code === 'Escape' || e.code === 'KeyP') pauseEdge = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') navEdge = -1; if (e.code === 'ArrowDown' || e.code === 'KeyS') navEdge = 1;
    if (e.code.startsWith('Digit')) I.digit = +e.code.slice(5);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });
  document.addEventListener('mousemove', e => { if (document.pointerLockElement) { mdx += e.movementX; mdy += e.movementY; I.mode = 'kbm'; } });
  document.addEventListener('mousedown', e => { if (document.pointerLockElement && e.button === 0) { mouseDown = true; useEdge = true; } });
  document.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; });

  // ---------- touch ----------
  const T = { stick: null, look: null, sx: 0, sy: 0, lx: 0, ly: 0, useHeld: false };
  I.initTouch = function (show) {
    if (I.touchReady) return; I.touchReady = true;
    const root = $('touch'), stick = $('tstick'), knob = $('tknob'), use = $('tuse'), pause = $('tpause'), run = $('trun');
    const pos = (e, el) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, r.width / 2]; };
    root.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return; I.mode = 'touch'; I.touch = true; root.classList.add('show');
      const t = e.target;
      if (t === use || use.contains(t)) { T.useHeld = true; useEdge = true; use.classList.add('on'); use.setPointerCapture(e.pointerId); T.useId = e.pointerId; e.preventDefault(); return; }
      if (t === pause) { pauseEdge = true; e.preventDefault(); return; }
      if (t === run) { T.run = !T.run; run.classList.toggle('on', T.run); e.preventDefault(); return; }
      if (e.clientX < innerWidth * 0.42 && !T.stick) { T.stick = e.pointerId; stick.style.left = (e.clientX - 60) + 'px'; stick.style.top = (e.clientY - 60) + 'px'; stick.style.opacity = 1; root.setPointerCapture(e.pointerId); }
      else if (!T.look) { T.look = e.pointerId; T.lx = e.clientX; T.ly = e.clientY; T.tap = performance.now(); T.tapX = e.clientX; T.tapY = e.clientY; root.setPointerCapture(e.pointerId); }
      e.preventDefault();
    }, { passive: false });
    root.addEventListener('pointermove', e => {
      if (e.pointerId === T.stick) { const r = stick.getBoundingClientRect(); let dx = e.clientX - (r.left + 60), dy = e.clientY - (r.top + 60); const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; T.sx = dx / m; T.sy = dy / m; }
      else if (e.pointerId === T.look) { mdx += (e.clientX - T.lx) * 1.6; mdy += (e.clientY - T.ly) * 1.6; T.lx = e.clientX; T.ly = e.clientY; }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      if (e.pointerId === T.stick) { T.stick = null; T.sx = T.sy = 0; knob.style.transform = ''; stick.style.opacity = 0.35; }
      if (e.pointerId === T.look) { T.look = null; if (performance.now() - T.tap < 220 && Math.hypot(e.clientX - T.tapX, e.clientY - T.tapY) < 12) useEdge = true; }
      if (e.pointerId === T.useId) { T.useHeld = false; use.classList.remove('on'); T.useId = null; }
    };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
    use.addEventListener('pointerup', end); use.addEventListener('pointercancel', end);
    root.style.display = 'block'; if (show) root.classList.add('show');
  };

  // ---------- gamepad ----------
  let padPrev = {}, padIdx = null;
  addEventListener('gamepadconnected', e => { padIdx = e.gamepad.index; I.mode = 'pad'; });
  addEventListener('gamepaddisconnected', () => { padIdx = null; if (I.mode === 'pad') I.mode = 'kbm'; });
  const dz = (v, d = 0.16) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
  I.rumble = (s = 0.6, w = 0.6, ms = 200) => { const gp = padIdx !== null && navigator.getGamepads ? navigator.getGamepads()[padIdx] : null; try { if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: w }); } catch (e) { /* ignore */ } if (navigator.vibrate && I.mode === 'touch') try { navigator.vibrate(ms); } catch (e) { /* ignore */ } };

  I.update = function (dt) {
    const k = c => (keys[c] ? 1 : 0);
    let mx = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'), my = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
    let lx = mdx * 0.0022 * I.sens, ly = mdy * 0.0022 * I.sens * (I.invert ? -1 : 1); mdx = mdy = 0;
    let sprint = keys.ShiftLeft || keys.ShiftRight, use = mouseDown || keys.KeyE || keys.Space || keys.Enter;
    if (I.mode === 'touch' || T.stick !== null) { mx += T.sx; my -= T.sy; use = use || T.useHeld; sprint = sprint || T.run || Math.hypot(T.sx, T.sy) > 0.97; }
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = padIdx !== null ? gps[padIdx] : null; if (!gp) for (const g of gps) if (g) { gp = g; padIdx = g.index; break; }
    if (gp) {
      const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0, 0.12), ry = dz(gp.axes[3] || 0, 0.12);
      const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const any = Math.abs(ax) + Math.abs(ay) + Math.abs(rx) + Math.abs(ry) > 0 || gp.buttons.some(x => x && x.pressed);
      if (any) I.mode = 'pad';
      mx += ax; my -= ay;
      const curve = v => Math.sign(v) * v * v;
      lx += curve(rx) * 2.6 * I.sens * dt; ly += curve(ry) * 2.0 * I.sens * dt * (I.invert ? -1 : 1);
      if (b(0) && !padPrev[0]) useEdge = true; if (b(9) && !padPrev[9]) pauseEdge = true; if (b(8) && !padPrev[8]) pauseEdge = true;
      if (b(12) && !padPrev[12]) navEdge = -1; if (b(13) && !padPrev[13]) navEdge = 1;
      if (Math.abs(ay) > 0.6 && !padPrev.ay) navEdge = ay < 0 ? -1 : 1; padPrev.ay = Math.abs(ay) > 0.6;
      use = use || b(0); sprint = sprint || b(10) || b(6) || b(7);
      for (let i = 0; i < 16; i++) padPrev[i] = b(i);
    }
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    I.move.x = mx; I.move.y = my; I.look.x = lx; I.look.y = ly; I.sprint = !!sprint; I.use = !!use;
    I.usePressed = useEdge; I.pausePressed = pauseEdge; I.navPressed = navEdge;
    useEdge = false; pauseEdge = false; navEdge = 0;
  };
  I.glyph = () => (I.mode === 'pad' ? 'Ⓐ' : I.mode === 'touch' ? '✋' : 'E');
  return I;
})();
