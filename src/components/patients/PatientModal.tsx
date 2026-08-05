import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, User as UserIcon, Phone, Mail, Calendar, FileText } from 'lucide-react';
import { Patient } from '../../types/pacs';

interface PatientModalProps {
  patient?: Patient | null;
  onSave: (data: {
    documentNumber: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    gender: 'M' | 'F' | 'O';
    phone: string;
    email?: string;
  }) => void;
  onClose: () => void;
}

export const PatientModal: React.FC<PatientModalProps> = ({ patient, onSave, onClose }) => {
  const [documentNumber, setDocumentNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('1985-05-15');
  const [gender, setGender] = useState<'M' | 'F' | 'O'>('M');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (patient) {
      setDocumentNumber(patient.documentNumber || '');
      setFirstName(patient.firstName || '');
      setLastName(patient.lastName || '');
      setBirthDate(patient.birthDate || '1985-05-15');
      setGender(patient.gender || 'M');
      setPhone(patient.phone || '');
      setEmail(patient.email || '');
    }
  }, [patient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentNumber.trim() || !firstName.trim() || !lastName.trim()) {
      setError('Cédula / Documento, Nombre y Apellido son obligatorios.');
      return;
    }

    onSave({
      documentNumber: documentNumber.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate,
      gender,
      phone: phone.trim(),
      email: email.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden text-slate-800 font-sans">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {patient ? 'Editar Registro de Paciente' : 'Nuevo Registro de Paciente'}
              </h3>
              <p className="text-xs text-slate-500">Información demográfica para DICOM Worklist</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Documento de Identificación (Cédula / DNI) *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: 1029384756"
              value={documentNumber}
              disabled={!!patient}
              onChange={e => setDocumentNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nombres *</label>
              <input
                type="text"
                required
                placeholder="Ej: Juan Carlos"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Apellidos *</label>
              <input
                type="text"
                required
                placeholder="Ej: Pérez Gómez"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Sexo Biológico (DICOM 0010,0040)</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="M">M - Masculino</option>
                <option value="F">F - Femenino</option>
                <option value="O">O - Otro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                Teléfono de Contacto
              </label>
              <input
                type="text"
                placeholder="+57 300 000 0000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                Correo Electrónico
              </label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-xs shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              Guardar Paciente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
