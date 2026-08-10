import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { CheckCircle } from 'lucide-react';
import { Header } from './components/common/Header';
import { Sidebar, ActiveTab } from './components/common/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { PatientsView } from './components/patients/PatientsView';
import { StudiesView } from './components/studies/StudiesView';
import { OrthancSyncView } from './components/orthanc/OrthancSyncView';
import { AuditView } from './components/audit/AuditView';
import { UsersView } from './components/users/UsersView';
import { ConfigView } from './components/config/ConfigView';
import { OhifViewerModal } from './components/viewer/OhifViewerModal';
import { DicomTagsModal } from './components/studies/DicomTagsModal';
import { LoginPage } from './components/auth/LoginPage';
import { PacsApiService } from './services/pacsApi';
import {
  Patient,
  DicomStudy,
  User,
  AuditLog,
  OrthancStatus,
  PACSConfig,
  StudyFilters,
  StudyStatus,
} from './types/pacs';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<User>(PacsApiService.getCurrentUser());

  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [weeklyStats, setWeeklyStats] = useState<{ days: { day: string; estudios: number }[] } | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [studies, setStudies] = useState<DicomStudy[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [orthancStatus, setOrthancStatus] = useState<OrthancStatus | null>(null);
  const [pacsConfig, setPacsConfig] = useState<PACSConfig | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);

  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const [studyFilters, setStudyFilters] = useState<StudyFilters>({
    searchTerm: '',
    modality: 'ALL',
    dateFrom: '',
    dateTo: '',
    status: 'ALL',
  });

  const [studyForViewer, setStudyForViewer] = useState<DicomStudy | null>(null);
  const [studyForTags, setStudyForTags] = useState<DicomStudy | null>(null);

  const loadData = async () => {
    if (!PacsApiService.isAuthenticated()) return;
    try {
      const [stats, weekly, pats, stds, logs, orthanc, config, users] = await Promise.all([
        PacsApiService.getDashboardStats(),
        PacsApiService.getWeeklyStats(),
        PacsApiService.getPatients(),
        PacsApiService.getStudies(studyFilters),
        PacsApiService.getAuditLogs(),
        PacsApiService.getOrthancStatus(),
        PacsApiService.getPacsConfig(),
        PacsApiService.getUsers(),
      ]);

      setDashboardStats(stats);
      setWeeklyStats(weekly);
      setPatients(pats);
      setStudies(stds);
      setAuditLogs(logs);
      setOrthancStatus(orthanc);
      setPacsConfig(config);
      setUsersList(users);
    } catch (e) {
      console.error('Error cargando datos PACS:', e);
    }
  };

  useEffect(() => {
    if (PacsApiService.isAuthenticated()) {
      setCurrentUser(PacsApiService.getCurrentUser());
      loadData();
    }
  }, [studyFilters]);

  useEffect(() => {
    const socket = io();

    socket.on('orthanc_status_changed', (newStatus: Partial<OrthancStatus>) => {
      setOrthancStatus(prev => prev ? { ...prev, ...newStatus } : newStatus as OrthancStatus);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleLogin = () => {
    setCurrentUser(PacsApiService.getCurrentUser());
    loadData();
  };

  const handleLogout = () => {
    PacsApiService.logout();
    setCurrentUser(PacsApiService.getCurrentUser());
    setDashboardStats(null);
    setWeeklyStats(null);
    setPatients([]);
    setStudies([]);
    setAuditLogs([]);
    setOrthancStatus(null);
    setPacsConfig(null);
    setUsersList([]);
    setActiveTab('dashboard');
  };

  if (!PacsApiService.isAuthenticated()) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const handleQuickSearch = (term: string) => {
    setQuickSearchTerm(term);
    setStudyFilters(prev => ({ ...prev, searchTerm: term }));
    if (activeTab !== 'studies' && activeTab !== 'patients') {
      setActiveTab('studies');
    }
  };

  const handleCreatePatient = async (data: any) => {
    await PacsApiService.createPatient(data);
    loadData();
  };

  const handleUpdatePatient = async (id: string, updates: any) => {
    await PacsApiService.updatePatient(id, updates);
    loadData();
  };

  const handleDeletePatient = async (id: string) => {
    await PacsApiService.deletePatient(id);
    loadData();
  };

  const handleUpdateStudyStatus = async (studyId: string, status: StudyStatus) => {
    await PacsApiService.updateStudyStatus(studyId, status);
    loadData();
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncOrthanc = async () => {
    setIsSyncing(true);
    setToastMessage('Iniciando sincronización manual...');
    try {
      await PacsApiService.syncOrthanc();
      await loadData();
      setToastMessage('Sincronización completada exitosamente.');
    } catch {
      setToastMessage('Error al sincronizar con Orthanc.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleSaveConfig = async (newConfig: Partial<PACSConfig>) => {
    await PacsApiService.updatePacsConfig(newConfig);
    loadData();
  };

  const handleCreateUser = async (data: { name: string; email: string; role: string; password: string }) => {
    await PacsApiService.createUser(data);
    loadData();
  };

  const handleUpdateUser = async (id: string, data: { name?: string; email?: string; role?: string; password?: string }) => {
    await PacsApiService.updateUser(id, data);
    loadData();
  };

  const handleDeleteUser = async (id: string) => {
    await PacsApiService.deleteUser(id);
    loadData();
  };

  return (
    <div className="h-screen bg-[#F1F5F9] text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Header
        currentUser={currentUser}
        orthancOnline={orthancStatus?.online ?? true}
        pacsConfig={pacsConfig}
        isSyncing={isSyncing}
        onSyncOrthanc={handleSyncOrthanc}
        onLogout={handleLogout}
        onQuickSearch={handleQuickSearch}
        quickSearchTerm={quickSearchTerm}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabChange={tab => setActiveTab(tab)}
          userRole={currentUser.role}
          orthancOnline={orthancStatus?.online ?? false}
          remoteAETitle={pacsConfig?.remoteAETitle || ''}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-[#F1F5F9]">
          {activeTab === 'dashboard' && dashboardStats && (
            <DashboardView
              stats={dashboardStats}
              weeklyStats={weeklyStats?.days || null}
              pacsConfig={pacsConfig}
              orthancStatus={orthancStatus}
              onOpenStudyViewer={study => setStudyForViewer(study)}
              onNavigateTab={tab => setActiveTab(tab)}
            />
          )}

          {activeTab === 'patients' && (
            <PatientsView
              patients={patients}
              studies={studies}
              onCreatePatient={handleCreatePatient}
              onUpdatePatient={handleUpdatePatient}
              onDeletePatient={handleDeletePatient}
              onOpenStudyViewer={study => setStudyForViewer(study)}
            />
          )}

          {activeTab === 'studies' && (
            <StudiesView
              studies={studies}
              filters={studyFilters}
              onFilterChange={f => setStudyFilters(f)}
              onOpenViewer={study => setStudyForViewer(study)}
              onOpenTagsModal={study => setStudyForTags(study)}
              onUpdateStatus={handleUpdateStudyStatus}
            />
          )}

          {activeTab === 'orthanc' && orthancStatus && pacsConfig && (
            <OrthancSyncView
              status={orthancStatus}
              config={pacsConfig}
              isSyncing={isSyncing}
              onSyncNow={handleSyncOrthanc}
              onReceiveSimulatedStudy={() => loadData()}
            />
          )}

          {activeTab === 'audit' && (
            <AuditView
              logs={auditLogs}
              onFilterChange={(action, search) => {
                PacsApiService.getAuditLogs(action, search).then(res => setAuditLogs(res));
              }}
            />
          )}

          {activeTab === 'users' && (
            <UsersView
              users={usersList}
              activeUser={currentUser}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {activeTab === 'config' && pacsConfig && (
            <ConfigView
              config={pacsConfig}
              onSaveConfig={handleSaveConfig}
            />
          )}
        </main>
      </div>

      {studyForViewer && (
        <OhifViewerModal
          study={studyForViewer}
          onClose={() => setStudyForViewer(null)}
        />
      )}

      {studyForTags && (
        <DicomTagsModal
          study={studyForTags}
          onClose={() => setStudyForTags(null)}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
