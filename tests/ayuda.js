// Utilidades para los tests: crear clientes y registros de llamada de ejemplo.
import { clienteVacio, nuevoRegistro, aplicarAccion, calcularListaDia } from '../js/logica.js';

// Semana de noviembre de 2026 (el 16 es lunes)
export const L = '2026-11-16', M = '2026-11-17', X = '2026-11-18', J = '2026-11-19', V = '2026-11-20';
export const S = '2026-11-21', D = '2026-11-22', L2 = '2026-11-23', M2 = '2026-11-24';

let n = 0;
export function cliente(extra = {}) {
  n++;
  return {
    ...clienteVacio(), id: 'c' + n, nombreComercial: 'CLIENTE ' + n, poblacion: 'OLIVA',
    telefonos: ['600000000'], creado: '2026-01-01T09:00:00.000+01:00', ...extra,
  };
}

/** Registro con una lista de acciones: [['no_contesta','10:00'], ['pide','11:00',{pedido:'2 cajas'}]] */
export function registro(clienteId, fechaPrevista, acciones, { fecha = fechaPrevista, origen = 'llamada' } = {}) {
  let r = { ...nuevoRegistro(clienteId, fechaPrevista, fecha, origen), id: 'r' + (++n) };
  for (const [tipo, hora, extra] of acciones) {
    r = aplicarAccion(r, { tipo, ...(extra || {}) }, { fecha, hora });
    r.modificado = `${fecha}T${hora}:00.000+01:00`;
  }
  return r;
}

export function lista(clientes, llamadas, fecha, hora = '10:00', primerUso = '2026-01-01') {
  return calcularListaDia({ clientes, llamadas, fecha, hora, primerUso });
}

export const ids = (items) => items.map((i) => i.cliente.id);
export const textos = (item) => item.etiquetas.map((e) => e.texto);
