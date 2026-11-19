// Fase 6 · La oficina manda: Excel único de la oficina, lista de encargos,
// mensaje de la semana, números y versión de cierre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TIPOS_ENCARGO, listaEncargos, idTipoEncargo, datosTipoEncargo, encargoVacio, tituloEncargo, iconoEncargo,
  mensajesVigentes, mensajesPorLeer, idMensajeOficina, ajustesVacios,
} from '../js/logica.js';
import { filasAEncargos, filasAMensajes, filasANumeros, analizarExcelOficina, planExcelOficina } from '../js/importar.js';
import { CIERRE } from '../js/cierre.js';
import { L, M, J, V, L2 } from './ayuda.js';

const PROMOS = [
  ['Producto', 'Detalle', 'Precio (€)', 'Promoción', 'Desde', 'Hasta'],
  ['EJEMPLO Vino', '', 5, '', '', ''],
  ['Xoringer', 'Tinto', '6,95', '3+1', L, V],
];
const ENCARGOS = [
  ['Encargo', 'Hay que escribir', 'Icono'],
  ['EJEMPLO: Enviar muestras', '', ''],
  ['Enviar catálogo de Navidad', '', ''],
  ['Enviar ficha de un producto', 'Producto', ''],
  ['Mandar muestras de aceite', '', '🫒'],
  ['Visita del comercial de la bodega', 'Texto', ''],
  ['Mandar muestras de aceite', '', ''],
];
const MENSAJE = [
  ['Mensaje', 'Desde', 'Hasta'],
  ['EJEMPLO: esto no sale', '', ''],
  ['Esta semana: Xoringer 3+1.\r\nLlamad a los de Pego.', L, V],
];
const NUMEROS = [
  ['Dato', 'Valor'],
  ['WhatsApp de la oficina (pedidos y encargos)', '600 111 222'],
  ['WhatsApp o correo de Iván (resumen semanal)', 'ivan@vinoliva.test'],
];

test('lista de encargos: la de la oficina o, si no hay, la de serie; siempre con «Otro»', () => {
  assert.deepEqual(listaEncargos(ajustesVacios()), TIPOS_ENCARGO);
  const { tipos, avisos, ejemplos } = filasAEncargos(ENCARGOS);
  assert.equal(ejemplos, 1);
  assert.equal(avisos.length, 1, 'el repetido se avisa');
  assert.deepEqual(tipos.map((t) => [t.id, t.icono, t.pide]), [
    ['catalogo_navidad', '📕', ''], // coincide con uno de serie: mismo id e icono
    ['ficha_producto', '🍷', 'producto'],
    ['of_mandar_muestras_de_aceite', '🫒', ''],
    ['of_visita_del_comercial_de_la_bodega', '📌', 'texto'],
  ]);
  assert.equal(listaEncargos({ tiposEncargo: tipos }).length, 4, 'ya hay uno para escribir: no se añade «Otro»');
  const sinOtro = tipos.filter((t) => t.pide !== 'texto');
  assert.equal(listaEncargos({ tiposEncargo: sinOtro }).at(-1).id, 'otro');
  assert.equal(idTipoEncargo('  enviar CATALOGO de navidad '), 'catalogo_navidad');
});

test('un encargo guarda cómo se llamaba: el historial no cambia si la oficina cambia la lista', () => {
  const t = { id: 'of_mandar_muestras', texto: 'Mandar muestras', icono: '🫒', pide: '' };
  const e = { ...encargoVacio(), ...datosTipoEncargo(t), detalle: '' };
  assert.equal(tituloEncargo(e), 'Mandar muestras');
  assert.equal(iconoEncargo(e), '🫒');
  const libre = { ...encargoVacio(), ...datosTipoEncargo({ id: 'of_x', texto: 'Visita', pide: 'texto' }), detalle: 'el martes' };
  assert.equal(tituloEncargo(libre), 'el martes');
  // Los encargos de la 1.4.0 (sin textoTipo) siguen saliendo igual
  assert.equal(tituloEncargo({ tipo: 'ficha_producto', detalle: 'Xoringer' }), 'Enviar ficha de un producto: Xoringer');
  assert.equal(iconoEncargo({ tipo: 'tarifa' }), '💶');
  assert.equal(iconoEncargo({ tipo: 'desconocido' }), '📌');
});

test('mensaje de la oficina: fechas, varias líneas y «Entendido»', () => {
  const { mensajes, ejemplos } = filasAMensajes(MENSAJE);
  assert.equal(ejemplos, 1);
  assert.equal(mensajes.length, 1);
  const m = mensajes[0];
  assert.equal(m.texto, 'Esta semana: Xoringer 3+1.\nLlamad a los de Pego.');
  assert.equal(m.desde, L);
  assert.equal(m.hasta, V);
  assert.equal(m.id, idMensajeOficina(m));
  assert.notEqual(m.id, idMensajeOficina({ ...m, texto: m.texto + '!' }), 'si cambia el texto, vuelve a salir');
  const aj = { ...ajustesVacios(), mensajesOficina: mensajes };
  assert.equal(mensajesVigentes(aj.mensajesOficina, J).length, 1);
  assert.equal(mensajesVigentes(aj.mensajesOficina, L2).length, 0, 'caducado');
  assert.equal(mensajesPorLeer(aj, M).length, 1);
  assert.equal(mensajesPorLeer({ ...aj, mensajesVistos: [m.id] }, M).length, 0);
  // Sin fechas: siempre vigente
  assert.equal(mensajesVigentes([{ texto: 'Hola', desde: null, hasta: null }], '2030-01-01').length, 1);
});

test('números de la oficina: solo los que vienen rellenos y bien escritos', () => {
  assert.deepEqual(filasANumeros(NUMEROS).numeros, { whatsappOficina: '600 111 222', contactoIvan: 'ivan@vinoliva.test' });
  const r = filasANumeros([['Dato', 'Valor'], ['WhatsApp de la oficina', ''], ['WhatsApp o correo de Iván', 'mañana']]);
  assert.deepEqual(r.numeros, {});
  assert.equal(r.avisos.length, 1);
});

test('Excel de la oficina completo: qué trae cada hoja y qué cambia', () => {
  const libro = { Promociones: PROMOS, Encargos: ENCARGOS, Mensaje: MENSAJE, 'Números': NUMEROS, LEEME: [['Instrucciones']] };
  const a = analizarExcelOficina(libro, { fecha: J });
  assert.equal(a.promociones.promociones.length, 1);
  assert.equal(a.encargos.tipos.length, 4);
  assert.equal(a.mensajes.mensajes.length, 1);
  const aj = { ...ajustesVacios(), whatsappOficina: '600 111 222', contactoIvan: '' , mensajesVistos: ['viejo'] };
  const plan = planExcelOficina(a, { ajustes: aj, promocionesActuales: 3, fecha: J });
  assert.ok(plan.hayAlgo);
  assert.equal(plan.promociones.length, 1);
  assert.equal(plan.guardar.tiposEncargo.length, 4);
  assert.equal(plan.guardar.mensajesOficina.length, 1);
  assert.deepEqual(plan.guardar.mensajesVistos, [], 'los «Entendido» de mensajes viejos se olvidan');
  assert.equal(plan.guardar.whatsappOficina, undefined, 'el WhatsApp de la oficina ya era ese');
  assert.equal(plan.guardar.contactoIvan, 'ivan@vinoliva.test');
  assert.match(plan.cambios.find((c) => c.tipo === 'promociones').texto, /1 promoción \(sustituyen a las 3 de ahora\)/);

  // Importarlo otra vez no cambia nada
  const aj2 = { ...aj, ...plan.guardar };
  const otra = planExcelOficina(analizarExcelOficina({ Encargos: ENCARGOS, Mensaje: MENSAJE, 'Números': NUMEROS }), { ajustes: aj2, fecha: J });
  assert.equal(otra.hayAlgo, false);
});

test('Excel de la oficina: una hoja «Mensaje» vacía quita el mensaje; una hoja «Encargos» vacía no toca la lista', () => {
  const aj = { ...ajustesVacios(), tiposEncargo: filasAEncargos(ENCARGOS).tipos, mensajesOficina: filasAMensajes(MENSAJE).mensajes };
  const plan = planExcelOficina(analizarExcelOficina({ Encargos: [['Encargo']], Mensaje: [['Mensaje', 'Desde', 'Hasta']] }), { ajustes: aj, fecha: J });
  assert.deepEqual(plan.guardar.mensajesOficina, []);
  assert.equal(plan.guardar.tiposEncargo, undefined);
  assert.ok(plan.hayAlgo);
});

test('un Excel antiguo de solo promociones (hoja con otro nombre) sigue valiendo', () => {
  const a = analizarExcelOficina({ Hoja1: PROMOS }, { fecha: J });
  assert.equal(a.promociones.promociones.length, 1);
  assert.equal(a.encargos, null);
  const plan = planExcelOficina(a, { ajustes: ajustesVacios(), fecha: J });
  assert.equal(plan.promociones.length, 1);
  assert.deepEqual(Object.keys(plan.guardar), []);
});

test('versión de cierre: preparada pero APAGADA, y el service worker de acuerdo', () => {
  assert.equal(CIERRE.activo, false);
  assert.equal(CIERRE.borrarDatos, false);
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /const CIERRE_ACTIVO = false;/);
  assert.match(sw, /'js\/cierre\.js'/);
  assert.match(sw, /'js\/pantallas\/cierre\.js'/);
  const version = readFileSync(new URL('../js/version.js', import.meta.url), 'utf8').match(/'([\d.]+)'/)[1];
  assert.equal(sw.match(/const VERSION = '([\d.]+)'/)[1], version, 'misma versión en sw.js y version.js');
});
