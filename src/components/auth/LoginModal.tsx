import React from 'react';
import { X, ShieldCheck, User, Check, KeyRound } from 'lucide-react';
import { User as UserType, UserRole } from '../../types/pacs';

interface LoginModalProps {
  users: UserType[];
  activeUser: UserType;
  onSelectRole: (role: UserRole) => void;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  users,
  activeUser,
  onSelectRole,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden text-slate-800 font-sans">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Cambio de Perfil / Autenticación</h3>
              <p className="text-xs text-slate-500">Seleccione el rol activo para simular permisos</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Roles List */}
        <div className="p-4 space-y-2.5">
          {users.map(u => {
            const isSelected = u.role === activeUser.role;
            return (
              <div
                key={u.id}
                onClick={() => {
                  onSelectRole(u.role);
                  onClose();
                }}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 shadow-xs ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={u.avatar || 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80'}
                    alt={u.name}
                    className="w-9 h-9 rounded-md object-cover ring-1 ring-slate-200"
                  />
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs">{u.name}</h4>
                    <p className="text-[11px] font-semibold text-blue-700">{u.role}</p>
                  </div>
                </div>

                {isSelected ? (
                  <span className="p-1 bg-emerald-600 text-white rounded-full">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 hover:text-slate-600">Seleccionar</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md text-xs font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
