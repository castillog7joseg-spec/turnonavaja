// Ayudas de formato. Solo para mostrar: las reglas viven en el backend.
// Las fechas se calculan en hora del local (Argentina, UTC−3).

const OFFSET_MS = -3 * 3600000;
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function local(d) {
  return new Date(d.getTime() + OFFSET_MS);
}

export function hoyLocal() {
  return aFecha(new Date());
}

export function aFecha(d) {
  return local(d).toISOString().slice(0, 10);
}

/** Próximos días abiertos (martes a sábado), en formato AAAA-MM-DD. */
export function proximosDiasAbiertos(cantidad = 12) {
  const out = [];
  let d = new Date();
  for (let i = 0; out.length < cantidad && i < 31; i++) {
    const l = local(d);
    if (l.getUTCDay() >= 2 && l.getUTCDay() <= 6) out.push(aFecha(d));
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}

export function etiquetaDia(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return { dia: DIAS[dt.getUTCDay()], num: d, mes: MESES[m - 1] };
}

export function fechaLarga(fecha) {
  const e = etiquetaDia(fecha);
  return `${e.dia} ${e.num} ${e.mes}`;
}

export function pesos(n) {
  return '$' + Number(n).toLocaleString('es-AR');
}
