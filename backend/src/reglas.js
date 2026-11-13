// Reglas puras del negocio (ver docs/spec.md). No tocan la base de datos:
// reciben datos, devuelven resultados. Por eso se pueden testear solas.

import { aLocal, desdeLocal } from './horaLocal.js';

export const APERTURA_MIN = 10 * 60; // 10:00
export const CIERRE_MIN = 20 * 60; // 20:00
export const DIAS_ABIERTO = [2, 3, 4, 5, 6]; // martes a sábado
export const PASO_MIN = 15;
export const ANTICIPACION_MIN_HORAS = 1;
export const ANTICIPACION_MAX_DIAS = 30;
export const MAX_TURNOS_ACTIVOS = 2;
export const HORAS_CANCELACION_GRATIS = 12;
export const PORCENTAJE_DEUDA_CANCELACION = 0.5;

export class ErrorNegocio extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

/** R1 — Horario de atención. Devuelve un mensaje de error o null. */
export function errorDeHorario(inicio, duracionMin) {
  const l = aLocal(inicio);
  if (!DIAS_ABIERTO.includes(l.diaSemana)) {
    return `El local está cerrado los ${l.nombreDia}`;
  }
  if (l.minuto % PASO_MIN !== 0) {
    return 'Los turnos empiezan cada 15 minutos';
  }
  const desde = l.minutosDelDia;
  const hasta = desde + duracionMin;
  if (desde < APERTURA_MIN || hasta > CIERRE_MIN) {
    return 'El turno tiene que empezar y terminar entre las 10:00 y las 20:00';
  }
  return null;
}

/** R2 — Anticipación. Devuelve un mensaje de error o null. */
export function errorDeAnticipacion(inicio, ahora) {
  const diffMin = (inicio.getTime() - ahora.getTime()) / 60000;
  if (diffMin < ANTICIPACION_MIN_HORAS * 60) {
    return 'Hay que reservar con al menos 1 hora de anticipación';
  }
  if (diffMin > ANTICIPACION_MAX_DIAS * 24 * 60) {
    return 'Se puede reservar como máximo con 30 días de anticipación';
  }
  return null;
}

/** R5 — Modificador de precio según el momento de inicio. */
export function modificadorDePrecio(inicio) {
  const l = aLocal(inicio);
  if (l.diaSemana === 6) return { factor: 1.2, motivo: 'Sábado +20%' };
  if ((l.diaSemana === 2 || l.diaSemana === 3) && l.minutosDelDia < 14 * 60) {
    return { factor: 0.85, motivo: 'Horario tranqui −15%' };
  }
  return { factor: 1, motivo: null };
}

/** R5 — Precio final, redondeado al peso. */
export function calcularPrecio(precioBase, inicio) {
  return Math.round(precioBase * modificadorDePrecio(inicio).factor);
}

/** R6 — Qué pasa si se cancela ahora. */
export function evaluarCancelacion(turno, ahora) {
  if (turno.estado !== 'activo') {
    return { permitido: false, motivo: 'El turno no está activo', deuda: 0 };
  }
  const inicio = new Date(turno.inicio);
  const horasAntes = (inicio.getTime() - ahora.getTime()) / 3600000;
  if (horasAntes <= 0) {
    return { permitido: false, motivo: 'El turno ya empezó', deuda: 0 };
  }
  if (horasAntes >= HORAS_CANCELACION_GRATIS) {
    return { permitido: true, deuda: 0 };
  }
  return { permitido: true, deuda: Math.round(turno.precio * PORCENTAJE_DEUDA_CANCELACION) };
}

/** Horarios de inicio posibles de un día local para un servicio (R1). */
export function horariosDelDia(fecha, duracionMin) {
  const base = desdeLocal(fecha, '00:00');
  if (!base) return [];
  if (!DIAS_ABIERTO.includes(aLocal(base).diaSemana)) return [];
  const out = [];
  for (let m = APERTURA_MIN; m + duracionMin <= CIERRE_MIN; m += PASO_MIN) {
    out.push(new Date(base.getTime() + m * 60000));
  }
  return out;
}
