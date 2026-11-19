// Fase 7 · Email y dirección del cliente (para el CRM de la oficina).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clienteVacio, coincideBusqueda } from '../js/logica.js';
import { filasAClientes, planificarImportacion, esEmail } from '../js/importar.js';
import { filasExportacionClientes } from '../js/exportar.js';
import { hojasExcelSemanal, datosSemana } from '../js/informes.js';
import { migrar, ESQUEMA_ACTUAL } from '../js/migraciones.js';
import { cliente, L, V } from './ayuda.js';

test('el cliente tiene email y dirección, y se buscan', () => {
  assert.equal(clienteVacio().email, '');
  assert.equal(clienteVacio().direccion, '');
  const c = cliente({ email: 'barpepe@gmail.com', direccion: 'C/ Mayor, 12' });
  assert.ok(coincideBusqueda(c, 'barpepe'));
  assert.ok(coincideBusqueda(c, 'mayor 12'));
  assert.ok(esEmail('a@b.es'));
  assert.ok(!esEmail('barpepe arroba gmail'));
});

test('Excel de clientes: importar y exportar email y dirección', () => {
  const filas = [
    ['ID', 'Nombre comercial', 'Población', 'Dirección', 'Teléfono', 'Correo electrónico'],
    ['C001', 'BAR PEPE', 'OLIVA', 'C/ Mayor, 12', '600111222', ' BarPepe@Gmail.com '],
    ['C002', 'CASA PACO', 'PEGO', '', '600333444', 'casapaco'],
  ];
  const { clientes, avisos } = filasAClientes(filas);
  assert.equal(clientes[0].email, 'barpepe@gmail.com');
  assert.equal(clientes[0].direccion, 'C/ Mayor, 12');
  assert.equal(avisos.filter((a) => a.includes('no parece un email')).length, 1);
  // Exportar y volver a importar: no cambia nada
  const plan = planificarImportacion(clientes, [], { fecha: L });
  const enApp = plan.nuevos.map((c, i) => ({ ...c, id: 'x' + i }));
  const exp = filasExportacionClientes(enApp);
  assert.ok(exp[0].includes('Email') && exp[0].includes('Dirección'));
  const otra = planificarImportacion(filasAClientes(exp).clientes, enApp, { fecha: L });
  assert.equal(otra.resumen.nuevos, 0);
  assert.equal(otra.resumen.actualizados, 0);
  // Una celda vacía no borra el email del móvil
  const sinEmail = filasAClientes([['ID', 'Nombre comercial', 'Email'], ['C001', 'BAR PEPE', '']]).clientes;
  assert.equal(planificarImportacion(sinEmail, enApp, { fecha: L }).resumen.actualizados, 0);
});

test('Excel semanal: la hoja Clientes lleva dirección y email', () => {
  const c = cliente({ codigo: 'C001', email: 'a@b.es', direccion: 'C/ Mayor, 12' });
  const d = datosSemana({ clientes: [c], llamadas: [], lunes: L, fecha: V, primerUso: '2026-01-01' });
  const hoja = hojasExcelSemanal(d, 'Juan').Clientes;
  const cab = hoja[0];
  assert.equal(hoja[1][cab.indexOf('Email')], 'a@b.es');
  assert.equal(hoja[1][cab.indexOf('Dirección')], 'C/ Mayor, 12');
});

test('migración 3 → 4: los clientes reciben email y dirección vacíos sin perder nada', () => {
  assert.equal(ESQUEMA_ACTUAL, 4);
  const viejo = { ...cliente({ notas: 'no tocar' }) };
  delete viejo.email; delete viejo.direccion;
  const d = migrar({ clientes: [viejo], llamadas: [], encargos: [] }, 3, 4);
  assert.equal(d.clientes[0].email, '');
  assert.equal(d.clientes[0].direccion, '');
  assert.equal(d.clientes[0].notas, 'no tocar');
});
