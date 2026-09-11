import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FolderKanban,
  Search,
  Calendar,
  Eye,
  FileText,
  FileDown,
  Download,
  Archive,
  FileOutput,
  Layers,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { DicomStudy, StudyStatus } from '../../types/pacs';
import { StudyListQuery, SortOrder } from '../../types/pagination';
import { PacsApiService } from '../../services/pacsApi';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { PaginationBar } from '../common/PaginationBar';

interface StudiesViewProps {
  quickSearchTerm: string;
  quickSearchKey: number;
  onOpenViewer: (study: DicomStudy) => void;
  onOpenTagsModal: (study: DicomStudy) => void;
}

function defaultStudyQuery(quickSearchTerm: string): StudyListQuery {
  return {
    page: 1,
    pageSize: 10,
    sortBy: 'studyDate',
    sortOrder: 'desc',
    searchTerm: quickSearchTerm || undefined,
    modality: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    status: undefined,
  };
}

type SortField = 'studyDate' | 'patientName' | 'accessionNumber';

export const StudiesView: React.FC<StudiesViewProps> = ({
  quickSearchTerm,
  quickSearchKey,
  onOpenViewer,
  onOpenTagsModal,
}) => {
  const { data, loading, error, query, setQuery, setPage, setPageSize, setSort, reload } =
    usePaginatedResource<DicomStudy, StudyListQuery>({
      fetcher: (q) => PacsApiService.getStudies(q),
      defaultQuery: defaultStudyQuery(quickSearchTerm),
    });

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (quickSearchKey > 0) {
      setQuery({ searchTerm: quickSearchTerm || undefined });
    }
  }, [quickSearchKey]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    }
    if (activeMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenuId]);

  const toggleSort = useCallback((field: SortField) => {
    const currentSortBy = query.sortBy;
    let newField: string | undefined = field;
    let newOrder: SortOrder = field === currentSortBy && query.sortOrder === 'asc' ? 'desc' : 'asc';
    setSort(newField, newOrder);
  }, [query.sortBy, query.sortOrder, setSort]);

  const getSortIcon = (field: SortField) => {
    if (query.sortBy !== field) return null;
    return query.sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  const handleStatusChange = async (studyId: string, status: StudyStatus) => {
    await PacsApiService.updateStudyStatus(studyId, status);
    reload();
  };

  const handleDownloadPdf = (study: DicomStudy) => {
    PacsApiService.triggerDownload(
      PacsApiService.getPdfDownloadUrl(study.id),
      `Informe_${study.accessionNumber}_${study.patientDocument}.pdf`
    );
    setActiveMenuId(null);
  };

  const handleDownloadZip = (study: DicomStudy) => {
    PacsApiService.triggerDownload(
      PacsApiService.getZipDownloadUrl(study.id),
      `DICOM_${study.accessionNumber}.zip`
    );
    setActiveMenuId(null);
  };

  const handleDownloadDicom = (instanceId: string, study: DicomStudy) => {
    PacsApiService.triggerDownload(
      PacsApiService.getDicomDownloadUrl(instanceId),
      `DICOM_${study.accessionNumber}.dcm`
    );
    setActiveMenuId(null);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const filterValues = {
    searchTerm: query.searchTerm || '',
    modality: query.modality || 'ALL',
    dateFrom: query.dateFrom || '',
    dateTo: query.dateTo || '',
    status: query.status || 'ALL',
  };

  return (
    <div className="space-y-5">
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
          <span className="font-semibold">Total en PACS: {total} Estudios</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
          Filtros de Búsqueda Avanzada
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Nombre, Documento, Acceso..."
              value={filterValues.searchTerm}
              onChange={e => setQuery({ searchTerm: e.target.value || undefined })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <select
              value={filterValues.modality}
              onChange={e => setQuery({ modality: e.target.value === 'ALL' ? undefined : e.target.value })}
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

          <div>
            <select
              value={filterValues.status}
              onChange={e => setQuery({ status: e.target.value === 'ALL' ? undefined : e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="Recibido">Recibido (Pendiente)</option>
              <option value="En Revisión">En Revisión</option>
              <option value="Informado">Informado</option>
              <option value="Archivado">Archivado</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={filterValues.dateFrom}
              onChange={e => setQuery({ dateFrom: e.target.value || undefined })}
              className="w-full bg-transparent text-xs text-slate-700 focus:outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={filterValues.dateTo}
              onChange={e => setQuery({ dateTo: e.target.value || undefined })}
              className="w-full bg-transparent text-xs text-slate-700 focus:outline-none font-mono"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-3 px-4 cursor-pointer select-none hover:text-slate-800" onClick={() => toggleSort('studyDate')}>
                  Fecha / Hora {getSortIcon('studyDate')}
                </th>
                <th className="py-3 px-4 cursor-pointer select-none hover:text-slate-800" onClick={() => toggleSort('patientName')}>
                  Paciente (DNI) {getSortIcon('patientName')}
                </th>
                <th className="py-3 px-4">Estudio Radiográfico</th>
                <th className="py-3 px-4">Mod / Equipamiento</th>
                <th className="py-3 px-4 text-center">Imágenes</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">Cargando estudios...</td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-rose-500">{error}</td>
                </tr>
              )}
              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    No se encontraron estudios que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              )}
              {items.map(study => (
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
                      onChange={e => handleStatusChange(study.id, e.target.value as StudyStatus)}
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

                      <div className="relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === study.id ? null : study.id)}
                          title="Exportar estudio"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors flex items-center gap-0.5"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>

                        {activeMenuId === study.id && (
                          <div ref={menuRef} className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 text-xs">
                            <button
                              onClick={() => handleDownloadPdf(study)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-slate-700 transition-colors"
                            >
                              <FileOutput className="w-4 h-4 text-rose-500" />
                              <span>Descargar PDF (Informe)</span>
                            </button>
                            <button
                              onClick={() => handleDownloadZip(study)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-slate-700 transition-colors"
                            >
                              <Archive className="w-4 h-4 text-amber-500" />
                              <span>Descargar ZIP (DICOM)</span>
                            </button>
                            {study.series[0]?.instances[0] && (
                              <button
                                onClick={() => handleDownloadDicom(study.series[0].instances[0].id, study)}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2 text-slate-700 transition-colors"
                              >
                                <Download className="w-4 h-4 text-blue-500" />
                                <span>Descargar DICOM (.dcm)</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
    </div>
  );
};
