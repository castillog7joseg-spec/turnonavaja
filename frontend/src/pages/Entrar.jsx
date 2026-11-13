import { useState } from 'react';
import { api } from '../api.js';

export default function Entrar({ alEntrar }) {
  const [modo, setModo] = useState('entrar');
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = modo === 'entrar' ? await api.entrada(form) : await api.registro(form);
      alEntrar(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="portada">
      <section className="portada-texto">
        <p className="sobretitulo">Barbería Navaja · desde 1987</p>
        <h1>
          Tu turno,
          <br />
          sin WhatsApp.
        </h1>
        <p className="bajada">
          Elegí servicio, barbero y horario. Martes y miércoles antes de las 14 h, 15&nbsp;% menos. Sábados, +20&nbsp;%.
        </p>
        <ul className="reglas-cortas">
          <li>Cancelá gratis hasta 12 h antes</li>
          <li>Hasta 2 turnos a la vez</li>
        </ul>
      </section>

      <form className="tarjeta form-entrar" onSubmit={enviar}>
        <div className="segmento">
          <button type="button" className={modo === 'entrar' ? 'activa' : ''} onClick={() => setModo('entrar')}>
            Entrar
          </button>
          <button type="button" className={modo === 'registro' ? 'activa' : ''} onClick={() => setModo('registro')}>
            Crear cuenta
          </button>
        </div>

        {modo === 'registro' && (
          <label>
            Nombre
            <input name="nombre" value={form.nombre} onChange={cambiar} required autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={cambiar} required autoComplete="email" />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={cambiar}
            required
            minLength={modo === 'registro' ? 8 : undefined}
            autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="boton" disabled={enviando}>
          {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  );
}
