import React, { useState, useEffect } from 'react';
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
import { LoginModal } from './components/auth/LoginModal';
import { PacsApiService } from './services/pacsApi';
import {
  Patient,
  DicomStudy,
  User,
  AuditLog,
  OrthancStatus,
  PACSConfig,
  StudyFilters,
  UserRole,
  StudyStatus,
} from './types/pacs';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<User>(PacsApiService.getCurrentUser());

  // Data States
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [studies, setStudies] = useState<DicomStudy[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [orthancStatus, setOrthancStatus] = useState<OrthancStatus | null>(null);
  const [pacsConfig, setPacsConfig] = useState<PACSConfig | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);

  // Search & Filter state
  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const [studyFilters, setStudyFilters] = useState<StudyFilters>({
    searchTerm: '',
    modality: 'ALL',
    dateFrom: '',
    dateTo: '',
    status: 'ALL',
  });

  // Active Modals
  const [studyForViewer, setStudyForViewer] = useState<DicomStudy | null>(null);
  const [studyForTags, setStudyForTags] = useState<DicomStudy | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Load Initial Data
  const loadData = async () => {
    try {
      const [stats, pats, stds, logs, orthanc, config, users] = await Promise.all([
        PacsApiService.getDashboardStats(),
        PacsApiService.getPatients(),
        PacsApiService.getStudies(studyFilters),
        PacsApiService.getAuditLogs(),
        PacsApiService.getOrthancStatus(),
        PacsApiService.getPacsConfig(),
        PacsApiService.getUsers(),
      ]);

      setDashboardStats(stats);
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
    loadData();
  }, [studyFilters]);

  // Handle Quick Search input
  const handleQuickSearch = (term: string) => {
    setQuickSearchTerm(term);
    setStudyFilters(prev => ({ ...prev, searchTerm: term }));
    if (activeTab !== 'studies' && activeTab !== 'patients') {
      setActiveTab('studies');
    }
  };

  // Patients Actions
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

  // Studies Actions
  const handleUpdateStudyStatus = async (studyId: string, status: StudyStatus) => {
    await PacsApiService.updateStudyStatus(studyId, status);
    loadData();
  };

  // Orthanc Actions
  const handleSyncOrthanc = async () => {
    await PacsApiService.syncOrthanc();
    loadData();
  };

  // Config Actions
  const handleSaveConfig = async (newConfig: Partial<PACSConfig>) => {
    await PacsApiService.updatePacsConfig(newConfig);
    loadData();
  };

  // Role Switch
  const handleSwitchRole = async (role: UserRole) => {
    const newUser = await PacsApiService.switchRole(role);
    setCurrentUser(newUser);
    loadData();
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Application Header */}
      <Header
        currentUser={currentUser}
        orthancOnline={orthancStatus?.online ?? true}
        onSyncOrthanc={handleSyncOrthanc}
        onOpenLoginModal={() => setShowLoginModal(true)}
        onQuickSearch={handleQuickSearch}
        quickSearchTerm={quickSearchTerm}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={tab => setActiveTab(tab)}
          userRole={currentUser.role}
        />

        {/* Primary View Content Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#F1F5F9]">
          {activeTab === 'dashboard' && dashboardStats && (
            <DashboardView
              stats={dashboardStats}
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
              onSwitchRole={handleSwitchRole}
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

      {/* OHIF Viewer Modal */}
      {studyForViewer && (
        <OhifViewerModal
          study={studyForViewer}
          onClose={() => setStudyForViewer(null)}
        />
      )}

      {/* DICOM Tags Modal */}
      {studyForTags && (
        <DicomTagsModal
          study={studyForTags}
          onClose={() => setStudyForTags(null)}
        />
      )}

      {/* Login / Role Switch Modal */}
      {showLoginModal && (
        <LoginModal
          users={usersList}
          activeUser={currentUser}
          onSelectRole={handleSwitchRole}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}
