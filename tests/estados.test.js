import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoEnFecha, calcularSemana } from '../js/logica.js';
import { cliente, registro, lista, ids, L, M, X, J, V, L2 } from './ayuda.js';

test('«semana que viene» con un cliente que tiene dos días esa semana', () => {
  const c = cliente({ diasLlamada: [1, 3], saltarSemana: L });
  assert.equal(lista([c], [], L).hoy.length, 0);
  const mi = lista([c], [], X);
  assert.equal(mi.hoy.length + mi.pendientes.length, 0);
  assert.deepEqual(ids(lista([c], [], L2).hoy), [c.id], 'la semana siguiente vuelve solo');
  // Deshacer = quitar la marca
  assert.deepEqual(ids(lista([{ ...c, saltarSemana: null }], [], X).hoy), [c.id]);
});

test('pedido fuera de su día tapa el resto de la semana', () => {
  const c = cliente({ diasLlamada: [1, 3] });
  const r = registro(c.id, M, [['pide', '09:15', { pedido: '3 cajas' }]], { origen: 'cliente_llama' });
  const ma = lista([c], [r], M);
  assert.equal(ma.pendientes.length, 0, 'el pendiente del lunes queda tapado');
  assert.deepEqual(ids(ma.hechos), [c.id]);
  const mi = lista([c], [r], X);
  assert.equal(mi.hoy.length + mi.pendientes.length, 0);
  assert.deepEqual(ids(lista([c], [], L2).hoy), [c.id]);
});

test('vacaciones con fecha de vuelta: vuelve solo ese día y no deja pendientes', () => {
  const c = cliente({ diasLlamada: [1, 3, 5], estado: 'vacaciones', vacacionesDesde: L, vacacionesHasta: J });
  assert.equal(lista([c], [], L).hoy.length, 0);
  assert.equal(lista([c], [], X).hoy.length, 0);
  assert.equal(estadoEnFecha(c, J), 'activo');
  const vi = lista([c], [], V);
  assert.deepEqual(ids(vi.hoy), [c.id]);
  assert.equal(vi.pendientes.length, 0, 'los días de vacaciones no cuentan como pendientes');
});

test('un pendiente de antes de irse de vacaciones no aparece al volver', () => {
  const c = cliente({ diasLlamada: [1], estado: 'vacaciones', vacacionesDesde: M, vacacionesHasta: J });
  assert.equal(lista([c], [], J).pendientes.length, 0);
});

test('vacaciones sin fecha: no vuelve hasta que se reactiva a mano', () => {
  const c = cliente({ diasLlamada: [1, 3], estado: 'vacaciones', vacacionesDesde: L, vacacionesHasta: null });
  assert.equal(lista([c], [], X).hoy.length, 0);
  assert.equal(lista([c], [], L2).hoy.length, 0);
  assert.equal(estadoEnFecha(c, '2027-03-01'), 'vacaciones');
  const reactivado = { ...c, estado: 'activo', vacacionesHasta: X };
  assert.deepEqual(ids(lista([reactivado], [], X).hoy), [c.id]);
  assert.equal(lista([reactivado], [], X).pendientes.length, 0);
});

test('baja y reactivación', () => {
  const c = cliente({ diasLlamada: [3], estado: 'baja', fechaBaja: L, motivoBaja: 'Ha cerrado' });
  assert.equal(lista([c], [], X).hoy.length, 0);
  const reactivado = { ...c, estado: 'activo', fechaBaja: null, motivoBaja: '' };
  assert.deepEqual(ids(lista([reactivado], [], X).hoy), [c.id]);
});

test('borrado suave: no sale en ningún sitio', () => {
  const c = cliente({ diasLlamada: [3], borrado: true });
  assert.equal(lista([c], [], X).hoy.length, 0);
});

test('vista de la semana: situación de cada cliente y totales', () => {
  const a = cliente({ diasLlamada: [1] });
  const b = cliente({ diasLlamada: [1] });
  const c = cliente({ diasLlamada: [1, 3] });
  const d = cliente({ diasLlamada: [3] });
  const llamadas = [
    registro(a.id, L, [['pide', '10:00', { pedido: 'x' }]]),
    registro(c.id, L, [['no_contesta', '10:00']]),
  ];
  const s = calcularSemana({ clientes: [a, b, c, d], llamadas, lunes: L, fecha: X, primerUso: '2026-01-01' });
  const lunes = Object.fromEntries(s.dias[0].items.map((i) => [i.cliente.id, i.situacion]));
  assert.equal(lunes[a.id], 'pide');
  assert.equal(lunes[b.id], 'pendiente');
  assert.equal(lunes[c.id], 'no_contesta');
  assert.equal(s.dias[0].cuentas.llamados, 2);
  assert.equal(s.dias[0].cuentas.pide, 1);
  assert.equal(s.dias[0].cuentas.pendientes, 1);
  const mie = Object.fromEntries(s.dias[2].items.map((i) => [i.cliente.id, i.situacion]));
  assert.equal(mie[d.id], 'por_llamar');
});

test('adelantar el martes la llamada del miércoles', () => {
  const c = cliente({ diasLlamada: [3] });
  const r = registro(c.id, X, [['pide', '12:00', { pedido: 'x' }]], { fecha: M });
  assert.deepEqual(ids(lista([c], [r], M).hechos), [c.id]);
  assert.equal(lista([c], [r], X).hoy.length, 0);
});
