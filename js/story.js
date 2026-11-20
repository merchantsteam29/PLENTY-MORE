// The story. Four days on the mountain, then the basement.
// Every spoken line goes through say(who, text, opts) or think(text) with a literal string,
// so tools/voice-script.js can pull them into the recording script (line ids are hashes of who + text).
G.story = async function (E, startDay = 1) {
  const { linda, luke, lily, rose } = E.npc;
  const W = E.W, A = E.A, P = E.P, T = E.T;
  const say = E.say, think = E.think, wait = E.wait, choose = E.choose;
  const kids = { luke, lily, rose }, fam = [linda, luke, lily, rose];
  let flavorStop = [];

  // ---------------- helpers ----------------
  const fadeOut = (d = 1) => E.fade(1, d), fadeIn = (d = 1.2) => E.fade(0, d);
  const hideAll = () => fam.forEach(n => { n.hide(); n.P.drop('R'); n.P.drop('L'); n.lookTarget = null; n.lookPlayer = false; n.P.sleep = false; n.P.setExpr(G.CHARS[n.key].base); });
  const prop = (n, name, hand = 'R', pos, rot) => n.P.hold(G.makeProp(name, T), hand, pos, rot);
  const PHONE = [[-0.01, -0.07, 0.03], [1.3, -0.2, 1.5]], AXE = [[0.0, -0.06, -0.05], [0, 0, 0]], CAN = [[0, -0.09, 0.04], [0, 0, 0]], BOOK = [[-0.02, -0.07, 0.06], [0, 0.3, 0]], MUG = [[0, -0.07, 0.04], [0, 0, 0]], KNIFE = [[0, -0.07, 0.02], [0.3, 0, 0]], BRUSH = [[0, -0.07, 0.02], [0.4, 0, 0]], CROWN = [[0.0, -0.08, 0.1], [0, 0, 0]];
  const flavor = (defs) => { for (const d of defs) { let n = 0; const h = E.addInteract(Object.assign({ r: 2.2, dot: 0.88 }, d, { active: () => !E._busy && (!d.active || d.active()), cb: async () => { if (E._busy) return; E._busy = true; if (!d.repeat) h.stop(); try { await (n > 0 && d.again ? d.again : d.run)(n++); } finally { E._busy = false; } } })); flavorStop.push(h.stop); } };
  const clearFlavor = () => { flavorStop.forEach(f => f()); flavorStop = []; };
  const prompt = (label) => E.interact({ label, noOcc: true, r: 99, dot: -2, get: () => { const c = E.camera, d = new THREE.Vector3(); c.getWorldDirection(d); return [c.position.x + d.x, c.position.y + d.y, c.position.z + d.z]; } });
  const goNear = (x, z, r = 2.5, y) => E.until(() => E.near(x, z, r, y));
  const tex2url = t => { try { return t.image.toDataURL(); } catch (e) { return ''; } };
  const setup = (day) => {
    clearFlavor(); hideAll(); E.give(null); E.amb = {}; E.allow.basement = false; E.lock(false); E.letterbox(false); E.hud(true); E.phoneLight = null;
    for (const k in W.plates) W.food(k, null);
    W.meatJars.visible = day >= 3; W.lukePhone.visible = day >= 3; W.lukePhoneScreen.visible = day === 3; W.lilyBook.visible = day >= 4; W.roseCrown.visible = false;
    W.lockDoor('basement', true); W.setDoor('basement', false); W.decals.visible = false; W.flies.visible = false; W.curtainGore.visible = false; W.bodies.group.visible = false; W.curtain.scale.x = 1; W.curtainCol.on = true;
    W.panMeat.visible = false; W.prepMeat.visible = false; W.potFill.material.map = T.soup; W.pot.visible = true; W.wallAxe.visible = true; W.blockAxe.visible = true; W.can.visible = true;
    linda.P.setVariant('normal'); E.flags.day = day; E.save(day);
    // garden state carries forward
    const done = (type, upto) => W.chores[type].forEach((c, i) => { if (i < upto && !c.done) { c.done = true; fx[type](c, true); } });
    if (day >= 2) { done('water', 4); done('weed', 5); }
    if (day >= 4) done('potato', 4);
  };
  // chores: hold-to-do interactions on garden items
  const fx = {
    water(c, inst) { c.wet.visible = true; c.wet.material.transparent = true; if (inst) { c.wet.material.opacity = 1; c.leaves.forEach(l => { l.material = c.leafM; l.rotation.z *= 0.4; }); return; } A.water(); E.tween(1.4, k => { c.wet.material.opacity = k; c.leaves.forEach((l, i) => { l.rotation.z = (i - 2.5) * 0.45 * (1 - k * 0.6); if (k > 0.5) l.material = c.leafM; }); }); },
    weed(c, inst) { if (inst) { c.group.visible = false; return; } A.pull(); E.tween(0.5, k => { c.group.position.y = 0.05 + k * 0.6; c.group.scale.setScalar(1 - k); }).then(() => (c.group.visible = false)); },
    potato(c, inst) { if (inst) { c.bush.visible = false; return; } A.dig(); c.tubers.forEach(t => (t.visible = true)); E.tween(0.9, k => { c.bush.rotation.z = k * 1.2; c.bush.position.y = 0.15 + Math.sin(k * Math.PI) * 0.3; c.tubers.forEach((t, i) => (t.position.y = Math.sin(k * Math.PI) * (0.25 + i * 0.05))); }).then(() => { A.pop(); c.bush.visible = false; c.tubers.forEach(t => (t.visible = false)); }); },
    tomato(c, inst) { c.toms.forEach((t, i) => (inst ? (t.visible = false) : setTimeout(() => { A.squish(); t.visible = false; }, i * 160))); },
    flower(c) { A.pick(); E.tween(0.4, k => { c.group.scale.setScalar(1 - k); }).then(() => (c.group.visible = false)); }
  };
  const chore = (type, upto, label, verb, hold, tick) => new Promise(res => {
    const items = W.chores[type], count = () => items.filter(c => c.done).length, hs = [];
    E.objective(label(count())); if (count() >= upto) return res();
    for (const c of items) if (!c.done) {
      const h = E.addInteract({ x: c.x, y: c.y, z: c.z, r: 2.5, dot: 0.85, label: verb, hold, tick, active: () => !E._busy,
        cb: () => { h.stop(); c.done = true; fx[type](c); E.objective(label(count())); if (count() >= upto) { hs.forEach(x => x.stop()); res(); } } });
      hs.push(h);
    }
  });
  let tickT = 0;
  const pumpTick = (p, dt) => { W.pumpHandle.rotation.x = Math.sin(p * 18) * 0.45; tickT -= dt; if (tickT <= 0) { tickT = 0.45; A.pump(); } };
  const digTick = (p, dt) => { tickT -= dt; if (tickT <= 0) { tickT = 0.35; A.dig(); } };
  const waterTick = (p, dt) => { tickT -= dt; if (tickT <= 0) { tickT = 0.3; A.water(); } };
  // meals
  async function meal(o) {
    E.objective(o.objective || 'Sit down at the table');
    const s = W.seats.leon;
    if (!o.skipSit) await E.interact({ x: s.x, y: 0.75, z: s.z, r: 2.4, dot: 0.75, label: 'Sit down', noOcc: true });
    await fadeOut(0.6);
    if (o.time) E.setTime(o.time, o.lights ? { lights: o.lights } : undefined);
    hideAll();
    linda.place('linda', o.momAnim || 'sitTable'); W.food('linda', o.momFood || 'empty');
    for (const k of o.kids) { kids[k].place(k, 'sitTable'); W.food(k, o.food); }
    W.food('leon', o.food); E.sit('leon'); A.clink(); E.objective('');
    if (o.setup) o.setup();
    await wait(0.3); await fadeIn(0.9);
    for (let i = 0; i < o.bites.length; i++) {
      const p = W.plates.leon;
      await E.interact({ x: p.x, y: 0.85, z: p.z, r: 2.0, dot: 0.75, label: o.verb || 'Eat', noOcc: true });
      A.chew(); W.eat('leon', (i + 1) / o.bites.length);
      for (const k of o.kids) if (kids[k].P.anim === 'sitTable' || kids[k].P.anim === 'eat') { kids[k].anim('eat'); W.eat(k, (i + 1) / o.bites.length * 0.9); }
      await wait(0.9);
      await o.bites[i]();
    }
    if (o.after) await o.after();
  }
  async function sleepScene(o) {
    await fadeOut(1.2);
    E.setTime(o.time || 'night', { lights: o.lights || ['fairy', 'bedroom'] }); hideAll();
    for (const k of o.kids) { kids[k].place('bed_' + k, 'lie'); kids[k].P.sleep = false; }
    E.bed({ pitch: 0.55 }); await wait(0.4); await fadeIn(1.4);
    await o.talk();
  }

  // ======================================================================
  // DAY 1 — six weeks after the storm
  // ======================================================================
  async function day1() {
    setup(1);
    document.getElementById('fade').style.opacity = 1;
    E.setTime('morning'); E.music('home');
    luke.place('bedEdge_luke', 'phoneSit'); prop(luke, 'phone', 'R', ...PHONE);
    lily.place('bedEdge_lily', 'brush'); prop(lily, 'brush', 'R', ...BRUSH);
    rose.place('rosePots', 'water'); prop(rose, 'can', 'R', ...CAN);
    linda.place('stove', 'cook');
    E.bed();
    await wait(0.6);
    await E.title('DAY 1', 'Six weeks since the storm took out the pass road. Nobody has come up the mountain since.', 3.2);
    await fadeIn(2.5);
    await think('...Morning already.');
    luke.lookPlayer = true;
    await say('luke', "Chat, he's awake. Say hi to Leon, chat.", { mood: 'grin' });
    await say('leon', 'Who are you talking to?');
    await say('luke', "My chat. Well. Imaginary chat. No signal up here. But they're with me in spirit.");
    const c1 = await choose(['Hi, chat.', "You're so weird, Luke."]);
    if (c1 === 0) { await say('leon', 'Hi, chat.'); await say('luke', 'See? He gets it. Chat loves you, little man.', { mood: 'grin' }); }
    else { await say('leon', "You're so weird, Luke."); await say('luke', "Weird gets you subscribers. Kaylie says that. Okay, she doesn't. But she would."); }
    luke.lookPlayer = false; luke.anim('phoneSit');
    lily.lookPlayer = true;
    await say('lily', 'Morning, sleepyhead. You were talking in your sleep again.', { mood: 'soft' });
    await say('leon', 'What did I say?');
    await say('lily', 'Something about pancakes. With syrup. You were very serious about the syrup.', { mood: 'happy' });
    await think('My stomach hurts just hearing the word.');
    lily.lookPlayer = false;
    rose.lookPlayer = true;
    await say('rose', "Don't step on my lupines when you get up.");
    await say('leon', "They're in a pot, Rose.");
    await say('rose', "Then don't step on the pot.", { mood: 'angry' });
    await say('rose', "When they bloom I'm planting them by the porch. So it's the first thing anyone sees when they come up the road.", { mood: 'happy' });
    await say('luke', 'If anyone comes up the road.');
    await say('rose', 'They will.', { mood: 'angry' });
    await say('lily', 'They will, Rose.', { mood: 'soft' });
    rose.lookPlayer = false;
    await wait(0.4);
    await say('linda', 'Breakfast! Come down while it\'s warm!', { look: false });
    await say('luke', 'Warm. She means wet.', { mood: 'grin' });
    E.objective('Get out of bed');
    await prompt('Get out of bed');
    E.objective('');
    await E.getUp(7.9, 5.1, Math.PI / 2);
    luke.P.drop('R'); lily.P.drop('R'); rose.P.drop('R');
    E.go(luke, 'luke'); await wait(0.6); E.go(lily, 'lily'); await wait(0.5); E.go(rose, 'rose');
    flavor(bedroomFlavor(1));
    E.objective('Go downstairs for breakfast');
    await E.until(() => P.y < 1 && E.inside());
    clearFlavor();
    await meal({
      objective: 'Sit down at the table', kids: ['luke', 'lily', 'rose'], food: 'oats', momFood: 'empty',
      setup: () => { linda.P.setExpr('tired'); },
      bites: [
        async () => {
          await say('linda', "Last of the oats. I'm sorry it's so thin.", { mood: 'tired' });
          await say('luke', 'Kaylie does fasting streams. Twenty-four hours, no food. Chat goes crazy for it.');
          await say('rose', "That's not the same thing.", { mood: 'angry' });
          await say('linda', "Eat, all of you. I'll figure something out.", { mood: 'tired' });
          await say('lily', "Mom, you don't have any.", { mood: 'worried' });
          await say('linda', 'I ate already, honey.', { mood: 'soft' });
          await think("Her bowl is clean. It's been clean for three days.");
        },
        async () => {
          await say('luke', "I could hike down. Find the highway. It's like, what, forty miles?");
          await say('linda', "No. The pass is gone, Luke. You saw the road. You'd fall, and I'd never find you.", { mood: 'angry' });
          await say('luke', '...Okay. Okay, Mom.');
          await say('rose', 'We could eat my flowers.');
          await say('lily', 'We are not eating your flowers.', { mood: 'happy' });
          await say('rose', 'Nasturtiums are edible! I read it!', { mood: 'angry' });
          await say('linda', "Nobody is eating Rose's flowers.", { mood: 'soft' });
        },
        async () => {
          await say('linda', 'Chores. Leon, water the garden and pull the weeds. Luke, firewood. Girls, laundry.', { mood: 'tired' });
          await say('leon', 'And the coop?');
          await say('linda', "...Check it anyway. Maybe Biscuit's ghost left us an egg.", { mood: 'soft' });
          await say('rose', 'Not funny.', { mood: 'sad' });
          await say('luke', 'Little funny.', { mood: 'grin' });
        }
      ]
    });
    await fadeOut(0.8);
    hideAll(); E.setTime('day');
    luke.place('chop', 'chop'); prop(luke, 'axe', 'R', ...AXE); W.blockAxe.visible = false;
    lily.place('clothes', 'laundry'); rose.place({ x: -4.6, z: 12.4, yaw: 0, node: 'clothes' }, 'laundry'); rose.P.idle = 'relax';
    linda.place('prep', 'stand'); linda.P.idle = 'clasp';
    E.stand(0, 8.6, Math.PI); P.y = 0; E.teleport(0.6, 0, 8.8, Math.PI * 0.8);
    await fadeIn(1);
    // chores
    flavor(yardFlavor(1));
    const lukeChat = E.chat(luke, [
      [['luke', 'Forty swings per log. I counted. Content.'], ['leon', 'Nobody is watching, Luke.'], ['luke', 'Chat is always watching, Leon.', { mood: 'grin' }]],
      [['luke', "Real talk? I'm starving. Like, my hands shake. Don't tell Mom."], ['luke', "She's got enough going on.", { mood: 'sad' }]],
      [['luke', 'Go water your carrots, farmer boy.', { mood: 'grin' }]]
    ]);
    const girlsChat = E.chat(lily, [
      [['lily', "We're washing the same four shirts. Again.", { mood: 'soft' }], ['rose', 'They smell like woodsmoke forever now.'], ['lily', 'I like woodsmoke.', { mood: 'happy' }]],
      [['lily', 'Go on, the garden needs you more than we do.', { mood: 'soft' }]]
    ]);
    E.objective('Get the watering can from the shed');
    await E.interact({ x: W.canSpot.x, y: W.canSpot.y, z: W.canSpot.z, label: 'Take the watering can', r: 2.2 });
    W.can.visible = false; E.give('can'); A.pop();
    E.objective('Fill it at the well pump');
    await E.interact({ x: 11.0, y: 1.4, z: 6.05, label: 'Pump water', hold: 2.2, tick: pumpTick, r: 2.2 });
    A.splash(); W.pumpHandle.rotation.x = 0;
    await think('Still cold. At least the well never runs out.');
    await chore('water', 4, n => `Water the carrots  ${n}/4`, 'Water the carrots', 1.1, waterTick);
    await think('They look a little less dead now.');
    E.give(null);
    await chore('weed', 5, n => `Pull the weeds  ${n}/5`, 'Pull the weed', 0.7);
    E.objective('Check the chicken coop');
    await E.interact({ x: -15.25, y: 0.95, z: -3.45, label: 'Look inside the coop', r: 2.4 });
    A.creak(-15.25, 1, -3.45);
    await think('Empty. Just feathers and old straw.');
    await think('Biscuit was the last one. Rose made her a grave with a little cross.');
    lukeChat.stop(); girlsChat.stop();
    // Luke: Signal Rock
    luke.P.drop('R'); W.blockAxe.visible = true;
    E.go(luke, { x: -12.0, z: -1.8, y: 0, node: 'coop' }).then(() => luke.facePlayer());
    E.objective('');
    await E.until(() => Math.hypot(luke.x - P.x, luke.z - P.z) < 3.5);
    luke.lookPlayer = true;
    await say('luke', "Yo. It's almost noon. Signal Rock. You coming?", { mood: 'grin' });
    const c2 = await choose(['Yeah!', 'Mom said to stay close...']);
    if (c2 === 1) { await say('leon', 'Mom said to stay close...'); await say('luke', "It's ten minutes up the hill. I'm a responsible adult. Come on."); }
    else await say('leon', 'Yeah!');
    luke.lookPlayer = false; prop(luke, 'phone', 'R', ...PHONE); luke.P.phoneWalk = true;
    E.objective('Follow Luke up to Signal Rock');
    const lukeUp = E.go(luke, 'ridgeTop', { speed: 1.6 });
    await lukeUp; luke.P.phoneWalk = false; luke.anim('phoneUp'); luke.yaw = -0.35;
    await goNear(W.spots.ridgeTop.x, W.spots.ridgeTop.z, 4.5);
    E.objective('');
    await say('luke', 'Come on, come on, come on...', { mood: 'worried', look: false });
    await wait(1.2); A.buzz(luke.x, luke.y + 2, luke.z); await wait(0.5);
    await say('luke', 'ONE BAR! Chat, we have ONE BAR!', { mood: 'laugh', yell: true, look: false });
    luke.anim('phone');
    await say('luke', "Okay okay okay. Kaylie posted. She's streaming tonight. Eight o'clock.", { mood: 'happy' });
    await say('luke', 'And, dude. DUDE. She replied to my donation. From before the storm.', { mood: 'grin' });
    await say('luke', "'Thanks Luke_Plays, you're the best.' She knows my name, Leon.", { mood: 'happy' });
    const c3 = await choose(['She says that to everyone.', "That's awesome, Luke."]);
    if (c3 === 0) { await say('leon', 'She says that to everyone.'); await say('luke', "Nah. She said my name. Like, the actual letters. That's different.", { mood: 'worried' }); await say('luke', "...You don't get it. It's fine.", { mood: 'sad' }); }
    else { await say('leon', "That's awesome, Luke."); await say('luke', "Right?! I told you. We're basically friends.", { mood: 'grin' }); }
    await say('luke', "When the road opens I'm driving to her meetup in Denver. I'll be the guy who came down off a mountain. She'll remember that.");
    A.pop(); await wait(0.6);
    await say('luke', 'Aaand the bar is gone.', { mood: 'sad' });
    luke.P.drop('R'); luke.anim('stand'); luke.yaw = -0.3;
    await say('luke', 'Hey. You see the road? Way down there, where it just... stops?', { look: false });
    await E.look(0, 2, 70, 1.4);
    await say('leon', 'Yeah.');
    luke.lookPlayer = true;
    await say('luke', "If it gets bad. Like, really bad. I'll hike out. Even if Mom says no. I'd do it for you guys.", { mood: 'sad' });
    await say('leon', 'Promise?');
    await say('luke', 'Promise. Now race you back. Loser does dishes.', { mood: 'grin' });
    luke.lookPlayer = false;
    E.go(luke, 'chop', { speed: 2.6, anim: 'stand' });
    E.objective('Head back to the cabin');
    await E.until(() => Math.hypot(P.x - 0, P.z - 9) < 9 || E.inside());
    // afternoon: Rose's flower bed, Lily on the porch
    await fadeOut(0.8);
    E.setTime('afternoon'); hideAll();
    rose.place({ x: 3.6, z: 10.9, yaw: Math.PI, node: 'porchS' }, 'kneel');
    lily.place('porchBench', 'sketch'); prop(lily, 'sketchbook', 'L', ...BOOK);
    luke.place('chop', 'chop'); prop(luke, 'axe', 'R', ...AXE); W.blockAxe.visible = false;
    linda.place('clothes', 'laundry');
    E.teleport(1.5, 0, 12.6, -0.4);
    await fadeIn(1);
    flavor(yardFlavor(1));
    const lilyChat = E.chat(lily, [
      [['lily', "I'm drawing the mountains. When I'm scared, I draw whatever's in front of me.", { mood: 'soft' }], ['lily', 'It makes the world hold still for a minute.', { mood: 'soft' }]],
      [['lily', 'Go help Rose. She has been talking to those seedlings all day.', { mood: 'happy' }]]
    ]);
    E.objective('Help Rose with the flower bed');
    await E.talk(rose, 'Talk to Rose');
    rose.lookPlayer = true; rose.anim('stand');
    await say('rose', "Finally. Okay. These are lupine seedlings. They're tougher than they look.", { mood: 'happy' });
    await say('rose', 'Fireweed is the first thing that grows after a forest burns. Did you know that? Everything burns down and then, pink. Everywhere.', { mood: 'happy' });
    await say('rose', 'Dig two holes. Not too deep. They have to be able to breathe.');
    rose.lookPlayer = false; rose.anim('kneel');
    const holes = [[2.6, 10.25], [4.4, 10.25]];
    W.chores.flower = holes.map(([x, z]) => { const g = new THREE.Group(); g.position.set(x, 0.09, z); E.camera.parent.add(g); const m = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), G.mat('#3a7a2a')); m.position.y = 0.09; g.add(m); g.visible = false; return { x, y: 0.15, z, group: g, done: false }; });
    {
      let n = 0;
      await new Promise(res => { W.chores.flower.forEach(c => { const h = E.addInteract({ x: c.x, y: c.y, z: c.z, r: 2.4, dot: 0.85, label: 'Plant a seedling', hold: 1.0, tick: digTick, cb: () => { h.stop(); c.group.visible = true; A.dig(); n++; E.objective(`Plant the seedlings  ${n}/2`); if (n >= 2) res(); } }); }); E.objective('Plant the seedlings  0/2'); });
    }
    rose.lookPlayer = true; rose.anim('stand');
    await say('rose', 'See? Things grow. Even now.', { mood: 'happy' });
    await say('rose', "Thanks, Leon. You're the only one who doesn't think it's stupid.", { mood: 'soft' });
    rose.lookPlayer = false;
    lilyChat.stop();
    // evening
    await fadeOut(1);
    await E.title('', 'That evening', 1.4);
    E.setTime('evening'); hideAll(); E.music('unease');
    linda.place('stove', 'cook'); W.potFill.material.map = T.soup; E.amb.sizzle = false;
    luke.place('couch', 'sit'); lily.place('armchair', 'sketch'); prop(lily, 'sketchbook', 'L', ...BOOK); rose.place('spare', 'sitTable');
    E.teleport(0, 0, 11.5, Math.PI);
    await fadeIn(1.2);
    flavor(houseFlavor(1));
    E.objective('Go inside');
    await E.until(() => E.inside());
    E.objective('Talk to Mom');
    await E.talk(linda, 'Talk to Mom');
    linda.anim('stand'); linda.facePlayer(); linda.lookPlayer = true;
    await say('linda', "Hi, sweetie. Potato peel soup. Don't make that face.", { mood: 'soft' });
    await say('leon', 'Is there really nothing else?');
    await say('linda', "A cup of flour. Some salt. Rose's tomatoes, when they're ripe.", { mood: 'tired' });
    await say('linda', "I'm going to fix this, Leon. I promise you. I will not watch my babies starve.", { mood: 'dark' });
    linda.lookPlayer = false; linda.yaw = Math.PI; linda.anim('cook');
    A.hum(linda.x, linda.y + 1.6, linda.z, 1);
    await wait(2.5);
    await think("She's been humming that song a lot. The one from the music box Dad left her.");
    clearFlavor();
    await meal({
      kids: ['luke', 'lily', 'rose'], food: 'soup', momFood: 'soup', time: 'night', lights: ['dining', 'candle', 'fire', 'kitchen', 'porch'],
      bites: [
        async () => {
          await say('luke', 'Chat, rate this soup.', { mood: 'grin' });
          await say('lily', 'Zero out of ten.', { mood: 'happy' });
          await say('rose', 'Negative ten.', { mood: 'grin' });
          linda.P.setExpr('laugh'); await wait(0.6);
          await say('linda', "You're all terrible.", { mood: 'laugh' });
          await think("That's the first time she's laughed in weeks.");
        },
        async () => {
          await say('lily', 'Mom, eat yours. Please.', { mood: 'worried' });
          await say('linda', "I'm not very hungry, honey.", { mood: 'tired' });
          await say('rose', 'You always say that.', { mood: 'worried' });
        },
        async () => {
          await say('linda', 'You know I love you all more than anything. Right? Whatever happens.', { mood: 'sad' });
          await say('luke', '...Mom, that is super ominous.');
          await say('linda', 'Go wash up. Bed.', { mood: 'soft' });
        }
      ]
    });
    // night: lights out
    await sleepScene({ kids: ['luke', 'lily', 'rose'], talk: async () => {
      await say('luke', 'Night, chat.', { look: false });
      await say('lily', "Night, Luke's chat.", { look: false, mood: 'happy' });
      await say('rose', 'Night, lupines.', { look: false });
      const c4 = await choose(['Night, everyone.', 'Night, Biscuit.']);
      if (c4 === 0) await say('leon', 'Night, everyone.'); else { await say('leon', 'Night, Biscuit.'); await say('rose', '...Night, Biscuit.', { look: false, mood: 'sad' }); }
      E.setTime('night', { lights: ['fire', 'kitchen', 'porch'] });
      await wait(1.2);
      await say('lily', "Leon. Look out the window. See the W? That's Cassiopeia.", { whisper: true, look: false });
      await say('luke', 'W.', { look: false });
      await say('lily', '...Go to sleep, Luke.', { whisper: true, look: false, mood: 'happy' });
      await wait(1.5);
      W.setLight('hall', true);
      linda.place('bedDoorIn', 'stand', Math.PI * 0.75); linda.lookTarget = new THREE.Vector3(7.2, 3.6, 1.5);
      await wait(0.5);
      await say('linda', 'Sleep tight, my loves.', { whisper: true, look: false, mood: 'soft' });
      await wait(3.0);
      await think('She stood there for a long time. Just... watching us.');
      await E.go(linda, 'hallUp'); linda.hide(); W.setLight('hall', false);
    } });
    // 3 AM
    await fadeOut(1.5);
    await E.title('', '3:12 AM', 1.6);
    E.setTime('lateNight', { lights: ['candle'] }); hideAll(); E.music(null);
    for (const k of ['luke', 'lily', 'rose']) { kids[k].place('bed_' + k, 'lie'); kids[k].P.sleep = true; kids[k].P.setExpr('sleep'); }
    linda.place('linda', 'sharpen'); prop(linda, 'knife', 'R', ...KNIFE); linda.P.setExpr('dark');
    E.bed({ pitch: 0.6 }); await fadeIn(1.5);
    await think("I'm so thirsty. And I can hear something downstairs.");
    E.objective('Get a drink of water');
    await prompt('Get out of bed'); await E.getUp(7.9, 5.1, Math.PI / 2); E.objective('');
    let scr = true; (async () => { while (scr) { if (P.y < 1) A.scrape(linda.x, 0.9, linda.z); else A.scrape(linda.x, 2.5, linda.z); await wait(0.9 + Math.random() * 0.4); } })();
    await E.until(() => P.y < 1 && Math.hypot(P.x - linda.x, P.z - linda.z) < 4.2);
    scr = false; linda.lookPlayer = true; E.lock(true); await E.lookNpc(linda, 0.9);
    await say('linda', "...Can't sleep, sweetie?", { mood: 'dark' });
    await say('leon', 'I was thirsty. What are you doing?');
    await say('linda', "Sharpening your grandpa's hunting knife. I'm going hunting tomorrow. There are still deer up past the ridge.", { mood: 'tired' });
    await say('leon', "You don't know how to hunt.");
    await say('linda', "I'll learn. Go back to bed, Leon.", { mood: 'creepy' });
    E.lock(false); linda.lookPlayer = false; linda.anim('sharpen');
    scr = true; (async () => { while (scr) { A.scrape(linda.x, 0.9, linda.z); await wait(1.1); } })();
    E.objective('Go back to bed');
    const lb = W.beds.leon;
    await E.interact({ x: lb.x, y: lb.y, z: lb.z, r: 2.6, dot: 0.75, label: 'Get into bed' });
    scr = false;
  }

  // ======================================================================
  // DAY 2 — Luke
  // ======================================================================
  async function day2() {
    setup(2);
    document.getElementById('fade').style.opacity = 1;
    E.setTime('morning'); E.music('home');
    luke.place({ x: 8.3, y: 3, z: 1.6, yaw: Math.PI / 2, node: 'bedC' }, 'phone'); prop(luke, 'phone', 'R', ...PHONE);
    lily.place('bed_lily', 'sitUp'); prop(lily, 'book', 'R', ...BOOK);
    rose.place('bed_rose', 'lie'); rose.P.sleep = true; rose.P.setExpr('sleep');
    linda.place('stove', 'stand');
    E.bed(); await wait(0.5);
    await E.title('DAY 2', 'Mom left before sunrise with the knife and Dad\'s old rifle bag. She came back an hour later with nothing.', 3.4);
    await fadeIn(2);
    luke.lookPlayer = true;
    await say('luke', "Chat, today's the day. Mom's going hunting and I'm her backup.", { mood: 'grin' });
    await say('lily', 'Since when do you hunt?', { mood: 'soft' });
    await say('luke', "I've watched like forty survival streams. It's basically the same thing.");
    rose.P.sleep = false; rose.P.setExpr('tired'); rose.anim('sitUp');
    await say('rose', 'Mm. Is there breakfast?');
    await say('lily', '...Probably not, Rose.', { mood: 'sad' });
    luke.lookPlayer = false;
    await say('linda', 'Luke? Can you come down, honey? I need your strong arms.', { look: false });
    await say('luke', 'Strong arms. You hear that, chat?', { mood: 'grin' });
    luke.P.drop('R'); E.go(luke, 'stove');
    E.objective('Get out of bed'); await prompt('Get out of bed'); await E.getUp(7.9, 5.1, Math.PI / 2);
    lily.P.drop('R'); E.go(lily, 'lily', { anim: 'sitTable' }); rose.anim('stand'); E.go(rose, 'rose', { anim: 'sitTable' });
    flavor(bedroomFlavor(2));
    E.objective('Go downstairs');
    await E.until(() => P.y < 1 && E.inside());
    clearFlavor();
    linda.place('stove', 'stand'); luke.place({ x: -0.4, z: -4.0, yaw: Math.PI * 0.8, node: 'kitchen' }, 'stand');
    linda.facePlayer();
    E.objective('Go to the kitchen');
    await E.until(() => Math.hypot(P.x - 0, P.z + 3.4) < 3.2);
    E.objective(''); linda.lookPlayer = true;
    await say('linda', "No breakfast today, kids. I'm sorry.", { mood: 'sad' });
    await say('lily', 'I saved some crackers. Four. One each.', { mood: 'soft' });
    await say('linda', 'Luke, before I go up the ridge I need your help with the old chest freezer downstairs. If I bring something back, we need it cold.', { mood: 'tired' });
    await say('luke', 'Sure. Generator still have gas?');
    await say('linda', 'Enough.', { mood: 'dark' });
    luke.lookPlayer = true; luke.facePlayer();
    await say('luke', "Hold my phone, little man. If Kaylie DMs me, tell her I'm busy saving my family.", { mood: 'grin' });
    E.give('phone'); A.pop();
    await think("It's still warm from his hand.");
    luke.lookPlayer = false; linda.lookPlayer = false;
    E.go(linda, 'baseDoor'); await wait(0.4); E.go(luke, { x: -3.0, z: -5.6, y: 0, node: 'baseDoor', yaw: -Math.PI / 2 });
    await E.until(() => !linda.path);
    W.padlock.visible = false; W.setDoor('basement', true); A.creak(-4, 1, -6.25);
    await E.go(linda, 'baseIn'); linda.hide();
    await E.go(luke, 'baseTop', { speed: 1.2 });
    luke.facePlayer(); luke.lookPlayer = true;
    await say('luke', 'Brb, chat.', { mood: 'grin' });
    luke.lookPlayer = false; await E.go(luke, 'baseIn'); luke.hide();
    W.setDoor('basement', false); A.doorShut(-4, 1, -6.25);
    await wait(1.4); E.amb.gen = true;
    await think('The generator. They got it running.');
    E.give(null);
    flavor(houseFlavor(2));
    E.objective('Chop the firewood (Luke\'s job today)');
    lily.place('porchBench', 'sketch'); prop(lily, 'sketchbook', 'L', ...BOOK); rose.place({ x: -3.0, z: 10.9, yaw: Math.PI, node: 'porchS' }, 'kneel');
    E.setTime('day', { lights: [] });
    await E.until(() => !E.inside());
    flavor(yardFlavor(2));
    await E.interact({ x: -13.5, y: 0.7, z: 4.0, label: 'Pick up the axe', r: 2.4 });
    W.blockAxe.visible = false; E.give('axe');
    for (let i = 0; i < 3; i++) {
      const lg = W.chopLogs[i]; lg.position.set(-13.5, 0.6 + 0.21, 4.0); lg.children[0].rotation.set(0, 0, 0);
      await E.timing({ label: i === 0 ? 'Swing when the marker is in the green' : `Log ${i + 1}/3`, speed: 3.0 + i * 0.5, width: 0.2 - i * 0.03, onMiss: () => { A.chop(-13.5, 0.6, 4.0); E.vm.drop = 0.15; setTimeout(() => (E.vm.drop = 0), 150); } });
      A.split(); E.IN.rumble(0.5, 0.3, 120); E.vm.drop = 0.2; setTimeout(() => (E.vm.drop = 0), 160);
      lg.visible = false; for (const s of [-1, 1]) { const h = G.makeProp('log', T); h.scale.set(1, 1, 0.5); h.position.set(i * 0.3 + s * 0.1, 0.1, 0); h.rotation.y = s; W.splitPile.add(h); }
      if (i === 1) {
        E.amb.gen = false; await wait(1.0); A.thud(); await wait(0.25); A.chop(-1.5, -1.5, -2, true); await wait(1.5);
        await think('...The generator stopped.'); await wait(0.8); E.amb.gen = true; await think('There. It started again. Probably just the freezer lid.');
      }
    }
    E.give(null); W.blockAxe.visible = true;
    E.objective('Take an armful of wood to the porch');
    await E.interact({ x: -12.6, y: 0.3, z: 4.4, label: 'Pick up the split wood', r: 2.3 });
    E.give('log'); W.splitPile.visible = false;
    await E.interact({ x: 6.2, y: 0.8, z: 7.5, label: 'Stack the wood', r: 2.4 });
    E.give(null); A.thud();
    // Lily: sketch on the porch
    E.objective('Sit with Lily');
    await E.interact({ x: W.seats.step.x, y: 0.5, z: W.seats.step.z, label: 'Sit on the step next to Lily', r: 2.5, noOcc: true });
    E.sit({ x: -3.5, z: 8.3, y: 0, yaw: -2.15 }, { eye: 0.95, pitch: -0.15 });
    lily.lookPlayer = true;
    await say('lily', "Hold still. I'm drawing you.", { mood: 'soft' });
    await say('leon', 'Why?');
    await say('lily', "Because you're here. That's reason enough.", { mood: 'soft' });
    await wait(0.8);
    await say('lily', 'Do you remember Dad?', { mood: 'soft' });
    await say('leon', 'Just a beard. And the music box.');
    await say('lily', 'He left when you were two. Mom did everything after that. Every single thing.', { mood: 'sad' });
    await say('lily', "That's why she's like this. She's not sleeping, Leon. I hear her walking around at night.", { mood: 'worried' });
    const c5 = await choose(['Is Mom okay?', 'I saw her sharpening a knife last night.']);
    if (c5 === 0) { await say('leon', 'Is Mom okay?'); await say('lily', "I don't know. I think she's more scared than we are.", { mood: 'worried' }); }
    else { await say('leon', 'I saw her sharpening a knife last night. At three in the morning.'); await say('lily', '...She said she was going hunting.', { mood: 'worried' }); await say('lily', 'Mom has never even gone fishing.', { mood: 'worried' }); }
    await say('lily', 'Whatever happens, we stick together. You, me, Rose, Luke. Okay?', { mood: 'soft' });
    await say('leon', 'Okay.');
    await say('lily', 'Here. Done. You look like a sad little bird.', { mood: 'happy' });
    lily.lookPlayer = false;
    await E.read({ style: 'paper', title: '', body: '<div style="text-align:center;font-size:0.9em">for Leon &hearts; L.</div>', img: tex2url(T.sketchLeon) });
    E.stand(-3.6, 8.8, Math.PI);
    // Mom comes up alone
    await fadeOut(1);
    await E.title('', 'Late afternoon', 1.4);
    E.setTime('evening', { lights: ['kitchen', 'fire'] }); hideAll(); E.music('unease');
    rose.place('couch', 'sit'); lily.place('armchair', 'sit');
    linda.place('prep', 'scrub'); W.prepMeat.visible = true;
    E.teleport(1.0, 0, 12.0, Math.PI);
    await fadeIn(1);
    flavor(houseFlavor(2));
    E.objective('Go inside');
    await E.until(() => E.inside());
    E.objective('Talk to Mom');
    await E.talk(linda, 'Talk to Mom');
    linda.anim('stand'); linda.facePlayer(); linda.lookPlayer = true;
    await say('leon', "Where's Luke?");
    await say('linda', 'Luke is finishing something down there.', { mood: 'tired' });
    await say('linda', 'I got us something special for dinner tonight.', { mood: 'soft' });
    await say('leon', 'You went hunting? You got a deer?');
    await say('linda', "A big one. Luke's helping me break it down. It's a lot of work, sweetie.", { mood: 'tired' });
    linda.lookPlayer = false; linda.yaw = Math.PI; linda.anim('cook'); W.panMeat.visible = true; E.amb.sizzle = true; W.prepMeat.visible = false;
    await think('Meat. Real meat. My mouth is watering so much it hurts.');
    await think("...I didn't hear a gunshot. Did she even take the rifle?");
    clearFlavor();
    await meal({
      kids: ['lily', 'rose'], food: 'steak', momFood: 'steak', time: 'night', lights: ['dining', 'candle', 'fire', 'kitchen', 'porch'], verb: 'Eat',
      setup: () => { E.amb.sizzle = false; W.panMeat.visible = false; linda.P.setExpr('soft'); },
      bites: [
        async () => { await think('...Oh my god.'); await think("It's sweet. Kind of like pork? I don't care. I don't care at all."); },
        async () => { await say('rose', 'Should we save some for Luke?', { mood: 'happy' }); await say('linda', 'Luke already ate, honey.', { mood: 'soft' }); },
        async () => { await say('lily', 'Mom, this is amazing.', { mood: 'happy' }); await say('linda', "Eat up. There's plenty more.", { mood: 'creepy' }); }
      ],
      after: async () => {
        await wait(0.8); A.buzz(); E.IN.rumble(0.3, 0.3, 300);
        await think("Luke's phone. In my pocket.");
        await E.read({ style: 'phone', title: '8:00', body: '<div class="note"><b>ALARM</b>KAYLIE STREAM 8PM &hearts;&hearts;&hearts; DONT MISS IT</div><div class="note"><b>Battery</b>42% remaining</div>' });
        await say('leon', "Luke's going to miss Kaylie's stream.");
        await say('linda', "He'll catch the next one.", { mood: 'dark' });
      }
    });
    await sleepScene({ kids: ['lily', 'rose'], lights: ['fairy', 'bedroom'], talk: async () => {
      await think("Luke's bed is empty.");
      await say('rose', "He's still down there?", { look: false, mood: 'worried' });
      await say('lily', "Mom said he's sleeping on the couch so he can keep an eye on the generator.", { look: false });
      await say('rose', 'Luke hates the couch.', { look: false });
      await say('lily', '...Yeah.', { look: false, mood: 'sad' });
      await prompt("Get up and put Luke's phone on his bed");
      await E.getUp(7.9, -0.9, 0); E.objective("Put Luke's phone on his bed");
      await E.interact({ x: 8.6, y: 3.6, z: -2.2, label: "Leave Luke's phone on his pillow", r: 2.4 });
      W.lukePhone.visible = true; W.lukePhoneScreen.visible = true; A.pop(); E.objective('');
      await think("He'll want it when he comes up.");
      E.objective('Go back to bed');
      const lb = W.beds.leon; await E.interact({ x: lb.x, y: lb.y, z: lb.z, r: 2.6, dot: 0.75, label: 'Get into bed' });
      E.objective(''); await fadeOut(0.6); E.setTime('lateNight', { lights: [] }); E.bed({ pitch: 0.5 }); await wait(0.6); await fadeIn(1.2);
      await wait(2);
      for (let i = 0; i < 5; i++) { A.chop(5, 0.5, -2, true); await wait(1.6); }
      await say('lily', 'Leon. You hear that?', { whisper: true, look: false });
      await say('leon', "Mom's cutting up the deer.", { whisper: true });
      await say('lily', 'At two in the morning?', { whisper: true, look: false, mood: 'worried' });
      for (let i = 0; i < 4; i++) { A.chop(5, 0.5, -2, true); await wait(1.7); }
      await think('Thunk. Thunk. Thunk. I counted forty-one before I fell asleep.');
    } });
  }

  // ======================================================================
  // DAY 3 — Lily
  // ======================================================================
  async function day3() {
    setup(3);
    document.getElementById('fade').style.opacity = 1;
    E.setTime('rain'); E.music('unease');
    rose.place('bedEdge_rose', 'sitBed'); rose.P.setExpr('worried');
    lily.place({ x: 9.2, y: 3, z: 1.6, yaw: Math.PI / 2, node: 'bedC' }, 'stand'); lily.P.idle = 'crossed';
    linda.place('stove', 'cook'); W.panMeat.visible = true; E.amb.sizzle = true; E.amb.gen = true;
    E.bed(); await wait(0.5);
    await E.title('DAY 3', 'It rained all night. Luke never came up.', 3);
    await fadeIn(2);
    await say('rose', "He didn't come up. His bed's still made.", { mood: 'worried' });
    await say('rose', 'Luke has never made his bed in his entire life.', { mood: 'scared' });
    lily.lookPlayer = true;
    await say('lily', "Let's not panic. We'll ask Mom. Okay?", { mood: 'soft' });
    lily.lookPlayer = false;
    E.objective('Get out of bed'); await prompt('Get out of bed'); await E.getUp(7.9, 5.1, Math.PI / 2);
    lily.P.idle = 'clasp'; E.go(lily, { x: 1.2, z: -3.6, y: 0, node: 'kitchen', yaw: Math.PI }); await wait(0.5); E.go(rose, { x: 0.2, z: -3.2, y: 0, node: 'kitchen', yaw: Math.PI });
    flavor(bedroomFlavor(3));
    E.objective('Go downstairs');
    await E.until(() => P.y < 1 && E.inside());
    clearFlavor();
    lily.place({ x: 1.2, z: -3.7, y: 0, node: 'kitchen', yaw: Math.PI * 0.95 }, 'stand'); rose.place({ x: 0.2, z: -3.3, y: 0, node: 'kitchen', yaw: Math.PI }, 'stand');
    E.objective('Go to the kitchen');
    await E.until(() => Math.hypot(P.x - 0.5, P.z + 3.4) < 3.4);
    E.objective('');
    linda.anim('stand'); linda.yaw = 0; linda.lookTarget = rose.headPos().clone();
    await say('rose', "Mom, where's Luke?", { mood: 'worried' });
    await say('linda', "Luke left before dawn. He hiked out to get help. He's a grown man, Rose.", { mood: 'tired' });
    await say('rose', "In the RAIN? Without his phone? His coat's still on the hook!", { mood: 'angry', yell: true });
    await say('linda', "He took your father's old coat.", { mood: 'dark' });
    await think("Dad's coat has been in a box in the attic for eleven years.");
    await say('lily', '...Okay. Thank you, Mom.', { mood: 'worried' });
    linda.lookTarget = null; linda.anim('cook');
    await meal({
      objective: 'Sit down for breakfast', kids: ['lily', 'rose'], food: 'stew', momFood: 'stew',
      setup: () => { E.amb.sizzle = false; },
      bites: [
        async () => { await think('Meat for breakfast. I never thought I would get sick of hunger.'); },
        async () => { await say('rose', "I'm not hungry.", { mood: 'sad' }); await say('linda', "Eat, Rose. You're skin and bones.", { mood: 'tired' }); },
        async () => { await say('linda', 'Leon, the roof is leaking upstairs. Put a bucket under it. Then you can do what you like until the rain stops.', { mood: 'tired' }); }
      ]
    });
    await fadeOut(0.7); hideAll();
    linda.place('stove', 'cook'); rose.place('couch', 'sit'); rose.P.setExpr('sad');
    lily.place({ x: 2.3, y: 3, z: 6.45, yaw: Math.PI, node: 'bedroom' }, 'sketch'); lily.P.seatH = 0.45; prop(lily, 'sketchbook', 'L', ...BOOK);
    E.stand(2.4, -0.2, Math.PI / 2);
    await fadeIn(0.8);
    flavor(houseFlavor(3).concat(atticFlavor()));
    E.objective('Find a bucket (bathroom)');
    await E.interact({ x: -8.5, y: 0.45, z: -1.5, label: 'Take the bucket', r: 2.2 });
    E.give('bucket'); A.pop();
    E.objective('Put the bucket under the leak upstairs');
    let dripping = true; (async () => { while (dripping) { A.drip(4.4, 3.2, -4.4); await wait(0.7); } })();
    await E.interact({ x: 4.4, y: 3.15, z: -4.4, label: 'Put the bucket down', r: 2.4 });
    dripping = false; E.give(null); A.thud(); { const b = G.makeProp('bucket', T); b.position.set(4.4, 3.3, -4.4); W.sky.parent.add(b); }
    await think('Plink. Plink. At least it sounds like something.');
    E.objective('Find Lily');
    await E.talk(lily, 'Talk to Lily');
    lily.lookPlayer = true;
    await say('lily', 'Hey. Come sit. I want to show you something.', { mood: 'soft' });
    await say('lily', "Don't tell Rose. She'll panic.", { mood: 'worried' });
    await E.read({ style: 'paper', title: '', body: '<div style="text-align:center">us &hearts;</div>', img: tex2url(T.sketchFamily) });
    await say('lily', 'That one is from summer. Before the storm.', { mood: 'soft' });
    await E.read({ style: 'paper', title: '', body: '<div style="text-align:center">she stands there every night</div>', img: tex2url(T.sketchDoor) });
    await say('lily', 'I drew that last night. She stands at the basement door every night. Just stands there. In the dark.', { mood: 'worried' });
    await say('lily', "I think Luke's still down there, Leon.", { mood: 'scared' });
    const c6 = await choose(['Why would Mom lie?', "Maybe he really did leave."]);
    if (c6 === 0) { await say('leon', 'Why would Mom lie?'); await say('lily', "I don't know. That's what scares me.", { mood: 'scared' }); }
    else { await say('leon', 'Maybe he really did leave.'); await say('lily', 'Without saying goodbye to you? Luke?', { mood: 'sad' }); await say('leon', '...No.'); }
    await say('lily', 'Breathe with me. In for four. Hold. Out for four.', { mood: 'soft' });
    await wait(4);
    await say('lily', "There. We're okay. We're okay.", { mood: 'soft' });
    lily.lookPlayer = false;
    // rain stops: potatoes + cocoa
    await fadeOut(1); await E.title('', 'The rain stopped around three', 1.4);
    E.setTime('overcast', { lights: ['fire', 'kitchen'] }); hideAll();
    linda.place('stove', 'stand'); rose.place('couch', 'sit');
    E.teleport(12.0, 0, 1.0, -Math.PI / 2);
    await fadeIn(1);
    flavor(yardFlavor(3));
    await chore('potato', 2, n => `Dig up the potatoes  ${n}/4`, 'Dig up the potatoes', 1.4, digTick);
    lily.place('porch', 'carryR'); prop(lily, 'mug', 'R', ...MUG); lily.P.carryArm = true;
    E.objective('');
    await E.go(lily, { x: P.x - 1.1, z: P.z + 0.5, y: 0 }, { anim: 'carryR' });
    lily.facePlayer(); lily.lookPlayer = true; E.lock(true);
    await E.lookNpc(lily, 0.8);
    await say('lily', 'Hey, Leon. Made you some hot cocoa.', { mood: 'soft' });
    await say('lily', "Last packet in the cupboard. Don't tell Rose.", { mood: 'happy' });
    lily.P.drop('R'); lily.P.carryArm = false; lily.anim('stand'); E.give('mug'); A.sip();
    await say('leon', "Thanks, Lily. It's really warm.");
    await say('lily', "Your garden's looking good. Better than anything I could grow.", { mood: 'soft' });
    linda.place({ x: 0.6, z: 8.6, y: 0, yaw: Math.PI * 0.7, node: 'porch' }, 'stand'); linda.lookTarget = lily.headPos().clone();
    await wait(0.6);
    await say('lily', 'Leon... do you know where Mom got that meat?', { mood: 'worried', whisper: true });
    await say('leon', 'No. Also, where did Luke g-', { auto: 0, speed: 34 });
    linda.anim('yell');
    await say('linda', 'LILY! WE NEED YOU IN THE BASEMENT! COME HELP!', { yell: true, mood: 'yell', look: false });
    linda.anim('stand');
    lily.lookPlayer = false; lily.face(linda.x, linda.z);
    await say('lily', 'COMING!', { yell: true, look: false });
    lily.facePlayer(); lily.lookPlayer = true;
    await say('lily', 'See you, Leon...', { mood: 'sad' });
    lily.lookPlayer = false; E.lock(false);
    const lilyAtDoor = E.go(lily, 'baseDoor');
    const goLily = (async () => { await wait(0.8); await E.go(linda, 'kitchen'); await lilyAtDoor; W.padlock.visible = false; W.setDoor('basement', true); A.creak(-4, 1, -6.25); await E.go(lily, 'baseIn'); lily.hide(); await E.go(linda, 'baseIn'); linda.hide(); W.setDoor('basement', false); A.doorShut(-4, 1, -6.25); })();
    await wait(2.2); E.give(null);
    await chore('potato', 4, n => `Dig up the potatoes  ${n}/4`, 'Dig up the potatoes', 1.4, digTick);
    await think('...Where did Luke go?');
    await goLily;
    E.objective('Bring the potatoes inside'); E.give('potatoes');
    E.setTime('evening', { lights: ['fire', 'kitchen', 'dining', 'porch'] });
    await E.until(() => E.inside());
    E.give(null);
    await think("Lily's not here...");
    E.objective('Find Mom');
    let knock = 0;
    const doorI = E.addInteract({ x: -3.95, y: 1.1, z: -6.25, label: 'Knock on the basement door', r: 2.2, cb: async () => {
      doorI.stop(); knock = 1; A.knock(); await wait(0.8); for (let i = 0; i < 3; i++) { A.chop(-5, -1.8, -3, true); await wait(0.8); }
      await wait(1.2); await say('linda', 'Go wash up for dinner, sweetie.', { mood: 'dark', look: false }); await think('Her voice came from right behind the door.'); knock = 2; } });
    flavorStop.push(doorI.stop);
    let waited = false; wait(16).then(() => (waited = true));
    await E.until(() => knock === 2 || (waited && knock === 0));
    doorI.stop();
    await wait(2);
    linda.place('baseDoor', 'stand'); W.setDoor('basement', true); A.creak(-4, 1, -6.25); await wait(0.5);
    await E.go(linda, 'stove', { anim: 'cook' }); W.setDoor('basement', false); A.doorShut(-4, 1, -6.25); W.panMeat.visible = true; E.amb.sizzle = true;
    rose.place('couch', 'sit');
    E.objective('Talk to Mom');
    await E.talk(linda, 'Talk to Mom');
    linda.anim('stand'); linda.facePlayer(); linda.lookPlayer = true;
    await say('leon', "Mom, where's Lily?");
    await say('linda', "Lily's helping your brother with something. They'll be up later.", { mood: 'soft' });
    await say('leon', 'You said Luke left to get help.');
    await say('linda', '...Did I?', { mood: 'dark' });
    await say('linda', 'Sit down, sweetie. Dinner is ready.', { mood: 'creepy' });
    linda.lookPlayer = false; linda.yaw = Math.PI; linda.anim('cook');
    clearFlavor();
    await meal({
      kids: ['rose'], food: 'steak', momFood: 'steak', time: 'night', lights: ['dining', 'candle', 'fire', 'kitchen'],
      setup: () => { E.amb.sizzle = false; W.panMeat.visible = false; rose.P.setExpr('sad'); },
      bites: [
        async () => { await think("It's even better than last night..."); await think("I hate that it's better."); },
        async () => { await say('rose', "It's so quiet without them.", { mood: 'sad' }); await say('linda', "They're closer than you think, honey.", { mood: 'creepy' }); },
        async () => { rose.anim('sitTable'); await say('rose', "I'm not hungry.", { mood: 'sad' }); await say('linda', 'Eat, Rose.', { mood: 'angry' }); rose.P.setExpr('scared'); await wait(0.8); rose.anim('eat'); await say('linda', "Good girl. There's plenty more.", { mood: 'creepy' }); }
      ]
    });
    await sleepScene({ kids: ['rose'], talk: async () => {
      await think("Two empty beds now. Lily's sketchbook is still on her pillow.");
      rose.place('bedEdge_leon', 'sitBed'); rose.lookPlayer = true; rose.P.setExpr('sad');
      await say('rose', 'Leon? Can I sit with you?', { mood: 'sad', whisper: true });
      await say('rose', 'I keep thinking about Lily\'s face when Mom yelled. She looked scared.', { mood: 'scared', whisper: true });
      await say('rose', "Here. It's a forget-me-not. I pressed it last summer.", { mood: 'soft', whisper: true });
      await E.read({ style: 'paper', title: '', body: '<div style="text-align:center">forget-me-not<br><span style="font-size:0.8em">(Myosotis) &mdash; R.</span></div>', img: tex2url(T.pressed) });
      await say('rose', 'So you don\'t forget me. Or them.', { mood: 'sad', whisper: true });
      await say('leon', "I'm not going to forget you, Rose. You're right here.", { whisper: true });
      await say('rose', "Tomorrow I'm going to ask Mom to let me see them. I just want to see them.", { mood: 'angry', whisper: true });
      const c7 = await choose(["I'll come with you.", "Don't go down there."]);
      if (c7 === 0) { await say('leon', "I'll come with you.", { whisper: true }); await say('rose', "No. Someone has to finish the garden. You're the garden guy.", { mood: 'soft', whisper: true }); }
      else { await say('leon', "Don't go down there.", { whisper: true }); await say('rose', "It's just the basement, Leon. It's our house.", { mood: 'sad', whisper: true }); }
      rose.lookPlayer = false; rose.place('bed_rose', 'lie');
      await wait(1.5);
      A.hum(1.45, 4.6, -3.8, 2);
      await think("Mom's humming in the hallway. The music box song. Over and over.");
      await wait(5);
    } });
  }

  // ======================================================================
  // DAY 4 — Rose, and the basement
  // ======================================================================
  async function day4() {
    setup(4);
    document.getElementById('fade').style.opacity = 1;
    E.setTime('redDawn', { lights: [] }); E.music('unease'); E.amb.gen = true;
    rose.place('bedEdge_rose', 'sitBed'); prop(rose, 'crown', 'R', ...CROWN); rose.P.setExpr('soft');
    linda.place('stove', 'stand'); W.lukePhoneScreen.visible = false;
    E.bed(); await wait(0.5);
    await E.title('DAY 4', 'The sky was red when I woke up. The generator ran all night.', 3);
    await fadeIn(2);
    rose.lookPlayer = true;
    await say('rose', "Morning. I'm making crowns. One for Lily, one for Luke, one for me.", { mood: 'soft' });
    await say('rose', 'And one for you, if you help me pick flowers in the meadow.', { mood: 'happy' });
    rose.lookPlayer = false;
    await wait(0.5); A.radio(2.5);
    await think('...Is that the radio? In the study?');
    E.objective('Get out of bed'); await prompt('Get out of bed'); await E.getUp(7.9, 5.1, Math.PI / 2);
    flavor(bedroomFlavor(4));
    E.objective('Check the radio in the study');
    let rad = true; (async () => { while (rad) { A.radio(2); await wait(2.6); } })();
    await E.interact({ x: -2.05, y: 4.0, z: 6.4, label: 'Listen to the radio', r: 2.4 });
    rad = false; A.radio(5);
    await E.read({ style: 'radio', title: 'CH 19 — COUNTY', body: '...ksshh... families above the Kessler Ridge washout... ksshh... road crews will reach the upper pass by FRIDAY... ksshh... repeat, Friday... hold on, folks... we\'re coming... ksshh...' });
    await think("Friday. That's tomorrow. They're coming TOMORROW.");
    clearFlavor();
    E.objective('Tell Mom');
    rose.P.drop('R'); E.go(rose, { x: 1.2, z: -3.4, y: 0, node: 'kitchen', yaw: Math.PI });
    await E.until(() => P.y < 1 && Math.hypot(P.x - 0.5, P.z + 4) < 3.5);
    rose.place({ x: 1.2, z: -3.4, y: 0, node: 'kitchen', yaw: Math.PI }, 'stand');
    linda.facePlayer(); linda.lookPlayer = true; E.objective('');
    await say('leon', "Mom! The radio! They're coming! Road crews, on Friday! Tomorrow!");
    await wait(1.2);
    await say('linda', "...That's wonderful, sweetie.", { mood: 'dark' });
    await say('rose', "Tomorrow?! Luke can come back! Lily too! We can all go!", { mood: 'happy' });
    await say('linda', 'Yes. We can all go.', { mood: 'creepy' });
    await think("She didn't even blink.");
    linda.lookPlayer = false; linda.anim('stand');
    rose.lookPlayer = true;
    await say('rose', 'Come on! Flowers! I want the crowns done before they get back!', { mood: 'happy' });
    rose.lookPlayer = false;
    // meadow
    E.objective('Follow Rose to the meadow'); E.setTime('day', { lights: [] }); E.music('home');
    await E.go(rose, 'meadow', { speed: 1.9 });
    rose.anim('crouch');
    await goNear(W.spots.meadow.x, W.spots.meadow.z, 6);
    rose.lookPlayer = true; rose.anim('stand');
    await say('rose', 'Okay! I need three fireweed. The tall pink ones.', { mood: 'happy' });
    await say('rose', 'Two lupines. Blue-purple, like little towers. And one forget-me-not. Tiny and blue. That one is the hardest.', { mood: 'happy' });
    rose.lookPlayer = false; rose.anim('crouch');
    // pickable flowers
    const mk = (x, z, kind) => { const g = new THREE.Group(), y = W.terrainH(x, z); g.position.set(x, y, z); W.sky.parent.add(g);
      const col = { fire: '#ff4fa0', lupine: '#7a5aff', forget: '#6aa8ff' }[kind], h = kind === 'forget' ? 0.25 : 0.7;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, h, 4), G.mat('#3a6a2a')); st.position.y = h / 2; g.add(st);
      if (kind === 'forget') for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), G.mat(col, 10, { e: '#203050' })); b.position.set(Math.cos(i) * 0.03, h, Math.sin(i) * 0.03); g.add(b); }
      else for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.03 - i * 0.002, 6, 4), G.mat(col, 10, { e: '#301020' })); b.position.set(0, h * 0.55 + i * 0.04, 0); g.add(b); }
      return { x, y: y + h * 0.7, z, group: g, done: false, kind }; };
    W.chores.flower = [mk(22.5, 15.5, 'fire'), mk(29.5, 17.0, 'fire'), mk(31.0, 23.5, 'fire'), mk(20.5, 21.5, 'lupine'), mk(27.0, 26.0, 'lupine'), mk(33.5, 20.0, 'forget')];
    { const need = { fire: 3, lupine: 2, forget: 1 }, got = { fire: 0, lupine: 0, forget: 0 }; const lab = () => `Fireweed ${got.fire}/3   Lupine ${got.lupine}/2   Forget-me-not ${got.forget}/1`;
      await new Promise(res => { E.objective(lab()); W.chores.flower.forEach(c => { const h = E.addInteract({ x: c.x, y: c.y, z: c.z, r: 2.4, dot: 0.85, label: { fire: 'Pick the fireweed', lupine: 'Pick the lupine', forget: 'Pick the forget-me-not' }[c.kind], cb: async () => {
        h.stop(); fx.flower(c); got[c.kind]++; E.objective(lab());
        if (c.kind === 'forget') await say('rose', 'YOU FOUND ONE! Leon, you have the best eyes in this family.', { mood: 'laugh', look: false });
        if (Object.keys(need).every(k => got[k] >= need[k])) res(); } }); }); });
      E.give('flowers'); }
    E.objective('Bring the flowers to Rose');
    rose.anim('stand'); await E.go(rose, 'meadowRock', { anim: 'sitFloor' });
    await E.talk(rose, 'Give Rose the flowers');
    E.give(null); rose.lookPlayer = true; prop(rose, 'flowers', 'R');
    await say('rose', 'Perfect. Sit. This takes a minute.', { mood: 'happy' });
    rose.P.drop('R'); prop(rose, 'crown', 'R', ...CROWN);
    await wait(1.5);
    await say('rose', "When the road opens, I'm going to plant a whole hill of lupines. Purple everywhere. You'll be able to see it from space.", { mood: 'happy' });
    await say('rose', "And I'm going to study plants. Botany. Lily says I'd be good at it.", { mood: 'soft' });
    await say('leon', "You'd be the best at it.");
    await say('rose', 'Here. Yours.', { mood: 'happy' });
    rose.P.drop('R'); E.give('crown'); A.chime();
    await say('rose', 'Fireweed is for starting over. Forget-me-nots are for... you know.', { mood: 'soft' });
    rose.lookPlayer = false;
    E.give(null); prop(rose, 'crown', 'R', ...CROWN);
    // back to the cabin: Rose asks
    E.objective('Walk back with Rose');
    rose.anim('stand'); E.go(rose, 'porchS', { speed: 1.5 });
    linda.place('porch', 'stand');
    await E.until(() => !rose.path && Math.hypot(P.x - 0, P.z - 10) < 6);
    E.objective('');
    rose.face(linda.x, linda.z); linda.face(rose.x, rose.z); linda.lookTarget = rose.headPos().clone(); rose.lookTarget = linda.headPos().clone();
    await say('rose', 'Mom, can I see what Luke and Lily are doing?', { mood: 'soft', look: false });
    await say('linda', 'Sure, hun. Come down to the basement.', { mood: 'creepy', look: false });
    rose.lookTarget = null; rose.facePlayer(); rose.lookPlayer = true;
    await say('rose', "Hold Lily's crown for me. I'll bring her up to get it.", { mood: 'happy' });
    rose.P.drop('R'); E.give('crown'); rose.lookPlayer = false;
    const roseAtDoor = E.go(rose, 'baseDoor');
    await wait(0.7);
    (async () => { await E.go(linda, 'kitchen'); await roseAtDoor; W.padlock.visible = false; W.setDoor('basement', true); A.creak(-4, 1, -6.25); await E.go(rose, 'baseIn'); rose.hide(); await E.go(linda, 'baseIn'); linda.hide(); W.setDoor('basement', false); A.doorShut(-4, 1, -6.25); })();
    await wait(1.6);
    await think('Rose too...?');
    E.give(null);
    W.chores.tomato.forEach(c => { c.done = false; c.toms.forEach(t => (t.visible = true)); });
    flavor(yardFlavor(4));
    await chore('tomato', 4, n => `Pick the tomatoes  ${n}/4`, 'Pick the tomatoes', 0.6);
    await think("They're so red this year.");
    E.amb.gen = false; await wait(1.5);
    await think('...The generator stopped.');
    E.objective('Go inside');
    E.setTime('redEve', { lights: ['fire', 'kitchen', 'dining'] }); E.music('dread');
    await E.until(() => E.inside());
    E.objective('');
    flavor(houseFlavor(4));
    await wait(6);
    clearFlavor();
    linda.P.setVariant('blood'); linda.P.setExpr('blood');
    linda.place('baseDoor', 'stand'); W.setDoor('basement', true); A.creak(-4, 1, -6.25);
    await E.go(linda, 'stove', { anim: 'stand' }); W.setDoor('basement', false); A.doorShut(-4, 1, -6.25);
    linda.facePlayer(); linda.lookPlayer = true;
    E.objective('Mom is back');
    await E.until(() => Math.hypot(P.x - linda.x, P.z - linda.z) < 4);
    E.objective(''); E.lock(true);
    await E.lookNpc(linda, 0.8);
    await E.look(linda.x, 1.1, linda.z, 0.7);
    await think('Is that... ketchup?');
    await E.lookNpc(linda, 0.6);
    await say('linda', "Don't mind the mess, sweetie. Ketchup.", { mood: 'blood' });
    await say('linda', 'Sit down. Tonight is extra special.', { mood: 'blood' });
    E.lock(false); linda.lookPlayer = false; linda.yaw = Math.PI; linda.anim('cook'); W.panMeat.visible = true; E.amb.sizzle = true;
    await meal({
      kids: [], food: 'steak', momFood: 'steak', time: 'night', lights: ['dining', 'candle', 'fire'],
      setup: () => { E.amb.sizzle = false; W.panMeat.visible = false; linda.P.setExpr('blood'); W.roseCrown.visible = false; },
      bites: [
        async () => { await think('Better than ever. So tender it falls apart.'); },
        async () => { linda.anim('sitTable'); linda.lookPlayer = true; await think("Mom isn't eating. She's just... watching me."); },
        async () => {
          await say('leon', 'Mom, where are Lily, Luke and Rose? Can I go see them?');
          E.amb.dread = 0.06; await wait(1.6);
          await say('linda', '...Of course you can, sweetie.', { mood: 'dark' });
          await say('linda', "They're all downstairs. Come on.", { mood: 'creepy' });
        }
      ]
    });
    await basement();
  }

  async function basement() {
    linda.lookPlayer = false; E.music(null);
    E.stand(2.5, -0.2, Math.PI / 2); P.pitch = -0.1;
    W.bodies.group.visible = true; W.decals.visible = true; W.flies.visible = true; W.curtainGore.visible = true;
    W.setLight('cold', true); W.setLight('base', true);
    linda.anim('stand');
    await E.go(linda, 'baseDoor');
    W.lockDoor('basement', false); W.padlock.visible = false; W.setDoor('basement', true); A.creak(-4, 1, -6.25);
    E.allow.basement = true; W.doors.basement.colLock = false;
    E.objective('Follow Mom');
    await E.go(linda, 'curtain', { speed: 1.0 });
    linda.face(-9.3, -6); linda.lookPlayer = true;
    await E.until(() => P.y < -2.3);
    E.objective(''); E.amb.dread = 0;
    let beating = true; (async () => { while (beating) { A.heartbeat(0.9); await wait(0.85); } })();
    await E.until(() => Math.hypot(P.x - linda.x, P.z - linda.z) < 3.0);
    E.lock(true);
    await E.lookNpc(linda, 0.8);
    await say('linda', "They're right through here, sweetie. All together.", { mood: 'creepy' });
    linda.anim('stand'); linda.face(-6.6, 1); A.plastic();
    await E.tween(1.4, k => { W.curtain.scale.x = 1 - k * 0.88; });
    W.curtainCol.on = false;
    await E.go(linda, { x: -3.9, z: -0.6, y: -3 }, { direct: true });
    A.sting(); E.IN.rumble(0.6, 0.8, 600);
    await E.look(-6.4, -2.05, 2.0, 1.4);
    await say('leon', 'Luke...?', { mood: 'scared' });
    await E.look(-8.6, -2.9, 2.4, 0.9);
    await say('leon', 'Lily...?', { mood: 'scared' });
    await E.look(-4.6, -2.85, 1.6, 0.7);
    await say('leon', 'ROSE?!', { mood: 'scared', yell: true });
    await E.look(-6.2, -2.1, 2.1, 1.2);
    await say('leon', 'wait...', { mood: 'scared' });
    await say('leon', 'is this where dinner came from..', { mood: 'scared' });
    await say('leon', 'i ate them?', { mood: 'scared' });
    beating = false; E.amb.droneTc = 0.02; E.amb.dread = 0;
    W.wallAxe.visible = false;
    const fx2 = -Math.sin(P.yaw), fz2 = -Math.cos(P.yaw);
    linda.lookPlayer = false;
    linda.place({ x: P.x - fx2 * 0.9, z: P.z - fz2 * 0.9, y: -3, yaw: Math.atan2(fx2, fz2) }, 'axeUp'); prop(linda, 'axe', 'R', ...AXE); linda.P.setExpr('blood');
    await wait(0.5); A.npcStep(linda.x, linda.y, linda.z, 'stone');
    A.hum(linda.x, linda.y + 1.6, linda.z, 1);
    await wait(1.3);
    linda.anim('axeDown');
    await E.hit();
    await wait(1.4);
    linda.anim('stand'); linda.P.drop('R'); linda.lookPlayer = true;
    await wait(1.8);
    await say('linda', "Shh. Shh. It's okay, baby. You'll be with them now.", { mood: 'creepy', whisper: true });
    await E.fade(1, 2.5);
    E.clearFx();
    await wait(2.2);
    await ending();
  }

  async function ending() {
    hideAll(); E.hud(false); E.letterbox(true);
    E.setTime('night', { lights: ['dining', 'candle', 'fire'] }); E.amb.droneTc = 1.2;
    W.bodies.group.visible = false; W.flies.visible = false;
    W.food('linda', null); linda.place('linda', 'eat'); linda.P.setVariant('blood'); linda.P.setExpr('tired'); prop(linda, 'fork', 'R');
    const spots = [[-1.25, -0.62], [-1.25, 0.22], [-0.8, -0.45], [-0.8, 0.05]];
    ['luke', 'lily', 'rose', 'leon'].forEach((k, i) => { W.food(k, 'steak'); const p = W.plates[k]; p.group.position.set(spots[i][0], 0.805, spots[i][1] - 0.2); });
    E.cam(2.6, 1.4, -0.2, -1.9, 1.05, -0.2);
    A.musicBox(12);
    await E.fade(0, 2.2);
    const cam = E.camera;
    await E.tween(8.5, k => { cam.position.set(2.6 - k * 2.0, 1.5 - k * 0.04, -0.2 + Math.sin(k * 2) * 0.05); cam.lookAt(-1.9, 1.08 - k * 0.02, -0.2); }, k => k * (2 - k));
    linda.anim('sitTable'); linda.P.setExpr('creepy'); linda.lookPlayer = true;
    await wait(2.2);
    document.getElementById('fade').style.opacity = 1; A.thud();
    await wait(2.2);
    E.letterbox(false);
    await E.title('PLENTY MORE', '', 3.5);
    E.end();
  }

  // ---------------- optional interactions (exploration) ----------------
  function bedroomFlavor(day) {
    const list = [
      { x: 8.6, y: 4.55, z: -3.4, label: "Look at Luke's poster", run: async () => { await think("Kaylie. Luke's 'friend'. She has two million followers."); await think('He has us.'); } },
      { x: 5.85, y: 4.6, z: -3.4, label: "Look at Lily's drawings", run: async () => { await think("Lily draws everything. The mountain, the chickens, us. She even drew Biscuit's grave."); } },
      { x: 7.2, y: 4.05, z: 6.8, label: "Look at Rose's seedlings", run: async () => { await think(day >= 4 ? 'The lupines opened this morning. Purple. Rose was right.' : "Rose talks to them. She says it helps. I've heard her say goodnight to them."); } },
      { x: 9.5, y: 3.65, z: 4.0, label: 'Look at your comics', run: async () => { await think("I've read all of them nine times. I could recite Captain Comet #14 from memory."); } }
    ];
    if (day >= 3) list.push({ x: 8.5, y: 3.6, z: -2.1, label: "Look at Luke's phone", run: async () => { await E.read({ style: 'phone', title: day === 3 ? '6:58' : '', body: day === 3 ? '<div class="note"><b>KaylieLive</b>missed u in chat last night!! &lt;3 (sent to all subscribers)</div><div class="note"><b>Battery</b>4% remaining</div>' : '<div style="text-align:center;opacity:0.5;margin-top:120px">The battery is dead.</div>' }); if (day === 3) await think('"Sent to all subscribers." Luke would have died for that message.'); } });
    if (day >= 4) list.push({ x: 5.8, y: 3.62, z: -1.8, label: "Open Lily's sketchbook", run: async () => { await E.read({ style: 'paper', title: 'the last page', body: "I'm going to ask her where the meat came from. If she gets angry, at least I'll know.<br><br>Leon, if you read this: breathe. In for four. Out for four. &mdash; L", img: tex2url(T.sketchDoor) }); } });
    return list;
  }
  function houseFlavor(day) {
    const diary = [
      '<b>Day 42.</b> The oats are gone tomorrow. I gave Leon my bowl again. His wrists are so thin.<br>The radio is just static. I keep thinking about the winter Grandpa told me about. What people did.',
      '<b>Day 43.</b> Luke is strong. Luke always said he would do anything for them.<br>He said it again last night. Anything.',
      "<b>Day 44.</b> They loved it. Rose had seconds. I haven't seen them smile like that since summer.<br>He's still with us. He will always be with us.<br><br>Lily keeps looking at me.",
      '<b>Day 45.</b> The girls are together now.<br>Leon is my baby. My baby. I can\'t.<br>I can.<br><br>There\'s plenty more.'
    ];
    const list = [
      { x: -9.5, y: 0.65, z: 3.95, label: "Read Mom's diary", run: async () => { await E.read({ style: 'paper', title: "Mom's diary", body: diary.slice(0, day).join('<br><br>') }); if (day >= 2) await think("...I shouldn't have read that."); } },
      { x: -3.9, y: 1.6, z: -4.95, label: 'Look at the calendar', run: async () => { await think('Every day crossed off in red. "Road out?" with a question mark. Mom wrote that on day one.'); } },
      { x: 9.18, y: 1.9, z: 1.5, label: 'Look at the family photo', run: async () => { await think("Last summer. Luke's making a face. Lily's laughing. Rose is holding a flower. Mom looks so... young."); } },
      { x: 1.85, y: 1.2, z: 6.68, label: "Look at Luke's coat", run: async () => { await think(day >= 3 ? "Luke's coat. Still on the hook. He'd never go out in the rain without it." : "Luke's coat. It smells like woodsmoke and energy drinks."); } },
      { x: -1.3, y: 3.85, z: 6.3, label: "Read Mom's ration ledger", run: async () => { await E.read({ style: 'note', title: 'PANTRY', body: 'OATS: ' + (day > 1 ? '0' : '1 day') + '<br>FLOUR: 1 cup<br>POTATOES: 6<br>SALT: some<br>' + (day >= 2 ? 'MEAT: ' + '&#9646;'.repeat(day * 4 - 4) + '<br><br><i>it will last if I am careful</i>' : '<br><i>what do I do</i>') }); } },
      { x: 5.55, y: 0.8, z: -0.1, label: 'Try the radio', run: async () => { A.radio(3); await think('Static. Just static. Mom keeps it on low anyway. I think the noise helps her.'); } }
    ];
    if (day >= 2) list.push({ x: -3.95, y: 1.1, z: -6.25, label: 'Open the basement door', active: () => !W.doors.basement.cur, run: async () => { A.locked(); await think('Padlocked. From this side.'); if (E.amb.gen) await think("The generator's so loud down there."); }, repeat: true, again: async () => { A.locked(); await think('Locked.'); } });
    if (day >= 3) list.push({ x: 2.6, y: 1.0, z: -6.5, label: 'Look in the pantry', run: async () => { await think('Jars. Rows of them. Red, packed tight, sealed. Mom must have been up all night canning.'); await think("...We don't have any deer jars. We've never had a deer."); } });
    return list;
  }
  function yardFlavor(day) {
    return [
      { x: -12.7, y: 0.4, z: -7.8, label: "Look at Biscuit's grave", run: async () => { await think('BISCUIT. GOOD GIRL. 2 EGGS A DAY. Rose painted it. There are fresh flowers on it.'); } },
      { x: -6.5, y: 1.2, z: 17.5, label: 'Look at the truck', run: async () => { await think("Dad's old truck. No gas since the second week. Luke still sits in it sometimes to charge his phone with the crank."); } },
      { x: 21.04, y: 1.5, z: 3.44, label: 'Look at the scarecrow', run: async () => { await think("Rose named him Gerald. Gerald isn't scaring anything. There's nothing left to scare."); } },
      { x: 3.25, y: 1.2, z: 12.05, label: 'Check the mailbox', run: async () => { await think('KESSLER. Empty. Obviously. Nobody has been up the road in six weeks.'); } },
      { x: 0, y: W.terrainH(0, 68) + 1, z: 68.5, r: 4, label: 'Look at the washout', run: async () => { await think('The road just... ends. A cliff where the pavement used to be. Mom says the creek took the whole hillside.'); } }
    ];
  }
  function atticFlavor() {
    return [{ x: -9.3, y: 3.5, z: -4.6, label: 'Open the box marked DAD', run: async () => { A.page(); await think('Old sweaters. A watch. And...'); await think("Dad's coat. Folded. Right here."); await think('Mom said Luke took it.'); } }];
  }

  // ---------------- run ----------------
  const days = [day1, day2, day3, day4];
  for (let d = Math.max(1, Math.min(4, startDay | 0)); d <= 4; d++) { E.flags.day = d; await days[d - 1](); }
};
