import React, { useRef, useEffect, useState } from 'react';

export interface MeasurementItem {
  id: string;
  type: 'length' | 'angle' | 'roi' | 'none' | 'windowing' | 'pan' | 'zoom';
  points: { x: number; y: number }[];
  value: string;
}

interface DicomCanvasRendererProps {
  bodyPart: string;
  viewPosition?: string;
  windowCenter: number;
  windowWidth: number;
  invert: boolean;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  zoom: number;
  pan: { x: number; y: number };
  activeTool: 'windowing' | 'pan' | 'zoom' | 'length' | 'angle' | 'roi' | 'none';
  patientName?: string;
  patientId?: string;
  kvp?: number;
  mAs?: number;
  seriesDescription?: string;
  measurements: MeasurementItem[];
  onAddMeasurement?: (m: MeasurementItem) => void;
  onWindowChange?: (wc: number, ww: number) => void;
  onPanChange?: (pan: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number) => void;
  isThumbnail?: boolean;
}

export const DicomCanvasRenderer: React.FC<DicomCanvasRendererProps> = ({
  bodyPart,
  viewPosition = 'AP',
  windowCenter,
  windowWidth,
  invert,
  rotation,
  flipH,
  flipV,
  zoom,
  pan,
  activeTool,
  patientName = 'ANONYMOUS',
  patientId = '000000',
  kvp = 120,
  mAs = 3.0,
  seriesDescription = 'Proyección Radiográfica',
  measurements,
  onAddMeasurement,
  onWindowChange,
  onPanChange,
  onZoomChange,
  isThumbnail = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isInteracting, setIsInteracting] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawingPoints, setCurrentDrawingPoints] = useState<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -zoom : zoom, flipV ? -zoom : zoom);
    ctx.translate(-width / 2, -height / 2);

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');

    if (offCtx) {
      offCtx.fillStyle = '#0a0a0c';
      offCtx.fillRect(0, 0, width, height);

      renderAnatomy(offCtx, width, height, bodyPart.toUpperCase(), viewPosition);

      const imgData = offCtx.getImageData(0, 0, width, height);
      const pixels = imgData.data;

      const wl = windowCenter;
      const ww = Math.max(windowWidth, 10);
      const minI = wl - ww / 2;
      const contrast = 255 / ww;

      for (let i = 0; i < pixels.length; i += 4) {
        let rawDensity = pixels[i];
        let val = (rawDensity * 16 - minI) * contrast;
        if (val < 0) val = 0;
        if (val > 255) val = 255;

        if (invert) val = 255 - val;

        pixels[i] = val;
        pixels[i + 1] = val;
        pixels[i + 2] = val;
      }

      offCtx.putImageData(imgData, 0, 0);
      ctx.drawImage(offscreen, 0, 0);
    }

    renderMeasurements(ctx, measurements, currentDrawingPoints);

    ctx.restore();
  }, [bodyPart, viewPosition, windowCenter, windowWidth, invert, rotation, flipH, flipV, zoom, pan, measurements, currentDrawingPoints]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsInteracting(true);
    setDragStart({ x: e.clientX, y: e.clientY });

    if (['length', 'angle', 'roi'].includes(activeTool)) {
      const imgX = (x - canvas.width / 2 - pan.x) / zoom + canvas.width / 2;
      const imgY = (y - canvas.height / 2 - pan.y) / zoom + canvas.height / 2;
      setCurrentDrawingPoints([{ x: imgX, y: imgY }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isInteracting || !dragStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    if (activeTool === 'windowing') {
      const newWc = windowCenter + Math.round(dy * 4);
      const newWw = Math.max(10, windowWidth + Math.round(dx * 8));
      if (onWindowChange) onWindowChange(newWc, newWw);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeTool === 'pan') {
      if (onPanChange) onPanChange({ x: pan.x + dx, y: pan.y + dy });
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeTool === 'zoom') {
      const factor = dy < 0 ? 1.03 : 0.97;
      const newZoom = Math.min(Math.max(0.2, zoom * factor), 5.0);
      if (onZoomChange) onZoomChange(newZoom);
      setDragStart({ x: e.clientX, y: e.clientY });
    } else if (['length', 'angle', 'roi'].includes(activeTool)) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const imgX = (x - canvas.width / 2 - pan.x) / zoom + canvas.width / 2;
      const imgY = (y - canvas.height / 2 - pan.y) / zoom + canvas.height / 2;

      if (currentDrawingPoints.length > 0) {
        if (activeTool === 'length' || activeTool === 'roi') {
          setCurrentDrawingPoints([currentDrawingPoints[0], { x: imgX, y: imgY }]);
        } else if (activeTool === 'angle') {
          if (currentDrawingPoints.length === 1) {
            setCurrentDrawingPoints([currentDrawingPoints[0], { x: imgX, y: imgY }]);
          } else {
            setCurrentDrawingPoints([currentDrawingPoints[0], currentDrawingPoints[1], { x: imgX, y: imgY }]);
          }
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (!isInteracting) return;
    setIsInteracting(false);
    setDragStart(null);

    if (['length', 'angle', 'roi'].includes(activeTool) && currentDrawingPoints.length >= 2) {
      if (onAddMeasurement) {
        let value = '';
        if (activeTool === 'length') {
          const p1 = currentDrawingPoints[0];
          const p2 = currentDrawingPoints[1];
          const distPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const mm = (distPx * 0.15).toFixed(1);
          value = `${mm} mm`;
        } else if (activeTool === 'angle') {
          const p1 = currentDrawingPoints[0];
          const p2 = currentDrawingPoints[1];
          const p3 = currentDrawingPoints[2] || p2;
          const a1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
          const a2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
          let deg = Math.abs((a1 - a2) * (180 / Math.PI));
          if (deg > 180) deg = 360 - deg;
          value = `${deg.toFixed(1)}°`;
        } else if (activeTool === 'roi') {
          const p1 = currentDrawingPoints[0];
          const p2 = currentDrawingPoints[1];
          const areaMm2 = (Math.abs(p2.x - p1.x) * 0.15 * Math.abs(p2.y - p1.y) * 0.15).toFixed(1);
          value = `Área: ${areaMm2} mm² (Dens: 142.8 HU)`;
        }

        onAddMeasurement({
          id: `m-${Date.now()}`,
          type: activeTool,
          points: currentDrawingPoints,
          value,
        });
      }
    }

    setCurrentDrawingPoints([]);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black select-none overflow-hidden flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={800}
        height={800}
        onMouseDown={isThumbnail ? undefined : handleMouseDown}
        onMouseMove={isThumbnail ? undefined : handleMouseMove}
        onMouseUp={isThumbnail ? undefined : handleMouseUp}
        onMouseLeave={isThumbnail ? undefined : handleMouseUp}
        className={`w-full h-full object-contain ${
          isThumbnail
            ? 'cursor-default'
            : activeTool === 'windowing'
            ? 'cursor-ns-resize'
            : activeTool === 'pan'
            ? 'cursor-grab active:cursor-grabbing'
            : activeTool === 'zoom'
            ? 'cursor-zoom-in'
            : ['length', 'angle', 'roi'].includes(activeTool)
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
      />

      {!isThumbnail && (
        <>
          <div className="absolute top-3 left-4 text-emerald-400 font-mono text-xs leading-relaxed pointer-events-none drop-shadow-md bg-black/40 p-2 rounded border border-emerald-500/20">
            <div className="font-bold text-sm text-emerald-300">{patientName}</div>
            <div>ID: {patientId}</div>
            <div>{seriesDescription} ({viewPosition})</div>
            <div className="text-gray-300 text-[11px]">Mindray DigiEye 330 Series</div>
          </div>

          <div className="absolute top-3 right-4 text-emerald-400 font-mono text-xs leading-relaxed text-right pointer-events-none drop-shadow-md bg-black/40 p-2 rounded border border-emerald-500/20">
            <div>KVP: <span className="text-white font-semibold">{kvp}</span></div>
            <div>mAs: <span className="text-white font-semibold">{mAs}</span></div>
            <div>Zoom: <span className="text-amber-300 font-semibold">{(zoom * 100).toFixed(0)}%</span></div>
            <div>Orient: <span className="text-cyan-300">{rotation}° {flipH ? 'H-Flip' : ''}</span></div>
          </div>

          <div className="absolute bottom-3 left-4 text-emerald-400 font-mono text-xs leading-relaxed pointer-events-none drop-shadow-md bg-black/40 p-2 rounded border border-emerald-500/20">
            <div>WW: <span className="text-amber-300 font-semibold">{windowWidth}</span> | WL: <span className="text-amber-300 font-semibold">{windowCenter}</span></div>
            <div>LUT: <span className={invert ? 'text-rose-400 font-bold' : 'text-emerald-300'}>{invert ? 'INVERTIDO' : 'NORMAL'}</span></div>
          </div>

          <div className="absolute bottom-3 right-4 text-emerald-400 font-mono text-xs text-right pointer-events-none drop-shadow-md bg-black/40 p-2 rounded border border-emerald-500/20">
            <div className="text-sm font-bold text-white">DX (Digital Radiography)</div>
            <div className="text-gray-300 text-[11px]">Escala: 0.15 mm/px</div>
            <div className="mt-1 flex items-center justify-end gap-1">
              <div className="w-12 h-1 bg-emerald-400" />
              <span className="text-[10px] text-emerald-300">8 mm</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function renderAnatomy(ctx: CanvasRenderingContext2D, w: number, h: number, bodyPart: string, viewPosition: string) {
  const cx = w / 2;
  const cy = h / 2;

  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 4;

  if (bodyPart.includes('CHEST') || bodyPart.includes('TÓRAX') || bodyPart.includes('TORAX')) {
    ctx.fillStyle = 'rgba(120, 120, 120, 0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 260, 310, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(20, 20, 25, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx - 110, cy - 20, 95, 200, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 120, cy - 30, 90, 185, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(210, 210, 210, 0.65)';
    ctx.beginPath();
    ctx.ellipse(cx + 30, cy + 50, 95, 80, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(240, 240, 240, 0.8)';
    for (let y = cy - 260; y < cy + 260; y += 22) {
      ctx.fillRect(cx - 14, y, 28, 16);
    }

    ctx.strokeStyle = 'rgba(245, 245, 245, 0.9)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy - 240);
    ctx.bezierCurveTo(cx - 100, cy - 250, cx - 180, cy - 220, cx - 220, cy - 210);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 15, cy - 240);
    ctx.bezierCurveTo(cx + 100, cy - 250, cx + 180, cy - 220, cx + 220, cy - 210);
    ctx.stroke();

    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(230, 230, 230, 0.7)';
    for (let r = 0; r < 9; r++) {
      const ry = cy - 180 + r * 45;
      ctx.beginPath();
      ctx.arc(cx - 110, ry, 110 + r * 6, -Math.PI * 0.4, Math.PI * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 110, ry, 110 + r * 6, Math.PI * 0.55, Math.PI * 1.4);
      ctx.stroke();
    }
  } else if (bodyPart.includes('KNEE') || bodyPart.includes('RODILLA')) {
    ctx.fillStyle = 'rgba(230, 230, 230, 0.85)';
    ctx.fillRect(cx - 35, cy - 350, 70, 220);
    ctx.beginPath();
    ctx.ellipse(cx - 40, cy - 120, 50, 45, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 40, cy - 120, 50, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
    ctx.fillRect(cx - 90, cy - 75, 180, 25);

    ctx.fillStyle = 'rgba(250, 250, 250, 0.9)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 120, 32, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(225, 225, 225, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - 80, cy - 50);
    ctx.lineTo(cx + 80, cy - 50);
    ctx.lineTo(cx + 40, cy + 320);
    ctx.lineTo(cx - 40, cy + 320);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(210, 210, 210, 0.75)';
    ctx.fillRect(cx + 65, cy - 20, 22, 340);
  } else if (bodyPart.includes('HAND') || bodyPart.includes('MANO')) {
    ctx.fillStyle = 'rgba(235, 235, 235, 0.85)';
    ctx.fillRect(cx - 50, cy + 180, 42, 160);
    ctx.fillRect(cx + 10, cy + 180, 35, 160);

    for (let b = 0; b < 8; b++) {
      ctx.beginPath();
      ctx.arc(cx - 40 + (b % 4) * 25, cy + 130 + Math.floor(b / 4) * 22, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let m = 0; m < 5; m++) {
      const mx = cx - 70 + m * 35;
      ctx.fillRect(mx - 8, cy + 10, 16, 100);
      const phalangeCount = m === 0 ? 2 : 3;
      for (let p = 0; p < phalangeCount; p++) {
        const py = cy - 40 - p * 42;
        ctx.fillRect(mx - 6, py - 32, 12, 30);
      }
    }
  } else if (bodyPart.includes('SPINE') || bodyPart.includes('COLUMNA')) {
    ctx.fillStyle = 'rgba(230, 230, 230, 0.85)';
    for (let l = 0; l < 5; l++) {
      const ly = cy - 200 + l * 85;
      ctx.fillRect(cx - 55, ly, 110, 60);
      ctx.fillStyle = 'rgba(30, 30, 30, 0.8)';
      ctx.fillRect(cx - 55, ly + 60, 110, 22);
      ctx.fillStyle = 'rgba(230, 230, 230, 0.85)';
      ctx.beginPath();
      ctx.arc(cx, ly + 30, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (bodyPart.includes('SKULL') || bodyPart.includes('CRÁNEO') || bodyPart.includes('CRANEO')) {
    ctx.fillStyle = 'rgba(220, 220, 220, 0.8)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 30, 180, 220, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(50, 50, 60, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 30, 160, 200, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
    ctx.beginPath();
    ctx.ellipse(cx - 60, cy + 20, 32, 30, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 60, cy + 20, 32, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(210, 210, 210, 0.85)';
    ctx.fillRect(cx - 20, cy + 50, 40, 50);
    ctx.fillRect(cx - 90, cy + 120, 180, 60);
  } else {
    ctx.fillStyle = 'rgba(225, 225, 225, 0.85)';
    ctx.fillRect(cx - 30, cy - 250, 60, 200);
    ctx.fillRect(cx - 30, cy + 50, 60, 200);
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderMeasurements(ctx: CanvasRenderingContext2D, items: MeasurementItem[], activePoints: { x: number; y: number }[]) {
  ctx.strokeStyle = '#38bdf8';
  ctx.fillStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.font = 'bold 13px monospace';

  items.forEach(m => {
    if (m.type === 'length' && m.points.length >= 2) {
      const [p1, p2] = m.points;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
      ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
      ctx.fill();

      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2 - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(mx - 4, my - 12, m.value.length * 9 + 8, 18);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(m.value, mx, my);
    } else if (m.type === 'angle' && m.points.length >= 2) {
      const [p1, p2, p3] = m.points;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      if (p3) ctx.lineTo(p3.x, p3.y);
      ctx.stroke();

      ctx.fillText(m.value, p2.x + 10, p2.y - 10);
    } else if (m.type === 'roi' && m.points.length >= 2) {
      const [p1, p2] = m.points;
      const rx = Math.min(p1.x, p2.x);
      const ry = Math.min(p1.y, p2.y);
      const rw = Math.abs(p2.x - p1.x);
      const rh = Math.abs(p2.y - p1.y);

      ctx.strokeStyle = '#f59e0b';
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(m.value, rx, ry - 6);
    }
  });

  if (activePoints.length >= 1) {
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(activePoints[0].x, activePoints[0].y);
    for (let i = 1; i < activePoints.length; i++) {
      ctx.lineTo(activePoints[i].x, activePoints[i].y);
    }
    ctx.stroke();
  }
}
