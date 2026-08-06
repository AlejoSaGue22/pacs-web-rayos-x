import React, { useState } from 'react';
import { Shield, User, Check, X, Lock, KeyRound, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { User as UserType, UserRole } from '../../types/pacs';

interface UsersViewProps {
  users: UserType[];
  activeUser: UserType;
  onSwitchRole: (role: UserRole) => void;
  onCreateUser: (data: { name: string; email: string; role: string; password: string }) => Promise<void>;
  onUpdateUser: (id: string, data: { name?: string; email?: string; role?: string; password?: string }) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
}

const ROLES: UserRole[] = ['Admin', 'Radiologo', 'Tecnico', 'Consulta'];

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  activeUser,
  onSwitchRole,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'Tecnico' as string, password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', role: 'Tecnico', password: '' });
    setError('');
    setShowForm(true);
  };

  const handleOpenEdit = (user: UserType) => {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, role: user.role, password: '' });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (editingUser) {
        const updates: any = {};
        if (formData.name !== editingUser.name) updates.name = formData.name;
        if (formData.email !== editingUser.email) updates.email = formData.email;
        if (formData.role !== editingUser.role) updates.role = formData.role;
        if (formData.password) updates.password = formData.password;
        await onUpdateUser(editingUser.id, updates);
      } else {
        if (!formData.password) {
          setError('La contraseña es obligatoria para nuevos usuarios');
          setLoading(false);
          return;
        }
        await onCreateUser(formData);
      }
      setShowForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: UserType) => {
    if (!confirm(`¿Está seguro de eliminar al usuario ${user.name}?`)) return;
    try {
      await onDeleteUser(user.id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            Control de Usuarios y Matriz de Permisos (RBAC)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Asignación de perfiles para Administrador, Radiólogo, Técnico de Rayos X y Personal de Consulta
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-xs flex items-center gap-2 shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
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
                <div className="overflow-hidden flex-1">
                  <h4 className="font-bold text-slate-800 text-xs truncate">{u.name}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                  {u.role}
                </span>

                <div className="flex items-center gap-1">
                  {isActive ? (
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Activo
                    </span>
                  ) : (
                    <button
                      onClick={() => onSwitchRole(u.role)}
                      className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      Probar
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEdit(u)}
                    title="Editar usuario"
                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(u)}
                    title="Eliminar usuario"
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden text-slate-800 font-sans">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingUser ? `Editando ${editingUser.name}` : 'Complete los datos del nuevo usuario'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre completo</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dr. Juan Pérez"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="usuario@rayosx.med.co"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Rol</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Contraseña {editingUser && <span className="text-slate-400 font-normal">(dejar vacío para no cambiar)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : 'Contraseña obligatoria'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={!editingUser}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {loading ? 'Guardando...' : editingUser ? 'Actualizar' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
