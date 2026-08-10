FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias (incluyendo devDependencies para el build)
RUN npm install

# Copiar el resto del código
COPY . .

# Generar el cliente de Prisma
RUN npx prisma generate

# Construir el frontend (Vite) y backend (esbuild)
RUN npm run build

# --- Etapa de Producción ---
FROM node:20-alpine

WORKDIR /app

# Instalar solo dependencias de producción
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev
RUN npx prisma generate

# Copiar los archivos compilados desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
