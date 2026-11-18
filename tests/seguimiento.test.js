// Fase 2 · Seguimiento: recordatorios, clientes en riesgo, potenciales,
// pedido fuera de día y cobro pendiente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularListaDia, calcularSemana, semanasSinPedir, calcularRiesgo, recordatorioVacio,
  recordatoriosDelDia, recordatoriosProximos, aplicarAccion, sumarDias,
} from '../js/logica.js';
import { cliente, registro, ids, textos, L, M, X, J, V, S, L2 } from './ayuda.js';

const rec = (extra) => ({ ...recordatorioVacio(), id: 'rec' + Math.random(), creado: '2026-11-01T09:00:00.000+01:00', ...extra });
const listaCon = ({ clientes, llamadas = [], fecha, hora = '10:00', primerUso = '2026-01-01', recordatorios = [], semanasRiesgo = 3 }) =>
  calcularListaDia({ clientes, llamadas, fecha, hora, primerUso, recordatorios, semanasRiesgo });

// ---------------------------------------------------------------------
//  Recordatorios
// ---------------------------------------------------------------------

test('recordatorio del día: sale arriba y como etiqueta en la tarjeta del cliente', () => {
  const c = cliente({ diasLlamada: [3] });
  const r = rec({ clienteId: c.id, fecha: X, texto: 'Llevar muestras de Muga Rosado' });
  const l = listaCon({ clientes: [c], fecha: X, recordatorios: [r] });
  assert.equal(l.recordatorios.length, 1);
  assert.equal(l.recordatorios[0].vencido, false);
  assert.equal(l.recordatorios[0].cliente.id, c.id);
  assert.ok(textos(l.hoy[0]).includes('Recordatorio: Llevar muestras de Muga Rosado'));
  // El día anterior todavía no sale
  assert.equal(listaCon({ clientes: [c], fecha: M, recordatorios: [r] }).recordatorios.length, 0);
});

test('recordatorio vencido: sigue saliendo hasta que se marca como hecho', () => {
  const r = rec({ fecha: L, texto: 'Cobrar factura' }); // sin cliente
  const l = listaCon({ clientes: [], fecha: J, recordatorios: [r] });
  assert.equal(l.recordatorios.length, 1);
  assert.equal(l.recordatorios[0].vencido, true);
  assert.equal(l.recordatorios[0].cliente, null);
  // También el fin de semana y la semana siguiente
  assert.equal(listaCon({ clientes: [], fecha: L2, recordatorios: [r] }).recordatorios.length, 1);
  // Hecho o borrado: ya no sale
  assert.equal(listaCon({ clientes: [], fecha: J, recordatorios: [{ ...r, hecho: true, fechaHecho: J }] }).recordatorios.length, 0);
  assert.equal(listaCon({ clientes: [], fecha: J, recordatorios: [{ ...r, borrado: true }] }).recordatorios.length, 0);
});

test('recordatorios: orden (vencidos primero) y próximos', () => {
  const a = rec({ fecha: X, texto: 'hoy' });
  const b = rec({ fecha: L, texto: 'lunes' });
  const c = rec({ fecha: V, texto: 'viernes' });
  assert.deepEqual(recordatoriosDelDia([a, b, c], X).map((r) => r.texto), ['lunes', 'hoy']);
  assert.deepEqual(recordatoriosProximos([a, b, c], X).map((r) => r.texto), ['viernes']);
});

test('el recordatorio de un cliente borrado no sale', () => {
  const c = cliente({ diasLlamada: [3], borrado: true });
  const r = rec({ clienteId: c.id, fecha: X, texto: 'x' });
  assert.equal(listaCon({ clientes: [c], fecha: X, recordatorios: [r] }).recordatorios.length, 0);
});

// ---------------------------------------------------------------------
//  Clientes en riesgo
// ---------------------------------------------------------------------

test('cliente en riesgo: 3 semanas o más sin pedir', () => {
  const c = cliente({ diasLlamada: [3] });
  const primerUso = '2026-09-01';
  const pedido = registro(c.id, '2026-10-21', [['pide', '10:00', { pedido: 'x' }]]);
  // 28 días después del último pedido = 4 semanas
  const l = listaCon({ clientes: [c], llamadas: [pedido], fecha: X, primerUso });
  assert.ok(textos(l.hoy[0]).includes('4 semanas sin pedir'));
  // Con un pedido hace 2 semanas, no
  const reciente = registro(c.id, '2026-11-04', [['pide', '10:00', { pedido: 'x' }]]);
  assert.equal(semanasSinPedir(c, '2026-11-04', X, primerUso, 3), null);
  const l2 = listaCon({ clientes: [c], llamadas: [pedido, reciente], fecha: X, primerUso });
  assert.ok(!textos(l2.hoy[0]).some((t) => t.includes('sin pedir')));
  // «No pide» no cuenta como pedido
  const noPide = registro(c.id, '2026-11-11', [['no_pide', '10:00']]);
  assert.equal(calcularRiesgo({ clientes: [c], llamadas: [pedido, noPide], fecha: X, primerUso }).get(c.id), 4);
});

test('nadie sale en riesgo hasta que la app lleva ese número de semanas en uso', () => {
  const c = cliente({ diasLlamada: [3] });
  // Empezó a usarse el lunes 2/11: el miércoles 18/11 lleva 16 días (< 3 semanas)
  assert.equal(calcularRiesgo({ clientes: [c], llamadas: [], fecha: X, primerUso: '2026-11-02' }).size, 0);
  // El lunes 23/11 lleva justo 3 semanas sin ningún pedido
  assert.equal(calcularRiesgo({ clientes: [c], llamadas: [], fecha: L2, primerUso: '2026-11-02' }).get(c.id), 3);
  // El número de semanas se puede cambiar en Ajustes
  assert.equal(calcularRiesgo({ clientes: [c], llamadas: [], fecha: L2, primerUso: '2026-11-02', semanas: 4 }).size, 0);
});

test('riesgo: solo clientes activos con día de llamada; cuenta desde el alta o la vuelta de vacaciones', () => {
  const primerUso = '2026-09-01';
  const sinDia = cliente({ diasLlamada: [] });
  const baja = cliente({ diasLlamada: [3], estado: 'baja' });
  const potencial = cliente({ diasLlamada: [3], estado: 'potencial' });
  const nuevo = cliente({ diasLlamada: [3], creado: '2026-11-10T09:00:00.000+01:00' });
  const volvio = cliente({ diasLlamada: [3], estado: 'vacaciones', vacacionesDesde: '2026-10-01', vacacionesHasta: '2026-11-09' });
  const m = calcularRiesgo({ clientes: [sinDia, baja, potencial, nuevo, volvio], llamadas: [], fecha: X, primerUso });
  assert.equal(m.size, 0);
});

// ---------------------------------------------------------------------
//  Potenciales y bloque Captación
// ---------------------------------------------------------------------

test('potencial con día de llamada: sale en Captación, no en «Por llamar hoy»', () => {
  const p = cliente({ diasLlamada: [3], estado: 'potencial' });
  const c = cliente({ diasLlamada: [3] });
  const l = listaCon({ clientes: [p, c], fecha: X });
  assert.deepEqual(ids(l.captacion), [p.id]);
  assert.deepEqual(ids(l.hoy), [c.id]);
  assert.equal(l.contador.porLlamar, 1, 'el contador no cuenta la captación');
  assert.equal(l.contador.captacion, 1);
  // Su pendiente del lunes también va a Captación
  const p2 = cliente({ diasLlamada: [1], estado: 'potencial' });
  const l2 = listaCon({ clientes: [p2], fecha: X });
  assert.deepEqual(ids(l2.captacion), [p2.id]);
  assert.equal(l2.pendientes.length, 0);
  // Potencial sin día: no sale
  assert.equal(listaCon({ clientes: [cliente({ estado: 'potencial' })], fecha: X }).captacion.length, 0);
});

test('potencial que pide y pasa a cliente', () => {
  const p = cliente({ diasLlamada: [3, 5], estado: 'potencial' });
  const r = registro(p.id, X, [['pide', '10:00', { pedido: 'Caja de prueba' }]]);
  const l = listaCon({ clientes: [p], llamadas: [r], fecha: X });
  assert.equal(l.captacion.length, 0);
  assert.deepEqual(ids(l.hechos), [p.id]);
  // Pasa a cliente: el viernes ya sale en «Por llamar hoy»
  const cliente2 = { ...p, estado: 'activo' };
  const v = listaCon({ clientes: [cliente2], llamadas: [r], fecha: V });
  assert.deepEqual(ids(v.hoy), [p.id]);
  assert.equal(v.captacion.length, 0);
});

test('vista Semana: los potenciales salen en su día', () => {
  const p = cliente({ diasLlamada: [3], estado: 'potencial' });
  const s = calcularSemana({ clientes: [p], llamadas: [], lunes: L, fecha: X, primerUso: '2026-01-01' });
  assert.equal(s.dias[2].items[0].situacion, 'por_llamar');
});

// ---------------------------------------------------------------------
//  Pedido fuera de su día
// ---------------------------------------------------------------------

test('pedido en visita el martes: sale en «Hechos hoy» y tapa el resto de la semana', () => {
  const c = cliente({ diasLlamada: [3, 5] });
  const r = registro(c.id, M, [['pide', '12:30', { pedido: '6 botellas' }]], { origen: 'visita' });
  const ma = listaCon({ clientes: [c], llamadas: [r], fecha: M });
  assert.deepEqual(ids(ma.hechos), [c.id]);
  assert.equal(listaCon({ clientes: [c], llamadas: [r], fecha: X }).hoy.length, 0);
  assert.equal(listaCon({ clientes: [c], llamadas: [r], fecha: V }).hoy.length, 0);
  const s = calcularSemana({ clientes: [c], llamadas: [r], lunes: L, fecha: V, primerUso: '2026-01-01' });
  assert.equal(s.dias[2].items[0].situacion, 'cubierto');
  // La semana siguiente vuelve solo
  assert.equal(listaCon({ clientes: [c], llamadas: [r], fecha: sumarDias(X, 7) }).hoy.length, 1);
});

test('pedido por WhatsApp en su mismo día, después de no contestar, también tapa el viernes', () => {
  const c = cliente({ diasLlamada: [3, 5] });
  let r = registro(c.id, X, [['no_contesta', '10:00']]);
  // Lo que hace «Registrar pedido»: cambia el origen y apunta el pedido
  r = aplicarAccion({ ...r, origen: 'whatsapp' }, { tipo: 'pide', pedido: '2 cajas' }, { fecha: X, hora: '12:00' });
  r.modificado = `${X}T12:00:00.000+01:00`;
  assert.deepEqual(ids(listaCon({ clientes: [c], llamadas: [r], fecha: X }).hechos), [c.id]);
  assert.equal(listaCon({ clientes: [c], llamadas: [r], fecha: V }).hoy.length, 0);
});

test('un pedido fuera de día deshecho ya no tapa la semana', () => {
  const c = cliente({ diasLlamada: [5] });
  const r = registro(c.id, M, [['pide', '12:30', { pedido: 'x' }]], { origen: 'cliente_llama' });
  const deshecho = { ...r, intentos: [], resultado: null, pedido: '' };
  assert.equal(listaCon({ clientes: [c], llamadas: [deshecho], fecha: V }).hoy.length, 1);
});

// ---------------------------------------------------------------------
//  Cobro pendiente
// ---------------------------------------------------------------------

test('cobro pendiente: etiqueta en la tarjeta', () => {
  const c = cliente({ diasLlamada: [3], pendienteCobro: { importe: 120, nota: 'Factura 45' } });
  assert.ok(textos(listaCon({ clientes: [c], fecha: X }).hoy[0]).includes('Cobro pendiente: 120 €'));
  const d = cliente({ diasLlamada: [3], pendienteCobro: { importe: 85.5, nota: '' } });
  assert.ok(textos(listaCon({ clientes: [d], fecha: X }).hoy[0]).includes('Cobro pendiente: 85,50 €'));
  const e = cliente({ diasLlamada: [3], pendienteCobro: null });
  assert.ok(!textos(listaCon({ clientes: [e], fecha: X }).hoy[0]).some((t) => t.startsWith('Cobro')));
});

test('importante: sale el primero de su bloque', () => {
  const a = cliente({ diasLlamada: [3], poblacion: 'ADSUBIA' });
  const b = cliente({ diasLlamada: [3], poblacion: 'PEGO', importante: true });
  assert.deepEqual(ids(listaCon({ clientes: [a, b], fecha: X }).hoy), [b.id, a.id]);
});

test('el fin de semana los recordatorios siguen saliendo', () => {
  const r = rec({ fecha: V, texto: 'Pasar por el almacén' });
  assert.equal(listaCon({ clientes: [], fecha: S, recordatorios: [r] }).recordatorios.length, 1);
});
