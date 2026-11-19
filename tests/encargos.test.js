// Fase 5 · Encargos a la oficina: mensaje, resumen semanal, Excel y migración.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_ENCARGO, encargoVacio, tituloEncargo, mensajeEncargo } from '../js/logica.js';
import { datosSemana, textoResumenSemanal, hojasExcelSemanal } from '../js/informes.js';
import { filasListaEncargo } from '../js/exportar.js';
import { migrar, leerCopia, crearCopia, ESQUEMA_ACTUAL, COLECCIONES } from '../js/migraciones.js';
import { cliente, L, M, J, V } from './ayuda.js';

const encargo = (tipo, clientes, extra = {}) => ({ ...encargoVacio(), id: 'e-' + tipo, tipo, clienteIds: clientes.map((c) => c.id), fecha: J, hora: '10:15', ...extra });

const pepe = () => cliente({
  codigo: 'C023', nombreComercial: 'BAR PEPE', poblacion: 'OLIVA', contacto: 'PEPE',
  telefonos: ['600111222', '611222333'],
  telefonosInfo: { '600111222': { nombre: 'Jefe', uso: 'llamar' }, '611222333': { nombre: 'Pedidos', uso: 'whatsapp' } },
});

test('la lista de encargos es la acordada con Iván', () => {
  assert.deepEqual(TIPOS_ENCARGO.map((t) => t.texto), [
    'Enviar catálogo de Navidad', 'Enviar catálogo general', 'Enviar tarifa de precios', 'Enviar ficha de un producto',
    'Que le llame la oficina', 'Revisar un cobro o una factura', 'Otro',
  ]);
  assert.equal(tituloEncargo({ tipo: 'ficha_producto', detalle: 'Xoringer' }), 'Enviar ficha de un producto: Xoringer');
  assert.equal(tituloEncargo({ tipo: 'otro', detalle: 'Llevarle muestras' }), 'Llevarle muestras');
  assert.equal(tituloEncargo({ tipo: 'catalogo_navidad', detalle: '' }), 'Enviar catálogo de Navidad');
});

test('mensaje de un encargo para un cliente: empieza por 📌 ENCARGO y lleva sus datos', () => {
  const c = pepe();
  const m = mensajeEncargo({ encargo: encargo('catalogo_navidad', [c], { nota: 'le interesan los cavas' }), clientes: [c], comercial: 'Juan Bonilla', fecha: J, hora: '10:15' });
  assert.equal(m, [
    '📌 ENCARGO · Juan Bonilla',
    'Enviar catálogo de Navidad',
    'Cliente: Bar Pepe (C023) · Oliva',
    'Contacto: Pepe',
    'WhatsApp: Pedidos · 611 222 333',
    'Teléfono: Jefe · 600 111 222',
    'Nota: le interesan los cavas',
    '— jueves 19/11 10:15',
  ].join('\n'));
  // Con un solo teléfono para todo, no se repite
  const simple = cliente({ nombreComercial: 'BAR SOLO', telefonos: ['622333444'] });
  const m2 = mensajeEncargo({ encargo: encargo('tarifa', [simple]), clientes: [simple], comercial: 'Juan', fecha: J, hora: '10:15' });
  assert.match(m2, /WhatsApp: 622 333 444\n— /);
  assert.ok(!m2.includes('Teléfono:'));
  const sinTel = cliente({ nombreComercial: 'BAR MUDO', telefonos: [] });
  assert.match(mensajeEncargo({ encargo: encargo('tarifa', [sinTel]), clientes: [sinTel], comercial: 'Juan', fecha: J, hora: '10:15' }), /Sin teléfono en la app/);
});

test('mensaje de un encargo para varios clientes: una línea por cliente', () => {
  const a = pepe();
  const b = cliente({ nombreComercial: 'CASA PACO', poblacion: 'PEGO', contacto: '', telefonos: [] });
  const m = mensajeEncargo({ encargo: encargo('catalogo_navidad', [a, b]), clientes: [a, b], comercial: 'Juan', fecha: J, hora: '10:15' });
  assert.equal(m.split('\n')[1], 'Enviar catálogo de Navidad · 2 clientes:');
  assert.equal(m.split('\n')[2], '1. Bar Pepe (C023) · Oliva · Pepe · WhatsApp Pedidos · 611 222 333');
  assert.equal(m.split('\n')[3], '2. Casa Paco · Pego · sin teléfono');
});

test('Excel de la lista de un encargo', () => {
  const a = pepe();
  const filas = filasListaEncargo(encargo('catalogo_general', [a], { nota: 'urgente' }), [a], 'Juan');
  assert.deepEqual(filas[1], ['Juan', J, 'Enviar catálogo general', 'urgente', 'C023', 'BAR PEPE', 'OLIVA', 'PEPE', 'Pedidos · 611 222 333', 'Jefe · 600 111 222']);
});

test('resumen semanal y Excel de la semana: sección y hoja «Encargos»', () => {
  const a = pepe();
  const b = cliente({ codigo: 'C024', nombreComercial: 'CASA PACO', poblacion: 'PEGO' });
  const encargos = [
    encargo('catalogo_navidad', [a, b]),
    encargo('llamar_oficina', [a], { fecha: M, hora: '09:00' }),
    encargo('tarifa', [a], { fecha: '2026-11-09' }), // otra semana
    encargo('cobro', [a], { borrado: true }),
  ];
  const d = datosSemana({ clientes: [a, b], llamadas: [], encargos, lunes: L, fecha: V, primerUso: '2026-01-01' });
  assert.equal(d.encargos.length, 2);
  const t = textoResumenSemanal(d, 'Juan');
  assert.match(t, /\*ENCARGOS A LA OFICINA \(2\)\*\n• Que le llame la oficina · Bar Pepe \(Oliva\) · Mar 17\/11\n• Enviar catálogo de Navidad · 2 clientes · Jue 19\/11/);
  const hoja = hojasExcelSemanal(d, 'Juan').Encargos;
  assert.equal(hoja.length, 4, 'una fila por cliente de cada encargo');
  assert.deepEqual(hoja[3].slice(2), ['C024', 'CASA PACO', J, '10:15', 'PEGO', 'Enviar catálogo de Navidad', '', 2]);
});

test('migración 2 → 3: aparece la colección «encargos» y las copias antiguas se restauran', () => {
  assert.ok(ESQUEMA_ACTUAL >= 3);
  assert.ok(COLECCIONES.includes('encargos'));
  const v2 = { clientes: [{ ...cliente(), id: 'a1' }], llamadas: [] };
  const d = migrar(v2, 2, 3);
  assert.deepEqual(d.encargos, []);
  assert.equal(d.clientes.length, 1);
  // Una copia hecha con la versión 1.3.0 (esquema 2) se puede restaurar
  const copia = crearCopia(v2, { dispositivoId: 'd1', exportado: `${L}T10:00:00.000+01:00`, esquema: 2 });
  delete copia.datos.encargos;
  assert.deepEqual(leerCopia(copia).datos.encargos, []);
  // Y los encargos de una copia nueva se conservan completos
  const e = encargo('tarifa', [{ id: 'a1' }]);
  const nueva = crearCopia({ ...v2, encargos: [e] }, { dispositivoId: 'd1', exportado: `${L}T10:00:00.000+01:00` });
  assert.deepEqual(leerCopia(JSON.stringify(nueva)).datos.encargos, [e]);
});
