import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filasAClientes, planificarImportacion } from '../js/importar.js';
import { clienteVacio } from '../js/logica.js';

const CAB = ['ID', 'Nombre comercial', 'Nombre fiscal', 'Población', 'Zona / ruta', 'Contacto', 'Teléfono', 'Teléfono 2',
  'Días de llamada', 'Día que cierra', 'Forma de pago', 'Hora de apertura', 'Notas', 'Hojas de origen', 'Columna rara'];

const filas = [
  CAB,
  ['C001', 'BAR TORRES', 'TORRES SL', 'BELLREGUARD', 'BELLREGUARD', 'FERNANDO', '679171125', '600111222, 600333444', 'LUNES, MIERCOLES', 'DOMINGO', 'TRANSFERENCIA', '08:00', 'XORINGER 10%', 'LUNES', 'x'],
  ['C002', 'RESTAURANTE NESFOR', '', 'JAVEA', 'JAVEA', '', '', '', '', 'CERRADO', 'CERRADO', '', 'Marcado CERRADO', 'JAVEA', ''],
  ['C003', 'BAR DOS', '', 'DENIA', 'DENIA', 'ANA', '611222333', '', 'x, mi', 'NO CIERRA', '', '9h', 'POSIBLE DUPLICADO: hay otro', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['C004', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
];

test('leer las filas del Excel', () => {
  const r = filasAClientes(filas);
  assert.equal(r.clientes.length, 3);
  assert.deepEqual(r.ignoradas, ['Columna rara']);
  const [a, b, c] = r.clientes;
  assert.equal(a.codigo, 'C001');
  assert.deepEqual(a.telefonos, ['679171125', '600111222', '600333444']);
  assert.deepEqual(a.diasLlamada, [1, 3]);
  assert.equal(a.horaApertura, '08:00');
  assert.equal(a.notas, 'XORINGER 10%');
  assert.equal(a.hojasOrigen, 'LUNES');
  assert.deepEqual(b.diasLlamada, []);
  assert.deepEqual(c.diasLlamada, [3]);
  assert.equal(c.horaApertura, '09:00');
  assert.ok(r.avisos.some((x) => x.includes('Fila 6') && x.includes('sin nombre')));
});

test('primera importación: resumen y bajas por CERRADO', () => {
  const r = filasAClientes(filas);
  const plan = planificarImportacion(r.clientes, [], { fecha: '2026-11-18', archivo: 'x.xlsx', columnas: r.columnas });
  assert.equal(plan.resumen.nuevos, 3);
  assert.equal(plan.resumen.sinTelefono, 1);
  assert.equal(plan.resumen.sinDia, 1);
  assert.equal(plan.resumen.posibleDuplicado, 1);
  assert.equal(plan.resumen.bajaCerrado, 1);
  const nesfor = plan.nuevos.find((c) => c.codigo === 'C002');
  assert.equal(nesfor.estado, 'baja');
  assert.equal(nesfor.motivoBaja, 'Cerrado (según Excel)');
  assert.equal(plan.nuevos.find((c) => c.codigo === 'C001').estado, 'activo');
  assert.equal(plan.nuevos[0].diasLlamadaDesde, '2026-11-18');
});

test('volver a importar: actualiza, conserva lo de la app y no borra', () => {
  const existentes = [
    { ...clienteVacio(), id: 'x1', codigo: 'C001', nombreComercial: 'BAR TORRES', poblacion: 'BELLREGUARD', contacto: 'PEPE',
      telefonos: ['679171125'], diasLlamada: [1, 3], estado: 'vacaciones', vacacionesDesde: '2026-11-10', importante: true, notas: 'XORINGER 10%' },
    { ...clienteVacio(), id: 'x3', codigo: 'C003', nombreComercial: 'BAR DOS', diasLlamada: [2], poblacion: 'DENIA' },
    { ...clienteVacio(), id: 'x9', codigo: 'C999', nombreComercial: 'NO VIENE EN EL EXCEL' },
  ];
  const sinDias = filas.map((f, i) => (i === 3 ? f.map((v, j) => (j === 8 ? '' : v)) : f));
  const r = filasAClientes(sinDias);
  const plan = planificarImportacion(r.clientes, existentes, { fecha: '2026-11-20', columnas: r.columnas });
  assert.equal(plan.resumen.nuevos, 1, 'C002 es nuevo');
  const upd = Object.fromEntries(plan.actualizaciones.map((a) => [a.id, a.cambios]));
  assert.equal(upd.x1.contacto, 'FERNANDO');
  assert.deepEqual(upd.x1.telefonos, ['679171125', '600111222', '600333444']);
  assert.equal(upd.x1.estado, undefined, 'el estado se conserva');
  assert.equal(upd.x1.importante, undefined);
  assert.equal(upd.x1.diasLlamada, undefined, 'mismos días: no cambia');
  assert.equal(upd.x3?.diasLlamada, undefined, 'una celda vacía no borra los días asignados en la app');
  assert.ok(!plan.actualizaciones.some((a) => a.id === 'x9'), 'los que no vienen no se tocan');
});
