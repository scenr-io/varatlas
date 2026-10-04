# syntax=docker/dockerfile:1

# ---- build: install, test-free production build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- runtime: distroless Node, no shell, no package manager, non-root ----
# The server is a single bundled file, so no node_modules are copied.
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3131
EXPOSE 3131
USER nonroot

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3131/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["dist/server/index.mjs"]
