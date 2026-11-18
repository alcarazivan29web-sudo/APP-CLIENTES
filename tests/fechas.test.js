// Las fechas no deben cambiar de día cerca de medianoche (zona horaria).
process.env.TZ = 'Europe/Madrid';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaLocal, horaLocal, marcaTiempo, fechaDeMarca, lunesDe, sumarDias, diaSemana, fechaLarga, diasEntre } from '../js/logica.js';

test('cerca de medianoche la fecha es la del móvil, no la de UTC', () => {
  const casi = new Date(2026, 10, 18, 23, 59, 30);
  assert.equal(fechaLocal(casi), '2026-11-18');
  const pasada = new Date(2026, 10, 19, 0, 30);
  assert.equal(fechaLocal(pasada), '2026-11-19');
  // toISOString() daría el día anterior: por eso no se usa
  assert.equal(pasada.toISOString().slice(0, 10), '2026-11-18');
  assert.equal(horaLocal(pasada), '00:30');
  // En verano (UTC+2) igual
  const verano = new Date(2026, 6, 1, 1, 15);
  assert.equal(fechaLocal(verano), '2026-07-01');
  assert.equal(fechaDeMarca(marcaTiempo(verano)), '2026-07-01');
  assert.match(marcaTiempo(verano), /^2026-07-01T01:15:00\.000\+02:00$/);
});

test('la semana empieza en lunes', () => {
  assert.equal(lunesDe('2026-11-18'), '2026-11-16');
  assert.equal(lunesDe('2026-11-16'), '2026-11-16');
  assert.equal(lunesDe('2026-11-22'), '2026-11-16');
  assert.equal(diaSemana('2026-11-22'), 7);
  assert.equal(fechaLarga('2026-11-18'), 'Miércoles 18 de noviembre');
});

test('cambio de hora de octubre y de marzo', () => {
  assert.equal(sumarDias('2026-10-24', 1), '2026-10-25');
  assert.equal(sumarDias('2026-10-25', 1), '2026-10-26');
  assert.equal(sumarDias('2026-03-28', 2), '2026-03-30');
  assert.equal(lunesDe('2026-10-25'), '2026-10-19');
  assert.equal(diasEntre('2026-03-27', '2026-04-03'), 7);
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
});
