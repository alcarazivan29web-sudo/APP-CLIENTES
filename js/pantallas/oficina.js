// =====================================================================
//  Fase 3 · Oficina: promociones, resumen semanal y cambios para ICG.
//  Son pantallas completas que se abren desde Hoy y desde «Más».
// =====================================================================

import * as datos from '../datos.js';
import {
  promocionesVigentes, coincidePromo, formatearImporte, fechaCorta, fechaNormal,
  lunesDe, sumarDias, enlaceWhatsApp, extraerTelefonos, mensajesVigentes, listaEncargos,
} from '../logica.js';
import { datosSemana, textoResumenSemanal, cambiosParaICG } from '../informes.js';
import { leerLibro, analizarExcelOficina, planExcelOficina } from '../importar.js';
import { exportarExcelSemanal, exportarCambiosICG } from '../exportar.js';
import { h, hoja, toast, confirmar, pantallaCompleta, elegirArchivo, abrirEnlace, compartirTexto } from '../ui.js';

const ACEPTA_EXCEL = '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';

// ---------------------------------------------------------------------
//  Promociones
// ---------------------------------------------------------------------

export function numPromosVigentes(fecha) {
  return promocionesVigentes(datos.obtenerPromociones(), fecha).length;
}

export function abrirPromos(ctx) {
  const { fecha } = ctx.reloj.ahoraFH();
  const todas = promocionesVigentes(datos.obtenerPromociones(), fecha);
  const buscador = h('input', { class: 'campo buscador', type: 'search', placeholder: 'Buscar producto, bodega, promoción…', 'aria-label': 'Buscar promociones' });
  const lista = h('div', { class: 'lista-promos' });
  const pintar = () => {
    const vis = todas.filter((p) => coincidePromo(p, buscador.value));
    lista.replaceChildren(...(vis.length
      ? vis.map((p) => tarjetaPromo(p))
      : [h('p', { class: 'vacio-bloque' }, todas.length ? 'Ninguna promoción coincide.' : 'No hay promociones vigentes. Llegan con el Excel de la oficina (Más → «Importar Excel de la oficina»).')]));
  };
  buscador.addEventListener('input', pintar);
  pintar();
  pantallaCompleta({
    titulo: `Promos (${todas.length})`,
    contenido: h('div', {}, buscador, lista),
  });
}

function tarjetaPromo(p) {
  const fechas = [
    !p.empezada && p.desde ? `Empieza el ${fechaCorta(p.desde)}` : null,
    p.hasta ? `Hasta el ${fechaCorta(p.hasta)}` : null,
  ].filter(Boolean).join(' · ');
  return h('article', { class: 'tarjeta-promo' + (p.empezada ? '' : ' futura') },
    h('div', { class: 'promo-cab' },
      h('h3', { class: 'promo-producto' }, p.producto),
      p.promocion ? h('span', { class: 'promo-oferta' }, p.promocion) : null),
    p.detalle ? h('p', { class: 'promo-detalle' }, p.detalle) : null,
    h('div', { class: 'etiquetas' },
      p.precio != null ? h('span', { class: 'etiqueta et-info' }, formatearImporte(p.precio)) : null,
      p.tipo ? h('span', { class: 'etiqueta et-gris' }, p.tipo) : null,
      fechas ? h('span', { class: 'etiqueta et-recordatorio' }, fechas) : null));
}

/** Importar el Excel de la oficina: promociones, lista de encargos, mensaje
 *  de la semana y números. Vale también un Excel antiguo solo de promociones. */
export async function flujoImportarOficina(ctx) {
  const file = await elegirArchivo(ACEPTA_EXCEL);
  if (!file) return;
  const { fecha } = ctx.reloj.ahoraFH();
  const aj = datos.obtenerAjustes();
  let plan;
  try {
    const analisis = analizarExcelOficina(await leerLibro(file), { fecha });
    plan = planExcelOficina(analisis, { ajustes: aj, promocionesActuales: datos.obtenerPromociones().length, fecha });
  } catch (e) {
    toast('No se pudo leer el archivo: ' + e.message, { duracion: 7000 });
    return;
  }
  if (!plan.cambios.length) {
    toast(plan.avisos[0] || 'No encuentro nada de la oficina en este archivo (hojas Promociones, Encargos, Mensaje o Números).', { duracion: 8000 });
    return;
  }
  const fila = (c) => h('li', { class: c.sinCambio ? 'sin-cambio' : '' },
    h('strong', {}, c.texto), c.sinCambio && !c.detalle ? ' · igual que ahora' : null,
    c.detalle ? h('span', { class: 'detalle-cambio' }, c.detalle) : null);
  hoja({
    titulo: 'Excel de la oficina',
    contenido: (cerrar) => h('div', {},
      h('p', { class: 'texto-ayuda' }, plan.hayAlgo ? 'Esto es lo que trae el archivo:' : 'El archivo no cambia nada de lo que ya tienes:'),
      h('ul', { class: 'resumen-importar resumen-oficina' }, plan.cambios.map(fila)),
      plan.avisos.length ? h('details', {}, h('summary', {}, `Avisos (${plan.avisos.length})`),
        h('ul', { class: 'lista-simple' }, plan.avisos.slice(0, 100).map((a) => h('li', {}, a)))) : null,
      h('div', { class: 'fila-botones' },
        h('button', { class: 'btn btn-secundario', onClick: () => cerrar() }, plan.hayAlgo ? 'Cancelar' : 'Cerrar'),
        plan.hayAlgo ? h('button', {
          class: 'btn btn-principal',
          onClick: async (ev) => {
            ev.target.disabled = true;
            try {
              if (plan.promociones) await datos.reemplazarPromociones(plan.promociones);
              await datos.guardarAjustes({ ...plan.guardar, excelOficina: { fecha, archivo: file.name } });
              cerrar();
              toast('Excel de la oficina importado');
              ctx.refrescar();
            } catch (e) {
              ev.target.disabled = false;
              toast('Error al guardar: ' + e.message, { duracion: 7000 });
            }
          },
        }, 'Importar') : null)),
  });
}

/** Mensajes de la oficina vigentes (también los ya marcados como «Entendido»). */
export function abrirMensajes(ctx) {
  const { fecha } = ctx.reloj.ahoraFH();
  const lista = mensajesVigentes(datos.obtenerAjustes().mensajesOficina, fecha);
  pantallaCompleta({
    titulo: 'Mensajes de la oficina',
    contenido: h('div', {}, lista.length
      ? lista.map((m) => h('article', { class: 'tarjeta-mensaje' },
        h('p', { class: 'mensaje-texto' }, m.texto),
        m.hasta ? h('p', { class: 'texto-ayuda' }, `Hasta el ${fechaCorta(m.hasta)}`) : null))
      : h('p', { class: 'vacio-bloque' }, 'No hay ningún mensaje de la oficina ahora mismo.')),
  });
}

/** Texto corto para la tarjeta de «Más». */
export function estadoOficina(fecha) {
  const aj = datos.obtenerAjustes();
  const n = numPromosVigentes(fecha);
  const m = mensajesVigentes(aj.mensajesOficina, fecha).length;
  const propia = (aj.tiposEncargo || []).length > 0;
  return {
    promos: n, mensajes: m,
    texto: [
      `${n} ${n === 1 ? 'promoción vigente' : 'promociones vigentes'}`,
      m ? `${m} ${m === 1 ? 'mensaje' : 'mensajes'}` : 'sin mensaje',
      propia ? `lista de encargos de la oficina (${listaEncargos(aj).length})` : 'lista de encargos de serie',
    ].join(' · '),
    ultima: aj.excelOficina,
  };
}

// ---------------------------------------------------------------------
//  Resumen semanal
// ---------------------------------------------------------------------

async function cargarSemana(ctx, lunes) {
  const aj = datos.obtenerAjustes();
  const { fecha } = ctx.reloj.ahoraFH();
  return datosSemana({
    clientes: datos.obtenerClientes({ incluirBorrados: true }), llamadas: datos.obtenerLlamadas(),
    recordatorios: datos.obtenerRecordatorios(), cambios: await datos.obtenerCambios(), encargos: datos.obtenerEncargos(),
    lunes, fecha, primerUso: aj.primerUso, semanasRiesgo: aj.semanasRiesgo,
  });
}

/** ¿Toca avisar en Hoy de que hay que mandar el resumen? Devuelve el lunes de la semana a enviar, o null. */
export function resumenPorEnviar(aj, fecha, hora, dia) {
  const lunes = lunesDe(fecha);
  const enviado = (l) => aj.ultimoResumen?.lunes === l || (aj.resumenesEnviados || []).includes(l);
  // Desde el viernes a mediodía, el de esta semana
  if ((dia === 5 && hora >= '12:00') || dia > 5) return enviado(lunes) ? null : lunes;
  // El lunes, si no se mandó el de la semana pasada (y la app ya se usaba)
  const anterior = sumarDias(lunes, -7);
  if (dia === 1 && aj.primerUso && aj.primerUso <= sumarDias(anterior, 4) && !enviado(anterior)) return anterior;
  return null;
}

/** Destino del resumen según Ajustes: { tipo: 'whatsapp'|'correo'|'compartir', valor } */
function destinoIvan(aj) {
  const v = (aj.contactoIvan || '').trim();
  if (/\S+@\S+\.\S+/.test(v)) return { tipo: 'correo', valor: v.match(/\S+@\S+\.\S+/)[0] };
  const tel = extraerTelefonos(v)[0];
  if (tel) return { tipo: 'whatsapp', valor: tel };
  return { tipo: 'compartir', valor: '' };
}

export async function abrirResumen(ctx, lunesInicial) {
  const { fecha } = ctx.reloj.ahoraFH();
  const aj0 = datos.obtenerAjustes();
  let lunes = lunesInicial || lunesDe(fecha);
  const minimo = aj0.primerUso ? lunesDe(aj0.primerUso) : lunes;
  const pc = pantallaCompleta({ titulo: 'Resumen semanal', contenido: h('p', {}, 'Calculando…') });

  const pintar = async () => {
    const aj = datos.obtenerAjustes();
    const d = await cargarSemana(ctx, lunes);
    const comercial = aj.nombreComercial || 'Comercial';
    const texto = textoResumenSemanal(d, comercial);
    const destino = destinoIvan(aj);
    const yaEnviado = (aj.resumenesEnviados || []).includes(lunes) || aj.ultimoResumen?.lunes === lunes;
    const etiquetaEnvio = { whatsapp: 'Enviar a Iván por WhatsApp', correo: 'Enviar a Iván por correo', compartir: 'Enviar resumen (elegir a quién)' }[destino.tipo];
    const actual = lunesDe(fecha);
    const titulo = lunes === actual ? 'Esta semana' : lunes === sumarDias(actual, -7) ? 'Semana pasada' : `Semana del ${fechaCorta(lunes)}`;

    pc.poner(h('div', { class: 'resumen-semanal' },
      h('div', { class: 'nav-semana' },
        h('button', { class: 'btn btn-secundario btn-icono', 'aria-label': 'Semana anterior', disabled: lunes <= minimo, onClick: () => { lunes = sumarDias(lunes, -7); pintar(); } }, '‹'),
        h('div', { class: 'nav-semana-titulo' }, h('strong', {}, titulo), h('span', {}, `${fechaCorta(lunes)} – ${fechaCorta(sumarDias(lunes, 4))}`)),
        h('button', { class: 'btn btn-secundario btn-icono', 'aria-label': 'Semana siguiente', disabled: lunes >= actual, onClick: () => { lunes = sumarDias(lunes, 7); pintar(); } }, '›')),
      yaEnviado ? h('p', { class: 'aviso aviso-suave' }, 'Ya enviaste el resumen de esta semana. Puedes volver a mandarlo si quieres.') : null,
      destino.tipo === 'compartir'
        ? h('p', { class: 'texto-ayuda' }, 'No has puesto el WhatsApp o correo de Iván en Ajustes: se abrirá el menú de compartir para elegir a quién mandarlo.')
        : h('p', { class: 'texto-ayuda' }, `Se envía a: ${destino.valor}. Al enviarlo, los cambios para ICG se marcan como enviados.`),
      h('div', { class: 'columna-botones' },
        h('button', { class: 'btn btn-principal btn-ancho', onClick: () => enviarResumen(ctx, d, texto, destino) }, etiquetaEnvio),
        h('button', {
          class: 'btn btn-secundario btn-ancho',
          onClick: async () => {
            try {
              const r = await exportarExcelSemanal(d, comercial);
              if (r === 'descargado') toast('Excel guardado en Descargas', { duracion: 6000 });
            } catch (e) { toast('No se pudo crear el Excel: ' + e.message, { duracion: 7000 }); }
          },
        }, 'Enviar Excel de la semana')),
      h('h3', { class: 'subtitulo-dia' }, 'Así se verá el mensaje'),
      h('pre', { class: 'vista-resumen' }, texto)));
  };
  await pintar();
}

async function enviarResumen(ctx, d, texto, destino) {
  const { fecha, hora } = ctx.reloj.ahoraFH();
  if (destino.tipo === 'whatsapp') {
    abrirEnlace(enlaceWhatsApp(destino.valor, texto));
  } else if (destino.tipo === 'correo') {
    const asunto = `Resumen semana ${fechaCorta(d.lunes)} – ${fechaCorta(d.viernes)} · ${datos.obtenerAjustes().nombreComercial || 'Comercial'}`;
    abrirEnlace(`mailto:${destino.valor}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto.replace(/\*/g, ''))}`);
  } else {
    const r = await compartirTexto(texto, 'Resumen semanal');
    if (r === 'cancelado') return;
    if (r === 'error') { toast('No se pudo compartir ni copiar el texto. Pon el WhatsApp o el correo de Iván en Más → Ajustes.', { duracion: 8000 }); return; }
  }
  // Marcar como enviado: el resumen de esa semana y los cambios para ICG que llevaba
  const aj = datos.obtenerAjustes();
  const anterior = { ultimoResumen: aj.ultimoResumen, resumenesEnviados: aj.resumenesEnviados || [] };
  await datos.guardarAjustes({
    ultimoResumen: { lunes: d.lunes, fecha: `${fecha} ${hora}` },
    resumenesEnviados: [...new Set([...(aj.resumenesEnviados || []), d.lunes])].slice(-60),
  });
  const n = await datos.marcarCambiosEnviados(d.idsCambiosICG, true);
  ctx.refrescar();
  toast(n ? `Resumen marcado como enviado (y ${d.cambiosICG.length} ${d.cambiosICG.length === 1 ? 'cambio' : 'cambios'} para ICG)` : 'Resumen marcado como enviado', {
    duracion: 7000,
    deshacer: async () => {
      await datos.guardarAjustes(anterior);
      await datos.marcarCambiosEnviados(d.idsCambiosICG, false);
      ctx.refrescar();
      toast('Deshecho: el resumen vuelve a estar pendiente');
    },
  });
}

// ---------------------------------------------------------------------
//  Cambios para ICG
// ---------------------------------------------------------------------

export async function contarCambiosICG() {
  return cambiosParaICG({ cambios: await datos.obtenerCambios(), clientes: datos.obtenerClientes({ incluirBorrados: true }) }).filas.length;
}

export async function abrirCambiosICG(ctx) {
  const pc = pantallaCompleta({ titulo: 'Cambios para ICG', contenido: h('p', {}, 'Calculando…') });
  const pintar = async () => {
    const { fecha } = ctx.reloj.ahoraFH();
    const { filas, ids } = cambiosParaICG({ cambios: await datos.obtenerCambios(), clientes: datos.obtenerClientes({ incluirBorrados: true }) });
    pc.poner(h('div', {},
      h('p', { class: 'texto-ayuda' }, 'Datos de clientes que has cambiado en la app (no los que vienen del Excel), para que la oficina los actualice en ICG. Al enviar el resumen semanal se marcan solos como enviados.'),
      filas.length ? h('div', { class: 'columna-botones' },
        h('button', {
          class: 'btn btn-principal btn-ancho',
          onClick: async () => {
            try {
              const r = await exportarCambiosICG(filas, fecha);
              if (r === 'descargado') toast('Excel guardado en Descargas');
            } catch (e) { toast('No se pudo crear el Excel: ' + e.message, { duracion: 7000 }); }
          },
        }, 'Exportar a Excel'),
        h('button', {
          class: 'btn btn-secundario btn-ancho',
          onClick: async () => {
            if (!await confirmar(`¿Marcar los ${filas.length} cambios como enviados? Dejarán de salir aquí y en el resumen.`, { ok: 'Marcar como enviados' })) return;
            await datos.marcarCambiosEnviados(ids, true);
            await pintar();
            toast('Marcados como enviados', {
              deshacer: async () => { await datos.marcarCambiosEnviados(ids, false); await pintar(); toast('Deshecho'); },
            });
          },
        }, 'Marcar como enviados')) : null,
      filas.length
        ? h('div', { class: 'lista-cambios' }, filas.map((x) => h('article', { class: 'fila-cambio' },
          h('div', { class: 'hist-cab' },
            h('strong', {}, x.cliente + (x.codigo ? ` (${x.codigo})` : '')),
            h('span', { class: 'texto-ayuda' }, fechaNormal(x.fecha))),
          x.tipo === 'nuevo'
            ? h('p', {}, h('span', { class: 'chip est-potencial' }, 'Cliente nuevo'), ' ', x.despues)
            : h('p', {}, h('strong', {}, x.campo + ': '), h('span', { class: 'antes' }, x.antes), ' → ', h('span', { class: 'despues' }, x.despues)))))
        : h('p', { class: 'vacio-bloque' }, 'No hay cambios pendientes de enviar.')));
  };
  await pintar();
}

