import { PrismaClient } from '../src/generated/prisma/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'pacs2026';

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.instance.deleteMany();
  await prisma.series.deleteMany();
  await prisma.study.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pacsConfig.deleteMany();
  await prisma.orthancStatus.deleteMany();

  // Users (demo accounts for testing different roles)
  await Promise.all([
    prisma.user.create({ data: { id: 'usr-001', name: 'Administrador', email: 'admin@rayosx.med.co', role: 'Admin', passwordHash: hash, avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80', lastLogin: null } }),
    prisma.user.create({ data: { id: 'usr-002', name: 'Radiologo', email: 'radiologo@rayosx.med.co', role: 'Radiologo', passwordHash: hash, avatar: 'https://images.unsplash.com/photo-1594824813566-88855ce78906?w=150&auto=format&fit=crop&q=80', lastLogin: null } }),
    prisma.user.create({ data: { id: 'usr-003', name: 'Tecnico', email: 'tecnico@rayosx.med.co', role: 'Tecnico', passwordHash: hash, avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80', lastLogin: null } }),
    prisma.user.create({ data: { id: 'usr-004', name: 'Consulta', email: 'consulta@rayosx.med.co', role: 'Consulta', passwordHash: hash, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', lastLogin: null } }),
  ]);

  console.log('✓ Usuarios demo creados (password: pacs2026)');
  console.log('  - admin@rayosx.med.co (Admin)');
  console.log('  - radiologo@rayosx.med.co (Radiologo)');
  console.log('  - tecnico@rayosx.med.co (Tecnico)');
  console.log('  - consulta@rayosx.med.co (Consulta)');

  // PacsConfig (starts empty, admin must configure it)
  await prisma.pacsConfig.create({
    data: { id: 1, orthancServerUrl: '', localAETitle: '', remoteAETitle: '', remoteIp: '', remotePort: 0, autoSyncIntervalSec: 0, retentionDays: 0, anonymizeExportDefault: false, institutionName: '', isConfigured: false },
  });

  console.log('✓ PacsConfig inicializado (vacío, requiere configuración manual)');

  // OrthancStatus
  await prisma.orthancStatus.create({
    data: { id: 1, online: false, version: '', aetitle: '', dicomPort: 0, httpPort: 0, storageUsageMb: 0, patientCount: 0, studyCount: 0, seriesCount: 0, instanceCount: 0, lastSyncTime: '', connectedEquipment: [] },
  });

  console.log('✓ OrthancStatus inicializado (offline, sin estudios)');

  console.log('\n========================================');
  console.log('Seed completado exitosamente.');
  console.log('========================================');
  console.log('\nPróximos pasos:');
  console.log('1. Ejecuta: tsx scripts/setup-real-dicoms.ts');
  console.log('   (Descarga y sube DICOMs reales a Orthanc)');
  console.log('2. Inicia el servidor: npm run dev');
  console.log('3. Ejecuta sincronización desde el frontend');
  console.log('   (Botón "Ejecutar Sincronización Manual")');
  console.log('\nO descarga DICOMs manualmente desde:');
  console.log('   https://saga-it.com/dicom/samples');
  console.log('   (28 estudios reales, licencia CC-BY)');
}

main()
  .catch((e) => {
    console.error('Error durante seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
