import React, { useState } from 'react';
import { X, KeyRound, LogIn, AlertCircle } from 'lucide-react';
import { UserRole } from '../../types/pacs';
import { PacsApiService } from '../../services/pacsApi';

interface LoginModalProps {
  onLogin: (role: UserRole) => void;
  onSwitchRole: (role: UserRole) => void;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onLogin,
  onSwitchRole,
  onClose,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isAuthenticated = PacsApiService.isAuthenticated();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await PacsApiService.login(email, password);
      onLogin(result.user.role);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSwitch = async (role: UserRole) => {
    try {
      const result = await PacsApiService.switchRole(role);
      onSwitchRole(result.user.role);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Error al cambiar rol');
    }
  };

  if (isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden text-slate-800 font-sans">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Cambio de Perfil</h3>
                <p className="text-xs text-slate-500">Seleccione el rol activo</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            {(['Admin', 'Radiologo', 'Tecnico', 'Consulta'] as UserRole[]).map(role => (
              <button
                key={role}
                onClick={() => handleRoleSwitch(role)}
                className="w-full p-3 text-left rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                  {role[0]}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">{role}</h4>
                  <p className="text-[11px] text-slate-500">Cambiar a perfil {role}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-slate-100 bg-slate-50 text-right">
            <button
              onClick={() => { PacsApiService.logout(); onClose(); }}
              className="px-4 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-md text-xs font-medium"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm overflow-hidden text-slate-800 font-sans">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Iniciar Sesión</h3>
                <p className="text-xs text-slate-500">Mini PACS Web - Rayos X</p>
              </div>
            </div>
            {isAuthenticated && (
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

        <form onSubmit={handleLogin} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@rayosx.med.co"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? 'Verificando...' : 'Ingresar al sistema'}
          </button>


        </form>
      </div>
    </div>
  );
};
