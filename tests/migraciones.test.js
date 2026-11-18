import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrar, crearCopia, leerCopia, ESQUEMA_ACTUAL, FORMATO_COPIA } from '../js/migraciones.js';
import { clienteVacio } from '../js/logica.js';

const antiguo = {
  clientes: [{ id: 'a1', creado: '2026-01-01T09:00:00.000+01:00', modificado: '2026-01-01T09:00:00.000+01:00', dispositivoId: 'd1', nombreComercial: 'BAR TORRES', telefonos: ['679171125'], diasLlamada: [1] }],
  llamadas: [{ id: 'r1', clienteId: 'a1', fechaPrevista: '2026-11-16', fecha: '2026-11-16', resultado: 'pide', pedido: '2 cajas', intentos: [] }],
  ajustes: [{ id: 'ajustes', nombreComercial: 'Juan' }],
};

test('la migración a la versión 1 completa campos y conserva los datos', () => {
  const d = migrar(antiguo, 0, 1);
  assert.equal(d.clientes.length, 1);
  const c = d.clientes[0];
  assert.equal(c.nombreComercial, 'BAR TORRES');
  assert.deepEqual(c.telefonos, ['679171125']);
  assert.equal(c.creado, antiguo.clientes[0].creado);
  assert.equal(c.estado, 'activo');
  assert.equal(c.importante, false);
  assert.deepEqual(Object.keys(clienteVacio()).filter((k) => !(k in c)), []);
  assert.equal(d.llamadas[0].pedido, '2 cajas');
  assert.equal(d.llamadas[0].origen, 'llamada');
  assert.equal(d.ajustes[0].nombreComercial, 'Juan');
  assert.equal(d.ajustes[0].semanasRiesgo, 3);
  assert.ok(d.ajustes[0].plantillas.noContesta.includes('{contacto}'));
  assert.deepEqual(d.recordatorios, []);
});

test('una migración futura conserva todos los registros', () => {
  const v2 = { ...{ 1: (d) => d }, 2: (d) => ({ ...d, clientes: d.clientes.map((c) => ({ ...c, nuevoCampo: 'x' })) }) };
  const d1 = migrar(antiguo, 0, 1);
  const d2 = migrar(d1, 1, 2, v2);
  assert.equal(d2.clientes.length, d1.clientes.length);
  assert.equal(d2.llamadas.length, d1.llamadas.length);
  assert.equal(d2.clientes[0].nuevoCampo, 'x');
  assert.deepEqual({ ...d2.clientes[0], nuevoCampo: undefined }, { ...d1.clientes[0], nuevoCampo: undefined });
  assert.throws(() => migrar(d1, 1, 3, v2), /Falta la migración/);
  assert.throws(() => migrar(d1, 5, 1), /más nueva/);
});

test('copia de seguridad: exportar y restaurar devuelve exactamente los mismos datos', () => {
  const datos = migrar(antiguo, 0, ESQUEMA_ACTUAL);
  datos.cambios = [{ id: 'k1', entidad: 'clientes', entidadId: 'a1', accion: 'modificar', campo: 'contacto', antes: null, despues: 'FERNANDO', fecha: '2026-11-18T10:00:00.000+01:00', dispositivoId: 'd1', origen: 'app', enviado: false }];
  datos.promociones = [{ id: 'p1', producto: 'Muga Rosado', precio: 6.95 }];
  const copia = crearCopia(datos, { dispositivoId: 'd1', exportado: '2026-11-18T10:00:00.000+01:00', versionApp: '1.0.0' });
  assert.equal(copia.formato, FORMATO_COPIA);
  assert.equal(copia.esquema, ESQUEMA_ACTUAL);
  const texto = JSON.stringify(copia);
  const leida = leerCopia(texto);
  assert.deepEqual(leida.datos, datos);
  assert.equal(leida.dispositivoId, 'd1');
  // Una copia de una versión antigua se migra al restaurarla
  const vieja = leerCopia({ ...copia, esquema: 0, datos: antiguo });
  assert.equal(vieja.datos.clientes[0].estado, 'activo');
});

test('una copia no válida se rechaza', () => {
  assert.throws(() => leerCopia('no es json'), /no es JSON/);
  assert.throws(() => leerCopia({ hola: 1 }), /no es una copia/);
  assert.throws(() => leerCopia({ formato: FORMATO_COPIA, esquema: 99, datos: {} }), /más nueva/);
});
