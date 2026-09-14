# Plan: Corregir Script de Descarga DICOM (403 Forbidden)

## Problema
El script `scripts/setup-real-dicoms.ts` recibe **HTTP 403 Forbidden** al intentar descargar DICOMs desde `saga-it.com`. Este sitio bloquea requests programáticos que no incluyen un header `User-Agent` de navegador.

## Causa Raiz
Saga IT (Cloudflare/CDN) aplica protección anti-bot. El script usa `fetch()` nativo de Node.js que envía `User-Agent: node` por defecto, lo cual es bloqueado.

## Solucion: Dos Enfoques Combinados

### Enfoque 1: Agregar User-Agent al script (para Saga IT)
Agregar headers de navegador a la peticion fetch para simular un request desde Chrome.

### Enfoque 2: Agregar fuentes alternativas como fallback (GitHub raw)
Si Saga IT sigue bloqueando, usar archivos DICOM de repositorios GitHub que permiten descarga directa sin restricciones:

| Archivo | Fuente | Modalidad | Tamano |
|---------|--------|-----------|--------|
| `CT_small.dcm` | pydicom/pydicom (GitHub raw) | CT | ~32 KB |
| `MR_small.dcm` | pydicom/pydicom (GitHub raw) | MR | ~8 KB |
| `examples_rgb_color.dcm` | pydicom/pydicom (GitHub raw) | US (color) | ~232 KB |
| `anonymous_ecg.dcm` | OHIF/viewer-testdata (GitHub raw) | ECG | ~4 KB |

URLs directas (raw.githubusercontent.com, sin restricciones):
```
https://raw.githubusercontent.com/pydicom/pydicom/main/src/pydicom/data/test_files/CT_small.dcm
https://raw.githubusercontent.com/pydicom/pydicom/main/src/pydicom/data/test_files/MR_small.dcm
https://raw.githubusercontent.com/pydicom/pydicom/main/src/pydicom/data/test_files/examples_rgb_color.dcm
https://raw.githubusercontent.com/OHIF/viewer-testdata/master/dcm/anonymous_ecg.dcm
```

## Archivos a Modificar

### 1. `scripts/setup-real-dicoms.ts`

**Cambio A - Agregar User-Agent a la funcion `downloadDicom`:**

```typescript
async function downloadDicom(url: string, destPath: string): Promise<void> {
  console.log(`  ↓ Descargando desde ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });
  // ... resto igual
}
```

**Cambio B - Agregar fuentes alternativas (GitHub raw) como fallback:**

```typescript
const GITHUB_DICOMS = [
  {
    name: 'CT Small (pydicom)',
    url: 'https://raw.githubusercontent.com/pydicom/pydicom/main/src/pydicom/data/test_files/CT_small.dcm',
    modality: 'CT',
    description: 'Tomografia computarizada - 128x128 pixeles',
  },
  {
    name: 'MR Small (pydicom)',
    url: 'https://raw.githubusercontent.com/pydicom/pydicom/main/src/pydicom/data/test_files/MR_small.dcm',
    modality: 'MR',
    description: 'Resonancia magnetica - 64x64 pixeles',
  },
  {
    name: 'US RGB Color (pydicom)',
    url: 'https://raw.githubusercontent.com/pydicom/pydicom/main/src/pydicom/data/test_files/examples_rgb_color.dcm',
    modality: 'US',
    description: 'Ultrasonido a color RGB',
  },
  {
    name: 'ECG Waveform (OHIF)',
    url: 'https://raw.githubusercontent.com/OHIF/viewer-testdata/master/dcm/anonymous_ecg.dcm',
    modality: 'ECG',
    description: 'Electrocardiograma de 12 derivaciones',
  },
];
```

**Cambio C - Logica de fallback en `main()`:**

Si ninguna descarga de Saga IT funciona (todas 403), automaticamente intentar con las fuentes de GitHub raw. El script muestra un mensaje claro explicando cual fuente se uso.

## Flujo del Script Actualizado

```
1. Verificar conexion con Orthanc
2. Intentar descargar desde Saga IT (con User-Agent)
   - Si funciona: usar esos archivos
   - Si falla (403): mostrar aviso y cambiar a fuentes GitHub
3. Descargar desde GitHub raw (fallback)
4. Subir archivos a Orthanc
5. Limpiar temporales
6. Mostrar resumen y proximos pasos
```

## Comportamiento Esperado

```
========================================
Setup DICOMs Reales - Mini PACS Web
========================================

1. Verificando conexion con Orthanc...
✓ Orthanc esta corriendo

2. Descargando DICOMs reales desde Saga IT...
   (Licencia CC-BY 4.0, uso comercial permitido con atribucion)

[DX] Chest X-ray COVID-19 (Stony Brook)
  ↓ Descargando...
  ✗ Error: HTTP 403: Forbidden

⚠ Saga IT bloqueo las descargas. Usando fuentes alternativas (GitHub)...

[CT] CT Small (pydicom)
    Tomografia computarizada - 128x128 pixeles
  ↓ Descargando desde GitHub raw...
  ✓ Descargado: 32.5 KB

[MR] MR Small (pydicom)
    Resonancia magnetica - 64x64 pixeles
  ↓ Descargando desde GitHub raw...
  ✓ Descargado: 8.2 KB

3. Subiendo DICOMs a Orthanc...
  ✓ ID en Orthanc: a1b2c3d4-e5f6-7890

========================================
Setup Completado
========================================
✓ 2 estudios DICOM subidos a Orthanc
```

## Nota sobre los Archivos de pydicom

Los archivos `CT_small.dcm` y `MR_small.dcm` son DICOMs reales anonimizados:
- Provienen de NEMA (National Electrical Manufacturers Association)
- Fueron reducidos a 128x128 (CT) y 64x64 (MR) para testing
- Los nombres de pacientes fueron reemplazados
- Son de dominio publico / sin restricciones de uso
- Perfectos para verificar que el visor funciona con datos reales

## Verificacion Post-Implementacion

Despues de ejecutar el script:
1. Verificar en Orthanc (http://localhost:8042) que los estudios aparezcan
2. Ejecutar sincronizacion desde el frontend
3. Abrir un estudio en el visor y confirmar que la imagen se carga
4. Probar herramientas: WW/WL, Pan, Zoom, Rotacion, Flip
