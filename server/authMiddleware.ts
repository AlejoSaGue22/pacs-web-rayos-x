import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[ERROR] JWT_SECRET debe estar definida en .env');
  process.exit(1);
}

export interface AuthPayload {
  userId: string;
  userRole: string;
  userName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function authenticateWithQueryToken(req: Request, res: Response, next: NextFunction) {
  // OHIF corre en otro origen (puerto 8080) y usa fetch/XHR. Como respaldo,
  // aceptar el JWT también vía ?token= (o ?access_token=) y convertirlo a
  // header Bearer para reutilizar la misma validación. Después se elimina
  // del query/URL para que el proxy no lo reenvíe a Orthanc (su plugin
  // DICOMweb responde 400 ante query params desconocidos).
  const header = req.headers.authorization;
  if ((!header || !header.startsWith('Bearer ')) && req.query) {
    const qToken = (req.query as any).token || (req.query as any).access_token;
    if (typeof qToken === 'string' && qToken.length > 0) {
      req.headers.authorization = `Bearer ${qToken}`;
      delete (req.query as any).token;
      delete (req.query as any).access_token;
      const qIndex = req.url.indexOf('?');
      if (qIndex !== -1) {
        const base = req.url.slice(0, qIndex);
        const params = new URLSearchParams(req.url.slice(qIndex + 1));
        params.delete('token');
        params.delete('access_token');
        const qs = params.toString();
        req.url = qs ? `${base}?${qs}` : base;
      }
    }
  }
  return authenticate(req, res, next);
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }
    if (!allowedRoles.includes(req.user.userRole)) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
    }
    next();
  };
}
