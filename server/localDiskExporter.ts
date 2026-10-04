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

export function buildStudyDirectoryPath(study: StudyExportInfo): string {
  const storageBase = getStorageBase();
  const dateStr = study.studyDate ? study.studyDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(5, 7);

  const parts = (study.patientName || '').split('^');
  const lastName = sanitizeFolderName(parts[0] || 'PACIENTE');
  const firstName = sanitizeFolderName(parts[1] || '');
  const patientBase = firstName ? `${lastName}_${firstName}` : lastName;

  const desc = sanitizeFolderName(study.studyDescription || 'ESTUDIO');
  const mod = study.modality && study.modality.trim() ? sanitizeFolderName(study.modality).slice(0, 10) : 'DX';
  const acc = study.accessionNumber && study.accessionNumber.trim() ? sanitizeFolderName(study.accessionNumber).slice(0, 30) : '';

  const studyDirName = [patientBase, desc, mod, acc].filter(Boolean).join('_');
  return path.join(storageBase, year, month, studyDirName);
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
  try {
    const targetDir = buildStudyDirectoryPath(study);

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

    try {
      // Intentar extraer imágenes JPG visibles para el radiólogo
      const instancesRes = await fetch(`${orthancUrl}/studies/${study.orthancStudyId}/instances`, { headers: { Authorization: authHeader } });
      if (instancesRes.ok) {
        const instances = await instancesRes.json() as any[];
        let imgCount = 0;
        const imagesDir = path.join(targetDir, 'imagenes');
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);

        for (const inst of instances) {
          try {
            const previewRes = await fetch(`${orthancUrl}/instances/${inst.ID}/preview`, { headers: { Authorization: authHeader } });
            if (previewRes.ok) {
              const imgBuffer = Buffer.from(await previewRes.arrayBuffer());
              fs.writeFileSync(path.join(imagesDir, `imagen_${imgCount + 1}.jpg`), imgBuffer);
              console.log(`[LocalExport] Guardada imagen_${imgCount + 1}.jpg (${imgBuffer.length} bytes)`);
              imgCount++;
            } else {
              console.warn(`[LocalExport] Error en preview HTTP ${previewRes.status}:`, await previewRes.text());
            }
          } catch (e) {
            console.error(`[LocalExport] Error de red extrayendo preview para ${inst.ID}:`, e);
          }
        }
        if (imgCount > 0) {
          console.log(`[LocalExport] ${imgCount} imagenes JPG extraidas y guardadas para visualización`);
        }
      }
    } catch (jpgErr) {
      console.warn('[LocalExport] Error al generar las imagenes JPG:', jpgErr);
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
  return buildStudyDirectoryPath(study);
}

export async function getLocalDiskUsageMb(): Promise<number> {
  const storageBase = getStorageBase();
  if (!fs.existsSync(storageBase)) return 0;

  async function getDirSize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        if (file.isFile()) {
          try {
            const stat = await fs.promises.stat(fullPath);
            size += stat.size;
          } catch {}
        } else if (file.isDirectory()) {
          size += await getDirSize(fullPath);
        }
      }
    } catch {}
    return size;
  }

  const totalBytes = await getDirSize(storageBase);
  return Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
}
