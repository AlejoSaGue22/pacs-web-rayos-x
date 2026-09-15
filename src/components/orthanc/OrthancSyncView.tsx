import React, { useState, useEffect } from 'react';
import {
  Server,
  RefreshCw,
  HardDrive,
  Tv,
  CheckCircle,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { OrthancStatus, PACSConfig } from '../../types/pacs';

interface OrthancSyncViewProps {
  status: OrthancStatus;
  config: PACSConfig;
  isSyncing?: boolean;
  onSyncNow: () => void;
}

export const OrthancSyncView: React.FC<OrthancSyncViewProps> = ({
  status,
  config,
  isSyncing = false,
  onSyncNow,
}) => {
  const [justUpdated, setJustUpdated] = useState(false);
  const [localStats, setLocalStats] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/storage/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setLocalStats(data);
        }
      } catch (err) {
        console.error('Error fetching local stats', err);
      }
    };
    fetchStats();
    // Refetch when lastSyncTime changes
  }, [status.lastSyncTime]);

  useEffect(() => {
    if (status.lastSyncTime) {
      setJustUpdated(true);
      const timer = setTimeout(() => setJustUpdated(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [status.lastSyncTime]);

  const EQUIPMENT_STATUS_STYLES: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    IDLE: 'bg-amber-100 text-amber-700',
    OFFLINE: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="space-y-5">
      {/* Configuration Status Alert */}
      {!config.isConfigured && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-3 shadow-xs">
          <div className="p-1.5 bg-amber-500 text-white rounded-md shrink-0 mt-0.5">
            <Server className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold">Aviso de Configuración DICOM</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                Sin Validar
              </span>
            </div>
            <p className="text-amber-800">
              La configuración del PACS no ha sido completada. El estado de conexión y las modalidades DICOM <strong>no se mostrarán</strong> hasta existir una configuración válida. Complete los datos de red del equipo de Rayos X en la pestaña de <strong>Configuración</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Servidor DICOM Orthanc
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${status.online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {status.online ? `v${status.version || 'N/D'} — en línea` : 'No alcanzable'}
              </span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>AETitle Servidor Local</span>
            {status.online ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700">{status.aetitle || '—'}</div>
          <div className="text-[11px] text-slate-500">Puerto DICOM: {status.dicomPort || '—'} | HTTP REST: {status.httpPort || '—'}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Almacenamiento DICOM</span>
            <HardDrive className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{status.storageUsageMb.toFixed(1)} MB</div>
          <div className="text-[11px] text-slate-500">Indexados: {status.studyCount} Estudios ({status.instanceCount} Instancias)</div>
        </div>

        <div className={`bg-white border rounded-xl p-4 shadow-xs space-y-1 transition-all duration-300 ${
          justUpdated 
            ? 'border-emerald-500 shadow-emerald-200 shadow-md' 
            : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Última Sincronización</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-sm font-bold font-mono text-emerald-600">
            {status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString() : 'Nunca sincronizado'}
          </div>
          <div className="text-[11px] text-slate-500">
            {config.autoSyncIntervalSec > 0 ? `Sincronización automática cada ${config.autoSyncIntervalSec}s` : 'Sincronización automática no configurada'}
          </div>
        </div>

        {/* Nueva Tarjeta: Respaldo Local (Disco) */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Respaldo en Disco</span>
            <HardDrive className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {localStats ? `${localStats.totalSizeMb} MB` : '—'}
          </div>
          <div className="text-[11px] text-slate-500">
            {localStats ? `Locales: ${localStats.totalStudies} Estudios (${localStats.totalPatients} Pacientes)` : '...'}
          </div>
        </div>
      </div>

      {/* Equipment Connections */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Tv className="w-4 h-4 text-blue-600" />
          Modalidades Conectadas (DICOM C-STORE Peers)
        </h3>

        {!config.isConfigured ? (
          <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Configuración del PACS no validada. Las modalidades no pueden verificarse hasta completar la configuración del servidor.</span>
          </div>
        ) : !status.online ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Servidor Orthanc no alcanzable. No es posible verificar las modalidades conectadas en este momento.</span>
          </div>
        ) : status.connectedEquipment.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <span>El servidor Orthanc responde, pero no tiene modalidades DICOM registradas.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {status.connectedEquipment.map((eq, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 text-xs">{eq.name}</div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${EQUIPMENT_STATUS_STYLES[eq.status] || 'bg-slate-200 text-slate-600'}`}>
                    {eq.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-slate-600">
                  <div>AET: <span className="text-blue-700 font-bold">{eq.aetitle || '—'}</span></div>
                  <div>IP: <span className="text-slate-800">{eq.ip || '—'}</span></div>
                  <div>Puerto: <span className="text-slate-800">{eq.port || '—'}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
