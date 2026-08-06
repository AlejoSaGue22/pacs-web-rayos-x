import 'dotenv/config';

const ORTHANC = process.env.ORTHANC_URL || 'http://localhost:8042';
const AUTH = Buffer.from(`${process.env.ORTHANC_USER}:${process.env.ORTHANC_PASS}`).toString('base64');

async function createDicom(tags: Record<string, string>) {
  const res = await fetch(`${ORTHANC}/tools/create-dicom`, {
    method: 'POST',
    headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(tags),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Orthanc error ${res.status}: ${err}`);
  }
  return res.json();
}

const STUDIES = [
  {
    patientName: 'Perez^Juan Carlos',
    patientId: '1029384756',
    patientSex: 'M',
    patientBirthDate: '19780412',
    studyDate: '20260729',
    studyTime: '093000',
    studyDesc: 'Rx Torax PA y Lateral',
    manufacturer: 'Mindray',
    manufacturerModel: 'DigiEye 330 Series',
    institution: 'Consultorio de Rayos X - Mindray DigiEye 330',
    accession: 'ACC-2026-0991',
    series: [
      { desc: 'Torax PA', view: 'PA', kvp: '120', exp: '10', ma: '250', num: '1' },
      { desc: 'Torax Lateral', view: 'LAT', kvp: '125', exp: '14', ma: '250', num: '2' },
    ],
  },
  {
    patientName: 'Rodriguez^Maria Elena',
    patientId: '5549301284',
    patientSex: 'F',
    patientBirthDate: '19641125',
    studyDate: '20260729',
    studyTime: '103000',
    studyDesc: 'Rx Columna Cervical AP y Lateral',
    manufacturer: 'Mindray',
    manufacturerModel: 'DigiEye 330 Series',
    institution: 'Consultorio de Rayos X - Mindray DigiEye 330',
    accession: 'ACC-2026-0992',
    series: [
      { desc: 'Columna Cervical AP', view: 'AP', kvp: '75', exp: '20', ma: '200', num: '1' },
      { desc: 'Columna Cervical Lateral', view: 'LAT', kvp: '80', exp: '25', ma: '200', num: '2' },
    ],
  },
  {
    patientName: 'Mendoza^Carlos Alberto',
    patientId: '8839201948',
    patientSex: 'M',
    patientBirthDate: '19910803',
    studyDate: '20260729',
    studyTime: '140000',
    studyDesc: 'Rx Abdomen Simple AP',
    manufacturer: 'Mindray',
    manufacturerModel: 'DigiEye 330 Series',
    institution: 'Consultorio de Rayos X - Mindray DigiEye 330',
    accession: 'ACC-2026-0993',
    series: [
      { desc: 'Abdomen AP', view: 'AP', kvp: '80', exp: '45', ma: '300', num: '1' },
    ],
  },
  {
    patientName: 'Lopez^Sofia Valentina',
    patientId: '7728193840',
    patientSex: 'F',
    patientBirthDate: '20020218',
    studyDate: '20260729',
    studyTime: '083000',
    studyDesc: 'Rx Muneca Derecha AP y Lateral',
    manufacturer: 'Mindray',
    manufacturerModel: 'DigiEye 330 Series',
    institution: 'Consultorio de Rayos X - Mindray DigiEye 330',
    accession: 'ACC-2026-0994',
    series: [
      { desc: 'Muneca Derecha AP', view: 'AP', kvp: '55', exp: '6', ma: '160', num: '1' },
      { desc: 'Muneca Derecha Lateral', view: 'LAT', kvp: '58', exp: '8', ma: '160', num: '2' },
    ],
  },
];

async function main() {
  console.log('Subiendo estudios DICOM de prueba a Orthanc...\n');

  for (const s of STUDIES) {
    for (const ser of s.series) {
      const tags: Record<string, string> = {
        PatientName: s.patientName,
        PatientID: s.patientId,
        PatientSex: s.patientSex,
        PatientBirthDate: s.patientBirthDate,
        StudyDate: s.studyDate,
        StudyTime: s.studyTime,
        StudyDescription: s.studyDesc,
        Modality: 'DX',
        BodyPartExamined: ser.desc.includes('Torax') ? 'CHEST'
          : ser.desc.includes('Columna') ? 'CSPINE'
            : ser.desc.includes('Abdomen') ? 'ABDOMEN'
              : ser.desc.includes('Muneca') ? 'HAND'
                : '',
        Manufacturer: s.manufacturer,
        ManufacturerModelName: s.manufacturerModel,
        InstitutionName: s.institution,
        AccessionNumber: s.accession,
        ViewPosition: ser.view,
        KVP: ser.kvp,
        ExposureTime: ser.exp,
        XRayTubeCurrent: ser.ma,
        SeriesDescription: ser.desc,
        SeriesNumber: ser.num,
        InstanceNumber: '1',
      };

      try {
        const result = await createDicom(tags);
        console.log(`  OK: ${s.accession} / ${ser.desc} → inst ${result.ID}`);
      } catch (err) {
        console.error(`  FAIL: ${s.accession} / ${ser.desc}:`, (err as Error).message);
      }
    }
  }

  console.log('\nCarga DICOM completada.');
}

main();
