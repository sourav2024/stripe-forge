# Multi-stage build keeps the runtime image small: the toolchain and dev
# dependencies stay in the builder and never ship to production.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
# Generate the Prisma client against the schema before compiling TS.
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force
COPY --from=builder /app/dist ./dist
# Drop root: run as the unprivileged `node` user baked into the base image so a
# container escape does not land an attacker as root. Files copied above are
# world-readable, so no chown is required to read/run them.
USER node
EXPOSE 4000
# Liveness for the orchestrator; wget ships in alpine busybox.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD wget -qO- http://localhost:4000/health || exit 1
# The compose file overrides this to run migrations first for the API service.
CMD ["node", "dist/server.js"]
