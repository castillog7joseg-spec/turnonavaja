import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { hoyLocal, pesos } from '../fechas.js';

const ETIQUETAS = { activo: 'Confirmado', cancelado: 'Cancelado', ausente: 'Ausente' };

export default function Admin() {
  const [fecha, setFecha] = useState(hoyLocal());
  const [agenda, setAgenda] = useState(null);
  const [deudores, setDeudores] = useState([]);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setError('');
    api.agenda(fecha).then(setAgenda).catch((e) => setError(e.message));
    api.deudores().then(setDeudores).catch((e) => setError(e.message));
  }, [fecha]);

  useEffect(cargar, [cargar]);

  async function accion(fn) {
    try {
      await fn();
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const ahora = Date.now();

  return (
    <div className="admin">
      <section>
        <div className="titulo-con-control">
          <h2>Agenda</h2>
          <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        {agenda === null ? (
          <p className="tenue">Cargando…</p>
        ) : agenda.length === 0 ? (
          <p className="tenue">No hay turnos ese día.</p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Barbero</th>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {agenda.map((t) => {
                  const empezo = new Date(t.inicio).getTime() <= ahora;
                  return (
                    <tr key={t.id} className={t.estado !== 'activo' ? 'apagada' : ''}>
                      <td>
                        {t.hora}–{t.horaFin}
                      </td>
                      <td>{t.barbero}</td>
                      <td>{t.cliente}</td>
                      <td>{t.servicio}</td>
                      <td>{pesos(t.precio)}</td>
                      <td>
                        <span className={`estado ${t.estado}`}>{ETIQUETAS[t.estado]}</span>
                      </td>
                      <td>
                        {t.estado === 'activo' && empezo && (
                          <button className="link peligro" onClick={() => accion(() => api.ausente(t.id))}>
                            Marcar ausente
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Clientes con deuda</h2>
        {deudores.length === 0 ? (
          <p className="tenue">Nadie debe nada. 🎉</p>
        ) : (
          <ul className="lista-deudores">
            {deudores.map((d) => (
              <li key={d.id} className="tarjeta">
                <div>
                  <strong>{d.nombre}</strong>
                  <small>{d.email}</small>
                </div>
                <b className="monto-deuda">{pesos(d.deuda)}</b>
                <button className="boton secundario" onClick={() => accion(() => api.saldar(d.id))}>
                  Pagó en el local
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
