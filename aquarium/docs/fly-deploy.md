# Deploy on Fly.io

This app runs Node (static + PocketBase + trainer) from the repo `Dockerfile`. Production needs PocketBase superuser credentials as Fly secrets—not in `fly.toml`.

## One-time setup

```sh
# From repo root, with flyctl logged in (fly auth login)
fly secrets set \
  PB_SUPERUSER_EMAIL='you@example.com' \
  PB_SUPERUSER_PASSWORD='choose-a-strong-password' \
  -a aquarium-3d0uzq
```

## Deploy

```sh
fly deploy -a aquarium-3d0uzq
fly status -a aquarium-3d0uzq
fly logs -a aquarium-3d0uzq
fly apps open -a aquarium-3d0uzq
```

Health check: `GET /health` (PocketBase must be up).

## GitHub Actions

Push to `main` runs `.github/workflows/fly-deploy.yml`. The repo needs a `FLY_API_TOKEN` secret (Fly dashboard → org → Access Tokens, or created during `fly launch`).

## Common failures

| Symptom | Fix |
| --- | --- |
| Log: `production needs PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD` | Set both secrets (above), then `fly deploy`. |
| Health check never passes | App must listen on `0.0.0.0:8080` (`HOST` / `PORT` in `fly.toml`). |
| Wrong app / deploy 404 | `app` in `fly.toml` must match an existing Fly app name. |

## Reference

Working layout matches [pixelforge/aquarium](https://github.com/pixelforge/aquarium) (`fish-in-space` on Fly): Dockerfile, volume at `/data`, 512MB machine, Amsterdam region.
