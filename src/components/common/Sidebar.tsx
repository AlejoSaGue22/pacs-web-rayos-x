import React from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Server,
  ClipboardList,
  Shield,
  Settings,
  Tv,
} from 'lucide-react';
import { UserRole } from '../../types/pacs';

export type ActiveTab = 'dashboard' | 'patients' | 'studies' | 'orthanc' | 'audit' | 'users' | 'config';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  userRole: UserRole;
  unreadCount?: number;
  orthancOnline?: boolean;
  remoteAETitle?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  userRole,
  orthancOnline = false,
  remoteAETitle = '',
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'studies', label: 'Estudios', icon: FolderKanban },
    { id: 'orthanc', label: 'Servidor Orthanc', icon: Server },
    { id: 'audit', label: 'Registro de Auditoría', icon: ClipboardList },
    { id: 'users', label: 'Usuarios y Roles', icon: Shield, adminOnly: true },
    { id: 'config', label: 'Configuración', icon: Settings, adminOnly: true },
  ];

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col border-r border-slate-800 shrink-0 font-sans">
      <div className="p-5 flex items-center gap-3 border-b border-slate-800/60">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold shadow-xs">
          <Tv className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <h1 className="text-white font-bold text-base tracking-tight">MiniPACS</h1>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Mindray DigiEye 330</p>
        </div>
      </div>

      <nav className="flex-1 px-3 mt-4 space-y-1">
        {navItems.map(item => {
          if (item.adminOnly && userRole !== 'Admin') return null;

          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as ActiveTab)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info Box */}
      <div className="mt-auto p-4 border-t border-slate-800 bg-[#0B1120]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-blue-400 border border-slate-700">
            DR
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{remoteAETitle || 'PACS'}</p>
            <p className="text-[10px] text-slate-400 truncate">AET: {remoteAETitle || 'ORTHANC'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-tight border-t border-slate-800/80 pt-2.5">
          <span>Orthanc PACS</span>
          <span className={`flex items-center gap-1 font-semibold ${orthancOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${orthancOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {orthancOnline ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>
    </aside>
  );
};
