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

  // Users
  const users = await Promise.all([
    prisma.user.create({ data: { id: 'usr-001', name: 'Dr. Alejandro Morales', email: 'amorales@rayosx.med.co', role: 'Admin', passwordHash: hash, avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80', lastLogin: new Date(Date.now() - 1000 * 60 * 12).toISOString() } }),
    prisma.user.create({ data: { id: 'usr-002', name: 'Dra. Patricia Gómez', email: 'pgomez@rayosx.med.co', role: 'Radiologo', passwordHash: hash, avatar: 'https://images.unsplash.com/photo-1594824813566-88855ce78906?w=150&auto=format&fit=crop&q=80', lastLogin: new Date(Date.now() - 1000 * 60 * 45).toISOString() } }),
    prisma.user.create({ data: { id: 'usr-003', name: 'Téc. Fernando Ruiz', email: 'fruiz@rayosx.med.co', role: 'Tecnico', passwordHash: hash, avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80', lastLogin: new Date(Date.now() - 1000 * 60 * 180).toISOString() } }),
    prisma.user.create({ data: { id: 'usr-004', name: 'Lic. Laura Restrepo', email: 'lrestrepo@rayosx.med.co', role: 'Consulta', passwordHash: hash, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', lastLogin: new Date(Date.now() - 1000 * 60 * 1440).toISOString() } }),
  ]);

  // Patients
  const patients = await Promise.all([
    prisma.patient.create({ data: { id: 'pat-1029384756', documentNumber: '1029384756', firstName: 'Juan Carlos', lastName: 'Pérez Gómez', birthDate: '1978-04-12', gender: 'M', phone: '+57 310 492 8812', email: 'jperez@gmail.com', createdAt: '2026-07-20T08:30:00Z', updatedAt: '2026-07-29T09:15:00Z', isDeleted: false, studyCount: 2 } }),
    prisma.patient.create({ data: { id: 'pat-5549301284', documentNumber: '5549301284', firstName: 'María Elena', lastName: 'Rodríguez Silva', birthDate: '1964-11-25', gender: 'F', phone: '+57 301 883 9921', email: 'merodriguez@hotmail.com', createdAt: '2026-07-22T10:15:00Z', updatedAt: '2026-07-28T14:20:00Z', isDeleted: false, studyCount: 1 } }),
    prisma.patient.create({ data: { id: 'pat-8839201948', documentNumber: '8839201948', firstName: 'Carlos Alberto', lastName: 'Mendoza Castro', birthDate: '1991-08-03', gender: 'M', phone: '+57 315 220 9011', email: 'cmendoza@outlook.com', createdAt: '2026-07-25T11:00:00Z', updatedAt: '2026-07-29T10:00:00Z', isDeleted: false, studyCount: 1 } }),
    prisma.patient.create({ data: { id: 'pat-7728193840', documentNumber: '7728193840', firstName: 'Sofía Valentina', lastName: 'López Vargas', birthDate: '2002-02-18', gender: 'F', phone: '+57 320 554 1122', email: 'sofia.lopez@yahoo.es', createdAt: '2026-07-27T14:40:00Z', updatedAt: '2026-07-27T14:40:00Z', isDeleted: false, studyCount: 1 } }),
    prisma.patient.create({ data: { id: 'pat-3392019485', documentNumber: '3392019485', firstName: 'Roberto Antonio', lastName: 'Silva Morales', birthDate: '1974-09-30', gender: 'M', phone: '+57 312 990 4455', email: 'rsilva@empresa.com', createdAt: '2026-07-28T09:10:00Z', updatedAt: '2026-07-28T09:10:00Z', isDeleted: false, studyCount: 1 } }),
    prisma.patient.create({ data: { id: 'pat-9918273645', documentNumber: '9918273645', firstName: 'Ana Lucía', lastName: 'Torres Benítez', birthDate: '1997-06-14', gender: 'F', phone: '+57 304 661 2233', email: 'anatorres@gmail.com', createdAt: '2026-07-29T07:45:00Z', updatedAt: '2026-07-29T07:45:00Z', isDeleted: false, studyCount: 1 } }),
  ]);

  // Study 1: ACC-2026-0891
  await prisma.study.create({
    data: {
      id: 'orthanc-study-001', accessionNumber: 'ACC-2026-0891', studyInstanceUid: '1.2.840.113619.2.55.3.2831172839.891',
      patientId: 'pat-1029384756', patientDocument: '1029384756', patientName: 'Pérez Gómez, Juan Carlos',
      patientSex: 'M', patientBirthDate: '1978-04-12', studyDate: '2026-07-29', studyTime: '08:15:30',
      studyDescription: 'Rx Tórax AP y Lateral', modality: 'DX', referringPhysician: 'Dr. Hernán Ramírez',
      performingTechnician: 'Téc. Fernando Ruiz', institutionName: 'Consultorio de Rayos X - Mindray DigiEye 330',
      manufacturer: 'Mindray', manufacturerModelName: 'DigiEye 330 Series', numberOfSeries: 2, numberOfInstances: 2,
      status: 'Recibido', notes: 'Solicitud por tos persistente de 2 semanas y molestia retroesternal. Sin antecedente quirúrgico.',
      createdAt: '2026-07-29T08:16:05Z',
      series: {
        create: [
          {
            id: 'orthanc-series-001-1', seriesNumber: 1, seriesDescription: 'Tórax Anteroposterior (AP)', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.891.1', bodyPartExamined: 'CHEST', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-001-1-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.891.1.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 2048, windowWidth: 4096, previewUrl: '/api/orthanc/instances/orthanc-inst-001-1-1/preview', fileSize: 4194304, kvp: 120, exposureTimeMs: 12, tubeCurrentMA: 250, mAs: 3.0, viewPosition: 'AP', tags: [{ tag: '(0008,0020)', name: 'StudyDate', vr: 'DA', value: '20260729' }, { tag: '(0008,0030)', name: 'StudyTime', vr: 'TM', value: '081530' }, { tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }, { tag: '(0008,0070)', name: 'Manufacturer', vr: 'LO', value: 'Mindray' }, { tag: '(0008,0080)', name: 'InstitutionName', vr: 'LO', value: 'Consultorio Rayos X' }, { tag: '(0008,1090)', name: 'ManufacturerModelName', vr: 'LO', value: 'DigiEye 330 Series' }, { tag: '(0010,0010)', name: 'PatientName', vr: 'PN', value: 'Pérez Gómez^Juan Carlos' }, { tag: '(0010,0020)', name: 'PatientID', vr: 'LO', value: '1029384756' }, { tag: '(0010,0040)', name: 'PatientSex', vr: 'CS', value: 'M' }, { tag: '(0018,0060)', name: 'KVP', vr: 'DS', value: '120' }, { tag: '(0018,1150)', name: 'ExposureTime', vr: 'IS', value: '12' }, { tag: '(0018,1151)', name: 'XRayTubeCurrent', vr: 'IS', value: '250' }, { tag: '(0018,1152)', name: 'Exposure', vr: 'IS', value: '3' }, { tag: '(0018,1160)', name: 'FilterType', vr: 'SH', value: 'ALUMINUM 2.5mm' }, { tag: '(0018,5101)', name: 'ViewPosition', vr: 'CS', value: 'AP' }, { tag: '(0028,0010)', name: 'Rows', vr: 'US', value: 2048 }, { tag: '(0028,0011)', name: 'Columns', vr: 'US', value: 2048 }, { tag: '(0028,0100)', name: 'BitsAllocated', vr: 'US', value: 16 }, { tag: '(0028,0101)', name: 'BitsStored', vr: 'US', value: 14 }, { tag: '(0028,1050)', name: 'WindowCenter', vr: 'DS', value: '2048' }, { tag: '(0028,1051)', name: 'WindowWidth', vr: 'DS', value: '4096' }] }] },
          },
          {
            id: 'orthanc-series-001-2', seriesNumber: 2, seriesDescription: 'Tórax Lateral Izquierda', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.891.2', bodyPartExamined: 'CHEST', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-001-2-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.891.2.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 2048, windowWidth: 4096, previewUrl: '/api/orthanc/instances/orthanc-inst-001-2-1/preview', fileSize: 4194304, kvp: 125, exposureTimeMs: 16, tubeCurrentMA: 250, mAs: 4.0, viewPosition: 'LAT', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }, { tag: '(0008,0070)', name: 'Manufacturer', vr: 'LO', value: 'Mindray' }, { tag: '(0008,1090)', name: 'ManufacturerModelName', vr: 'LO', value: 'DigiEye 330 Series' }, { tag: '(0018,0060)', name: 'KVP', vr: 'DS', value: '125' }, { tag: '(0018,5101)', name: 'ViewPosition', vr: 'CS', value: 'LAT' }] }] },
          },
        ],
      },
    },
  });

  // Study 2: ACC-2026-0892
  await prisma.study.create({
    data: {
      id: 'orthanc-study-002', accessionNumber: 'ACC-2026-0892', studyInstanceUid: '1.2.840.113619.2.55.3.2831172839.892',
      patientId: 'pat-5549301284', patientDocument: '5549301284', patientName: 'Rodríguez Silva, María Elena',
      patientSex: 'F', patientBirthDate: '1964-11-25', studyDate: '2026-07-28', studyTime: '14:10:00',
      studyDescription: 'Rx Rodilla Derecha AP y Lateral', modality: 'DX', referringPhysician: 'Dr. Santiago Ortiz',
      performingTechnician: 'Téc. Fernando Ruiz', institutionName: 'Consultorio de Rayos X - Mindray DigiEye 330',
      manufacturer: 'Mindray', manufacturerModelName: 'DigiEye 330 Series', numberOfSeries: 2, numberOfInstances: 2,
      status: 'Informado', notes: 'Gonalgia derecha progresiva de 6 meses. Evaluación de espacio articular femorotibial.',
      createdAt: '2026-07-28T14:11:10Z',
      series: {
        create: [
          {
            id: 'orthanc-series-002-1', seriesNumber: 1, seriesDescription: 'Rodilla Derecha AP', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.892.1', bodyPartExamined: 'KNEE', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-002-1-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.892.1.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 2100, windowWidth: 3800, previewUrl: '/api/orthanc/instances/orthanc-inst-002-1-1/preview', fileSize: 4194304, kvp: 65, exposureTimeMs: 10, tubeCurrentMA: 200, mAs: 2.0, viewPosition: 'AP', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }, { tag: '(0008,0070)', name: 'Manufacturer', vr: 'LO', value: 'Mindray' }, { tag: '(0018,0060)', name: 'KVP', vr: 'DS', value: '65' }, { tag: '(0018,5101)', name: 'ViewPosition', vr: 'CS', value: 'AP' }] }] },
          },
          {
            id: 'orthanc-series-002-2', seriesNumber: 2, seriesDescription: 'Rodilla Derecha LAT', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.892.2', bodyPartExamined: 'KNEE', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-002-2-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.892.2.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 2100, windowWidth: 3800, previewUrl: '/api/orthanc/instances/orthanc-inst-002-2-1/preview', fileSize: 4194304, kvp: 65, exposureTimeMs: 10, tubeCurrentMA: 200, mAs: 2.0, viewPosition: 'LAT', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }, { tag: '(0008,0070)', name: 'Manufacturer', vr: 'LO', value: 'Mindray' }] }] },
          },
        ],
      },
    },
  });

  // Study 3: ACC-2026-0893
  await prisma.study.create({
    data: {
      id: 'orthanc-study-003', accessionNumber: 'ACC-2026-0893', studyInstanceUid: '1.2.840.113619.2.55.3.2831172839.893',
      patientId: 'pat-8839201948', patientDocument: '8839201948', patientName: 'Mendoza Castro, Carlos Alberto',
      patientSex: 'M', patientBirthDate: '1991-08-03', studyDate: '2026-07-29', studyTime: '09:45:12',
      studyDescription: 'Rx Columna Lumbar AP y Lateral', modality: 'DX', referringPhysician: 'Dr. Hernán Ramírez',
      performingTechnician: 'Téc. Fernando Ruiz', institutionName: 'Consultorio de Rayos X - Mindray DigiEye 330',
      manufacturer: 'Mindray', manufacturerModelName: 'DigiEye 330 Series', numberOfSeries: 2, numberOfInstances: 2,
      status: 'En Revisión', notes: 'Lumbalgia aguda súbita tras levantar objeto pesado.',
      createdAt: '2026-07-29T09:46:00Z',
      series: {
        create: [
          {
            id: 'orthanc-series-003-1', seriesNumber: 1, seriesDescription: 'Columna Lumbar AP', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.893.1', bodyPartExamined: 'SPINE', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-003-1-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.893.1.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 2200, windowWidth: 4000, previewUrl: '/api/orthanc/instances/orthanc-inst-003-1-1/preview', fileSize: 4194304, kvp: 80, exposureTimeMs: 25, tubeCurrentMA: 250, mAs: 6.25, viewPosition: 'AP', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }, { tag: '(0008,0070)', name: 'Manufacturer', vr: 'LO', value: 'Mindray' }, { tag: '(0018,0060)', name: 'KVP', vr: 'DS', value: '80' }] }] },
          },
          {
            id: 'orthanc-series-003-2', seriesNumber: 2, seriesDescription: 'Columna Lumbar Lateral', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.893.2', bodyPartExamined: 'SPINE', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-003-2-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.893.2.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 2200, windowWidth: 4000, previewUrl: '/api/orthanc/instances/orthanc-inst-003-2-1/preview', fileSize: 4194304, kvp: 90, exposureTimeMs: 32, tubeCurrentMA: 250, mAs: 8.0, viewPosition: 'LAT', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }] }] },
          },
        ],
      },
    },
  });

  // Study 4: ACC-2026-0894
  await prisma.study.create({
    data: {
      id: 'orthanc-study-004', accessionNumber: 'ACC-2026-0894', studyInstanceUid: '1.2.840.113619.2.55.3.2831172839.894',
      patientId: 'pat-7728193840', patientDocument: '7728193840', patientName: 'López Vargas, Sofía Valentina',
      patientSex: 'F', patientBirthDate: '2002-02-18', studyDate: '2026-07-27', studyTime: '14:30:00',
      studyDescription: 'Rx Mano Izquierda AP y Oblicua', modality: 'DX', referringPhysician: 'Dra. Patricia Gómez',
      performingTechnician: 'Téc. Fernando Ruiz', institutionName: 'Consultorio de Rayos X - Mindray DigiEye 330',
      manufacturer: 'Mindray', manufacturerModelName: 'DigiEye 330 Series', numberOfSeries: 2, numberOfInstances: 2,
      status: 'Informado', notes: 'Traumatismo directo en 3er metacarpiano jugando baloncesto.',
      createdAt: '2026-07-27T14:31:00Z',
      series: {
        create: [
          {
            id: 'orthanc-series-004-1', seriesNumber: 1, seriesDescription: 'Mano Izquierda AP', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.894.1', bodyPartExamined: 'HAND', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-004-1-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.894.1.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 1800, windowWidth: 3200, previewUrl: '/api/orthanc/instances/orthanc-inst-004-1-1/preview', fileSize: 4194304, kvp: 52, exposureTimeMs: 8, tubeCurrentMA: 160, mAs: 1.28, viewPosition: 'AP', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }, { tag: '(0018,0060)', name: 'KVP', vr: 'DS', value: '52' }] }] },
          },
          {
            id: 'orthanc-series-004-2', seriesNumber: 2, seriesDescription: 'Mano Izquierda Oblicua', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.894.2', bodyPartExamined: 'HAND', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-004-2-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.894.2.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 1800, windowWidth: 3200, previewUrl: '/api/orthanc/instances/orthanc-inst-004-2-1/preview', fileSize: 4194304, kvp: 52, exposureTimeMs: 8, tubeCurrentMA: 160, mAs: 1.28, viewPosition: 'OBL', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }] }] },
          },
        ],
      },
    },
  });

  // Study 5: ACC-2026-0895
  await prisma.study.create({
    data: {
      id: 'orthanc-study-005', accessionNumber: 'ACC-2026-0895', studyInstanceUid: '1.2.840.113619.2.55.3.2831172839.895',
      patientId: 'pat-3392019485', patientDocument: '3392019485', patientName: 'Silva Morales, Roberto Antonio',
      patientSex: 'M', patientBirthDate: '1974-09-30', studyDate: '2026-07-28', studyTime: '09:00:00',
      studyDescription: 'Rx Cráneo AP y Lateral', modality: 'DX', referringPhysician: 'Dr. Santiago Ortiz',
      performingTechnician: 'Téc. Fernando Ruiz', institutionName: 'Consultorio de Rayos X - Mindray DigiEye 330',
      manufacturer: 'Mindray', manufacturerModelName: 'DigiEye 330 Series', numberOfSeries: 2, numberOfInstances: 2,
      status: 'Informado', notes: 'Cefalea holocraneana de reciente aparición. Descarte de lesiones óseas.',
      createdAt: '2026-07-28T09:01:00Z',
      series: {
        create: [
          {
            id: 'orthanc-series-005-1', seriesNumber: 1, seriesDescription: 'Cráneo AP', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.895.1', bodyPartExamined: 'SKULL', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-005-1-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.895.1.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 2000, windowWidth: 3600, previewUrl: '/api/orthanc/instances/orthanc-inst-005-1-1/preview', fileSize: 4194304, kvp: 75, exposureTimeMs: 18, tubeCurrentMA: 200, mAs: 3.6, viewPosition: 'AP', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }] }] },
          },
          {
            id: 'orthanc-series-005-2', seriesNumber: 2, seriesDescription: 'Cráneo Lateral', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.895.2', bodyPartExamined: 'SKULL', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-005-2-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.895.2.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 2000, windowWidth: 3600, previewUrl: '/api/orthanc/instances/orthanc-inst-005-2-1/preview', fileSize: 4194304, kvp: 75, exposureTimeMs: 18, tubeCurrentMA: 200, mAs: 3.6, viewPosition: 'LAT', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }] }] },
          },
        ],
      },
    },
  });

  // Study 6: ACC-2026-0896
  await prisma.study.create({
    data: {
      id: 'orthanc-study-006', accessionNumber: 'ACC-2026-0896', studyInstanceUid: '1.2.840.113619.2.55.3.2831172839.896',
      patientId: 'pat-9918273645', patientDocument: '9918273645', patientName: 'Torres Benítez, Ana Lucía',
      patientSex: 'F', patientBirthDate: '1997-06-14', studyDate: '2026-07-29', studyTime: '07:30:00',
      studyDescription: 'Rx Tobillo Izquierdo AP y Lateral', modality: 'DX', referringPhysician: 'Dr. Hernán Ramírez',
      performingTechnician: 'Téc. Fernando Ruiz', institutionName: 'Consultorio de Rayos X - Mindray DigiEye 330',
      manufacturer: 'Mindray', manufacturerModelName: 'DigiEye 330 Series', numberOfSeries: 2, numberOfInstances: 2,
      status: 'Recibido', notes: 'Esguince de tobillo jugando al voleibol hace 24 horas.',
      createdAt: '2026-07-29T07:31:00Z',
      series: {
        create: [
          {
            id: 'orthanc-series-006-1', seriesNumber: 1, seriesDescription: 'Tobillo Izquierdo AP', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.896.1', bodyPartExamined: 'ANKLE', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-006-1-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.896.1.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 1900, windowWidth: 3500, previewUrl: '/api/orthanc/instances/orthanc-inst-006-1-1/preview', fileSize: 4194304, kvp: 60, exposureTimeMs: 10, tubeCurrentMA: 160, mAs: 1.6, viewPosition: 'AP', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }] }] },
          },
          {
            id: 'orthanc-series-006-2', seriesNumber: 2, seriesDescription: 'Tobillo Izquierdo LAT', modality: 'DX',
            seriesInstanceUid: '1.2.840.113619.2.55.3.2831172839.896.2', bodyPartExamined: 'ANKLE', numberOfInstances: 1,
            instances: { create: [{ id: 'orthanc-inst-006-2-1', instanceNumber: 1, sopInstanceUid: '1.2.840.113619.2.55.3.2831172839.896.2.1', numberOfFrames: 1, rows: 2048, columns: 2048, windowCenter: 1900, windowWidth: 3500, previewUrl: '/api/orthanc/instances/orthanc-inst-006-2-1/preview', fileSize: 4194304, kvp: 60, exposureTimeMs: 10, tubeCurrentMA: 160, mAs: 1.6, viewPosition: 'LAT', tags: [{ tag: '(0008,0060)', name: 'Modality', vr: 'CS', value: 'DX' }] }] },
          },
        ],
      },
    },
  });

  // Audit Logs
  await Promise.all([
    prisma.auditLog.create({ data: { id: 'aud-001', timestamp: '2026-07-29T08:16:05Z', userId: 'usr-003', userName: 'Téc. Fernando Ruiz', userRole: 'Tecnico', action: 'ORTHANC_SYNC', description: 'Recepción DICOM C-STORE automática desde Mindray DigiEye 330 (AET: MINDRAY_DROC)', ipAddress: '192.168.1.105', details: 'Estudio ACC-2026-0891 (Rx Tórax AP/LAT) de Juan Carlos Pérez Gómez sincronizado exitosamente.' } }),
    prisma.auditLog.create({ data: { id: 'aud-002', timestamp: '2026-07-29T08:20:12Z', userId: 'usr-002', userName: 'Dra. Patricia Gómez', userRole: 'Radiologo', action: 'LOGIN', description: 'Inicio de sesión exitoso en Mini PACS Web', ipAddress: '192.168.1.42' } }),
    prisma.auditLog.create({ data: { id: 'aud-003', timestamp: '2026-07-29T08:22:45Z', userId: 'usr-002', userName: 'Dra. Patricia Gómez', userRole: 'Radiologo', action: 'STUDY_VIEW', description: 'Apertura de estudio ACC-2026-0891 en Visor OHIF DICOM', ipAddress: '192.168.1.42', details: 'Visualización de 2 series (AP / LAT). Herramientas utilizadas: WW/WL preset Tórax.' } }),
    prisma.auditLog.create({ data: { id: 'aud-004', timestamp: '2026-07-29T09:15:00Z', userId: 'usr-001', userName: 'Dr. Alejandro Morales', userRole: 'Admin', action: 'PATIENT_UPDATE', description: 'Actualización de datos del paciente Juan Carlos Pérez Gómez', ipAddress: '192.168.1.10', details: 'Se actualizó teléfono de contacto y correo electrónico.' } }),
  ]);

  // PacsConfig: inicia sin configuracion (el admin debe completarla en Configuracion)
  await prisma.pacsConfig.create({
    data: { id: 1, orthancServerUrl: '', localAETitle: '', remoteAETitle: '', remoteIp: '', remotePort: 0, autoSyncIntervalSec: 0, retentionDays: 0, anonymizeExportDefault: false, institutionName: '', isConfigured: false },
  });

  // OrthancStatus
  await prisma.orthancStatus.create({
    data: { id: 1, online: false, version: '', aetitle: '', dicomPort: 0, httpPort: 0, storageUsageMb: 0, patientCount: 0, studyCount: 0, seriesCount: 0, instanceCount: 0, lastSyncTime: '', connectedEquipment: [] },
  });

  console.log('Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error durante seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
