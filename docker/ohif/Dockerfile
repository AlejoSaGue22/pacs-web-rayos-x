# Usar la imagen oficial pre-compilada de OHIF para evitar tiempos de compilación de horas
FROM ohif/app:latest

# Sobrescribir la configuración por defecto con nuestra configuración personalizada
COPY ohif-config.js /usr/share/nginx/html/app-config.js

# Exponer el puerto 80 (ya lo hace la imagen base, pero es buena práctica)
EXPOSE 80

# Fix service worker crash when running on HTTP (non-secure context,
# ej. http://192.168.x.x): navigator.serviceWorker es undefined y OHIF tira
# "Cannot read properties of undefined (reading 'getRegistrations')".
# Es inocuo para el visor, pero ensucia la consola. Patrón tolerante.
RUN if [ -f /usr/share/nginx/html/init-service-worker.js ]; then sed -i 's/navigator\.serviceWorker\.getRegistrations()/((navigator.serviceWorker \&\& navigator.serviceWorker.getRegistrations) ? navigator.serviceWorker.getRegistrations() : Promise.resolve([]))/g' /usr/share/nginx/html/init-service-worker.js || true; fi
