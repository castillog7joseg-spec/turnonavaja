# ✂ TurnoNavaja

Sistema de turnos online para **Barbería Navaja** (negocio ficticio). Los clientes eligen servicio, barbero y horario; el sistema aplica las reglas del local: horarios de atención, precios por día y hora, turnos que no se pisan, cancelaciones con penalidad y bloqueo por deuda.

Proyecto Final — desarrollado con el método **spec-first con IA**: primero las reglas (spec), después el plan técnico, después los tests en rojo y recién ahí el código.

> 🌐 **En producción:** `https://TU-SITIO.netlify.app` *(reemplazar después del deploy)*

---

## Documentación

| Documento | Qué tiene |
|---|---|
| [`docs/spec.md`](docs/spec.md) | Entrevista con el cliente, glosario y **las 9 reglas del negocio** |
| [`docs/plan.md`](docs/plan.md) | Arquitectura, modelo de datos, API y variables de entorno |
| [`docs/tareas.md`](docs/tareas.md) | Tareas derivadas de la spec y el test que cubre cada una |

## Reglas principales

- Atención **martes a sábado, 10 a 20 h** (hora de Argentina). Turnos cada 15 minutos.
- **Sábado +20 %** · **Martes y miércoles antes de las 14 h −15 %**.
- Un barbero no puede tener dos turnos que se pisen: si dos personas reservan a la vez, una recibe **409**.
- Máximo **2 turnos activos** por cliente.
- Cancelar con **menos de 12 h** → deuda del **50 %**. No venir → deuda del **100 %**.
- Con deuda no se pueden sacar turnos hasta que el admin la salde.

### Las tres preguntas de control

| Pregunta | Respuesta del sistema |
|---|---|
| Dos clientes reservan a Martín el martes 11:00 a la vez | Uno 201, el otro 409 |
| Combo con Lucía, sábado 16:00 | $14.400 |
| Cancelar un corte de $8.000 seis horas antes | Deuda de $4.000 |

## Tecnologías

| Parte | Tecnología | Local | Producción |
|---|---|---|---|
| Frontend | React + Vite | `localhost:5173` | Netlify |
| Backend | Node.js + Express | `localhost:3000` | Render |
| Base de datos | PostgreSQL | PostgreSQL local | Neon |
| Tests | `node:test` + Supertest | — | — |

## Estructura

```
backend/
  src/
    reglas.js      ← reglas puras del negocio (sin base de datos)
    horaLocal.js   ← UTC ↔ hora de Argentina
    reloj.js       ← el Reloj (se fija y avanza en los tests)
    schema.sql     ← tablas + restricción anti-superposición
    rutas/         ← endpoints
  test/
    reglas.test.js ← 24 tests de reglas
    api.test.js    ← 36 tests de punta a punta contra PostgreSQL
frontend/
  src/pages/       ← Entrar, Reservar, MisTurnos, Admin
docs/              ← spec, plan, tareas
```

---

## Cómo correrlo en tu compu

Necesitás **Node.js 20+** y **PostgreSQL**.

### 1. Base de datos

```bash
createdb navaja        # base para usar
createdb navaja_test   # base aparte para los tests (se borra en cada test)
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env            # completá DATABASE_URL con tu usuario y contraseña
npm run dev                     # → http://localhost:3000
```

Al arrancar crea las tablas, los servicios, los barberos y el admin inicial (`INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`).

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                     # → http://localhost:5173
```

### 4. Tests

```bash
cd backend
cp .env.test.example .env.test  # apuntá DATABASE_URL a navaja_test
npm test
```

Resultado esperado: **60 tests, 60 pasan**.

---

## Deploy (de mi compu a internet)

1. **Neon** (base de datos): crear proyecto → copiar la cadena de conexión `postgresql://…neon.tech/…`.
2. **Render** (backend): *New → Web Service* → conectar este repo → **Root Directory: `backend`**, Build: `npm install`, Start: `npm start`. Variables de entorno:
   - `DATABASE_URL` = cadena de Neon
   - `JWT_SECRET` = un texto largo cualquiera
   - `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`
   - `FRONTEND_URL` = la URL de Netlify (se completa después del paso 3)
3. **Netlify** (frontend): *Add new site → Import from Git* → este repo. Toma la configuración de `netlify.toml`. Variable de entorno: `VITE_API_URL` = URL de Render.
4. Volver a Render y completar `FRONTEND_URL` con la URL de Netlify (para CORS).

Desde ahí: **`git push` y listo** — Netlify y Render detectan el cambio y se reconstruyen solos.

> ⚠️ Render gratis "se duerme" si nadie lo usa: el primer pedido puede tardar ~30 segundos.

## Seguridad

- Los secretos viven en `.env` (en `.gitignore`) o en el panel de cada servicio. **Nunca en el repo.**
- Contraseñas hasheadas con bcrypt; sesiones con JWT.
- CORS: solo el frontend invitado (`FRONTEND_URL`) puede usar el backend desde el navegador.
