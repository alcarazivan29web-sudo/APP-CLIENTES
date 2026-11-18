import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cliente, registro, lista, ids, textos, L, M, X, V, S, D, L2 } from './ayuda.js';

test('lunes: salen los activos que tienen el lunes', () => {
  const a = cliente({ diasLlamada: [1] });
  const b = cliente({ diasLlamada: [2] });
  const c = cliente({ diasLlamada: [1, 5] });
  const sinDia = cliente({ diasLlamada: [] });
  const deBaja = cliente({ diasLlamada: [1], estado: 'baja' });
  const r = lista([a, b, c, sinDia, deBaja], [], L);
  assert.deepEqual(ids(r.hoy).sort(), [a.id, c.id].sort());
  assert.equal(r.pendientes.length, 0);
  assert.equal(r.contador.porLlamar, 2);
});

test('el martes salen arriba los que no se llamaron el lunes', () => {
  const a = cliente({ diasLlamada: [1] });
  const b = cliente({ diasLlamada: [2] });
  const hecho = cliente({ diasLlamada: [1] });
  const llamadas = [registro(hecho.id, L, [['no_pide', '10:00']])];
  const r = lista([a, b, hecho], llamadas, M);
  assert.deepEqual(ids(r.pendientes), [a.id]);
  assert.ok(textos(r.pendientes[0]).includes('Pendiente del lunes'));
  assert.equal(r.pendientes[0].fechaPrevista, L);
  assert.deepEqual(ids(r.hoy), [b.id]);
});

test('el lunes siguiente no se arrastra nada, pero avisa de los que quedaron', () => {
  const a = cliente({ diasLlamada: [1] });
  const b = cliente({ diasLlamada: [2] });
  const r = lista([a, b], [], L2);
  assert.deepEqual(ids(r.hoy), [a.id]);
  assert.equal(r.pendientes.length, 0);
  assert.deepEqual(ids(r.semanaPasadaSinLlamar).sort(), [a.id, b.id].sort());
});

test('cliente de lunes y viernes', () => {
  const c = cliente({ diasLlamada: [1, 5] });
  // Pide el lunes: no sale en el resto de la semana hasta el viernes
  const pidio = [registro(c.id, L, [['pide', '10:00', { pedido: '1 caja' }]])];
  assert.equal(lista([c], pidio, M).pendientes.length, 0);
  assert.equal(lista([c], pidio, X).hoy.length, 0);
  assert.deepEqual(ids(lista([c], pidio, V).hoy), [c.id]);
  // Si no se le llamó el lunes, el viernes sale una sola vez (en «hoy», no en pendientes)
  const rv = lista([c], [], V);
  assert.deepEqual(ids(rv.hoy), [c.id]);
  assert.equal(rv.pendientes.length, 0);
});

test('sábado y domingo no toca llamar', () => {
  const c = cliente({ diasLlamada: [1, 2, 3, 4, 5] });
  for (const f of [S, D]) {
    const r = lista([c], [], f);
    assert.equal(r.finDeSemana, true);
    assert.equal(r.hoy.length + r.pendientes.length + r.masTarde.length, 0);
  }
});

test('antes de empezar a usar la app no hay pendientes', () => {
  const c = cliente({ diasLlamada: [1] });
  const r = lista([c], [], X, '10:00', X);
  assert.equal(r.pendientes.length, 0);
});

test('un cliente importado hoy no genera pendientes de días anteriores', () => {
  const c = cliente({ diasLlamada: [1], creado: `${X}T09:00:00.000+01:00`, diasLlamadaDesde: X });
  assert.equal(lista([c], [], X).pendientes.length, 0);
});
