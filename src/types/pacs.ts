export type UserRole = 'Admin' | 'Radiologo' | 'Tecnico' | 'Consulta';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  lastLogin?: string;
}

export interface Patient {
  id: string;
  documentNumber: string; // Cedula / DNI / Passport
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: 'M' | 'F' | 'O';
  phone: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  studyCount?: number;
}

export interface DicomTag {
  tag: string; // e.g. "(0008,0060)"
  name: string; // e.g. "Modality"
  vr: string; // e.g. "CS"
  value: string | number;
}

export interface DicomInstance {
  id: string; // Orthanc Instance ID
  instanceNumber: number;
  sopInstanceUid: string;
  numberOfFrames: number;
  rows: number;
  columns: number;
  windowCenter: number;
  windowWidth: number;
  previewUrl: string; // API URL to render/fetch PNG/JPEG
  fileSize: number;
  tags: DicomTag[];
  kvp?: number;
  exposureTimeMs?: number;
  tubeCurrentMA?: number;
  mAs?: number;
  viewPosition?: string; // AP, PA, LAT, OBL
}

export interface DicomSeries {
  id: string; // Orthanc Series ID
  seriesNumber: number;
  seriesDescription: string;
  modality: 'DX' | 'CR' | 'CT' | 'MR' | 'US';
  seriesInstanceUid: string;
  bodyPartExamined: string; // CHEST, KNEE, SPINE, HAND, SKULL, ANKLE
  numberOfInstances: number;
  instances: DicomInstance[];
}

export type StudyStatus = 'Recibido' | 'En Revisión' | 'Informado' | 'Archivado';

export interface DicomStudy {
  id: string; // Orthanc Study ID
  accessionNumber: string;
  studyInstanceUid: string;
  patientId: string; // References Patient.id or DICOM PatientID
  patientDocument: string;
  patientName: string;
  patientSex: 'M' | 'F' | 'O';
  patientBirthDate: string;
  studyDate: string; // YYYY-MM-DD
  studyTime: string; // HH:mm:ss
  studyDescription: string;
  modality: 'DX' | 'CR' | 'CT' | 'MR' | 'US';
  referringPhysician: string;
  performingTechnician: string;
  institutionName: string; // "Consultorio de Rayos X - Mindray DigiEye 330"
  manufacturer: string; // "Mindray"
  manufacturerModelName: string; // "DigiEye 330 Series"
  numberOfSeries: number;
  numberOfInstances: number;
  status: StudyStatus;
  series: DicomSeries[];
  notes?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'LOGIN' | 'PATIENT_CREATE' | 'PATIENT_UPDATE' | 'PATIENT_DELETE' | 'STUDY_VIEW' | 'STUDY_DOWNLOAD' | 'ORTHANC_SYNC' | 'CONFIG_UPDATE' | 'ERROR';
  description: string;
  ipAddress: string;
  details?: string;
}

export interface OrthancStatus {
  online: boolean;
  version: string;
  aetitle: string;
  dicomPort: number;
  httpPort: number;
  storageUsageMb: number;
  patientCount: number;
  studyCount: number;
  seriesCount: number;
  instanceCount: number;
  lastSyncTime: string;
  connectedEquipment: {
    name: string;
    aetitle: string;
    ip: string;
    port: number;
    status: 'ACTIVE' | 'IDLE' | 'OFFLINE';
  }[];
}

export interface PACSConfig {
  orthancServerUrl: string;
  localAETitle: string;
  remoteAETitle: string; // MINDRAY_DROC
  remoteIp: string;
  remotePort: number;
  autoSyncIntervalSec: number;
  retentionDays: number;
  anonymizeExportDefault: boolean;
  institutionName: string;
}

export interface StudyFilters {
  searchTerm: string; // Patient name, ID, Accession
  modality: string;
  dateFrom: string;
  dateTo: string;
  status: string;
}
