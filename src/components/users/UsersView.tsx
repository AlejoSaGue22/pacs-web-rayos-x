import React from 'react';
import { Shield, User, Check, X, Lock, KeyRound } from 'lucide-react';
import { User as UserType, UserRole } from '../../types/pacs';

interface UsersViewProps {
  users: UserType[];
  activeUser: UserType;
  onSwitchRole: (role: UserRole) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ users, activeUser, onSwitchRole }) => {
  const permissionsMatrix = [
    { feature: 'Crear / Editar Pacientes', admin: true, radiologo: true, tecnico: true, consulta: false },
    { feature: 'Eliminación Lógica de Pacientes', admin: true, radiologo: false, tecnico: false, consulta: false },
    { feature: 'Visualizar Estudios en OHIF Viewer', admin: true, radiologo: true, tecnico: true, consulta: true },
    { feature: 'Editar Estado del Estudio (Informe)', admin: true, radiologo: true, tecnico: false, consulta: false },
    { feature: 'Descargar Archivos DICOM .DCM', admin: true, radiologo: true, tecnico: true, consulta: false },
    { feature: 'Ejecutar Sincronización Orthanc Manual', admin: true, radiologo: true, tecnico: true, consulta: false },
    { feature: 'Ver Bitácora de Auditoría', admin: true, radiologo: true, tecnico: false, consulta: false },
    { feature: 'Modificar Configuración PACS & AETitles', admin: true, radiologo: false, tecnico: false, consulta: false },
    { feature: 'Gestión de Usuarios y Roles', admin: true, radiologo: false, tecnico: false, consulta: false },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          Control de Usuarios y Matriz de Permisos (RBAC)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Asignación de perfiles para Administrador, Radiólogo, Técnico de Rayos X y Personal de Consulta
        </p>
      </div>

      {/* Users List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {users.map(u => {
          const isActive = u.role === activeUser.role;
          return (
            <div
              key={u.id}
              className={`p-4 rounded-xl border transition-all space-y-3 ${
                isActive
                  ? 'bg-white border-blue-500 shadow-xs ring-1 ring-blue-500'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={u.avatar || 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80'}
                  alt={u.name}
                  className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-200"
                />
                <div className="overflow-hidden">
                  <h4 className="font-bold text-slate-800 text-xs truncate">{u.name}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                  {u.role}
                </span>

                {isActive ? (
                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Rol Activo
                  </span>
                ) : (
                  <button
                    onClick={() => onSwitchRole(u.role)}
                    className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    Probar Perfil
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-blue-600" />
          Matriz de Funcionalidades por Perfil de Usuario
        </h3>

        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-2.5 px-4">Módulo / Funcionalidad</th>
                <th className="py-2.5 px-4 text-center">Administrador</th>
                <th className="py-2.5 px-4 text-center">Radiólogo</th>
                <th className="py-2.5 px-4 text-center">Técnico Rx</th>
                <th className="py-2.5 px-4 text-center">Consulta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionsMatrix.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-slate-700">{item.feature}</td>
                  <td className="py-2.5 px-4 text-center">
                    {item.admin ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {item.radiologo ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {item.tecnico ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {item.consulta ? <Check className="w-4 h-4 text-emerald-600 mx-auto" /> : <X className="w-4 h-4 text-slate-300 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
