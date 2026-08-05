import { Patient, DicomStudy, User, AuditLog, OrthancStatus, PACSConfig, StudyFilters, UserRole } from '../types/pacs';

const API_BASE = '/api';

export class PacsApiService {
  // Auth & Active User Session
  static getCurrentUser(): User {
    const saved = localStorage.getItem('pacs_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {
      id: 'usr-002',
      name: 'Dra. Patricia Gómez',
      email: 'pgomez@rayosx.med.co',
      role: 'Radiologo',
      avatar: 'https://images.unsplash.com/photo-1594824813566-88855ce78906?w=150&auto=format&fit=crop&q=80',
    };
  }

  static setCurrentUser(user: User) {
    localStorage.setItem('pacs_user', JSON.stringify(user));
  }

  static async switchRole(role: UserRole): Promise<User> {
    try {
      const res = await fetch(`${API_BASE}/auth/switch-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      this.setCurrentUser(data.user);
      return data.user;
    } catch (e) {
      const fallbackUser: User = {
        id: `usr-${role.toLowerCase()}`,
        name: `Usuario ${role}`,
        email: `${role.toLowerCase()}@rayosx.med.co`,
        role,
      };
      this.setCurrentUser(fallbackUser);
      return fallbackUser;
    }
  }

  // Dashboard Stats
  static async getDashboardStats() {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    if (!res.ok) throw new Error('Error al cargar métricas del panel');
    return res.json();
  }

  // Patients
  static async getPatients(search?: string): Promise<Patient[]> {
    const url = search ? `${API_BASE}/patients?search=${encodeURIComponent(search)}` : `${API_BASE}/patients`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al cargar pacientes');
    return res.json();
  }

  static async getPatientById(id: string): Promise<Patient & { studies: DicomStudy[] }> {
    const res = await fetch(`${API_BASE}/patients/${id}`);
    if (!res.ok) throw new Error('Paciente no encontrado');
    return res.json();
  }

  static async createPatient(patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'studyCount'>): Promise<Patient> {
    const user = this.getCurrentUser();
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...patientData,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
      }),
    });
    if (!res.ok) throw new Error('Error al crear paciente');
    return res.json();
  }

  static async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient> {
    const user = this.getCurrentUser();
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updates,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
      }),
    });
    if (!res.ok) throw new Error('Error al actualizar paciente');
    return res.json();
  }

  static async deletePatient(id: string): Promise<boolean> {
    const user = this.getCurrentUser();
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
      }),
    });
    if (!res.ok) throw new Error('Error al eliminar paciente');
    return true;
  }

  // Studies
  static async getStudies(filters?: StudyFilters): Promise<DicomStudy[]> {
    const params = new URLSearchParams();
    if (filters?.searchTerm) params.append('searchTerm', filters.searchTerm);
    if (filters?.modality && filters.modality !== 'ALL') params.append('modality', filters.modality);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);

    const res = await fetch(`${API_BASE}/studies?${params.toString()}`);
    if (!res.ok) throw new Error('Error al obtener estudios DICOM');
    return res.json();
  }

  static async getStudyById(id: string): Promise<DicomStudy> {
    const user = this.getCurrentUser();
    const res = await fetch(`${API_BASE}/studies/${id}?userId=${user.id}&userName=${encodeURIComponent(user.name)}&userRole=${user.role}`);
    if (!res.ok) throw new Error('Estudio no encontrado');
    return res.json();
  }

  static async updateStudyStatus(id: string, status: DicomStudy['status']): Promise<DicomStudy> {
    const user = this.getCurrentUser();
    const res = await fetch(`${API_BASE}/studies/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
      }),
    });
    if (!res.ok) throw new Error('Error al cambiar estado del estudio');
    return res.json();
  }

  // Orthanc DICOM Integration
  static async getOrthancStatus(): Promise<OrthancStatus> {
    const res = await fetch(`${API_BASE}/orthanc/status`);
    if (!res.ok) throw new Error('Error consultando el estado de Orthanc');
    return res.json();
  }

  static async syncOrthanc() {
    const user = this.getCurrentUser();
    const res = await fetch(`${API_BASE}/orthanc/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
      }),
    });
    if (!res.ok) throw new Error('Error durante la sincronización con Orthanc');
    return res.json();
  }

  static async getInstanceTags(instanceId: string) {
    const res = await fetch(`${API_BASE}/orthanc/instances/${instanceId}/tags`);
    if (!res.ok) throw new Error('Error al obtener cabeceras DICOM de la instancia');
    return res.json();
  }

  // Audit Logs
  static async getAuditLogs(actionFilter?: string, search?: string): Promise<AuditLog[]> {
    const params = new URLSearchParams();
    if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
    if (search) params.append('search', search);

    const res = await fetch(`${API_BASE}/audit?${params.toString()}`);
    if (!res.ok) throw new Error('Error consultando bitácora de auditoría');
    return res.json();
  }

  // PACS Config
  static async getPacsConfig(): Promise<PACSConfig> {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error('Error al obtener configuración');
    return res.json();
  }

  static async updatePacsConfig(config: Partial<PACSConfig>): Promise<PACSConfig> {
    const user = this.getCurrentUser();
    const res = await fetch(`${API_BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...config,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
      }),
    });
    if (!res.ok) throw new Error('Error al guardar configuración');
    return res.json();
  }

  // Users
  static async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`);
    if (!res.ok) throw new Error('Error al obtener lista de usuarios');
    return res.json();
  }
}
