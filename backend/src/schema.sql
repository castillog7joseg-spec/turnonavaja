-- Esquema de TurnoNavaja. Se puede correr muchas veces sin romper nada.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente', 'admin')),
  deuda         INTEGER NOT NULL DEFAULT 0 CHECK (deuda >= 0),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS barberos (
  id     SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS servicios (
  id           SERIAL PRIMARY KEY,
  codigo       TEXT NOT NULL UNIQUE,
  nombre       TEXT NOT NULL,
  duracion_min INTEGER NOT NULL CHECK (duracion_min > 0),
  precio_base  INTEGER NOT NULL CHECK (precio_base >= 0)
);

CREATE TABLE IF NOT EXISTS turnos (
  id             SERIAL PRIMARY KEY,
  cliente_id     INTEGER NOT NULL REFERENCES usuarios(id),
  barbero_id     INTEGER NOT NULL REFERENCES barberos(id),
  servicio_id    INTEGER NOT NULL REFERENCES servicios(id),
  inicio         TIMESTAMPTZ NOT NULL,
  fin            TIMESTAMPTZ NOT NULL,
  precio         INTEGER NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'cancelado', 'ausente')),
  deuda_generada INTEGER NOT NULL DEFAULT 0,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fin > inicio)
);

-- R3: un barbero no puede tener dos turnos activos que se pisen.
-- La garantiza la base: aunque dos pedidos lleguen a la vez, solo uno entra.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turnos_barbero_sin_superposicion') THEN
    ALTER TABLE turnos ADD CONSTRAINT turnos_barbero_sin_superposicion
      EXCLUDE USING gist (barbero_id WITH =, tstzrange(inicio, fin) WITH &&)
      WHERE (estado = 'activo');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS turnos_cliente_idx ON turnos (cliente_id, inicio);
CREATE INDEX IF NOT EXISTS turnos_inicio_idx ON turnos (inicio);
