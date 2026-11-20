# Voice lines

Put recorded lines in this folder, named by their ID from `VOICE_SCRIPT.md` (for example `luke_gy7712.mp3`), then run:

```
node tools/voice-manifest.js
```

That rewrites `manifest.js`, which the game loads to find the recordings. Lines that have no recording keep the synthesized murmur voice.

- `lines.csv` lists every line (id, character, text, direction, scene) for spreadsheets or casting sites.
- Recordings play with lip sync and positional audio when the game is served over http(s), such as GitHub Pages. When you open `index.html` straight from disk they still play, just without the 3D positioning.
