import React, { useRef, useEffect, useState } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { initCornerstone, getRenderingEngine, getToolGroup } from './cornerstoneInit';

interface CornerstoneViewportProps {
  instanceId: string;
  viewportId: string;
  className?: string;
}

type LoadState = 'loading' | 'loaded' | 'error';

export const CornerstoneViewport: React.FC<CornerstoneViewportProps> = ({
  instanceId,
  viewportId,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    initCornerstone();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderingEngine = getRenderingEngine();
    const toolGroup = getToolGroup();
    if (!renderingEngine || !toolGroup) return;

    let cancelled = false;

    async function loadAndRender() {
      setLoadState('loading');
      setErrorMessage('');

      try {
        const imageId = `wadouri:/api/orthanc/dicom/${instanceId}`;

        const viewportInput: cornerstone.Types.PublicViewportInput = {
          viewportId,
          type: cornerstone.Enums.ViewportType.STACK,
          element: container!,
          defaultOptions: {
            background: [0, 0, 0] as [number, number, number],
          },
        };

        renderingEngine.enableElement(viewportInput);
        toolGroup.addViewport(viewportId, renderingEngine.id);

        const viewport = renderingEngine.getViewport(viewportId) as cornerstone.Types.IStackViewport;
        if (!viewport) throw new Error('Viewport not created');

        await viewport.setStack([imageId]);

        if (cancelled) return;

        viewport.render();
        setLoadState('loaded');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Error loading DICOM';
        setErrorMessage(msg);
        setLoadState('error');

        try {
          renderingEngine.disableElement(viewportId);
        } catch {
          // ignore cleanup errors
        }
      }
    }

    loadAndRender();

    return () => {
      cancelled = true;
      try {
        renderingEngine.disableElement(viewportId);
      } catch {
        // ignore cleanup errors
      }
    };
  }, [instanceId, viewportId]);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />

      {loadState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-slate-400 text-sm font-mono animate-pulse">
            Cargando DICOM...
          </div>
        </div>
      )}

      {loadState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-rose-400 text-sm font-mono text-center px-4">
            Error: {errorMessage}
          </div>
        </div>
      )}
    </div>
  );
};
