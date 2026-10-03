# Usar la imagen oficial pre-compilada de OHIF para evitar tiempos de compilación de horas
FROM ohif/app:latest

# Sobrescribir la configuración por defecto con nuestra configuración personalizada
COPY ohif-config.js /usr/share/nginx/html/app-config.js

# Exponer el puerto 80 (ya lo hace la imagen base, pero es buena práctica)
EXPOSE 80
