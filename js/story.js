// The story. Three days in the garden, three dinners, one basement.
G.story = async function (E) {
  const { linda, luke, lily, rose } = E.npc;
  const W = E.W, A = E.A, P = E.P;
  const say = E.say;
  const think = (t, o = {}) => say('leon', t, Object.assign({ thought: true }, o));
  const kids = { luke, lily, rose };

  // Paths
  const DOOR_IN = [[0, 6.3], [0, 4.4], [2.15, 3.2], [2.15, -1.6], [4.3, -2.9], [5.35, -2.95], [5.35, -4.25]];
  const STOVE = [-2.15, -3.75];
  const toBasement = async (n, from) => {
    await E.walk(n, (from || []).concat(DOOR_IN));
    n.hide();
  };
  const emerge = async () => {
    W.setDoor(true); A.creak(5.35, 1, -3.6);
    linda.place(5.35, -4.3, 0, 'stand', 0);
    await E.walk(linda, [[5.35, -2.85]]);
    W.setDoor(false); A.doorShut(5.35, 1, -3.6);
    await E.walk(linda, [[3.0, -2.6], [-1.0, -2.7], STOVE]);
    linda.yaw = Math.PI; linda.anim = 'cook';
    W.panMeat.visible = true; E.sizzle = true;
  };
  let day = 1;
  const resetPlates = () => { for (const k in W.plates) { const p = W.plates[k]; p.group.visible = false; p.steak.scale.set(1, 1, 1); } };
  const startDay = (preset) => {
    E.setTime(preset); E.sizzle = false; W.panMeat.visible = false; resetPlates();
    for (const n of [linda, luke, lily, rose]) { n.hide(); n.axe.visible = false; n.lookP = false; }
    E.teleport(11.7, 1.1, 0.35, -0.3);
  };

  async function dinner(present, bites) {
    E.objective('Sit down for dinner');
    const s = W.seats.leon;
    await E.interact({ x: s.x, y: 0.7, z: s.z, r: 2.4, dot: 0.8, label: 'Sit down' });
    await E.fade(1, 0.6);
    E.setTime('night'); E.sizzle = false; W.panMeat.visible = false;
    linda.sit('linda', 'eat'); linda.lookP = false;
    for (const k in kids) kids[k].hide();
    present.forEach(k => kids[k].sit(k, 'eat'));
    for (const k of ['linda', 'leon'].concat(present)) W.plates[k].group.visible = true;
    E.sit('leon');
    A.clink();
    await E.wait(0.4);
    await E.fade(0, 0.9);
    E.objective('');
    const plate = W.plates.leon;
    for (let i = 0; i < bites.length; i++) {
      await E.interact({ x: plate.x, y: 0.82, z: plate.z, r: 1.8, dot: 0.8, label: 'Eat' });
      A.chew();
      plate.steak.scale.set(1 - (i + 1) * 0.3, 1, 1 - (i + 1) * 0.25);
      await E.wait(1.1);
      await bites[i]();
    }
  }

  // ===================== DAY 1 =====================
  startDay('day1');
  luke.place(-8, 6.75, 0, 'chop'); luke.axe.visible = true;
  linda.place(STOVE[0], STOVE[1], Math.PI, 'cook');
  lily.place(-2.6, 5.55, 0, 'read');
  rose.place(-3.9, 10.0, 0, 'laundry');
  document.getElementById('fade').style.opacity = 1;
  await E.wait(0.5);
  E.fade(0, 2.5);
  await E.title('DAY 1', 'The pass road washed out six weeks ago. The pantry is almost empty.', 3);
  await think('Mom says if the garden dies, we die. So... no pressure.');
  await E.chore('water', 2, n => `Water the carrots  ${n}/4`);

  // Mom takes Luke
  await E.walk(linda, [[-2.15, -3.0], [-2.6, -1.0], [-2.6, 2.2], [-1.0, 3.6], [0, 4.6], [0, 6.3], [-3.0, 7.7], [-7.0, 7.7]]);
  luke.anim = 'stand'; luke.face(linda.x, linda.z); linda.face(luke.x, luke.z);
  await say('linda', 'Luke, honey. Come help me with something down in the basement.');
  await say('luke', "Sure, Mom. Just let me put the axe down.");
  luke.axe.visible = false; W.blockAxe.visible = true;
  W.setDoor(true);
  const goL = toBasement(luke, [[-6.5, 7.9], [-3, 7.9]]);
  await E.wait(0.5);
  const goM = toBasement(linda, [[-3, 7.6]]);
  Promise.all([goL, goM]).then(() => { W.setDoor(false); });

  await E.chore('water', 4, n => `Water the carrots  ${n}/4`);
  await think("There. They actually look alive now.");
  await E.chore('weed', 3, n => `Pull the weeds  ${n}/3`);
  E.objective('');
  await think("Done. Mom's going to be happy.");
  await E.fade(1, 1.2);
  await E.title('10 minutes later...', '', 1.6);
  await goM;
  E.setTime('eve');
  lily.place(2.95, 2.4, Math.PI / 2, 'read');
  rose.place(-5.25, 2.9, -Math.PI / 2, 'stand');
  W.blockAxe.visible = true;
  await E.fade(0, 1.2);
  E.objective('Go inside');
  await E.until(() => E.inside());
  E.objective('');
  await emerge();
  E.objective('Talk to Mom');
  await E.talk(linda, 'Talk to Mom');
  E.objective('');
  linda.anim = 'stand'; linda.face(P.x, P.z);
  await say('leon', "Where's Luke?");
  await say('linda', 'Luke is finishing something down there.');
  await say('linda', 'Go wash up, sweetie. I got us something special for dinner tonight.', { mood: 'smile' });
  linda.yaw = Math.PI; linda.anim = 'cook';
  await E.wait(0.6);
  await think("Is that... meat? We haven't had meat since the road washed out.");
  await think('Where did she even get it?');
  await think("...I shouldn't ask. She looks so tired lately.");
  await dinner(['lily', 'rose'], [
    async () => { await think('...Oh wow.'); await think("It's good. Like, really good."); },
    async () => { await say('rose', 'Should we save some for Luke?'); await say('linda', 'Luke already ate, honey.', { mood: 'smile' }); },
    async () => { await say('lily', 'Mom, this is amazing.'); await say('linda', "Eat up. There's plenty more.", { mood: 'smile' }); }
  ]);
  await E.fade(1, 1.5);

  // ===================== DAY 2 =====================
  startDay('day2'); day = 2;
  linda.place(STOVE[0], STOVE[1], Math.PI, 'cook');
  rose.place(-2.6, 5.55, 0, 'read');
  W.blockAxe.visible = true;
  await E.wait(0.5);
  E.fade(0, 2.5);
  await E.title('DAY 2', 'Clouds rolled in overnight. Luke never came up for breakfast.', 3);
  await E.chore('potato', 2, n => `Dig up the potatoes  ${n}/4`);

  // Lily brings cocoa
  const cocoa = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), G.mat('#c84a3a', 30));
  cocoa.position.set(0, -0.05, 0.06); lily.p.hands[0].add(cocoa);
  lily.place(0, 4.6, 0, 'carry'); lily.p.carry = true;
  const tx = P.x - 0.9, tz = P.z + 0.3;
  E.objective('');
  await E.walk(lily, [[0, 6.3], [4.5, 7.4], [7.6, 2.1], [9.0, 2.1], [tx, tz]], 1.35, 'carry');
  P.locked = true;
  lily.face(P.x, P.z);
  await E.look(lily.x, 1.45, lily.z, 0.8);
  await say('lily', 'Hey, Leon. Made you some hot cocoa.');
  await say('lily', "Last packet in the cupboard. Don't tell Rose.");
  cocoa.visible = false; lily.p.carry = false; lily.anim = 'stand';
  E.showMug(true); A.sip();
  await say('leon', "Thanks, Lily. It's really warm.");
  await say('lily', "Your garden's looking good. Better than anything I could grow.");
  await say('leon', "Somebody has to. The road isn't opening anytime soon.");
  linda.place(0.3, 6.6, Math.PI * 0.75, 'stand');
  await E.wait(0.6);
  await say('lily', 'Leon... do you know where Mom got that meat?');
  await say('leon', 'No. Also, where did Luke g-', { auto: 0.05, speed: 40 });
  linda.anim = 'yell';
  await say('linda', 'LILY! WE NEED YOU IN THE BASEMENT! COME HELP!', { yell: true, mood: 'yell' });
  linda.anim = 'stand';
  lily.face(linda.x, linda.z);
  await say('lily', 'COMING!', { yell: true, mood: 'yell' });
  lily.face(P.x, P.z);
  await say('lily', 'See you, Leon...');
  P.locked = false;
  E.showMug(true, 6);
  W.setDoor(true);
  const goLily = (async () => {
    await E.walk(lily, [[9.0, 2.1], [7.6, 2.1], [4.5, 7.2], [1.1, 7.0]]);
    linda.face(lily.x, lily.z);
    await Promise.all([toBasement(lily, [[0, 6.3]]), (async () => { await E.wait(0.6); await toBasement(linda, []); })()]);
    W.setDoor(false);
  })();
  await E.chore('potato', 4, n => `Dig up the potatoes  ${n}/4`);
  await think('...Where did Luke go?');
  E.objective('Bring the potatoes inside');
  await goLily;
  linda.place(STOVE[0], STOVE[1], Math.PI, 'cook'); W.panMeat.visible = true; E.sizzle = true;
  rose.place(2.95, 2.4, Math.PI / 2, 'read');
  E.setTime('eve');
  await E.until(() => E.inside());
  await think("Lily's not here...");
  E.objective('Talk to Mom');
  let doorTried = false;
  const tryDoor = async () => {
    while (!doorTried) {
      await E.interact({ x: 5.35, y: 1.0, z: -3.6, r: 2.0, label: 'Open the basement door', active: () => !doorTried && !P.seat && day === 2 });
      if (doorTried) return;
      A.locked();
      await think("Locked.");
      for (let i = 0; i < 3; i++) { A.chop(0, -2.4, -1, true); await E.wait(0.9); }
      await think('...What are they doing down there?');
      doorTried = true;
    }
  };
  tryDoor();
  await E.talk(linda, 'Talk to Mom');
  linda.anim = 'stand'; linda.face(P.x, P.z);
  await say('leon', "Mom, where's Lily?");
  await say('linda', "Lily's helping your brother with something. They'll be up later.");
  await say('linda', 'Sit down, sweetie. Dinner is ready.', { mood: 'smile' });
  linda.yaw = Math.PI; linda.anim = 'cook';
  await dinner(['rose'], [
    async () => { await think("It's even better than last night..."); },
    async () => { await say('rose', "It's so quiet without them."); await say('linda', "They're closer than you think, honey.", { mood: 'smile' }); },
    async () => { await think("I can't stop eating it."); await say('linda', "There's plenty more.", { mood: 'smile' }); }
  ]);
  await E.fade(1, 1.5);

  // ===================== DAY 3 =====================
  startDay('day3'); day = 3;
  linda.place(1.2, 6.5, Math.PI * 0.35, 'stand');
  W.blockAxe.visible = true;
  await E.wait(0.5);
  E.fade(0, 2.5);
  await E.title('DAY 3', 'Nobody came up from the basement.', 3);
  await E.chore('tomato', 2, n => `Pick the tomatoes  ${n}/4`);
  rose.place(0, 4.6, 0, 'stand');
  E.objective('');
  await E.walk(rose, [[0, 5.8], [0.6, 6.3]]);
  rose.face(linda.x, linda.z); linda.face(rose.x, rose.z);
  await say('rose', 'Mom, can I see what Luke and Lily are doing?');
  await say('linda', 'Sure, hun. Come down to the basement.', { mood: 'smile' });
  W.setDoor(true);
  const goRose = Promise.all([toBasement(rose, [[0, 6.3]]), (async () => { await E.wait(0.7); await toBasement(linda, []); })()]).then(() => W.setDoor(false));
  await E.wait(1.5);
  await think('Rose too...?');
  await E.chore('tomato', 4, n => `Pick the tomatoes  ${n}/4`);
  await think("They're so red this year.");
  E.objective('Go inside');
  await goRose;
  E.setTime('eve');
  linda.p.apronMat.map = E.T.apronBlood; linda.p.apronMat.needsUpdate = true;
  await E.until(() => E.inside());
  E.objective('');
  await emerge();
  linda.anim = 'stand'; linda.face(P.x, P.z);
  await E.look(linda.x, 1.2, linda.z, 0.7);
  await think('Is that... ketchup?');
  await say('linda', "Don't mind the mess, sweetie. Ketchup.", { mood: 'blood' });
  await say('linda', 'Sit down. Tonight is extra special.', { mood: 'blood' });
  linda.yaw = Math.PI; linda.anim = 'cook';
  await dinner([], [
    async () => { await think('Better than ever. So tender it falls apart.'); },
    async () => { linda.anim = 'sit'; linda.lookP = true; linda.keepLook = true; await think("Mom isn't eating. She's just... watching me."); },
    async () => {
      await say('leon', 'Mom, where are Lily, Luke and Rose? Can I go see them?');
      E.dread = 0.05;
      await E.wait(1.4);
      await say('linda', '...Of course you can, sweetie.', { mood: 'dark' });
      await say('linda', "They're all downstairs. Come on.", { mood: 'dark' });
    }
  ]);

  // ===================== THE BASEMENT =====================
  linda.keepLook = false; linda.lookP = false;
  E.stand(2.1, 0.3); P.yaw = Math.PI / 2; P.pitch = -0.1;
  W.bodies.group.visible = true; W.decals.visible = true;
  await E.walk(linda, [[-1.9, -1.2], [3.4, -2.6], [5.35, -2.9]]);
  W.setDoor(true); A.creak(5.35, 1, -3.6);
  E.objective('Follow Mom');
  await E.walk(linda, [[5.35, -4.25], [4.7, -4.25], [0.5, -4.25], [-0.6, -4.1]], 1.0);
  linda.face(0.8, -4.2); linda.lookP = true; linda.keepLook = true;
  await E.until(() => P.y < -2.3);
  E.objective('');
  E.dread = 0;
  let beating = true;
  (async () => { while (beating) { A.heartbeat(0.9); await E.wait(0.85); } })();
  const near = () => Math.hypot(P.x - -2.3, P.z - 0.3) < 2.6 || Math.hypot(P.x - -0.8, P.z - -1.6) < 1.5;
  await E.until(near);
  P.locked = true;
  A.sting();
  await E.look(-2.4, -1.85, 0.4, 1.4);
  await say('leon', 'Luke...?', { mood: 'scared' });
  await E.look(-2.6, -2.7, 1.8, 0.9);
  await say('leon', 'Lily...?', { mood: 'scared' });
  await E.look(-0.7, -2.7, -1.7, 0.7);
  await say('leon', 'ROSE?!', { mood: 'scared', yell: true });
  await E.look(-2.2, -1.9, 0.35, 1.2);
  await say('leon', 'wait...', { mood: 'scared' });
  await say('leon', 'is this where dinner came from...', { mood: 'scared' });
  await say('leon', '...i ate them?', { mood: 'scared' });
  beating = false;
  E.droneTc = 0.02; E.dread = 0;
  W.wallAxe.visible = false;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  linda.keepLook = false; linda.lookP = false;
  linda.place(P.x - fx * 0.85, P.z - fz * 0.85, Math.atan2(fx, fz), 'axeUp', P.y);
  linda.axe.visible = true;
  await E.wait(0.5);
  A.npcStep(linda.x, linda.y, linda.z, 'wood');
  await E.wait(0.9);
  linda.anim = 'axeDown';
  await E.hit();
  await E.wait(1.6);
  linda.anim = 'stand';
  await E.wait(1.8);
  await E.fade(1, 2.5);
  E.clearFx();
  await E.wait(2.2);

  // ===================== SUPPER =====================
  E.setTime('night'); E.droneTc = 1.2;
  for (const k in kids) kids[k].hide();
  W.bodies.group.visible = false;
  resetPlates();
  linda.axe.visible = false;
  linda.sit('linda', 'eat');
  const spots = [[-0.85, -0.05], [-0.85, 0.65], [-0.42, 0.12], [-0.42, 0.5]];
  ['luke', 'lily', 'rose', 'leon'].forEach((k, i) => { const p = W.plates[k]; p.group.position.set(spots[i][0], 0.795, spots[i][1]); p.group.visible = true; });
  E.cam(2.4, 1.35, 0.3, -1.65, 1.15, 0.3);
  P.locked = true;
  A.musicBox(10.5);
  await E.fade(0, 2);
  const cam = E.camera;
  await E.tween(8, k => { cam.position.set(2.4 - k * 2.0, 1.35 - k * 0.12, 0.3); cam.lookAt(-1.65, 1.15 - k * 0.05, 0.3); }, k => k * (2 - k));
  linda.anim = 'sit';
  linda.keepLook = true; linda.lookP = true;
  linda.p.setFace('smile');
  await E.wait(1.6);
  document.getElementById('fade').style.opacity = 1;
  A.thud();
  await E.wait(2.5);
  E.end();
};
