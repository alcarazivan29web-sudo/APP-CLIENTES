// =====================================================================
//  Ficha del cliente: ver y editar todos sus datos, historial y estado.
// =====================================================================

import * as datos from '../datos.js';
import * as acciones from '../acciones.js';
import {
  clienteVacio, extraerTelefonos, formatearTelefono, estadoEnFecha, fechaNormal, DIAS,
  NOMBRE_SITUACION, horaDeMarca, capitalizarPrimera, diaSemana, analizarHora, lunesDe,
  ORIGENES_PEDIDO, calcularRiesgo, textoRiesgo, fechaCorta, formatearImporte,
} from '../logica.js';
import { h, pantallaCompleta, confirmar, toast, selectorDias } from '../ui.js';

/** id: cliente a abrir; sin id, cliente nuevo. opciones.potencial: el nuevo empieza como potencial. */
export function abrirFicha(ctx, id, { potencial = false } = {}) {
  const esNuevo = !id;
  let pc;
  const pintar = () => {
    const c = esNuevo ? { ...clienteVacio(), estado: potencial ? 'potencial' : 'activo' } : datos.obtenerCliente(id);
    if (!c) { pc?.cerrar(); return; }
    return contenido(ctx, c, esNuevo, () => pc.cerrar(), () => pc.poner(pintar()));
  };
  pc = pantallaCompleta({
    titulo: esNuevo ? (potencial ? 'Nuevo potencial' : 'Nuevo cliente') : 'Ficha del cliente',
    contenido: pintar(),
    alCerrar: () => { ctx.fichaAbierta = null; ctx.refrescar(); },
  });
  // Si otra acción (vacaciones, baja…) cambia el cliente, la ficha se repinta
  if (!esNuevo) ctx.fichaAbierta = () => { const n = pintar(); if (n) pc.poner(n); };
}

function contenido(ctx, c, esNuevo, cerrar, repintar) {
  const { fecha } = ctx.reloj.ahoraFH();
  const est = esNuevo ? c.estado : estadoEnFecha(c, fecha);

  const campo = (etiqueta, valor, extra = {}) => {
    const el = extra.multilinea
      ? h('textarea', { class: 'campo', rows: extra.filas || 3 }, valor || '')
      : h('input', { class: 'campo', type: extra.tipo || 'text', value: valor || '', inputmode: extra.inputmode });
    return { el, grupo: h('label', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, etiqueta), el) };
  };

  const f = {
    nombreComercial: campo('Nombre comercial *', c.nombreComercial),
    poblacion: campo('Población', c.poblacion),
    contacto: campo('Contacto', c.contacto),
    telefonos: campo('Teléfonos (uno por línea)', (c.telefonos || []).map(formatearTelefono).join('\n'), { multilinea: true, filas: 2 }),
    diaCierre: campo('Día que cierra', c.diaCierre),
    formaPago: campo('Forma de pago', c.formaPago),
    horaApertura: campo('Hora de apertura', c.horaApertura || '', { tipo: 'time' }),
    notas: campo('Notas', c.notas, { multilinea: true, filas: 4 }),
    nombreFiscal: campo('Nombre fiscal', c.nombreFiscal),
    zona: campo('Zona / ruta', c.zona),
    codigo: campo('Código (ID del Excel)', c.codigo),
    pideHabitualmente: campo('Pide habitualmente', c.pideHabitualmente, { multilinea: true, filas: 2 }),
    condiciones: campo('Condiciones (descuentos, precios especiales)', c.condiciones, { multilinea: true, filas: 2 }),
    cobroImporte: campo('Cobro (€)', c.pendienteCobro?.importe != null
      ? formatearImporte(c.pendienteCobro.importe).replace(' €', '') : '', { inputmode: 'decimal' }),
    cobroNota: campo('Nota del cobro', c.pendienteCobro?.nota || ''),
  };
  f.cobroImporte.el.placeholder = 'Importe €';
  f.cobroNota.el.placeholder = 'Nota (ej.: factura 45)';
  const dias = selectorDias(c.diasLlamada || []);
  const importante = h('input', { type: 'checkbox', checked: !!c.importante });
  // En un cliente nuevo se elige si es cliente o potencial
  let tipoNuevo = c.estado === 'potencial' ? 'potencial' : 'activo';
  const selTipo = !esNuevo ? null : h('div', { class: 'segmentado' });
  const pintarTipo = () => selTipo?.replaceChildren(...[['activo', 'Cliente'], ['potencial', 'Potencial']].map(([k, t]) =>
    h('button', { type: 'button', class: 'segmento' + (tipoNuevo === k ? ' activo' : ''), onClick: () => { tipoNuevo = k; pintarTipo(); } }, t)));
  pintarTipo();

  const guardar = async () => {
    const nombre = f.nombreComercial.el.value.trim();
    if (!nombre) { toast('El nombre comercial es obligatorio'); f.nombreComercial.el.focus(); return; }
    const nuevosDias = dias.valor();
    const importeTxt = f.cobroImporte.el.value.trim().replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const importe = importeTxt ? Number(importeTxt) : 0;
    if (importeTxt && (!isFinite(importe) || importe < 0)) { toast('El cobro pendiente tiene que ser un número, por ejemplo 120 o 85,50'); f.cobroImporte.el.focus(); return; }
    const notaCobro = f.cobroNota.el.value.trim();
    const datosNuevos = {
      ...c,
      nombreComercial: nombre,
      poblacion: f.poblacion.el.value.trim(),
      contacto: f.contacto.el.value.trim(),
      telefonos: extraerTelefonos(f.telefonos.el.value.replace(/\n/g, ',')),
      diaCierre: f.diaCierre.el.value.trim(),
      formaPago: f.formaPago.el.value.trim(),
      horaApertura: analizarHora(f.horaApertura.el.value) || null,
      notas: f.notas.el.value.trim(),
      nombreFiscal: f.nombreFiscal.el.value.trim(),
      zona: f.zona.el.value.trim(),
      codigo: f.codigo.el.value.trim(),
      diasLlamada: nuevosDias,
      importante: importante.checked,
      pideHabitualmente: f.pideHabitualmente.el.value.trim(),
      condiciones: f.condiciones.el.value.trim(),
      pendienteCobro: importe > 0 ? { importe: Math.round(importe * 100) / 100, nota: notaCobro } : null,
    };
    if (esNuevo) datosNuevos.estado = tipoNuevo;
    if (esNuevo || JSON.stringify(nuevosDias) !== JSON.stringify(c.diasLlamada || [])) datosNuevos.diasLlamadaDesde = fecha;
    const r = await datos.guardarCliente(datosNuevos);
    toast(r.sinCambios ? 'No hay cambios' : esNuevo ? (tipoNuevo === 'potencial' ? 'Potencial añadido' : 'Cliente añadido') : 'Guardado');
    if (esNuevo) { cerrar(); ctx.abrirFicha(r.nuevo.id); } else repintar();
  };

  // --- Estado ---
  let textoEstado = 'Activo';
  if (est === 'vacaciones') textoEstado = c.vacacionesHasta ? `De vacaciones hasta el ${fechaNormal(c.vacacionesHasta)}` : 'De vacaciones (sin fecha de vuelta)';
  if (est === 'baja') textoEstado = `De baja${c.fechaBaja ? ' desde el ' + fechaNormal(c.fechaBaja) : ''}${c.motivoBaja ? ' · ' + c.motivoBaja : ''}`;
  const saltaEsta = !esNuevo && c.saltarSemana === lunesDe(fecha);
  if (est === 'potencial') textoEstado = 'Potencial (todavía no es cliente). Si tiene día de llamada, sale en «Captación».';
  if (saltaEsta) textoEstado += ' · No sale esta semana (semana que viene)';
  const aj = datos.obtenerAjustes();
  const riesgo = esNuevo ? null : calcularRiesgo({
    clientes: [c], llamadas: datos.llamadasDeCliente(c.id), fecha, primerUso: aj.primerUso, semanas: aj.semanasRiesgo,
  }).get(c.id);
  if (riesgo != null) textoEstado += ` · ${textoRiesgo(riesgo)}`;

  const bloqueEstado = esNuevo ? null : h('section', { class: `ficha-estado est-${est}` },
    h('p', {}, h('strong', {}, 'Estado: '), textoEstado),
    h('div', { class: 'fila-botones envolver' },
      est === 'activo' ? h('button', { class: 'btn btn-secundario btn-peq', onClick: () => acciones.vacaciones(c) }, 'Vacaciones') : null,
      est === 'activo' ? h('button', { class: 'btn btn-secundario btn-peq', onClick: () => acciones.baja(c) }, 'Baja') : null,
      est === 'potencial' ? h('button', { class: 'btn btn-principal btn-peq', onClick: async () => { await acciones.pasarACliente(c); repintar(); } }, 'Pasar a cliente') : null,
      est === 'potencial' ? h('button', { class: 'btn btn-secundario btn-peq', onClick: () => acciones.baja(c) }, 'Descartar (baja)') : null,
      est === 'vacaciones' || est === 'baja' ? h('button', { class: 'btn btn-principal btn-peq', onClick: async () => { await acciones.reactivar(c); repintar(); } }, 'Reactivar') : null,
      saltaEsta ? h('button', {
        class: 'btn btn-secundario btn-peq',
        onClick: async () => { await datos.guardarCliente({ ...c, saltarSemana: null }); toast('Vuelve a salir esta semana'); repintar(); },
      }, 'Quitar «semana que viene»') : null));

  const contacto = esNuevo ? null : h('div', { class: 'fila-botones' },
    h('button', { class: 'btn btn-llamar', disabled: !(c.telefonos || []).length, onClick: () => acciones.llamar(c, fecha) }, 'Llamar'),
    h('button', { class: 'btn btn-whatsapp', disabled: !(c.telefonos || []).length, onClick: () => acciones.whatsapp(c, null) }, 'WhatsApp'));
  const otrasAcciones = esNuevo ? null : h('div', { class: 'fila-botones' },
    h('button', { class: 'btn btn-secundario', onClick: () => acciones.registrarPedido(c) }, 'Registrar pedido'),
    h('button', { class: 'btn btn-secundario', onClick: () => acciones.editarRecordatorio({ cliente: c }) }, '+ Recordatorio'));
  const recordatorios = esNuevo ? null : seccionRecordatorios(c, fecha);

  const historial = esNuevo ? null : seccionHistorial(c);

  const borrar = esNuevo ? null : h('section', { class: 'zona-peligro' },
    h('button', {
      class: 'btn btn-peligro-texto',
      onClick: async () => {
        if (!await confirmar(`¿Borrar a ${c.nombreComercial}? Desaparecerá de la app.`, { ok: 'Borrar', peligro: true })) return;
        if (!await confirmar('¿Seguro del todo? Si solo ya no es cliente, usa «Baja» en su lugar.', { ok: 'Sí, borrar', peligro: true })) return;
        await datos.borrarCliente(c.id);
        cerrar();
        toast('Cliente borrado');
      },
    }, 'Borrar cliente'));

  return h('div', { class: 'ficha' },
    h('h2', { class: 'ficha-nombre' }, c.nombreComercial || 'Nuevo cliente'),
    bloqueEstado,
    contacto,
    otrasAcciones,
    recordatorios,
    h('section', { class: 'ficha-form' },
      selTipo ? h('div', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, '¿Es cliente o potencial?'), selTipo) : null,
      f.nombreComercial.grupo,
      h('label', { class: 'casilla-fila' }, importante, ' ★ Importante (sale el primero en la lista)'),
      f.poblacion.grupo, f.contacto.grupo, f.telefonos.grupo,
      h('div', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, 'Días de llamada'), dias.el),
      f.diaCierre.grupo, f.formaPago.grupo, f.horaApertura.grupo,
      f.pideHabitualmente.grupo, f.condiciones.grupo,
      h('div', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, 'Cobro pendiente'),
        h('div', { class: 'fila-campos' }, f.cobroImporte.el, f.cobroNota.el)),
      f.notas.grupo,
      h('details', { class: 'mas-campos' }, h('summary', {}, 'Más datos'), f.nombreFiscal.grupo, f.zona.grupo, f.codigo.grupo,
        c.hojasOrigen ? h('p', { class: 'texto-ayuda' }, `Hojas de origen: ${c.hojasOrigen}`) : null),
      h('button', { class: 'btn btn-principal btn-ancho btn-guardar', onClick: guardar }, esNuevo ? 'Añadir cliente' : 'Guardar cambios')),
    historial,
    borrar);
}

function seccionHistorial(c) {
  const regs = datos.llamadasDeCliente(c.id).filter((r) => r.intentos?.length || r.resultado);
  return h('section', { class: 'historial' },
    h('h3', {}, `Historial (${regs.length})`),
    regs.length ? null : h('p', { class: 'vacio-bloque' }, 'Todavía no hay llamadas apuntadas.'),
    regs.slice(0, 60).map((r) => {
      const sit = r.resultado ? NOMBRE_SITUACION[r.resultado] : (r.volverALlamarDesde ? 'Más tarde' : 'Sin resultado');
      const cuando = `${capitalizarPrimera(DIAS[diaSemana(r.fechaPrevista)]).slice(0, 3)} ${fechaNormal(r.fechaPrevista)}`;
      return h('article', { class: 'hist-item' },
        h('div', { class: 'hist-cab' },
          h('strong', {}, cuando),
          ORIGENES_PEDIDO[r.origen] ? h('span', { class: 'chip sit-por_llamar' }, ORIGENES_PEDIDO[r.origen]) : null,
          h('span', { class: `chip sit-${r.resultado || 'pendiente'}` }, sit)),
        r.fecha && r.fecha !== r.fechaPrevista ? h('p', { class: 'texto-ayuda' }, `Apuntado el ${fechaNormal(r.fecha)}`) : null,
        r.pedido ? h('p', { class: 'hist-pedido' }, r.pedido) : null,
        r.resultado === 'pide' ? h('p', { class: 'texto-ayuda' },
          r.enviadoOficina ? `Enviado a oficina${r.horaEnviadoOficina ? ' · ' + (horaDeMarca(r.horaEnviadoOficina.replace(' ', 'T')) || r.horaEnviadoOficina) : ''}` : 'No enviado a oficina') : null,
        r.nota ? h('p', {}, r.nota) : null,
        r.intentos?.length ? h('p', { class: 'texto-ayuda' }, 'Intentos: ' + r.intentos.map((i) =>
          `${i.hora} ${NOMBRE_SITUACION[i.resultado] || i.resultado}${i.volverA ? ' (' + i.volverA + ')' : ''}${i.whatsapp ? ' + WhatsApp' : ''}`).join(' · ')) : null);
    }));
}

function seccionRecordatorios(c, fecha) {
  const recs = datos.recordatoriosDeCliente(c.id);
  const pendientes = recs.filter((r) => !r.hecho);
  const hechos = recs.filter((r) => r.hecho);
  if (!recs.length) return null;
  const fila = (r) => h('button', { class: 'fila-recordatorio' + (r.hecho ? ' hecho' : ''), onClick: () => acciones.opcionesRecordatorio(r) },
    h('span', { class: 'fr-fecha' + (!r.hecho && r.fecha < fecha ? ' vencido' : '') }, capitalizarPrimera(DIAS[diaSemana(r.fecha)]).slice(0, 3) + ' ' + fechaCorta(r.fecha)),
    h('span', { class: 'fr-texto' }, (r.hecho ? '✓ ' : '') + r.texto));
  return h('section', { class: 'ficha-recordatorios' },
    h('h3', {}, `Recordatorios (${pendientes.length})`),
    pendientes.map(fila),
    hechos.length ? h('details', {}, h('summary', {}, `Hechos (${hechos.length})`), hechos.slice(0, 30).map(fila)) : null);
}
