# PLENTY MORE

A short first-person horror story game (~10–15 min). You are Leon, 13, the youngest of four kids living with their mom Linda in a cabin high in the mountains. The road is washed out and food is scarce. You tend the garden. One by one, your siblings go down to the basement to help Mom. And dinner keeps getting better.

**Content warning:** graphic violence, gore, death of family members, cannibalism.

## Play
Open `index.html` in Chrome/Edge/Firefox (needs internet the first time to load Three.js). Headphones recommended.

- **WASD / mouse** – move / look (**Shift** walks faster)
- **E / click** – interact, continue dialogue

## Files
- `js/story.js` – the whole script (days, dialogue, dinners, basement, ending)
- `js/main.js` – engine: player, NPCs, dialogue boxes, interactions, cutscene camera
- `js/world.js` – cabin, garden, basement, terrain; static geometry merged per material
- `js/people.js` – character models, poses, the basement bodies
- `js/tex.js` – all textures, faces and pixel portraits drawn procedurally
- `js/audio.js` – all sound synthesized with WebAudio

## Performance notes
Static scenery is merged into ~30 draw calls, trees are a single instanced mesh, and shadow maps only update where you can see them. Lights are never toggled (that would recompile shaders), and pixel ratio is capped at 1.5.
