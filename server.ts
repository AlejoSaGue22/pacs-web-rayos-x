import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { pacsStore } from './server/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', server: 'Mini PACS Web Server', timestamp: new Date().toISOString() });
  });

  // Auth Endpoints
  app.post('/api/auth/login', (req, res) => {
    const { email, role } = req.body;
    const users = pacsStore.getUsers();
    const user = users.find(u => u.email === email || u.role === role) || users[0];

    pacsStore.addAuditLog({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN',
      description: `Inicio de sesión exitoso como ${user.role} (${user.name})`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      token: `jwt-mock-token-${user.id}-${Date.now()}`,
      user,
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const users = pacsStore.getUsers();
    res.json(users[0]);
  });

  app.post('/api/auth/switch-role', (req, res) => {
    const { role } = req.body;
    const users = pacsStore.getUsers();
    const targetUser = users.find(u => u.role === role) || {
      id: `usr-custom-${Date.now()}`,
      name: `Usuario ${role}`,
      email: `${role.toLowerCase()}@rayosx.med.co`,
      role: role,
    };

    pacsStore.addAuditLog({
      userId: targetUser.id,
      userName: targetUser.name,
      userRole: targetUser.role,
      action: 'LOGIN',
      description: `Cambio de perfil/rol activo a ${role}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({ user: targetUser });
  });

  // Dashboard Stats
  app.get('/api/dashboard/stats', (req, res) => {
    const allStudies = pacsStore.getStudies();
    const allPatients = pacsStore.getPatients();
    const todayStr = new Date().toISOString().slice(0, 10);

    const studiesToday = allStudies.filter(s => s.studyDate === todayStr);
    const studiesMonthCount = allStudies.length; // mock current month

    const modalityCounts: Record<string, number> = {};
    allStudies.forEach(s => {
      modalityCounts[s.modality] = (modalityCounts[s.modality] || 0) + 1;
    });

    const statusCounts: Record<string, number> = {};
    allStudies.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    const recentStudies = allStudies.slice(0, 5);
    const recentAudit = pacsStore.getAuditLogs('ALL').slice(0, 5);
    const orthanc = pacsStore.getOrthancStatus();

    res.json({
      totalPatients: allPatients.length,
      studiesToday: studiesToday.length,
      studiesMonth: studiesMonthCount,
      totalStorageMb: orthanc.storageUsageMb,
      modalityCounts,
      statusCounts,
      recentStudies,
      recentAudit,
      orthancOnline: orthanc.online,
    });
  });

  // Patients CRUD
  app.get('/api/patients', (req, res) => {
    const search = req.query.search as string;
    const patients = pacsStore.getPatients(search);
    res.json(patients);
  });

  app.get('/api/patients/:id', (req, res) => {
    const patient = pacsStore.getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const studies = pacsStore.getStudies({ searchTerm: patient.documentNumber });
    res.json({ ...patient, studies });
  });

  app.post('/api/patients', (req, res) => {
    const { firstName, lastName, documentNumber, birthDate, gender, phone, email, userId, userName, userRole } = req.body;
    if (!firstName || !lastName || !documentNumber) {
      return res.status(400).json({ error: 'Nombre, Apellido y Documento son obligatorios' });
    }

    const newPatient = pacsStore.createPatient(
      { firstName, lastName, documentNumber, birthDate, gender, phone, email },
      userId || 'usr-001',
      userName || 'Usuario PACS',
      userRole || 'Admin'
    );

    res.status(201).json(newPatient);
  });

  app.put('/api/patients/:id', (req, res) => {
    const { userId, userName, userRole, ...updates } = req.body;
    const updated = pacsStore.updatePatient(
      req.params.id,
      updates,
      userId || 'usr-001',
      userName || 'Usuario PACS',
      userRole || 'Admin'
    );

    if (!updated) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    res.json(updated);
  });

  app.delete('/api/patients/:id', (req, res) => {
    const { userId, userName, userRole } = req.body;
    const success = pacsStore.deletePatient(
      req.params.id,
      userId || 'usr-001',
      userName || 'Usuario PACS',
      userRole || 'Admin'
    );

    if (!success) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    res.json({ message: 'Paciente eliminado lógicamente con éxito' });
  });

  // Studies Endpoints
  app.get('/api/studies', (req, res) => {
    const filters = {
      searchTerm: req.query.searchTerm as string,
      modality: req.query.modality as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      status: req.query.status as string,
    };
    const studies = pacsStore.getStudies(filters);
    res.json(studies);
  });

  app.get('/api/studies/:id', (req, res) => {
    const study = pacsStore.getStudyById(req.params.id);
    if (!study) {
      return res.status(404).json({ error: 'Estudio no encontrado' });
    }

    // Log study viewing
    pacsStore.addAuditLog({
      userId: (req.query.userId as string) || 'usr-002',
      userName: (req.query.userName as string) || 'Dra. Patricia Gómez',
      userRole: (req.query.userRole as any) || 'Radiologo',
      action: 'STUDY_VIEW',
      description: `Apertura de metadatos de estudio ${study.accessionNumber} (${study.patientName})`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json(study);
  });

  app.put('/api/studies/:id/status', (req, res) => {
    const { status, userId, userName, userRole } = req.body;
    const updated = pacsStore.updateStudyStatus(
      req.params.id,
      status,
      userId || 'usr-002',
      userName || 'Dra. Patricia Gómez',
      userRole || 'Radiologo'
    );

    if (!updated) {
      return res.status(404).json({ error: 'Estudio no encontrado' });
    }
    res.json(updated);
  });

  // Orthanc DICOM REST API endpoints
  app.get('/api/orthanc/status', (req, res) => {
    res.json(pacsStore.getOrthancStatus());
  });

  app.post('/api/orthanc/sync', (req, res) => {
    const { userId, userName, userRole } = req.body;
    const result = pacsStore.syncWithOrthanc(
      userId || 'usr-001',
      userName || 'Usuario PACS',
      userRole || 'Admin'
    );
    res.json(result);
  });

  app.get('/api/orthanc/instances/:id/tags', (req, res) => {
    const item = pacsStore.getInstanceById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Instancia DICOM no encontrada en Orthanc' });
    }
    res.json({
      instanceId: item.instance.id,
      sopInstanceUid: item.instance.sopInstanceUid,
      studyInstanceUid: item.study.studyInstanceUid,
      seriesInstanceUid: item.series.seriesInstanceUid,
      tags: item.instance.tags,
      hardware: {
        manufacturer: item.study.manufacturer,
        model: item.study.manufacturerModelName,
        kvp: item.instance.kvp,
        exposureTimeMs: item.instance.exposureTimeMs,
        tubeCurrentMA: item.instance.tubeCurrentMA,
        mAs: item.instance.mAs,
      }
    });
  });

  // Audit Logs
  app.get('/api/audit', (req, res) => {
    const action = req.query.action as string;
    const search = req.query.search as string;
    res.json(pacsStore.getAuditLogs(action, search));
  });

  // Config
  app.get('/api/config', (req, res) => {
    res.json(pacsStore.getPacsConfig());
  });

  app.put('/api/config', (req, res) => {
    const { userId, userName, userRole, ...configUpdates } = req.body;
    const updated = pacsStore.updatePacsConfig(
      configUpdates,
      userId || 'usr-001',
      userName || 'Admin PACS',
      userRole || 'Admin'
    );
    res.json(updated);
  });

  // Users
  app.get('/api/users', (req, res) => {
    res.json(pacsStore.getUsers());
  });

  // Vite Integration (Dev Mode)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mini PACS Web Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
