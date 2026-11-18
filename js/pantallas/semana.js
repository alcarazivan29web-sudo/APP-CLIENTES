// =====================================================================
//  Pantalla «Semana»: una pestaña por día (L M X J V) y el resumen.
// =====================================================================

import * as datos from '../datos.js';
import * as acciones from '../acciones.js';
import { calcularSemana, lunesDe, sumarDias, diaSemana, fechaCorta, DIAS, DIAS_LETRA, NOMBRE_SITUACION, capitalizarPrimera } from '../logica.js';
import { h, hoja } from '../ui.js';
import { tablaResumen } from './hoy.js';

let desplazamiento = 0; // semanas respecto a la actual
let diaElegido = null;

export function render(cont, ctx) {
  const { fecha } = ctx.reloj.ahoraFH();
  const aj = datos.obtenerAjustes();
  const lunes = sumarDias(lunesDe(fecha), desplazamiento * 7);
  const semana = calcularSemana({ clientes: datos.obtenerClientes(), llamadas: datos.obtenerLlamadas(), lunes, fecha, primerUso: aj.primerUso });
  if (diaElegido == null) diaElegido = Math.min(diaSemana(fecha), 5);

  const titulo = desplazamiento === 0 ? 'Esta semana' : desplazamiento === -1 ? 'Semana pasada'
    : desplazamiento === 1 ? 'Semana que viene' : `Semana del ${fechaCorta(lunes)}`;

  const nav = h('div', { class: 'nav-semana' },
    h('button', { class: 'btn btn-secundario btn-icono', 'aria-label': 'Semana anterior', onClick: () => { desplazamiento--; ctx.refrescar(); } }, '‹'),
    h('div', { class: 'nav-semana-titulo' }, h('strong', {}, titulo), h('span', {}, `${fechaCorta(lunes)} – ${fechaCorta(sumarDias(lunes, 4))}`)),
    h('button', { class: 'btn btn-secundario btn-icono', 'aria-label': 'Semana siguiente', onClick: () => { desplazamiento++; ctx.refrescar(); } }, '›'));

  const pestanas = h('div', { class: 'pestanas-dias', role: 'tablist' },
    semana.dias.map((d) => h('button', {
      role: 'tab', 'aria-selected': String(d.dia === diaElegido),
      class: 'pestana-dia' + (d.dia === diaElegido ? ' activa' : '') + (d.fecha === fecha ? ' hoy' : ''),
      onClick: () => { diaElegido = d.dia; ctx.refrescar(); },
    }, h('span', { class: 'pd-letra' }, DIAS_LETRA[d.dia]), h('span', { class: 'pd-num' }, String(d.cuentas.clientes)))));

  const d = semana.dias[diaElegido - 1];
  const lista = h('div', { class: 'lista-semana' },
    h('h2', { class: 'subtitulo-dia' }, `${capitalizarPrimera(DIAS[d.dia])} ${fechaCorta(d.fecha)} · ${d.items.length} clientes`),
    d.items.length ? null : h('p', { class: 'vacio-bloque' }, 'Ningún cliente tiene este día de llamada.'),
    d.items.map((it) => h('button', { class: 'fila-semana', onClick: () => opciones(ctx, it, d) },
      h('span', { class: 'fs-nombre' }, (it.cliente.importante ? '★ ' : '') + it.cliente.nombreComercial,
        h('small', {}, it.cliente.poblacion || '')),
      h('span', { class: `chip sit-${it.situacion}` }, NOMBRE_SITUACION[it.situacion]))));

  cont.replaceChildren(
    h('header', { class: 'cabecera-pantalla' }, h('h1', {}, 'Semana')),
    nav,
    h('details', { class: 'resumen-semana', open: desplazamiento !== 0 },
      h('summary', {}, 'Resumen de la semana'), tablaResumen(semana)),
    pestanas,
    lista);
}

function opciones(ctx, it, d) {
  const c = it.cliente;
  const { fecha } = ctx.reloj.ahoraFH();
  const otroDia = d.fecha !== fecha;
  hoja({
    titulo: c.nombreComercial,
    contenido: (cerrar) => h('div', {},
      h('p', { class: 'texto-info' }, `${capitalizarPrimera(DIAS[d.dia])} ${fechaCorta(d.fecha)} · ${NOMBRE_SITUACION[it.situacion]}` +
        (otroDia ? '. Lo que apuntes aquí cuenta para ese día.' : '')),
      h('div', { class: 'columna-botones' },
        h('button', { class: 'btn btn-llamar btn-ancho', disabled: !(c.telefonos || []).length, onClick: () => { cerrar(); acciones.llamar(c, d.fecha); } }, 'Llamar'),
        h('button', { class: 'btn btn-whatsapp btn-ancho', disabled: !(c.telefonos || []).length, onClick: () => { cerrar(); acciones.whatsapp(c, d.fecha); } }, 'WhatsApp'),
        h('button', { class: 'btn btn-llamado btn-ancho', onClick: () => { cerrar(); acciones.preguntarResultado(c, d.fecha); } }, 'Apuntar resultado'),
        h('button', { class: 'btn btn-secundario btn-ancho', onClick: () => { cerrar(); ctx.abrirFicha(c.id); } }, 'Ver ficha'))),
  });
}
