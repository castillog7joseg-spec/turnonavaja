// Cliente HTTP: el frontend no tiene reglas, solo habla con el backend.
// Es "Postman con botones": arma el JSON, lo manda y muestra la respuesta.

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

let token = null;
try {
  token = localStorage.getItem('tn_token');
} catch {
  /* sin almacenamiento: la sesión dura lo que la pestaña */
}

export function setToken(t) {
  token = t;
  try {
    if (t) localStorage.setItem('tn_token', t);
    else localStorage.removeItem('tn_token');
  } catch {
    /* nada */
  }
}

export function hayToken() {
  return Boolean(token);
}

async function pedir(metodo, ruta, cuerpo) {
  let res;
  try {
    res = await fetch(BASE + ruta, {
      method: metodo,
      headers: {
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Si recién lo despertás, puede tardar unos 30 segundos.');
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(datos.error || `Error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return datos;
}

export const api = {
  registro: (d) => pedir('POST', '/auth/registro', d),
  entrada: (d) => pedir('POST', '/auth/entrada', d),
  yo: () => pedir('GET', '/auth/yo'),
  servicios: () => pedir('GET', '/servicios'),
  barberos: () => pedir('GET', '/barberos'),
  disponibilidad: (barbero, servicio, fecha) =>
    pedir('GET', `/disponibilidad?barbero=${barbero}&servicio=${servicio}&fecha=${fecha}`),
  reservar: (d) => pedir('POST', '/turnos', d),
  misTurnos: () => pedir('GET', '/turnos/mios'),
  previaCancelacion: (id) => pedir('GET', `/turnos/${id}/cancelacion`),
  cancelar: (id) => pedir('POST', `/turnos/${id}/cancelar`),
  agenda: (fecha) => pedir('GET', `/admin/agenda?fecha=${fecha}`),
  ausente: (id) => pedir('POST', `/admin/turnos/${id}/ausente`),
  deudores: () => pedir('GET', '/admin/deudores'),
  saldar: (id) => pedir('POST', `/admin/usuarios/${id}/saldar`),
};
