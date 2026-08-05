import React, { useState } from 'react';
import {
  FolderKanban,
  Search,
  Filter,
  Eye,
  FileText,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  MoreVertical,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DicomStudy, StudyFilters, StudyStatus } from '../../types/pacs';

interface StudiesViewProps {
  studies: DicomStudy[];
  filters: StudyFilters;
  onFilterChange: (filters: StudyFilters) => void;
  onOpenViewer: (study: DicomStudy) => void;
  onOpenTagsModal: (study: DicomStudy) => void;
  onUpdateStatus: (studyId: string, status: StudyStatus) => void;
}

export const StudiesView: React.FC<StudiesViewProps> = ({
  studies,
  filters,
  onFilterChange,
  onOpenViewer,
  onOpenTagsModal,
  onUpdateStatus,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const handleDownloadDicom = (study: DicomStudy) => {
    const jsonStr = JSON.stringify(study, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DICOM_${study.accessionNumber}_${study.patientDocument}.dcm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            Estudios DICOM Recibidos (Orthanc Server)
          </h2>
          <p className="text-xs text-slate-500">
            Registro inmutable de imágenes radiográficas Mindray DigiEye 330 Series
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-700 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
          <Layers className="w-4 h-4 text-blue-600" />
          <span className="font-semibold">Total en PACS: {studies.length} Estudios</span>
        </div>
      </div>

      {/* Multi-Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
          Filtros de Búsqueda Avanzada
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Text Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Nombre, Documento, Acceso..."
              value={filters.searchTerm}
              onChange={e => onFilterChange({ ...filters, searchTerm: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Modality Selector */}
          <div>
            <select
              value={filters.modality}
              onChange={e => onFilterChange({ ...filters, modality: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="ALL">Todas las Modalidades</option>
              <option value="DX">DX - Radiografía Digital (Mindray)</option>
              <option value="CR">CR - Radiografía Computarizada</option>
              <option value="CT">CT - Tomografía Axial</option>
              <option value="MR">MR - Resonancia Magnética</option>
              <option value="US">US - Ultrasonido</option>
            </select>
          </div>

          {/* Status Selector */}
          <div>
            <select
              value={filters.status}
              onChange={e => onFilterChange({ ...filters, status: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="Recibido">Recibido (Pendiente)</option>
              <option value="En Revisión">En Revisión</option>
              <option value="Informado">Informado</option>
              <option value="Archivado">Archivado</option>
            </select>
          </div>

          {/* Date From */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => onFilterChange({ ...filters, dateFrom: e.target.value })}
              className="w-full bg-transparent text-xs text-slate-700 focus:outline-none font-mono"
            />
          </div>

          {/* Date To */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => onFilterChange({ ...filters, dateTo: e.target.value })}
              className="w-full bg-transparent text-xs text-slate-700 focus:outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* Studies Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Paciente (DNI)</th>
                <th className="py-3 px-4">Estudio Radiográfico</th>
                <th className="py-3 px-4">Mod / Equipamiento</th>
                <th className="py-3 px-4 text-center">Imágenes</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studies.map(study => (
                <tr key={study.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-600">
                    <div>{study.studyDate}</div>
                    <div className="text-[10px] text-slate-400">{study.studyTime}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">{study.patientName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Doc: {study.patientDocument}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-700">{study.studyDescription}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Acc: <span className="text-blue-700">{study.accessionNumber}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[10px] border border-blue-200">
                        {study.modality}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate max-w-[120px]">
                        {study.manufacturerModelName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px]">
                      {study.numberOfSeries} series ({study.numberOfInstances} img)
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={study.status}
                      onChange={e => onUpdateStatus(study.id, e.target.value as StudyStatus)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border focus:outline-none cursor-pointer uppercase ${
                        study.status === 'Informado'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : study.status === 'En Revisión'
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                      }`}
                    >
                      <option value="Recibido" className="bg-white text-slate-800">Recibido</option>
                      <option value="En Revisión" className="bg-white text-slate-800">En Revisión</option>
                      <option value="Informado" className="bg-white text-slate-800">Informado</option>
                      <option value="Archivado" className="bg-white text-slate-800">Archivado</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenViewer(study)}
                        className="text-blue-600 hover:text-blue-700 font-bold text-xs px-3 py-1 border border-blue-200 rounded hover:bg-blue-50 transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Visor OHIF
                      </button>

                      <button
                        onClick={() => onOpenTagsModal(study)}
                        title="Ver Cabecera DICOM (Tags)"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDownloadDicom(study)}
                        title="Descargar Archivo .DCM"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {studies.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    No se encontraron estudios que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
