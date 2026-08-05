import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import { pacsStore } from './server/store.js';
import { OrthancClient } from './server/orthancClient.js';
import { authenticate, generateToken, AuthPayload } from './server/authMiddleware.js';

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
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const users = await pacsStore.getUsers();
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, (user as any).passwordHash || '');
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken({
      userId: user.id,
      userRole: user.role,
      userName: user.name,
    });

    await pacsStore.addAuditLog({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'LOGIN',
      description: `Inicio de sesión exitoso como ${user.role} (${user.name})`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({ token, user });
  });

  app.get('/api/auth/me', authenticate, async (req, res) => {
    const users = await pacsStore.getUsers();
    const user = users.find(u => u.id === req.user?.userId) || users[0];
    res.json(user);
  });

  app.post('/api/auth/switch-role', authenticate, async (req, res) => {
    const { role } = req.body;
    const users = await pacsStore.getUsers();
    const targetUser = users.find(u => u.role === role);

    if (!targetUser) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    const token = generateToken({
      userId: targetUser.id,
      userRole: targetUser.role,
      userName: targetUser.name,
    });

    await pacsStore.addAuditLog({
      userId: targetUser.id,
      userName: targetUser.name,
      userRole: targetUser.role,
      action: 'LOGIN',
      description: `Cambio de perfil/rol activo a ${role}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({ token, user: targetUser });
  });

  // Dashboard Stats
  app.get('/api/dashboard/stats', async (req, res) => {
    const allStudies = await pacsStore.getStudies();
    const allPatients = await pacsStore.getPatients();
    const todayStr = new Date().toISOString().slice(0, 10);

    const studiesToday = allStudies.filter(s => s.studyDate === todayStr);
    const studiesMonthCount = allStudies.length;

    const modalityCounts: Record<string, number> = {};
    allStudies.forEach(s => {
      modalityCounts[s.modality] = (modalityCounts[s.modality] || 0) + 1;
    });

    const statusCounts: Record<string, number> = {};
    allStudies.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    const recentStudies = allStudies.slice(0, 5);
    const recentAudit = (await pacsStore.getAuditLogs('ALL')).slice(0, 5);
    const orthanc = await pacsStore.getOrthancStatus();

    res.json({
      totalPatients: allPatients.length,
      studiesToday: studiesToday.length,
      studiesMonth: studiesMonthCount,
      totalStorageMb: orthanc?.storageUsageMb,
      modalityCounts,
      statusCounts,
      recentStudies,
      recentAudit,
      orthancOnline: orthanc?.online,
    });
  });

  // Patients CRUD
  app.get('/api/patients', async (req, res) => {
    const search = req.query.search as string;
    const patients = await pacsStore.getPatients(search);
    res.json(patients);
  });

  app.get('/api/patients/:id', async (req, res) => {
    const patient = await pacsStore.getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const studies = await pacsStore.getStudies({ searchTerm: patient.documentNumber });
    res.json({ ...patient, studies });
  });

  app.post('/api/patients', authenticate, async (req, res) => {
    const { firstName, lastName, documentNumber, birthDate, gender, phone, email } = req.body;
    if (!firstName || !lastName || !documentNumber) {
      return res.status(400).json({ error: 'Nombre, Apellido y Documento son obligatorios' });
    }

    const newPatient = await pacsStore.createPatient(
      { firstName, lastName, documentNumber, birthDate, gender, phone, email },
      req.user!.userId,
      req.user!.userName,
      req.user!.userRole
    );

    res.status(201).json(newPatient);
  });

  app.put('/api/patients/:id', authenticate, async (req, res) => {
    const { ...updates } = req.body;
    const updated = await pacsStore.updatePatient(
      req.params.id,
      updates,
      req.user!.userId,
      req.user!.userName,
      req.user!.userRole
    );

    if (!updated) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    res.json(updated);
  });

  app.delete('/api/patients/:id', authenticate, async (req, res) => {
    const success = await pacsStore.deletePatient(
      req.params.id,
      req.user!.userId,
      req.user!.userName,
      req.user!.userRole
    );

    if (!success) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    res.json({ message: 'Paciente eliminado lógicamente con éxito' });
  });

  // Studies Endpoints
  app.get('/api/studies', async (req, res) => {
    const filters = {
      searchTerm: req.query.searchTerm as string,
      modality: req.query.modality as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      status: req.query.status as string,
    };
    const studies = await pacsStore.getStudies(filters);
    res.json(studies);
  });

  app.get('/api/studies/:id', async (req, res) => {
    const study = await pacsStore.getStudyById(req.params.id);
    if (!study) {
      return res.status(404).json({ error: 'Estudio no encontrado' });
    }

    await pacsStore.addAuditLog({
      userId: (req.query.userId as string) || 'usr-002',
      userName: (req.query.userName as string) || 'Dra. Patricia Gómez',
      userRole: (req.query.userRole as any) || 'Radiologo',
      action: 'STUDY_VIEW',
      description: `Apertura de metadatos de estudio ${study.accessionNumber} (${study.patientName})`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json(study);
  });

  app.put('/api/studies/:id/status', authenticate, async (req, res) => {
    const { status } = req.body;
    const updated = await pacsStore.updateStudyStatus(
      req.params.id,
      status,
      req.user!.userId,
      req.user!.userName,
      req.user!.userRole
    );

    if (!updated) {
      return res.status(404).json({ error: 'Estudio no encontrado' });
    }
    res.json(updated);
  });

  // Orthanc DICOM REST API endpoints
  app.get('/api/orthanc/status', async (req, res) => {
    res.json(await pacsStore.getOrthancStatus());
  });

  app.post('/api/orthanc/sync', authenticate, async (req, res) => {
    const result = await pacsStore.syncWithOrthanc(
      req.user!.userId,
      req.user!.userName,
      req.user!.userRole
    );
    res.json(result);
  });

  app.get('/api/orthanc/instances/:id/tags', async (req, res) => {
    const item = await pacsStore.getInstanceById(req.params.id);
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

  app.get('/api/orthanc/dicom/:instanceId', async (req, res) => {
    const { instanceId } = req.params;
    try {
      const orthancUrl = `${process.env.ORTHANC_URL || 'http://localhost:8042'}`;
      const token = Buffer.from('orthanc:orthanc').toString('base64');
      const response = await fetch(`${orthancUrl}/instances/${instanceId}/file`, {
        headers: { Authorization: `Basic ${token}` },
      });
      if (!response.ok) {
        return res.status(404).json({ error: 'DICOM file not found in Orthanc' });
      }
      const arrayBuffer = await response.arrayBuffer();
      res.set({
        'Content-Type': 'application/dicom',
        'Content-Length': arrayBuffer.byteLength.toString(),
      });
      res.send(Buffer.from(arrayBuffer));
    } catch {
      res.status(502).json({ error: 'Error fetching DICOM from Orthanc' });
    }
  });

  // Audit Logs
  app.get('/api/audit', async (req, res) => {
    const action = req.query.action as string;
    const search = req.query.search as string;
    res.json(await pacsStore.getAuditLogs(action, search));
  });

  // Config
  app.get('/api/config', async (req, res) => {
    res.json(await pacsStore.getPacsConfig());
  });

  app.put('/api/config', authenticate, async (req, res) => {
    const configUpdates = req.body;
    const updated = await pacsStore.updatePacsConfig(
      configUpdates,
      req.user!.userId,
      req.user!.userName,
      req.user!.userRole
    );
    res.json(updated);
  });

  // Users
  app.get('/api/users', async (req, res) => {
    res.json(await pacsStore.getUsers());
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
