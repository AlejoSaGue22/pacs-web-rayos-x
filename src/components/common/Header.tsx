import React from 'react';
import { User, PACSConfig } from '../../types/pacs';
import {
  Activity,
  Server,
  RefreshCw,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  orthancOnline: boolean;
  isSyncing?: boolean;
  pacsConfig?: PACSConfig | null;
  onSyncOrthanc: () => void;
  onLogout: () => void;
  onQuickSearch?: (query: string) => void;
  quickSearchTerm?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  orthancOnline,
  isSyncing = false,
  pacsConfig,
  onSyncOrthanc,
  onLogout,
}) => {
  const institutionName = pacsConfig?.institutionName || 'Mini PACS - Rayos X';
  const equipmentAET = pacsConfig?.remoteAETitle || 'ORTHANC_PACS';
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-30 sticky top-0 shadow-xs shrink-0 font-sans">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-2">
              MiniPACS <span className="text-blue-700 bg-blue-50 text-[10px] font-mono px-1.5 py-0.5 rounded border border-blue-200/60">{institutionName}</span>
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-none">{equipmentAET}</p>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-200 hidden md:block" />

        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-full border border-slate-200 text-xs">
          <Server className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-slate-500 font-medium text-[11px]">Orthanc:</span>
          {orthancOnline ? (
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected (C-STORE)
            </span>
          ) : (
            <span className="text-rose-600 font-semibold text-[11px]">Disconnected</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSyncOrthanc}
          disabled={isSyncing}
          title="Sincronizar estudios con servidor Orthanc"
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-md border border-slate-200 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? 'Sync...' : 'Sync DICOM'}</span>
        </button>

        <div className="h-5 w-px bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <img
            src={currentUser.avatar || 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80'}
            alt={currentUser.name}
            className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200"
          />
          <div className="text-left hidden sm:block">
            <span className="text-xs font-medium text-slate-800">{currentUser.name}</span>
            <span className="text-[10px] text-slate-400 ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-semibold">
              {currentUser.role}
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Cerrar sesión"
          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
