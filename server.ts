import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import { pacsStore, prisma } from './server/store.js';
import { OrthancClient } from './server/orthancClient.js';
import { authenticate, authorize, generateToken, AuthPayload } from './server/authMiddleware.js';
import { generateStudyPdf } from './server/pdfReport.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import * as http from 'http';
import { Server } from 'socket.io';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'ORTHANC_URL', 'ORTHANC_USER', 'ORTHANC_PASS'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[ERROR] Variables de entorno faltantes: ${missing.join(', ')}`);
    console.error('Copia .env.example a .env y configura las variables necesarias.');
    process.exit(1);
  }
}

async function startServer() {
  validateEnv();

  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  const PORT = parseInt(process.env.PORT || '3000', 10);

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

    await pacsStore.updateUserLastLogin(user.id);

    res.json({ token, user });
  });

  app.get('/api/auth/me', authenticate, async (req, res) => {
    const users = await pacsStore.getUsers();
    const user = users.find(u => u.id === req.user?.userId) || users[0];
    res.json(user);
  });

  // Dashboard Stats
  app.get('/api/dashboard/stats', authenticate, async (req, res) => {
    const todayStr = new Date().toISOString().slice(0, 10);

    const [totalPatients, studiesToday, studiesMonth, modalityCounts, statusCounts,
           recentStudies, recentAudit, orthanc] = await Promise.all([
      prisma.patient.count({ where: { isDeleted: false } }),
      prisma.study.count({ where: { studyDate: todayStr } }),
      prisma.study.count(),
      prisma.study.groupBy({ by: ['modality'], _count: { modality: true } }),
      prisma.study.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.study.findMany({
        orderBy: [{ studyDate: 'desc' }, { studyTime: 'desc' }],
        take: 5,
        include: { series: { include: { instances: true } } },
      }),
      prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 5 }),
      pacsStore.getOrthancStatus(),
    ]);

    const modalityCountsObj: Record<string, number> = {};
    modalityCounts.forEach((g: any) => { modalityCountsObj[g.modality] = g._count.modality; });

    const statusCountsObj: Record<string, number> = {};
    statusCounts.forEach((g: any) => { statusCountsObj[g.status] = g._count.status; });

    res.json({
      totalPatients,
      studiesToday,
      studiesMonth,
      totalStorageMb: orthanc?.storageUsageMb,
      modalityCounts: modalityCountsObj,
      statusCounts: statusCountsObj,
      recentStudies,
      recentAudit,
      orthancOnline: orthanc?.online,
      connectedEquipment: orthanc?.connectedEquipment || [],
    });
  });

  app.get('/api/dashboard/weekly-stats', authenticate, async (req, res) => {
    res.json(await pacsStore.getWeeklyStats());
  });

  // Patients CRUD
  app.get('/api/patients', authenticate, async (req, res) => {
    const result = await pacsStore.getPatients({
      search: req.query.search as string,
      page: parseInt(req.query.page as string),
      pageSize: parseInt(req.query.pageSize as string),
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string,
    });
    res.json(result);
  });

  app.get('/api/patients/:id', authenticate, async (req, res) => {
    const patient = await pacsStore.getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const studies = await pacsStore.getStudiesByPatientDocument(patient.documentNumber);
    res.json({ ...patient, studies });
  });

  app.get('/api/patients/:id/studies', authenticate, async (req, res) => {
    const patient = await pacsStore.getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const studies = await pacsStore.getStudiesByPatientDocument(patient.documentNumber);
    res.json(studies);
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

  app.delete('/api/patients/:id', authenticate, authorize('Admin'), async (req, res) => {
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
  app.get('/api/studies', authenticate, async (req, res) => {
    const result = await pacsStore.getStudies({
      searchTerm: req.query.searchTerm as string,
      modality: req.query.modality as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      status: req.query.status as string,
      page: parseInt(req.query.page as string),
      pageSize: parseInt(req.query.pageSize as string),
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string,
    });
    res.json(result);
  });

  app.get('/api/studies/:id', authenticate, async (req, res) => {
    const study = await pacsStore.getStudyById(req.params.id);
    if (!study) {
      return res.status(404).json({ error: 'Estudio no encontrado' });
    }

    await pacsStore.addAuditLog({
      userId: req.user?.userId || 'system',
      userName: req.user?.userName || 'System',
      userRole: (req.user?.userRole as any) || 'Admin',
      action: 'STUDY_VIEW',
      description: `Apertura de metadatos de estudio ${study.accessionNumber} (${study.patientName})`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json(study);
  });

  app.put('/api/studies/:id/status', authenticate, authorize('Admin', 'Radiologo'), async (req, res) => {
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

  // CORS Middleware específico para DICOMweb (necesario porque OHIF corre en otro puerto)
  app.use('/api/dicom-web', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // DICOMweb Proxy para OHIF
  app.use('/api/dicom-web', authenticate, (req, res, next) => {
    // Reemplazar el JWT de Mini PACS por el Basic Auth de Orthanc
    const token = Buffer.from(`${process.env.ORTHANC_USER}:${process.env.ORTHANC_PASS}`).toString('base64');
    req.headers['authorization'] = `Basic ${token}`;
    next();
  }, createProxyMiddleware({
    target: process.env.ORTHANC_URL || 'http://localhost:8042',
    changeOrigin: true,
    pathRewrite: {
      // Como usamos app.use('/api/dicom-web'), express recorta esa parte de la URL.
      // Así que req.url llega como "/studies". Le añadimos "/dicom-web" al principio
      // para que Orthanc lo reciba en su plugin DICOMweb (http://localhost:8042/dicom-web/studies).
      '^/': '/dicom-web/',
    }
  }));

  // Orthanc DICOM REST API endpoints
  app.get('/api/orthanc/status', authenticate, async (req, res) => {
    res.json(await pacsStore.getOrthancStatus());
  });

  app.post('/api/orthanc/sync', authenticate, authorize('Admin', 'Radiologo', 'Tecnico'), async (req, res) => {
    const result = await pacsStore.syncWithOrthanc(
      req.user!.userId,
      req.user!.userName,
      req.user!.userRole
    );
    res.json(result);
  });

  app.get('/api/orthanc/instances/:id/tags', authenticate, async (req, res) => {
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

  app.get('/api/orthanc/dicom/:identifier', async (req, res) => {
    const { identifier } = req.params;
    try {
      const orthancUrl = process.env.ORTHANC_URL || 'http://localhost:8042';
      const token = Buffer.from(`${process.env.ORTHANC_USER}:${process.env.ORTHANC_PASS}`).toString('base64');
      
      // Try 1: Assume identifier is Orthanc instance ID
      let response = await fetch(`${orthancUrl}/instances/${identifier}/file`, {
        headers: { Authorization: `Basic ${token}` },
      });
      
      // Try 2: If failed, search by SOPInstanceUID in database
      if (!response.ok) {
        const instance = await pacsStore.getInstanceBySopInstanceUid(identifier);
        if (instance) {
          // Use the real Orthanc ID from database
          response = await fetch(`${orthancUrl}/instances/${instance.id}/file`, {
            headers: { Authorization: `Basic ${token}` },
          });
        }
      }
      
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

  app.post('/api/orthanc/webhook', async (req, res) => {
    const secret = req.headers['x-webhook-secret'];
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (!expectedSecret) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (secret !== expectedSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const { event, orthancStudyId, accessionNumber, patientName, patientId } = req.body;

    if (event !== 'new_study') {
      return res.status(400).json({ error: 'Unknown event type' });
    }

    try {
      await pacsStore.addAuditLog({
        userId: 'system',
        userName: 'Orthanc Webhook',
        userRole: 'Admin',
        action: 'ORTHANC_SYNC',
        description: `Nuevo estudio recibido automáticamente: ${accessionNumber} - ${patientName}`,
        ipAddress: req.ip || 'orthanc',
        details: `Study ID: ${orthancStudyId}, Patient ID: ${patientId}`,
      });

      console.log(`[Webhook] Nuevo estudio recibido: ${accessionNumber} - ${patientName}`);
      res.json({ success: true, message: 'Study notification received' });
    } catch (err) {
      console.error('[Webhook] Error processing notification:', err);
      res.status(500).json({ error: 'Failed to process notification' });
    }
  });

  // Export Endpoints
  app.get('/api/studies/:id/export/pdf', authenticate, async (req, res) => {
    try {
      const study = await pacsStore.getStudyById(req.params.id);
      if (!study) {
        return res.status(404).json({ error: 'Estudio no encontrado' });
      }

      const pdfBuffer = await generateStudyPdf(study as any);

      await pacsStore.addAuditLog({
        userId: req.user!.userId,
        userName: req.user!.userName,
        userRole: req.user!.userRole,
        action: 'STUDY_DOWNLOAD',
        description: `Descarga de PDF del estudio ${study.accessionNumber} (${study.patientName})`,
        ipAddress: req.ip || '127.0.0.1',
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Informe_${study.accessionNumber}_${study.patientDocument}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });
      res.send(pdfBuffer);
    } catch (err) {
      console.error('Error generating PDF:', err);
      res.status(500).json({ error: 'Error al generar el PDF del estudio' });
    }
  });

  app.get('/api/studies/:id/export/zip', authenticate, async (req, res) => {
    try {
      const study = await pacsStore.getStudyById(req.params.id);
      if (!study) {
        return res.status(404).json({ error: 'Estudio no encontrado' });
      }

      await pacsStore.addAuditLog({
        userId: req.user!.userId,
        userName: req.user!.userName,
        userRole: req.user!.userRole,
        action: 'STUDY_DOWNLOAD',
        description: `Descarga de ZIP DICOM del estudio ${study.accessionNumber} (${study.patientName})`,
        ipAddress: req.ip || '127.0.0.1',
      });

      try {
        res.set({
          'Content-Disposition': `attachment; filename="DICOM_${study.accessionNumber}.zip"`,
        });
        await OrthancClient.streamStudyArchive(study.id, res);
      } catch {
        const zip = archiver('zip', { zlib: { level: 5 } });
        res.set({
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="DICOM_${study.accessionNumber}_meta.zip"`,
        });

        zip.pipe(res);

        zip.append(JSON.stringify(study, null, 2), { name: `${study.accessionNumber}_metadata.json` });

        for (const s of study.series) {
          for (const inst of s.instances) {
            zip.append(JSON.stringify(inst.tags, null, 2), {
              name: `series_${s.seriesNumber}/${inst.id}_tags.json`,
            });
          }
        }

        await zip.finalize();
      }
    } catch (err) {
      console.error('Error generating ZIP:', err);
      res.status(500).json({ error: 'Error al generar el ZIP del estudio' });
    }
  });

  app.get('/api/instances/:id/dicom', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
      const { contentType, data } = await OrthancClient.downloadBinary(`/instances/${id}/file`);
      res.set({
        'Content-Type': 'application/dicom',
        'Content-Disposition': `attachment; filename="${id}.dcm"`,
        'Content-Length': data.byteLength.toString(),
      });
      res.send(Buffer.from(data));
    } catch {
      res.status(502).json({ error: 'Error fetching DICOM from Orthanc' });
    }
  });

  // Audit Logs
  app.get('/api/audit', authenticate, async (req, res) => {
    const result = await pacsStore.getAuditLogs({
      actionFilter: req.query.action as string,
      search: req.query.search as string,
      page: parseInt(req.query.page as string),
      pageSize: parseInt(req.query.pageSize as string),
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string,
    });
    res.json(result);
  });

  // Config
  app.get('/api/config', authenticate, async (req, res) => {
    res.json(await pacsStore.getPacsConfig());
  });

  app.put('/api/config', authenticate, authorize('Admin'), async (req, res) => {
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
  app.get('/api/users', authenticate, async (req, res) => {
    res.json(await pacsStore.getUsers());
  });

  app.post('/api/users', authenticate, authorize('Admin'), async (req, res) => {
    const { name, email, role, password, avatar } = req.body;
    if (!name || !email || !role || !password) {
      return res.status(400).json({ error: 'Nombre, email, rol y contraseña son obligatorios' });
    }

    const existing = await pacsStore.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await pacsStore.createUser({ name, email, role, passwordHash, avatar });

    await pacsStore.addAuditLog({
      userId: req.user!.userId,
      userName: req.user!.userName,
      userRole: req.user!.userRole,
      action: 'PATIENT_CREATE',
      description: `Creación de usuario: ${user.name} (${user.role})`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json(user);
  });

  app.put('/api/users/:id', authenticate, authorize('Admin'), async (req, res) => {
    const { name, email, role, password, avatar } = req.body;

    const existing = await pacsStore.getUserById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (email && email !== existing.email) {
      const emailTaken = await pacsStore.getUserByEmail(email);
      if (emailTaken) {
        return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
      }
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (role) updates.role = role;
    if (avatar !== undefined) updates.avatar = avatar;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);

    const user = await pacsStore.updateUser(req.params.id, updates);

    await pacsStore.addAuditLog({
      userId: req.user!.userId,
      userName: req.user!.userName,
      userRole: req.user!.userRole,
      action: 'PATIENT_UPDATE',
      description: `Actualización de usuario: ${user.name} (${user.role})`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json(user);
  });

  app.delete('/api/users/:id', authenticate, authorize('Admin'), async (req, res) => {
    const existing = await pacsStore.getUserById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (existing.id === req.user!.userId) {
      return res.status(400).json({ error: 'No puede eliminar su propio usuario' });
    }

    await pacsStore.deleteUser(req.params.id);

    await pacsStore.addAuditLog({
      userId: req.user!.userId,
      userName: req.user!.userName,
      userRole: req.user!.userRole,
      action: 'PATIENT_DELETE',
      description: `Eliminación de usuario: ${existing.name} (${existing.role})`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({ message: 'Usuario eliminado exitosamente' });
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

  // Polling for Orthanc Status via WebSockets
  let lastOrthancOnline: boolean | null = null;
  setInterval(async () => {
    try {
      const status = await pacsStore.getOrthancStatus();
      if (status.online !== lastOrthancOnline) {
        lastOrthancOnline = status.online;
        io.emit('orthanc_status_changed', status);
      }
    } catch (e) {
      if (lastOrthancOnline !== false) {
        lastOrthancOnline = false;
        io.emit('orthanc_status_changed', { online: false });
      }
    }
  }, 5000);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Mini PACS Web Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
