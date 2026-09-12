import React from 'react';
import { AlertTriangle, Settings, ArrowRight, X } from 'lucide-react';
import { UserRole } from '../../types/pacs';

interface ConfigWarningBannerProps {
  userRole: UserRole;
  onNavigateToConfig: () => void;
  onDismiss?: () => void;
}

export const ConfigWarningBanner: React.FC<ConfigWarningBannerProps> = ({
  userRole,
  onNavigateToConfig,
  onDismiss,
}) => {
  const isAdmin = userRole === 'Admin';

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/5 border-b border-amber-300/80 px-6 py-3 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs shrink-0 transition-all animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500 text-white rounded-lg shadow-xs shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
              Configuración Inicial Requerida
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
              Modo Plantilla DICOM
            </span>
          </div>
          <p className="text-xs text-amber-800 mt-0.5">
            {isAdmin
              ? 'El servidor Orthanc y los parámetros DICOM (AETitles) están operando con valores temporales. Complete la configuración para activar la recepción C-STORE.'
              : 'El servidor PACS está en modo inicial. Comuníquese con el Administrador para validar la parametrización de red del equipo de Rayos X.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {isAdmin && (
          <button
            onClick={onNavigateToConfig}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurar Servidor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {onDismiss && (
          <button
            onClick={onDismiss}
            title="Ocultar advertencia"
            className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
