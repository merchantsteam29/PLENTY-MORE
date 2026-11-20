# PLENTY MORE

A first-person horror story game, about 45 to 60 minutes long. You are Leon, 13, the youngest of four kids living with their mom in a log cabin high in the mountains. A storm took out the only road six weeks ago, and the food is almost gone. Over four days you tend the garden, chop wood, climb to the one spot with phone signal with your brother, sketch with your sister and pick flowers with the other. One by one they go down to the basement to help Mom, and dinner keeps getting better.

**Content warning:** graphic violence, gore, death of family members, cannibalism.

## Play
- Online: https://merchantsteam29.github.io/game5/
- Locally: open `index.html` in Chrome, Edge or Firefox. It needs internet the first time to load Three.js. Headphones are recommended.

Progress saves at the start of each day, and **Continue** on the title screen picks up from there.

| | Keyboard / mouse | Controller | Touch |
|---|---|---|---|
| Move | WASD | Left stick | Left thumb |
| Look | Mouse | Right stick | Drag on the right side |
| Use / continue | E, Space, click | A | Tap or ✋ |
| Jog | Shift | L3 or triggers | RUN |
| Choose a reply | W/S + E, or 1 to 3 | D-pad + A | Tap |
| Pause | Esc / P | Start | ❚❚ |

The settings menu covers graphics quality (Low is for phones), look sensitivity, invert Y, field of view, text speed and volume.

## Voice acting
Every line has a stable ID. A recorded line plays automatically, with lip sync and 3D positioning. Lines without a recording use a synthesized murmur voice.
1. `node tools/voice-script.js` generates **VOICE_SCRIPT.md** (all 299 lines, grouped by character with directions) and `voice/lines.csv`.
2. Actors save each line as `voice/<ID>.mp3` (or `.ogg`, `.wav`, `.m4a`).
3. `node tools/voice-manifest.js` registers the files. Commit them and they're live.

When a line in `js/story.js` changes, its ID changes too. Re-run step 1 and re-record that line.

## Files
- `js/story.js`: the whole script (four days, choices, optional exploration, the basement, the ending)
- `js/main.js`: engine. Covers the player, NPC navigation, dialogue (which never cuts a line off), live pixel-art portraits, interactions and hold/timing actions, menus and saves.
- `js/people.js`: skinned, procedurally sculpted characters with eyes, eyelids, brows, a talking mouth, expressions and a blended animation library
- `js/world.js`: the two-storey cabin and basement, terrain, garden, coop, shed, Signal Rock, the meadow, the washed-out road, weather and the light pool
- `js/tex.js`: every texture painted procedurally, including faces for each expression and the clothing atlases
- `js/audio.js`: WebAudio ambience, foley, music, voice playback and the murmur voice
- `js/input.js`: keyboard and mouse, gamepad, and touch

## Performance
- Static scenery is merged into a few dozen meshes, one per material.
- Trees, rocks, grass and flowers are instanced, and wind sway runs on the GPU.
- Each character is one skeleton and 4 draw calls.
- Interior lamps share a fixed pool of 2 to 4 point lights, so shaders never recompile.
- Shadows only update where they can be seen.
- Resolution scales dynamically to hold frame rate.
- A typical frame is about 90 draw calls.
