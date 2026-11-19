// Fase 7 · Lista cerrada de comerciales: llega en el Excel de la oficina y se
// comprueba antes de «Exportar para el CRM».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprobarComercial, ajustesVacios } from '../js/logica.js';
import { filasAComerciales, analizarExcelOficina, planExcelOficina } from '../js/importar.js';
import { J } from './ayuda.js';

const HOJA = [['Comercial'], ['EJEMPLO — Nombre Apellido'], ['Juan Bonilla'], ['  Alex   Pérez '], ['juan bonilla'], ['']];

test('hoja «Comerciales»: un nombre por fila, sin ejemplos ni repetidos', () => {
  const r = filasAComerciales(HOJA);
  assert.deepEqual(r.comerciales, ['Juan Bonilla', 'Alex Pérez']);
  assert.equal(r.avisos.length, 1);
  assert.deepEqual(filasAComerciales([['Juan'], ['Alex']]).comerciales, ['Juan', 'Alex'], 'sin cabecera también vale');
});

test('al importar el Excel de la oficina: guarda la lista y corrige cómo se escribe tu nombre', () => {
  const a = analizarExcelOficina({ Comerciales: HOJA }, { fecha: J });
  assert.equal(a.promociones, null, 'un Excel solo con Comerciales no se toma como promociones');
  const plan = planExcelOficina(a, { ajustes: { ...ajustesVacios(), nombreComercial: 'JUAN BONILLA' }, fecha: J });
  assert.deepEqual(plan.guardar.comerciales, ['Juan Bonilla', 'Alex Pérez']);
  assert.equal(plan.guardar.nombreComercial, 'Juan Bonilla');
  assert.ok(plan.hayAlgo);
  const fuera = planExcelOficina(a, { ajustes: { ...ajustesVacios(), nombreComercial: 'Vinoliva Vinos' }, fecha: J });
  assert.equal(fuera.guardar.nombreComercial, undefined);
  assert.match(fuera.cambios.find((c) => c.tipo === 'comerciales').detalle, /no está en la lista/);
  // Volver a importar la misma lista no cambia nada
  const otra = planExcelOficina(a, { ajustes: { ...ajustesVacios(), nombreComercial: 'Juan Bonilla', comerciales: ['Juan Bonilla', 'Alex Pérez'] }, fecha: J });
  assert.equal(otra.hayAlgo, false);
  // Hoja vacía: se queda la lista de antes
  const vacia = planExcelOficina(analizarExcelOficina({ Comerciales: [['Comercial']] }), { ajustes: ajustesVacios(), fecha: J });
  assert.equal(vacia.guardar.comerciales, undefined);
});

test('antes de exportar para el CRM: nombre puesto y, si hay lista, de la lista', () => {
  assert.deepEqual(comprobarComercial({ nombreComercial: '' }), { ok: false, motivo: 'vacio', sugerido: '' });
  assert.equal(comprobarComercial({ nombreComercial: 'Juan Bonilla' }).ok, true, 'sin lista vale cualquiera (y se pide confirmar)');
  const lista = ['Juan Bonilla', 'Alex Pérez'];
  assert.equal(comprobarComercial({ nombreComercial: 'Juan Bonilla', comerciales: lista }).ok, true);
  assert.deepEqual(comprobarComercial({ nombreComercial: 'Vinoliva Vinos', comerciales: lista }), { ok: false, motivo: 'fuera_lista', sugerido: '' });
  assert.equal(comprobarComercial({ nombreComercial: 'alex perez', comerciales: lista }).sugerido, 'Alex Pérez');
});
