// El Reloj: la única fuente de "qué hora es" del sistema.
// En producción devuelve la hora real. En los tests se puede fijar y avanzar
// ("control remoto del tiempo"): el test dura un segundo, no 12 horas.

let fijado = null;

export function ahora() {
  return fijado ? new Date(fijado.getTime()) : new Date();
}

export function fijar(fecha) {
  fijado = new Date(fecha);
}

export function avanzar(minutos) {
  if (!fijado) fijado = new Date();
  fijado = new Date(fijado.getTime() + minutos * 60 * 1000);
}

export function soltar() {
  fijado = null;
}
