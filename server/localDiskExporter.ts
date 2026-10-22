/**
 * localDiskExporter.ts
 * Exporta estudios DICOM desde Orthanc al disco local del PC,
 * organizados por fecha de estudio y paciente.
 *
 * Estructura generada:
 *  {LOCAL_STORAGE_PATH}/
 *    YYYY/MM/DD/
 *      APELLIDO__NOMBRE_DOCUMENTO/
 *        YYYY-MM-DD_DESCRIPCION_MODALIDAD_ACCESION/
 *          metadata.json
 *          SERIE_01_DX/
 *            IM000001.dcm ...
 *
 * - Sin ZIP: se descarga instancia por instancia (/instances/{id}/file).
 *   Evita el ArchiveJob de /studies/{id}/archive, que competía con el C-STORE
 *   y dejaba estudios a medias.
 * - Escribe primero en una carpeta temporal y renombra al final: si algo falla
 *   no queda una carpeta de estudio incompleta.
 * - Idempotente de verdad: una carpeta solo se considera "hecha" si tiene
 *   metadata.json y al menos un .dcm. Las incompletas se vuelven a armar.
 * - LOCAL_STORAGE_PATH se lee de forma perezosa para respetar .env tanto en
 *   local Windows (C:/MiniPACS/estudios) como en Docker (/data/estudios).
 */

import fs from 'node:fs';
import path from 'node:path';

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

export function parseStudyDateParts(studyDate: string): { year: string; month: string; day: string } {
  // Acepta 'YYYY-MM-DD' y 'YYYYMMDD' (DICOM). Si no hay fecha válida, hoy.
  const raw = (studyDate || '').replace(/\D/g, '');
  if (raw.length >= 8) {
    return { year: raw.slice(0, 4), month: raw.slice(4, 6), day: raw.slice(6, 8) };
  }
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, '0'),
    day: String(now.getDate()).padStart(2, '0'),
  };
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

/** Ruta relativa nueva, organizada por año/mes/día/paciente/estudio. */
export function buildStudyRelativeDir(study: StudyExportInfo): string {
  const { year, month, day } = parseStudyDateParts(study.studyDate);
  return path.join(
    year,
    month,
    day,
    buildPatientFolderName(study.patientName, study.patientDocument),
    buildStudyFolderName(study.studyDate, study.studyDescription, study.modality, study.accessionNumber),
  );
}

/** Ruta relativa del formato plano anterior (paciente/estudio), para no duplicar. */
function buildLegacyRelativeDir(study: StudyExportInfo): string {
  return path.join(
    buildPatientFolderName(study.patientName, study.patientDocument),
    buildStudyFolderName(study.studyDate, study.studyDescription, study.modality, study.accessionNumber),
  );
}

/** Una carpeta está completa solo si tiene metadata.json y algún .dcm. */
export function isStudyExportComplete(dir: string): boolean {
  if (!dir || !fs.existsSync(dir)) return false;
  let hasMetadata = false;
  let hasDicom = false;
  const walk = (d: string, depth: number) => {
    if (depth > 3) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isFile()) {
        const lower = e.name.toLowerCase();
        if (lower === 'metadata.json') hasMetadata = true;
        else if (lower.endsWith('.dcm') || lower.endsWith('.dicom')) hasDicom = true;
      }
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(d, e.name), depth + 1);
    }
  };
  walk(dir, 0);
  return hasMetadata && hasDicom;
}

/**
 * Devuelve la carpeta existente y completa del estudio si la hay (formato nuevo
 * o el plano anterior). Sirve para no re-exportar lo que ya está bien.
 */
function findExistingCompleteDir(storageBase: string, study: StudyExportInfo): string | null {
  const candidates = [
    path.join(storageBase, buildStudyRelativeDir(study)),
    path.join(storageBase, buildLegacyRelativeDir(study)),
  ];
  for (const c of candidates) {
    if (isStudyExportComplete(c)) return c;
  }
  return null;
}

export function resolveStudyDiskPath(study: StudyExportInfo): string {
  const storageBase = getStorageBase();
  // Si ya existe en cualquier formato, devolvemos esa para respetarla.
  return findExistingCompleteDir(storageBase, study) || path.join(storageBase, buildStudyRelativeDir(study));
}

async function fetchJson(url: string, authHeader: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Orthanc GET ${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchBinary(url: string, authHeader: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Orthanc GET ${url}: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function removeDirRecursive(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignorar */
  }
}

export async function exportStudyToLocalDisk(
  study: StudyExportInfo,
  orthancUrl: string,
  authHeader: string,
): Promise<string | null> {
  const storageBase = getStorageBase();
  const targetDir = path.join(storageBase, buildStudyRelativeDir(study));
  const tmpDir = `${targetDir}.tmp-${Date.now()}`;
  try {
    // Solo omitimos si ya está COMPLETA. Las carpetas a medias se rehacen.
    const existing = findExistingCompleteDir(storageBase, study);
    if (existing) {
      console.log(`[LocalExport] Ya existe y está completo: ${existing} — omitido.`);
      return existing;
    }

    // No respaldar estudios que Orthanc todavía está recibiendo: quedarían
    // incompletos en disco (p. ej. 1 de 2 imágenes). Se reintenta luego.
    const studyInfo = await fetchJson(`${orthancUrl}/studies/${study.orthancStudyId}`, authHeader);
    if (studyInfo && studyInfo.IsStable === false) {
      console.warn(`[LocalExport] Estudio ${study.accessionNumber} aún en recepción en Orthanc (IsStable=false); se omite.`);
      return null;
    }

    // Limpiar restos de intentos previos (carpetas incompletas).
    removeDirRecursive(targetDir);
    removeDirRecursive(tmpDir);
    fs.mkdirSync(tmpDir, { recursive: true });
    console.log(`[LocalExport] Exportando ${study.accessionNumber} → ${targetDir}`);

    const seriesList = await fetchJson(`${orthancUrl}/studies/${study.orthancStudyId}/series`, authHeader);
    const seriesIds: string[] = Array.isArray(seriesList)
      ? seriesList.map((s: any) => s.ID || s).filter(Boolean)
      : [];

    let totalFiles = 0;
    const seriesSummary: { folder: string; modality: string; files: number }[] = [];

    for (let i = 0; i < seriesIds.length; i++) {
      const seriesId = seriesIds[i];
      let seriesTags: any = {};
      try {
        seriesTags = await fetchJson(`${orthancUrl}/series/${seriesId}`, authHeader);
      } catch {
        seriesTags = {};
      }
      const main = seriesTags.MainDicomTags || {};
      const seriesNumber = String(main.SeriesNumber || i + 1).padStart(2, '0');
      const modality = sanitizeFolderName(main.Modality || study.modality || 'OT').slice(0, 10);
      const seriesFolder = path.join(tmpDir, `SERIE_${seriesNumber}_${modality}`);
      fs.mkdirSync(seriesFolder, { recursive: true });

      let instanceIds: string[] = [];
      try {
        const inst = await fetchJson(`${orthancUrl}/series/${seriesId}/instances`, authHeader);
        instanceIds = Array.isArray(inst) ? inst.map((x: any) => x.ID || x).filter(Boolean) : [];
      } catch {
        instanceIds = [];
      }

      let fileIndex = 0;
      let seriesFiles = 0;
      for (const instId of instanceIds) {
        try {
          const buffer = await fetchBinary(`${orthancUrl}/instances/${instId}/file`, authHeader);
          if (buffer.length === 0) continue;
          fileIndex++;
          const outName = `IM${String(fileIndex).padStart(6, '0')}.dcm`;
          fs.writeFileSync(path.join(seriesFolder, outName), buffer);
          totalFiles++;
          seriesFiles++;
        } catch (instErr) {
          console.warn(`[LocalExport] Instancia ${instId} no descargada:`, instErr);
        }
      }
      seriesSummary.push({ folder: `SERIE_${seriesNumber}_${modality}`, modality, files: seriesFiles });
    }

    if (totalFiles === 0) {
      // Sin DICOM no hay respaldo útil: no dejamos carpeta vacía.
      throw new Error('No se pudo descargar ningún archivo DICOM');
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
      archivosDicom: totalFiles,
      series: seriesSummary,
    };
    fs.writeFileSync(path.join(tmpDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    // Publicación atómica: renombrar tmp → destino.
    removeDirRecursive(targetDir);
    fs.renameSync(tmpDir, targetDir);
    console.log(`[LocalExport] Estudio ${study.accessionNumber} exportado (${totalFiles} DICOM, ${seriesIds.length} series)`);
    return targetDir;
  } catch (err) {
    removeDirRecursive(tmpDir);
    console.error(`[LocalExport] Error exportando estudio ${study?.accessionNumber}:`, err);
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
  const storageBase = getStorageBase();
  if (!fs.existsSync(storageBase)) {
    return { storagePath: storageBase, totalPatients: 0, totalStudies: 0, totalSizeMb: 0, patients: [] };
  }

  let totalSizeBytes = 0;
  const studyDirs: string[] = [];

  // Recorre cualquier profundidad y detecta carpetas de estudio por metadata.json.
  // Así funciona con el formato nuevo (YYYY/MM/DD/...) y con el plano anterior.
  const visit = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const hasMetadata = entries.some((e) => e.isFile() && e.name.toLowerCase() === 'metadata.json');
    if (hasMetadata) {
      studyDirs.push(dir);
      const sum = (d: string) => {
        let inner: fs.Dirent[] = [];
        try {
          inner = fs.readdirSync(d, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of inner) {
          const p = path.join(d, e.name);
          try {
            if (e.isDirectory()) sum(p);
            else totalSizeBytes += fs.statSync(p).size;
          } catch {
            /* ignorar */
          }
        }
      };
      sum(dir);
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) visit(path.join(dir, e.name));
    }
  };
  visit(storageBase);

  const parentDirs = new Set(studyDirs.map((d) => path.dirname(d)));
  const patients = Array.from(parentDirs).map((p) => ({
    name: path.basename(p),
    studyCount: studyDirs.filter((d) => path.dirname(d) === p).length,
  }));

  return {
    storagePath: storageBase,
    totalPatients: parentDirs.size,
    totalStudies: studyDirs.length,
    totalSizeMb: Math.round((totalSizeBytes / (1024 * 1024)) * 10) / 10,
    patients,
  };
}
