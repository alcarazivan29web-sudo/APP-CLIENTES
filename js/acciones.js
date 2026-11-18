// =====================================================================
//  acciones.js · Acciones sobre un cliente que se usan desde varias
//  pantallas: llamar, WhatsApp, preguntar el resultado, más tarde,
//  semana que viene, vacaciones, baja…
// =====================================================================

import * as datos from './datos.js';
import {
  aplicarAccion, nuevoRegistro, mensajePedido, rellenarPlantilla, enlaceWhatsApp, telefonoInternacional,
  formatearTelefono, sumarMinutos, lunesDe, resumenNoContesta, fechaNormal, sumarDias, deshacerUltimaAccion,
} from './logica.js';
import { h, hoja, toast, abrirEnlace, compartirTexto, confirmar } from './ui.js';

const CLAVE_LLAMADA = 'llamadaEnCurso';
let ctx = null; // { reloj, refrescar, abrirFicha }

export function configurar(contexto) { ctx = contexto; }

const ahoraFH = () => ctx.reloj.ahoraFH();

// ---------------------------------------------------------------------
//  Teléfonos
// ---------------------------------------------------------------------

/** Si el cliente tiene varios teléfonos, pregunta cuál. Devuelve el número o null. */
function elegirTelefono(cliente, verbo) {
  const tels = cliente.telefonos || [];
  if (!tels.length) { toast('Este cliente no tiene teléfono. Añádelo en su ficha.'); return Promise.resolve(null); }
  if (tels.length === 1) return Promise.resolve(tels[0]);
  return new Promise((resolver) => {
    let elegido = null;
    hoja({
      titulo: `¿A qué número ${verbo}?`,
      alCerrar: () => resolver(elegido),
      contenido: (cerrar) => h('div', { class: 'lista-botones' },
        tels.map((t) => h('button', { class: 'btn btn-secundario btn-ancho', onClick: () => { elegido = t; cerrar(); } },
          formatearTelefono(t)))),
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
  const tel = await elegirTelefono(cliente, 'escribir');
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

export function reactivar(cliente) {
  const { fecha } = ahoraFH();
  const cambios = { estado: 'activo', fechaBaja: null, motivoBaja: '' };
  // Si estaba de vacaciones, sus vacaciones terminan hoy
  if (cliente.vacacionesDesde && (!cliente.vacacionesHasta || cliente.vacacionesHasta > fecha)) cambios.vacacionesHasta = fecha;
  return cambiarCliente(cliente, cambios, `${nombreCorto(cliente)} vuelve a estar activo`);
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
