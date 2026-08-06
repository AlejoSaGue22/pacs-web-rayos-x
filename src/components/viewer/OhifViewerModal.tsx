import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Sun,
  Move,
  ZoomIn,
  Ruler,
  Compass,
  Square,
  Play,
  Pause,
  RefreshCw,
  Camera,
  FileText,
  Columns,
  Grid2x2,
  Square as SquareIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DicomStudy, DicomSeries, DicomInstance } from '../../types/pacs';
import { DicomCanvasRenderer } from './DicomCanvasRenderer';
import { CornerstoneViewport } from './CornerstoneViewport';
import {
  setToolActive,
  applyWindowLevelPreset,
  resetViewport,
  invertViewport,
  TOOL_NAMES,
} from './cornerstoneInit';

interface OhifViewerModalProps {
  study: DicomStudy;
  onClose: () => void;
}

type ToolType = 'windowing' | 'pan' | 'zoom' | 'length' | 'angle' | 'roi';

const TOOL_MAP: Record<ToolType, string> = {
  windowing: TOOL_NAMES.WindowLevel,
  pan: TOOL_NAMES.Pan,
  zoom: TOOL_NAMES.Zoom,
  length: TOOL_NAMES.Length,
  angle: TOOL_NAMES.Angle,
  roi: TOOL_NAMES.RectangleROI,
};

export const OhifViewerModal: React.FC<OhifViewerModalProps> = ({ study, onClose }) => {
  const [activeSeriesIndex, setActiveSeriesIndex] = useState(0);
  const [activeInstanceIndex, setActiveInstanceIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState<'1x1' | '1x2' | '2x2'>('1x1');

  const [invert, setInvert] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('windowing');
  const [isPlayingCine, setIsPlayingCine] = useState(false);
  const [showTagsDrawer, setShowTagsDrawer] = useState(false);

  const currentSeries: DicomSeries | undefined = study.series[activeSeriesIndex];
  const currentInstance: DicomInstance | undefined = currentSeries?.instances[activeInstanceIndex];

  const primaryViewportId = `viewport-primary-${study.id}`;

  useEffect(() => {
    setToolActive(TOOL_MAP[activeTool]);
  }, [activeTool]);

  useEffect(() => {
    invertViewport(primaryViewportId, invert);
  }, [invert, primaryViewportId]);

  useEffect(() => {
    if (!isPlayingCine || !currentSeries) return;
    const interval = setInterval(() => {
      setActiveInstanceIndex(prev => (prev + 1) % currentSeries.instances.length);
    }, 600);
    return () => clearInterval(interval);
  }, [isPlayingCine, currentSeries]);

  const applyPreset = (wc: number, ww: number) => {
    applyWindowLevelPreset(primaryViewportId, wc, ww);
  };

  const handleResetViewport = () => {
    resetViewport(primaryViewportId);
    setInvert(false);
  };

  const handleCaptureSnapshot = () => {
    alert(`Capas y mediciones capturadas. Guardadas en la bitácora del estudio ACC: ${study.accessionNumber}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-slate-100 flex flex-col select-none overflow-hidden font-sans">
      {/* OHIF Top Header Bar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            OHIF Viewer v3.8 - Mindray DigiEye 330 PACS
          </div>
          <div className="text-sm font-semibold text-slate-200">
            {study.patientName} <span className="text-slate-500">({study.patientDocument})</span>
          </div>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
            {study.studyDescription}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTagsDrawer(!showTagsDrawer)}
            className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showTagsDrawer ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Tags DICOM
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* OHIF Toolbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto text-xs z-10">
        {/* Interactive Tools */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTool('windowing')}
            title="Ajuste de Contraste / Ventana (WW/WL)"
            className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 font-medium transition-all ${
              activeTool === 'windowing' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-4 h-4" />
            WW/WL
          </button>
          <button
            onClick={() => setActiveTool('pan')}
            title="Desplazar Imagen (Pan)"
            className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 font-medium transition-all ${
              activeTool === 'pan' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Move className="w-4 h-4" />
            Mover
          </button>
          <button
            onClick={() => setActiveTool('zoom')}
            title="Zoom Dinámico"
            className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 font-medium transition-all ${
              activeTool === 'zoom' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ZoomIn className="w-4 h-4" />
            Zoom
          </button>
          <div className="w-px h-5 bg-slate-800 mx-1" />
          <button
            onClick={() => setActiveTool('length')}
            title="Medir Distancia Lineal (mm)"
            className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 font-medium transition-all ${
              activeTool === 'length' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Ruler className="w-4 h-4" />
            Regla
          </button>
          <button
            onClick={() => setActiveTool('angle')}
            title="Medir Ángulo (°)"
            className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 font-medium transition-all ${
              activeTool === 'angle' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            Ángulo
          </button>
          <button
            onClick={() => setActiveTool('roi')}
            title="Medir Densidad ROI (HU)"
            className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 font-medium transition-all ${
              activeTool === 'roi' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Square className="w-4 h-4" />
            ROI
          </button>
        </div>

        {/* Windowing Presets */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mr-1">Presets:</span>
          <button
            onClick={() => applyPreset(2100, 3800)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 font-mono text-[11px]"
          >
            Hueso
          </button>
          <button
            onClick={() => applyPreset(2048, 4096)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 font-mono text-[11px]"
          >
            Tórax
          </button>
          <button
            onClick={() => applyPreset(400, 1500)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 font-mono text-[11px]"
          >
            Tejidos
          </button>
          <button
            onClick={() => setInvert(!invert)}
            className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
              invert ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            Invertir
          </button>
        </div>

        {/* Transforms & Cine */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleResetViewport}
            title="Restablecer Vista"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-800 mx-1" />

          <button
            onClick={() => setIsPlayingCine(!isPlayingCine)}
            className={`px-2.5 py-1.5 rounded flex items-center gap-1 font-semibold ${
              isPlayingCine ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isPlayingCine ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            Cine
          </button>

          <button
            onClick={handleCaptureSnapshot}
            title="Guardar Captura de Imagen Clave"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded border border-slate-700"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Grid Layout */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setLayoutMode('1x1')}
            className={`p-1 rounded ${layoutMode === '1x1' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
          >
            <SquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayoutMode('1x2')}
            className={`p-1 rounded ${layoutMode === '1x2' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
          >
            <Columns className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayoutMode('2x2')}
            className={`p-1 rounded ${layoutMode === '2x2' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
          >
            <Grid2x2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main OHIF Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Series Carousel Drawer */}
        <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col p-3 overflow-y-auto space-y-3 shrink-0">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Series ({study.series.length})</span>
            <span className="text-cyan-400 font-mono text-[10px]">{study.modality}</span>
          </div>

          {study.series.map((s, idx) => (
            <div
              key={s.id}
              onClick={() => {
                setActiveSeriesIndex(idx);
                setActiveInstanceIndex(0);
              }}
              className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                idx === activeSeriesIndex
                  ? 'bg-cyan-950/60 border-cyan-500/80 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-200">
                  Serie {s.seriesNumber}: {s.seriesDescription}
                </span>
                <span className="text-[10px] bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded font-mono">
                  {s.bodyPartExamined}
                </span>
              </div>

              <div className="w-full h-28 bg-black rounded border border-slate-800 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                <DicomCanvasRenderer
                  bodyPart={s.bodyPartExamined}
                  viewPosition={s.instances[0]?.viewPosition || 'AP'}
                  windowCenter={s.instances[0]?.windowCenter || 2048}
                  windowWidth={s.instances[0]?.windowWidth || 4096}
                  invert={false}
                  rotation={0}
                  flipH={false}
                  flipV={false}
                  zoom={0.4}
                  pan={{ x: 0, y: 0 }}
                  activeTool="none"
                  measurements={[]}
                  isThumbnail={true}
                />
                <div className="absolute bottom-1 right-2 z-20 text-[10px] text-amber-400 font-mono font-bold">
                  {s.numberOfInstances} Img
                </div>
              </div>
            </div>
          ))}

          {currentSeries && currentSeries.instances.length > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-400 mb-2">
                Instancia Actual ({activeInstanceIndex + 1} de {currentSeries.instances.length})
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setActiveInstanceIndex(i => Math.max(0, i - 1))}
                  disabled={activeInstanceIndex === 0}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-xs flex items-center justify-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <button
                  onClick={() => setActiveInstanceIndex(i => Math.min(currentSeries.instances.length - 1, i + 1))}
                  disabled={activeInstanceIndex === currentSeries.instances.length - 1}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-xs flex items-center justify-center gap-1"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center Viewport Grid */}
        <div className="flex-1 bg-black p-2 relative flex items-center justify-center overflow-hidden">
          {layoutMode === '1x1' && currentSeries && currentInstance && (
            <div className="w-full h-full rounded-lg border border-slate-800 overflow-hidden relative">
              <CornerstoneViewport
                instanceId={currentInstance.id}
                viewportId={primaryViewportId}
                className="w-full h-full"
              />
            </div>
          )}

          {layoutMode === '1x2' && (
            <div className="w-full h-full grid grid-cols-2 gap-2">
              {study.series.slice(0, 2).map((s, idx) => {
                const inst = s.instances[0];
                return (
                  <div key={s.id} className="w-full h-full rounded-lg border border-slate-800 overflow-hidden relative">
                    {inst ? (
                      <CornerstoneViewport
                        instanceId={inst.id}
                        viewportId={`viewport-1x2-${idx}-${study.id}`}
                        className="w-full h-full"
                      />
                    ) : (
                      <DicomCanvasRenderer
                        bodyPart={s.bodyPartExamined}
                        viewPosition="AP"
                        windowCenter={2048} windowWidth={4096}
                        invert={false} rotation={0} flipH={false} flipV={false}
                        zoom={1} pan={{ x: 0, y: 0 }} activeTool="none"
                        measurements={[]}
                        patientName={study.patientName}
                        patientId={study.patientDocument}
                        seriesDescription={s.seriesDescription}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {layoutMode === '2x2' && (
            <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2">
              {[0, 1, 2, 3].map(idx => {
                const s = study.series[idx % study.series.length];
                const inst = s?.instances[0];
                return (
                  <div key={idx} className="w-full h-full rounded-lg border border-slate-800 overflow-hidden relative">
                    {inst ? (
                      <CornerstoneViewport
                        instanceId={inst.id}
                        viewportId={`viewport-2x2-${idx}-${study.id}`}
                        className="w-full h-full"
                      />
                    ) : (
                      <DicomCanvasRenderer
                        bodyPart={s?.bodyPartExamined || 'CHEST'}
                        viewPosition="AP"
                        windowCenter={2048} windowWidth={4096}
                        invert={false} rotation={0} flipH={false} flipV={false}
                        zoom={1} pan={{ x: 0, y: 0 }} activeTool="none"
                        measurements={[]}
                        patientName={study.patientName}
                        patientId={study.patientDocument}
                        seriesDescription={s?.seriesDescription || 'Proyección Radiográfica'}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Drawer: DICOM Header Tags Inspector */}
        {showTagsDrawer && currentInstance && (
          <div className="w-96 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto z-30 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Cabecera Metadatos DICOM
              </h3>
              <button
                onClick={() => setShowTagsDrawer(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 mb-3 text-xs space-y-1">
              <div className="text-slate-400">Equipo: <span className="text-white font-semibold">{study.manufacturer} {study.manufacturerModelName}</span></div>
              <div className="text-slate-400">UID Instancia: <span className="text-cyan-400 font-mono text-[10px] break-all">{currentInstance.sopInstanceUid}</span></div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Etiquetas DICOM (3.0 Standard)
              </div>
              <div className="border border-slate-800 rounded divide-y divide-slate-800 text-xs font-mono">
                {currentInstance.tags.map((t, idx) => (
                  <div key={idx} className="p-2 hover:bg-slate-800/50 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-cyan-400 font-bold">{t.tag}</span>
                      <span className="text-amber-400 text-[10px] bg-slate-950 px-1 rounded">{t.vr}</span>
                    </div>
                    <div className="text-slate-300 font-sans font-semibold">{t.name}</div>
                    <div className="text-emerald-400 text-[11px] truncate">{String(t.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
