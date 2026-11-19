// =====================================================================
//  acciones.js · Acciones sobre un cliente que se usan desde varias
//  pantallas: llamar, WhatsApp, preguntar el resultado, más tarde,
//  semana que viene, vacaciones, baja…
// =====================================================================

import * as datos from './datos.js';
import {
  aplicarAccion, nuevoRegistro, mensajePedido, rellenarPlantilla, enlaceWhatsApp, telefonoInternacional,
  formatearTelefono, sumarMinutos, lunesDe, resumenNoContesta, fechaNormal, sumarDias, deshacerUltimaAccion,
  ORIGENES_PEDIDO, recordatorioVacio, coincideBusqueda, telefonosPara, USOS_TELEFONO,
  condicionesVigentes, textoCondicion, ultimoPedidoConTexto,
} from './logica.js';
import { h, hoja, toast, abrirEnlace, compartirTexto, confirmar } from './ui.js';

const CLAVE_LLAMADA = 'llamadaEnCurso';
let ctx = null; // { reloj, refrescar, abrirFicha }

export function configurar(contexto) { ctx = contexto; }

const ahoraFH = () => ctx.reloj.ahoraFH();

// ---------------------------------------------------------------------
//  Teléfonos
// ---------------------------------------------------------------------

/** Elige el teléfono para 'llamar' o 'whatsapp'. Si solo hay uno que sirva, lo usa
 *  directamente; si hay varios, pregunta mostrando el nombre de cada uno.
 *  Devuelve el número o null. */
function elegirTelefono(cliente, para) {
  const tels = telefonosPara(cliente, para);
  if (!tels.length) { toast('Este cliente no tiene teléfono. Añádelo en su ficha.'); return Promise.resolve(null); }
  if (tels.length === 1) return Promise.resolve(tels[0].numero);
  return new Promise((resolver) => {
    let elegido = null;
    hoja({
      titulo: para === 'whatsapp' ? '¿A qué WhatsApp escribes?' : '¿A qué número llamas?',
      alCerrar: () => resolver(elegido),
      contenido: (cerrar) => h('div', { class: 'lista-botones' },
        tels.map((t) => h('button', {
          class: 'btn btn-secundario btn-ancho btn-telefono',
          onClick: () => { elegido = t.numero; cerrar(); },
        },
        h('span', { class: 'bt-nombre' }, t.nombre || 'Sin nombre'),
        h('span', { class: 'bt-numero' }, formatearTelefono(t.numero) + (t.uso !== 'todo' ? ` · ${USOS_TELEFONO[t.uso].toLowerCase()}` : ''))))),
    });
  });
}

// ---------------------------------------------------------------------
//  Llamar y preguntar el resultado al volver
// ---------------------------------------------------------------------

export async function llamar(cliente, fechaPrevista) {
  const tel = await elegirTelefono(cliente, 'llamar');
  if (!tel) return;
  try {
    localStorage.setItem(CLAVE_LLAMADA, JSON.stringify({
      clienteId: cliente.id, fechaPrevista, momento: ctx.reloj.ahora().getTime(), real: Date.now(),
    }));
  } catch { /* sin almacenamiento local: no se podrá preguntar al volver */ }
  abrirEnlace('tel:' + telefonoInternacional(tel));
}

/** Se llama al volver a la app. Si hay una llamada pendiente de apuntar, abre el panel.
 *  alRecargar: solo si han pasado menos de 30 minutos. */
export function revisarLlamadaEnCurso({ alRecargar = false } = {}) {
  let info = null;
  try { info = JSON.parse(localStorage.getItem(CLAVE_LLAMADA) || 'null'); } catch { info = null; }
  if (!info) return;
  if (alRecargar && Date.now() - info.real > 30 * 60 * 1000) { localStorage.removeItem(CLAVE_LLAMADA); return; }
  localStorage.removeItem(CLAVE_LLAMADA);
  const cliente = datos.obtenerCliente(info.clienteId);
  if (!cliente) return;
  preguntarResultado(cliente, info.fechaPrevista);
}

export async function whatsapp(cliente, fechaPrevista) {
  const tel = await elegirTelefono(cliente, 'whatsapp');
  if (!tel) return;
  const reg = fechaPrevista ? datos.registroDe(cliente.id, fechaPrevista) : null;
  let texto = '';
  if (reg?.resultado === 'no_contesta') {
    texto = textoNoContesta(cliente);
    await registrar(cliente, fechaPrevista, { tipo: 'whatsapp' });
  }
  abrirEnlace(enlaceWhatsApp(tel, texto));
}

function textoNoContesta(cliente) {
  const aj = datos.obtenerAjustes();
  return rellenarPlantilla(aj.plantillas.noContesta, { cliente, comercial: aj.nombreComercial, fecha: ahoraFH().fecha });
}

/** Guarda una acción en el registro del cliente para ese día. Devuelve una función para deshacer. */
async function registrar(cliente, fechaPrevista, accion, origen = 'llamada') {
  const { fecha, hora } = ahoraFH();
  const actual = datos.registroDe(cliente.id, fechaPrevista);
  const base = actual || nuevoRegistro(cliente.id, fechaPrevista, fecha, origen);
  const r = await datos.registrarLlamada(aplicarAccion(base, accion, { fecha, hora }));
  return { registro: r.nuevo, deshacer: () => datos.restaurar('llamadas', actual, r.nuevo.id) };
}

function avisoConDeshacer(texto, deshacer) {
  ctx.refrescar();
  toast(texto, { deshacer: async () => { await deshacer(); ctx.refrescar(); toast('Deshecho'); } });
}

const nombreCorto = (c) => c.nombreComercial;

/** Ayudas al apuntar un pedido: condiciones del cliente, lo que suele pedir y
 *  «Repetir último pedido». `excluirId`: el registro que se está editando. */
function ayudasPedido(cliente, area, excluirId = null) {
  const { fecha } = ahoraFH();
  const c = datos.obtenerCliente(cliente.id) || cliente;
  const conds = condicionesVigentes(c, fecha);
  const ultimo = ultimoPedidoConTexto(datos.llamadasDeCliente(c.id).filter((r) => r.id !== excluirId));
  if (!conds.length && !c.pideHabitualmente && !ultimo) return null;
  return h('div', { class: 'ayudas-pedido' },
    conds.length ? h('div', { class: 'caja-condiciones' },
      h('strong', {}, 'Condiciones de este cliente'),
      h('ul', {}, conds.map((x) => h('li', {}, textoCondicion(x) + (x.nota ? ` · ${x.nota}` : ''))))) : null,
    c.pideHabitualmente ? h('p', { class: 'texto-ayuda' }, h('strong', {}, 'Suele pedir: '), c.pideHabitualmente) : null,
    ultimo ? h('button', {
      type: 'button', class: 'btn btn-secundario btn-ancho btn-repetir',
      onClick: () => {
        area.value = area.value.trim() ? `${area.value.trim()}\n${ultimo.pedido.trim()}` : ultimo.pedido.trim();
        area.focus();
      },
    }, `↻ Repetir último pedido (${fechaNormal(ultimo.fecha || ultimo.fechaPrevista)})`) : null,
    ultimo ? h('p', { class: 'texto-ayuda ultimo-pedido' }, ultimo.pedido.trim()) : null);
}

/** Panel «¿Cómo ha ido con …?» */
export function preguntarResultado(cliente, fechaPrevista) {
  const panel = hoja({ titulo: `¿Cómo ha ido con ${nombreCorto(cliente)}?` });

  const inicio = () => h('div', { class: 'opciones-resultado' },
    h('button', { class: 'btn btn-pide', onClick: () => panel.poner(formPide()) }, 'Pide'),
    h('button', { class: 'btn btn-nopide', onClick: () => panel.poner(formNoPide()) }, 'No pide'),
    h('button', { class: 'btn btn-nocontesta', onClick: noContesta }, 'No contesta'),
    h('button', { class: 'btn btn-secundario', onClick: () => panel.poner(formMasTarde()) }, 'Volver a llamar más tarde'),
    h('button', { class: 'btn btn-texto', onClick: () => panel.cerrar() }, 'Ahora no'),
  );

  const formPide = () => {
    const area = h('textarea', { class: 'campo', rows: 5, placeholder: 'Qué ha pedido (opcional)' });
    setTimeout(() => area.focus(), 200);
    return h('div', {},
      ayudasPedido(cliente, area, datos.registroDe(cliente.id, fechaPrevista)?.id),
      h('label', { class: 'etiqueta-campo' }, '¿Qué ha pedido?'),
      area,
      h('div', { class: 'columna-botones' },
        h('button', { class: 'btn btn-principal btn-ancho', onClick: () => guardarPide(area.value, true) }, 'Guardar y enviar a oficina'),
        h('button', { class: 'btn btn-secundario btn-ancho', onClick: () => guardarPide(area.value, false) }, 'Guardar'),
        h('button', { class: 'btn btn-texto', onClick: () => panel.poner(inicio()) }, '‹ Atrás')));
  };

  const guardarPide = async (pedido, enviar) => {
    panel.cerrar();
    const { registro, deshacer } = await registrar(cliente, fechaPrevista, { tipo: 'pide', pedido });
    if (enviar) await enviarAOficina(cliente, registro);
    avisoConDeshacer(`Pedido apuntado · ${nombreCorto(cliente)}`, deshacer);
    await preguntarPasarACliente(cliente);
  };

  const formNoPide = () => {
    const area = h('textarea', { class: 'campo', rows: 3, placeholder: 'Nota (opcional)' });
    return h('div', {},
      h('label', { class: 'etiqueta-campo' }, 'Nota (opcional)'),
      area,
      h('div', { class: 'columna-botones' },
        h('button', {
          class: 'btn btn-principal btn-ancho',
          onClick: async () => {
            panel.cerrar();
            const { deshacer } = await registrar(cliente, fechaPrevista, { tipo: 'no_pide', nota: area.value });
            avisoConDeshacer(`No pide · ${nombreCorto(cliente)}`, deshacer);
          },
        }, 'Guardar'),
        h('button', { class: 'btn btn-texto', onClick: () => panel.poner(inicio()) }, '‹ Atrás')));
  };

  const noContesta = async () => {
    const { registro, deshacer } = await registrar(cliente, fechaPrevista, { tipo: 'no_contesta' });
    ctx.refrescar();
    const nc = resumenNoContesta(registro);
    panel.titulo(`No contesta · ${nombreCorto(cliente)}`);
    panel.poner(h('div', {},
      h('p', { class: 'texto-info' }, `Apuntado. Lleva ${nc.veces} ${nc.veces === 1 ? 'intento' : 'intentos'} y sigue en la lista.`),
      h('div', { class: 'columna-botones' },
        (cliente.telefonos || []).length
          ? h('button', {
            class: 'btn btn-whatsapp btn-ancho',
            onClick: async () => { panel.cerrar(); await whatsapp(cliente, fechaPrevista); ctx.refrescar(); },
          }, 'Enviar WhatsApp')
          : null,
        h('button', {
          class: 'btn btn-secundario btn-ancho',
          onClick: async () => { panel.cerrar(); await deshacer(); ctx.refrescar(); toast('Deshecho'); },
        }, 'Deshacer'),
        h('button', { class: 'btn btn-texto', onClick: () => panel.cerrar() }, 'Cerrar'))));
  };

  const formMasTarde = () => opcionesMasTarde(async (horaElegida) => {
    panel.cerrar();
    const { deshacer } = await registrar(cliente, fechaPrevista, { tipo: 'mas_tarde', hora: horaElegida });
    avisoConDeshacer(`Volver a llamar a las ${horaElegida}`, deshacer);
  }, () => panel.poner(inicio()));

  panel.poner(inicio());
}

/** Botones rápidos para «más tarde». */
function opcionesMasTarde(alElegir, atras) {
  const { hora } = ahoraFH();
  const campo = h('input', { class: 'campo', type: 'time', value: sumarMinutos(hora, 60) });
  const opciones = [
    ['+1 hora', sumarMinutos(hora, 60)],
    ['+2 horas', sumarMinutos(hora, 120)],
    ['13:00', '13:00'],
    ['17:00', '17:00'],
  ];
  return h('div', {},
    h('p', { class: 'texto-info' }, '¿A partir de qué hora le vuelves a llamar?'),
    h('div', { class: 'rejilla-botones' },
      opciones.map(([t, v]) => h('button', { class: 'btn btn-secundario', onClick: () => alElegir(v) },
        t.startsWith('+') ? `${t} (${v})` : t))),
    h('label', { class: 'etiqueta-campo' }, 'Elegir hora'),
    h('div', { class: 'fila-botones' }, campo,
      h('button', { class: 'btn btn-principal', onClick: () => campo.value && alElegir(campo.value) }, 'OK')),
    atras ? h('button', { class: 'btn btn-texto', onClick: atras }, '‹ Atrás') : null);
}

export function masTarde(cliente, fechaPrevista) {
  const p = hoja({ titulo: `Más tarde · ${nombreCorto(cliente)}` });
  p.poner(opcionesMasTarde(async (horaElegida) => {
    p.cerrar();
    const { deshacer } = await registrar(cliente, fechaPrevista, { tipo: 'mas_tarde', hora: horaElegida });
    avisoConDeshacer(`Volver a llamar a las ${horaElegida}`, deshacer);
  }));
}

// ---------------------------------------------------------------------
//  Enviar pedido a la oficina
// ---------------------------------------------------------------------

export async function enviarAOficina(cliente, registro) {
  const aj = datos.obtenerAjustes();
  const { fecha, hora } = ahoraFH();
  const texto = mensajePedido({ cliente, pedido: registro.pedido, comercial: aj.nombreComercial, fecha, hora });
  if (aj.whatsappOficina) {
    abrirEnlace(enlaceWhatsApp(aj.whatsappOficina.replace(/\s/g, ''), texto));
  } else {
    const r = await compartirTexto(texto, 'Pedido');
    if (r === 'cancelado' || r === 'error') return false;
  }
  const actual = datos.registroDe(cliente.id, registro.fechaPrevista) || registro;
  await datos.registrarLlamada(aplicarAccion(actual, { tipo: 'enviado_oficina', marca: `${fecha} ${hora}` }, { fecha, hora }));
  ctx.refrescar();
  return true;
}

// ---------------------------------------------------------------------
//  Estados: semana que viene, vacaciones, baja, reactivar
// ---------------------------------------------------------------------

async function cambiarCliente(cliente, cambios, texto) {
  const r = await datos.guardarCliente({ ...cliente, ...cambios });
  avisoConDeshacer(texto, () => datos.restaurar('clientes', r.anterior, r.nuevo.id));
  return r.nuevo;
}

export function semanaQueViene(cliente) {
  const { fecha } = ahoraFH();
  return cambiarCliente(cliente, { saltarSemana: lunesDe(fecha) },
    `${nombreCorto(cliente)} no saldrá hasta la semana que viene`);
}

export function vacaciones(cliente) {
  const { fecha } = ahoraFH();
  const campo = h('input', { class: 'campo', type: 'date', min: sumarDias(fecha, 1) });
  const p = hoja({
    titulo: `Vacaciones · ${nombreCorto(cliente)}`,
    contenido: (cerrar) => h('div', {},
      h('label', { class: 'etiqueta-campo' }, '¿Cuándo vuelve? (opcional)'),
      campo,
      h('p', { class: 'texto-ayuda' }, 'Con fecha, volverá a salir solo ese día. Sin fecha, no saldrá hasta que lo reactives desde su ficha.'),
      h('div', { class: 'fila-botones' },
        h('button', { class: 'btn btn-secundario', onClick: () => cerrar() }, 'Cancelar'),
        h('button', {
          class: 'btn btn-principal',
          onClick: async () => {
            cerrar();
            const hasta = campo.value || null;
            await cambiarCliente(cliente, { estado: 'vacaciones', vacacionesDesde: fecha, vacacionesHasta: hasta },
              hasta ? `De vacaciones hasta el ${fechaNormal(hasta)}` : 'De vacaciones (sin fecha de vuelta)');
          },
        }, 'Guardar'))),
  });
  return p;
}

export function baja(cliente) {
  const { fecha } = ahoraFH();
  const area = h('textarea', { class: 'campo', rows: 3, placeholder: 'Ej.: ha cerrado, se va con otro distribuidor…' });
  hoja({
    titulo: `Dar de baja · ${nombreCorto(cliente)}`,
    contenido: (cerrar) => h('div', {},
      h('label', { class: 'etiqueta-campo' }, 'Motivo'),
      area,
      h('p', { class: 'texto-ayuda' }, 'El cliente deja de salir, pero no se borra. Puedes reactivarlo desde su ficha.'),
      h('div', { class: 'fila-botones' },
        h('button', { class: 'btn btn-secundario', onClick: () => cerrar() }, 'Cancelar'),
        h('button', {
          class: 'btn btn-peligro',
          onClick: async () => {
            cerrar();
            await cambiarCliente(cliente, { estado: 'baja', fechaBaja: fecha, motivoBaja: area.value.trim() },
              `${nombreCorto(cliente)} dado de baja`);
          },
        }, 'Dar de baja'))),
  });
}

/** Potencial → cliente. */
export function pasarACliente(cliente) {
  return cambiarCliente(cliente, { estado: 'activo' }, `${nombreCorto(cliente)} ya es cliente`);
}

/** Si un potencial hace un pedido, pregunta si pasa a ser cliente. */
async function preguntarPasarACliente(cliente) {
  const c = datos.obtenerCliente(cliente.id);
  if (!c || c.estado !== 'potencial') return;
  const ok = await confirmar(`${nombreCorto(c)} te ha hecho un pedido. ¿Pasa a ser cliente?`,
    { ok: 'Pasar a cliente', cancelar: 'Sigue como potencial', titulo: '¿Pasar a cliente?' });
  if (ok) await pasarACliente(c);
}

export function reactivar(cliente) {
  const { fecha } = ahoraFH();
  const cambios = { estado: 'activo', fechaBaja: null, motivoBaja: '' };
  // Si estaba de vacaciones, sus vacaciones terminan hoy
  if (cliente.vacacionesDesde && (!cliente.vacacionesHasta || cliente.vacacionesHasta > fecha)) cambios.vacacionesHasta = fecha;
  return cambiarCliente(cliente, cambios, `${nombreCorto(cliente)} vuelve a estar activo`);
}

// ---------------------------------------------------------------------
//  Registrar un pedido fuera de su día (el cliente llama, WhatsApp, visita)
// ---------------------------------------------------------------------

export function registrarPedido(cliente) {
  let origen = 'cliente_llama';
  const botonesOrigen = h('div', { class: 'segmentado', role: 'radiogroup' });
  const pintarOrigen = () => botonesOrigen.replaceChildren(...Object.entries(ORIGENES_PEDIDO).map(([k, t]) =>
    h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(k === origen),
      class: 'segmento' + (k === origen ? ' activo' : ''),
      onClick: () => { origen = k; pintarOrigen(); },
    }, t)));
  pintarOrigen();
  const area = h('textarea', { class: 'campo', rows: 5, placeholder: 'Qué ha pedido (opcional)' });
  const p = hoja({
    titulo: `Registrar pedido · ${nombreCorto(cliente)}`,
    contenido: () => h('div', {},
      h('span', { class: 'etiqueta-campo' }, '¿Cómo te ha llegado?'),
      botonesOrigen,
      ayudasPedido(cliente, area, datos.registroDe(cliente.id, ahoraFH().fecha)?.id),
      h('label', { class: 'etiqueta-campo' }, '¿Qué ha pedido?'),
      area,
      h('p', { class: 'texto-ayuda' }, 'Este cliente ya no saldrá para llamar en lo que queda de semana.'),
      h('div', { class: 'columna-botones' },
        h('button', { class: 'btn btn-principal btn-ancho', onClick: () => guardarPedido(true) }, 'Guardar y enviar a oficina'),
        h('button', { class: 'btn btn-secundario btn-ancho', onClick: () => guardarPedido(false) }, 'Guardar'),
        h('button', { class: 'btn btn-texto', onClick: () => p.cerrar() }, 'Cancelar'))),
  });
  setTimeout(() => area.focus(), 250);

  async function guardarPedido(enviar) {
    p.cerrar();
    const { fecha, hora } = ahoraFH();
    const actual = datos.registroDe(cliente.id, fecha);
    let pedido = area.value.trim();
    // Si ya había un pedido apuntado hoy, se añade al anterior en vez de perderlo
    if (actual?.resultado === 'pide' && actual.pedido) pedido = pedido ? `${actual.pedido}\n${pedido}` : actual.pedido;
    const base = actual ? { ...actual, origen } : nuevoRegistro(cliente.id, fecha, fecha, origen);
    const r = await datos.registrarLlamada(aplicarAccion(base, { tipo: 'pide', pedido }, { fecha, hora }));
    if (enviar) await enviarAOficina(cliente, r.nuevo);
    avisoConDeshacer(`Pedido apuntado · ${nombreCorto(cliente)}`, () => datos.restaurar('llamadas', actual, r.nuevo.id));
    await preguntarPasarACliente(cliente);
  }
}

// ---------------------------------------------------------------------
//  Recordatorios
// ---------------------------------------------------------------------

/** Crear (sin `recordatorio`) o editar un recordatorio.
 *  cliente: el cliente al que va asociado (opcional). elegirCliente: mostrar el buscador. */
export function editarRecordatorio({ recordatorio = null, cliente = null, elegirCliente = false } = {}) {
  const { fecha } = ahoraFH();
  let clienteSel = cliente || (recordatorio?.clienteId ? datos.obtenerCliente(recordatorio.clienteId) : null);
  const texto = h('textarea', { class: 'campo', rows: 3, placeholder: 'Ej.: Llevar muestras de Muga Rosado' }, recordatorio?.texto || '');
  const campoFecha = h('input', { class: 'campo', type: 'date', value: recordatorio?.fecha || fecha });
  const rapidas = h('div', { class: 'rejilla-botones' },
    [['Hoy', fecha], ['Mañana', sumarDias(fecha, 1)], ['El lunes', sumarDias(lunesDe(fecha), 7)], ['En una semana', sumarDias(fecha, 7)]]
      .map(([t, v]) => h('button', { type: 'button', class: 'btn btn-secundario btn-peq', onClick: () => { campoFecha.value = v; } }, t)));

  const zonaCliente = h('div', {});
  const pintarCliente = () => {
    if (!elegirCliente && !recordatorio) { zonaCliente.replaceChildren(); return; }
    if (clienteSel) {
      zonaCliente.replaceChildren(h('div', { class: 'cliente-elegido' },
        h('span', {}, `Cliente: ${clienteSel.nombreComercial}`),
        h('button', { type: 'button', class: 'btn btn-texto btn-peq', onClick: () => { clienteSel = null; pintarCliente(); } }, 'Quitar')));
      return;
    }
    const buscar = h('input', { class: 'campo', type: 'search', placeholder: 'Buscar cliente (opcional)' });
    const resultados = h('div', { class: 'resultados-busqueda' });
    buscar.addEventListener('input', () => {
      const q = buscar.value.trim();
      const encontrados = q.length < 2 ? [] : datos.obtenerClientes().filter((c) => coincideBusqueda(c, q)).slice(0, 6);
      resultados.replaceChildren(...encontrados.map((c) => h('button', {
        type: 'button', class: 'resultado-cliente',
        onClick: () => { clienteSel = c; pintarCliente(); },
      }, c.nombreComercial, c.poblacion ? h('small', {}, ' · ' + c.poblacion) : null)));
    });
    zonaCliente.replaceChildren(h('span', { class: 'etiqueta-campo' }, 'Cliente (opcional)'), buscar, resultados);
  };
  pintarCliente();

  const titulo = recordatorio ? 'Editar recordatorio' : `Recordatorio${clienteSel && !elegirCliente ? ' · ' + nombreCorto(clienteSel) : ''}`;
  const p = hoja({
    titulo,
    contenido: () => h('div', {},
      h('label', { class: 'etiqueta-campo' }, '¿Qué tienes que hacer?'), texto,
      h('label', { class: 'etiqueta-campo' }, '¿Qué día?'), campoFecha, rapidas,
      zonaCliente,
      h('div', { class: 'fila-botones' },
        h('button', { class: 'btn btn-secundario', onClick: () => p.cerrar() }, 'Cancelar'),
        h('button', {
          class: 'btn btn-principal',
          onClick: async () => {
            const t = texto.value.trim();
            if (!t) { toast('Escribe el recordatorio'); texto.focus(); return; }
            const f = campoFecha.value || fecha;
            p.cerrar();
            const r = await datos.guardarRecordatorio({
              ...(recordatorio || recordatorioVacio()), texto: t, fecha: f, clienteId: clienteSel?.id || null,
            });
            avisoConDeshacer(recordatorio ? 'Recordatorio guardado' : `Recordatorio para el ${fechaNormal(f)}`,
              () => datos.restaurar('recordatorios', r.anterior, r.nuevo.id));
          },
        }, 'Guardar'))),
  });
  if (!recordatorio) setTimeout(() => texto.focus(), 250);
}

export async function recordatorioHecho(r, hecho = true) {
  const { fecha } = ahoraFH();
  const res = await datos.guardarRecordatorio({ ...r, hecho, fechaHecho: hecho ? fecha : null });
  avisoConDeshacer(hecho ? 'Recordatorio hecho' : 'Recordatorio pendiente otra vez',
    () => datos.restaurar('recordatorios', res.anterior, res.nuevo.id));
}

/** Panel de opciones de un recordatorio. */
export function opcionesRecordatorio(r) {
  const c = r.clienteId ? datos.obtenerCliente(r.clienteId) : null;
  const opcion = (texto, fn, clase = '') => h('button', { class: 'menu-opcion ' + clase, onClick: fn }, texto);
  hoja({
    titulo: r.texto,
    contenido: (cerrar) => h('div', {},
      h('p', { class: 'texto-info' }, `${fechaNormal(r.fecha)}${c ? ' · ' + c.nombreComercial : ''}${r.hecho ? ' · Hecho' : ''}`),
      h('div', { class: 'menu-lista' },
        opcion(r.hecho ? 'Marcar como pendiente' : 'Marcar como hecho', () => { cerrar(); recordatorioHecho(r, !r.hecho); }),
        opcion('Cambiar texto o fecha', () => { cerrar(); editarRecordatorio({ recordatorio: r }); }),
        c ? opcion('Ver ficha del cliente', () => { cerrar(); ctx.abrirFicha(c.id); }) : null,
        opcion('Borrar', async () => {
          cerrar();
          const res = await datos.borrarRecordatorio(r.id);
          avisoConDeshacer('Recordatorio borrado', () => datos.restaurar('recordatorios', res.anterior, res.nuevo.id));
        }, 'peligro'))),
  });
}

// ---------------------------------------------------------------------
//  Menú ⋯ de la tarjeta
// ---------------------------------------------------------------------

export function menuCliente(cliente, fechaPrevista) {
  const opcion = (texto, fn, clase = '') => h('button', { class: 'menu-opcion ' + clase, onClick: fn }, texto);
  hoja({
    titulo: nombreCorto(cliente),
    contenido: (cerrar) => h('div', { class: 'menu-lista' },
      fechaPrevista ? opcion('Más tarde', () => { cerrar(); masTarde(cliente, fechaPrevista); }) : null,
      opcion('Semana que viene', () => { cerrar(); semanaQueViene(cliente); }),
      opcion('Registrar pedido', () => { cerrar(); registrarPedido(cliente); }),
      opcion('Recordatorio', () => { cerrar(); editarRecordatorio({ cliente }); }),
      cliente.estado === 'potencial' ? opcion('Pasar a cliente', () => { cerrar(); pasarACliente(cliente); }) : null,
      opcion('Vacaciones', () => { cerrar(); vacaciones(cliente); }),
      opcion('Baja', () => { cerrar(); baja(cliente); }, 'peligro'),
      opcion('Ver ficha', () => { cerrar(); ctx.abrirFicha(cliente.id); }),
    ),
  });
}

/** Deshacer desde la tarjeta de «Hechos hoy». */
export async function deshacerHecho(cliente, registro) {
  const ok = await confirmar(`¿Deshacer el resultado de ${nombreCorto(cliente)}? Volverá a la lista.`, { ok: 'Deshacer' });
  if (!ok) return;
  await datos.registrarLlamada(deshacerUltimaAccion(registro));
  ctx.refrescar();
  toast('Deshecho');
}
