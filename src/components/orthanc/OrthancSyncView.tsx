import React, { useState } from 'react';
import {
  Server,
  RefreshCw,
  HardDrive,
  Tv,
  CheckCircle,
  Activity,
  Send,
  Sliders,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { OrthancStatus, PACSConfig } from '../../types/pacs';

interface OrthancSyncViewProps {
  status: OrthancStatus;
  config: PACSConfig;
  isSyncing?: boolean;
  onSyncNow: () => void;
  onReceiveSimulatedStudy: (studyData: any) => void;
}

export const OrthancSyncView: React.FC<OrthancSyncViewProps> = ({
  status,
  config,
  isSyncing = false,
  onSyncNow,
  onReceiveSimulatedStudy,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedLog, setSimulatedLog] = useState<string[]>([]);

  const handleSimulateCStore = () => {
    setIsSimulating(true);
    setSimulatedLog(prev => [
      ...prev,
      `[C-STORE RECEPTION] Iniciando comunicación DICOM AET: ${config.remoteAETitle} -> ${config.localAETitle}`,
      `[C-STORE RECEPTION] Transfiriendo SOP Instance 1.2.840.113619.2.55.3.2831172839.999 (Mindray DigiEye 330)...`,
    ]);

    setTimeout(() => {
      setSimulatedLog(prev => [
        ...prev,
        `[ORTHANC PACS] Estudio procesado e indexado en almacenamiento de Orthanc.`,
        `[REST API NOTIFY] Notificación Webhook enviada a Mini PACS Server NestJS/Express.`,
      ]);

      const newSimulatedStudy = {
        accessionNumber: `ACC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        patientDocument: `109${Math.floor(100000 + Math.random() * 900000)}`,
        patientName: 'García Lorca, Federico',
        studyDescription: 'Rx Tórax Frente y Perfil',
        modality: 'DX',
        bodyPart: 'CHEST',
      };

      onReceiveSimulatedStudy(newSimulatedStudy);
      setIsSimulating(false);
    }, 1500);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Servidor DICOM Orthanc v{status.version}
            </h2>
            <p className="text-xs text-slate-500">
              Integración nativa mediante REST API y receptor C-STORE para equipos Mindray DigiEye 330 Series
            </p>
          </div>
        </div>

        <button
          onClick={onSyncNow}
          disabled={isSyncing}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-md text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sincronizando...' : 'Ejecutar Sincronización Manual'}
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>AETitle Servidor Local</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700">{status.aetitle}</div>
          <div className="text-[11px] text-slate-500">Puerto DICOM: {status.dicomPort} | HTTP REST: {status.httpPort}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Almacenamiento DICOM</span>
            <HardDrive className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{status.storageUsageMb.toFixed(1)} MB</div>
          <div className="text-[11px] text-slate-500">Indexados: {status.studyCount} Estudios ({status.instanceCount} Instancias)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Última Sincronización</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-sm font-bold font-mono text-emerald-600">
            {new Date(status.lastSyncTime).toLocaleTimeString()}
          </div>
          <div className="text-[11px] text-slate-500">Sincronización automática cada {config.autoSyncIntervalSec}s</div>
        </div>
      </div>

      {/* Equipment Connections & Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equipment DICOM C-STORE Peers */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Tv className="w-4 h-4 text-blue-600" />
            Modalidades Conectadas (DICOM C-STORE Peers)
          </h3>

          <div className="space-y-3">
            {status.connectedEquipment.map((eq, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 text-xs">{eq.name}</div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    {eq.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-600">
                  <div>AET: <span className="text-blue-700 font-bold">{eq.aetitle}</span></div>
                  <div>IP: <span className="text-slate-800">{eq.ip}</span></div>
                  <div>Puerto: <span className="text-slate-800">{eq.port}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Test Simulator: Receive C-STORE from Mindray DigiEye 330 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Simulador C-STORE DigiEye 330
            </h3>
            <button
              onClick={handleSimulateCStore}
              disabled={isSimulating}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Simular Envío de Estudio Rx
            </button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Esta herramienta simula la llegada automática de un estudio DICOM desde la consola Mindray DROC hacia el servidor Orthanc.
          </p>

          <div className="h-40 bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-emerald-400 overflow-y-auto space-y-1">
            {simulatedLog.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
            {simulatedLog.length === 0 && (
              <div className="text-slate-500 italic">Esperando eventos C-STORE...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
