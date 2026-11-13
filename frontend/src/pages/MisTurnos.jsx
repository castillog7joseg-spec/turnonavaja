import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { fechaLarga, pesos } from '../fechas.js';

const ETIQUETAS = { activo: 'Confirmado', cancelado: 'Cancelado', ausente: 'Ausente' };

export default function MisTurnos({ alCambiar }) {
  const [turnos, setTurnos] = useState(null);
  const [error, setError] = useState('');
  const [aCancelar, setACancelar] = useState(null); // { turno, previa }

  const cargar = useCallback(() => {
    api.misTurnos().then(setTurnos).catch((e) => setError(e.message));
  }, []);

  useEffect(cargar, [cargar]);

  async function pedirCancelacion(turno) {
    setError('');
    try {
      const previa = await api.previaCancelacion(turno.id);
      if (!previa.permitido) return setError(previa.motivo);
      setACancelar({ turno, previa });
    } catch (e) {
      setError(e.message);
    }
  }

  async function confirmarCancelacion() {
    try {
      await api.cancelar(aCancelar.turno.id);
      setACancelar(null);
      cargar();
      alCambiar();
    } catch (e) {
      setError(e.message);
      setACancelar(null);
    }
  }

  if (turnos === null) return <p className="tenue">Cargando…</p>;

  const ahora = Date.now();
  const proximos = turnos.filter((t) => t.estado === 'activo' && new Date(t.fin).getTime() > ahora).reverse();
  const historial = turnos.filter((t) => !proximos.includes(t));

  return (
    <div className="mis-turnos">
      {error && <p className="error">{error}</p>}

      <h2>Próximos</h2>
      {proximos.length === 0 ? (
        <p className="tenue">No tenés turnos por delante.</p>
      ) : (
        <ul className="lista-turnos">
          {proximos.map((t) => (
            <li key={t.id} className="tarjeta turno">
              <div className="turno-fecha">
                <b>{t.hora}</b>
                <small>{fechaLarga(t.fecha)}</small>
              </div>
              <div className="turno-detalle">
                <strong>{t.servicio}</strong>
                <span>con {t.barbero}</span>
              </div>
              <div className="turno-precio">{pesos(t.precio)}</div>
              <button className="boton secundario" onClick={() => pedirCancelacion(t)}>
                Cancelar
              </button>
            </li>
          ))}
        </ul>
      )}

      {historial.length > 0 && (
        <>
          <h2>Historial</h2>
          <ul className="lista-turnos historial">
            {historial.map((t) => (
              <li key={t.id} className="turno">
                <div className="turno-fecha">
                  <b>{t.hora}</b>
                  <small>{fechaLarga(t.fecha)}</small>
                </div>
                <div className="turno-detalle">
                  <strong>{t.servicio}</strong>
                  <span>con {t.barbero}</span>
                </div>
                <span className={`estado ${t.estado}`}>
                  {t.estado === 'activo' ? 'Realizado' : ETIQUETAS[t.estado]}
                  {t.deudaGenerada > 0 && ` · deuda ${pesos(t.deudaGenerada)}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {aCancelar && (
        <div className="fondo-modal" onClick={() => setACancelar(null)}>
          <div className="tarjeta modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>¿Cancelar el turno?</h3>
            <p>
              {aCancelar.turno.servicio} con {aCancelar.turno.barbero}, {fechaLarga(aCancelar.turno.fecha)} a las{' '}
              {aCancelar.turno.hora} h.
            </p>
            {aCancelar.previa.deuda > 0 ? (
              <p className="aviso-deuda">
                Faltan menos de 12 horas: cancelar ahora genera una deuda de <b>{pesos(aCancelar.previa.deuda)}</b>{' '}
                (50&nbsp;%). Hasta pagarla no vas a poder sacar turnos.
              </p>
            ) : (
              <p className="aviso-ok">Faltan 12 horas o más: cancelás sin cargo.</p>
            )}
            <div className="acciones">
              <button className="boton secundario" onClick={() => setACancelar(null)}>
                Volver
              </button>
              <button className="boton peligro" onClick={confirmarCancelacion}>
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
