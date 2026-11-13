# Spec — TurnoNavaja

Sistema de turnos online para **Barbería Navaja** (negocio ficticio), un local con varios barberos.

> La spec manda. Cualquier cambio de reglas entra primero acá, después en un test, y recién después en el código.

## 1. Entrevista con el cliente (resumen)

Dueño de la barbería: *"Hoy damos los turnos por WhatsApp y es un caos: se nos pisan los turnos, la gente no viene y no avisa, y nunca sabemos cuánto cobrar el sábado. Quiero que los clientes saquen el turno solos, con las reglas claras."*

Decisiones tomadas en la entrevista:

| Pregunta | Decisión |
|---|---|
| ¿Dos personas pueden sacar el mismo barbero a la misma hora? | No. Solo una reserva prospera; la otra recibe **409**. |
| ¿Cuánto se cobra el sábado? | **+20 %** sobre el precio base. |
| ¿Hay descuento en horario flojo? | Sí: **martes y miércoles antes de las 14:00, −15 %**. |
| ¿Qué pasa si cancelan a último momento? | Menos de **12 horas** antes del turno → deuda del **50 %** del precio. |
| ¿Y si no vienen? | El admin lo marca **ausente** → deuda del **100 %**. |
| ¿Puede sacar turno alguien con deuda? | No, hasta que la pague en el local (el admin la salda). |

## 2. Glosario

- **Cliente**: persona registrada que saca turnos.
- **Admin**: el dueño / recepcionista. Hay uno inicial que se crea con variables de entorno.
- **Barbero**: quien atiende. Cada barbero tiene su propia agenda.
- **Servicio**: lo que se hace (corte, barba…). Tiene duración y precio base.
- **Turno**: un cliente + un barbero + un servicio + un horario de inicio. El fin se calcula con la duración.
- **Hora del local**: hora de Argentina (UTC−3, sin horario de verano). **Todas las reglas se evalúan en hora del local**, aunque la computadora guarde en UTC.

## 3. Datos iniciales

**Servicios**

| Código | Nombre | Duración | Precio base |
|---|---|---|---|
| `corte` | Corte | 30 min | $8.000 |
| `barba` | Barba | 20 min | $5.000 |
| `combo` | Corte + Barba | 45 min | $12.000 |

**Barberos**: Martín, Lucía, Ramiro.

## 4. Reglas del negocio

### R1 — Horario de atención
- El local abre **de martes a sábado, de 10:00 a 20:00** (hora del local).
- Domingo y lunes está cerrado.
- El turno tiene que **empezar y terminar** dentro del horario. Un combo (45 min) a las 19:30 no se puede: terminaría 20:15.
- Los turnos empiezan en múltiplos de **15 minutos** (10:00, 10:15, 10:30…).

### R2 — Anticipación
- Se reserva con **al menos 1 hora** de anticipación.
- Se reserva con **como máximo 30 días** de anticipación.

### R3 — Sin superposición
- Un barbero no puede tener dos turnos activos que se pisen en el tiempo.
- Si dos pedidos llegan a la vez para el mismo hueco, **solo uno prospera**; el otro recibe **409 Conflict**.
- Turnos que solo se tocan en el borde (uno termina 10:30 y otro empieza 10:30) **no** se pisan.

### R4 — Límite por cliente
- Un cliente puede tener **como máximo 2 turnos activos a futuro**.
- Un cliente no puede tener **dos turnos que se pisen** entre sí (aunque sean con barberos distintos).

### R5 — Precio
Precio final = precio base × modificador del momento en que **empieza** el turno (hora del local):

| Cuándo | Modificador |
|---|---|
| Sábado (todo el día) | × 1,20 |
| Martes o miércoles con inicio **antes de las 14:00** | × 0,85 |
| Resto | × 1,00 |

- El precio se redondea al peso entero más cercano.
- El precio queda **congelado** al momento de reservar (si mañana cambian los precios, el turno ya sacado no cambia).

Ejemplos:
- Corte, martes 11:00 → $8.000 × 0,85 = **$6.800**
- Combo, sábado 16:00 → $12.000 × 1,20 = **$14.400**
- Barba, jueves 18:00 → **$5.000**
- Corte, miércoles 14:00 → **$8.000** (14:00 ya no es "antes de las 14:00")

### R6 — Cancelación
- El cliente puede cancelar sus propios turnos activos que todavía no empezaron.
- Si cancela con **12 horas o más** de anticipación → sin cargo.
- Si cancela con **menos de 12 horas** → se le genera una **deuda del 50 %** del precio del turno.
- No se puede cancelar un turno que ya empezó.

### R7 — Ausencia
- Después de que el turno empezó, el admin puede marcarlo **ausente**.
- Un turno ausente genera una **deuda del 100 %** del precio.

### R8 — Deudas
- Un cliente con deuda pendiente (mayor a $0) **no puede sacar turnos nuevos** → **403**.
- El admin puede **saldar** la deuda de un cliente (se pagó en el local).

### R9 — Usuarios
- Registro con nombre, email y contraseña (mínimo 8 caracteres). Email único → si ya existe, **409**.
- El admin inicial se crea al arrancar con `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` si todavía no existe.
- Las contraseñas se guardan hasheadas, nunca en texto plano.

## 5. Qué ve cada uno

**Cliente**
- Elegir servicio, barbero y día → ver horarios libres con su precio.
- Reservar un horario.
- Ver sus turnos y su deuda.
- Cancelar (el sistema le avisa antes si va a generar deuda).

**Admin**
- Ver la agenda de un día (todos los barberos).
- Marcar un turno como ausente.
- Ver clientes con deuda y saldarla.

## 6. Las tres preguntas de control

| Pregunta | Respuesta esperada |
|---|---|
| Dos clientes reservan a Martín el martes 11:00 a la vez | Uno recibe 201, el otro 409 |
| Combo con Lucía, sábado 16:00 | $14.400 |
| Cancelar un corte de $8.000 seis horas antes | Cancelado, deuda de $4.000 |

## 7. Cambio de negocio (ejemplo del ciclo)

> *"Los jueves, 10 % de descuento para jubilados."* — Cómo entraría: (1) Analista agrega la regla en R5; (2) Arquitecto: agregar campo `jubilado` al cliente y un modificador nuevo; (3) Tester: test rojo "corte jueves jubilado = $7.200"; (4) Dev lo pone verde; (5) Revisor aprueba el PR → push → se publica solo.
>
> *(No implementado: queda como ejemplo de cómo se trabajaría.)*
