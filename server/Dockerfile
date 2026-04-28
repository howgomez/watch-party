# ETAPA 1: Base - Preparamos el sistema operativo (un Linux súper ligero llamado Alpine)
FROM node:20-alpine AS base
# Instalamos pnpm globalmente para poder usarlo en las demás etapas
RUN npm i -g pnpm@9.0.0

# ETAPA 2: Dependencias - Instalamos TODO (lo que pesa mucho)
FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# Instalamos todas las dependencias (incluyendo las de desarrollo como TypeScript)
RUN pnpm install --frozen-lockfile

# ETAPA 3: Builder - Compilamos el código
FROM dependencies AS builder
WORKDIR /app
COPY . .
# Generamos el cliente de Prisma para que entienda nuestra base de datos
RUN pnpm exec prisma generate
# Compilamos el proyecto de NestJS (crea la carpeta /dist)
RUN pnpm run build

# ETAPA 4: Producción - La imagen final (súper optimizada y ligera)
FROM base AS production
WORKDIR /app
# Copiamos los archivos de configuración
COPY package.json pnpm-lock.yaml ./
# Copiamos el schema ANTES de instalar para que el auto-generador de Prisma funcione
COPY prisma ./prisma
# Magia: Solo instalamos las dependencias necesarias para PRODUCCIÓN (pesa poquísimo)
RUN pnpm install --prod --frozen-lockfile

# Copiamos SOLO nuestro código ya compilado de la etapa 3
COPY --from=builder /app/dist ./dist

# Exponemos el puerto de tu API (asumiendo que NestJS usa el 3000 o 3001)
EXPOSE 3000

# El comando maestro que se ejecutará cuando encendamos el contenedor
CMD ["node", "dist/main.js"]
