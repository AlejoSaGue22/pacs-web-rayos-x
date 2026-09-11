import React, { useState } from 'react';
import {
  Search,
  UserPlus,
  User,
  Edit,
  Trash2,
  FolderKanban,
  Calendar,
  Phone,
  Mail,
  History,
  Eye,
  X,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Patient, DicomStudy } from '../../types/pacs';
import { PatientQuery, SortOrder } from '../../types/pagination';
import { PatientModal } from './PatientModal';
import { PacsApiService } from '../../services/pacsApi';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { PaginationBar } from '../common/PaginationBar';

interface PatientsViewProps {
  onOpenStudyViewer: (study: DicomStudy) => void;
}

type SortField = 'createdAt' | 'documentNumber' | 'firstName' | 'lastName';

export const PatientsView: React.FC<PatientsViewProps> = ({
  onOpenStudyViewer,
}) => {
  const { data, loading, error, query, setQuery, setPage, setPageSize, setSort, reload } =
    usePaginatedResource<Patient, PatientQuery>({
      fetcher: (q) => PacsApiService.getPatients(q),
      defaultQuery: { page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' },
    });

  const [selectedPatientModal, setSelectedPatientModal] = useState<{ open: boolean; patient?: Patient | null }>({
    open: false,
    patient: null,
  });

  const [historyModalPatient, setHistoryModalPatient] = useState<Patient | null>(null);
  const [historyModalStudies, setHistoryModalStudies] = useState<DicomStudy[]>([]);
  const [historyModalLoading, setHistoryModalLoading] = useState(false);
  const [deleteConfirmPatient, setDeleteConfirmPatient] = useState<Patient | null>(null);

  const openHistoryModal = async (patient: Patient) => {
    setHistoryModalPatient(patient);
    setHistoryModalLoading(true);
    try {
      const studies = await PacsApiService.getPatientStudies(patient.id);
      setHistoryModalStudies(studies);
    } catch {
      setHistoryModalStudies([]);
    } finally {
      setHistoryModalLoading(false);
    }
  };

  const handleSavePatient = async (data: any) => {
    if (selectedPatientModal.patient) {
      await PacsApiService.updatePatient(selectedPatientModal.patient.id, data);
    } else {
      await PacsApiService.createPatient(data);
    }
    setSelectedPatientModal({ open: false, patient: null });
    reload();
  };

  const handleDeletePatient = async () => {
    if (deleteConfirmPatient) {
      await PacsApiService.deletePatient(deleteConfirmPatient.id);
      setDeleteConfirmPatient(null);
      reload();
    }
  };

  const toggleSort = (field: SortField) => {
    const currentSortBy = query.sortBy;
    let newField: string | undefined = field;
    let newOrder: SortOrder = field === currentSortBy && query.sortOrder === 'asc' ? 'desc' : 'asc';
    setSort(newField, newOrder);
  };

  const getSortIcon = (field: SortField) => {
    if (query.sortBy !== field) return null;
    return query.sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            Gestión de Pacientes (Patient Registry)
          </h2>
          <p className="text-xs text-slate-500">
            Registro central de pacientes vinculados a estudios radiográficos Mindray DigiEye 330
          </p>
        </div>

        <button
          onClick={() => setSelectedPatientModal({ open: true, patient: null })}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Registrar Nuevo Paciente
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        <input
          type="text"
          placeholder="Buscar paciente por Documento, Nombres, Apellidos o Email..."
          value={query.search || ''}
          onChange={e => setQuery({ search: e.target.value || undefined })}
          className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors shadow-xs"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-3 px-4 cursor-pointer select-none hover:text-slate-800" onClick={() => toggleSort('documentNumber')}>
                  Documento (ID) {getSortIcon('documentNumber')}
                </th>
                <th className="py-3 px-4 cursor-pointer select-none hover:text-slate-800" onClick={() => toggleSort('firstName')}>
                  Nombres y Apellidos {getSortIcon('firstName')}
                </th>
                <th className="py-3 px-4">Fecha Nac. / Sexo</th>
                <th className="py-3 px-4">Contacto</th>
                <th className="py-3 px-4 text-center">Estudios Rx</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">Cargando pacientes...</td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-rose-500">{error}</td>
                </tr>
              )}
              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                    No se encontraron pacientes registrados con el criterio especificado.
                  </td>
                </tr>
              )}
              {items.map(patient => (
                <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-700">
                    {patient.documentNumber}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">
                      {patient.firstName} {patient.lastName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Registrado: {new Date(patient.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-700 font-mono">{patient.birthDate}</div>
                    <div className="text-[10px] font-semibold text-slate-500">
                      {patient.gender === 'M' ? 'Masculino (M)' : patient.gender === 'F' ? 'Femenino (F)' : 'Otro'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-700">{patient.phone || 'Sin teléfono'}</div>
                    <div className="text-[10px] text-slate-400">{patient.email || ''}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold text-[11px] border border-blue-200">
                      {(patient as any)._count?.studies ?? patient.studyCount ?? 0} Estudios
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openHistoryModal(patient)}
                        title="Ver Historial de Estudios DICOM"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                      >
                        <History className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => setSelectedPatientModal({ open: true, patient })}
                        title="Editar Datos del Paciente"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmPatient(patient)}
                        title="Eliminación Lógica"
                        className="p-1.5 bg-slate-100 hover:bg-rose-50 text-rose-600 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 py-3">
            <PaginationBar
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {selectedPatientModal.open && (
        <PatientModal
          patient={selectedPatientModal.patient}
          onSave={handleSavePatient}
          onClose={() => setSelectedPatientModal({ open: false, patient: null })}
        />
      )}

      {historyModalPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden text-slate-800 font-sans">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Historial de Estudios DICOM</h3>
                  <p className="text-xs text-slate-500">
                    Paciente: {historyModalPatient.firstName} {historyModalPatient.lastName} (Doc: {historyModalPatient.documentNumber})
                  </p>
                </div>
              </div>
              <button onClick={() => { setHistoryModalPatient(null); setHistoryModalStudies([]); }} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {historyModalLoading && (
                <div className="py-8 text-center text-slate-400 text-xs">Cargando historial...</div>
              )}
              {!historyModalLoading && historyModalStudies.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Este paciente aún no registra estudios radiográficos en Orthanc.
                </div>
              )}
              {historyModalStudies.map(study => (
                <div key={study.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">{study.studyDescription}</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-xs font-bold border border-blue-200">
                        {study.modality}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Fecha: <span className="font-mono text-slate-700">{study.studyDate} {study.studyTime}</span> | N° Acceso: <span className="font-mono text-blue-700">{study.accessionNumber}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setHistoryModalPatient(null);
                      setHistoryModalStudies([]);
                      onOpenStudyViewer(study);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <Eye className="w-4 h-4" />
                    Abrir Visor
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
              <button
                onClick={() => { setHistoryModalPatient(null); setHistoryModalStudies([]); }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden text-slate-800 font-sans p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Confirmar Eliminación Lógica</h3>
                <p className="text-xs text-slate-500">Desactivar registro de paciente</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ¿Está seguro de que desea marcar como eliminado al paciente <span className="font-bold text-slate-800">{deleteConfirmPatient.firstName} {deleteConfirmPatient.lastName}</span> (Doc: {deleteConfirmPatient.documentNumber})? El historial en Orthanc permanecerá intacto por normas médicas.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmPatient(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePatient}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-md text-xs shadow-xs"
              >
                Sí, Eliminar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
