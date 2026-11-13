import { Router } from 'express';
import { query, transaccion } from '../db.js';
import { requiereLogin } from '../auth.js';
import { ahora } from '../reloj.js';
import {
  ErrorNegocio,
  errorDeHorario,
  errorDeAnticipacion,
  calcularPrecio,
  evaluarCancelacion,
  MAX_TURNOS_ACTIVOS,
} from '../reglas.js';
import { SELECT_TURNO, turnoJSON } from './serializar.js';

const r = Router();
r.use(requiereLogin);

// Reservar un turno (R1–R5, R8)
r.post('/', async (req, res) => {
  const barberoId = Number(req.body?.barberoId);
  const servicioId = Number(req.body?.servicioId);
  const inicio = new Date(req.body?.inicio);
  if (!Number.isInteger(barberoId) || !Number.isInteger(servicioId) || Number.isNaN(inicio.getTime())) {
    throw new ErrorNegocio(400, 'Faltan barberoId, servicioId o inicio');
  }

  const turno = await transaccion(async (db) => {
    // Bloquea al cliente: dos pedidos del mismo cliente se atienden de a uno (R4).
    const u = (await db.query('SELECT * FROM usuarios WHERE id = $1 FOR UPDATE', [req.usuario.id])).rows[0];
    if (!u) throw new ErrorNegocio(401, 'La cuenta ya no existe');
    if (u.rol !== 'cliente') throw new ErrorNegocio(403, 'Solo los clientes sacan turnos');
    if (u.deuda > 0) {
      throw new ErrorNegocio(403, `Tenés una deuda de $${u.deuda}. Pagala en el local para sacar turnos nuevos`);
    }

    const s = (await db.query('SELECT * FROM servicios WHERE id = $1', [servicioId])).rows[0];
    if (!s) throw new ErrorNegocio(404, 'Ese servicio no existe');
    const b = (await db.query('SELECT * FROM barberos WHERE id = $1 AND activo', [barberoId])).rows[0];
    if (!b) throw new ErrorNegocio(404, 'Ese barbero no existe');

    const now = ahora();
    const e1 = errorDeHorario(inicio, s.duracion_min);
    if (e1) throw new ErrorNegocio(422, e1);
    const e2 = errorDeAnticipacion(inicio, now);
    if (e2) throw new ErrorNegocio(422, e2);

    const fin = new Date(inicio.getTime() + s.duracion_min * 60000);

    const activos = await db.query(
      `SELECT inicio, fin FROM turnos WHERE cliente_id = $1 AND estado = 'activo' AND inicio > $2`,
      [u.id, now],
    );
    if (activos.rowCount >= MAX_TURNOS_ACTIVOS) {
      throw new ErrorNegocio(422, `Podés tener como máximo ${MAX_TURNOS_ACTIVOS} turnos activos`);
    }
    if (activos.rows.some((t) => inicio < t.fin && fin > t.inicio)) {
      throw new ErrorNegocio(409, 'Ya tenés otro turno en ese horario');
    }

    const precio = calcularPrecio(s.precio_base, inicio);
    const { rows } = await db.query(
      `INSERT INTO turnos (cliente_id, barbero_id, servicio_id, inicio, fin, precio)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [u.id, b.id, s.id, inicio, fin, precio],
    );
    return (await db.query(`${SELECT_TURNO} WHERE t.id = $1`, [rows[0].id])).rows[0];
  });

  res.status(201).json(turnoJSON(turno));
});

r.get('/mios', async (req, res) => {
  const { rows } = await query(`${SELECT_TURNO} WHERE t.cliente_id = $1 ORDER BY t.inicio DESC`, [req.usuario.id]);
  res.json(rows.map(turnoJSON));
});

async function turnoPropio(db, id, clienteId, bloquear = false) {
  const t = (
    await db.query(`SELECT * FROM turnos WHERE id = $1 ${bloquear ? 'FOR UPDATE' : ''}`, [Number(id)])
  ).rows[0];
  if (!t || t.cliente_id !== clienteId) throw new ErrorNegocio(404, 'Ese turno no existe');
  return t;
}

// Vista previa: ¿cancelar ahora genera deuda? (R6)
r.get('/:id/cancelacion', async (req, res) => {
  const t = await turnoPropio({ query }, req.params.id, req.usuario.id);
  res.json(evaluarCancelacion(t, ahora()));
});

// Cancelar (R6)
r.post('/:id/cancelar', async (req, res) => {
  const resultado = await transaccion(async (db) => {
    const t = await turnoPropio(db, req.params.id, req.usuario.id, true);
    const ev = evaluarCancelacion(t, ahora());
    if (!ev.permitido) throw new ErrorNegocio(422, ev.motivo);
    await db.query(`UPDATE turnos SET estado = 'cancelado', deuda_generada = $2 WHERE id = $1`, [t.id, ev.deuda]);
    if (ev.deuda > 0) {
      await db.query('UPDATE usuarios SET deuda = deuda + $2 WHERE id = $1', [t.cliente_id, ev.deuda]);
    }
    return (await db.query(`${SELECT_TURNO} WHERE t.id = $1`, [t.id])).rows[0];
  });
  res.json(turnoJSON(resultado));
});

export default r;
