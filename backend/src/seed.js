// Datos iniciales (spec §3) y admin inicial (R9). Se puede correr muchas veces.

import { query } from './db.js';
import { hashear } from './auth.js';

export const SERVICIOS = [
  { codigo: 'corte', nombre: 'Corte', duracion_min: 30, precio_base: 8000 },
  { codigo: 'barba', nombre: 'Barba', duracion_min: 20, precio_base: 5000 },
  { codigo: 'combo', nombre: 'Corte + Barba', duracion_min: 45, precio_base: 12000 },
];

export const BARBEROS = ['Martín', 'Lucía', 'Ramiro'];

export async function cargarDatosIniciales() {
  for (const s of SERVICIOS) {
    await query(
      `INSERT INTO servicios (codigo, nombre, duracion_min, precio_base)
       VALUES ($1, $2, $3, $4) ON CONFLICT (codigo) DO NOTHING`,
      [s.codigo, s.nombre, s.duracion_min, s.precio_base],
    );
  }
  for (const nombre of BARBEROS) {
    await query('INSERT INTO barberos (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING', [nombre]);
  }

  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (email && password) {
    await query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ('Administración', $1, $2, 'admin') ON CONFLICT (email) DO NOTHING`,
      [email, await hashear(password)],
    );
  }
}
