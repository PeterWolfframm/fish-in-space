# PixelForge: static server + PocketBase on Fly.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN PB_OS=linux PB_ARCH=amd64 node scripts/get-pocketbase.mjs

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    APP_PORT=8080 \
    PB_URL=http://127.0.0.1:8090 \
    PB_DATA=/data/pb_data

EXPOSE 8080
CMD ["node", "scripts/run-app.mjs"]
