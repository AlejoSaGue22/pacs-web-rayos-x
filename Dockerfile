# 1. Build environment
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the Vite React frontend and backend
RUN npm run build

# 2. Production environment
FROM node:20-alpine

WORKDIR /app

# Copy package info and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled frontend and backend source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/prisma ./prisma

# Expose the API and Web port
EXPOSE 3000

# Setup environment variables
ENV NODE_ENV=production

# Start the Node.js server using tsx
CMD ["npx", "tsx", "server.ts"]
