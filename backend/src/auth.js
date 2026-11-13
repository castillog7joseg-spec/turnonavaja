import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ErrorNegocio } from './reglas.js';

function secreto() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('Falta JWT_SECRET (mirá backend/.env.example)');
  return s;
}

export function hashear(password) {
  return bcrypt.hash(password, 10);
}

export function comparar(password, hash) {
  return bcrypt.compare(password, hash);
}

export function firmarToken(usuario) {
  return jwt.sign({ sub: usuario.id, rol: usuario.rol }, secreto(), { expiresIn: '7d' });
}

/** Middleware: exige un token válido y deja req.usuario = { id, rol }. */
export function requiereLogin(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new ErrorNegocio(401, 'Tenés que iniciar sesión'));
  try {
    const p = jwt.verify(token, secreto());
    req.usuario = { id: p.sub, rol: p.rol };
    next();
  } catch {
    next(new ErrorNegocio(401, 'La sesión venció, entrá de nuevo'));
  }
}

export function requiereAdmin(req, _res, next) {
  if (req.usuario?.rol !== 'admin') return next(new ErrorNegocio(403, 'Solo para administración'));
  next();
}
