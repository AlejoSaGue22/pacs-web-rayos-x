/**
 * localDiskExporter.ts
 * Exporta estudios DICOM desde Orthanc al disco local del PC,
 * organizados por paciente y fecha de estudio.
 *
 * Estructura generada:
 *  {LOCAL_STORAGE_PATH}/
 *    APELLIDO_NOMBRE_DOCUMENTO/
 *      YYYY-MM-DD_DESCRIPCION/
 *        metadata.json
 *        estudio.zip
 *        IM000001.dcm  ...
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

const STORAGE_BASE = process.env.LOCAL_STORAGE_PATH || 'C:/MiniPACS/estudios';

function sanitizeFolderName(text: string): string {
  return (text || 'DESCONOCIDO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase()
    .slice(0, 60);
}

function buildPatientFolderName(patientName: string, patientDocument: string): string {
  const parts = (patientName || '').split('^');
  const lastName  = sanitizeFolderName(parts[0] || 'PACIENTE');
  const firstName = sanitizeFolderName(parts[1] || '');
  const doc       = sanitizeFolderName(patientDocument || 'SIN_DOC');
  return firstName ? ${lastName}__ : ${lastName}_;
}

function buildStudyFolderName(studyDate: string, studyDescription: string): string {
  const date = studyDate ? studyDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const desc = sanitizeFolderName(studyDescription || 'ESTUDIO_DICOM');
  return ${date}_;
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
  authHeader: string
): Promise<string | null> {
  try {
    const patientFolder = buildPatientFolderName(study.patientName, study.patientDocument);
    const studyFolder   = buildStudyFolderName(study.studyDate, study.studyDescription);
    const targetDir     = path.join(STORAGE_BASE, patientFolder, studyFolder);

    if (fs.existsSync(targetDir)) {
      console.log([LocalExport] Ya existe:  — omitido.);
      return targetDir;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    console.log([LocalExport] Exportando  → );

    const zipUrl = ${orthancUrl}/studies//archive;
    const response = await fetch(zipUrl, { headers: { Authorization: authHeader } });

    if (!response.ok) {
      throw new Error(Orthanc archive download failed:  );
    }

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const zipPath = path.join(targetDir, 'estudio.zip');
    fs.writeFileSync(zipPath, zipBuffer);
    console.log([LocalExport] ZIP guardado ( KB));

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
          const outName  = ext === '.dcm' ? baseName : ${baseName}.dcm;
          fs.writeFileSync(path.join(targetDir, outName), entry.getData());
          dcmCount++;
        }
      }
      console.log([LocalExport]  archivos .dcm extraidos);
    } catch (zipErr) {
      console.warn([LocalExport] No se pudieron extraer los .dcm:, zipErr);
    }

    const metadata = {
      exportadoEn: new Date().toISOString(),
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
    console.log([LocalExport] Estudio  exportado correctamente);
    return targetDir;
  } catch (err) {
    console.error([LocalExport] Error exportando estudio :, err);
    return null;
  }
}

export function getLocalStorageStats(): {
  storagePath: string;
  totalPatients: number;
  totalStudies: number;
  totalSizeMb: number;
  patients: { name: string; studyCount: number }[];
} {
  if (!fs.existsSync(STORAGE_BASE)) {
    return { storagePath: STORAGE_BASE, totalPatients: 0, totalStudies: 0, totalSizeMb: 0, patients: [] };
  }

  let totalSizeBytes = 0;
  const patients: { name: string; studyCount: number }[] = [];

  const patientDirs = fs.readdirSync(STORAGE_BASE, { withFileTypes: true }).filter(d => d.isDirectory());

  for (const patDir of patientDirs) {
    const patPath = path.join(STORAGE_BASE, patDir.name);
    const studyDirs = fs.readdirSync(patPath, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const studyDir of studyDirs) {
      const studyPath = path.join(patPath, studyDir.name);
      try {
        for (const file of fs.readdirSync(studyPath)) {
          const stat = fs.statSync(path.join(studyPath, file));
          if (stat.isFile()) totalSizeBytes += stat.size;
        }
      } catch { /* ignorar */ }
    }
    patients.push({ name: patDir.name, studyCount: studyDirs.length });
  }

  return {
    storagePath: STORAGE_BASE,
    totalPatients: patients.length,
    totalStudies: patients.reduce((acc, p) => acc + p.studyCount, 0),
    totalSizeMb: Math.round((totalSizeBytes / (1024 * 1024)) * 10) / 10,
    patients,
  };
}
