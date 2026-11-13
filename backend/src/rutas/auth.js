import { Router } from 'express';
import { query } from '../db.js';
import { hashear, comparar, firmarToken, requiereLogin } from '../auth.js';
import { ErrorNegocio } from '../reglas.js';

const r = Router();

const publico = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, deuda: u.deuda });

// R9 — Registro
r.post('/registro', async (req, res) => {
  const nombre = String(req.body?.nombre ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!nombre) throw new ErrorNegocio(400, 'Falta el nombre');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorNegocio(400, 'El email no es válido');
  if (password.length < 8) throw new ErrorNegocio(400, 'La contraseña tiene que tener al menos 8 caracteres');

  const existe = await query('SELECT 1 FROM usuarios WHERE email = $1', [email]);
  if (existe.rowCount) throw new ErrorNegocio(409, 'Ya hay una cuenta con ese email');

  const { rows } = await query(
    `INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1, $2, $3)
     RETURNING id, nombre, email, rol, deuda`,
    [nombre, email, await hashear(password)],
  );
  res.status(201).json({ token: firmarToken(rows[0]), usuario: publico(rows[0]) });
});

r.post('/entrada', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const { rows } = await query('SELECT * FROM usuarios WHERE email = $1', [email]);
  const u = rows[0];
  if (!u || !(await comparar(password, u.password_hash))) {
    throw new ErrorNegocio(401, 'Email o contraseña incorrectos');
  }
  res.json({ token: firmarToken(u), usuario: publico(u) });
});

r.get('/yo', requiereLogin, async (req, res) => {
  const { rows } = await query('SELECT id, nombre, email, rol, deuda FROM usuarios WHERE id = $1', [req.usuario.id]);
  if (!rows[0]) throw new ErrorNegocio(401, 'La cuenta ya no existe');
  res.json(rows[0]);
});

export default r;
