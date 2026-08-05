import { Patient, DicomStudy, User, AuditLog, OrthancStatus, PACSConfig } from '../src/types/pacs.js';
import { INITIAL_USERS, INITIAL_PATIENTS, INITIAL_STUDIES, INITIAL_AUDIT_LOGS, INITIAL_ORTHANC_STATUS, INITIAL_PACS_CONFIG } from './mockData.js';

class PacsStore {
  private users: User[] = [...INITIAL_USERS];
  private patients: Patient[] = [...INITIAL_PATIENTS];
  private studies: DicomStudy[] = [...INITIAL_STUDIES];
  private auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  private orthancStatus: OrthancStatus = { ...INITIAL_ORTHANC_STATUS };
  private pacsConfig: PACSConfig = { ...INITIAL_PACS_CONFIG };

  // --- Patients ---
  getPatients(search?: string) {
    let result = this.patients.filter(p => !p.isDeleted);
    if (search && search.trim() !== '') {
      const term = search.toLowerCase().trim();
      result = result.filter(
        p =>
          p.firstName.toLowerCase().includes(term) ||
          p.lastName.toLowerCase().includes(term) ||
          p.documentNumber.includes(term) ||
          (p.email && p.email.toLowerCase().includes(term))
      );
    }
    return result;
  }

  getPatientById(id: string) {
    return this.patients.find(p => p.id === id && !p.isDeleted);
  }

  createPatient(patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'studyCount'>, userId: string, userName: string, userRole: any) {
    const newId = `pat-${patientData.documentNumber}`;
    const now = new Date().toISOString();
    const newPatient: Patient = {
      ...patientData,
      id: newId,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      studyCount: 0,
    };
    this.patients.unshift(newPatient);

    this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'PATIENT_CREATE',
      description: `Creación de nuevo paciente: ${newPatient.firstName} ${newPatient.lastName} (Doc: ${newPatient.documentNumber})`,
      ipAddress: '127.0.0.1',
    });

    return newPatient;
  }

  updatePatient(id: string, updates: Partial<Patient>, userId: string, userName: string, userRole: any) {
    const patient = this.patients.find(p => p.id === id);
    if (!patient) return null;

    Object.assign(patient, updates, { updatedAt: new Date().toISOString() });

    this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'PATIENT_UPDATE',
      description: `Actualización de paciente ${patient.firstName} ${patient.lastName} (Doc: ${patient.documentNumber})`,
      ipAddress: '127.0.0.1',
    });

    return patient;
  }

  deletePatient(id: string, userId: string, userName: string, userRole: any) {
    const patient = this.patients.find(p => p.id === id);
    if (!patient) return false;

    patient.isDeleted = true;
    patient.updatedAt = new Date().toISOString();

    this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'PATIENT_DELETE',
      description: `Eliminación lógica de paciente ${patient.firstName} ${patient.lastName} (Doc: ${patient.documentNumber})`,
      ipAddress: '127.0.0.1',
    });

    return true;
  }

  // --- Studies ---
  getStudies(filters?: { searchTerm?: string; modality?: string; dateFrom?: string; dateTo?: string; status?: string }) {
    let result = [...this.studies];

    if (filters) {
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase().trim();
        result = result.filter(
          s =>
            s.patientName.toLowerCase().includes(term) ||
            s.patientDocument.includes(term) ||
            s.accessionNumber.toLowerCase().includes(term) ||
            s.studyDescription.toLowerCase().includes(term) ||
            s.id.toLowerCase().includes(term)
        );
      }
      if (filters.modality && filters.modality !== 'ALL') {
        result = result.filter(s => s.modality === filters.modality);
      }
      if (filters.status && filters.status !== 'ALL') {
        result = result.filter(s => s.status === filters.status);
      }
      if (filters.dateFrom) {
        result = result.filter(s => s.studyDate >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        result = result.filter(s => s.studyDate <= filters.dateTo!);
      }
    }

    // Sort by date desc
    return result.sort((a, b) => new Date(`${b.studyDate}T${b.studyTime}`).getTime() - new Date(`${a.studyDate}T${a.studyTime}`).getTime());
  }

  getStudyById(id: string) {
    return this.studies.find(s => s.id === id);
  }

  updateStudyStatus(id: string, status: any, userId: string, userName: string, userRole: any) {
    const study = this.studies.find(s => s.id === id);
    if (!study) return null;

    study.status = status;

    this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'STUDY_VIEW',
      description: `Cambio de estado del estudio ${study.accessionNumber} a "${status}"`,
      ipAddress: '127.0.0.1',
    });

    return study;
  }

  // --- DICOM Instances ---
  getInstanceById(instanceId: string) {
    for (const study of this.studies) {
      for (const series of study.series) {
        const inst = series.instances.find(i => i.id === instanceId);
        if (inst) {
          return { study, series, instance: inst };
        }
      }
    }
    return null;
  }

  // --- Orthanc Synchronization ---
  syncWithOrthanc(userId: string, userName: string, userRole: any) {
    this.orthancStatus.lastSyncTime = new Date().toISOString();
    this.orthancStatus.online = true;

    // Add audit entry
    this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'ORTHANC_SYNC',
      description: `Sincronización manual ejecutada con Servidor Orthanc PACS (${this.pacsConfig.orthancServerUrl})`,
      ipAddress: '127.0.0.1',
      details: `Servidor Orthanc activo. AETitle Local: ${this.pacsConfig.localAETitle}. Modality Mindray AET: ${this.pacsConfig.remoteAETitle}`,
    });

    return {
      success: true,
      timestamp: this.orthancStatus.lastSyncTime,
      syncedStudies: this.studies.length,
      status: this.orthancStatus,
    };
  }

  // --- Audit Logs ---
  getAuditLogs(actionFilter?: string, search?: string) {
    let result = [...this.auditLogs];

    if (actionFilter && actionFilter !== 'ALL') {
      result = result.filter(l => l.action === actionFilter);
    }
    if (search && search.trim() !== '') {
      const term = search.toLowerCase().trim();
      result = result.filter(
        l =>
          l.userName.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term) ||
          (l.details && l.details.toLowerCase().includes(term))
      );
    }

    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  addAuditLog(entry: { userId: string; userName: string; userRole: any; action: AuditLog['action']; description: string; ipAddress: string; details?: string }) {
    const newLog: AuditLog = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.auditLogs.unshift(newLog);
  }

  // --- Orthanc Status & Config ---
  getOrthancStatus() {
    this.orthancStatus.studyCount = this.studies.length;
    this.orthancStatus.patientCount = this.getPatients().length;
    this.orthancStatus.seriesCount = this.studies.reduce((acc, s) => acc + s.numberOfSeries, 0);
    this.orthancStatus.instanceCount = this.studies.reduce((acc, s) => acc + s.numberOfInstances, 0);
    return this.orthancStatus;
  }

  getPacsConfig() {
    return this.pacsConfig;
  }

  updatePacsConfig(newConfig: Partial<PACSConfig>, userId: string, userName: string, userRole: any) {
    Object.assign(this.pacsConfig, newConfig);

    this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'CONFIG_UPDATE',
      description: 'Configuración general del PACS y AETitles actualizada',
      ipAddress: '127.0.0.1',
    });

    return this.pacsConfig;
  }

  // --- Users ---
  getUsers() {
    return this.users;
  }
}

export const pacsStore = new PacsStore();
