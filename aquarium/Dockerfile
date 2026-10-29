FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV PB_OS=linux PB_ARCH=amd64
RUN npm run build && node scripts/get-pocketbase.mjs

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/.pocketbase/pocketbase ./.pocketbase/pocketbase
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/server ./server
COPY --from=build /app/forge ./forge
COPY --from=build /app/pb_migrations ./pb_migrations
COPY --from=build /app/vendor ./vendor
COPY --from=build /app/public ./public
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=8080 \
  PB_DATA=/data/pb_data
EXPOSE 8080
CMD ["npm", "start"]
