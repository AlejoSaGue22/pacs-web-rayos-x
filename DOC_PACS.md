# Guía del Sistema: Mini PACS Web - Rayos X

## 1. Introducción
El **Mini PACS Web** es un prototipo (Mock) de un Sistema de Archivo y Comunicación de Imágenes (PACS por sus siglas en inglés) diseñado para la gestión de pacientes, estudios radiológicos y visualización de imágenes médicas. Actualmente, el sistema está construido como una Aplicación Web de Página Única (SPA) que simula las interacciones con un servidor DICOM (como Orthanc) y una base de datos.

## 2. Objetivos
- **Actuales**: Servir como una prueba de concepto (PoC) y maqueta visual interactiva que demuestre los flujos de trabajo de un centro de radiología (recepción, técnicos, médicos radiólogos y administradores).
- **A futuro**: Convertirse en una interfaz web completamente funcional que se conecte a un servidor DICOM real para recibir, almacenar y visualizar las imágenes provenientes de equipos médicos.

---

## 3. Arquitectura del Sistema

El proyecto sigue una arquitectura Cliente-Servidor unificada en un solo repositorio, utilizando TypeScript en ambos extremos.

### Frontend (`src/`)
- **Tecnologías**: React 19, Vite, Tailwind CSS, Lucide React (para iconos).
- **Estructura**:
  - `src/App.tsx`: Orquestador principal. Maneja el estado global de la aplicación (pacientes, estudios, etc.) y la navegación por "pestañas" (`activeTab`).
  - `src/components/`: Contiene la interfaz dividida por dominios (dashboard, patients, studies, orthanc, viewer, audit, config).
  - `src/services/pacsApi.ts`: Capa de servicios que encapsula las llamadas HTTP (fetch) hacia el backend.

### Backend (`server/`)
- **Tecnologías**: Node.js, Express.
- **Estructura**:
  - `server.ts`: Archivo principal que levanta el servidor Express. Define todas las rutas de la API REST (`/api/*`) y sirve la aplicación de React.
  - `server/store.ts`: Una clase `PacsStore` que actúa como la base de datos y la lógica de negocio. Mantiene el estado en memoria.
  - `server/mockData.ts`: Datos semilla falsos (usuarios, pacientes, estudios) para inicializar el sistema y permitir su uso inmediato sin configuraciones extras.

---

## 4. Interacciones y APIs

Actualmente, el sistema interactúa de la siguiente manera:

1. **Cliente Web** $\rightarrow$ **Backend Express**: El frontend hace peticiones REST a los endpoints definidos en `server.ts` (ej. `GET /api/studies`, `POST /api/patients`).
2. **Backend Express** $\rightarrow$ **PacsStore**: El servidor no consulta una base de datos real, sino que lee y muta los arreglos en memoria de la clase `PacsStore`.
3. **Backend Express** $\rightarrow$ **Orthanc (Simulado)**: Los endpoints `/api/orthanc/*` simulan la comunicación con un servidor PACS real (Orthanc), devolviendo datos estáticos.

---

## 5. Funcionalidades Disponibles (Mock)

- **Dashboard**: Estadísticas de almacenamiento, conteo de estudios por modalidad y estado.
- **Gestión de Pacientes**: CRUD (Crear, Leer, Actualizar, Eliminar de forma lógica) de pacientes.
- **Gestión de Estudios**: Listado, filtrado y cambio de estado de estudios DICOM (Ej: "No Leído" $\rightarrow$ "Interpretado").
- **Visor de Imágenes (Viewer)**: Simulación de integración con OHIF Viewer (actualmente es un modal simulado).
- **Sincronización DICOM**: Botón para "sincronizar" manualmente con el servidor Orthanc.
- **Auditoría**: Registro en memoria de las acciones de los usuarios (login, creación de pacientes, cambio de configuraciones).
- **Configuración PACS**: Gestión de AETitles (Application Entity Title) y puertos, necesarios para la red DICOM.

---

## 6. Integración con el Equipo Mindray DigiEye 330

El **DigiEye 330** es un equipo de radiografía digital. En el mundo de las imágenes médicas, estos equipos se comunican mediante el protocolo **DICOM**.

Para que este sistema funcione con el DigiEye 330, el flujo real debe ser el siguiente:

1. El DigiEye 330 realiza la captura de los rayos X.
2. El técnico envía el estudio desde la consola del DigiEye a través de la red local.
3. El envío se hace mediante una petición **DICOM C-STORE**.
4. **¿A dónde se envía?** A un servidor PACS real (como **Orthanc**, dcm4chee, o Conquest).
5. Nuestro backend de Node.js escuchará los eventos de Orthanc, actualizará nuestra base de datos y mostrará el estudio en el frontend de React.

### Configuración de Red DICOM requerida:
Para que los equipos "hablen", deben conocer 3 parámetros el uno del otro:
- **IP Address** (Dirección IP en la red local)
- **Port** (Puerto DICOM, por defecto suele ser 104, 4242 u 8042)
- **AETitle** (Application Entity Title, el "Nombre" en la red DICOM)

*Ejemplo:* En el DigiEye 330 se debe configurar que existe un "Destino PACS" con la IP de tu servidor, el puerto (ej. 4242) y el AETitle de tu Orthanc (ej. `ORTHANC`).

---

## 7. ¿Qué le hace falta para ser 100% funcional?

Lo que tienes ahora es el "cascarón visual". Para llevarlo a producción necesitas:

1. **Servidor DICOM Real**: Instalar e integrar [Orthanc Server](https://www.orthanc-server.com/). Express no puede recibir imágenes del DigiEye directamente; Orthanc recibe las imágenes y Express consulta a Orthanc a través de su API REST.
2. **Base de Datos Persistente**: Reemplazar `server/store.ts` (que borra todo al reiniciar) por una base de datos real como PostgreSQL o MongoDB usando un ORM como Prisma o TypeORM.
3. **Visor DICOM Real**: Integrar un visor real basado en web. La opción líder en código abierto es [OHIF Viewer](https://ohif.org/) o utilizar bibliotecas como [Cornerstone.js](https://cornerstonejs.org/) para renderizar los `.dcm` en el navegador.
4. **Seguridad y Autenticación**: Implementar un sistema real de usuarios, contraseñas encriptadas y JSON Web Tokens (JWT). Actualmente el login es un selector falso.

---

## 8. Recomendaciones y Conclusiones

### Conclusión
El trabajo actual es un excelente punto de partida. Permite a los usuarios (médicos y recepcionistas) entender cómo fluirá el trabajo, validar la experiencia de usuario (UX) y diseñar los requerimientos antes de invertir tiempo en la compleja integración de redes DICOM.

### Próximos Pasos Recomendados:
1. **Desplegar un contenedor Docker de Orthanc** en la máquina local para pruebas.
2. **Conectar Express con la API REST de Orthanc** (`http://localhost:8042/studies`) para que el frontend liste estudios reales subidos al servidor.
3. **Configurar el DigiEye 330** en un entorno de pruebas apuntando a tu máquina local (puerto 4242 de Orthanc).
4. **Integrar Cornerstone.js** en el modal de visor (Viewer Modal) para poder dibujar la radiografía que llega del equipo de Rayos X.

---

## 9. Configuración DICOM del Mindray DigiEye 330

### Diagrama de Red

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│  Mindray DigiEye    │  DICOM  │   Servidor PACS     │  REST   │   Mini PACS Web     │
│  330 Series         │ C-STORE │   (Orthanc)         │  API    │   (Express + React) │
│                     │────────▶│                     │◀────────│                     │
│  IP: 192.168.1.105  │         │  IP: 192.168.1.10   │         │  IP: 192.168.1.10   │
│  AET: MINDRAY_DROC  │         │  AET: ORTHANC_PACS  │         │  Puerto: 3000       │
│  Puerto: 104        │         │  Puerto DICOM: 4242 │         │                     │
│                     │         │  Puerto HTTP: 8042  │         │                     │
└─────────────────────┘         └─────────────────────┘         └─────────────────────┘
```

### Parámetros de Configuración en la Consola DROC

En la consola del DigiEye 330, se debe configurar el destino PACS con los siguientes parámetros:

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| **AETitle Destino** | `ORTHANC_PACS` | Nombre del servidor PACS en la red DICOM |
| **IP Destino** | `192.168.1.10` | Dirección IP del servidor donde corre Orthanc |
| **Puerto DICOM** | `4242` | Puerto DICOM de Orthanc (por defecto) |

### Pasos para Configurar el DigiEye 330

1. **Acceder a la consola DROC** del equipo Mindray DigiEye 330
2. **Navegar a Configuración de Red** → Configuración DICOM
3. **Agregar Nuevo Destino PACS**:
   - Nombre: `Servidor PACS Local`
   - AETitle: `ORTHANC_PACS`
   - IP: `192.168.1.10` (o la IP de tu servidor)
   - Puerto: `4242`
4. **Probar Conexión** usando C-ECHO para verificar conectividad
5. **Guardar Configuración**

### Flujo de Trabajo Real

1. El técnico realiza la captura de Rayos X en el DigiEye 330
2. En la consola DROC, selecciona el estudio y elige "Enviar a PACS"
3. El equipo envía el estudio mediante **DICOM C-STORE** al servidor Orthanc
4. Orthanc recibe, almacena e indexa el estudio automáticamente
5. El Mini PACS Web detecta el nuevo estudio (sync manual o automático)
6. El radiólogo abre el estudio en el visor OHIF/Cornerstone.js
7. El radiólogo escribe el informe y cambia el estado a "Informado"

### Verificación de Conectividad (C-ECHO)

Para verificar que el DigiEye puede comunicarse con Orthanc, se puede usar el endpoint REST de Orthanc:

```bash
# Desde el servidor, verificar que Orthanc está escuchando
curl http://localhost:8042/system

# Verificar modalidades configuradas
curl http://localhost:8042/modalities?expand
```

### Troubleshooting

| Problema | Solución |
|----------|----------|
| C-ECHO falla | Verificar que el firewall permite el puerto 4242 |
| AETitle no reconocido | Verificar que `ORTHANC_PACS` coincide exactamente (mayúsculas) |
| Timeout de conexión | Verificar que ambos equipos están en la misma red/subred |
| Estudio no aparece en PACS Web | Ejecutar sincronización manual desde el botón "Sync DICOM" |

---

## 10. Configuración de Orthanc Personalizada

### Principios SOLID Aplicados

La configuración de Orthanc sigue los principios SOLID para garantizar mantenibilidad y escalabilidad:

| Principio | Aplicación |
|-----------|------------|
| **Single Responsibility** | Cada archivo tiene una responsabilidad única: `orthanc.json` (configuración DICOM), `orthanc-webhook.lua` (notificaciones), `.env` (variables de entorno) |
| **Open/Closed** | La configuración es extensible vía variables de entorno sin modificar el código fuente |
| **Dependency Inversion** | El backend depende de abstracciones (variables de entorno) no de implementaciones concretas (hardcoded values) |
| **Interface Segregation** | Configuraciones separadas por concern: DICOM, HTTP, autenticación, webhooks |

### Archivos de Configuración

#### 1. `orthanc.json` - Configuración Principal del Servidor DICOM

```json
{
  "DicomAet": "ORTHANC_PACS",
  "DicomPort": 4242,
  "HttpPort": 8042,
  "RegisteredUsers": {
    "orthanc": "pacs_secure_2026"
  },
  "DicomModalities": {
    "mindray_digieye": {
      "AET": "MINDRAY_DROC",
      "Host": "192.168.1.105",
      "Port": 104
    }
  }
}
```

**Propósito:**
- Define el AETitle del servidor PACS en la red DICOM
- Configura autenticación HTTP para la API REST
- Declara modalidades conocidas (DigiEye 330, Workstations)
- Establece políticas de almacenamiento y seguridad

#### 2. `orthanc-webhook.lua` - Script Lua para Detección Automática

```lua
function OnStoredInstance(instanceId, tags, metadata, origin)
  -- Notifica al backend cuando llega un nuevo estudio vía C-STORE
  HttpPost(BACKEND_WEBHOOK_URL, jsonPayload, headers)
end
```

**Propósito:**
- Detecta automáticamente cuando el DigiEye 330 envía un estudio
- Envía webhook HTTP POST al backend (`/api/orthanc/webhook`)
- Elimina la necesidad de sincronización manual
- Solo notifica en la primera instancia de cada estudio (evita duplicados)

#### 3. Variables de Entorno (`.env`)

```bash
ORTHANC_URL=http://localhost:8042
ORTHANC_USER=orthanc
ORTHANC_PASS=pacs_secure_2026
WEBHOOK_SECRET=pacs-webhook-secret-2026
```

**Propósito:**
- Inyección de configuración sin hardcoding
- Permite diferentes configuraciones por entorno (dev/staging/prod)
- Separa secretos del código fuente

### Flujo de Detección Automática de Estudios

```
┌─────────────────┐
│  DigiEye 330    │
│  (C-STORE)      │
└────────┬────────┘
         │ DICOM
         ▼
┌─────────────────┐
│    Orthanc      │
│  (Puerto 4242)  │
└────────┬────────┘
         │ Lua Script
         │ OnStoredInstance()
         ▼
┌─────────────────┐
│  Webhook POST   │
│  /api/orthanc/  │
│    webhook      │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│  Express App    │
│  (Audit Log)    │
└─────────────────┘
```

### Seguridad Implementada

| Capa | Mecanismo | Propósito |
|------|-----------|-----------|
| **HTTP Auth** | Basic Auth (`orthanc:pacs_secure_2026`) | Protege API REST de Orthanc |
| **Webhook Secret** | Header `X-Webhook-Secret` | Valida que el webhook viene de Orthanc |
| **DicomCheckModalityHost** | Configurado en `orthanc.json` | Solo acepta C-STORE de modalidades conocidas |
| **Variables de Entorno** | `.env` file | Secretos fuera del código fuente |

### Despliegue con Docker

```yaml
orthanc:
  image: jodogne/orthanc-plugins:latest
  volumes:
    - ./orthanc.json:/etc/orthanc/orthanc.json:ro
    - ./orthanc-webhook.lua:/etc/orthanc/orthanc-webhook.lua:ro
  environment:
    - BACKEND_WEBHOOK_URL=http://app:3000/api/orthanc/webhook
    - BACKEND_WEBHOOK_SECRET=pacs-webhook-secret-2026
```

### Verificación de Configuración

```bash
# Verificar que Orthanc está corriendo con la configuración personalizada
curl -u orthanc:pacs_secure_2026 http://localhost:8042/system

# Verificar modalidades configuradas
curl -u orthanc:pacs_secure_2026 http://localhost:8042/modalities?expand

# Verificar que el script Lua está cargado
curl -u orthanc:pacs_secure_2026 http://localhost:8042/lua/execute -d 'print("Lua OK")'
```

### Troubleshooting

| Problema | Solución |
|----------|----------|
| Webhook no se dispara | Verificar que `LuaScripts` está configurado en `orthanc.json` |
| Error de autenticación | Verificar que `ORTHANC_USER` y `ORTHANC_PASS` coinciden con `RegisteredUsers` |
| Modalidad no reconocida | Agregar el AETitle del equipo en `DicomModalities` de `orthanc.json` |
| Webhook falla con 401 | Verificar que `WEBHOOK_SECRET` coincide en Orthanc y Express |

---

## 11. Estado Actual del Desarrollo

### Funcionalidades Implementadas

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| **Base de Datos** | ✅ Completo | PostgreSQL + Prisma ORM con 8 modelos |
| **Autenticación** | ✅ Completo | JWT + bcrypt, login con email/password |
| **Integración Orthanc** | ✅ Completo | REST API client, sync de estudios, proxy DICOM |
| **Dockerización** | ✅ Completo | docker-compose con PostgreSQL + Orthanc + App |
| **Visor DICOM** | ✅ Completo | Cornerstone.js v5 con herramientas profesionales |
| **CRUD Pacientes** | ✅ Completo | Crear, editar, eliminar (lógico) |
| **Gestión Estudios** | ✅ Completo | Listar, filtrar, cambiar estado |
| **Auditoría** | ✅ Completo | Log de acciones en BD |
| **Configuración PACS** | ✅ Completo | AETitles, puertos, parámetros |
| **Gestión Usuarios** | ✅ Completo | CRUD completo con roles RBAC |

### Próximas Funcionalidades (Roadmap)

1. **Informe Radiológico** - Editor de diagnósticos con exportación PDF
2. **Upload DICOM desde navegador** - Drag-and-drop de archivos .dcm
3. **Detección automática de estudios** - Webhook/polling a `/changes` de Orthanc
4. **Notificaciones en tiempo real** - WebSocket para alertas de nuevos estudios
5. **Exportación de estudios** - ZIP con DICOM + PDF del informe
