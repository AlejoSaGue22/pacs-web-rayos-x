import React, { useCallback } from 'react';
import { ClipboardList, Search, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { AuditLog } from '../../types/pacs';
import { AuditLogQuery, SortOrder } from '../../types/pagination';
import { PacsApiService } from '../../services/pacsApi';
import { usePaginatedResource } from '../../hooks/usePaginatedResource';
import { PaginationBar } from '../common/PaginationBar';

type SortField = 'timestamp' | 'userName' | 'action';

export const AuditView: React.FC = () => {
  const { data, loading, error, query, setQuery, setPage, setPageSize, setSort } =
    usePaginatedResource<AuditLog, AuditLogQuery>({
      fetcher: (q) => PacsApiService.getAuditLogs(q),
      defaultQuery: { page: 1, pageSize: 10, sortBy: 'timestamp', sortOrder: 'desc' },
    });

  const handleActionChange = useCallback((val: string) => {
    setQuery({ action: val === 'ALL' ? undefined : val });
  }, [setQuery]);

  const handleSearchChange = useCallback((val: string) => {
    setQuery({ search: val || undefined });
  }, [setQuery]);

  const toggleSort = useCallback((field: SortField) => {
    const currentSortBy = query.sortBy;
    const newField = field;
    const newOrder: SortOrder = field === currentSortBy && query.sortOrder === 'asc' ? 'desc' : 'asc';
    setSort(newField, newOrder);
  }, [query.sortBy, query.sortOrder, setSort]);

  const getSortIcon = (field: SortField) => {
    if (query.sortBy !== field) return null;
    return query.sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />;
  };

  const handleExportCsv = () => {
    const items = data?.items ?? [];
    const headers = ['ID', 'Timestamp', 'Usuario', 'Rol', 'Acción', 'Descripción', 'IP'];
    const rows = items.map(l => [
      l.id,
      l.timestamp,
      `"${l.userName}"`,
      l.userRole,
      l.action,
      `"${l.description}"`,
      l.ipAddress,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Auditoria_PACS_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            Bitácora de Auditoría y Trazabilidad Médica
          </h2>
          <p className="text-xs text-slate-500">
            Registro inalterable de accesos a historias clínicas, visualización de imágenes y cambios del sistema
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-md text-xs border border-slate-200 flex items-center gap-2 transition-colors shrink-0"
        >
          <Download className="w-4 h-4 text-blue-600" />
          Exportar Reporte CSV
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por usuario, descripción o detalle..."
            value={query.search || ''}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <select
            value={query.action || 'ALL'}
            onChange={e => handleActionChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
          >
            <option value="ALL">Todas los Eventos de Auditoría</option>
            <option value="LOGIN">LOGIN - Inicio de Sesión</option>
            <option value="PATIENT_CREATE">PATIENT_CREATE - Registro de Paciente</option>
            <option value="PATIENT_UPDATE">PATIENT_UPDATE - Modificación Paciente</option>
            <option value="PATIENT_DELETE">PATIENT_DELETE - Eliminación Lógica Paciente</option>
            <option value="STUDY_VIEW">STUDY_VIEW - Visualización de Estudio</option>
            <option value="STUDY_DOWNLOAD">STUDY_DOWNLOAD - Descarga de Estudio</option>
            <option value="ORTHANC_SYNC">ORTHANC_SYNC - Sincronización DICOM</option>
            <option value="CONFIG_UPDATE">CONFIG_UPDATE - Cambio Configuración</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-3 px-4 cursor-pointer select-none hover:text-slate-800" onClick={() => toggleSort('timestamp')}>
                  Fecha / Hora {getSortIcon('timestamp')}
                </th>
                <th className="py-3 px-4 cursor-pointer select-none hover:text-slate-800" onClick={() => toggleSort('userName')}>
                  Usuario {getSortIcon('userName')}
                </th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4 cursor-pointer select-none hover:text-slate-800" onClick={() => toggleSort('action')}>
                  Tipo de Acción {getSortIcon('action')}
                </th>
                <th className="py-3 px-4">Descripción del Evento</th>
                <th className="py-3 px-4 text-right">Dirección IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">Cargando registros de auditoría...</td>
                </tr>
              )}
              {error && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-rose-500">{error}</td>
                </tr>
              )}
              {!loading && !error && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No se encontraron registros de auditoría para los filtros aplicados.
                  </td>
                </tr>
              )}
              {items.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {log.userName}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] border border-slate-200">
                      {log.userRole}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-blue-700">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    <div>{log.description}</div>
                    {log.details && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.details}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {log.ipAddress}
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
