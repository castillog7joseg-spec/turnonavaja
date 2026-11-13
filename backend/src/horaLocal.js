// Hora del local: Argentina, UTC−3 todo el año (sin horario de verano).
// La computadora guarda en UTC; las reglas se piensan en hora del local.

const OFFSET_MIN = -180; // UTC−3
const MS_MIN = 60 * 1000;

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Convierte un instante (Date en UTC) a sus partes en hora del local. */
export function aLocal(fecha) {
  const d = new Date(fecha.getTime() + OFFSET_MIN * MS_MIN);
  return {
    anio: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    hora: d.getUTCHours(),
    minuto: d.getUTCMinutes(),
    diaSemana: d.getUTCDay(), // 0 = domingo … 6 = sábado
    nombreDia: DIAS[d.getUTCDay()],
    minutosDelDia: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** Arma un instante a partir de fecha 'AAAA-MM-DD' y hora 'HH:MM' del local. */
export function desdeLocal(fecha, hora = '00:00') {
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  const h = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!f || !h) return null;
  const ms = Date.UTC(+f[1], +f[2] - 1, +f[3], +h[1], +h[2]) - OFFSET_MIN * MS_MIN;
  const d = new Date(ms);
  // Rechaza fechas imposibles como 2026-02-31
  const l = aLocal(d);
  if (l.anio !== +f[1] || l.mes !== +f[2] || l.dia !== +f[3]) return null;
  return d;
}

/** 'AAAA-MM-DD' del día local de un instante. */
export function fechaLocal(fecha) {
  const l = aLocal(fecha);
  return `${l.anio}-${String(l.mes).padStart(2, '0')}-${String(l.dia).padStart(2, '0')}`;
}

/** 'HH:MM' local de un instante. */
export function horaLocal(fecha) {
  const l = aLocal(fecha);
  return `${String(l.hora).padStart(2, '0')}:${String(l.minuto).padStart(2, '0')}`;
}
