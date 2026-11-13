import { crearApp } from './app.js';
import { crearTablas } from './db.js';
import { cargarDatosIniciales } from './seed.js';

const PORT = Number(process.env.PORT) || 3000;

await crearTablas();
await cargarDatosIniciales();

crearApp().listen(PORT, () => {
  console.log(`TurnoNavaja backend escuchando en http://localhost:${PORT}`);
});
