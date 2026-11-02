# PixelForge

Procedural pixel art generators for pilots, fish, and plants. Each kind is a **genome**: roll from a seed, edit traits, breed, animate, and export PNGs.

- **v1** (`src/gen/`): frozen historic algorithms — parity tests lock pixels.
- **v2** (`src/v2/`): lit remasters with size classes and pose rigs.
- **v3+** (`src/v3/`, `src/v4/`): fish3, fish4, plant3, plant4, pilot3.

| kind | v1 | v2 | v3 / v4 |
|---|---|---|---|
| Pilots | `pilot` | `pilot2` | `pilot3` |
| Fish | `fish` | `fish2` | `fish3`, `fish4` |
| Tank plants | `waterplant` | `waterplant2` | — |
| Garden plants | `plant`, `plant32` | `plant2` | `plant3`, `plant4` |

## Quick start

```sh
npm run app:static          # landing http://localhost:8017/ · forge /app/#forge
pnpm studio                 # Algorithm Studio (Vite) at /studio.html
npm run forge -- list       # all generator ids
npm test
```

The **landing page** lists every generator with live previews. **Forge** is the full editor (traits, gallery, export). **Studio** is for tuning generator source under `src/`.

```sh
node cli/forge.mjs fish3 --count 12 --contact --set swim=cartoon
node cli/forge.mjs plant4 --count 6 --anim wind --contact
```

CLI output goes to `out/<kind>/` with `manifest.json`.

## Library import

```js
import { GENERATORS, generator, fromCode, sizeOf } from 'pixelforge/registry';
```

Package name is `pixelforge` (formerly published/consumed as `fish-in-space` in older checkouts).

## Deploy (Fly.io)

```sh
fly apps create pixelforge   # or change `app` in fly.toml
fly secrets set PB_SUPERUSER_EMAIL=… PB_SUPERUSER_PASSWORD=…
fly deploy
```

- Landing: `https://<app>.fly.dev/`
- Forge: `https://<app>.fly.dev/app/#forge`
- PocketBase admin: `https://<app>.fly.dev/_/`

Game clients that consume these generators should vendor from this repo on their own schedule; PixelForge does not ship a nested game checkout.
