import pg from 'pg';
import { readFile } from 'node:fs/promises';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('Falta DATABASE_URL (mirá backend/.env.example)');
}

const esLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);

export const pool = new pg.Pool({
  connectionString: url,
  // Neon (y casi cualquier base en la nube) exige SSL; la base local no.
  ssl: esLocal ? false : { rejectUnauthorized: false },
});

export function query(text, params) {
  return pool.query(text, params);
}

/** Corre una función dentro de una transacción (BEGIN … COMMIT / ROLLBACK). */
export async function transaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function crearTablas() {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}
