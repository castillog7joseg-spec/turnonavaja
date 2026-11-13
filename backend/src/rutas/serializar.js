import { fechaLocal, horaLocal } from '../horaLocal.js';

// Consulta base: turno con nombres de servicio, barbero y cliente.
export const SELECT_TURNO = `
  SELECT t.*, s.nombre AS servicio, b.nombre AS barbero, u.nombre AS cliente, u.email AS cliente_email
  FROM turnos t
  JOIN servicios s ON s.id = t.servicio_id
  JOIN barberos b ON b.id = t.barbero_id
  JOIN usuarios u ON u.id = t.cliente_id`;

export function turnoJSON(t) {
  return {
    id: t.id,
    inicio: new Date(t.inicio).toISOString(),
    fin: new Date(t.fin).toISOString(),
    fecha: fechaLocal(new Date(t.inicio)),
    hora: horaLocal(new Date(t.inicio)),
    horaFin: horaLocal(new Date(t.fin)),
    servicio: t.servicio,
    barbero: t.barbero,
    barberoId: t.barbero_id,
    cliente: t.cliente,
    clienteId: t.cliente_id,
    precio: t.precio,
    estado: t.estado,
    deudaGenerada: t.deuda_generada,
  };
}
