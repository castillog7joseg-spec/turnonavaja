import express from 'express';
import cors from 'cors';
import { ErrorNegocio } from './reglas.js';
import rutasAuth from './rutas/auth.js';
import rutasCatalogo from './rutas/catalogo.js';
import rutasTurnos from './rutas/turnos.js';
import rutasAdmin from './rutas/admin.js';

// Express 5 pasa solos los errores de funciones async al manejador de errores.

export function crearApp() {
  const app = express();

  // CORS: solo el frontend invitado (FRONTEND_URL) puede usar este backend desde el navegador.
  const invitados = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  app.use(cors({ origin: invitados }));
  app.use(express.json());

  app.get('/salud', (_req, res) => res.json({ ok: true }));
  app.use('/auth', rutasAuth);
  app.use('/', rutasCatalogo);
  app.use('/turnos', rutasTurnos);
  app.use('/admin', rutasAdmin);

  app.use((_req, _res, next) => next(new ErrorNegocio(404, 'Ruta inexistente')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ErrorNegocio) return res.status(err.status).json({ error: err.message });
    if (err.code === '23P01') {
      // Violación de la restricción anti-superposición (R3)
      return res.status(409).json({ error: 'Ese horario se acaba de ocupar. Elegí otro' });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}
