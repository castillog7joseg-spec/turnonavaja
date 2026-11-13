import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { etiquetaDia, fechaLarga, pesos, proximosDiasAbiertos } from '../fechas.js';

export default function Reservar({ usuario, alReservar }) {
  const [servicios, setServicios] = useState([]);
  const [barberos, setBarberos] = useState([]);
  const [servicio, setServicio] = useState(null);
  const [barbero, setBarbero] = useState(null);
  const [fecha, setFecha] = useState(null);
  const [horarios, setHorarios] = useState(null);
  const [elegido, setElegido] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const dias = proximosDiasAbiertos(12);

  useEffect(() => {
    Promise.all([api.servicios(), api.barberos()])
      .then(([s, b]) => {
        setServicios(s);
        setBarberos(b);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setElegido(null);
    setHorarios(null);
    if (!servicio || !barbero || !fecha) return;
    let vigente = true;
    api
      .disponibilidad(barbero.id, servicio.id, fecha)
      .then((r) => vigente && setHorarios(r.horarios))
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [servicio, barbero, fecha]);

  async function confirmar() {
    setError('');
    setEnviando(true);
    try {
      await api.reservar({ barberoId: barbero.id, servicioId: servicio.id, inicio: elegido.inicio });
      alReservar();
    } catch (e) {
      setError(e.message);
      // Si el horario se ocupó (409), refrescamos la lista
      if (e.status === 409) {
        const r = await api.disponibilidad(barbero.id, servicio.id, fecha).catch(() => null);
        if (r) setHorarios(r.horarios);
        setElegido(null);
      }
    } finally {
      setEnviando(false);
    }
  }

  if (usuario.deuda > 0) {
    return (
      <div className="tarjeta aviso">
        <h2>Tenés una deuda de {pesos(usuario.deuda)}</h2>
        <p>Por una cancelación tardía o una ausencia. Pagala en el local y vas a poder sacar turnos de nuevo.</p>
      </div>
    );
  }

  return (
    <div className="reservar">
      <section>
        <h2 className="paso">
          <span>1</span> Servicio
        </h2>
        <div className="grilla-servicios">
          {servicios.map((s) => (
            <button
              key={s.id}
              className={`opcion servicio ${servicio?.id === s.id ? 'sel' : ''}`}
              onClick={() => setServicio(s)}
            >
              <strong>{s.nombre}</strong>
              <span>{s.duracionMin} min</span>
              <span className="precio-base">desde {pesos(Math.round(s.precioBase * 0.85))}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="paso">
          <span>2</span> Barbero
        </h2>
        <div className="fila-chips">
          {barberos.map((b) => (
            <button key={b.id} className={`chip ${barbero?.id === b.id ? 'sel' : ''}`} onClick={() => setBarbero(b)}>
              {b.nombre}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="paso">
          <span>3</span> Día
        </h2>
        <div className="fila-dias">
          {dias.map((f) => {
            const e = etiquetaDia(f);
            return (
              <button key={f} className={`dia ${fecha === f ? 'sel' : ''}`} onClick={() => setFecha(f)}>
                <small>{e.dia}</small>
                <b>{e.num}</b>
                <small>{e.mes}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="paso">
          <span>4</span> Horario
        </h2>
        {!servicio || !barbero || !fecha ? (
          <p className="tenue">Elegí servicio, barbero y día para ver los horarios libres.</p>
        ) : horarios === null ? (
          <p className="tenue">Buscando horarios…</p>
        ) : horarios.length === 0 ? (
          <p className="tenue">No quedan horarios libres ese día. Probá con otro día u otro barbero.</p>
        ) : (
          <div className="grilla-horarios">
            {horarios.map((h) => (
              <button
                key={h.inicio}
                className={`horario ${elegido?.inicio === h.inicio ? 'sel' : ''} ${h.motivo?.includes('−') ? 'descuento' : ''} ${h.motivo?.includes('+') ? 'recargo' : ''}`}
                onClick={() => setElegido(h)}
              >
                <b>{h.hora}</b>
                <small>{pesos(h.precio)}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      {elegido && (
        <div className="confirmar">
          <div>
            <strong>
              {servicio.nombre} con {barbero.nombre}
            </strong>
            <span>
              {fechaLarga(fecha)} · {elegido.hora} h{elegido.motivo ? ` · ${elegido.motivo}` : ''}
            </span>
          </div>
          <div className="confirmar-precio">{pesos(elegido.precio)}</div>
          <button className="boton" onClick={confirmar} disabled={enviando}>
            {enviando ? 'Reservando…' : 'Confirmar turno'}
          </button>
        </div>
      )}
    </div>
  );
}
