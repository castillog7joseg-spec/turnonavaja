// Tests de reglas puras: no necesitan base de datos.
// Fechas de referencia (hora del local): mar 17/11/2026, sáb 21/11/2026, lun 16/11/2026.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { aLocal, desdeLocal, fechaLocal, horaLocal } from '../src/horaLocal.js';
import {
  errorDeHorario,
  errorDeAnticipacion,
  calcularPrecio,
  evaluarCancelacion,
  horariosDelDia,
} from '../src/reglas.js';

const L = (f, h) => desdeLocal(f, h);

describe('Hora del local (UTC−3)', () => {
  test('las 22:30 del martes en el local son las 01:30 del miércoles en UTC', () => {
    const d = L('2026-11-17', '22:30');
    assert.equal(d.toISOString(), '2026-11-18T01:30:00.000Z');
    assert.equal(aLocal(d).nombreDia, 'martes');
    assert.equal(fechaLocal(d), '2026-11-17');
    assert.equal(horaLocal(d), '22:30');
  });

  test('rechaza fechas imposibles', () => {
    assert.equal(desdeLocal('2026-02-31', '10:00'), null);
    assert.equal(desdeLocal('hola', '10:00'), null);
  });
});

describe('R1 — Horario de atención', () => {
  test('martes 10:00, corte → ok', () => {
    assert.equal(errorDeHorario(L('2026-11-17', '10:00'), 30), null);
  });
  test('lunes → cerrado', () => {
    assert.match(errorDeHorario(L('2026-11-16', '11:00'), 30), /cerrado los lunes/);
  });
  test('domingo → cerrado', () => {
    assert.match(errorDeHorario(L('2026-11-22', '11:00'), 30), /cerrado los domingo/);
  });
  test('9:45 → fuera de horario', () => {
    assert.match(errorDeHorario(L('2026-11-17', '09:45'), 30), /entre las 10:00 y las 20:00/);
  });
  test('combo 19:30 terminaría 20:15 → no', () => {
    assert.ok(errorDeHorario(L('2026-11-17', '19:30'), 45));
  });
  test('corte 19:30 termina justo 20:00 → ok', () => {
    assert.equal(errorDeHorario(L('2026-11-17', '19:30'), 30), null);
  });
  test('10:10 no es múltiplo de 15 → no', () => {
    assert.match(errorDeHorario(L('2026-11-17', '10:10'), 30), /cada 15 minutos/);
  });
});

describe('R2 — Anticipación', () => {
  const ahora = L('2026-11-17', '10:00');
  test('59 minutos antes → no', () => {
    assert.ok(errorDeAnticipacion(new Date(ahora.getTime() + 59 * 60000), ahora));
  });
  test('1 hora justa → ok', () => {
    assert.equal(errorDeAnticipacion(new Date(ahora.getTime() + 60 * 60000), ahora), null);
  });
  test('31 días → no', () => {
    assert.match(errorDeAnticipacion(L('2026-12-18', '11:00'), ahora), /30 días/);
  });
});

describe('R5 — Precio', () => {
  test('corte martes 11:00 → $6.800', () => {
    assert.equal(calcularPrecio(8000, L('2026-11-17', '11:00')), 6800);
  });
  test('combo sábado 16:00 → $14.400', () => {
    assert.equal(calcularPrecio(12000, L('2026-11-21', '16:00')), 14400);
  });
  test('barba jueves 18:00 → $5.000', () => {
    assert.equal(calcularPrecio(5000, L('2026-11-19', '18:00')), 5000);
  });
  test('corte miércoles 14:00 → $8.000 (ya no es antes de las 14)', () => {
    assert.equal(calcularPrecio(8000, L('2026-11-18', '14:00')), 8000);
  });
  test('corte miércoles 13:45 → $6.800', () => {
    assert.equal(calcularPrecio(8000, L('2026-11-18', '13:45')), 6800);
  });
  test('martes 22:30 local (miércoles en UTC) se evalúa como martes', () => {
    // Si se evaluara en UTC sería miércoles 01:30 → descuento. En el local es martes 22:30 → sin descuento.
    assert.equal(calcularPrecio(8000, L('2026-11-17', '22:30')), 8000);
  });
});

describe('R6 — Cancelación', () => {
  const turno = { estado: 'activo', inicio: L('2026-11-19', '18:00'), precio: 8000 };
  test('12 horas justas antes → sin deuda', () => {
    const r = evaluarCancelacion(turno, L('2026-11-19', '06:00'));
    assert.deepEqual(r, { permitido: true, deuda: 0 });
  });
  test('6 horas antes → deuda 50%', () => {
    const r = evaluarCancelacion(turno, L('2026-11-19', '12:00'));
    assert.deepEqual(r, { permitido: true, deuda: 4000 });
  });
  test('ya empezó → no se puede', () => {
    const r = evaluarCancelacion(turno, L('2026-11-19', '18:00'));
    assert.equal(r.permitido, false);
  });
  test('turno ya cancelado → no se puede', () => {
    const r = evaluarCancelacion({ ...turno, estado: 'cancelado' }, L('2026-11-18', '10:00'));
    assert.equal(r.permitido, false);
  });
});

describe('Horarios del día', () => {
  test('martes, corte: de 10:00 a 19:30 cada 15 min → 39 horarios', () => {
    const h = horariosDelDia('2026-11-17', 30);
    assert.equal(h.length, 39);
    assert.equal(horaLocal(h[0]), '10:00');
    assert.equal(horaLocal(h.at(-1)), '19:30');
  });
  test('lunes → ninguno', () => {
    assert.deepEqual(horariosDelDia('2026-11-16', 30), []);
  });
});
