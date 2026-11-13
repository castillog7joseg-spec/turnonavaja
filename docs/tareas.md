# Tareas — ciclo rojo → verde → refactor

Cada tarea sale de una regla de la spec. Primero el test en rojo, después el código que lo pone en verde.

| # | Tarea | Regla | Test |
|---|---|---|---|
| 1 | Conversión UTC ↔ hora del local | Glosario | `reglas.test.js` › hora local |
| 2 | Validar horario de atención y múltiplos de 15 | R1 | `reglas.test.js` › R1 |
| 3 | Validar anticipación mínima y máxima | R2 | `reglas.test.js` › R2 |
| 4 | Calcular precio con modificadores | R5 | `reglas.test.js` › R5 |
| 5 | Calcular deuda por cancelación | R6 | `reglas.test.js` › R6 |
| 6 | Tablas + restricción anti-superposición | R3 | `api.test.js` › R3 |
| 7 | Registro y entrada | R9 | `api.test.js` › R9 |
| 8 | Reservar turno | R1–R5 | `api.test.js` › reservar |
| 9 | Límite de 2 turnos y sin pisarse | R4 | `api.test.js` › R4 |
| 10 | Disponibilidad con precio | R1, R3, R5 | `api.test.js` › disponibilidad |
| 11 | Cancelar con/sin deuda (Reloj) | R6 | `api.test.js` › R6 |
| 12 | Ausente → deuda 100 % | R7 | `api.test.js` › R7 |
| 13 | Bloqueo por deuda y saldar | R8 | `api.test.js` › R8 |
| 14 | Frontend: entrar, reservar, mis turnos, admin | §5 | manual |
| 15 | Deploy: Netlify + Render + Neon | — | manual |

Estado: ✅ todas completas.
