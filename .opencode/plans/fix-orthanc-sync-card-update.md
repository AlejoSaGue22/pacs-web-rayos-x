# Plan: Fix Card "Ultima Sincronizacion" + Eliminar Simulador C-STORE

## Resumen
El card "Ultima Sincronizacion" en el modulo Orthanc Server no se actualiza visualmente despues de ejecutar una sincronizacion manual exitosa. Adicionalmente, se elimina el Simulador C-STORE por no tener funcionalidad real.

## Causa Raiz

### Problema 1: Response del sync se descarta
`App.tsx:125` — `handleSyncOrthanc` ignora el `timestamp` que retorna `syncOrthanc()` y confia en que `loadData()` (5 peticiones en paralelo) traera el dato actualizado.

### Problema 2: `loadData()` con `Promise.all` es fragil
`App.tsx:52` — Si una sola de las 5 peticiones falla, TODAS las actualizaciones se descartan y el catch hace logout automatico.

### Problema 3: Sin feedback visual
No hay animacion ni highlight que indique al usuario que el card se actualizo.

## Archivos a Modificar (4 archivos)

### 1. `src/types/pacs.ts`
**Cambio:** Agregar interfaz `SyncResult` al final del archivo.
```ts
export interface SyncResult {
  success: boolean;
  timestamp: string;
  syncedStudies: number;
  newStudies: number;
}
```

### 2. `src/services/pacsApi.ts`
**Cambio:** Importar `SyncResult` y tipar el retorno de `syncOrthanc()`.
- Import: agregar `SyncResult` al import existente
- Metodo `syncOrthanc()`: cambiar retorno a `Promise<SyncResult>`

### 3. `src/App.tsx`
**Cambio A — `handleSyncOrthanc` (lineas 121-134):**
- Capturar response de `syncOrthanc()` en variable `result`
- Actualizacion optimista: `setOrthancStatus(prev => prev ? { ...prev, lastSyncTime: result.timestamp, online: result.success } : prev)`
- Toast con datos reales: `Sincronizacion completada: ${result.newStudies} estudios nuevos importados (${result.syncedStudies} totales en BD)`

**Cambio B — `loadData` (lineas 49-72):**
- Reemplazar `Promise.all` con llamadas independientes envueltas en try/catch individuales
- Cada setter se ejecuta solo si su peticion tuvo exito
- El catch global solo se activa si falla la autenticacion (401)
- No hacer logout automatico en errores de carga de datos

**Cambio C — Eliminar prop `onReceiveSimulatedStudy`:**
- En la renderizacion de `OrthancSyncView` (linea 227), remover la prop `onReceiveSimulatedStudy={() => loadData()}`

### 4. `src/components/orthanc/OrthancSyncView.tsx`
**Cambio A — Eliminar Simulador C-STORE:**
- Remover estados: `isSimulating`, `simulatedLog`
- Remover funcion: `handleSimulateCStore`
- Remover de la interfaz: `onReceiveSimulatedStudy`
- Remover del JSX: todo el bloque del simulador (card con terminal falsa, boton, texto descriptivo)
- El layout cambia de `grid-cols-2` a un solo card de modalidades que ocupa todo el ancho

**Cambio B — Animacion flash en card "Ultima Sincronizacion":**
- Agregar estado `justUpdated` con `useState(false)`
- Agregar `useEffect` que detecte cambios en `status.lastSyncTime` y active el flash por 1.5s
- Aplicar clase condicional al card: borde verde + shadow verde sutil durante el flash
- Agregar import de `useEffect` si no existe

## Resultado Esperado
1. Card "Ultima Sincronizacion" se actualiza instantaneamente al hacer sync (no espera a loadData)
2. Toast muestra resultados cuantitativos reales del sync
3. loadData es resiliente: una peticion fallida no rompe las demas
4. Simulador C-STORE eliminado completamente
5. Flash visual confirma al usuario que el card se actualizo
