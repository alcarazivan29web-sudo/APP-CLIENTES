// Fase 3 · Oficina: resumen semanal, cambios para ICG, Excel semanal,
// historial y promociones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cambiosParaICG, datosSemana, textoResumenSemanal, hojasExcelSemanal, filasHistorial,
  nombreExcelSemanal, nombreArchivoComercial, COLUMNAS_COMUNES, COLUMNAS_EXCEL_SEMANAL,
} from '../js/informes.js';
import { analizarFecha, promocionesVigentes, promocionVacia, recordatorioVacio } from '../js/logica.js';
import { filasAPromociones, analizarPrecio } from '../js/importar.js';
import { resumenPorEnviar } from '../js/pantallas/oficina.js';
import { cliente, registro, L, M, X, J, V, S, L2 } from './ayuda.js';

let nCambio = 0;
const cambio = (entidadId, campo, antes, despues, { fecha = `${M}T10:00:00.000+01:00`, origen = 'app', accion = 'modificar', enviado = false } = {}) =>
  ({ id: 'cb' + (++nCambio), entidad: 'clientes', entidadId, accion, campo, antes, despues, fecha, origen, enviado, dispositivoId: 'd1' });

// ---------------------------------------------------------------------
//  Cambios para ICG
// ---------------------------------------------------------------------

test('cambios para ICG: neto por campo, sin los de importar ni los deshechos', () => {
  const a = cliente({ codigo: 'C010', nombreComercial: 'BAR TORRES', telefonos: ['611222333'] });
  const b = cliente({ codigo: 'C011', nombreComercial: 'BAR PEPE' });
  const cambios = [
    cambio(a.id, 'telefonos', ['679171125'], ['611000000'], { fecha: `${L}T10:00:00.000+01:00` }),
    cambio(a.id, 'telefonos', ['611000000'], ['611222333'], { fecha: `${M}T10:00:00.000+01:00` }),
    cambio(a.id, 'notas', '', 'x'), // no interesa a ICG
    cambio(a.id, 'poblacion', 'OLIVA', 'GANDIA', { origen: 'importacion' }), // viene del Excel
    cambio(b.id, 'contacto', 'ANA', 'LUIS', { fecha: `${L}T10:00:00.000+01:00` }),
    cambio(b.id, 'contacto', 'LUIS', 'ANA', { fecha: `${M}T10:00:00.000+01:00`, origen: 'deshacer' }), // vuelve a ser igual
    cambio(b.id, 'diasLlamada', [1], [1, 3]),
  ];
  const { filas, ids } = cambiosParaICG({ cambios, clientes: [a, b] });
  assert.equal(filas.length, 2);
  const tel = filas.find((f) => f.campo === 'Teléfonos');
  assert.equal(tel.antes, '679 171 125');
  assert.equal(tel.despues, '611 222 333');
  assert.equal(tel.codigo, 'C010');
  const dias = filas.find((f) => f.campo === 'Días de llamada');
  assert.equal(dias.antes, 'LUNES');
  assert.equal(dias.despues, 'LUNES, MIERCOLES');
  assert.ok(!filas.some((f) => f.campo === 'Contacto'), 'el cambio deshecho no sale');
  assert.ok(!ids.includes(cambios[3].id), 'lo importado no se marca');
  // Los enviados no vuelven a salir
  const enviados = cambios.map((c) => ({ ...c, enviado: true }));
  assert.equal(cambiosParaICG({ cambios: enviados, clientes: [a, b] }).filas.length, 0);
});

test('cambios para ICG: cliente nuevo creado en la app (una sola fila con sus datos)', () => {
  const n = cliente({ nombreComercial: 'BAR NUEVO', poblacion: 'DENIA', contacto: 'MARTA', telefonos: ['600111222'], diasLlamada: [2] });
  const borrado = cliente({ nombreComercial: 'CREADO POR ERROR', borrado: true });
  const cambios = [
    cambio(n.id, '*', null, {}, { accion: 'crear' }),
    cambio(n.id, 'contacto', '', 'MARTA'),
    cambio(borrado.id, '*', null, {}, { accion: 'crear' }),
  ];
  const { filas, ids } = cambiosParaICG({ cambios, clientes: [n, borrado] });
  assert.equal(filas.length, 1);
  assert.equal(filas[0].tipo, 'nuevo');
  assert.match(filas[0].despues, /DENIA · contacto Marta · 600 111 222 · llamar MARTES/);
  assert.equal(ids.length, 3, 'al enviar se marcan también los cambios del cliente nuevo');
});

// ---------------------------------------------------------------------
//  Resumen semanal
// ---------------------------------------------------------------------

function semanaEjemplo() {
  const a = cliente({ codigo: 'C001', nombreComercial: 'BAR TORRES', poblacion: 'BELLREGUARD', diasLlamada: [1, 3] });
  const b = cliente({ codigo: 'C002', nombreComercial: 'LA MOLETA', poblacion: 'ADSUBIA', diasLlamada: [1] });
  const c = cliente({ codigo: 'C003', nombreComercial: 'CASA PACO', poblacion: 'PEGO', diasLlamada: [2] });
  const baja = cliente({ codigo: 'C004', nombreComercial: 'BAR CERRADO', diasLlamada: [3], estado: 'baja', fechaBaja: M, motivoBaja: 'Ha cerrado' });
  const nuevo = cliente({ nombreComercial: 'BODEGA NUEVA', estado: 'potencial', creado: `${M}T09:00:00.000+01:00`, diasLlamada: [4] });
  const llamadas = [
    registro(a.id, L, [['pide', '10:15', { pedido: '2 cajas Ramón Bilbao\n1 caja Muga' }]]),
    registro(b.id, L, [['no_contesta', '10:00'], ['no_pide', '12:00']]),
    registro(c.id, M, [['pide', '12:30', { pedido: '6 botellas' }]], { origen: 'visita' }),
  ];
  const rec = { ...recordatorioVacio(), id: 'rec1', fecha: M, texto: 'Llevar muestras', clienteId: c.id, creado: `${L}T09:00:00.000+01:00` };
  const cambios = [cambio(a.id, 'telefonos', ['679171125'], ['611222333'])];
  return { a, b, c, baja, nuevo, clientes: [a, b, c, baja, nuevo], llamadas, recordatorios: [rec], cambios };
}

test('texto del resumen semanal: llamadas por día, pedidos, sin llamar, bajas, nuevos, recordatorios y cambios ICG', () => {
  const e = semanaEjemplo();
  const d = datosSemana({ ...e, lunes: L, fecha: V, primerUso: '2026-01-01' });
  const t = textoResumenSemanal(d, 'Juan Bonilla');
  assert.match(t, /^\*RESUMEN SEMANA 16\/11 – 20\/11\*\nJuan Bonilla · VinOliva/);
  assert.match(t, /Lun: 2 llamados · 1 pide · 1 no pide · 0 no contesta · 0 sin llamar/);
  assert.match(t, /\*PEDIDOS \(2\)\*/);
  assert.match(t, /• Bar Torres \(Bellreguard\) · Lun 16\/11: 2 cajas Ramón Bilbao · 1 caja Muga _\(no enviado a oficina\)_/);
  assert.match(t, /• Casa Paco \(Pego\) · Mar 17\/11 · en visita: 6 botellas/);
  assert.match(t, /\*SIN LLAMAR O SIN LOCALIZAR \(2\)\*\n• Bar Torres \(Bellreguard\) · Mié · sin llamar\n• Bodega Nueva \(Oliva\) · Jue · sin llamar/);
  assert.match(t, /\*EN RIESGO \(1\)\*\n• La Moleta \(Adsubia\) · 46 semanas sin pedir/);
  assert.match(t, /\*BAJAS NUEVAS \(1\)\*\n• Bar Cerrado \(Oliva\) · Ha cerrado/);
  assert.match(t, /\*POTENCIALES NUEVOS \(1\)\*\n• Bodega Nueva \(Oliva\)/);
  assert.match(t, /\*RECORDATORIOS SIN HACER \(1\)\*\n• 17\/11 · Llevar muestras · Casa Paco/);
  assert.match(t, /\*CAMBIOS PARA ACTUALIZAR EN ICG \(1\)\*\n• Bar Torres \(C001\) · Teléfonos: 679 171 125 → 611 222 333/);
  assert.ok(!t.includes('aún no ha terminado'));
  // A mitad de semana lo dice
  const mitad = textoResumenSemanal(datosSemana({ ...e, lunes: L, fecha: X, primerUso: '2026-01-01' }), 'Juan');
  assert.match(mitad, /Hasta el miércoles 18\/11: la semana aún no ha terminado/);
  assert.ok(!mitad.includes('Jue:'), 'no salen los días que aún no han llegado');
});

test('resumen: aviso desde el viernes a mediodía y el lunes si no se mandó', () => {
  const aj = { primerUso: '2026-11-01', ultimoResumen: null, resumenesEnviados: [] };
  assert.equal(resumenPorEnviar(aj, V, '11:59', 5), null);
  assert.equal(resumenPorEnviar(aj, V, '12:00', 5), L);
  assert.equal(resumenPorEnviar(aj, S, '10:00', 6), L);
  assert.equal(resumenPorEnviar({ ...aj, resumenesEnviados: [L] }, V, '13:00', 5), null);
  assert.equal(resumenPorEnviar(aj, L2, '09:00', 1), L, 'el lunes avisa del de la semana pasada');
  assert.equal(resumenPorEnviar({ ...aj, resumenesEnviados: [L] }, L2, '09:00', 1), null);
  assert.equal(resumenPorEnviar({ ...aj, primerUso: L2 }, L2, '09:00', 1), null, 'el primer lunes no hay semana pasada');
  assert.equal(resumenPorEnviar(aj, M, '10:00', 2), null);
});

// ---------------------------------------------------------------------
//  Excel semanal
// ---------------------------------------------------------------------

test('Excel semanal: hojas fijas, cada fila con comercial, semana, código y cliente', () => {
  const e = semanaEjemplo();
  const d = datosSemana({ ...e, lunes: L, fecha: V, primerUso: '2026-01-01' });
  const hojas = hojasExcelSemanal(d, 'Juan Bonilla');
  assert.deepEqual(Object.keys(hojas), ['Resumen', 'Llamadas', 'Pedidos', 'Clientes', 'Cambios ICG', 'Recordatorios']);
  for (const [nombre, filas] of Object.entries(hojas)) {
    assert.deepEqual(filas[0], [...COLUMNAS_COMUNES, ...COLUMNAS_EXCEL_SEMANAL[nombre]], `cabecera de ${nombre}`);
    for (const f of filas.slice(1)) {
      assert.equal(f.length, filas[0].length, `columnas de ${nombre}`);
      assert.equal(f[0], 'Juan Bonilla');
      assert.equal(f[1], L);
    }
  }
  const pedidos = hojas.Pedidos.slice(1);
  assert.equal(pedidos.length, 2);
  assert.deepEqual(pedidos[1].slice(2, 9), ['C003', 'CASA PACO', M, '12:30', 'PEGO', 'En visita', '6 botellas']);
  const ll = hojas.Llamadas.slice(1);
  assert.ok(ll.some((f) => f[2] === 'C001' && f[4] === L && f[7] === 'Pide'));
  assert.ok(ll.some((f) => f[2] === 'C001' && f[4] === X && f[7] === 'Sin llamar'));
  assert.ok(ll.some((f) => f[2] === 'C003' && f[8] === 'En visita'), 'el pedido fuera de día sale en Llamadas');
  const cli = hojas.Clientes.slice(1);
  assert.equal(cli.length, 5);
  assert.ok(!hojas.Clientes[0].includes('Teléfono'), 'la hoja Clientes no lleva teléfonos');
  assert.equal(hojas['Cambios ICG'].length, 2);
  assert.deepEqual(hojas.Recordatorios[1].slice(2), ['C003', 'CASA PACO', M, 'Llevar muestras', 'Vencido', '']);
  assert.equal(nombreExcelSemanal(L, 'Juan Bonilla'), 'semana_2026-11-16_Juan_Bonilla.xlsx');
  assert.equal(nombreArchivoComercial('josé  Muñoz'), 'Jose_Munoz');
});

test('historial: una fila por llamada con resultado, intentos y pedido', () => {
  const e = semanaEjemplo();
  const filas = filasHistorial({ llamadas: e.llamadas, clientes: e.clientes, comercial: 'Juan' });
  assert.equal(filas.length, 4);
  const b = filas.find((f) => f[4] === 'LA MOLETA');
  assert.equal(b[6], 'No pide');
  assert.equal(b[10], '10:00 No contesta · 12:00 No pide');
});

// ---------------------------------------------------------------------
//  Promociones
// ---------------------------------------------------------------------

test('promociones: se ignoran los EJEMPLO, fechas y precios en varios formatos', () => {
  const filas = [
    ['Producto', 'Detalle', 'Precio (€)', 'Promoción', 'Desde', 'Hasta', 'Tipo'],
    ['EJEMPLO — Muga Rosado', 'x', 6.95, '5+1', new Date(2026, 10, 16), new Date(2026, 10, 30), 'Promoción'],
    ['Muga Rosado', 'D.O.Ca. Rioja', 6.95, '5+1', new Date(2026, 10, 16), new Date(2026, 10, 30), 'Promoción'],
    ['Xoringer', 'Vermut', '8,50 €', '-10 %', '16/11/2026', '', 'Novedad'],
    ['', '', '', '', '', '', ''],
    ['Cava Brut', '', '', '', 'mañana', '', ''],
  ];
  const r = filasAPromociones(filas, { fecha: X });
  assert.equal(r.ejemplos, 1);
  assert.equal(r.promociones.length, 3);
  assert.deepEqual([r.promociones[0].desde, r.promociones[0].hasta, r.promociones[0].precio], ['2026-11-16', '2026-11-30', 6.95]);
  assert.deepEqual([r.promociones[1].desde, r.promociones[1].hasta, r.promociones[1].precio], ['2026-11-16', null, 8.5]);
  assert.equal(r.avisos.length, 1, 'avisa de la fecha que no entiende');
  assert.equal(analizarPrecio('1.200,50 €'), 1200.5);
  assert.equal(analizarFecha('2026-11-05'), '2026-11-05');
  assert.equal(analizarFecha('5/11/26'), '2026-11-05');
  assert.equal(analizarFecha('31/02/2026'), null);
});

test('promociones vigentes: las caducadas se ocultan solas; las futuras van al final', () => {
  const p = (extra) => ({ ...promocionVacia(), id: Math.random(), ...extra });
  const promos = [
    p({ producto: 'Caducada', hasta: M }),
    p({ producto: 'Hoy acaba', hasta: X }),
    p({ producto: 'Futura', desde: L2 }),
    p({ producto: 'Sin fechas' }),
    p({ producto: 'Borrada', borrado: true }),
  ];
  const v = promocionesVigentes(promos, X).map((x) => x.producto);
  assert.deepEqual(v, ['Hoy acaba', 'Sin fechas', 'Futura']);
  assert.deepEqual(promocionesVigentes(promos, J).map((x) => x.producto), ['Sin fechas', 'Futura']);
});
