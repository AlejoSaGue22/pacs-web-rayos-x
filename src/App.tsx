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
import { ConfigWarningBanner } from './components/common/ConfigWarningBanner';
import { OhifViewerModal } from './components/viewer/OhifViewerModal';
import { DicomTagsModal } from './components/studies/DicomTagsModal';
import { LoginPage } from './components/auth/LoginPage';
import { PacsApiService } from './services/pacsApi';
import { DicomStudy, User, OrthancStatus, PACSConfig } from './types/pacs';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<User>(PacsApiService.getCurrentUser());

  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [weeklyStats, setWeeklyStats] = useState<{ days: { day: string; estudios: number }[] } | null>(null);
  const [orthancStatus, setOrthancStatus] = useState<OrthancStatus | null>(null);
  const [pacsConfig, setPacsConfig] = useState<PACSConfig | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [dismissWarningBanner, setDismissWarningBanner] = useState(false);

  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const [quickSearchKey, setQuickSearchKey] = useState(0);

  const [studyForViewer, setStudyForViewer] = useState<DicomStudy | null>(null);
  const [studyForTags, setStudyForTags] = useState<DicomStudy | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const loadData = async () => {
    if (!PacsApiService.isAuthenticated()) return;
    try {
      const [stats, weekly, orthanc, config, users] = await Promise.all([
        PacsApiService.getDashboardStats(),
        PacsApiService.getWeeklyStats(),
        PacsApiService.getOrthancStatus(),
        PacsApiService.getPacsConfig(),
        PacsApiService.getUsers(),
      ]);

      setDashboardStats(stats);
      setWeeklyStats(weekly);
      setOrthancStatus(orthanc);
      setPacsConfig(config);
      setUsersList(users);
    } catch (e: any) {
      console.error('Error cargando datos PACS:', e);
      setToastMessage(e.message || 'Error de conexión. Sesión terminada.');
      setTimeout(() => {
        handleLogout();
      }, 2500);
    }
  };

  useEffect(() => {
    if (PacsApiService.isAuthenticated()) {
      setCurrentUser(PacsApiService.getCurrentUser());
      loadData();
    }
  }, []);

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
    setQuickSearchKey(k => k + 1);
    if (activeTab !== 'studies' && activeTab !== 'patients') {
      setActiveTab('studies');
    }
  };

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
        orthancOnline={orthancStatus?.online ?? false}
        pacsConfig={pacsConfig}
        isSyncing={isSyncing}
        onSyncOrthanc={handleSyncOrthanc}
        onLogout={handleLogout}
        onQuickSearch={handleQuickSearch}
        quickSearchTerm={quickSearchTerm}
      />

      {pacsConfig && !pacsConfig.isConfigured && !dismissWarningBanner && (
        <ConfigWarningBanner
          userRole={currentUser.role}
          onNavigateToConfig={() => setActiveTab('config')}
          onDismiss={() => setDismissWarningBanner(true)}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabChange={tab => setActiveTab(tab)}
          userRole={currentUser.role}
          orthancOnline={orthancStatus?.online ?? false}
          remoteAETitle={pacsConfig?.remoteAETitle || ''}
          isConfigured={pacsConfig?.isConfigured ?? false}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-[#F1F5F9]">
          {activeTab === 'dashboard' && (
            dashboardStats ? (
              <DashboardView
                stats={dashboardStats}
                weeklyStats={weeklyStats?.days || null}
                pacsConfig={pacsConfig}
                orthancStatus={orthancStatus}
                onOpenStudyViewer={study => setStudyForViewer(study)}
                onNavigateTab={tab => setActiveTab(tab)}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                Cargando panel de control...
              </div>
            )
          )}

          {activeTab === 'patients' && (
            <PatientsView
              onOpenStudyViewer={study => setStudyForViewer(study)}
            />
          )}

          {activeTab === 'studies' && (
            <StudiesView
              quickSearchTerm={quickSearchTerm}
              quickSearchKey={quickSearchKey}
              onOpenViewer={study => setStudyForViewer(study)}
              onOpenTagsModal={study => setStudyForTags(study)}
            />
          )}

          {activeTab === 'orthanc' && (
            orthancStatus && pacsConfig ? (
              <OrthancSyncView
                status={orthancStatus}
                config={pacsConfig}
                isSyncing={isSyncing}
                onSyncNow={handleSyncOrthanc}
                onReceiveSimulatedStudy={() => loadData()}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                Cargando estado del servidor...
              </div>
            )
          )}

          {activeTab === 'audit' && (
            <AuditView />
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

          {activeTab === 'config' && (
            pacsConfig ? (
              <ConfigView
                config={pacsConfig}
                onSaveConfig={handleSaveConfig}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
                Cargando configuración...
              </div>
            )
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
