# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/ygk254248-ctrl/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/ygk254248-ctrl/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/ygk254248-ctrl/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/ygk254248-ctrl/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/ygk254248-ctrl/PlayGround).
- 🛠️ [Check build runs](https://github.com/ygk254248-ctrl/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/ygk254248-ctrl/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/ygk254248-ctrl).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->

## 🎮 Aetherborne: Warband

A tile-based dungeon crawl with **12 races × 12 base classes × specialist kits** and **6 v 6 turn-based combat**, descending a haunted tower across 5 themed floors (plus an endless mode past the finale).

### Play

Open `index.html` (or serve the repo statically, e.g. `python3 -m http.server`) and click **새 원정대 결성**. The legacy action-mode climb remains available at `aetherborne.html`.

### Controls

| Context | Keys |
| --- | --- |
| Dungeon | `WASD` / arrows move · `E` interact · `ESC` abandon run |
| Battle | `1–6` actions · `A` toggle auto-battle · `ESC` cancel targeting |
| Touch | On-screen D-pad + interact button, tap units/actions |

### Loop

1. Build a warband of six (race → class → kit → stats → name → formation).
2. Explore each floor; clear every encounter to unseal the stairs. Chests give gold/potions, shrines heal 35%.
3. Defeat the **잿빛 감시관** (floor 3) and the **공허의 왕관** (floor 5) to finish the campaign — then keep descending if you dare.

### Project layout

- `js/warband/` — v2 Warband game (`data.js` content, `character.js` math, `dungeon.js` generation/rendering, `battle.js` engine, `main.js` shell/UI)
- `js/*.js` + `aetherborne.html` — legacy action mode
- `window.__warband` is exposed for debugging and automated smoke tests

