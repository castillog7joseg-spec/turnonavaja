import { Router } from 'express';
import { query } from '../db.js';
import { ahora } from '../reloj.js';
import { desdeLocal, horaLocal } from '../horaLocal.js';
import {
  ErrorNegocio,
  horariosDelDia,
  errorDeAnticipacion,
  calcularPrecio,
  modificadorDePrecio,
} from '../reglas.js';

const r = Router();

r.get('/servicios', async (_req, res) => {
  const { rows } = await query(
    'SELECT id, codigo, nombre, duracion_min AS "duracionMin", precio_base AS "precioBase" FROM servicios ORDER BY id',
  );
  res.json(rows);
});

r.get('/barberos', async (_req, res) => {
  const { rows } = await query('SELECT id, nombre FROM barberos WHERE activo ORDER BY id');
  res.json(rows);
});

// Horarios libres de un barbero, para un servicio, en un día local. Cada uno con su precio (R5).
r.get('/disponibilidad', async (req, res) => {
  const barberoId = Number(req.query.barbero);
  const servicioId = Number(req.query.servicio);
  const fecha = String(req.query.fecha ?? '');
  if (!Number.isInteger(barberoId) || !Number.isInteger(servicioId)) {
    throw new ErrorNegocio(400, 'Faltan barbero o servicio');
  }
  const inicioDia = desdeLocal(fecha, '00:00');
  if (!inicioDia) throw new ErrorNegocio(400, 'La fecha tiene que ser AAAA-MM-DD');

  const s = await query('SELECT * FROM servicios WHERE id = $1', [servicioId]);
  if (!s.rowCount) throw new ErrorNegocio(404, 'Ese servicio no existe');
  const b = await query('SELECT * FROM barberos WHERE id = $1 AND activo', [barberoId]);
  if (!b.rowCount) throw new ErrorNegocio(404, 'Ese barbero no existe');
  const servicio = s.rows[0];

  const finDia = new Date(inicioDia.getTime() + 24 * 3600000);
  const ocupados = (
    await query(
      `SELECT inicio, fin FROM turnos
       WHERE barbero_id = $1 AND estado = 'activo' AND inicio < $3 AND fin > $2`,
      [barberoId, inicioDia, finDia],
    )
  ).rows;

  const now = ahora();
  const horarios = horariosDelDia(fecha, servicio.duracion_min)
    .filter((ini) => !errorDeAnticipacion(ini, now))
    .filter((ini) => {
      const fin = new Date(ini.getTime() + servicio.duracion_min * 60000);
      return !ocupados.some((o) => ini < o.fin && fin > o.inicio);
    })
    .map((ini) => ({
      inicio: ini.toISOString(),
      hora: horaLocal(ini),
      precio: calcularPrecio(servicio.precio_base, ini),
      motivo: modificadorDePrecio(ini).motivo,
    }));

  res.json({ fecha, barberoId, servicioId, horarios });
});

export default r;
