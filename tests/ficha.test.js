// Fase 4 · Ficha completa: teléfonos con nombre, datos por completar,
// condiciones especiales, «llamar a partir de», repetir último pedido,
// Excel (exportar → importar) y migración a la versión 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  telefonosDe, telefonosPara, textoTelefono, telefonosConNombre, leerTelefonosConNombre,
  faltaPorConfigurar, textoFalta, condicionesVigentes, textoCondicion, ultimoPedidoConTexto,
  horaParaLlamar, mensajePedido, coincideBusqueda, clienteVacio,
} from '../js/logica.js';
import { filasAClientes, planificarImportacion } from '../js/importar.js';
import { filasExportacionClientes } from '../js/exportar.js';
import { datosSemana, textoResumenSemanal, hojasExcelSemanal } from '../js/informes.js';
import { migrar, ESQUEMA_ACTUAL } from '../js/migraciones.js';
import { cliente, registro, lista, textos, L, M, X, V } from './ayuda.js';

const conTelefonos = (extra = {}) => cliente({
  nombreComercial: 'BAR TORRES',
  telefonos: ['600111222', '965000000', '611222333'],
  telefonosInfo: {
    '600111222': { nombre: 'Jefe', uso: 'llamar' },
    '611222333': { nombre: 'Pedidos', uso: 'whatsapp' },
  },
  ...extra,
});

// ---------------------------------------------------------------------
//  Teléfonos con nombre
// ---------------------------------------------------------------------

test('teléfonos: nombre y uso; para llamar y para WhatsApp', () => {
  const c = conTelefonos();
  assert.deepEqual(telefonosDe(c).map((t) => [t.numero, t.nombre, t.uso]),
    [['600111222', 'Jefe', 'llamar'], ['965000000', '', 'todo'], ['611222333', 'Pedidos', 'whatsapp']]);
  assert.deepEqual(telefonosPara(c, 'llamar').map((t) => t.numero), ['600111222', '965000000']);
  assert.deepEqual(telefonosPara(c, 'whatsapp').map((t) => t.numero), ['611222333', '965000000'], 'primero el de «Solo WhatsApp»');
  assert.equal(textoTelefono(telefonosDe(c)[0]), 'Jefe · 600 111 222');
  assert.equal(textoTelefono(telefonosDe(c)[1]), '965 000 000');
});

test('teléfonos: un solo número sirve para todo; si ninguno vale para algo, se usan todos', () => {
  const uno = cliente({ telefonos: ['600111222'] });
  assert.deepEqual(telefonosPara(uno, 'whatsapp').map((t) => t.numero), ['600111222']);
  const soloLlamar = cliente({ telefonos: ['965000000'], telefonosInfo: { '965000000': { nombre: 'Fijo', uso: 'llamar' } } });
  assert.deepEqual(telefonosPara(soloLlamar, 'whatsapp').map((t) => t.numero), ['965000000'], 'no deja sin WhatsApp');
  // Clientes antiguos sin telefonosInfo
  const viejo = { ...cliente(), telefonosInfo: undefined };
  assert.equal(telefonosDe(viejo)[0].uso, 'todo');
});

test('teléfonos con nombre: texto para el Excel y lectura de vuelta', () => {
  const c = conTelefonos();
  const txt = telefonosConNombre(c);
  assert.equal(txt, 'Jefe: 600 111 222 (solo llamar); 965 000 000; Pedidos: 611 222 333 (solo whatsapp)');
  const leido = leerTelefonosConNombre(txt);
  assert.deepEqual(leido.telefonos, c.telefonos);
  assert.deepEqual(leido.info, c.telefonosInfo);
  assert.deepEqual(leerTelefonosConNombre('').telefonos, []);
  assert.deepEqual(leerTelefonosConNombre('Bar: +44 7700 900123').telefonos, ['+447700900123']);
});

test('el pedido a la oficina lleva el teléfono para llamar con su nombre; se busca por nombre de teléfono', () => {
  const c = conTelefonos({ contacto: 'FERNANDO', poblacion: 'OLIVA' });
  const m = mensajePedido({ cliente: c, pedido: '2 cajas', comercial: 'Juan', fecha: X, hora: '10:00' });
  assert.match(m, /Contacto: Fernando · Jefe · 600 111 222/);
  assert.ok(coincideBusqueda(c, 'pedidos'));
  assert.ok(coincideBusqueda(c, '611222'));
});

// ---------------------------------------------------------------------
//  Falta por configurar
// ---------------------------------------------------------------------

test('falta por configurar: teléfono y día son lo importante', () => {
  const completo = cliente({ contacto: 'ANA', poblacion: 'OLIVA', nombreFiscal: 'X SL', formaPago: 'CONTADO', diasLlamada: [1] });
  assert.deepEqual(faltaPorConfigurar(completo).todo, []);
  const vacio = cliente({ telefonos: [], poblacion: '' });
  const f = faltaPorConfigurar(vacio);
  assert.deepEqual(f.importante, ['telefonos', 'diasLlamada']);
  assert.deepEqual(f.resto, ['contacto', 'poblacion', 'nombreFiscal', 'formaPago']);
  assert.equal(textoFalta(f.importante), 'Falta: teléfono, día de llamada');
  // A un potencial no se le pide nombre fiscal ni forma de pago; a una baja, nada
  assert.deepEqual(faltaPorConfigurar({ ...vacio, estado: 'potencial' }).resto, ['contacto', 'poblacion']);
  assert.deepEqual(faltaPorConfigurar({ ...vacio, estado: 'baja' }).todo, []);
});

// ---------------------------------------------------------------------
//  Condiciones especiales y «llamar a partir de»
// ---------------------------------------------------------------------

const cond = (producto, condicion, hasta = null, extra = {}) => ({ id: producto, producto, condicion, hasta, nota: '', creada: L, ...extra });

test('condiciones: vigentes, caducadas y texto', () => {
  const c = cliente({ condicionesEspeciales: [cond('Xoringer', '−10 %', '2026-12-31'), cond('Muga Rosado', '6+1', '2026-11-17'), cond('Portes', 'gratis')] });
  assert.deepEqual(condicionesVigentes(c, X).map((x) => x.producto), ['Xoringer', 'Portes']);
  assert.equal(condicionesVigentes(c, M).length, 3, 'el último día todavía vale');
  assert.equal(textoCondicion(c.condicionesEspeciales[0]), 'Xoringer: −10 % (hasta el 31/12)');
  assert.equal(textoCondicion(c.condicionesEspeciales[0], { conHasta: false }), 'Xoringer: −10 %');
});

test('lista del día: etiqueta de condiciones y «llamar a partir de»', () => {
  const a = cliente({ diasLlamada: [3], llamarDesde: '11:00', condicionesEspeciales: [cond('Xoringer', '−10 %'), cond('Portes', 'gratis')] });
  const b = cliente({ diasLlamada: [3], horaApertura: '12:00', llamarDesde: '11:00' });
  const r = lista([a, b], [], X, '10:00');
  const ia = r.hoy.find((it) => it.cliente.id === a.id);
  assert.equal(ia.abierto, false);
  assert.ok(textos(ia).includes('Llamar a partir de las 11:00'));
  assert.ok(textos(ia).includes('Condiciones: Xoringer −10 % (+1)'));
  const ib = r.hoy.find((it) => it.cliente.id === b.id);
  assert.ok(textos(ib).includes('Abre a las 12:00'), 'manda la hora más tardía');
  assert.equal(horaParaLlamar(b), '12:00');
  const tarde = lista([a], [], X, '11:30').hoy[0];
  assert.equal(tarde.abierto, true);
});

test('repetir último pedido: el más reciente con texto, sin contar el de hoy', () => {
  const c = cliente();
  const r1 = registro(c.id, L, [['pide', '10:00', { pedido: '2 cajas Muga' }]]);
  const r2 = registro(c.id, M, [['pide', '10:00', { pedido: '' }]]);
  const r3 = registro(c.id, X, [['pide', '10:00', { pedido: '3 cajas Xoringer' }]]);
  assert.equal(ultimoPedidoConTexto([r1, r2, r3]).pedido, '3 cajas Xoringer');
  assert.equal(ultimoPedidoConTexto([r1, r2, r3].filter((r) => r.id !== r3.id)).pedido, '2 cajas Muga');
  assert.equal(ultimoPedidoConTexto([r2]), null);
});

// ---------------------------------------------------------------------
//  Excel de clientes: exportar y volver a importar
// ---------------------------------------------------------------------

test('Excel de clientes: los teléfonos con nombre y «llamar a partir de» van y vuelven', () => {
  const c = conTelefonos({ codigo: 'C001', llamarDesde: '11:00', condicionesEspeciales: [cond('Xoringer', '−10 %', '2026-12-31')] });
  const filas = filasExportacionClientes([c]);
  const cab = filas[0];
  assert.ok(cab.includes('Teléfonos con nombre'));
  assert.equal(filas[1][cab.indexOf('Condiciones especiales')], 'Xoringer: −10 % (hasta el 31/12)');
  assert.equal(filas[1][cab.indexOf('Falta por configurar')], 'día de llamada, contacto, nombre fiscal, forma de pago');
  const { clientes: [d], avisos } = filasAClientes(filas);
  assert.deepEqual(avisos, []);
  assert.deepEqual(d.telefonos, c.telefonos);
  assert.deepEqual(d.telefonosInfo, c.telefonosInfo);
  assert.equal(d.llamarDesde, '11:00');
  // Reimportar sobre el mismo cliente no cambia nada
  const plan = planificarImportacion([d], [c], { fecha: X });
  assert.equal(plan.resumen.sinCambios, 1);
});

test('importar el Excel de la oficina no borra los teléfonos ni los nombres apuntados en el móvil', () => {
  const c = conTelefonos({ codigo: 'C001' });
  // El Excel solo trae uno de los tres teléfonos: no cambia nada
  const filas = [['ID', 'Nombre comercial', 'Teléfono'], ['C001', 'BAR TORRES', '600111222']];
  const r1 = filasAClientes(filas);
  assert.equal(planificarImportacion(r1.clientes, [c], { fecha: X, columnas: r1.columnas }).resumen.sinCambios, 1);
  // El Excel trae un número nuevo: se añade al final
  const r2 = filasAClientes([filas[0], ['C001', 'BAR TORRES', '699000000']]);
  const cambios = planificarImportacion(r2.clientes, [c], { fecha: X, columnas: r2.columnas }).actualizaciones[0].cambios;
  assert.deepEqual(cambios.telefonos, ['600111222', '965000000', '611222333', '699000000']);
  assert.equal(cambios.telefonosInfo, undefined, 'los nombres se conservan');
});

test('importar un Excel con «Teléfonos con nombre» suma los nombres nuevos', () => {
  const c = conTelefonos({ codigo: 'C001' });
  const filas = [['ID', 'Nombre comercial', 'Teléfonos con nombre'], ['C001', 'BAR TORRES', 'Bar: 965 000 000']];
  const { clientes: [d], columnas } = filasAClientes(filas);
  const plan = planificarImportacion([d], [c], { fecha: X, columnas });
  const info = plan.actualizaciones[0].cambios.telefonosInfo;
  assert.equal(info['965000000'].nombre, 'Bar');
  assert.equal(info['600111222'].nombre, 'Jefe', 'conserva los que ya tenía');
});

// ---------------------------------------------------------------------
//  Resumen semanal y Excel de la semana
// ---------------------------------------------------------------------

test('resumen semanal: condiciones nuevas de la semana y hoja «Condiciones»', () => {
  const a = cliente({ codigo: 'C001', nombreComercial: 'BAR TORRES', diasLlamada: [1],
    condicionesEspeciales: [cond('Xoringer', '−10 %', '2026-12-31', { creada: M, nota: 'solo cajas' }), cond('Portes', 'gratis', null, { creada: '2026-10-01' })] });
  const d = datosSemana({ clientes: [a], llamadas: [], lunes: L, fecha: V, primerUso: '2026-01-01' });
  assert.equal(d.condicionesNuevas.length, 1);
  const t = textoResumenSemanal(d, 'Juan');
  assert.match(t, /\*CONDICIONES NUEVAS \(1\)\*\n• Bar Torres \(Oliva\) · Xoringer: −10 % \(hasta el 31\/12\) · solo cajas/);
  const hojas = hojasExcelSemanal(d, 'Juan');
  const cond2 = hojas.Condiciones;
  assert.equal(cond2.length, 3);
  assert.deepEqual(cond2.find((f) => f[4] === 'Xoringer').slice(4), ['Xoringer', '−10 %', '2026-12-31', 'solo cajas', M, 'Vigente', 'Sí']);
  assert.ok(!hojas.Clientes[0].some((x) => /Teléfono/.test(x)), 'la hoja Clientes sigue sin teléfonos');
});

// ---------------------------------------------------------------------
//  Migración a la versión 2
// ---------------------------------------------------------------------

test('migración 1 → 2: los clientes reciben los campos nuevos y no pierden nada', () => {
  assert.ok(ESQUEMA_ACTUAL >= 2);
  const v1 = { ...clienteVacio(), id: 'a1', nombreComercial: 'BAR', telefonos: ['600111222'], diasLlamada: [1], condiciones: '10% Xoringer' };
  delete v1.telefonosInfo; delete v1.llamarDesde; delete v1.condicionesEspeciales;
  const d = migrar({ clientes: [v1], llamadas: [{ id: 'r1', pedido: 'x' }] }, 1, 2);
  const c = d.clientes[0];
  assert.deepEqual(c.telefonosInfo, {});
  assert.equal(c.llamarDesde, null);
  assert.deepEqual(c.condicionesEspeciales, []);
  assert.equal(c.condiciones, '10% Xoringer');
  assert.deepEqual(c.telefonos, ['600111222']);
  assert.equal(d.llamadas.length, 1);
});
