# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /repo

# Instalar dependencias del monorepo (workspaces)
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @manako/api --workspace @manako/shared --include-workspace-root || npm install --omit=dev

COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN npx prisma generate && npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace @manako/api --include-workspace-root || npm install --omit=dev

COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/node_modules ./node_modules

EXPOSE 3000
# Layout del build (paths del monorepo): dist/apps/api/src/main.js
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
