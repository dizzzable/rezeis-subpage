# ─────────────────────────────────────────────────────────────────────────────
# rezeis-subpage — self-contained multi-stage build.
#
# Unlike upstream (which only builds the backend and expects a pre-built
# frontend/dist to be copied in), this Dockerfile ALSO builds the frontend, so
# `docker build` / `docker compose build` is fully self-contained and can never
# ship a stale SPA.
# ─────────────────────────────────────────────────────────────────────────────

# 1) Build the React (Vite) frontend → frontend/dist
FROM node:24-trixie-slim AS frontend-build
WORKDIR /opt/app/frontend

COPY frontend/package*.json ./
COPY frontend/.npmrc ./
RUN npm ci

COPY frontend/ .
RUN npm run start:build

# 2) Build the NestJS backend → dist
FROM node:24-trixie-slim AS backend-build
WORKDIR /opt/app

COPY backend/package*.json ./
COPY backend/tsconfig.json ./
COPY backend/tsconfig.build.json ./

RUN npm ci

COPY backend/ .

RUN npm run build
RUN npm cache clean --force
RUN npm prune --omit=dev

# 3) Runtime image
FROM node:24-trixie-slim
WORKDIR /opt/app

LABEL org.opencontainers.image.title="Rezeis Subscription Page"
LABEL org.opencontainers.image.description="Rezeis Subscription Page (fork of remnawave/subscription-page). Config sourced from rezeis-admin; subscription data from Remnawave."
LABEL org.opencontainers.image.source="https://github.com/remnawave/subscription-page"
LABEL org.opencontainers.image.licenses="AGPL-3.0"

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /opt/app/dist ./dist
COPY --from=backend-build /opt/app/node_modules ./node_modules

# Built SPA from the frontend stage (self-contained — no host pre-build needed).
COPY --from=frontend-build /opt/app/frontend/dist/ ./frontend/

COPY backend/package*.json ./
COPY backend/ecosystem.config.js ./
COPY backend/docker-entrypoint.sh ./

ENV PM2_DISABLE_VERSION_CHECK=true
ENV NODE_OPTIONS="--max-old-space-size=16384"

RUN npm install pm2 -g

ENTRYPOINT [ "/bin/sh", "docker-entrypoint.sh" ]

CMD [ "pm2-runtime", "start", "ecosystem.config.js", "--env", "production" ]
