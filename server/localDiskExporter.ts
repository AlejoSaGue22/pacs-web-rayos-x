/**
 * localDiskExporter.ts
 * Exporta estudios DICOM desde Orthanc al disco local del PC,
 * organizados por paciente y fecha de estudio.
 *
 * Estructura generada:
 *  {LOCAL_STORAGE_PATH}/
 *    APELLIDO__NOMBRE_DOCUMENTO/
 *      YYYY-MM-DD_DESCRIPCION_MODALIDAD_ACCESION/
 *        metadata.json
 *        estudio.zip
 *        IM000001.dcm  ...
 *
 * - Idempotente: si la carpeta destino ya existe, se omite (no sobrescribe).
 * - LOCAL_STORAGE_PATH se lee de forma perezosa para respetar .env
 *   tanto en local Windows (C:/MiniPACS/estudios) como en Docker (/data/estudios).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

export const DEFAULT_STORAGE_PATH = 'C:/MiniPACS/estudios';

export function getStorageBase(): string {
  const configured = (process.env.LOCAL_STORAGE_PATH || '').trim();
  return configured || DEFAULT_STORAGE_PATH;
}

export function sanitizeFolderName(text: string): string {
  return (text || 'DESCONOCIDO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase()
    .slice(0, 60);
}

export function buildPatientFolderName(patientName: string, patientDocument: string): string {
  const parts = (patientName || '').split('^');
  const lastName = sanitizeFolderName(parts[0] || 'PACIENTE');
  const firstName = sanitizeFolderName(parts[1] || '');
  const doc = sanitizeFolderName(patientDocument || 'SIN_DOC');
  return firstName ? `${lastName}__${firstName}_${doc}` : `${lastName}_${doc}`;
}

export function buildStudyFolderName(
  studyDate: string,
  studyDescription: string,
  modality?: string,
  accessionNumber?: string,
): string {
  const date = studyDate ? studyDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const desc = sanitizeFolderName(studyDescription || 'ESTUDIO_DICOM');
  const mod = modality && modality.trim() ? sanitizeFolderName(modality).slice(0, 10) : '';
  const acc = accessionNumber && accessionNumber.trim() ? sanitizeFolderName(accessionNumber).slice(0, 30) : '';
  const suffix = [mod, acc].filter(Boolean).join('_');
  return suffix ? `${date}_${desc}_${suffix}` : `${date}_${desc}`;
}

export interface StudyExportInfo {
  orthancStudyId: string;
  patientName: string;
  patientDocument: string;
  studyDate: string;
  studyDescription: string;
  accessionNumber: string;
  modality: string;
  studyInstanceUid: string;
  numberOfSeries: number;
  numberOfInstances: number;
}

export async function exportStudyToLocalDisk(
  study: StudyExportInfo,
  orthancUrl: string,
  authHeader: string,
): Promise<string | null> {
  const storageBase = getStorageBase();
  try {
    const patientFolder = buildPatientFolderName(study.patientName, study.patientDocument);
    const studyFolder = buildStudyFolderName(
      study.studyDate,
      study.studyDescription,
      study.modality,
      study.accessionNumber,
    );
    const targetDir = path.join(storageBase, patientFolder, studyFolder);

    if (fs.existsSync(targetDir)) {
      console.log(`[LocalExport] Ya existe: ${targetDir} — omitido.`);
      return targetDir;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`[LocalExport] Exportando ${study.accessionNumber} → ${targetDir}`);

    const zipUrl = `${orthancUrl}/studies/${study.orthancStudyId}/archive`;
    const response = await fetch(zipUrl, { headers: { Authorization: authHeader } });

    if (!response.ok) {
      throw new Error(`Orthanc archive download failed: ${response.status} ${response.statusText}`);
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const zipPath = path.join(targetDir, 'estudio.zip');
    fs.writeFileSync(zipPath, zipBuffer);
    console.log(`[LocalExport] ZIP guardado (${Math.round(zipBuffer.length / 1024)} KB)`);

    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries() as any[];
      let dcmCount = 0;
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName as string;
        const ext = path.extname(entryName).toLowerCase();
        if (ext === '.dcm' || ext === '') {
          const baseName = path.basename(entryName);
          const outName = ext === '.dcm' ? baseName : `${baseName}.dcm`;
          fs.writeFileSync(path.join(targetDir, outName), entry.getData());
          dcmCount++;
        }
      }
      console.log(`[LocalExport] ${dcmCount} archivos .dcm extraidos`);
    } catch (zipErr) {
      console.warn('[LocalExport] No se pudieron extraer los .dcm:', zipErr);
    }

    const metadata = {
      exportadoEn: new Date().toISOString(),
      rutaLocal: targetDir,
      estudio: {
        orthancStudyId: study.orthancStudyId,
        accessionNumber: study.accessionNumber,
        studyInstanceUid: study.studyInstanceUid,
        studyDate: study.studyDate,
        studyDescription: study.studyDescription,
        modality: study.modality,
        numberOfSeries: study.numberOfSeries,
        numberOfInstances: study.numberOfInstances,
      },
      paciente: { nombre: study.patientName, documento: study.patientDocument },
    };

    fs.writeFileSync(path.join(targetDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`[LocalExport] Estudio ${study.accessionNumber} exportado correctamente`);
    return targetDir;
  } catch (err) {
    console.error(`[LocalExport] Error exportando estudio ${study?.accessionNumber}:`, err);
    return null;
  }
}

export function resolveStudyDiskPath(study: StudyExportInfo): string {
  const storageBase = getStorageBase();
  return path.join(
    storageBase,
    buildPatientFolderName(study.patientName, study.patientDocument),
    buildStudyFolderName(study.studyDate, study.studyDescription, study.modality, study.accessionNumber),
  );
}

export function getLocalStorageStats(): {
  storagePath: string;
  totalPatients: number;
  totalStudies: number;
  totalSizeMb: number;
  patients: { name: string; studyCount: number }[];
} {
  const storageBase = getStorageBase();
  if (!fs.existsSync(storageBase)) {
    return { storagePath: storageBase, totalPatients: 0, totalStudies: 0, totalSizeMb: 0, patients: [] };
  }

  let totalSizeBytes = 0;
  const patients: { name: string; studyCount: number }[] = [];

  const patientDirs = fs.readdirSync(storageBase, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const patDir of patientDirs) {
    const patPath = path.join(storageBase, patDir.name);
    let studyDirs: any[] = [];
    try {
      studyDirs = fs.readdirSync(patPath, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      studyDirs = [];
    }
    for (const studyDir of studyDirs) {
      const studyPath = path.join(patPath, studyDir.name);
      try {
        for (const file of fs.readdirSync(studyPath)) {
          const stat = fs.statSync(path.join(studyPath, file));
          if (stat.isFile()) totalSizeBytes += stat.size;
        }
      } catch {
        /* ignorar */
      }
    }
    patients.push({ name: patDir.name, studyCount: studyDirs.length });
  }

  return {
    storagePath: storageBase,
    totalPatients: patients.length,
    totalStudies: patients.reduce((acc, p) => acc + p.studyCount, 0),
    totalSizeMb: Math.round((totalSizeBytes / (1024 * 1024)) * 10) / 10,
    patients,
  };
}
