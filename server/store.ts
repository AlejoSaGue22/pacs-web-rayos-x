import { PrismaClient } from '../src/generated/prisma/index.js';
import { OrthancClient } from './orthancClient.js';

const prisma = new PrismaClient();

class PacsStore {
  // --- Patients ---
  async getPatients(search?: string) {
    const where: any = { isDeleted: false };
    if (search && search.trim() !== '') {
      const term = search.toLowerCase().trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { documentNumber: { contains: term } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.patient.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async getPatientById(id: string) {
    return prisma.patient.findFirst({ where: { id, isDeleted: false } });
  }

  async createPatient(patientData: any, userId: string, userName: string, userRole: any) {
    const newId = `pat-${patientData.documentNumber}`;
    const now = new Date().toISOString();
    const newPatient = await prisma.patient.create({
      data: {
        id: newId,
        documentNumber: patientData.documentNumber,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        birthDate: patientData.birthDate || '',
        gender: patientData.gender || 'O',
        phone: patientData.phone || '',
        email: patientData.email || null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        studyCount: 0,
      },
    });

    await this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'PATIENT_CREATE',
      description: `Creación de nuevo paciente: ${newPatient.firstName} ${newPatient.lastName} (Doc: ${newPatient.documentNumber})`,
      ipAddress: '127.0.0.1',
    });

    return newPatient;
  }

  async updatePatient(id: string, updates: any, userId: string, userName: string, userRole: any) {
    const patient = await prisma.patient.findFirst({ where: { id, isDeleted: false } });
    if (!patient) return null;

    const updated = await prisma.patient.update({
      where: { id },
      data: { ...updates, updatedAt: new Date().toISOString() },
    });

    await this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'PATIENT_UPDATE',
      description: `Actualización de paciente ${updated.firstName} ${updated.lastName} (Doc: ${updated.documentNumber})`,
      ipAddress: '127.0.0.1',
    });

    return updated;
  }

  async deletePatient(id: string, userId: string, userName: string, userRole: any) {
    const patient = await prisma.patient.findFirst({ where: { id, isDeleted: false } });
    if (!patient) return false;

    await prisma.patient.update({
      where: { id },
      data: { isDeleted: true, updatedAt: new Date().toISOString() },
    });

    await this.addAuditLog({
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
  async getStudies(filters?: { searchTerm?: string; modality?: string; dateFrom?: string; dateTo?: string; status?: string }) {
    const where: any = {};

    if (filters) {
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase().trim();
        where.OR = [
          { patientName: { contains: term, mode: 'insensitive' } },
          { patientDocument: { contains: term } },
          { accessionNumber: { contains: term, mode: 'insensitive' } },
          { studyDescription: { contains: term, mode: 'insensitive' } },
          { id: { contains: term, mode: 'insensitive' } },
        ];
      }
      if (filters.modality && filters.modality !== 'ALL') {
        where.modality = filters.modality;
      }
      if (filters.status && filters.status !== 'ALL') {
        where.status = filters.status;
      }
      if (filters.dateFrom) {
        where.studyDate = { ...(where.studyDate || {}), gte: filters.dateFrom };
      }
      if (filters.dateTo) {
        where.studyDate = { ...(where.studyDate || {}), lte: filters.dateTo };
      }
    }

    const studies = await prisma.study.findMany({
      where,
      include: { series: { include: { instances: true } } },
      orderBy: [{ studyDate: 'desc' }, { studyTime: 'desc' }],
    });

    return studies;
  }

  async getStudyById(id: string) {
    return prisma.study.findUnique({
      where: { id },
      include: { series: { include: { instances: true } } },
    });
  }

  async updateStudyStatus(id: string, status: any, userId: string, userName: string, userRole: any) {
    const study = await prisma.study.findUnique({ where: { id } });
    if (!study) return null;

    const updated = await prisma.study.update({
      where: { id },
      data: { status },
      include: { series: { include: { instances: true } } },
    });

    await this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'STUDY_VIEW',
      description: `Cambio de estado del estudio ${study.accessionNumber} a "${status}"`,
      ipAddress: '127.0.0.1',
    });

    return updated;
  }

  // --- DICOM Instances ---
  async getInstanceById(instanceId: string) {
    const instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      include: {
        series: {
          include: {
            study: true,
          },
        },
      },
    });

    if (!instance) return null;

    return {
      study: instance.series.study,
      series: instance.series,
      instance: instance,
    };
  }

  // --- Orthanc Synchronization ---
  async syncWithOrthanc(userId: string, userName: string, userRole: any) {
    let syncedCount = 0;
    let online = false;

    try {
      const orthancStudies = await OrthancClient.getStudies();
      online = true;

      for (const orthancStudyId of orthancStudies) {
        const exists = await prisma.study.findUnique({ where: { id: orthancStudyId } });
        if (exists) continue;

        try {
          const fullStudy = await OrthancClient.getStudy(orthancStudyId);
          const studyTags = fullStudy.MainDicomTags || {};

          const studyInstanceIds = await this.getInstanceIdsForStudy(orthancStudyId);
          const firstInstId = studyInstanceIds.length > 0 ? studyInstanceIds[0] : null;

          const instanceTags = firstInstId
            ? await OrthancClient.getInstanceTags(firstInstId)
            : {};

          const patientId = instanceTags.PatientID || '';
          const patientName = instanceTags.PatientName || '';

          const existingPatient = await prisma.patient.findFirst({
            where: { documentNumber: patientId },
          });

          if (!existingPatient && patientId) {
            const pnParts = patientName ? patientName.split('^') : ['', ''];
            const now = new Date().toISOString();
            await prisma.patient.create({
              data: {
                id: `pat-${patientId}`,
                documentNumber: patientId,
                firstName: pnParts[1] || pnParts[0] || 'Desconocido',
                lastName: pnParts[0] || '',
                birthDate: instanceTags.PatientBirthDate || '',
                gender: instanceTags.PatientSex || 'O',
                phone: instanceTags.PatientPhone || '',
                email: null,
                createdAt: now,
                updatedAt: now,
                isDeleted: false,
                studyCount: 0,
              },
            });
          }

          const studyDate = studyTags.StudyDate
            ? `${studyTags.StudyDate.slice(0, 4)}-${studyTags.StudyDate.slice(4, 6)}-${studyTags.StudyDate.slice(6, 8)}`
            : '';
          const studyTimeStr = studyTags.StudyTime || '000000';
          const studyTime = `${studyTimeStr.slice(0, 2)}:${studyTimeStr.slice(2, 4)}:${studyTimeStr.slice(4, 6)}`;

          await prisma.study.create({
            data: {
              id: orthancStudyId,
              accessionNumber: studyTags.AccessionNumber || `ACC-${orthancStudyId.slice(-8)}`,
              studyInstanceUid: studyTags.StudyInstanceUID || '',
              patientId: patientId ? `pat-${patientId}` : '',
              patientDocument: patientId,
              patientName: patientName || '',
              patientSex: instanceTags.PatientSex || 'O',
              patientBirthDate: instanceTags.PatientBirthDate || '',
              studyDate,
              studyTime,
              studyDescription: studyTags.StudyDescription || '',
              modality: instanceTags.Modality || 'DX',
              referringPhysician: instanceTags.ReferringPhysicianName || '',
              performingTechnician: '',
              institutionName: studyTags.InstitutionName || instanceTags.InstitutionName || '',
              manufacturer: instanceTags.Manufacturer || '',
              manufacturerModelName: instanceTags.ManufacturerModelName || '',
              numberOfSeries: fullStudy.Series ? fullStudy.Series.length : 0,
              numberOfInstances: studyInstanceIds.length,
              status: 'Recibido',
              notes: null,
              createdAt: new Date().toISOString(),
            },
          });

          const seriesIds = fullStudy.Series || [];
          for (const seriesId of seriesIds) {
            try {
              const fullSeries = await OrthancClient.getSeries(seriesId);
              const seriesTags = fullSeries.MainDicomTags || {};

              await prisma.series.create({
                data: {
                  id: seriesId,
                  seriesNumber: parseInt(seriesTags.SeriesNumber || '1'),
                  seriesDescription: seriesTags.SeriesDescription || '',
                  modality: seriesTags.Modality || 'DX',
                  seriesInstanceUid: seriesTags.SeriesInstanceUID || '',
                  bodyPartExamined: seriesTags.BodyPartExamined || '',
                  numberOfInstances: fullSeries.Instances ? fullSeries.Instances.length : 0,
                  studyId: orthancStudyId,
                },
              });

              const instanceIds = fullSeries.Instances || [];
              for (const instId of instanceIds) {
                try {
                  const fullInst = await OrthancClient.getInstance(instId);
                  const tags = await OrthancClient.getInstanceTags(instId);
                  const instTags = fullInst.MainDicomTags || {};

                  await prisma.instance.create({
                    data: {
                      id: instId,
                      instanceNumber: parseInt(instTags.InstanceNumber || '1'),
                      sopInstanceUid: instTags.SOPInstanceUID || '',
                      numberOfFrames: parseInt(instTags.NumberOfFrames || '1'),
                      rows: parseInt(instTags.Rows || '512'),
                      columns: parseInt(instTags.Columns || '512'),
                      windowCenter: parseInt(instTags.WindowCenter || '2048'),
                      windowWidth: parseInt(instTags.WindowWidth || '4096'),
                      previewUrl: `/api/orthanc/instances/${instId}/preview`,
                      fileSize: 0,
                      tags: tags || {},
                      kvp: tags.KVP ? parseFloat(tags.KVP) : null,
                      exposureTimeMs: tags.ExposureTime ? parseInt(tags.ExposureTime) : null,
                      tubeCurrentMA: tags.XRayTubeCurrent ? parseInt(tags.XRayTubeCurrent) : null,
                      mAs: tags.Exposure ? parseFloat(tags.Exposure) : null,
                      viewPosition: tags.ViewPosition || null,
                      seriesId,
                    },
                  });
                } catch {
                  // skip individual instance errors
                }
              }
            } catch {
              // skip individual series errors
            }
          }

          syncedCount++;
        } catch {
          // skip individual study errors
        }
      }
    } catch {
      online = false;
    }

    const newSyncTime = new Date().toISOString();
    const studyCount = await prisma.study.count();

    await prisma.orthancStatus.upsert({
      where: { id: 1 },
      update: { lastSyncTime: newSyncTime, online },
      create: {
        id: 1, online, version: '', aetitle: 'ORTHANC', dicomPort: 4242, httpPort: 8042,
        storageUsageMb: 0, patientCount: 0, studyCount: 0, seriesCount: 0, instanceCount: 0,
        lastSyncTime: newSyncTime, connectedEquipment: [],
      },
    });

    await this.addAuditLog({
      userId, userName, userRole,
      action: 'ORTHANC_SYNC',
      description: `Sincronización con Servidor Orthanc. ${syncedCount} estudios nuevos importados.`,
      ipAddress: '127.0.0.1',
      details: `Servidor Orthanc: ${online ? 'en línea' : 'fuera de línea'}. Total estudios en BD: ${studyCount}.`,
    });

    return {
      success: online,
      timestamp: newSyncTime,
      syncedStudies: studyCount,
      newStudies: syncedCount,
    };
  }

  private async getInstanceIdsForStudy(studyId: string): Promise<string[]> {
    const instances = await OrthancClient.getInstancesOfStudy(studyId);
    if (!Array.isArray(instances)) return [];
    return instances.map((i: any) => i.ID || i);
  }

  // --- Audit Logs ---
  async getAuditLogs(actionFilter?: string, search?: string) {
    const where: any = {};

    if (actionFilter && actionFilter !== 'ALL') {
      where.action = actionFilter;
    }
    if (search && search.trim() !== '') {
      const term = search.toLowerCase().trim();
      where.OR = [
        { userName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { details: { contains: term, mode: 'insensitive' } },
      ];
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  async addAuditLog(entry: { userId: string; userName: string; userRole: any; action: string; description: string; ipAddress: string; details?: string }) {
    return prisma.auditLog.create({
      data: {
        id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        userId: entry.userId,
        userName: entry.userName,
        userRole: entry.userRole || 'Admin',
        action: entry.action,
        description: entry.description,
        ipAddress: entry.ipAddress,
        details: entry.details || null,
      },
    });
  }

  // --- Orthanc Status & Config ---
  async getOrthancStatus() {
    const status = await prisma.orthancStatus.findFirst();

    let systemInfo: any = {};
    try {
      systemInfo = await OrthancClient.getSystem();
    } catch {
      // Orthanc offline
    }

    const studyCount = await prisma.study.count();
    const patientCount = await prisma.patient.count({ where: { isDeleted: false } });
    const seriesCount = await prisma.series.count();
    const instanceCount = await prisma.instance.count();

    const connectedEquipment = status?.connectedEquipment || [];

    return {
      online: !!(systemInfo.ApiVersion),
      version: systemInfo.Version || (status?.version || ''),
      aetitle: systemInfo.DicomAet || (status?.aetitle || ''),
      dicomPort: systemInfo.DicomPort || (status?.dicomPort || 4242),
      httpPort: systemInfo.HttpPort || (status?.httpPort || 8042),
      storageUsageMb: status?.storageUsageMb || 0,
      patientCount,
      studyCount,
      seriesCount,
      instanceCount,
      lastSyncTime: status?.lastSyncTime || '',
      connectedEquipment,
    };
  }

  async getPacsConfig() {
    return prisma.pacsConfig.findFirst();
  }

  async updatePacsConfig(newConfig: any, userId: string, userName: string, userRole: any) {
    const updated = await prisma.pacsConfig.upsert({
      where: { id: 1 },
      update: { ...newConfig },
      create: { id: 1, ...newConfig },
    });

    await this.addAuditLog({
      userId,
      userName,
      userRole,
      action: 'CONFIG_UPDATE',
      description: 'Configuración general del PACS y AETitles actualizada',
      ipAddress: '127.0.0.1',
    });

    return updated;
  }

  // --- Users ---
  async getUsers() {
    return prisma.user.findMany();
  }
}

export const pacsStore = new PacsStore();
