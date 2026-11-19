// =====================================================================
//  Pantalla «Hoy»: a quién hay que llamar hoy.
// =====================================================================

import * as datos from '../datos.js';
import * as acciones from '../acciones.js';
import { exportarYAvisar } from './mas.js';
import { abrirPromos, numPromosVigentes, abrirResumen, resumenPorEnviar } from './oficina.js';
import {
  calcularListaDia, calcularSemana, fechaLarga, fechaDeMarca, diasEntre, formatearTelefono,
  sumarDias, lunesDe, DIAS, NOMBRE_SITUACION, analizarCierre, fechaCorta, diaSemana, capitalizarPrimera,
  ORIGENES_PEDIDO, formatearImporte, telefonosDe, textoTelefono, USOS_TELEFONO, condicionesVigentes, textoCondicion,
  faltaPorConfigurar, estadoEnFecha, mensajesPorLeer,
} from '../logica.js';
import { verPorCompletar } from './clientes.js';
import { h } from '../ui.js';

const desplegadas = new Set();
const plegados = new Set();

export function render(cont, ctx) {
  const { fecha, hora } = ctx.reloj.ahoraFH();
  const aj = datos.obtenerAjustes();
  const clientes = datos.obtenerClientes();
  const llamadas = datos.obtenerLlamadas();
  const lista = calcularListaDia({
    clientes, llamadas, fecha, hora, primerUso: aj.primerUso,
    recordatorios: datos.obtenerRecordatorios(), semanasRiesgo: aj.semanasRiesgo,
  });

  const cab = h('header', { class: 'cabecera-hoy' },
    h('h1', {}, fechaLarga(fecha)),
    lista.finDeSemana
      ? h('p', { class: 'contador' }, 'Fin de semana')
      : h('p', { class: 'contador' },
        `${lista.contador.porLlamar} por llamar · ${lista.contador.hechos} ${lista.contador.hechos === 1 ? 'hecho' : 'hechos'}` +
        (lista.contador.noContestan ? ` · ${lista.contador.noContestan} no ${lista.contador.noContestan === 1 ? 'contesta' : 'contestan'}` : '')),
    h('div', { class: 'cabecera-acciones' },
      h('button', { class: 'btn btn-secundario btn-peq', onClick: () => abrirPromos(ctx) }, `Promos (${numPromosVigentes(fecha)})`),
      h('button', {
        class: 'btn btn-secundario btn-peq', 'aria-label': 'Nuevo recordatorio',
        onClick: () => acciones.editarRecordatorio({ elegirCliente: true }),
      }, '+ Recordatorio')),
  );

  const partes = [cab, ...avisos(ctx, aj, clientes, lista, fecha)];
  if (lista.recordatorios.length) {
    partes.push(bloque('recordatorios', 'Recordatorios', lista.recordatorios, (it) => tarjetaRecordatorio(it), 'bloque-recordatorios'));
  }

  if (!clientes.length) {
    partes.push(h('div', { class: 'vacio' },
      h('p', {}, 'Todavía no hay clientes.'),
      h('button', { class: 'btn btn-principal', onClick: () => ctx.irA('mas') }, 'Importar clientes')));
    cont.replaceChildren(...partes);
    return;
  }

  if (lista.finDeSemana) {
    partes.push(...finDeSemana(ctx, clientes, llamadas, fecha, aj));
    if (lista.hechos.length) partes.push(bloque('hechos', 'Hechos hoy', lista.hechos, (it) => tarjetaHecho(it)));
    cont.replaceChildren(...partes);
    return;
  }

  const tarj = (it) => tarjeta(it, fecha);
  if (lista.pendientes.length) partes.push(bloque('pendientes', 'Pendientes de días anteriores', lista.pendientes, tarj, 'bloque-pendientes'));
  partes.push(bloque('hoy', 'Por llamar hoy', lista.hoy, tarj, '',
    lista.pendientes.length || lista.masTarde.length ? 'Nadie más por llamar hoy.' : 'No hay nadie por llamar hoy.'));
  if (lista.masTarde.length) partes.push(bloque('tarde', 'Más tarde', lista.masTarde, (it) => tarjeta(it, fecha, true), 'bloque-tarde'));
  if (lista.captacion.length) {
    partes.push(bloque('captacion', 'Captación', lista.captacion,
      (it) => tarjeta(it, fecha, !!(it.volver && !it.volverCumplido)), 'bloque-captacion'));
  }
  if (lista.hechos.length) partes.push(bloque('hechos', 'Hechos hoy', lista.hechos, (it) => tarjetaHecho(it), 'bloque-hechos'));
  cont.replaceChildren(...partes);
}

// ---------------------------------------------------------------------

function avisos(ctx, aj, clientes, lista, fecha) {
  const out = [];
  // Mensaje de la oficina (llega en su Excel); sale hasta que se pulsa «Entendido»
  for (const m of mensajesPorLeer(aj, fecha)) {
    out.push(h('div', { class: 'aviso aviso-oficina', role: 'status' },
      h('p', { class: 'aviso-oficina-titulo' }, '📣 Mensaje de la oficina'),
      h('p', { class: 'mensaje-texto' }, m.texto),
      h('button', {
        class: 'btn btn-principal btn-peq',
        onClick: async () => {
          const vistos = [...new Set([...(datos.obtenerAjustes().mensajesVistos || []), m.id])].slice(-50);
          await datos.guardarAjustes({ mensajesVistos: vistos });
          ctx.refrescar();
        },
      }, 'Entendido')));
  }
  // Resumen semanal para Iván (desde el viernes a mediodía; el lunes, si no se mandó)
  const semanaResumen = clientes.length ? resumenPorEnviar(aj, fecha, lista.hora, lista.dia) : null;
  if (semanaResumen) {
    const esta = semanaResumen === lista.lunes;
    out.push(h('div', { class: 'aviso aviso-resumen' },
      h('p', {}, esta ? 'Enviar resumen de la semana a Iván.' : 'No enviaste el resumen de la semana pasada a Iván.'),
      h('button', { class: 'btn btn-principal btn-peq', onClick: () => abrirResumen(ctx, semanaResumen) }, 'Ver y enviar')));
  }
  // Copia de seguridad atrasada
  if (clientes.length) {
    const dias = aj.ultimaCopia ? diasEntre(fechaDeMarca(aj.ultimaCopia), fecha) : null;
    if (dias === null || dias > 7) {
      out.push(h('div', { class: 'aviso aviso-copia' },
        h('p', {}, dias === null ? 'Aún no has hecho ninguna copia de seguridad.' : `Hace ${dias} días que no haces copia de seguridad.`),
        h('button', { class: 'btn btn-principal btn-peq', onClick: () => exportarYAvisar(ctx) }, 'Hacer copia')));
    }
  }
  // Clientes con los que no se puede trabajar: sin teléfono o sin día de llamada
  if (clientes.length && aj.avisoCompletarCerrado !== fecha) {
    const vivos = clientes.filter((c) => estadoEnFecha(c, fecha) !== 'baja');
    const n = vivos.filter((c) => faltaPorConfigurar(c).importante.length).length;
    if (n) {
      out.push(h('div', { class: 'aviso aviso-completar' },
        h('p', {}, n === 1
          ? 'Tienes 1 cliente sin teléfono o sin día de llamada. Sin día no te sale para llamar.'
          : `Tienes ${n} clientes sin teléfono o sin día de llamada. Sin día no te salen para llamar.`),
        h('div', { class: 'fila-botones' },
          h('button', { class: 'btn btn-principal btn-peq', onClick: () => { verPorCompletar(true); ctx.irA('clientes'); } }, 'Completar'),
          h('button', {
            class: 'btn btn-secundario btn-peq',
            onClick: async () => { await datos.guardarAjustes({ avisoCompletarCerrado: fecha }); ctx.refrescar(); },
          }, 'Ocultar hoy'))));
    }
  }
  // Lunes: los que quedaron sin llamar la semana pasada
  if (lista.semanaPasadaSinLlamar.length && aj.avisoSemanaPasadaCerrado !== lista.lunes) {
    const n = lista.semanaPasadaSinLlamar.length;
    const det = h('details', {},
      h('summary', {}, 'Ver lista'),
      h('ul', { class: 'lista-simple' }, lista.semanaPasadaSinLlamar.map((it) =>
        h('li', {}, `${it.cliente.nombreComercial}${it.cliente.poblacion ? ' · ' + it.cliente.poblacion : ''}`))));
    out.push(h('div', { class: 'aviso' },
      h('p', {}, `La semana pasada ${n === 1 ? 'quedó 1 cliente' : `quedaron ${n}`} sin llamar.`),
      det,
      h('button', {
        class: 'btn btn-secundario btn-peq',
        onClick: async () => { await datos.guardarAjustes({ avisoSemanaPasadaCerrado: lista.lunes }); ctx.refrescar(); },
      }, 'Cerrar aviso')));
  }
  return out;
}

function bloque(clave, titulo, items, pintar, clase = '', textoVacio = '') {
  const plegado = plegados.has(clave);
  const sec = h('section', { class: `bloque ${clase}` });
  const cab = h('button', {
    class: 'bloque-titulo', 'aria-expanded': String(!plegado),
    onClick: () => {
      if (plegados.has(clave)) plegados.delete(clave); else plegados.add(clave);
      sec.classList.toggle('plegado');
      cab.setAttribute('aria-expanded', String(!plegados.has(clave)));
    },
  }, h('span', {}, titulo), h('span', { class: 'bloque-num' }, String(items.length)));
  sec.append(cab);
  if (plegado) sec.classList.add('plegado');
  const lista = h('div', { class: 'bloque-lista' });
  if (!items.length && textoVacio) lista.append(h('p', { class: 'vacio-bloque' }, textoVacio));
  for (const it of items) lista.append(pintar(it));
  sec.append(lista);
  return sec;
}

function etiquetasDe(it) {
  return h('div', { class: 'etiquetas' }, it.etiquetas.map((e) => h('span', { class: `etiqueta et-${e.tipo}` }, e.texto)));
}

function subtitulo(c) {
  return [c.poblacion, c.contacto, c.formaPago].filter(Boolean).join(' · ');
}

function tarjeta(it, fecha, gris = false) {
  const c = it.cliente;
  const abierta = desplegadas.has(c.id);
  const art = h('article', { class: 'tarjeta' + (gris ? ' gris' : '') + (c.importante ? ' importante' : '') + (abierta ? ' abierta' : '') });
  const detalle = h('div', { class: 'tarjeta-detalle' }, ...detalleCliente(c, fecha));
  const cuerpo = h('div', {
    class: 'tarjeta-cuerpo', role: 'button', tabindex: '0', 'aria-expanded': String(abierta),
    onClick: () => {
      if (desplegadas.has(c.id)) desplegadas.delete(c.id); else desplegadas.add(c.id);
      art.classList.toggle('abierta');
      cuerpo.setAttribute('aria-expanded', String(desplegadas.has(c.id)));
    },
  },
  h('h3', { class: 'tarjeta-nombre' }, c.importante ? h('span', { class: 'estrella', 'aria-label': 'Importante' }, '★ ') : null, c.nombreComercial),
  subtitulo(c) ? h('p', { class: 'tarjeta-sub' }, subtitulo(c)) : null,
  it.etiquetas.length ? etiquetasDe(it) : null,
  detalle);
  const sinTel = !(c.telefonos || []).length;
  art.append(cuerpo, h('div', { class: 'tarjeta-botones' },
    h('button', { class: 'btn btn-llamar', disabled: sinTel, onClick: () => acciones.llamar(c, it.fechaPrevista) }, 'Llamar'),
    h('button', { class: 'btn btn-whatsapp', disabled: sinTel, onClick: () => acciones.whatsapp(c, it.fechaPrevista) }, 'WhatsApp'),
    h('button', { class: 'btn btn-llamado', onClick: () => acciones.preguntarResultado(c, it.fechaPrevista) }, 'Llamado'),
    h('button', { class: 'btn btn-mas', 'aria-label': 'Más opciones', onClick: () => acciones.menuCliente(c, it.fechaPrevista) }, '⋯'),
  ));
  return art;
}

export function detalleCliente(c, fecha = null) {
  const fila = (k, v) => (v ? h('div', { class: 'det-fila' }, h('dt', {}, k), h('dd', {}, v)) : null);
  const cierre = analizarCierre(c.diaCierre);
  const conds = condicionesVigentes(c, fecha);
  return [h('dl', { class: 'det' },
    fila('Teléfonos', telefonosDe(c).map((t) => textoTelefono(t) + (t.uso !== 'todo' ? ` (${USOS_TELEFONO[t.uso].toLowerCase()})` : '')).join('\n')),
    fila('Condiciones especiales', conds.map((x) => textoCondicion(x) + (x.nota ? ` · ${x.nota}` : '')).join('\n')),
    fila('Abre a las', c.horaApertura),
    fila('Llamar a partir de', c.llamarDesde),
    fila('Cierra', c.diaCierre ? c.diaCierre + (cierre.tipo === 'otro' ? ' (texto libre)' : '') : ''),
    fila('Zona', c.zona),
    fila('Nombre fiscal', c.nombreFiscal),
    fila('Pide habitualmente', c.pideHabitualmente),
    fila('Otras condiciones', c.condiciones),
    c.pendienteCobro && Number(c.pendienteCobro.importe) > 0
      ? fila('Cobro pendiente', formatearImporte(c.pendienteCobro.importe) + (c.pendienteCobro.nota ? ' · ' + c.pendienteCobro.nota : '')) : null,
    fila('Notas', c.notas))];
}

function tarjetaRecordatorio(it) {
  const r = it.recordatorio;
  const c = it.cliente;
  const cuando = it.vencido ? `Vencido · ${capitalizarPrimera(DIAS[diaSemana(r.fecha)]).slice(0, 3)} ${fechaCorta(r.fecha)}` : null;
  return h('article', { class: 'tarjeta tarjeta-recordatorio' + (it.vencido ? ' vencido' : '') },
    h('div', {
      class: 'tarjeta-cuerpo', role: 'button', tabindex: '0',
      onClick: () => acciones.opcionesRecordatorio(r),
    },
    h('p', { class: 'rec-texto' }, r.texto),
    c || cuando ? h('div', { class: 'etiquetas' },
      cuando ? h('span', { class: 'etiqueta et-aviso' }, cuando) : null,
      c ? h('span', { class: 'etiqueta et-info' }, c.nombreComercial) : null) : null),
    h('div', { class: 'tarjeta-botones' },
      h('button', { class: 'btn btn-pide', onClick: () => acciones.recordatorioHecho(r) }, '✓ Hecho'),
      h('button', { class: 'btn btn-mas', 'aria-label': 'Más opciones', onClick: () => acciones.opcionesRecordatorio(r) }, '⋯')));
}

function tarjetaHecho(it) {
  const c = it.cliente;
  const r = it.registro;
  const txt = r.resultado === 'pide' ? 'Pide' : 'No pide';
  return h('article', { class: 'tarjeta hecha' },
    h('div', { class: 'tarjeta-cuerpo' },
      h('h3', { class: 'tarjeta-nombre' }, c.nombreComercial),
      h('div', { class: 'etiquetas' },
        h('span', { class: `etiqueta et-${r.resultado}` }, txt),
        ORIGENES_PEDIDO[r.origen] ? h('span', { class: 'etiqueta et-info' }, ORIGENES_PEDIDO[r.origen]) : null,
        r.resultado === 'pide' && r.enviadoOficina ? h('span', { class: 'etiqueta et-gris' }, 'Enviado a oficina') : null),
      r.pedido ? h('p', { class: 'tarjeta-pedido' }, r.pedido) : null,
      r.nota ? h('p', { class: 'tarjeta-sub' }, r.nota) : null),
    h('div', { class: 'tarjeta-botones' },
      r.resultado === 'pide' && !r.enviadoOficina
        ? h('button', { class: 'btn btn-secundario', onClick: () => acciones.enviarAOficina(c, r) }, 'Enviar a oficina') : null,
      h('button', { class: 'btn btn-secundario', onClick: () => acciones.deshacerHecho(c, r) }, 'Deshacer')));
}

// ---------------------------------------------------------------------
//  Fin de semana
// ---------------------------------------------------------------------

function finDeSemana(ctx, clientes, llamadas, fecha, aj) {
  const lunesActual = lunesDe(fecha);
  const lunes = sumarDias(lunesActual, 7);
  const semana = calcularSemana({ clientes, llamadas, lunes: lunesActual, fecha, primerUso: aj.primerUso });
  const prevLunes = calcularListaDia({ clientes, llamadas, fecha: lunes, hora: '08:00', primerUso: aj.primerUso, conSemanaPasada: false });
  return [
    h('div', { class: 'aviso aviso-suave' }, h('p', { class: 'grande' }, 'Hoy no toca llamar.')),
    h('section', { class: 'bloque' },
      h('h2', { class: 'bloque-titulo estatico' }, 'Resumen de la semana'),
      tablaResumen(semana)),
    h('section', { class: 'bloque' },
      h('h2', { class: 'bloque-titulo estatico' }, `El lunes: ${prevLunes.hoy.length} por llamar`),
      h('ul', { class: 'lista-simple' }, prevLunes.hoy.slice(0, 40).map((it) =>
        h('li', {}, `${it.cliente.importante ? '★ ' : ''}${it.cliente.nombreComercial}${it.cliente.poblacion ? ' · ' + it.cliente.poblacion : ''}`)),
      prevLunes.hoy.length > 40 ? h('li', {}, `… y ${prevLunes.hoy.length - 40} más`) : null)),
  ];
}

export function tablaResumen(semana) {
  const cols = [['llamados', 'Llamados'], ['pide', 'Pide'], ['noPide', 'No pide'], ['noContesta', 'No contesta'], ['pendientes', 'Sin llamar']];
  return h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla-resumen' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), cols.map(([, t]) => h('th', {}, t)))),
    h('tbody', {},
      semana.dias.map((d) => h('tr', {}, h('th', {}, DIAS[d.dia].slice(0, 3)), cols.map(([k]) => h('td', {}, String(d.cuentas[k]))))),
      h('tr', { class: 'total' }, h('th', {}, 'Total'), cols.map(([k]) => h('td', {}, String(semana.total[k])))))));
}

export { NOMBRE_SITUACION };
