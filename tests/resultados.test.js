import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deshacerUltimaAccion } from '../js/logica.js';
import { cliente, registro, lista, ids, textos, X } from './ayuda.js';

test('«pide» con pedido pasa a hechos, y deshacer lo devuelve a la lista', () => {
  const c = cliente({ diasLlamada: [3] });
  const r = registro(c.id, X, [['pide', '10:42', { pedido: '2 cajas Muga Rosado' }]]);
  assert.equal(r.resultado, 'pide');
  assert.equal(r.pedido, '2 cajas Muga Rosado');
  const l1 = lista([c], [r], X, '10:45');
  assert.equal(l1.hoy.length, 0);
  assert.deepEqual(ids(l1.hechos), [c.id]);
  assert.equal(l1.hechos[0].registro.pedido, '2 cajas Muga Rosado');

  const deshecho = deshacerUltimaAccion(r);
  assert.equal(deshecho.resultado, null);
  assert.equal(deshecho.pedido, '');
  const l2 = lista([c], [deshecho], X, '10:46');
  assert.deepEqual(ids(l2.hoy), [c.id]);
  assert.equal(l2.hechos.length, 0);
});

test('«no contesta» se queda en la lista con sus intentos', () => {
  const c = cliente({ diasLlamada: [3] });
  const otro = cliente({ diasLlamada: [3], poblacion: 'ZZZ' });
  const r = registro(c.id, X, [['no_contesta', '10:00'], ['no_contesta', '10:42']]);
  const l = lista([c, otro], [r], X, '11:00');
  assert.deepEqual(ids(l.hoy), [otro.id, c.id], 'los que no contestan van al final');
  assert.equal(l.hoy[1].noContesta, true);
  assert.ok(textos(l.hoy[1]).includes('No contestó · 2 intentos · último 10:42'));
  assert.equal(l.contador.noContestan, 1);
  assert.equal(l.contador.porLlamar, 2);
});

test('«no contesta» y luego «no pide» después de un WhatsApp', () => {
  const c = cliente({ diasLlamada: [3] });
  const r = registro(c.id, X, [['no_contesta', '10:00'], ['whatsapp', '10:01'], ['no_pide', '12:00']]);
  assert.equal(r.intentos[0].whatsapp, true);
  assert.equal(r.resultado, 'no_pide');
  assert.equal(lista([c], [r], X, '12:01').hechos.length, 1);
});

test('«volver a llamar a las 17:00»: antes en «Más tarde», después arriba del todo', () => {
  const c = cliente({ diasLlamada: [3], poblacion: 'ZZZ' });
  const importante = cliente({ diasLlamada: [3], importante: true });
  const r = registro(c.id, X, [['mas_tarde', '10:00', { hora: '17:00' }]]);
  const antes = lista([c, importante], [r], X, '12:00');
  assert.deepEqual(ids(antes.masTarde), [c.id]);
  assert.deepEqual(ids(antes.hoy), [importante.id]);
  assert.ok(textos(antes.masTarde[0]).includes('Volver a llamar a las 17:00'));

  const despues = lista([c, importante], [r], X, '17:00');
  assert.equal(despues.masTarde.length, 0);
  assert.deepEqual(ids(despues.hoy), [c.id, importante.id]);
  assert.ok(textos(despues.hoy[0]).includes('Te dijo que llamaras a las 17:00'));
});

test('un cliente que todavía no ha abierto sube cuando llega su hora', () => {
  const tarde = cliente({ diasLlamada: [3], nombreComercial: 'AAA BAR', horaApertura: '11:00' });
  const b = cliente({ diasLlamada: [3], nombreComercial: 'BBB BAR' });
  const nc = cliente({ diasLlamada: [3], nombreComercial: 'CCC BAR' });
  const r = registro(nc.id, X, [['no_contesta', '09:30']]);
  const a10 = lista([tarde, b, nc], [r], X, '10:00');
  assert.deepEqual(ids(a10.hoy), [b.id, tarde.id, nc.id]);
  assert.ok(textos(a10.hoy[1]).includes('Abre a las 11:00'));
  const a11 = lista([tarde, b, nc], [r], X, '11:00');
  assert.deepEqual(ids(a11.hoy), [tarde.id, b.id, nc.id]);
  assert.ok(!textos(a11.hoy[0]).includes('Abre a las 11:00'));
});

test('los importantes van primero', () => {
  const a = cliente({ diasLlamada: [3], nombreComercial: 'AAA' });
  const z = cliente({ diasLlamada: [3], nombreComercial: 'ZZZ', importante: true });
  assert.deepEqual(ids(lista([a, z], [], X).hoy), [z.id, a.id]);
});

test('«Hoy cierra» sale en la tarjeta', () => {
  const c = cliente({ diasLlamada: [3], diaCierre: 'MARTES-MIERCOLES' });
  assert.ok(textos(lista([c], [], X).hoy[0]).includes('Hoy cierra'));
  const d = cliente({ diasLlamada: [3], diaCierre: 'DESCARGAR LOS MIERCOLES' });
  assert.ok(!textos(lista([d], [], X).hoy[0]).includes('Hoy cierra'));
});
