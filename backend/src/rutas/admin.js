import { Router } from 'express';
import { query, transaccion } from '../db.js';
import { requiereLogin, requiereAdmin } from '../auth.js';
import { ahora } from '../reloj.js';
import { desdeLocal } from '../horaLocal.js';
import { ErrorNegocio } from '../reglas.js';
import { SELECT_TURNO, turnoJSON } from './serializar.js';

const r = Router();
r.use(requiereLogin, requiereAdmin);

// Agenda de un día local, todos los barberos
r.get('/agenda', async (req, res) => {
  const desde = desdeLocal(String(req.query.fecha ?? ''), '00:00');
  if (!desde) throw new ErrorNegocio(400, 'La fecha tiene que ser AAAA-MM-DD');
  const hasta = new Date(desde.getTime() + 24 * 3600000);
  const { rows } = await query(
    `${SELECT_TURNO} WHERE t.inicio >= $1 AND t.inicio < $2 ORDER BY t.inicio, b.nombre`,
    [desde, hasta],
  );
  res.json(rows.map(turnoJSON));
});

// R7 — Ausente: deuda del 100 %
r.post('/turnos/:id/ausente', async (req, res) => {
  const t = await transaccion(async (db) => {
    const t = (await db.query('SELECT * FROM turnos WHERE id = $1 FOR UPDATE', [Number(req.params.id)])).rows[0];
    if (!t) throw new ErrorNegocio(404, 'Ese turno no existe');
    if (t.estado !== 'activo') throw new ErrorNegocio(422, 'Solo se puede marcar ausente un turno activo');
    if (new Date(t.inicio) > ahora()) throw new ErrorNegocio(422, 'El turno todavía no empezó');
    await db.query(`UPDATE turnos SET estado = 'ausente', deuda_generada = precio WHERE id = $1`, [t.id]);
    await db.query('UPDATE usuarios SET deuda = deuda + $2 WHERE id = $1', [t.cliente_id, t.precio]);
    return (await db.query(`${SELECT_TURNO} WHERE t.id = $1`, [t.id])).rows[0];
  });
  res.json(turnoJSON(t));
});

r.get('/deudores', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, email, deuda FROM usuarios WHERE deuda > 0 ORDER BY deuda DESC, nombre`,
  );
  res.json(rows);
});

// R8 — Saldar deuda (se pagó en el local)
r.post('/usuarios/:id/saldar', async (req, res) => {
  const { rows } = await query(
    'UPDATE usuarios SET deuda = 0 WHERE id = $1 RETURNING id, nombre, email, deuda',
    [Number(req.params.id)],
  );
  if (!rows[0]) throw new ErrorNegocio(404, 'Ese usuario no existe');
  res.json(rows[0]);
});

export default r;
