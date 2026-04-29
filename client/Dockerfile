# ETAPA 1: Base
FROM node:20-alpine AS base
RUN npm i -g pnpm@9.0.0

# ETAPA 2: Dependencias
FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ETAPA 3: Builder
FROM dependencies AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ETAPA 4: Producción (Usando el modo standalone mágico de Next.js)
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone mode agrupa solo los archivos y node_modules estrictamente necesarios
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
