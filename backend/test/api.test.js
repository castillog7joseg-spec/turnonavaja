// Tests de punta a punta: la API completa contra una base PostgreSQL de prueba.
// Usa el Reloj ("control remoto del tiempo") para no depender de la hora real.
//
// Hoy (fijo) = martes 17/11/2026 09:00 hora del local.
// Fechas: mar 17, mié 18, jue 19, vie 20, sáb 21, dom 22, lun 23.

import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Los tests borran la base: corrélos con NODE_ENV=test (archivo .env.test)');
}

const { crearApp } = await import('../src/app.js');
const { pool, crearTablas } = await import('../src/db.js');
const { cargarDatosIniciales } = await import('../src/seed.js');
const reloj = await import('../src/reloj.js');
const { desdeLocal } = await import('../src/horaLocal.js');

const app = crearApp();
const api = () => request(app);
const L = (f, h) => desdeLocal(f, h).toISOString();

let SERV = {};
let BARB = {};

async function registrar(nombre) {
  const email = `${nombre.toLowerCase()}@mail.com`;
  const r = await api().post('/auth/registro').send({ nombre, email, password: 'clave1234' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { token: r.body.token, id: r.body.usuario.id };
}

async function entrarAdmin() {
  const r = await api()
    .post('/auth/entrada')
    .send({ email: 'admin@navaja.test', password: 'admin-de-prueba' });
  assert.equal(r.status, 200);
  return r.body.token;
}

function reservar(token, { barbero = 'Martín', servicio = 'corte', fecha, hora }) {
  return api()
    .post('/turnos')
    .set('Authorization', `Bearer ${token}`)
    .send({ barberoId: BARB[barbero], servicioId: SERV[servicio], inicio: L(fecha, hora) });
}

before(async () => {
  await crearTablas();
});

beforeEach(async () => {
  await pool.query('TRUNCATE turnos, usuarios RESTART IDENTITY CASCADE');
  await cargarDatosIniciales();
  reloj.fijar(desdeLocal('2026-11-17', '09:00'));
  SERV = Object.fromEntries((await api().get('/servicios')).body.map((s) => [s.codigo, s.id]));
  BARB = Object.fromEntries((await api().get('/barberos')).body.map((b) => [b.nombre, b.id]));
});

after(async () => {
  reloj.soltar();
  await pool.end();
});

describe('R9 — Usuarios', () => {
  test('registro devuelve token y el usuario sin deuda', async () => {
    const r = await api().post('/auth/registro').send({ nombre: 'Ana', email: 'ANA@mail.com', password: 'clave1234' });
    assert.equal(r.status, 201);
    assert.ok(r.body.token);
    assert.equal(r.body.usuario.email, 'ana@mail.com');
    assert.equal(r.body.usuario.deuda, 0);
    assert.equal(r.body.usuario.rol, 'cliente');
  });

  test('email repetido → 409', async () => {
    await registrar('Ana');
    const r = await api().post('/auth/registro').send({ nombre: 'Otra', email: 'ana@mail.com', password: 'clave1234' });
    assert.equal(r.status, 409);
  });

  test('contraseña corta → 400', async () => {
    const r = await api().post('/auth/registro').send({ nombre: 'Ana', email: 'ana@mail.com', password: '123' });
    assert.equal(r.status, 400);
  });

  test('contraseña incorrecta → 401', async () => {
    await registrar('Ana');
    const r = await api().post('/auth/entrada').send({ email: 'ana@mail.com', password: 'otra-clave' });
    assert.equal(r.status, 401);
  });

  test('el admin inicial existe y puede entrar', async () => {
    const token = await entrarAdmin();
    const yo = await api().get('/auth/yo').set('Authorization', `Bearer ${token}`);
    assert.equal(yo.body.rol, 'admin');
  });

  test('sin token no se puede reservar → 401', async () => {
    const r = await api().post('/turnos').send({});
    assert.equal(r.status, 401);
  });
});

describe('Reservar (R1, R2, R5)', () => {
  test('corte con Martín, martes 11:00 → 201 y $6.800', async () => {
    const { token } = await registrar('Ana');
    const r = await reservar(token, { fecha: '2026-11-17', hora: '11:00' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.precio, 6800);
    assert.equal(r.body.hora, '11:00');
    assert.equal(r.body.horaFin, '11:30');
    assert.equal(r.body.barbero, 'Martín');
    assert.equal(r.body.estado, 'activo');
  });

  test('combo con Lucía, sábado 16:00 → $14.400', async () => {
    const { token } = await registrar('Ana');
    const r = await reservar(token, { barbero: 'Lucía', servicio: 'combo', fecha: '2026-11-21', hora: '16:00' });
    assert.equal(r.status, 201);
    assert.equal(r.body.precio, 14400);
  });

  test('lunes → 422 cerrado', async () => {
    const { token } = await registrar('Ana');
    const r = await reservar(token, { fecha: '2026-11-23', hora: '11:00' });
    assert.equal(r.status, 422);
    assert.match(r.body.error, /cerrado/);
  });

  test('combo 19:30 → 422 (terminaría 20:15)', async () => {
    const { token } = await registrar('Ana');
    const r = await reservar(token, { servicio: 'combo', fecha: '2026-11-19', hora: '19:30' });
    assert.equal(r.status, 422);
  });

  test('con menos de 1 hora de anticipación → 422', async () => {
    const { token } = await registrar('Ana');
    reloj.fijar(desdeLocal('2026-11-17', '10:15'));
    const r = await reservar(token, { fecha: '2026-11-17', hora: '11:00' });
    assert.equal(r.status, 422);
    assert.match(r.body.error, /1 hora/);
  });

  test('a más de 30 días → 422', async () => {
    const { token } = await registrar('Ana');
    const r = await reservar(token, { fecha: '2026-12-18', hora: '11:00' });
    assert.equal(r.status, 422);
  });

  test('barbero inexistente → 404', async () => {
    const { token } = await registrar('Ana');
    const r = await api()
      .post('/turnos')
      .set('Authorization', `Bearer ${token}`)
      .send({ barberoId: 999, servicioId: SERV.corte, inicio: L('2026-11-17', '11:00') });
    assert.equal(r.status, 404);
  });

  test('el admin no saca turnos → 403', async () => {
    const token = await entrarAdmin();
    const r = await reservar(token, { fecha: '2026-11-17', hora: '11:00' });
    assert.equal(r.status, 403);
  });
});

describe('R3 — Sin superposición', () => {
  test('dos clientes reservan a Martín martes 11:00 a la vez → uno 201, otro 409', async () => {
    const ana = await registrar('Ana');
    const beto = await registrar('Beto');
    const [r1, r2] = await Promise.all([
      reservar(ana.token, { fecha: '2026-11-17', hora: '11:00' }),
      reservar(beto.token, { fecha: '2026-11-17', hora: '11:00' }),
    ]);
    assert.deepEqual([r1.status, r2.status].sort(), [201, 409]);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM turnos WHERE estado = 'activo'`);
    assert.equal(rows[0].n, 1);
  });

  test('turno que se pisa parcialmente (10:45 contra 11:00) → 409', async () => {
    const ana = await registrar('Ana');
    const beto = await registrar('Beto');
    assert.equal((await reservar(ana.token, { fecha: '2026-11-17', hora: '11:00' })).status, 201);
    const r = await reservar(beto.token, { fecha: '2026-11-17', hora: '10:45' });
    assert.equal(r.status, 409);
  });

  test('turnos que solo se tocan en el borde (11:00–11:30 y 11:30) → ok', async () => {
    const ana = await registrar('Ana');
    const beto = await registrar('Beto');
    assert.equal((await reservar(ana.token, { fecha: '2026-11-17', hora: '11:00' })).status, 201);
    assert.equal((await reservar(beto.token, { fecha: '2026-11-17', hora: '11:30' })).status, 201);
  });

  test('mismo horario con otro barbero → ok', async () => {
    const ana = await registrar('Ana');
    const beto = await registrar('Beto');
    assert.equal((await reservar(ana.token, { fecha: '2026-11-17', hora: '11:00' })).status, 201);
    assert.equal((await reservar(beto.token, { barbero: 'Lucía', fecha: '2026-11-17', hora: '11:00' })).status, 201);
  });

  test('un turno cancelado libera el horario', async () => {
    const ana = await registrar('Ana');
    const beto = await registrar('Beto');
    const t = await reservar(ana.token, { fecha: '2026-11-19', hora: '11:00' });
    await api().post(`/turnos/${t.body.id}/cancelar`).set('Authorization', `Bearer ${ana.token}`);
    assert.equal((await reservar(beto.token, { fecha: '2026-11-19', hora: '11:00' })).status, 201);
  });
});

describe('R4 — Límite por cliente', () => {
  test('tercer turno activo → 422', async () => {
    const { token } = await registrar('Ana');
    assert.equal((await reservar(token, { fecha: '2026-11-18', hora: '11:00' })).status, 201);
    assert.equal((await reservar(token, { fecha: '2026-11-19', hora: '11:00' })).status, 201);
    const r = await reservar(token, { fecha: '2026-11-20', hora: '11:00' });
    assert.equal(r.status, 422);
    assert.match(r.body.error, /máximo 2/);
  });

  test('dos turnos del mismo cliente que se pisan, con barberos distintos → 409', async () => {
    const { token } = await registrar('Ana');
    assert.equal((await reservar(token, { fecha: '2026-11-18', hora: '11:00' })).status, 201);
    const r = await reservar(token, { barbero: 'Ramiro', fecha: '2026-11-18', hora: '11:15' });
    assert.equal(r.status, 409);
  });

  test('dos pedidos simultáneos del mismo cliente con 1 lugar libre → solo uno entra', async () => {
    const { token } = await registrar('Ana');
    assert.equal((await reservar(token, { fecha: '2026-11-18', hora: '11:00' })).status, 201);
    const [a, b] = await Promise.all([
      reservar(token, { fecha: '2026-11-19', hora: '11:00' }),
      reservar(token, { barbero: 'Lucía', fecha: '2026-11-20', hora: '11:00' }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [201, 422]);
  });
});

describe('Disponibilidad', () => {
  test('saca los horarios ocupados y muestra el precio de cada uno', async () => {
    const { token } = await registrar('Ana');
    await reservar(token, { fecha: '2026-11-18', hora: '11:00' });
    const r = await api()
      .get('/disponibilidad')
      .query({ barbero: BARB['Martín'], servicio: SERV.corte, fecha: '2026-11-18' });
    assert.equal(r.status, 200);
    const horas = r.body.horarios.map((h) => h.hora);
    assert.ok(!horas.includes('11:00'));
    assert.ok(!horas.includes('10:45')); // 10:45–11:15 se pisa con 11:00
    assert.ok(horas.includes('10:30')); // 10:30–11:00 solo toca el borde
    assert.ok(horas.includes('11:30'));
    const h1330 = r.body.horarios.find((h) => h.hora === '13:30');
    const h1400 = r.body.horarios.find((h) => h.hora === '14:00');
    assert.equal(h1330.precio, 6800);
    assert.equal(h1330.motivo, 'Horario tranqui −15%');
    assert.equal(h1400.precio, 8000);
  });

  test('no ofrece horarios con menos de 1 hora de anticipación', async () => {
    reloj.fijar(desdeLocal('2026-11-17', '12:05'));
    const r = await api()
      .get('/disponibilidad')
      .query({ barbero: BARB['Martín'], servicio: SERV.corte, fecha: '2026-11-17' });
    assert.equal(r.body.horarios[0].hora, '13:15');
  });

  test('lunes → sin horarios', async () => {
    const r = await api()
      .get('/disponibilidad')
      .query({ barbero: BARB['Martín'], servicio: SERV.corte, fecha: '2026-11-23' });
    assert.deepEqual(r.body.horarios, []);
  });

  test('fecha inválida → 400', async () => {
    const r = await api().get('/disponibilidad').query({ barbero: 1, servicio: 1, fecha: 'mañana' });
    assert.equal(r.status, 400);
  });
});

describe('R6 — Cancelación (con el Reloj)', () => {
  test('cancelar 6 horas antes → deuda del 50%', async () => {
    const { token } = await registrar('Ana');
    // jueves 18:00 corte = $8.000
    const t = await reservar(token, { fecha: '2026-11-19', hora: '18:00' });
    assert.equal(t.body.precio, 8000);

    reloj.fijar(desdeLocal('2026-11-19', '12:00')); // avanzo el Reloj: faltan 6 h

    const previa = await api().get(`/turnos/${t.body.id}/cancelacion`).set('Authorization', `Bearer ${token}`);
    assert.deepEqual(previa.body, { permitido: true, deuda: 4000 });

    const r = await api().post(`/turnos/${t.body.id}/cancelar`).set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.estado, 'cancelado');
    assert.equal(r.body.deudaGenerada, 4000);

    const yo = await api().get('/auth/yo').set('Authorization', `Bearer ${token}`);
    assert.equal(yo.body.deuda, 4000);
  });

  test('cancelar con 12 horas o más → sin deuda', async () => {
    const { token } = await registrar('Ana');
    const t = await reservar(token, { fecha: '2026-11-19', hora: '18:00' });
    reloj.fijar(desdeLocal('2026-11-19', '06:00'));
    const r = await api().post(`/turnos/${t.body.id}/cancelar`).set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.deudaGenerada, 0);
  });

  test('no se puede cancelar un turno que ya empezó → 422', async () => {
    const { token } = await registrar('Ana');
    const t = await reservar(token, { fecha: '2026-11-17', hora: '11:00' });
    reloj.avanzar(3 * 60); // 12:00
    const r = await api().post(`/turnos/${t.body.id}/cancelar`).set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 422);
  });

  test('no se puede cancelar el turno de otro → 404', async () => {
    const ana = await registrar('Ana');
    const beto = await registrar('Beto');
    const t = await reservar(ana.token, { fecha: '2026-11-19', hora: '11:00' });
    const r = await api().post(`/turnos/${t.body.id}/cancelar`).set('Authorization', `Bearer ${beto.token}`);
    assert.equal(r.status, 404);
  });

  test('cancelar dos veces → la segunda es 422', async () => {
    const { token } = await registrar('Ana');
    const t = await reservar(token, { fecha: '2026-11-19', hora: '11:00' });
    await api().post(`/turnos/${t.body.id}/cancelar`).set('Authorization', `Bearer ${token}`);
    const r = await api().post(`/turnos/${t.body.id}/cancelar`).set('Authorization', `Bearer ${token}`);
    assert.equal(r.status, 422);
  });
});

describe('R7 — Ausente', () => {
  test('el admin marca ausente un turno que ya empezó → deuda del 100%', async () => {
    const ana = await registrar('Ana');
    const admin = await entrarAdmin();
    const t = await reservar(ana.token, { fecha: '2026-11-17', hora: '11:00' }); // $6.800
    reloj.fijar(desdeLocal('2026-11-17', '11:20'));
    const r = await api().post(`/admin/turnos/${t.body.id}/ausente`).set('Authorization', `Bearer ${admin}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.estado, 'ausente');
    assert.equal(r.body.deudaGenerada, 6800);
    const yo = await api().get('/auth/yo').set('Authorization', `Bearer ${ana.token}`);
    assert.equal(yo.body.deuda, 6800);
  });

  test('antes de que empiece → 422', async () => {
    const ana = await registrar('Ana');
    const admin = await entrarAdmin();
    const t = await reservar(ana.token, { fecha: '2026-11-17', hora: '11:00' });
    const r = await api().post(`/admin/turnos/${t.body.id}/ausente`).set('Authorization', `Bearer ${admin}`);
    assert.equal(r.status, 422);
  });

  test('un cliente no puede usar rutas de admin → 403', async () => {
    const ana = await registrar('Ana');
    const r = await api().get('/admin/deudores').set('Authorization', `Bearer ${ana.token}`);
    assert.equal(r.status, 403);
  });
});

describe('R8 — Deudas', () => {
  test('con deuda no puede reservar (403); el admin salda y vuelve a poder', async () => {
    const ana = await registrar('Ana');
    const admin = await entrarAdmin();
    const t = await reservar(ana.token, { fecha: '2026-11-17', hora: '11:00' });
    reloj.fijar(desdeLocal('2026-11-17', '11:10'));
    await api().post(`/admin/turnos/${t.body.id}/ausente`).set('Authorization', `Bearer ${admin}`);

    const bloqueado = await reservar(ana.token, { fecha: '2026-11-19', hora: '11:00' });
    assert.equal(bloqueado.status, 403);
    assert.match(bloqueado.body.error, /deuda de \$6800/);

    const deudores = await api().get('/admin/deudores').set('Authorization', `Bearer ${admin}`);
    assert.deepEqual(deudores.body.map((d) => [d.nombre, d.deuda]), [['Ana', 6800]]);

    const s = await api().post(`/admin/usuarios/${ana.id}/saldar`).set('Authorization', `Bearer ${admin}`);
    assert.equal(s.body.deuda, 0);

    const ok = await reservar(ana.token, { fecha: '2026-11-19', hora: '11:00' });
    assert.equal(ok.status, 201);
  });
});

describe('Admin — Agenda', () => {
  test('muestra los turnos del día local de todos los barberos', async () => {
    const ana = await registrar('Ana');
    const beto = await registrar('Beto');
    const admin = await entrarAdmin();
    await reservar(ana.token, { fecha: '2026-11-18', hora: '11:00' });
    await reservar(beto.token, { barbero: 'Lucía', fecha: '2026-11-18', hora: '19:30' }); // 22:30 UTC, mismo día local
    await reservar(beto.token, { fecha: '2026-11-19', hora: '10:00' }); // otro día
    const r = await api().get('/admin/agenda').query({ fecha: '2026-11-18' }).set('Authorization', `Bearer ${admin}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.map((t) => [t.hora, t.barbero, t.cliente]), [
      ['11:00', 'Martín', 'Ana'],
      ['19:30', 'Lucía', 'Beto'],
    ]);
  });
});
