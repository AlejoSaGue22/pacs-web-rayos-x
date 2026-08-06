import { Patient, DicomStudy, User, AuditLog, OrthancStatus, PACSConfig, StudyFilters, UserRole } from '../types/pacs';

const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('pacs_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export class PacsApiService {
  // Auth & Active User Session
  static getCurrentUser(): User {
    const saved = localStorage.getItem('pacs_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      id: 'anon',
      name: 'Invitado',
      email: '',
      role: 'Consulta',
    };
  }

  static setCurrentUser(user: User) {
    localStorage.setItem('pacs_user', JSON.stringify(user));
  }

  static getToken(): string | null {
    return localStorage.getItem('pacs_token');
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  static async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error de autenticación');
    }
    localStorage.setItem('pacs_token', data.token);
    this.setCurrentUser(data.user);
    return data;
  }

  static logout() {
    localStorage.removeItem('pacs_token');
    localStorage.removeItem('pacs_user');
  }

  static async switchRole(role: UserRole): Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/switch-role`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al cambiar rol');
    }
    localStorage.setItem('pacs_token', data.token);
    this.setCurrentUser(data.user);
    return data;
  }

  // Dashboard Stats
  static async getDashboardStats() {
    const res = await fetch(`${API_BASE}/dashboard/stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al cargar métricas del panel');
    return res.json();
  }

  static async getWeeklyStats() {
    const res = await fetch(`${API_BASE}/dashboard/weekly-stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al cargar estadísticas semanales');
    return res.json();
  }

  // Patients
  static async getPatients(search?: string): Promise<Patient[]> {
    const url = search ? `${API_BASE}/patients?search=${encodeURIComponent(search)}` : `${API_BASE}/patients`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al cargar pacientes');
    return res.json();
  }

  static async getPatientById(id: string): Promise<Patient & { studies: DicomStudy[] }> {
    const res = await fetch(`${API_BASE}/patients/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Paciente no encontrado');
    return res.json();
  }

  static async createPatient(patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'studyCount'>): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(patientData),
    });
    if (!res.ok) throw new Error('Error al crear paciente');
    return res.json();
  }

  static async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Error al actualizar paciente');
    return res.json();
  }

  static async deletePatient(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/patients/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
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

    const res = await fetch(`${API_BASE}/studies?${params.toString()}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al obtener estudios DICOM');
    return res.json();
  }

  static async getStudyById(id: string): Promise<DicomStudy> {
    const res = await fetch(`${API_BASE}/studies/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Estudio no encontrado');
    return res.json();
  }

  static async updateStudyStatus(id: string, status: DicomStudy['status']): Promise<DicomStudy> {
    const res = await fetch(`${API_BASE}/studies/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Error al cambiar estado del estudio');
    return res.json();
  }

  // Orthanc DICOM Integration
  static async getOrthancStatus(): Promise<OrthancStatus> {
    const res = await fetch(`${API_BASE}/orthanc/status`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error consultando el estado de Orthanc');
    return res.json();
  }

  static async syncOrthanc() {
    const res = await fetch(`${API_BASE}/orthanc/sync`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Error durante la sincronización con Orthanc');
    return res.json();
  }

  static async getInstanceTags(instanceId: string) {
    const res = await fetch(`${API_BASE}/orthanc/instances/${instanceId}/tags`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al obtener cabeceras DICOM de la instancia');
    return res.json();
  }

  // Audit Logs
  static async getAuditLogs(actionFilter?: string, search?: string): Promise<AuditLog[]> {
    const params = new URLSearchParams();
    if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
    if (search) params.append('search', search);

    const res = await fetch(`${API_BASE}/audit?${params.toString()}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error consultando bitácora de auditoría');
    return res.json();
  }

  // PACS Config
  static async getPacsConfig(): Promise<PACSConfig> {
    const res = await fetch(`${API_BASE}/config`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al obtener configuración');
    return res.json();
  }

  static async updatePacsConfig(config: Partial<PACSConfig>): Promise<PACSConfig> {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Error al guardar configuración');
    return res.json();
  }

  // Users
  static async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al obtener lista de usuarios');
    return res.json();
  }

  static async createUser(data: { name: string; email: string; role: string; password: string; avatar?: string }): Promise<User> {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al crear usuario');
    return result;
  }

  static async updateUser(id: string, data: { name?: string; email?: string; role?: string; password?: string; avatar?: string }): Promise<User> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al actualizar usuario');
    return result;
  }

  static async deleteUser(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al eliminar usuario');
  }
}
