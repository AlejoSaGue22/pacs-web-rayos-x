import React, { useRef, useEffect, useState, useCallback } from 'react';
import dicomParser from 'dicom-parser';

interface CornerstoneViewportProps {
  instanceId: string;
  className?: string;
}

type LoadState = 'loading' | 'loaded' | 'error';

export const CornerstoneViewport: React.FC<CornerstoneViewportProps> = ({
  instanceId,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const viewportRef = useRef({
    windowCenter: 2048,
    windowWidth: 4096,
    zoom: 1.0,
    panX: 0,
    panY: 0,
    rows: 512,
    columns: 512,
    bitsStored: 16,
    isMonochrome1: false,
    pixelData: null as Uint16Array | null,
    rescaleSlope: 1.0,
    rescaleIntercept: 0.0,
  });

  const interactionRef = useRef({
    isDragging: false,
    dragButton: -1,
    dragStartX: 0,
    dragStartY: 0,
    dragStartWc: 0,
    dragStartWw: 0,
    dragStartPanX: 0,
    dragStartPanY: 0,
  });

  const animationRef = useRef<number>(0);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const vp = viewportRef.current;
    if (!canvas || !vp.pixelData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { rows, columns, windowCenter, windowWidth, zoom, panX, panY, isMonochrome1 } = vp;

    canvas.width = columns;
    canvas.height = rows;

    const imageData = ctx.createImageData(columns, rows);
    const dest = imageData.data;

    const wl = windowCenter;
    const ww = Math.max(windowWidth, 1);
    const wlMin = wl - ww / 2;
    const wlMax = wl + ww / 2;
    const range = wlMax - wlMin;

    const shift = 16 - vp.bitsStored;
    const maxVal = (1 << vp.bitsStored) - 1;

    for (let i = 0; i < rows * columns; i++) {
      const raw = vp.pixelData[i];
      let val = raw;
      if (shift > 0) {
        val = val >> shift;
      }
      val = Math.min(val, maxVal);

      let mapped = ((val - wlMin) / range) * 255;
      mapped = Math.max(0, Math.min(255, mapped));

      if (isMonochrome1) {
        mapped = 255 - mapped;
      }

      const di = i * 4;
      dest[di] = mapped;
      dest[di + 1] = mapped;
      dest[di + 2] = mapped;
      dest[di + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);

    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    canvas.style.transformOrigin = 'center center';
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }, []);

  useEffect(() => {
    if (loadState !== 'loaded') return;
    renderCanvas();
  }, [loadState, renderCanvas]);

  useEffect(() => {
    let cancelled = false;

    async function loadDicom() {
      setLoadState('loading');
      setErrorMessage('');

      try {
        const resp = await fetch(`/api/orthanc/dicom/${instanceId}`);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        const buffer = await resp.arrayBuffer();
        if (cancelled) return;

        const byteArray = new Uint8Array(buffer);
        const dataSet = dicomParser.parseDicom(byteArray);

        const rows = dataSet.uint16('x00280010') || 512;
        const columns = dataSet.uint16('x00280011') || 512;
        const bitsStored = dataSet.uint16('x00280101') || 16;
        const pixelRepresentation = dataSet.uint16('x00280103') || 0;
        const photometric = dataSet.string('x00280004') || '';
        const isMonochrome1 = photometric.trim().toUpperCase() === 'MONOCHROME1';

        let windowCenter = 2048;
        let windowWidth = 4096;
        const wcStr = dataSet.string('x00281050');
        const wwStr = dataSet.string('x00281051');
        if (wcStr) {
          const parts = wcStr.split('\\');
          windowCenter = parseFloat(parts[0]) || 2048;
        }
        if (wwStr) {
          const parts = wwStr.split('\\');
          windowWidth = parseFloat(parts[0]) || 4096;
        }

        const rescaleSlope = dataSet.floatString('x00281053') || 1.0;
        const rescaleIntercept = dataSet.floatString('x00281052') || 0.0;

        const pixelDataElement = dataSet.elements.x7fe00010;
        if (!pixelDataElement) {
          throw new Error('No pixel data element found in DICOM');
        }

        const pixelDataLength = pixelDataElement.length;
        const numPixels = rows * columns;
        let pixelData: Uint16Array;

        if (bitsStored <= 8) {
          const src = new Uint8Array(
            dataSet.byteArray.buffer,
            pixelDataElement.dataOffset,
            pixelDataLength
          );
          pixelData = new Uint16Array(numPixels);
          for (let i = 0; i < numPixels; i++) {
            pixelData[i] = src[i];
          }
        } else {
          pixelData = new Uint16Array(
            dataSet.byteArray.buffer,
            pixelDataElement.dataOffset,
            Math.min(pixelDataLength / 2, numPixels)
          );
        }

        if (cancelled) return;

        viewportRef.current = {
          ...viewportRef.current,
          rows,
          columns,
          bitsStored,
          isMonochrome1,
          pixelData,
          windowCenter,
          windowWidth,
          rescaleSlope,
          rescaleIntercept,
          zoom: 1.0,
          panX: 0,
          panY: 0,
        };

        setLoadState('loaded');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Unknown error loading DICOM';
        setErrorMessage(msg);
        setLoadState('error');
      }
    }

    loadDicom();
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();

    interactionRef.current = {
      isDragging: true,
      dragButton: e.button,
      dragStartX: e.clientX - rect.left,
      dragStartY: e.clientY - rect.top,
      dragStartWc: viewportRef.current.windowCenter,
      dragStartWw: viewportRef.current.windowWidth,
      dragStartPanX: viewportRef.current.panX,
      dragStartPanY: viewportRef.current.panY,
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const inter = interactionRef.current;
    if (!inter.isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dx = e.clientX - rect.left - inter.dragStartX;
    const dy = e.clientY - rect.top - inter.dragStartY;
    const vp = viewportRef.current;

    if (inter.dragButton === 0) {
      const newWc = inter.dragStartWc + Math.round(dy * 4);
      const newWw = Math.max(1, inter.dragStartWw + Math.round(dx * 8));
      vp.windowCenter = newWc;
      vp.windowWidth = newWw;
      renderCanvas();
    } else if (inter.dragButton === 1) {
      vp.panX = inter.dragStartPanX + dx;
      vp.panY = inter.dragStartPanY + dy;
      renderCanvas();
    }
  }, [renderCanvas]);

  const handleMouseUp = useCallback(() => {
    interactionRef.current.isDragging = false;
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!canvasRef.current) return;
    e.preventDefault();

    const vp = viewportRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(10, vp.zoom * factor));
    vp.zoom = newZoom;
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleWheel]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (loadState === 'loaded') {
        renderCanvas();
      }
    });
    const container = containerRef.current;
    if (container) {
      ro.observe(container);
    }
    return () => ro.disconnect();
  }, [loadState, renderCanvas]);

  const wc = viewportRef.current.windowCenter;
  const ww = viewportRef.current.windowWidth;
  const zoom = viewportRef.current.zoom;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {loadState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-slate-400 text-sm font-mono animate-pulse">
            Cargando DICOM...
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-rose-400 text-sm font-mono text-center px-4">
            Error: {errorMessage}
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          display: loadState === 'loaded' ? 'block' : 'none',
          imageRendering: 'pixelated',
        }}
      />

      {loadState === 'loaded' && (
        <div
          className="absolute bottom-3 left-4 text-emerald-400 font-mono text-xs leading-relaxed pointer-events-none bg-black/40 p-2 rounded border border-emerald-500/20 z-10"
        >
          <div>WW: <span className="text-amber-300 font-semibold">{ww}</span></div>
          <div>WC: <span className="text-amber-300 font-semibold">{wc}</span></div>
          <div>Zoom: <span className="text-cyan-300">{(zoom * 100).toFixed(0)}%</span></div>
        </div>
      )}
    </div>
  );
};
