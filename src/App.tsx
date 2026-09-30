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


  const [studyForTags, setStudyForTags] = useState<DicomStudy | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [echoingModality, setEchoingModality] = useState<string | null>(null);

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
    
    // Cargar cada dato independientemente para que un fallo no rompa los demás
    try {
      const stats = await PacsApiService.getDashboardStats();
      setDashboardStats(stats);
    } catch (e: any) {
      console.error('Error cargando dashboard stats:', e);
    }

    try {
      const weekly = await PacsApiService.getWeeklyStats();
      setWeeklyStats(weekly);
    } catch (e: any) {
      console.error('Error cargando weekly stats:', e);
    }

    try {
      const orthanc = await PacsApiService.getOrthancStatus();
      setOrthancStatus(orthanc);
    } catch (e: any) {
      console.error('Error cargando orthanc status:', e);
    }

    try {
      const config = await PacsApiService.getPacsConfig();
      setPacsConfig(config);
    } catch (e: any) {
      console.error('Error cargando config:', e);
    }

    try {
      const users = await PacsApiService.getUsers();
      setUsersList(users);
    } catch (e: any) {
      console.error('Error cargando users:', e);
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

  const handleOpenViewer = (study: DicomStudy) => {
    const token = localStorage.getItem('pacs_token');
    const port = window.location.port ? `:${window.location.port}` : '';
    // En desarrollo local (vite 3000), asumimos que OHIF corre en el 80.
    // Si estamos en localhost, abrimos el localhost:80. Si es red, misma IP.
    const baseUrl = `${window.location.protocol}//${window.location.hostname}`;
    const ohifPort = ':80'; // Según el docker-compose
    const ohifUrl = `${baseUrl}${ohifPort}/viewer?StudyInstanceUIDs=${study.studyInstanceUid}&token=${token}`;
    window.location.href = ohifUrl;
  };

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
      const result = await PacsApiService.syncOrthanc();
      // Actualización optimista inmediata del timestamp sin esperar loadData
      setOrthancStatus(prev => prev
        ? { ...prev, lastSyncTime: result.timestamp, online: result.success }
        : prev
      );
      
      // Toast con datos reales del sync
      const estudiosMsg = result.newStudies > 0
        ? `${result.newStudies} estudio${result.newStudies > 1 ? 's' : ''} nuevo${result.newStudies > 1 ? 's' : ''} importado${result.newStudies > 1 ? 's' : ''}`
        : 'sin estudios nuevos';
      setToastMessage(`Sincronización completada: ${estudiosMsg} (${result.syncedStudies} totales en BD)`);
      
      // Recargar el resto de datos en background
      await loadData();
    } catch (e: any) {
      setToastMessage(`Error al sincronizar con Orthanc: ${e.message || 'Error desconocido'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleEchoModality = async (modalityName: string) => {
    setEchoingModality(modalityName);
    setToastMessage(`Ejecutando C-ECHO a "${modalityName}"...`);
    try {
      const result = await PacsApiService.echoModality(modalityName);
      setToastMessage(`C-ECHO exitoso a "${result.modality}". Equipo DICOM verificado.`);
      await loadData();
    } catch (e: any) {
      setToastMessage(`C-ECHO fallido a "${modalityName}": ${e.message || 'Error desconocido'}`);
      await loadData();
    } finally {
      setEchoingModality(null);
      setTimeout(() => setToastMessage(null), 4000);
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
        dicomVerified={orthancStatus?.dicom?.verified ?? false}
        dicomLastStoreAt={orthancStatus?.dicom?.lastStoreAt ?? null}
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
          dicomVerified={orthancStatus?.dicom?.verified ?? false}
          dicomLastStoreAt={orthancStatus?.dicom?.lastStoreAt ?? null}
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
                onOpenStudyViewer={handleOpenViewer}
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
              onOpenStudyViewer={handleOpenViewer}
            />
          )}

          {activeTab === 'studies' && (
            <StudiesView
              quickSearchTerm={quickSearchTerm}
              quickSearchKey={quickSearchKey}
              onOpenViewer={handleOpenViewer}
              onOpenTagsModal={study => setStudyForTags(study)}
            />
          )}

          {activeTab === 'orthanc' && (
            orthancStatus && pacsConfig ? (
              <OrthancSyncView
                status={orthancStatus}
                config={pacsConfig}
                isSyncing={isSyncing}
                echoingModality={echoingModality}
                onSyncNow={handleSyncOrthanc}
                onEchoModality={handleEchoModality}
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
