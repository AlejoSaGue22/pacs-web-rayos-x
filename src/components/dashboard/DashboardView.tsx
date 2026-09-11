import React from 'react';
import {
  Users,
  FolderKanban,
  Calendar,
  HardDrive,
  Activity,
  Eye,
  Server,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle,
  Clock,
  Tv,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { DicomStudy, AuditLog, OrthancStatus, PACSConfig } from '../../types/pacs';

interface DashboardViewProps {
  stats: {
    totalPatients: number;
    studiesToday: number;
    studiesMonth: number;
    totalStorageMb: number;
    modalityCounts: Record<string, number>;
    statusCounts: Record<string, number>;
    recentStudies: DicomStudy[];
    recentAudit: AuditLog[];
    orthancOnline: boolean;
    connectedEquipment?: { name: string; aetitle: string; ip: string; port: number; status: string }[];
  };
  weeklyStats: { day: string; estudios: number }[] | null;
  pacsConfig: PACSConfig | null;
  orthancStatus: OrthancStatus | null;
  onOpenStudyViewer: (study: DicomStudy) => void;
  onNavigateTab: (tab: 'patients' | 'studies' | 'orthanc' | 'audit') => void;
}

const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  weeklyStats,
  pacsConfig,
  orthancStatus,
  onOpenStudyViewer,
  onNavigateTab,
}) => {
  const pieData = Object.entries(stats.modalityCounts).map(([name, value]) => ({ name, value }));

  const chartBarData = weeklyStats || [
    { day: 'Lun', estudios: 0 },
    { day: 'Mar', estudios: 0 },
    { day: 'Mié', estudios: 0 },
    { day: 'Jue', estudios: 0 },
    { day: 'Vie', estudios: 0 },
    { day: 'Sáb', estudios: 0 },
    { day: 'Hoy', estudios: stats.studiesToday },
  ];

  const institutionName = pacsConfig?.institutionName || 'Mini PACS - Rayos X';
  const storagePercent = stats.totalStorageMb > 0 ? Math.min(100, Math.round((stats.totalStorageMb / 50000) * 100)) : 0;
  const equipment = stats.connectedEquipment?.[0] || orthancStatus?.connectedEquipment?.[0];
  const equipmentName = equipment?.name || 'Equipo DICOM';
  const equipmentAET = equipment?.aetitle || pacsConfig?.remoteAETitle || 'ORTHANC_PACS';
  const equipmentPort = equipment?.port || pacsConfig?.remotePort || 4242;
  const isEquipmentConnected = orthancStatus?.online ?? stats.orthancOnline;
  const indexedPercent = stats.studiesMonth > 0 ? Math.min(100, Math.round((stats.studiesMonth / Math.max(stats.studiesMonth, 1)) * 100)) : 100;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
            PACS Dashboard
          </span>
          <h2 className="text-lg font-bold text-slate-800 mt-1.5">
            {institutionName}
          </h2>
          <p className="text-xs text-slate-500">
            Recepción e indexación automática de estudios DICOM mediante almacenamiento C-STORE en servidor Orthanc.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigateTab('studies')}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <FolderKanban className="w-4 h-4" />
            Explorar Estudios
          </button>
          <button
            onClick={() => onNavigateTab('patients')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md text-xs transition-colors shadow-xs"
          >
            Ver Pacientes
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Pacientes</p>
          <h3 className="text-2xl font-bold text-slate-800">{stats.totalPatients}</h3>
          <div className="mt-1 text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Base de datos activa
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estudios (Hoy)</p>
          <h3 className="text-2xl font-bold text-slate-800">{stats.studiesToday}</h3>
          <div className="mt-1 text-[10px] text-blue-600 font-semibold">
            Estudios de imagen digital
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estudios (Mes)</p>
          <h3 className="text-2xl font-bold text-slate-800">{stats.studiesMonth}</h3>
          <div className="mt-1 text-[10px] text-amber-600 font-semibold">
            {indexedPercent}% Indexado en Orthanc
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Almacenamiento Utilizado</p>
          <h3 className="text-2xl font-bold text-slate-800">{stats.totalStorageMb.toFixed(1)} MB</h3>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${storagePercent}%` }}></div>
          </div>
        </div>
      </div>

      {/* Visual Analytics & Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Study Volume Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Volumen Diario de Estudios Radiográficos</h3>
              <p className="text-xs text-slate-500">Estudios capturados con equipo de imagen digital</p>
            </div>
            <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Modalidad DX
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartBarData}>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="estudios" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Modality Breakdown & Equipment Status */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-0.5">Distribución por Modalidad</h3>
            <p className="text-xs text-slate-500 mb-3">Servidor DICOM Orthanc</p>

            <div className="h-40 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-xs mt-1">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-slate-700 font-bold">{entry.name}:</span>
                  <span className="text-slate-500">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 bg-slate-50 p-3 rounded-lg border border-slate-200/60">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-blue-600" />
                {equipmentName}
              </span>
              <span className={`font-bold flex items-center gap-1 text-[11px] ${isEquipmentConnected ? 'text-emerald-600' : 'text-rose-600'}`}>
                <span className={`w-2 h-2 rounded-full ${isEquipmentConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {isEquipmentConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              C-STORE directo a AET <span className="text-blue-700 font-mono font-bold">{equipmentAET}:{equipmentPort}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Recent Studies & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Studies Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Últimos Estudios Recibidos</h3>
              <p className="text-xs text-slate-500">Sincronizados desde el servidor DICOM Orthanc</p>
            </div>
            <button
              onClick={() => onNavigateTab('studies')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Ver Todos
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-3 px-4">Fecha/Hora</th>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Estudio / Descripción</th>
                  <th className="py-3 px-4">Mod</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentStudies.map(study => (
                  <tr key={study.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      <div>{study.studyDate}</div>
                      <div className="text-[10px] text-slate-400">{study.studyTime}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{study.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Doc: {study.patientDocument}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <div className="font-semibold">{study.studyDescription}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Acc: {study.accessionNumber}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                        {study.modality}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        study.status === 'Informado'
                          ? 'bg-emerald-100 text-emerald-700'
                          : study.status === 'En Revisión'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {study.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onOpenStudyViewer(study)}
                        className="text-blue-600 hover:text-blue-700 font-bold text-xs px-3 py-1 border border-blue-200 rounded hover:bg-blue-50 transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        OHIF Viewer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Actividad Reciente</h3>
              <p className="text-xs text-slate-500">Registro de auditoría del sistema</p>
            </div>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Ver Todo
            </button>
          </div>

          <div className="space-y-2.5">
            {stats.recentAudit.map(log => (
              <div key={log.id} className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{log.userName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">{log.description}</p>
                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                  <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded font-semibold text-slate-700">{log.action}</span>
                  <span>IP: {log.ipAddress}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
