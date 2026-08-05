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
