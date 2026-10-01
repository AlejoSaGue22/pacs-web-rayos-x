import { PrismaClient } from '../src/generated/prisma/index.js';
import { OrthancClient } from './orthancClient.js';
import { parsePagination, buildOrderBy, buildPaginatedResult } from './pagination.js';
import { exportStudyToLocalDisk, resolveStudyDiskPath } from './localDiskExporter.js';
import fs from 'node:fs';

export const prisma = new PrismaClient();

// Cache en memoria del último C-ECHO por modalidad (no requiere migración).
// echoStatus: 'UNKNOWN' = nunca probado, 'OK' = C-ECHO exitoso, 'FAILED' = falló.
interface EchoCacheEntry {
  status: 'UNKNOWN' | 'OK' | 'FAILED';
  time: string;
  error: string | null;
}
const echoCache = new Map<string, EchoCacheEntry>();

function parseOrthancDate(raw: string): string | null {
  // Orthanc devuelve fechas como "20260101T120000" en hora LOCAL del servidor Orthanc.
  // No asumir Z (UTC): parsear como hora local y convertir a ISO.
  if (!raw) return null;
  if (raw.includes('T') && /^\d{8}T\d{6}/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const hh = raw.slice(9, 11);
    const mm = raw.slice(11, 13);
    const ss = raw.slice(13, 15);
    const parsed = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
    return null;
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// IDs que nunca son modalidades reales (fallbacks de UI). Rechazarlos con mensaje claro.
const INVALID_MODALITY_IDS = new Set(['', 'unknown', 'dicom device', 'dicom_device', 'n/d', '—', '-']);

class PacsStore {
  // --- Patients ---
  async getPatients(query?: { search?: string; page?: number; pageSize?: number; sortBy?: string; sortOrder?: string }) {
    const where: any = { isDeleted: false };
    if (query?.search && query.search.trim() !== '') {
      const term = query.search.toLowerCase().trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { documentNumber: { contains: term } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const { page, pageSize, skip, take } = parsePagination(query || {});
    const orderBy = buildOrderBy('patient', query?.sortBy, query?.sortOrder);

    const [items, total] = await prisma.$transaction([
      prisma.patient.findMany({ where, skip, take, orderBy, include: { _count: { select: { studies: true } } } }),
      prisma.patient.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
  }

  async getStudiesByPatientDocument(documentNumber: string) {
    return prisma.study.findMany({
      where: { patientDocument: documentNumber },
      include: { series: { include: { instances: true } } },
      orderBy: [{ studyDate: 'desc' }, { studyTime: 'desc' }],
    });
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
  async getStudies(query?: { searchTerm?: string; modality?: string; dateFrom?: string; dateTo?: string; status?: string; page?: number; pageSize?: number; sortBy?: string; sortOrder?: string }) {
    const where: any = {};

    if (query) {
      if (query.searchTerm) {
        const term = query.searchTerm.toLowerCase().trim();
        where.OR = [
          { patientName: { contains: term, mode: 'insensitive' } },
          { patientDocument: { contains: term } },
          { accessionNumber: { contains: term, mode: 'insensitive' } },
          { studyDescription: { contains: term, mode: 'insensitive' } },
          { id: { contains: term, mode: 'insensitive' } },
        ];
      }
      if (query.modality && query.modality !== 'ALL') {
        where.modality = query.modality;
      }
      if (query.status && query.status !== 'ALL') {
        where.status = query.status;
      }
      if (query.dateFrom) {
        where.studyDate = { ...(where.studyDate || {}), gte: query.dateFrom };
      }
      if (query.dateTo) {
        where.studyDate = { ...(where.studyDate || {}), lte: query.dateTo };
      }
    }

    const { page, pageSize, skip, take } = parsePagination(query || {});
    const orderBy = buildOrderBy('study', query?.sortBy, query?.sortOrder);

    const [items, total] = await prisma.$transaction([
      prisma.study.findMany({ where, skip, take, orderBy, include: { series: { include: { instances: true } } } }),
      prisma.study.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
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

  async getInstanceBySopInstanceUid(sopInstanceUid: string) {
    return prisma.instance.findFirst({
      where: { sopInstanceUid },
    });
  }

  // --- Orthanc Synchronization ---
  async syncWithOrthanc(userId: string, userName: string, userRole: any) {
    let syncedCount = 0;
    let exportedToDisk = 0;
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

          try {
            const token = Buffer.from(`${process.env.ORTHANC_USER}:${process.env.ORTHANC_PASS}`).toString('base64');
            const authHeader = `Basic ${token}`;
            const orthancUrl = process.env.ORTHANC_URL || 'http://localhost:8042';

            const diskPath = await exportStudyToLocalDisk({
              orthancStudyId,
              patientName,
              patientDocument: patientId,
              studyDate,
              studyDescription: studyTags.StudyDescription || '',
              accessionNumber: studyTags.AccessionNumber || `ACC-${orthancStudyId.slice(-8)}`,
              modality: instanceTags.Modality || 'DX',
              studyInstanceUid: studyTags.StudyInstanceUID || '',
              numberOfSeries: fullStudy.Series ? fullStudy.Series.length : 0,
              numberOfInstances: studyInstanceIds.length,
            }, orthancUrl, authHeader);
            if (diskPath) exportedToDisk++;
          } catch (exportErr) {
            console.error(`[Sync] Error exportando estudio localmente:`, exportErr);
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
      description: `Sincronización con Servidor Orthanc. ${syncedCount} estudios nuevos importados (${exportedToDisk} respaldados en disco).`,
      ipAddress: '127.0.0.1',
      details: `Servidor Orthanc: ${online ? 'en línea' : 'fuera de línea'}. Total estudios en BD: ${studyCount}. Respaldos en disco: ${exportedToDisk}.`,
    });

    return {
      success: online,
      timestamp: newSyncTime,
      syncedStudies: studyCount,
      newStudies: syncedCount,
      exportedToDisk,
    };
  }

  /**
   * Re-exporta al disco los estudios que están en BD pero sin carpeta local
   * (p. ej. importados antes de activar el respaldo, o si se borró C:/MiniPACS).
   * Idempotente: omite los que ya tienen carpeta.
   */
  async reexportMissingToDisk(userId: string, userName: string, userRole: any) {
    const studies = await prisma.study.findMany({
      orderBy: [{ studyDate: 'desc' }],
      take: 500,
    });
    const token = Buffer.from(`${process.env.ORTHANC_USER}:${process.env.ORTHANC_PASS}`).toString('base64');
    const authHeader = `Basic ${token}`;
    const orthancUrl = process.env.ORTHANC_URL || 'http://localhost:8042';

    let checked = 0;
    let exported = 0;
    let skipped = 0;
    let failed = 0;

    for (const s of studies) {
      checked++;
      const diskPath = resolveStudyDiskPath({
        orthancStudyId: s.id,
        patientName: s.patientName,
        patientDocument: s.patientDocument,
        studyDate: s.studyDate,
        studyDescription: s.studyDescription,
        accessionNumber: s.accessionNumber,
        modality: s.modality,
        studyInstanceUid: s.studyInstanceUid,
        numberOfSeries: s.numberOfSeries,
        numberOfInstances: s.numberOfInstances,
      });
      if (fs.existsSync(diskPath)) {
        skipped++;
        continue;
      }
      const result = await exportStudyToLocalDisk({
        orthancStudyId: s.id,
        patientName: s.patientName,
        patientDocument: s.patientDocument,
        studyDate: s.studyDate,
        studyDescription: s.studyDescription,
        accessionNumber: s.accessionNumber,
        modality: s.modality,
        studyInstanceUid: s.studyInstanceUid,
        numberOfSeries: s.numberOfSeries,
        numberOfInstances: s.numberOfInstances,
      }, orthancUrl, authHeader);
      if (result) exported++;
      else failed++;
    }

    await this.addAuditLog({
      userId, userName, userRole,
      action: 'ORTHANC_SYNC',
      description: `Re-exportación a disco: ${exported} restaurados, ${skipped} ya existían, ${failed} fallidos (de ${checked} revisados).`,
      ipAddress: '127.0.0.1',
    });

    return { checked, exported, skipped, failed };
  }

  private async getInstanceIdsForStudy(studyId: string): Promise<string[]> {
    const instances = await OrthancClient.getInstancesOfStudy(studyId);
    if (!Array.isArray(instances)) return [];
    return instances.map((i: any) => i.ID || i);
  }

  // --- Audit Logs ---
  async getAuditLogs(query?: { actionFilter?: string; search?: string; page?: number; pageSize?: number; sortBy?: string; sortOrder?: string }) {
    const where: any = {};

    if (query?.actionFilter && query.actionFilter !== 'ALL') {
      where.action = query.actionFilter;
    }
    if (query?.search && query.search.trim() !== '') {
      const term = query.search.toLowerCase().trim();
      where.OR = [
        { userName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { details: { contains: term, mode: 'insensitive' } },
      ];
    }

    const { page, pageSize, skip, take } = parsePagination(query || {});
    const orderBy = buildOrderBy('audit', query?.sortBy, query?.sortOrder);

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({ where, skip, take, orderBy }),
      prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
  }

  async addAuditLog(entry: { userId: string | null; userName: string; userRole: any; action: string; description: string; ipAddress: string; details?: string }) {
    // userId tiene FK a User: 'system' u otros IDs inexistentes rompen el sync automático (P2003).
    // Se valida y se cae a null (columna nullable) para actores de sistema/webhook/auto.
    let safeUserId: string | null = entry.userId || null;
    if (safeUserId) {
      try {
        const exists = await prisma.user.findUnique({ where: { id: safeUserId }, select: { id: true } });
        if (!exists) safeUserId = null;
      } catch {
        safeUserId = null;
      }
    }
    return prisma.auditLog.create({
      data: {
        id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        userId: safeUserId,
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
  /**
   * Lista normalizada de modalidades DICOM registradas en Orthanc.
   * Reutilizada por getOrthancStatus, testDicomEcho y GET /api/orthanc/modalities.
   */
  async listModalities() {
    let modalitiesRaw: any = null;
    try {
      modalitiesRaw = await OrthancClient.getModalitiesExpand();
    } catch {
      modalitiesRaw = await OrthancClient.getModalities();
    }
    const entries: { id: string; detail: any; hasDetail: boolean }[] = [];
    if (Array.isArray(modalitiesRaw)) {
      for (const item of modalitiesRaw) {
        if (typeof item === 'string' && item.trim() !== '') {
          entries.push({ id: item.trim(), detail: {}, hasDetail: false });
        } else if (item && typeof item === 'object') {
          const id = String(item.SymbolicName || item.AET || item.ID || '').trim();
          if (id) entries.push({ id, detail: item, hasDetail: true });
        }
      }
    } else if (modalitiesRaw && typeof modalitiesRaw === 'object') {
      for (const [id, detail] of Object.entries(modalitiesRaw)) {
        if (!id || !id.trim()) continue;
        entries.push({ id: id.trim(), detail: (detail as any) || {}, hasDetail: true });
      }
    }
    return entries;
  }

  /**
   * Último C-STORE real paginando /changes hasta Done (no solo los primeros 100).
   */
  async getLastStoreInfo() {
    let lastStoreAt: string | null = null;
    let lastStoreChangeType: string | null = null;
    let lastSeq = 0;
    try {
      const { changes, last } = await OrthancClient.getAllRecentChanges(100, 10);
      lastSeq = last;
      const storeTypes = new Set(['NewInstance', 'NewStudy', 'NewSeries', 'StableStudy', 'StableSeries']);
      let bestSeq = -1;
      for (const c of changes) {
        if (c && storeTypes.has(String(c.ChangeType))) {
          const seq = typeof c.Seq === 'number' ? c.Seq : -1;
          if (seq >= bestSeq) {
            bestSeq = seq;
            lastStoreChangeType = String(c.ChangeType);
            lastStoreAt = parseOrthancDate(String(c.Date || '')) || lastStoreAt;
          }
        }
      }
    } catch {
      lastStoreAt = null;
      lastStoreChangeType = null;
    }
    return { lastStoreAt, lastStoreChangeType, lastSeq };
  }

  /**
   * Verifica conectividad DICOM real con una modalidad mediante C-ECHO.
   * No confunde "configurado" con "verificado": solo OK tras un echo exitoso.
   * Valida el ID contra las modalidades registradas (nunca acepta "DICOM Device").
   */
  async testDicomEcho(modalityName: string, userId: string, userName: string, userRole: any) {
    const startedAt = new Date().toISOString();
    const cleanName = String(modalityName || '').trim();
    const entries = await this.listModalities().catch(() => []);
    const validIds = entries.map(e => e.id);
    if (!cleanName || INVALID_MODALITY_IDS.has(cleanName.toLowerCase())) {
      const msg = `ID de modalidad inválido "${modalityName}". Use un ID registrado en Orthanc (DicomModalities). Válidos: ${validIds.join(', ') || 'ninguno'}.`;
      await this.addAuditLog({
        userId, userName, userRole,
        action: 'DICOM_ECHO',
        description: `C-ECHO rechazado: ID inválido "${modalityName}".`,
        ipAddress: '127.0.0.1',
        details: msg,
      });
      return { success: false, modality: cleanName || String(modalityName), timestamp: startedAt, error: msg, validIds };
    }
    if (validIds.length > 0 && !validIds.includes(cleanName)) {
      const msg = `Modalidad "${cleanName}" no registrada en Orthanc (DicomModalities). Válidos: ${validIds.join(', ')}. Revise orthanc.json.`;
      await this.addAuditLog({
        userId, userName, userRole,
        action: 'DICOM_ECHO',
        description: `C-ECHO fallido: modalidad "${cleanName}" no registrada.`,
        ipAddress: '127.0.0.1',
        details: msg,
      });
      return { success: false, modality: cleanName, timestamp: startedAt, error: msg, validIds, notFound: true as const };
    }
    try {
      await OrthancClient.echoModality(cleanName);
      echoCache.set(cleanName, { status: 'OK', time: startedAt, error: null });
      await this.addAuditLog({
        userId, userName, userRole,
        action: 'DICOM_ECHO',
        description: `C-ECHO exitoso a modalidad "${cleanName}". Equipo DICOM alcanzable.`,
        ipAddress: '127.0.0.1',
        details: `Modality: ${cleanName} — OK at ${startedAt}`,
      });
      return { success: true, modality: cleanName, timestamp: startedAt, error: null as string | null };
    } catch (err: any) {
      const msg = err?.name === 'TimeoutError' || String(err?.message || '').toLowerCase().includes('timeout')
        ? `C-ECHO a "${cleanName}" agotó el tiempo de espera (60s). Verifique red, IP, puerto y que el equipo esté encendido.`
        : (err?.message || 'Error desconocido en C-ECHO');
      echoCache.set(cleanName, { status: 'FAILED', time: startedAt, error: msg });
      await this.addAuditLog({
        userId, userName, userRole,
        action: 'DICOM_ECHO',
        description: `C-ECHO fallido a modalidad "${cleanName}". Verificar red, IP, puerto y AETitle.`,
        ipAddress: '127.0.0.1',
        details: `Modality: ${cleanName} — FAILED: ${msg}`,
      });
      return { success: false, modality: cleanName, timestamp: startedAt, error: msg };
    }
  }

  getEchoCache(): Record<string, EchoCacheEntry> {
    return Object.fromEntries(echoCache.entries());
  }

  async getOrthancStatus() {
    const config = await this.getPacsConfig();
    const configured = !!config?.isConfigured;
    const storedStatus = await prisma.orthancStatus.findFirst();

    let systemInfo: any = {};
    let modalityEntries: { id: string; detail: any; hasDetail: boolean }[] = [];
    let lastStoreAt: string | null = null;
    let lastStoreChangeType: string | null = null;
    let orthancStudyIds: string[] = [];
    try {
      systemInfo = await OrthancClient.getSystem();
      if (configured) {
        try {
          modalityEntries = await this.listModalities();
        } catch {
          modalityEntries = [];
        }
        try {
          const info = await this.getLastStoreInfo();
          lastStoreAt = info.lastStoreAt;
          lastStoreChangeType = info.lastStoreChangeType;
        } catch {
          lastStoreAt = null;
          lastStoreChangeType = null;
        }
        try {
          const ids = await OrthancClient.getStudies();
          if (Array.isArray(ids)) orthancStudyIds = ids.map((s: any) => String(typeof s === 'string' ? s : (s.ID || s)));
        } catch {
          orthancStudyIds = [];
        }
      }
    } catch {
      systemInfo = {};
      modalityEntries = [];
    }

    const online = !!(systemInfo.ApiVersion);

    const studyCount = await prisma.study.count();
    const patientCount = await prisma.patient.count({ where: { isDeleted: false } });
    const seriesCount = await prisma.series.count();
    const instanceCount = await prisma.instance.count();

    // /system no trae DiskSize: usar /statistics (TotalDiskSize) como fuente real.
    let storageUsageBytes = systemInfo.DiskSize
      ? parseInt(systemInfo.DiskSize, 10)
      : 0;
    if (!storageUsageBytes && online) {
      try {
        const stats: any = await OrthancClient.getStatistics();
        const raw = stats?.TotalDiskSize ?? stats?.TotalUncompressedSize ?? 0;
        const parsed = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
        if (!isNaN(parsed) && parsed > 0) storageUsageBytes = parsed;
      } catch { /* deja 0 si Orthanc no responde statistics */ }
    }
    const storageUsageMb = storageUsageBytes
      ? Math.round((storageUsageBytes / (1024 * 1024)) * 10) / 10
      : 0;

    const matchesConfiguredEquipment = (detail: any) => {
      const aet = String(detail.AET || detail.SymbolicName || '').trim();
      const host = String(detail.Host || '').trim();
      return (!!config.remoteAETitle && aet === config.remoteAETitle.trim())
        || (!!config.remoteIp && host === config.remoteIp.trim());
    };

    const connectedEquipment = (configured && online ? modalityEntries : []).map(({ id, detail, hasDetail }) => {
      const isMatch = matchesConfiguredEquipment(detail);
      const echo = echoCache.get(id);
      return {
        id,
        name: (hasDetail && detail.Type) || id,
        aetitle: detail.AET || detail.SymbolicName || '',
        ip: detail.Host || '',
        port: detail.Port || 0,
        hasDetail,
        // Compat: ACTIVE = coincide con configuración (NO verificado), IDLE = conocido no configurado.
        status: isMatch ? 'ACTIVE' : 'IDLE',
        isConfiguredMatch: isMatch,
        echoStatus: echo?.status || 'UNKNOWN',
        lastEchoTime: echo?.time || null,
        lastEchoError: echo?.error || null,
      };
    });

    const anyEchoOk = connectedEquipment.some(e => e.echoStatus === 'OK');
    const configuredMatch = connectedEquipment.find(e => e.isConfiguredMatch);
    const dicomVerified = !!(online && configured && (configuredMatch?.echoStatus === 'OK' || anyEchoOk));

    return {
      online,
      configured,
      version: systemInfo.Version || '',
      aetitle: systemInfo.DicomAet || '',
      dicomPort: systemInfo.DicomPort || 0,
      httpPort: systemInfo.HttpPort || 0,
      storageUsageMb,
      patientCount,
      studyCount,
      seriesCount,
      instanceCount,
      lastSyncTime: configured ? (storedStatus?.lastSyncTime || '') : '',
      connectedEquipment,
      dicom: {
        lastStoreAt,
        lastStoreChangeType,
        orthancStudyCount: orthancStudyIds.length,
        totalModalities: connectedEquipment.length,
        verified: dicomVerified,
      },
    };
  }

  async getPacsConfig() {
    let config = await prisma.pacsConfig.findFirst();
    if (!config) {
      config = await prisma.pacsConfig.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          institutionName: '',
          orthancServerUrl: '',
          localAETitle: '',
          remoteAETitle: '',
          remoteIp: '',
          remotePort: 0,
          autoSyncIntervalSec: 0,
          retentionDays: 0,
          anonymizeExportDefault: false,
          isConfigured: false,
        },
      });
    }
    return config;
  }

  async updatePacsConfig(newConfig: any, userId: string, userName: string, userRole: any) {
    const updated = await prisma.pacsConfig.upsert({
      where: { id: 1 },
      update: { ...newConfig, isConfigured: true },
      create: {
        id: 1,
        institutionName: '',
        orthancServerUrl: '',
        localAETitle: '',
        remoteAETitle: '',
        remoteIp: '',
        remotePort: 0,
        autoSyncIntervalSec: 0,
        retentionDays: 0,
        anonymizeExportDefault: false,
        ...newConfig,
        isConfigured: true,
      },
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

  async getUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async getUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async createUser(data: { name: string; email: string; role: string; passwordHash: string; avatar?: string }) {
    const user = await prisma.user.create({
      data: {
        id: `usr-${Date.now()}`,
        name: data.name,
        email: data.email,
        role: data.role,
        passwordHash: data.passwordHash,
        avatar: data.avatar || null,
        lastLogin: null,
      },
    });
    return user;
  }

  async updateUser(id: string, data: Partial<{ name: string; email: string; role: string; passwordHash: string; avatar: string }>) {
    const user = await prisma.user.update({
      where: { id },
      data,
    });
    return user;
  }

  async updateUserLastLogin(id: string) {
    await prisma.user.update({
      where: { id },
      data: { lastLogin: new Date().toISOString() },
    });
  }

  async deleteUser(id: string) {
    await prisma.auditLog.updateMany({
      where: { userId: id },
      data: { userId: null },
    });
    await prisma.user.delete({ where: { id } });
  }

  async getWeeklyStats() {
    const toLocalKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = new Date();
    const todayKey = toLocalKey(today);
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const daily: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = toLocalKey(d);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const nextKey = toLocalKey(next);
      const label = key === todayKey ? 'Hoy' : days[i];
      const count = await prisma.study.count({
        where: {
          studyDate: {
            gte: key,
            lt: nextKey,
          },
        },
      });
      daily[label] = count;
    }

    const totalWeek = Object.values(daily).reduce((a, b) => a + b, 0);

    return {
      days: Object.entries(daily).map(([day, count]) => ({ day, estudios: count })),
      totalWeek,
      mostActiveDay: Object.entries(daily).reduce((max, entry) =>
        entry[1] > max[1] ? entry : max, ['', 0])[0],
    };
  }
}

export const pacsStore = new PacsStore();
