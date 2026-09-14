Para iniciar la aplicación con todos sus servicios (Base de Datos PostgreSQL, Servidor DICOM Orthanc y la Aplicación Web Full-Stack Express/React), sigue estos pasos:

---

### 📋 Requisitos Previos

1. **Docker Desktop** (en ejecución).
2. **Node.js** (versión 18+ o 20+ recomendada).
3. Archivo [.env](file:///c:/laragon/www/Course_Angular_2025/pacs-web-rayos-x/.env) configurado en la raíz (ya viene configurado con los puertos predeterminados).

---

### 🚀 Paso a Paso para Iniciar

#### 1. Iniciar los Servicios de Infraestructura (Docker)

En una terminal en la raíz del proyecto, levanta los contenedores de **PostgreSQL** y **Orthanc**:

```powershell
docker compose up -d
```

> Esto iniciará:
>
> - **PostgreSQL**: en el puerto `5433` (DB: `pacs_rayos_x`).
> - **Orthanc DICOM Server**: en el puerto `8042` (Web/REST API) y `4242` (puerto DICOM C-STORE para equipos de Rayos X).

---

#### 2. Instalar Dependencias y Preparar la Base de Datos (Solo la primera vez)

Si aún no has instalado las dependencias o sincronizado la base de datos:

```powershell
# 1. Instalar dependencias
npm install

# 2. Generar el cliente de Prisma
npx prisma generate

# 3. Aplicar el esquema a PostgreSQL
npx prisma db push

# 4. (Opcional) Poblar la base de datos con datos de prueba
npx prisma db seed
```

---

#### 3. Iniciar el Servidor de Desarrollo

Ejecuta el comando principal:

```powershell
npm run dev
```

El servidor unificado de Node/Express levantará la API REST y el frontend de React mediante Vite en:
👉 **[http://localhost:3000](http://localhost:3000)**

---

### 🔑 Credenciales de Acceso

#### Usuarios del Mini PACS (Web)

Todos los usuarios semilla tienen la contraseña: **`pacs2026`**

| Rol                      | Correo Electrónico        | Contraseña |
| :----------------------- | :------------------------ | :--------- |
| **Administrador**        | `amorales@rayosx.med.co`  | `pacs2026` |
| **Radiólogo**            | `pgomez@rayosx.med.co`    | `pacs2026` |
| **Técnico**              | `fruiz@rayosx.med.co`     | `pacs2026` |
| **Consulta / Recepción** | `lrestrepo@rayosx.med.co` | `pacs2026` |

#### Servidor DICOM Orthanc

- **URL**: [http://localhost:8042](http://localhost:8042)
- **Usuario**: `orthanc`
- **Contraseña**: `pacs_secure_2026`

---

### 🛑 Comandos Útiles para Detener o Reiniciar

- **Detener la aplicación Node**: Presiona `Ctrl + C` en la terminal donde corre `npm run dev`.
- **Detener los contenedores Docker**:
  ```powershell
  docker compose stop
  ```
- **Ver logs de los servicios**:
  ```powershell
  docker compose logs -f orthanc
  docker compose logs -f postgres
  ```
