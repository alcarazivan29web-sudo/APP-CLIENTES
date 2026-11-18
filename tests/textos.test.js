import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analizarCierre, analizarDias, analizarHora, extraerTelefonos, telefonoInternacional, telefonoWhatsApp, formatearTelefono,
} from '../js/logica.js';

test('días de llamada: variantes', () => {
  const casos = {
    'LUNES, MIERCOLES': [1, 3],
    'lunes y miércoles': [1, 3],
    'L/X': [1, 3],
    'M; J': [2, 4],
    'MI, V': [3, 5],
    'LUN, MIÉ, VIE': [1, 3, 5],
    'Martes-Viernes': [2, 5],
    'MARTES, MIERCOLES, VIERNES': [2, 3, 5],
    'jueves': [4],
    '': [],
  };
  for (const [txt, esperado] of Object.entries(casos)) assert.deepEqual(analizarDias(txt).dias, esperado, txt);
  const finde = analizarDias('LUNES, SABADO');
  assert.deepEqual(finde.dias, [1]);
  assert.deepEqual(finde.finDeSemana, [6]);
  assert.deepEqual(analizarDias('LUNES, CUANDO PUEDA').desconocidos, ['CUANDO', 'PUEDA']);
});

test('día que cierra: textos reales del Excel', () => {
  const casos = {
    DOMINGO: [7],
    'LUNES Y MARTES': [1, 2],
    'LUNES- MARTES': [1, 2],
    'LUNES -MARTES': [1, 2],
    'LUNES-MARTES-MIERCOL': [1, 2, 3],
    'L, M, MI, JU': [1, 2, 3, 4],
    'LUNES A MIERCOLES': [1, 2, 3],
    'DOMINGO-LUNES': [1, 7],
  };
  for (const [txt, dias] of Object.entries(casos)) {
    assert.deepEqual(analizarCierre(txt), { tipo: 'dias', dias }, txt);
  }
  assert.equal(analizarCierre('NO CIERRA').tipo, 'no_cierra');
  assert.equal(analizarCierre('ABRE TODOS DIAS').tipo, 'no_cierra');
  for (const txt of ['CERRADO', 'TEMPORADA', 'VERANO', 'JEFE COCINA', 'DESCARGAR LOS MIERCOLES']) {
    assert.deepEqual(analizarCierre(txt), { tipo: 'otro', dias: [] }, txt);
  }
  assert.equal(analizarCierre('').tipo, 'vacio');
});

test('hora de apertura', () => {
  assert.equal(analizarHora('08:00'), '08:00');
  assert.equal(analizarHora('8:00'), '08:00');
  assert.equal(analizarHora('8'), '08:00');
  assert.equal(analizarHora('8h30'), '08:30');
  assert.equal(analizarHora('10.30'), '10:30');
  assert.equal(analizarHora('11:30:00'), '11:30');
  assert.equal(analizarHora(0.5), '12:00');
  assert.equal(analizarHora('0.375'), '09:00');
  assert.equal(analizarHora(''), null);
  assert.equal(analizarHora(null), null);
  assert.equal(analizarHora('cuando quiera'), null);
  assert.equal(analizarHora('25:00'), null);
});

test('teléfonos: varios, con espacios, con prefijo', () => {
  assert.deepEqual(extraerTelefonos('679 171 125'), ['679171125']);
  assert.deepEqual(extraerTelefonos('635616701', '655188360, 666159209'), ['635616701', '655188360', '666159209']);
  assert.deepEqual(extraerTelefonos('+34 679171125 / 0034 962 85 00 00'), ['679171125', '962850000']);
  assert.deepEqual(extraerTelefonos('+44 7700 900123'), ['+447700900123']);
  assert.deepEqual(extraerTelefonos('635616701 655188360'), ['635616701', '655188360']);
  assert.deepEqual(extraerTelefonos('', null, '123'), []);
  assert.deepEqual(extraerTelefonos('679171125', '679 171 125'), ['679171125'], 'sin repetidos');
  assert.equal(telefonoInternacional('679171125'), '+34679171125');
  assert.equal(telefonoWhatsApp('679171125'), '34679171125');
  assert.equal(telefonoWhatsApp('+447700900123'), '447700900123');
  assert.equal(formatearTelefono('679171125'), '679 171 125');
});
