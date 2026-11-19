// Fase 7 · Excel para el CRM de la oficina: formato fijo (contrato con el CRM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hojasExcelCRM, COLUMNAS_CRM, nombreArchivoCRM, RESULTADOS_CRM, FORMATO_CRM } from '../js/crm.js';
import { cliente, registro, L, M, X, J } from './ayuda.js';

const base = (clientes, llamadas) => hojasExcelCRM({
  clientes, llamadas, comercial: 'Juan Bonilla', dispositivoId: 'mov-1',
  exportado: `${J}T18:00:00.000+01:00`, fecha: J, version: '1.6.0',
});
const fila = (hoja, i) => Object.fromEntries(hoja[0].map((k, j) => [k, hoja[i][j]]));

test('las columnas son las acordadas con el CRM (no cambiarlas sin subir FORMATO_CRM)', () => {
  assert.equal(FORMATO_CRM, 1);
  assert.deepEqual(Object.keys(COLUMNAS_CRM), ['Info', 'Clientes', 'Llamadas']);
  assert.equal(COLUMNAS_CRM.Clientes.length, 34);
  assert.equal(COLUMNAS_CRM.Llamadas.length, 24);
  for (const k of ['Id cliente', 'Comercial', 'Código ICG', 'Dirección', 'Email', 'Estado', 'Borrado en la app']) assert.ok(COLUMNAS_CRM.Clientes.includes(k), k);
  for (const k of ['Id llamada', 'Código ICG', 'Fecha', 'Resultado', 'Hubo pedido', 'Nota', 'Pendiente de volver a llamar', 'Anulada']) assert.ok(COLUMNAS_CRM.Llamadas.includes(k), k);
  assert.equal(nombreArchivoCRM('Juan Bonilla', J), `crm_juan-bonilla_${J}.xlsx`);
  assert.equal(nombreArchivoCRM('', J), `crm_comercial_${J}.xlsx`);
});

test('hoja Clientes: ficha completa con comercial, código ICG, email y dirección', () => {
  const a = cliente({
    codigo: 'C023', nombreComercial: 'BAR PEPE', poblacion: 'OLIVA', direccion: 'C/ Mayor, 12', email: 'pepe@bar.es',
    telefonos: ['600111222', '611222333'], telefonosInfo: { '611222333': { nombre: 'Pedidos', uso: 'whatsapp' } },
    diasLlamada: [1, 4], importante: true, creado: '2026-01-01T09:00:00.000+01:00',
  });
  const borrado = cliente({ codigo: 'C099', borrado: true });
  const h = base([a, borrado], []);
  const f = fila(h.Clientes, 1);
  assert.equal(f['Id cliente'], a.id);
  assert.equal(f.Comercial, 'Juan Bonilla');
  assert.equal(f['Código ICG'], 'C023');
  assert.equal(f.Dirección, 'C/ Mayor, 12');
  assert.equal(f.Email, 'pepe@bar.es');
  assert.equal(f.Teléfono, '600111222', 'el de llamar primero');
  assert.equal(f['Otros teléfonos'], '611222333');
  assert.equal(f['Días de llamada'], 'LUNES, JUEVES');
  assert.equal(f.Estado, 'activo');
  assert.equal(f.Importante, 'Sí');
  assert.equal(f['Borrado en la app'], 'No');
  assert.equal(fila(h.Clientes, 2)['Borrado en la app'], 'Sí', 'los borrados salen marcados');
  assert.deepEqual(h.Info.find((x) => x[0] === 'Clientes'), ['Clientes', 1]);
  assert.deepEqual(h.Info.find((x) => x[0] === 'Formato'), ['Formato', 'CRM VinOliva v1']);
});

test('hoja Llamadas: una fila por llamada, resultado de lista cerrada, pedido y pendientes', () => {
  const a = cliente({ codigo: 'C023', nombreComercial: 'BAR PEPE' });
  const b = cliente({ codigo: 'C024', nombreComercial: 'CASA PACO' });
  const r1 = registro(a.id, L, [['no_contesta', '10:00', { }], ['pide', '12:00', { pedido: '2 cajas Xoringer' }]]);
  const r2 = registro(b.id, M, [['no_contesta', '10:00']]);
  const r3 = registro(a.id, X, [['no_contesta', '09:00']]);
  const r4 = registro(a.id, J, [['mas_tarde', '10:00', { hora: '17:00' }]]);
  const anulada = { ...registro(b.id, J, [['no_pide', '11:00']]), borrado: true };
  const h = base([a, b], [r1, r2, r3, r4, anulada]);
  const filas = h.Llamadas.slice(1).map((_, i) => fila(h.Llamadas, i + 1));
  const de = (r) => filas.find((f) => f['Id llamada'] === r.id);
  assert.equal(filas.length, 5);
  assert.equal(de(r1).Resultado, 'pide');
  assert.equal(de(r1)['Hubo pedido'], 'Sí');
  assert.equal(de(r1).Pedido, '2 cajas Xoringer');
  assert.equal(de(r1)['Nº intentos'], 2);
  assert.equal(de(r1)['Código ICG'], 'C023');
  assert.equal(de(r1)['Pendiente de volver a llamar'], 'No');
  assert.equal(de(r2).Resultado, 'no_contesta');
  assert.equal(de(r2)['Pendiente de volver a llamar'], 'Sí', 'es lo último que pasó con Casa Paco');
  assert.equal(de(r3)['Pendiente de volver a llamar'], 'No', 'después hubo otra llamada a Bar Pepe');
  assert.equal(de(r4).Resultado, 'mas_tarde');
  assert.equal(de(r4)['Volver a llamar a las'], '17:00');
  assert.equal(de(r4)['Pendiente de volver a llamar'], 'Sí');
  assert.equal(de(anulada).Anulada, 'Sí');
  assert.equal(de(anulada).Resultado, '');
  for (const f of filas) assert.ok(f.Resultado === '' || RESULTADOS_CRM.includes(f.Resultado), f.Resultado);
  assert.deepEqual(h.Info.find((x) => x[0] === 'Llamadas'), ['Llamadas', 4]);
});
