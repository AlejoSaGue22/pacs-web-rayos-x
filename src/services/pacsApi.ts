import { Patient, DicomStudy, User, AuditLog, OrthancStatus, PACSConfig, SyncResult } from '../types/pacs';
import { PaginatedResult, PatientQuery, StudyListQuery, AuditLogQuery } from '../types/pagination';

const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('pacs_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function buildQueryString(params: Record<string, any>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && String(v) !== 'NaN') {
      sp.append(k, String(v));
    }
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 401) {
    PacsApiService.logout();
    window.location.href = '/login';
  }
  return res;
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

  // Dashboard Stats
  static async getDashboardStats() {
    const res = await fetchWithAuth(`${API_BASE}/dashboard/stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al cargar métricas del panel');
    return res.json();
  }

  static async getWeeklyStats() {
    const res = await fetchWithAuth(`${API_BASE}/dashboard/weekly-stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al cargar estadísticas semanales');
    return res.json();
  }

  // Patients
  static async getPatients(query?: PatientQuery): Promise<PaginatedResult<Patient>> {
    const res = await fetchWithAuth(`${API_BASE}/patients${buildQueryString(query || {})}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al cargar pacientes');
    return res.json();
  }

  static async getPatientById(id: string): Promise<Patient & { studies: DicomStudy[] }> {
    const res = await fetchWithAuth(`${API_BASE}/patients/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Paciente no encontrado');
    return res.json();
  }

  static async getPatientStudies(patientId: string): Promise<DicomStudy[]> {
    const res = await fetchWithAuth(`${API_BASE}/patients/${patientId}/studies`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al cargar estudios del paciente');
    return res.json();
  }

  static async createPatient(patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'studyCount'>): Promise<Patient> {
    const res = await fetchWithAuth(`${API_BASE}/patients`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(patientData),
    });
    if (!res.ok) throw new Error('Error al crear paciente');
    return res.json();
  }

  static async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient> {
    const res = await fetchWithAuth(`${API_BASE}/patients/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Error al actualizar paciente');
    return res.json();
  }

  static async deletePatient(id: string): Promise<boolean> {
    const res = await fetchWithAuth(`${API_BASE}/patients/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Error al eliminar paciente');
    return true;
  }

  // Studies
  static async getStudies(query?: StudyListQuery): Promise<PaginatedResult<DicomStudy>> {
    const res = await fetchWithAuth(`${API_BASE}/studies${buildQueryString(query || {})}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al obtener estudios DICOM');
    return res.json();
  }

  static async getStudyById(id: string): Promise<DicomStudy> {
    const res = await fetchWithAuth(`${API_BASE}/studies/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Estudio no encontrado');
    return res.json();
  }

  static async updateStudyStatus(id: string, status: DicomStudy['status']): Promise<DicomStudy> {
    const res = await fetchWithAuth(`${API_BASE}/studies/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Error al cambiar estado del estudio');
    return res.json();
  }

  // Orthanc DICOM Integration
  static async getOrthancStatus(): Promise<OrthancStatus> {
    const res = await fetchWithAuth(`${API_BASE}/orthanc/status`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error consultando el estado de Orthanc');
    return res.json();
  }

  static async syncOrthanc(): Promise<SyncResult> {
    const res = await fetchWithAuth(`${API_BASE}/orthanc/sync`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Error durante la sincronización con Orthanc');
    return res.json();
  }

  static async getInstanceTags(instanceId: string) {
    const res = await fetchWithAuth(`${API_BASE}/orthanc/instances/${instanceId}/tags`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al obtener cabeceras DICOM de la instancia');
    return res.json();
  }

  // Audit Logs
  static async getAuditLogs(query?: AuditLogQuery): Promise<PaginatedResult<AuditLog>> {
    const res = await fetchWithAuth(`${API_BASE}/audit${buildQueryString(query || {})}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error consultando bitácora de auditoría');
    return res.json();
  }

  // PACS Config
  static async getPacsConfig(): Promise<PACSConfig> {
    const res = await fetchWithAuth(`${API_BASE}/config`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al obtener configuración');
    return res.json();
  }

  static async updatePacsConfig(config: Partial<PACSConfig>): Promise<PACSConfig> {
    const res = await fetchWithAuth(`${API_BASE}/config`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Error al guardar configuración');
    return res.json();
  }

  // Users
  static async getUsers(): Promise<User[]> {
    const res = await fetchWithAuth(`${API_BASE}/users`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Error al obtener lista de usuarios');
    return res.json();
  }

  static async createUser(data: { name: string; email: string; role: string; password: string; avatar?: string }): Promise<User> {
    const res = await fetchWithAuth(`${API_BASE}/users`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al crear usuario');
    return result;
  }

  static async updateUser(id: string, data: { name?: string; email?: string; role?: string; password?: string; avatar?: string }): Promise<User> {
    const res = await fetchWithAuth(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al actualizar usuario');
    return result;
  }

  static async deleteUser(id: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al eliminar usuario');
  }

  // Export
  static getPdfDownloadUrl(studyId: string): string {
    return `${API_BASE}/studies/${studyId}/export/pdf`;
  }

  static getZipDownloadUrl(studyId: string): string {
    return `${API_BASE}/studies/${studyId}/export/zip`;
  }

  static getDicomDownloadUrl(instanceId: string): string {
    return `${API_BASE}/instances/${instanceId}/dicom`;
  }

  static async triggerDownload(url: string, filename: string) {
    try {
      const res = await fetchWithAuth(url, { headers: authHeaders() });
      if (!res.ok) throw new Error('Error en la descarga');
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000);
    } catch (e) {
      console.error('Error al descargar archivo:', e);
      alert('No se pudo descargar el archivo.');
    }
  }
}
