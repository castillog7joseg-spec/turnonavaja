# Plan técnico — TurnoNavaja

Traducción de la [spec](spec.md) a decisiones técnicas.

## Arquitectura

| Parte | En mi compu | En internet | Tecnología |
|---|---|---|---|
| Frontend (pantallas) | `localhost:5173` | Netlify | React + Vite |
| Backend (reglas) | `localhost:3000` | Render | Node.js + Express |
| Base de datos | PostgreSQL local | Neon | PostgreSQL |

El frontend no tiene reglas: solo arma pedidos, los manda al backend y muestra la respuesta. **Todas las reglas viven en el backend.**

## Estructura de carpetas

```
backend/
  src/
    app.js          → arma Express (rutas, CORS, errores)
    server.js       → arranca el servidor
    db.js           → conexión a PostgreSQL (DATABASE_URL)
    schema.sql      → tablas
    seed.js         → servicios, barberos y admin inicial
    reloj.js        → "qué hora es" (se puede fijar en los tests)
    horaLocal.js    → conversión UTC ↔ hora del local (UTC−3)
    reglas.js       → reglas puras: horario, precio, cancelación (sin base de datos)
    auth.js         → hash de contraseñas y tokens JWT
    rutas/          → endpoints
  test/
    reglas.test.js  → tests de reglas puras
    api.test.js     → tests de punta a punta contra PostgreSQL de prueba
frontend/
  src/
    api.js          → cliente HTTP (VITE_API_URL)
    pages/          → pantallas
docs/
  spec.md, plan.md, tareas.md
```

## Modelo de datos

```
usuarios(id, nombre, email UNIQUE, password_hash, rol['cliente'|'admin'], deuda INTEGER, creado_en)
barberos(id, nombre, activo)
servicios(id, codigo UNIQUE, nombre, duracion_min, precio_base)
turnos(id, cliente_id → usuarios, barbero_id → barberos, servicio_id → servicios,
       inicio TIMESTAMPTZ, fin TIMESTAMPTZ, precio INTEGER,
       estado['activo'|'cancelado'|'ausente'],
       deuda_generada INTEGER, creado_en)
```

- Montos en **pesos enteros** (INTEGER), sin decimales.
- Fechas guardadas en **UTC** (`TIMESTAMPTZ`). Las reglas convierten a hora del local.
- **R3 (sin superposición) la garantiza la base**: restricción `EXCLUDE USING gist (barbero_id WITH =, tstzrange(inicio, fin) WITH &&) WHERE (estado = 'activo')`. Aunque dos pedidos lleguen al mismo milisegundo, PostgreSQL deja pasar uno solo; el otro se traduce a **409**.

## El Reloj

La computadora piensa en UTC (3 horas adelante). `reloj.js` expone `ahora()`; en los tests se puede **fijar** y **avanzar** (control remoto del tiempo) para probar cancelaciones sin esperar 12 horas reales. Solo se habilita con `NODE_ENV=test`.

## API

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| POST | `/auth/registro` | público | Crea cliente (R9) |
| POST | `/auth/entrada` | público | Devuelve token |
| GET | `/auth/yo` | logueado | Datos del usuario y deuda |
| GET | `/servicios` | público | Lista servicios |
| GET | `/barberos` | público | Lista barberos |
| GET | `/disponibilidad?barbero=&servicio=&fecha=AAAA-MM-DD` | público | Horarios libres con precio |
| POST | `/turnos` | cliente | Reserva (R1–R5, R8) |
| GET | `/turnos/mios` | cliente | Mis turnos |
| GET | `/turnos/:id/cancelacion` | cliente | Vista previa: ¿genera deuda? |
| POST | `/turnos/:id/cancelar` | cliente | Cancela (R6) |
| GET | `/admin/agenda?fecha=` | admin | Turnos del día |
| POST | `/admin/turnos/:id/ausente` | admin | Marca ausente (R7) |
| GET | `/admin/deudores` | admin | Clientes con deuda |
| POST | `/admin/usuarios/:id/saldar` | admin | Deuda a 0 (R8) |
| GET | `/salud` | público | Chequeo (Render) |

Códigos: `400` dato inválido · `401` sin login · `403` sin permiso o con deuda · `404` no existe · `409` choque · `422` regla de negocio no cumplida.

## Variables de entorno

| Dónde | Variable | Para qué |
|---|---|---|
| Netlify | `VITE_API_URL` | Dirección del backend en Render |
| Render | `DATABASE_URL` | Cadena de conexión a Neon |
| Render | `JWT_SECRET` | Firma de los tokens |
| Render | `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | Admin inicial |
| Render | `FRONTEND_URL` | Dirección de Netlify, para CORS |

Los secretos viven en `.env` (que está en `.gitignore`) o en el panel de cada servicio. **Nunca en el repo.**
