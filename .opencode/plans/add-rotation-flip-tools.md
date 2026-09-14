# Plan: Agregar Herramientas de Rotación y Flip al Visor DICOM

## Objetivo
Agregar botones de rotación (90°, 180°, 270°) y flip (horizontal/vertical) al visor OHIF Viewer para completar el conjunto de herramientas de manipulación de imágenes.

## Estado Actual
- ✅ El visor tiene: WW/WL, Pan, Zoom, Length, Angle, ROI, StackScroll, Cine, Invertir, Reset, Presets
- ❌ Faltan: Rotación (90°, 180°, 270°) y Flip (horizontal/vertical)
- ✅ Cornerstone v5.6.13 soporta rotación y flip via `viewport.setProperties()`

## Archivos a Modificar

### 1. `src/components/viewer/cornerstoneInit.ts`
**Agregar dos nuevas funciones exportadas:**

```typescript
export function rotateViewport(viewportId: string, degrees: number) {
  if (!renderingEngine) return;
  const viewport = renderingEngine.getViewport(viewportId);
  if (!viewport) return;

  const stackViewport = viewport as cornerstone.Types.IStackViewport;
  if (stackViewport.setProperties) {
    stackViewport.setProperties({ rotation: degrees });
    stackViewport.render();
  }
}

export function flipViewport(viewportId: string, horizontal: boolean, vertical: boolean) {
  if (!renderingEngine) return;
  const viewport = renderingEngine.getViewport(viewportId);
  if (!viewport) return;

  const stackViewport = viewport as cornerstone.Types.IStackViewport;
  if (stackViewport.setProperties) {
    stackViewport.setProperties({ 
      flipHorizontal: horizontal,
      flipVertical: vertical 
    });
    stackViewport.render();
  }
}
```

### 2. `src/components/viewer/OhifViewerModal.tsx`

**A. Agregar imports de las nuevas funciones:**
```typescript
import {
  setToolActive,
  applyWindowLevelPreset,
  resetViewport,
  invertViewport,
  rotateViewport,
  flipViewport,
  TOOL_NAMES,
} from './cornerstoneInit';
```

**B. Agregar estado para trackear rotación y flip:**
```typescript
const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
const [flipH, setFlipH] = useState(false);
const [flipV, setFlipV] = useState(false);
```

**C. Agregar handlers para rotación y flip:**
```typescript
const handleRotate = (degrees: number) => {
  const newRotation = (rotation + degrees) % 360;
  setRotation(newRotation);
  rotateViewport(primaryViewportId, newRotation);
};

const handleFlipHorizontal = () => {
  const newFlipH = !flipH;
  setFlipH(newFlipH);
  flipViewport(primaryViewportId, newFlipH, flipV);
};

const handleFlipVertical = () => {
  const newFlipV = !flipV;
  setFlipV(newFlipV);
  flipViewport(primaryViewportId, flipH, newFlipV);
};
```

**D. Actualizar `handleResetViewport` para resetear rotación y flip:**
```typescript
const handleResetViewport = () => {
  resetViewport(primaryViewportId);
  setInvert(false);
  setRotation(0);
  setFlipH(false);
  setFlipV(false);
  rotateViewport(primaryViewportId, 0);
  flipViewport(primaryViewportId, false, false);
};
```

**E. Agregar botones en la sección "Transforms & Cine" (después del botón Reset):**
```tsx
<div className="w-px h-5 bg-slate-800 mx-1" />

{/* Rotation Controls */}
<button
  onClick={() => handleRotate(90)}
  title="Rotar 90°"
  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
>
  <RotateCw className="w-4 h-4" />
</button>

<button
  onClick={handleFlipHorizontal}
  title="Reflejo Horizontal"
  className={`p-1.5 rounded border ${
    flipH ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'
  }`}
>
  <FlipHorizontal className="w-4 h-4" />
</button>

<button
  onClick={handleFlipVertical}
  title="Reflejo Vertical"
  className={`p-1.5 rounded border ${
    flipV ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'
  }`}
>
  <FlipVertical className="w-4 h-4" />
</button>
```

**F. Agregar imports de iconos necesarios:**
```typescript
import {
  // ... existing imports ...
  RotateCw,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';
```

## Comportamiento Esperado

### Botón Rotar (RotateCw)
- Cada clic rota la imagen 90° en sentido horario
- 4 clics = 360° (vuelve al estado original)
- El botón se mantiene en estado normal (no toggle)

### Botón Flip Horizontal (FlipHorizontal)
- Toggle: primer clic activa flip horizontal, segundo clic lo desactiva
- Visual feedback: botón se ilumina en cyan cuando está activo

### Botón Flip Vertical (FlipVertical)
- Toggle: primer clic activa flip vertical, segundo clic lo desactiva
- Visual feedback: botón se ilumina en cyan cuando está activo

### Botón Reset (RefreshCw)
- Resetea TODO: zoom, pan, windowing, rotación, flip, inversión
- La imagen vuelve a su estado original

## Testing Manual

1. **Abrir un estudio DICOM** que tenga imágenes reales en Orthanc
2. **Probar rotación:**
   - Clic en "Rotar 90°" → imagen rota 90°
   - 4 clics → imagen vuelve a orientación original
3. **Probar flip horizontal:**
   - Clic en "Flip H" → imagen se refleja horizontalmente
   - Clic nuevamente → vuelve a normal
4. **Probar flip vertical:**
   - Clic en "Flip V" → imagen se refleja verticalmente
   - Clic nuevamente → vuelve a normal
5. **Probar combinaciones:**
   - Rotar 90° + Flip H → verifica que ambas transformaciones se apliquen
6. **Probar reset:**
   - Aplicar varias transformaciones
   - Clic en "Reset" → verifica que todo vuelva al estado original

## Notas Técnicas

- **Cornerstone v5.6.13** soporta `rotation`, `flipHorizontal`, y `flipVertical` en `setProperties()`
- Las transformaciones se aplican al viewport, no a la imagen en sí
- El estado de rotación/flip se mantiene mientras el viewport esté activo
- Al cambiar de instancia (cine o navegación), el nuevo viewport hereda las transformaciones del viewport anterior (comportamiento estándar)

## Dependencias
- @cornerstonejs/core v5.6.13 (ya instalado)
- lucide-react (iconos RotateCw, FlipHorizontal, FlipVertical ya disponibles)
