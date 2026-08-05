import React, { useState } from 'react';
import { Settings, Save, Server, Tv, ShieldCheck, Check } from 'lucide-react';
import { PACSConfig } from '../../types/pacs';

interface ConfigViewProps {
  config: PACSConfig;
  onSaveConfig: (updated: Partial<PACSConfig>) => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({ config, onSaveConfig }) => {
  const [orthancServerUrl, setOrthancServerUrl] = useState(config.orthancServerUrl);
  const [localAETitle, setLocalAETitle] = useState(config.localAETitle);
  const [remoteAETitle, setRemoteAETitle] = useState(config.remoteAETitle);
  const [remoteIp, setRemoteIp] = useState(config.remoteIp);
  const [remotePort, setRemotePort] = useState(config.remotePort);
  const [autoSyncIntervalSec, setAutoSyncIntervalSec] = useState(config.autoSyncIntervalSec);
  const [retentionDays, setRetentionDays] = useState(config.retentionDays);
  const [institutionName, setInstitutionName] = useState(config.institutionName);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      orthancServerUrl,
      localAETitle,
      remoteAETitle,
      remoteIp,
      remotePort: Number(remotePort),
      autoSyncIntervalSec: Number(autoSyncIntervalSec),
      retentionDays: Number(retentionDays),
      institutionName,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-600" />
          Configuración General del PACS & Parámetros DICOM
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Ajustes de conexión DICOM C-STORE, AETitles y servidor Orthanc
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          Configuración actualizada y sincronizada exitosamente con el motor Orthanc.
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
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">AETitle Local (PACS Receptor)</label>
              <input
                type="text"
                value={localAETitle}
                onChange={e => setLocalAETitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-blue-700 font-bold focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Equipment Mindray DigiEye 330 Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Tv className="w-4 h-4 text-amber-600" />
            Equipo Emisor: Mindray DigiEye 330 Series (DROC)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">AETitle Remoto (Equipo Rx)</label>
              <input
                type="text"
                value={remoteAETitle}
                onChange={e => setRemoteAETitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-amber-700 font-bold focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Dirección IP Equipo</label>
              <input
                type="text"
                value={remoteIp}
                onChange={e => setRemoteIp(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Puerto C-STORE DICOM</label>
              <input
                type="number"
                value={remotePort}
                onChange={e => setRemotePort(Number(e.target.value))}
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
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Frecuencia Sincronización Auto (segundos)</label>
              <input
                type="number"
                value={autoSyncIntervalSec}
                onChange={e => setAutoSyncIntervalSec(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Retención de Estudios (días)</label>
              <input
                type="number"
                value={retentionDays}
                onChange={e => setRetentionDays(Number(e.target.value))}
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
