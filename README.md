# PlayGround

## 🎮 Azure Blade — Tower of the Fallen King

A complete, playable 2D side-scrolling action game inspired by *Tower Hunter: Erza's Trial* — no build step, no dependencies, just open `index.html` (or serve the folder statically).

**You are Airi**, last swordswoman of the Azure Order. Climb the cursed spire, master her one-handed blade, and bring **Ghalus, the Gilded King** to his knees at the summit.

### Features
- **Movement** — run, variable-height jump, double jump, wall jump (wall slide + leap), Shift dash, ↓ dodge roll with i-frames
- **Combat** — 3-hit light combo, heavy attack with big knockback, full air combat, enemy knockback, hitstop & screen shake
- **Enemies** — hopping slimes, sword-swinging goblins with patrol/chase AI, storm-bats that dive from above
- **Boss** — Ghalus, the Gilded Knight: sword sweeps, wall-crash charge, leaping slam with shockwaves, axe tosses; **Phase II below 50% HP** (faster, harder-hitting, double shockwaves)
- **The tower** — five torchlit zones with spike traps, timed fire jets, wall-jump chimneys, brazier checkpoints, and **hidden treasure rooms** behind gilded archways (a Heart Container and a 150-gem hoard)
- **Presentation** — painted vector art on canvas, parallax dusk vista, dynamic flames/embers, procedural Web Audio SFX and ambient music (M to mute), damage numbers, gem magnet, localStorage best-clear tracking
- **Mobile** — responsive layout + on-screen touch controls (landscape recommended), iOS safe-area aware

### Controls
| Input | Action |
| --- | --- |
| `A`/`D` or `←`/`→` | Run |
| `Space` / `W` / `↑` | Jump · double jump in mid-air |
| Wall + jump | Wall jump |
| `↓` / `S` | Dodge roll (invincible) |
| `Shift` / `C` | Dash |
| `J` / `Z` | Light attack (combo ×3) |
| `K` / `X` | Heavy attack |
| `Esc` / `P` | Pause · `M` mute |

### Run locally
Any static server works, e.g. `npx serve .` → open the printed URL. Tested in Chromium. `?debug=1` exposes a small `window.__azure` hook for poking at the world from DevTools; `?touch=1` forces the touch controls.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/ygk254248-ctrl/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/ygk254248-ctrl/PlayGround)

- 🎮 [Open the project](https://omgithub.com/ygk254248-ctrl/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=ygk254248-ctrl%2FPlayGround).
- 💻 [Explore the source](https://github.com/ygk254248-ctrl/PlayGround).
- 🛠️ [Check build runs](https://github.com/ygk254248-ctrl/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/ygk254248-ctrl/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/ygk254248-ctrl).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
