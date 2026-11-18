// =====================================================================
//  reloj.js · Fecha y hora de la app, con «modo prueba».
//  Con ?hoy=2026-11-18&hora=10:30 en la dirección, la app hace como si
//  fuera ese día y esa hora (el reloj sigue avanzando desde ahí).
//  En modo prueba se usa una base de datos APARTE para no tocar los
//  datos reales.
// =====================================================================

import { fechaLocal, horaLocal, aFecha, esFechaValida } from './logica.js';

export function crearReloj(busqueda = '') {
  const p = new URLSearchParams(busqueda);
  const hoy = p.get('hoy');
  const hora = p.get('hora');
  const esPrueba = !!(hoy || hora);
  let desfase = 0;
  if (esPrueba) {
    const real = new Date();
    const f = esFechaValida(hoy) ? hoy : fechaLocal(real);
    const h = /^\d{1,2}:\d{2}$/.test(hora || '') ? hora.padStart(5, '0') : horaLocal(real);
    desfase = aFecha(f, h).getTime() - real.getTime();
  }
  const ahora = () => new Date(Date.now() + desfase);
  return {
    esPrueba,
    ahora,
    ahoraFH() { const d = ahora(); return { fecha: fechaLocal(d), hora: horaLocal(d) }; },
  };
}
