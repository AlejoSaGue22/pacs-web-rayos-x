# Plan: Eliminar Datos Ficticios y Establecer Flujo de Producción Real

## Objetivo
Eliminar todos los estudios ficticios del seed y establecer un flujo donde:
1. La BD solo contiene estudios reales importados desde Orthanc
2. El visor puede cargar las imágenes DICOM correctamente
3. El sistema funciona en producción sin datos de demostración

## Problema Actual
- `prisma/seed.ts` crea 6 estudios con IDs inventados (ej: `orthanc-inst-001-1-1`)
- Estos IDs no existen en Orthanc (Orthanc usa hashes SHA-1)
- El endpoint proxy `/api/orthanc/dicom/:instanceId` falla con 404
- El visor no puede mostrar imágenes

## Solución: 3 Fases

### Fase 1: Eliminar Datos Ficticios del Seed
**Archivo:** `prisma/seed.ts`

**Cambios:**
1. Eliminar creación de pacientes ficticios (líneas 30-37)
2. Eliminar creación de estudios ficticios (líneas 39-205)
3. Eliminar creación de audit logs ficticios (líneas 207-213)
4. **Mantener:**
   - Creación de usuarios demo (4 roles con password `pacs2026`)
   - Creación de configuración inicial de PacsConfig
   - Creación de OrthancStatus inicial

**Resultado:** BD limpia, sin estudios ni pacientes ficticios.

### Fase 2: Crear Script de Setup Inicial con DICOMs Reales
**Nuevo archivo:** `scripts/setup-real-dicoms.ts`

**Funcionalidad:**
1. Descargar 3-5 estudios DICOM reales desde Saga IT (o fuente local)
2. Subirlos a Orthanc vía REST API (`POST /instances`)
3. Ejecutar sincronización manual (`syncWithOrthanc()`)
4. Verificar que los estudios aparezcan en la BD con IDs reales de Orthanc

**Flujo:**
```bash
# 1. Limpiar BD y crear estructura
npm run seed

# 2. Descargar y subir DICOMs reales a Orthanc
tsx scripts/setup-real-dicoms.ts

# 3. Sincronizar desde el frontend (botón "Ejecutar Sincronización Manual")
# O ejecutar vía API:
curl -X POST http://localhost:3000/api/orthanc/sync \
  -H "Authorization: Bearer <token>"
```

**Ejemplo de script:**
```typescript
import { fetch } from 'node-fetch';
import fs from 'fs';
import path from 'path';

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://localhost:8042';
const AUTH = Buffer.from('orthanc:orthanc').toString('base64');

async function uploadDicomFile(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const res = await fetch(`${ORTHANC_URL}/instances`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${AUTH}`,
      'Content-Type': 'application/dicom',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

async function main() {
  const dicomDir = './dicom-samples'; // Directorio con archivos .dcm
  
  const files = fs.readdirSync(dicomDir).filter(f => f.endsWith('.dcm'));
  
  console.log(`Subiendo ${files.length} archivos DICOM a Orthanc...`);
  
  for (const file of files) {
    const result = await uploadDicomFile(path.join(dicomDir, file));
    console.log(`✓ ${file} → ID: ${result.ID}`);
  }
  
  console.log('\nDICOMs subidos. Ejecuta sincronización desde el frontend.');
}

main();
```

### Fase 3: Arreglar Proxy DICOM para Buscar por SOPInstanceUID
**Archivo:** `server.ts` (endpoint `/api/orthanc/dicom/:instanceId`)

**Cambio:** Modificar el endpoint para aceptar `instanceId` (ID de Orthanc) O `sopInstanceUid` (UID estándar DICOM).

**Lógica nueva:**
```typescript
app.get('/api/orthanc/dicom/:identifier', async (req, res) => {
  const { identifier } = req.params;
  
  // 1. Buscar en BD por ID de Orthanc o por SOPInstanceUID
  let instance = await prisma.instance.findUnique({
    where: { id: identifier }
  });
  
  if (!instance) {
    // Buscar por SOPInstanceUID
    instance = await prisma.instance.findFirst({
      where: { sopInstanceUid: identifier }
    });
  }
  
  if (!instance) {
    return res.status(404).json({ error: 'Instancia no encontrada en BD' });
  }
  
  // 2. Buscar en Orthanc por ID (que ahora es real)
  const orthancId = instance.id;
  const orthancUrl = process.env.ORTHANC_URL || 'http://localhost:8042';
  const token = Buffer.from(`${process.env.ORTHANC_USER}:${process.env.ORTHANC_PASS}`).toString('base64');
  
  const response = await fetch(`${orthancUrl}/instances/${orthancId}/file`, {
    headers: { Authorization: `Basic ${token}` },
  });
  
  if (!response.ok) {
    return res.status(404).json({ error: 'Archivo DICOM no encontrado en Orthanc' });
  }
  
  // 3. Enviar archivo al cliente
  const arrayBuffer = await response.arrayBuffer();
  res.set({
    'Content-Type': 'application/dicom',
    'Content-Length': arrayBuffer.byteLength.toString(),
  });
  res.send(Buffer.from(arrayBuffer));
});
```

**Ventaja:** Si el ID de Orthanc cambia (por ejemplo, al re-sincronizar), el visor puede seguir funcionando usando el SOPInstanceUID que es inmutable.

## Archivos a Modificar

1. **`prisma/seed.ts`**
   - Eliminar líneas 30-213 (pacientes, estudios, audit logs ficticios)
   - Mantener usuarios demo, configuración inicial, estado inicial de Orthanc

2. **`scripts/setup-real-dicoms.ts`** (nuevo)
   - Script para descargar/subir DICOMs reales a Orthanc
   - Documentación de fuentes de DICOMs públicos

3. **`server.ts`**
   - Modificar endpoint `/api/orthanc/dicom/:identifier`
   - Buscar por ID de Orthanc O por SOPInstanceUID
   - Mejor manejo de errores

4. **`src/components/viewer/CornerstoneViewport.tsx`** (opcional)
   - Actualizar para pasar SOPInstanceUID en lugar de ID si es necesario
   - Actual: `const imageId = `wadouri:/api/orthanc/dicom/${instanceId}`;`
   - Podría ser: `const imageId = `wadouri:/api/orthanc/dicom/${instance.sopInstanceUid}`;`

## Flujo de Trabajo en Producción

### Setup Inicial (una sola vez)
```bash
# 1. Migrar BD
npx prisma migrate deploy

# 2. Crear usuarios demo y configuración inicial
npm run seed

# 3. Subir DICOMs reales a Orthanc (manual o vía script)
tsx scripts/setup-real-dicoms.ts

# 4. Iniciar servidor
npm run dev
```

### Operación Diaria
1. El equipo de Rayos X envía estudios DICOM a Orthanc vía C-STORE
2. El usuario hace clic en "Ejecutar Sincronización Manual"
3. El sistema importa estudios reales desde Orthanc a la BD
4. El visor muestra las imágenes correctamente usando IDs reales

## Recursos DICOM Recomendados

### Para Desarrollo/Testing
- **Saga IT**: https://saga-it.com/dicom/samples
  - 28 estudios curados
  - Descarga directa (.dcm y .zip)
  - Licencia CC-BY (uso comercial con atribución)
  - Modalidades: CT, MR, DX (Rayos X), Mamografía, PET, US

### Para Producción
- Estudios reales del equipo Mindray DigiEye 330
- Sincronización automática cada N segundos
- Sincronización manual bajo demanda

## Testing del Plan

1. **Verificar seed limpio:**
   ```bash
   npm run seed
   # Debe crear solo usuarios, config y estado inicial
   # NO debe crear pacientes ni estudios
   ```

2. **Subir DICOMs reales:**
   ```bash
   tsx scripts/setup-real-dicoms.ts
   # Debe subir 3-5 estudios a Orthanc
   ```

3. **Sincronizar:**
   - Abrir frontend
   - Ir a módulo Orthanc Server
   - Clic en "Ejecutar Sincronización Manual"
   - Verificar que aparezcan estudios en la BD

4. **Probar visor:**
   - Abrir un estudio desde la lista
   - Verificar que el visor cargue la imagen
   - Probar herramientas: WW/WL, Pan, Zoom, Rotación, Flip

## Notas Importantes

- **Licencia:** Los DICOMs de Saga IT son CC-BY, requiere atribución en producción
- **Privacidad:** Todos los DICOMs públicos están anonimizados (sin datos reales de pacientes)
- **Volumen:** Para producción real, los estudios vendrán del equipo de Rayos X, no de descargas públicas
- **Backup:** Considerar backup de la BD de Orthanc antes de ejecutar scripts de limpieza

## Alternativa: Sin Script de Setup

Si prefieres no usar el script `setup-real-dicoms.ts`, puedes:

1. Descargar DICOMs manualmente desde Saga IT
2. Subirlos a Orthanc vía interfaz web de Orthanc (http://localhost:8042)
3. Sincronizar desde el frontend

El resultado es el mismo: estudios reales en la BD con IDs válidos.
