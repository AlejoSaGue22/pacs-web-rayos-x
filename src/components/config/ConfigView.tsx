import React, { useState, useEffect } from 'react';
import { Settings, Save, Server, Tv, ShieldCheck, Check, AlertCircle, Sparkles } from 'lucide-react';
import { PACSConfig } from '../../types/pacs';

interface ConfigViewProps {
  config: PACSConfig;
  onSaveConfig: (updated: Partial<PACSConfig>) => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ config, onSaveConfig }) => {
  const [orthancServerUrl, setOrthancServerUrl] = useState(config?.orthancServerUrl || '');
  const [localAETitle, setLocalAETitle] = useState(config?.localAETitle || '');
  const [remoteAETitle, setRemoteAETitle] = useState(config?.remoteAETitle || '');
  const [remoteIp, setRemoteIp] = useState(config?.remoteIp || '');
  const [remotePort, setRemotePort] = useState<number | ''>(config?.remotePort || '');
  const [autoSyncIntervalSec, setAutoSyncIntervalSec] = useState<number | ''>(config?.autoSyncIntervalSec || '');
  const [retentionDays, setRetentionDays] = useState<number | ''>(config?.retentionDays || '');
  const [institutionName, setInstitutionName] = useState(config?.institutionName || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setOrthancServerUrl(config.orthancServerUrl || '');
      setLocalAETitle(config.localAETitle || '');
      setRemoteAETitle(config.remoteAETitle || '');
      setRemoteIp(config.remoteIp || '');
      setRemotePort(config.remotePort || '');
      setAutoSyncIntervalSec(config.autoSyncIntervalSec || '');
      setRetentionDays(config.retentionDays || '');
      setInstitutionName(config.institutionName || '');
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orthancServerUrl || !localAETitle || !remoteAETitle || !remoteIp || !remotePort || !institutionName) {
      return;
    }
    onSaveConfig({
      orthancServerUrl,
      localAETitle,
      remoteAETitle,
      remoteIp,
      remotePort: Number(remotePort),
      autoSyncIntervalSec: Number(autoSyncIntervalSec) || 0,
      retentionDays: Number(retentionDays) || 0,
      institutionName,
      isConfigured: true,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const isInitialSetup = !config?.isConfigured;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-600" />
            Configuración General del PACS & Parámetros DICOM
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ajustes de conexión DICOM C-STORE, AETitles y servidor Orthanc
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isInitialSetup ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Configuración Inicial Pendiente
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Configurado y Validado
            </span>
          )}
        </div>
      </div>

      {isInitialSetup && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Valide los parámetros antes de guardar</p>
            <p className="text-amber-800">
              Los campos a continuación deben completarse con los datos reales de red de su equipo de Rayos X. Presione <strong>"Guardar Configuración"</strong> para validar y activar el servidor PACS.
            </p>
          </div>
        </div>
      )}

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs">
          <Check className="w-5 h-5 text-emerald-600" />
          Configuración actualizada y servidor PACS validado exitosamente.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Orthanc Server Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            Servidor Orthanc PACS (REST API & DICOM Listener)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">URL Servidor Orthanc REST API</label>
              <input
                type="text"
                value={orthancServerUrl}
                onChange={e => setOrthancServerUrl(e.target.value)}
                placeholder="http://localhost:8042"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">AETitle Local (PACS Receptor)</label>
              <input
                type="text"
                value={localAETitle}
                onChange={e => setLocalAETitle(e.target.value)}
                placeholder="Nombre AE del servidor receptor"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-blue-700 font-bold focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Equipment Mindray DigiEye 330 Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Tv className="w-4 h-4 text-amber-600" />
            Equipo Emisor DICOM (DROC / Consola de Rayos X)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">AETitle Remoto (Equipo Rx)</label>
              <input
                type="text"
                value={remoteAETitle}
                onChange={e => setRemoteAETitle(e.target.value)}
                placeholder="Nombre AE del equipo emisor"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-amber-700 font-bold focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Dirección IP Equipo</label>
              <input
                type="text"
                value={remoteIp}
                onChange={e => setRemoteIp(e.target.value)}
                placeholder="IP real del equipo de Rayos X"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Puerto C-STORE DICOM</label>
              <input
                type="number"
                value={remotePort}
                onChange={e => setRemotePort(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="104"
                required
                min={1}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* General Institution & Polling Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Parámetros del Sistema y Retención</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nombre de la Institución / Consultorio</label>
              <input
                type="text"
                value={institutionName}
                onChange={e => setInstitutionName(e.target.value)}
                placeholder="Ej: Clínica de Imagenología"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Frecuencia Sincronización Auto (segundos)</label>
              <input
                type="number"
                value={autoSyncIntervalSec}
                onChange={e => setAutoSyncIntervalSec(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="60"
                min={0}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Retención de Estudios (días)</label>
              <input
                type="number"
                value={retentionDays}
                onChange={e => setRetentionDays(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="365"
                min={0}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            Guardar Configuración PACS
          </button>
        </div>
      </form>
    </div>
  );
};
