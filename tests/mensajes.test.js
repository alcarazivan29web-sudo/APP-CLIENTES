import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajePedido, rellenarPlantilla, enlaceWhatsApp, PLANTILLA_NO_CONTESTA, clienteVacio } from '../js/logica.js';

const bar = { ...clienteVacio(), nombreComercial: 'BAR TORRES', poblacion: 'BELLREGUARD', contacto: 'FERNANDO', telefonos: ['679171125'] };

test('texto del pedido para WhatsApp', () => {
  const txt = mensajePedido({
    cliente: bar, pedido: '2 cajas Muga Rosado\n1 caja Verdeal', comercial: 'Juan Bonilla', fecha: '2026-11-17', hora: '10:42',
  });
  assert.equal(txt, [
    'PEDIDO · Bar Torres (Bellreguard)',
    'Contacto: Fernando · 679 171 125',
    '2 cajas Muga Rosado\n1 caja Verdeal',
    '— Juan Bonilla, martes 17/11 10:42',
  ].join('\n'));
});

test('pedido sin texto y cliente sin contacto ni teléfono', () => {
  const txt = mensajePedido({
    cliente: { ...bar, contacto: '', telefonos: [], poblacion: '' }, pedido: '', comercial: 'Juan Bonilla', fecha: '2026-11-18', hora: '09:05',
  });
  assert.equal(txt, 'PEDIDO · Bar Torres\n— Juan Bonilla, miércoles 18/11 09:05');
});

test('plantilla «no contesta»', () => {
  const txt = rellenarPlantilla(PLANTILLA_NO_CONTESTA, { cliente: bar, comercial: 'Juan Bonilla', fecha: '2026-11-18' });
  assert.equal(txt, 'Hola Fernando, te he llamado para el pedido de esta semana, ¿necesitas algo? Un saludo, Juan (VinOliva)');
  const sinContacto = rellenarPlantilla(PLANTILLA_NO_CONTESTA, { cliente: { ...bar, contacto: '' }, comercial: 'Juan', fecha: '2026-11-18' });
  assert.ok(sinContacto.startsWith('Hola, te he llamado'));
  assert.equal(rellenarPlantilla('{nombre} · {dia}', { cliente: bar, comercial: 'Juan', fecha: '2026-11-18' }), 'Bar Torres · miércoles');
});

test('enlace de WhatsApp', () => {
  assert.equal(enlaceWhatsApp('679171125', 'Hola ¿qué tal?'), 'https://wa.me/34679171125?text=Hola%20%C2%BFqu%C3%A9%20tal%3F');
  assert.equal(enlaceWhatsApp('679171125'), 'https://wa.me/34679171125');
});
