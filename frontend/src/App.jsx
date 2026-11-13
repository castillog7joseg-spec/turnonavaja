import { useCallback, useEffect, useState } from 'react';
import { api, hayToken, setToken } from './api.js';
import { pesos } from './fechas.js';
import Entrar from './pages/Entrar.jsx';
import Reservar from './pages/Reservar.jsx';
import MisTurnos from './pages/MisTurnos.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(hayToken());
  const [vista, setVista] = useState('reservar');

  const refrescarUsuario = useCallback(async () => {
    try {
      setUsuario(await api.yo());
    } catch {
      setToken(null);
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (hayToken()) refrescarUsuario();
  }, [refrescarUsuario]);

  function alEntrar({ token, usuario }) {
    setToken(token);
    setUsuario(usuario);
    setVista(usuario.rol === 'admin' ? 'admin' : 'reservar');
  }

  function salir() {
    setToken(null);
    setUsuario(null);
  }

  if (cargando) return <div className="pantalla-centro">Cargando…</div>;
  if (!usuario) return <Entrar alEntrar={alEntrar} />;

  const esAdmin = usuario.rol === 'admin';
  const pestanas = esAdmin
    ? [['admin', 'Agenda y deudas']]
    : [
        ['reservar', 'Sacar turno'],
        ['mios', 'Mis turnos'],
      ];

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          <span className="marca-logo">✂</span>
          <span>
            Barbería <b>Navaja</b>
          </span>
        </div>
        <nav className="pestanas">
          {pestanas.map(([id, txt]) => (
            <button key={id} className={vista === id ? 'activa' : ''} onClick={() => setVista(id)}>
              {txt}
            </button>
          ))}
        </nav>
        <div className="usuario">
          {usuario.deuda > 0 && <span className="chip-deuda">Deuda {pesos(usuario.deuda)}</span>}
          <span className="usuario-nombre">{usuario.nombre}</span>
          <button className="link" onClick={salir}>
            Salir
          </button>
        </div>
      </header>

      <main className="contenido">
        {vista === 'reservar' && !esAdmin && (
          <Reservar usuario={usuario} alReservar={() => { refrescarUsuario(); setVista('mios'); }} />
        )}
        {vista === 'mios' && !esAdmin && <MisTurnos alCambiar={refrescarUsuario} />}
        {esAdmin && <Admin />}
      </main>

      <footer className="pie">TurnoNavaja · Martes a sábado, 10 a 20 h · Proyecto Final</footer>
    </div>
  );
}
