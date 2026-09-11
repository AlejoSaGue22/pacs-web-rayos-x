const ORTHANC_URL = process.env.ORTHANC_URL || 'http://localhost:8042';
const ORTHANC_USER = process.env.ORTHANC_USER;
const ORTHANC_PASS = process.env.ORTHANC_PASS;

if (!ORTHANC_USER || !ORTHANC_PASS) {
  console.error('[ERROR] ORTHANC_USER y ORTHANC_PASS deben estar definidas en .env');
  process.exit(1);
}

function authHeaders(): Record<string, string> {
  const token = Buffer.from(`${ORTHANC_USER}:${ORTHANC_PASS}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

async function orthancGet(path: string) {
  const res = await fetch(`${ORTHANC_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Orthanc GET ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function orthancPost(path: string, body?: any, contentType?: string) {
  const headers: Record<string, string> = authHeaders();
  if (contentType) headers['Content-Type'] = contentType;
  else if (body && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(`${ORTHANC_URL}${path}`, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`Orthanc POST ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

export const OrthancClient = {
  getSystem() {
    return orthancGet('/system');
  },

  getPatients() {
    return orthancGet('/patients');
  },

  getPatient(patientId: string) {
    return orthancGet(`/patients/${patientId}`);
  },

  getStudies() {
    return orthancGet('/studies');
  },

  getStudy(studyId: string) {
    return orthancGet(`/studies/${studyId}`);
  },

  getSeries(seriesId: string) {
    return orthancGet(`/series/${seriesId}`);
  },

  getInstance(instanceId: string) {
    return orthancGet(`/instances/${instanceId}`);
  },

  getInstanceTags(instanceId: string) {
    return orthancGet(`/instances/${instanceId}/simplified-tags`);
  },

  getInstanceFullTags(instanceId: string) {
    return orthancGet(`/instances/${instanceId}/tags`);
  },

  getModalities() {
    return orthancGet('/modalities');
  },

  getModality(name: string) {
    return orthancGet(`/modalities/${name}`);
  },

  getSeriesOfStudy(studyId: string) {
    return orthancGet(`/studies/${studyId}/series`);
  },

  getInstancesOfSeries(seriesId: string) {
    return orthancGet(`/series/${seriesId}/instances`);
  },

  getInstancesOfStudy(studyId: string) {
    return orthancGet(`/studies/${studyId}/instances`);
  },

  async uploadDicomFile(buffer: Buffer) {
    const headers: Record<string, string> = {
      ...authHeaders(),
      'Content-Type': 'application/octet-stream',
    };
    const res = await fetch(`${ORTHANC_URL}/instances`, {
      method: 'POST',
      headers,
      body: new Uint8Array(buffer),
    });
    if (!res.ok) throw new Error(`Orthanc upload DICOM: ${res.status} ${res.statusText}`);
    return res.json();
  },

  async downloadBinary(path: string): Promise<{ contentType: string; data: ArrayBuffer }> {
    const res = await fetch(`${ORTHANC_URL}${path}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Orthanc download ${path}: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const data = await res.arrayBuffer();
    return { contentType, data };
  },

  async downloadStudyArchive(studyId: string): Promise<{ contentType: string; data: ArrayBuffer }> {
    return this.downloadBinary(`/studies/${studyId}/archive`);
  },

  async streamStudyArchive(studyId: string, res: any) {
    const response = await fetch(`${ORTHANC_URL}/studies/${studyId}/archive`, { headers: authHeaders() });
    if (!response.ok) throw new Error(`Orthanc stream archive: ${response.status}`);
    const contentType = response.headers.get('content-type') || 'application/zip';
    res.set('Content-Type', contentType);
    
    // In Node 18+ response.body is ReadableStream
    const { Readable } = require('stream');
    if (response.body) {
      Readable.fromWeb(response.body as any).pipe(res);
    } else {
      res.end();
    }
  },
};
