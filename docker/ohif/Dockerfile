FROM node:20-alpine AS builder

# Install git to clone OHIF
RUN apk add --no-cache git

# Clone OHIF Viewers repository (specific stable version)
RUN git clone --branch v3.8.3 https://github.com/OHIF/Viewers.git /ohif
WORKDIR /ohif

# Ensure cross-env is available
RUN yarn global add cross-env

# Install dependencies (frozen lockfile to ensure reproducible builds)
RUN yarn install --frozen-lockfile

# Copy our custom configuration
COPY ohif-config.js /ohif/platform/app/public/config/default.js

# Set environment variables for OHIF build
ENV APP_CONFIG=config/default.js
ENV PUBLIC_URL=/

# Build OHIF App
RUN yarn run build

# Stage 2: Serve OHIF using Nginx
FROM nginx:alpine

# Escribir configuración personalizada de Nginx para soportar rutas SPA
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    error_page 500 502 503 504 /50x.html; \
    location = /50x.html { \
        root /usr/share/nginx/html; \
    } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=builder /ohif/platform/app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Default command to start nginx
CMD ["nginx", "-g", "daemon off;"]
