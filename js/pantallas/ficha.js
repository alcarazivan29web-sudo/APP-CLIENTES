// =====================================================================
//  Ficha del cliente: ver y editar todos sus datos, historial y estado.
// =====================================================================

import * as datos from '../datos.js';
import * as acciones from '../acciones.js';
import {
  clienteVacio, extraerTelefonos, formatearTelefono, estadoEnFecha, fechaNormal, DIAS,
  NOMBRE_SITUACION, horaDeMarca, capitalizarPrimera, diaSemana, analizarHora, lunesDe,
} from '../logica.js';
import { h, pantallaCompleta, confirmar, toast, selectorDias } from '../ui.js';

export function abrirFicha(ctx, id) {
  const esNuevo = !id;
  let pc;
  const pintar = () => {
    const c = esNuevo ? { ...clienteVacio() } : datos.obtenerCliente(id);
    if (!c) { pc?.cerrar(); return; }
    return contenido(ctx, c, esNuevo, () => pc.cerrar(), () => pc.poner(pintar()));
  };
  pc = pantallaCompleta({
    titulo: esNuevo ? 'Nuevo cliente' : 'Ficha del cliente',
    contenido: pintar(),
    alCerrar: () => { ctx.fichaAbierta = null; ctx.refrescar(); },
  });
  // Si otra acción (vacaciones, baja…) cambia el cliente, la ficha se repinta
  if (!esNuevo) ctx.fichaAbierta = () => { const n = pintar(); if (n) pc.poner(n); };
}

function contenido(ctx, c, esNuevo, cerrar, repintar) {
  const { fecha } = ctx.reloj.ahoraFH();
  const est = esNuevo ? 'activo' : estadoEnFecha(c, fecha);

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
  };
  const dias = selectorDias(c.diasLlamada || []);

  const guardar = async () => {
    const nombre = f.nombreComercial.el.value.trim();
    if (!nombre) { toast('El nombre comercial es obligatorio'); f.nombreComercial.el.focus(); return; }
    const nuevosDias = dias.valor();
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
    };
    if (esNuevo || JSON.stringify(nuevosDias) !== JSON.stringify(c.diasLlamada || [])) datosNuevos.diasLlamadaDesde = fecha;
    const r = await datos.guardarCliente(datosNuevos);
    toast(r.sinCambios ? 'No hay cambios' : esNuevo ? 'Cliente añadido' : 'Guardado');
    if (esNuevo) { cerrar(); ctx.abrirFicha(r.nuevo.id); } else repintar();
  };

  // --- Estado ---
  let textoEstado = 'Activo';
  if (est === 'vacaciones') textoEstado = c.vacacionesHasta ? `De vacaciones hasta el ${fechaNormal(c.vacacionesHasta)}` : 'De vacaciones (sin fecha de vuelta)';
  if (est === 'baja') textoEstado = `De baja${c.fechaBaja ? ' desde el ' + fechaNormal(c.fechaBaja) : ''}${c.motivoBaja ? ' · ' + c.motivoBaja : ''}`;
  const saltaEsta = !esNuevo && c.saltarSemana === lunesDe(fecha);
  if (saltaEsta) textoEstado += ' · No sale esta semana (semana que viene)';

  const bloqueEstado = esNuevo ? null : h('section', { class: `ficha-estado est-${est}` },
    h('p', {}, h('strong', {}, 'Estado: '), textoEstado),
    h('div', { class: 'fila-botones envolver' },
      est === 'activo' ? h('button', { class: 'btn btn-secundario btn-peq', onClick: () => acciones.vacaciones(c) }, 'Vacaciones') : null,
      est === 'activo' ? h('button', { class: 'btn btn-secundario btn-peq', onClick: () => acciones.baja(c) }, 'Baja') : null,
      est !== 'activo' ? h('button', { class: 'btn btn-principal btn-peq', onClick: async () => { await acciones.reactivar(c); repintar(); } }, 'Reactivar') : null,
      saltaEsta ? h('button', {
        class: 'btn btn-secundario btn-peq',
        onClick: async () => { await datos.guardarCliente({ ...c, saltarSemana: null }); toast('Vuelve a salir esta semana'); repintar(); },
      }, 'Quitar «semana que viene»') : null));

  const contacto = esNuevo ? null : h('div', { class: 'fila-botones' },
    h('button', { class: 'btn btn-llamar', disabled: !(c.telefonos || []).length, onClick: () => acciones.llamar(c, fecha) }, 'Llamar'),
    h('button', { class: 'btn btn-whatsapp', disabled: !(c.telefonos || []).length, onClick: () => acciones.whatsapp(c, null) }, 'WhatsApp'));

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
    h('section', { class: 'ficha-form' },
      f.nombreComercial.grupo, f.poblacion.grupo, f.contacto.grupo, f.telefonos.grupo,
      h('div', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, 'Días de llamada'), dias.el),
      f.diaCierre.grupo, f.formaPago.grupo, f.horaApertura.grupo, f.notas.grupo,
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
