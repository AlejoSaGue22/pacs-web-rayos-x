import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORTHANC_URL = process.env.ORTHANC_URL || 'http://localhost:8042';
const ORTHANC_USER = process.env.ORTHANC_USER || 'orthanc';
const ORTHANC_PASS = process.env.ORTHANC_PASS || 'orthanc';

const AUTH = Buffer.from(`${ORTHANC_USER}:${ORTHANC_PASS}`).toString('base64');

const SAMPLE_DICOMS = [
  {
    name: 'Chest X-ray COVID-19 (Stony Brook)',
    url: 'https://saga-it.com/dicom/samples/files/dx-chest-covid-19-ny-sbu/instance.dcm',
    modality: 'DX',
    description: 'Radiografía de tórax AP - COVID-19 positivo',
  },
  {
    name: 'Chest X-ray LIDC-IDRI (PA & Lateral)',
    url: 'https://saga-it.com/dicom/samples/files/dx-chest-lidc-idri/instance.dcm',
    modality: 'DX',
    description: 'Radiografía de tórax PA y Lateral',
  },
  {
    name: 'Chest CT (NLST Lung Screening)',
    url: 'https://saga-it.com/dicom/samples/files/ct-lung-screening-nlst/instance.dcm',
    modality: 'CT',
    description: 'Tomografía de tórax - Screening de cáncer de pulmón',
  },
  {
    name: 'Brain MRI (UPENN-GBM)',
    url: 'https://saga-it.com/dicom/samples/files/mr-brain-upenn-gbm/instance.dcm',
    modality: 'MR',
    description: 'Resonancia magnética cerebral - Glioblastoma',
  },
  {
    name: 'Mammography CBIS-DDSM',
    url: 'https://saga-it.com/dicom/samples/files/mg-mammography-cbis-ddsm/instance.dcm',
    modality: 'MG',
    description: 'Mamografía digital - Set de prueba de masas',
  },
];

const GITHUB_DICOMS = [
  {
    name: 'CT Small (pydicom)',
    url: 'https://raw.githubusercontent.com/pydicom/pydicom/main/src/pydicom/data/test_files/CT_small.dcm',
    modality: 'CT',
    description: 'Tomografía computarizada - 128x128 píxeles',
  },
  {
    name: 'MR Small (pydicom)',
    url: 'https://raw.githubusercontent.com/pydicom/pydicom/main/src/pydicom/data/test_files/MR_small.dcm',
    modality: 'MR',
    description: 'Resonancia magnética - 64x64 píxeles',
  },
  {
    name: 'US RGB Color (pydicom)',
    url: 'https://raw.githubusercontent.com/pydicom/pydicom/main/src/pydicom/data/test_files/examples_rgb_color.dcm',
    modality: 'US',
    description: 'Ultrasonido a color RGB',
  },
  {
    name: 'ECG Waveform (OHIF)',
    url: 'https://raw.githubusercontent.com/OHIF/viewer-testdata/master/dcm/anonymous_ecg.dcm',
    modality: 'ECG',
    description: 'Electrocardiograma de 12 derivaciones',
  },
];

async function downloadDicom(url: string, destPath: string): Promise<void> {
  console.log(`  ↓ Descargando desde ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  
  console.log(`  ✓ Descargado: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
}

async function uploadToOrthanc(filePath: string): Promise<any> {
  const buffer = fs.readFileSync(filePath);
  
  const response = await fetch(`${ORTHANC_URL}/instances`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/dicom',
    },
    body: buffer,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Orthanc upload failed: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

async function checkOrthancConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${ORTHANC_URL}/system`, {
      headers: { 'Authorization': `Basic ${AUTH}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('Setup DICOMs Reales - Mini PACS Web');
  console.log('========================================\n');
  
  // Verificar conexión con Orthanc
  console.log('1. Verificando conexión con Orthanc...');
  const isConnected = await checkOrthancConnection();
  
  if (!isConnected) {
    console.error('✗ Error: No se puede conectar a Orthanc');
    console.error(`  URL: ${ORTHANC_URL}`);
    console.error('  Asegúrate de que Orthanc esté corriendo:');
    console.error('  docker-compose up -d\n');
    process.exit(1);
  }
  
  console.log('✓ Orthanc está corriendo\n');
  
  // Crear directorio temporal
  const tempDir = path.join(__dirname, '../temp-dicoms');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  console.log('2. Descargando DICOMs reales desde Saga IT...');
  console.log('   (Licencia CC-BY 4.0, uso comercial permitido con atribución)\n');
  
  const downloadedFiles: string[] = [];
  let sagaItFailed = false;
  
  for (const sample of SAMPLE_DICOMS) {
    console.log(`[${sample.modality}] ${sample.name}`);
    console.log(`    ${sample.description}`);
    
    const fileName = `${sample.modality}-${Date.now()}.dcm`;
    const filePath = path.join(tempDir, fileName);
    
    try {
      await downloadDicom(sample.url, filePath);
      downloadedFiles.push(filePath);
      console.log('');
    } catch (error) {
      const errMsg = (error as Error).message;
      console.error(`  ✗ Error: ${errMsg}\n`);
      
      if (errMsg.includes('403')) {
        sagaItFailed = true;
        break;
      }
    }
  }
  
  // Fallback: si Saga IT falló, usar GitHub
  if (sagaItFailed || downloadedFiles.length === 0) {
    console.log('\n⚠ Saga IT bloqueó las descargas. Usando fuentes alternativas (GitHub)...\n');
    
    // Limpiar archivos parciales
    for (const file of downloadedFiles) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    downloadedFiles.length = 0;
    
    for (const sample of GITHUB_DICOMS) {
      console.log(`[${sample.modality}] ${sample.name}`);
      console.log(`    ${sample.description}`);
      
      const fileName = `${sample.modality}-${Date.now()}.dcm`;
      const filePath = path.join(tempDir, fileName);
      
      try {
        await downloadDicom(sample.url, filePath);
        downloadedFiles.push(filePath);
        console.log('');
      } catch (error) {
        console.error(`  ✗ Error: ${(error as Error).message}\n`);
      }
    }
  }
  
  if (downloadedFiles.length === 0) {
    console.error('✗ No se pudo descargar ningún archivo DICOM');
    process.exit(1);
  }
  
  console.log(`✓ ${downloadedFiles.length} archivos descargados\n`);
  
  // Subir a Orthanc
  console.log('3. Subiendo DICOMs a Orthanc...\n');
  
  const uploadedIds: string[] = [];
  
  for (const filePath of downloadedFiles) {
    const fileName = path.basename(filePath);
    console.log(`  ↑ Subiendo ${fileName}...`);
    
    try {
      const result = await uploadToOrthanc(filePath);
      uploadedIds.push(result.ID);
      console.log(`  ✓ ID en Orthanc: ${result.ID}\n`);
    } catch (error) {
      console.error(`  ✗ Error: ${(error as Error).message}\n`);
    }
  }
  
  // Limpiar archivos temporales
  console.log('4. Limpiando archivos temporales...');
  for (const file of downloadedFiles) {
    fs.unlinkSync(file);
  }
  fs.rmdirSync(tempDir);
  console.log('✓ Archivos temporales eliminados\n');
  
  // Resumen
  console.log('========================================');
  console.log('Setup Completado');
  console.log('========================================');
  console.log(`\n✓ ${uploadedIds.length} estudios DICOM subidos a Orthanc`);
  console.log('\nPróximos pasos:');
  console.log('1. Inicia el servidor: npm run dev');
  console.log('2. Abre http://localhost:3000');
  console.log('3. Inicia sesión (password: pacs2026)');
  console.log('4. Ve a "Orthanc Server"');
  console.log('5. Haz clic en "Ejecutar Sincronización Manual"');
  console.log('6. Los estudios aparecerán en la lista');
  console.log('7. Abre el visor para ver las imágenes\n');
  
  console.log('Atribución de datos:');
  if (sagaItFailed) {
    console.log('  - CT_small.dcm, MR_small.dcm: pydicom project (dominio público)');
    console.log('  - examples_rgb_color.dcm: pydicom project (dominio público)');
    console.log('  - anonymous_ecg.dcm: OHIF viewer-testdata (dominio público)');
    console.log('\nFuente: GitHub (pydicom/pydicom, OHIF/viewer-testdata)');
    console.log('Nota: Saga IT (saga-it.com/dicom/samples) tiene estudios más');
    console.log('completos. Descarga manualmente si necesitas estudios reales.\n');
  } else {
    console.log('  - COVID-19-NY-SBU: Stony Brook University (CC BY 4.0)');
    console.log('  - LIDC-IDRI: Lung Image Database Consortium (CC BY 3.0)');
    console.log('  - NLST: National Lung Screening Trial (CC BY 4.0)');
    console.log('  - UPENN-GBM: University of Pennsylvania (CC BY 4.0)');
    console.log('  - CBIS-DDSM: Curated Breast Imaging Subset (CC BY 3.0)');
    console.log('\nFuente: NCI Imaging Data Commons');
    console.log('Curado por: Saga IT (https://saga-it.com/dicom/samples)\n');
  }
}

main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
