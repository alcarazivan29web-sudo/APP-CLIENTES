// =====================================================================
//  Ficha del cliente: ver y editar todos sus datos, historial y estado.
// =====================================================================

import * as datos from '../datos.js';
import * as acciones from '../acciones.js';
import {
  clienteVacio, extraerTelefonos, formatearTelefono, estadoEnFecha, fechaNormal, DIAS,
  NOMBRE_SITUACION, horaDeMarca, capitalizarPrimera, diaSemana, analizarHora, lunesDe,
  ORIGENES_PEDIDO, calcularRiesgo, textoRiesgo, fechaCorta, formatearImporte,
  telefonosDe, USOS_TELEFONO, NOMBRES_TELEFONO, faltaPorConfigurar, NOMBRE_DATO, condicionVacia, textoCondicion,
  tituloEncargo, tipoEncargo,
} from '../logica.js';
import { h, hoja, pantallaCompleta, confirmar, toast, selectorDias } from '../ui.js';

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
    diaCierre: campo('Día que cierra', c.diaCierre),
    formaPago: campo('Forma de pago', c.formaPago),
    horaApertura: campo('Hora de apertura', c.horaApertura || '', { tipo: 'time' }),
    llamarDesde: campo('Llamar a partir de', c.llamarDesde || '', { tipo: 'time' }),
    notas: campo('Notas', c.notas, { multilinea: true, filas: 4 }),
    nombreFiscal: campo('Nombre fiscal', c.nombreFiscal),
    zona: campo('Zona / ruta', c.zona),
    codigo: campo('Código (ID del Excel)', c.codigo),
    pideHabitualmente: campo('Pide habitualmente', c.pideHabitualmente, { multilinea: true, filas: 2 }),
    condiciones: campo('Otras condiciones (texto libre)', c.condiciones, { multilinea: true, filas: 2 }),
    cobroImporte: campo('Cobro (€)', c.pendienteCobro?.importe != null
      ? formatearImporte(c.pendienteCobro.importe).replace(' €', '') : '', { inputmode: 'decimal' }),
    cobroNota: campo('Nota del cobro', c.pendienteCobro?.nota || ''),
  };
  f.cobroImporte.el.placeholder = 'Importe €';
  f.cobroNota.el.placeholder = 'Nota (ej.: factura 45)';
  const dias = selectorDias(c.diasLlamada || []);
  const tels = editorTelefonos(telefonosDe(c));
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
    const telefonos = tels.valor();
    if (tels.hayErrores()) { toast('Hay un teléfono que no se entiende. Revísalo (9 cifras, o con + delante si es extranjero).'); return; }
    if (!telefonos.telefonos.length && (esNuevo || (c.telefonos || []).length)) {
      toast('El teléfono es obligatorio');
      tels.enfocar();
      return;
    }
    const nuevosDias = dias.valor();
    if (esNuevo && !nuevosDias.length) {
      const seguir = await confirmar('No le has puesto día de llamada: no te saldrá en la lista de Hoy hasta que se lo pongas.',
        { ok: 'Guardar sin día', cancelar: 'Poner día', titulo: 'Sin día de llamada' });
      if (!seguir) { dias.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    }
    const importeTxt = f.cobroImporte.el.value.trim().replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const importe = importeTxt ? Number(importeTxt) : 0;
    if (importeTxt && (!isFinite(importe) || importe < 0)) { toast('El cobro pendiente tiene que ser un número, por ejemplo 120 o 85,50'); f.cobroImporte.el.focus(); return; }
    const notaCobro = f.cobroNota.el.value.trim();
    const datosNuevos = {
      ...c,
      nombreComercial: nombre,
      poblacion: f.poblacion.el.value.trim(),
      contacto: f.contacto.el.value.trim(),
      telefonos: telefonos.telefonos,
      telefonosInfo: telefonos.info,
      diaCierre: f.diaCierre.el.value.trim(),
      formaPago: f.formaPago.el.value.trim(),
      horaApertura: analizarHora(f.horaApertura.el.value) || null,
      llamarDesde: analizarHora(f.llamarDesde.el.value) || null,
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
  const botonOficina = esNuevo ? null : h('button', {
    class: 'btn btn-oficina btn-ancho', onClick: () => acciones.pedirAOficina(c, { alTerminar: repintar }),
  }, '📌 Pedir a la oficina');
  const encargos = esNuevo ? null : seccionEncargos(c, repintar);
  const recordatorios = esNuevo ? null : seccionRecordatorios(c, fecha);
  const condiciones = esNuevo ? null : seccionCondiciones(ctx, c, fecha, repintar);

  // --- Lo que falta por configurar (cada dato lleva a su campo) ---
  const masCampos = h('details', { class: 'mas-campos' }, h('summary', {}, 'Más datos'), f.nombreFiscal.grupo, f.zona.grupo, f.codigo.grupo,
    c.hojasOrigen ? h('p', { class: 'texto-ayuda' }, `Hojas de origen: ${c.hojasOrigen}`) : null);
  const irA = {
    telefonos: () => tels.enfocar(),
    diasLlamada: () => dias.el.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    contacto: () => f.contacto.el.focus(),
    poblacion: () => f.poblacion.el.focus(),
    formaPago: () => f.formaPago.el.focus(),
    nombreFiscal: () => { masCampos.open = true; f.nombreFiscal.el.focus(); },
  };
  const falta = esNuevo ? null : faltaPorConfigurar(c);
  const bloqueFalta = !falta?.todo.length ? null : h('section', { class: 'falta-config' + (falta.importante.length ? ' importante' : '') },
    h('p', {}, h('strong', {}, 'Falta por configurar'),
      falta.importante.includes('diasLlamada') ? ' · sin día de llamada no sale en Hoy' : ''),
    h('div', { class: 'etiquetas' }, falta.todo.map((k) => h('button', {
      type: 'button', class: 'chip-falta' + (falta.importante.includes(k) ? ' importante' : ''), onClick: () => irA[k]?.(),
    }, NOMBRE_DATO[k]))));

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
    bloqueFalta,
    contacto,
    otrasAcciones,
    botonOficina,
    recordatorios,
    condiciones,
    encargos,
    h('section', { class: 'ficha-form' },
      selTipo ? h('div', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, '¿Es cliente o potencial?'), selTipo) : null,
      f.nombreComercial.grupo,
      h('label', { class: 'casilla-fila' }, importante, ' ★ Importante (sale el primero en la lista)'),
      f.poblacion.grupo, f.contacto.grupo,
      h('div', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, 'Teléfonos *'), tels.el),
      h('div', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, 'Días de llamada'), dias.el),
      f.diaCierre.grupo, f.formaPago.grupo,
      h('div', { class: 'fila-campos dos' }, f.horaApertura.grupo, f.llamarDesde.grupo),
      f.pideHabitualmente.grupo, f.condiciones.grupo,
      h('div', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, 'Cobro pendiente'),
        h('div', { class: 'fila-campos' }, f.cobroImporte.el, f.cobroNota.el)),
      f.notas.grupo,
      masCampos,
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

// ---------------------------------------------------------------------
//  Teléfonos: número + nombre + para qué sirve
// ---------------------------------------------------------------------

let idListaNombres = 0;

/** Editor de teléfonos. valor() → { telefonos: ['600…'], info: { '600…': { nombre, uso } } } */
function editorTelefonos(iniciales) {
  const idLista = `nombres-tel-${++idListaNombres}`;
  const lista = h('div', { class: 'lista-telefonos' });
  const datalist = h('datalist', { id: idLista }, NOMBRES_TELEFONO.map((n) => h('option', { value: n })));
  const filas = [];

  const añadir = (t = { numero: '', nombre: '', uso: 'todo' }, enfocar = false) => {
    const numero = h('input', {
      class: 'campo tel-numero', type: 'tel', inputmode: 'tel', value: t.numero ? formatearTelefono(t.numero) : '',
      placeholder: 'Teléfono', 'aria-label': 'Número de teléfono', autocomplete: 'off',
    });
    const nombre = h('input', {
      class: 'campo tel-nombre', type: 'text', value: t.nombre || '', list: idLista,
      placeholder: 'Nombre (Jefe, Pedidos…)', 'aria-label': 'Nombre del teléfono', autocomplete: 'off',
    });
    const uso = h('select', { class: 'campo tel-uso', 'aria-label': 'Para qué sirve' },
      Object.entries(USOS_TELEFONO).map(([k, txt]) => h('option', { value: k, selected: k === t.uso }, txt)));
    uso.value = t.uso || 'todo';
    const fila = { numero, nombre, uso, el: null };
    fila.el = h('div', { class: 'fila-telefono' },
      numero,
      h('button', {
        type: 'button', class: 'btn-quitar', 'aria-label': 'Quitar este teléfono',
        onClick: () => { filas.splice(filas.indexOf(fila), 1); fila.el.remove(); if (!filas.length) añadir(); },
      }, '✕'),
      nombre, uso);
    filas.push(fila);
    lista.append(fila.el);
    if (enfocar) setTimeout(() => numero.focus(), 50);
  };

  (iniciales.length ? iniciales : [undefined]).forEach((t) => añadir(t));

  const leer = () => filas.map((f) => ({
    texto: f.numero.value.trim(), numeros: extraerTelefonos(f.numero.value), nombre: f.nombre.value.trim(), uso: f.uso.value, fila: f,
  }));

  return {
    el: h('div', {}, lista, datalist,
      h('button', { type: 'button', class: 'btn btn-texto btn-peq', onClick: () => añadir(undefined, true) }, '+ Añadir otro teléfono')),
    valor() {
      const telefonos = [];
      const info = {};
      for (const x of leer()) {
        for (const n of x.numeros) {
          if (telefonos.includes(n)) continue;
          telefonos.push(n);
          if (x.nombre || x.uso !== 'todo') info[n] = { nombre: x.nombre, uso: x.uso };
        }
      }
      return { telefonos, info };
    },
    hayErrores() {
      let mal = false;
      for (const x of leer()) {
        const error = !!x.texto && !x.numeros.length;
        x.fila.numero.classList.toggle('campo-error', error);
        if (error && !mal) { x.fila.numero.focus(); mal = true; }
      }
      return mal;
    },
    enfocar() { filas[0]?.numero.scrollIntoView({ block: 'center', behavior: 'smooth' }); filas[0]?.numero.focus(); },
  };
}

// ---------------------------------------------------------------------
//  Condiciones especiales del cliente
// ---------------------------------------------------------------------

function seccionCondiciones(ctx, c, fecha, repintar) {
  const todas = c.condicionesEspeciales || [];
  const vigentes = todas.filter((x) => !x.hasta || x.hasta >= fecha);
  const caducadas = todas.filter((x) => x.hasta && x.hasta < fecha);
  const fila = (x, caducada = false) => h('button', {
    class: 'fila-condicion' + (caducada ? ' caducada' : ''), onClick: () => editarCondicion(ctx, c, x, repintar),
  },
  h('span', { class: 'fc-producto' }, x.producto || '(sin producto)'),
  h('span', { class: 'fc-condicion' }, x.condicion || ''),
  x.hasta || x.nota ? h('span', { class: 'fc-detalle' },
    [x.hasta ? `${caducada ? 'Caducó' : 'Hasta'} el ${fechaNormal(x.hasta)}` : '', x.nota].filter(Boolean).join(' · ')) : null);
  return h('section', { class: 'ficha-condiciones' },
    h('div', { class: 'cabecera-fila' },
      h('h3', {}, `Condiciones especiales (${vigentes.length})`),
      h('button', { class: 'btn btn-secundario btn-peq', onClick: () => editarCondicion(ctx, c, null, repintar) }, '+ Añadir')),
    vigentes.length ? vigentes.map((x) => fila(x)) : h('p', { class: 'texto-ayuda' },
      'Descuentos o precios solo para este cliente. Salen al llamarle y al apuntar sus pedidos. Las promociones para todos están en «Promos».'),
    caducadas.length ? h('details', {}, h('summary', {}, `Caducadas (${caducadas.length})`), caducadas.map((x) => fila(x, true))) : null);
}

const nuevoIdCondicion = () => (globalThis.crypto?.randomUUID?.() || `cond-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

function editarCondicion(ctx, cliente, condicion, repintar) {
  const { fecha } = ctx.reloj.ahoraFH();
  const x = condicion || condicionVacia();
  const productos = [...new Set(datos.obtenerPromociones().map((p) => p.producto).filter(Boolean))].sort();
  const idLista = 'productos-promos';
  const producto = h('input', { class: 'campo', type: 'text', value: x.producto, list: idLista, placeholder: 'Ej.: Xoringer, Muga Rosado, todo el vino…', autocomplete: 'off' });
  const cond = h('input', { class: 'campo', type: 'text', value: x.condicion, placeholder: 'Ej.: −10 %, a 5,50 €, 6+1, portes gratis…', autocomplete: 'off' });
  const hasta = h('input', { class: 'campo', type: 'date', value: x.hasta || '' });
  const nota = h('textarea', { class: 'campo', rows: 2, placeholder: 'Nota (opcional)' }, x.nota || '');
  const grupo = (etiqueta, el) => h('label', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, etiqueta), el);

  const guardarLista = async (lista, texto) => {
    const actual = datos.obtenerCliente(cliente.id);
    await datos.guardarCliente({ ...actual, condicionesEspeciales: lista });
    toast(texto);
    repintar();
  };

  const p = hoja({
    titulo: condicion ? 'Condición especial' : 'Nueva condición especial',
    contenido: (cerrar) => h('div', {},
      h('p', { class: 'texto-ayuda' }, `Solo para ${cliente.nombreComercial}. La oficina la verá en el resumen del viernes.`),
      grupo('Producto', producto),
      productos.length ? h('datalist', { id: idLista }, productos.map((n) => h('option', { value: n }))) : null,
      grupo('Condición', cond),
      grupo('Hasta (opcional; si no se pone, no caduca)', hasta),
      grupo('Nota', nota),
      h('div', { class: 'columna-botones' },
        h('button', {
          class: 'btn btn-principal btn-ancho',
          onClick: async () => {
            const nueva = {
              ...x, producto: producto.value.trim(), condicion: cond.value.trim(),
              hasta: hasta.value || null, nota: nota.value.trim(),
            };
            if (!nueva.producto && !nueva.condicion) { toast('Pon al menos el producto o la condición'); producto.focus(); return; }
            if (nueva.hasta && nueva.hasta < fecha && !condicion) {
              if (!await confirmar('La fecha «hasta» ya ha pasado: la condición saldrá como caducada. ¿Guardar igualmente?', { ok: 'Guardar' })) return;
            }
            const actual = datos.obtenerCliente(cliente.id)?.condicionesEspeciales || [];
            const lista = condicion
              ? actual.map((y) => (y.id === condicion.id ? nueva : y))
              : [...actual, { ...nueva, id: nuevoIdCondicion(), creada: fecha }];
            cerrar();
            await guardarLista(lista, condicion ? 'Condición guardada' : 'Condición añadida');
          },
        }, 'Guardar'),
        condicion ? h('button', {
          class: 'btn btn-peligro-texto',
          onClick: async () => {
            cerrar();
            const antes = datos.obtenerCliente(cliente.id)?.condicionesEspeciales || [];
            await guardarLista(antes.filter((y) => y.id !== condicion.id), 'Condición borrada');
          },
        }, 'Borrar condición') : null,
        h('button', { class: 'btn btn-texto', onClick: () => cerrar() }, 'Cancelar'))),
  });
  if (!condicion) setTimeout(() => producto.focus(), 250);
  return p;
}

// ---------------------------------------------------------------------
//  Encargos a la oficina de este cliente
// ---------------------------------------------------------------------

function seccionEncargos(c, repintar) {
  const lista = datos.encargosDeCliente(c.id);
  if (!lista.length) return null;
  const fila = (e) => h('button', {
    class: 'fila-encargo',
    onClick: async () => {
      if (!await confirmar(`¿Quitar «${tituloEncargo(e)}» del historial? (A la oficina ya le llegó; esto solo lo borra de la app.)`,
        { ok: 'Quitar', titulo: 'Encargo' })) return;
      await datos.borrarEncargo(e.id);
      toast('Encargo quitado del historial');
      repintar();
    },
  },
  h('span', { class: 'fe-fecha' }, `${capitalizarPrimera(DIAS[diaSemana(e.fecha)]).slice(0, 3)} ${fechaNormal(e.fecha)}`),
  h('span', { class: 'fe-texto' }, `${tipoEncargo(e.tipo).icono} ${tituloEncargo(e)}`),
  e.nota || (e.clienteIds || []).length > 1 ? h('span', { class: 'fe-detalle' },
    [(e.clienteIds || []).length > 1 ? `Junto con ${(e.clienteIds.length - 1)} ${e.clienteIds.length === 2 ? 'cliente más' : 'clientes más'}` : '', e.nota]
      .filter(Boolean).join(' · ')) : null);
  return h('section', { class: 'ficha-encargos' },
    h('h3', {}, `Pedido a la oficina (${lista.length})`),
    lista.slice(0, 5).map(fila),
    lista.length > 5 ? h('details', {}, h('summary', {}, `Ver ${lista.length - 5} más`), lista.slice(5, 60).map(fila)) : null);
}
