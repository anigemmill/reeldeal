# Reeldeal background worker: media analysis and rendering with FFmpeg.
# Runs on any container host (Fly.io, Railway, Render, a VM). Never on Vercel functions.
#   docker build -f infra/worker/Dockerfile -t reeldeal-worker .
#   docker run --env-file worker.env reeldeal-worker
FROM node:22-bookworm-slim AS node

# Ubuntu 24.04: FFmpeg 6.1 and Inter are in the main archive. Node comes from the official image.
FROM ubuntu:24.04
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

# FFmpeg for probing, scene detection and rendering; Inter for on-screen text; tini as PID 1
# so SIGTERM reaches the worker and it can hand an unfinished job back to the queue.
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ffmpeg fonts-inter fonts-dejavu-core tini ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --create-home worker

WORKDIR /app
ENV NODE_ENV=production PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
# tsx is a runtime dependency: the worker runs the TypeScript sources directly.
# Optional extra CA for builds behind a TLS-intercepting proxy (docker build --secret id=ca,src=...).
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi \
 && npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

COPY tsconfig.json ./
COPY config ./config
COPY src/env ./src/env
COPY src/server ./src/server
COPY src/lib/pricing ./src/lib/pricing
COPY scripts/worker.ts ./scripts/worker.ts

USER worker
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--conditions=react-server", "--import", "tsx", "scripts/worker.ts"]
