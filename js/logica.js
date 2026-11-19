// =====================================================================
//  logica.js · Funciones PURAS de la app de llamadas.
//  Sin acceso al DOM ni a la base de datos: reciben datos y devuelven
//  datos. Así se pueden probar con `node --test`.
// =====================================================================

// ---------------------------------------------------------------------
//  Fechas y horas (siempre hora LOCAL del móvil, formato YYYY-MM-DD)
//  Nunca usamos toISOString() para saber "qué día es hoy": convierte a
//  UTC y de noche puede devolver el día anterior o el siguiente.
// ---------------------------------------------------------------------

export const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const DIAS_LETRA = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DIAS_EXCEL = ['', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const d2 = (n) => String(n).padStart(2, '0');

/** Fecha local 'YYYY-MM-DD' de un objeto Date. */
export function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}`;
}

/** Hora local 'HH:MM'. */
export function horaLocal(d = new Date()) {
  return `${d2(d.getHours())}:${d2(d.getMinutes())}`;
}

/** Convierte 'YYYY-MM-DD' (y opcionalmente 'HH:MM') en Date local.
 *  Sin hora usa las 12:00 para que los cambios de horario no muevan el día. */
export function aFecha(fecha, hora = '12:00') {
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function esFechaValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  return fechaLocal(aFecha(s)) === s;
}

export function sumarDias(fecha, n) {
  const d = aFecha(fecha);
  d.setDate(d.getDate() + n);
  return fechaLocal(d);
}

/** Días entre dos fechas (b - a). */
export function diasEntre(a, b) {
  return Math.round((aFecha(b) - aFecha(a)) / 86400000);
}

/** 1 = lunes … 7 = domingo. */
export function diaSemana(fecha) {
  const g = aFecha(fecha).getDay();
  return g === 0 ? 7 : g;
}

/** Lunes de la semana de esa fecha (la semana empieza en lunes). */
export function lunesDe(fecha) {
  return sumarDias(fecha, 1 - diaSemana(fecha));
}

/** Fecha del día n (1 = lunes) de la semana que empieza en `lunes`. */
export function fechaDeDia(lunes, n) {
  return sumarDias(lunes, n - 1);
}

export function capitalizarPrimera(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** 'Martes 18 de noviembre' */
export function fechaLarga(fecha) {
  const d = aFecha(fecha);
  return `${capitalizarPrimera(DIAS[diaSemana(fecha)])} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** '18/11' */
export function fechaCorta(fecha) {
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
}

/** '18/11/2026' */
export function fechaNormal(fecha) {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

/** Marca de tiempo LOCAL con zona: '2026-11-18T10:42:05.123+01:00'.
 *  Los 10 primeros caracteres son siempre la fecha local. */
export function marcaTiempo(d = new Date()) {
  const off = -d.getTimezoneOffset();
  const signo = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${fechaLocal(d)}T${horaLocal(d)}:${d2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}` +
    `${signo}${d2(Math.floor(a / 60))}:${d2(a % 60)}`;
}

export function fechaDeMarca(m) { return m ? String(m).slice(0, 10) : ''; }
export function horaDeMarca(m) { return m ? String(m).slice(11, 16) : ''; }

export function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}
export function deMinutos(min) {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${d2(Math.floor(m / 60))}:${d2(m % 60)}`;
}
export function sumarMinutos(hora, min) { return deMinutos(aMinutos(hora) + min); }

// ---------------------------------------------------------------------
//  Textos: días de llamada, día que cierra, hora de apertura, teléfonos
// ---------------------------------------------------------------------

/** Mayúsculas, sin tildes y sin espacios repetidos. */
export function normalizarTexto(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

const NOMBRES_DIA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const ABREVIATURAS = { L: 1, LU: 1, M: 2, MA: 2, X: 3, MI: 3, J: 4, JU: 4, V: 5, VI: 5, S: 6, SA: 6, D: 7, DO: 7 };
const PALABRAS_UNION = new Set(['Y', 'E', 'DE']);
const PALABRAS_RANGO = new Set(['A', 'AL']);

function diaDeToken(t) {
  if (!t) return null;
  if (ABREVIATURAS[t]) return ABREVIATURAS[t];
  if (t.length >= 3) {
    const i = NOMBRES_DIA.findIndex((n) => n.startsWith(t));
    if (i >= 0) return i + 1;
  }
  return null;
}

/** Lee un texto con días ('LUNES, MIERCOLES', 'L/X', 'lun y mié', 'LUNES A MIERCOLES'). */
function leerDias(texto) {
  const tokens = normalizarTexto(texto).replace(/[,;/.\-+&()]/g, ' ').split(' ').filter(Boolean);
  const dias = [];
  const desconocidos = [];
  let rango = false;
  for (const tk of tokens) {
    if (PALABRAS_UNION.has(tk)) continue;
    if (PALABRAS_RANGO.has(tk)) { rango = true; continue; }
    const d = diaDeToken(tk);
    if (d == null) { desconocidos.push(tk); rango = false; continue; }
    if (rango && dias.length) {
      for (let x = dias[dias.length - 1] + 1; x < d; x++) dias.push(x);
    }
    dias.push(d);
    rango = false;
  }
  return { dias: [...new Set(dias)].sort((a, b) => a - b), desconocidos };
}

/** Días de llamada → { dias: [1..5], finDeSemana: [6,7], desconocidos: [...] } */
export function analizarDias(texto) {
  const r = leerDias(texto);
  return {
    dias: r.dias.filter((d) => d <= 5),
    finDeSemana: r.dias.filter((d) => d > 5),
    desconocidos: r.desconocidos,
  };
}

/** Día que cierra → { tipo: 'vacio' | 'no_cierra' | 'dias' | 'otro', dias: [1..7] }
 *  Solo se considera 'dias' si TODO el texto son días (así «DESCARGAR LOS
 *  MIERCOLES» o «JEFE COCINA» no generan avisos falsos). */
export function analizarCierre(texto) {
  const t = normalizarTexto(texto);
  if (!t) return { tipo: 'vacio', dias: [] };
  if (/NO CIERRA|ABRE TODOS|TODOS LOS DIAS|NUNCA CIERRA/.test(t)) return { tipo: 'no_cierra', dias: [] };
  const r = leerDias(t);
  if (r.dias.length && r.desconocidos.length === 0) return { tipo: 'dias', dias: r.dias };
  return { tipo: 'otro', dias: [] };
}

export function hoyCierra(cliente, fecha) {
  return analizarCierre(cliente.diaCierre).dias.includes(diaSemana(fecha));
}

/** Hora de apertura → 'HH:MM' o null. Acepta '8:00', '08:00', '8', '8h30', '8.30'
 *  y el número decimal que usa Excel para las horas (0,3333 = 08:00). */
export function analizarHora(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (v >= 0 && v < 1) return deMinutos(v * 1440);
    if (v >= 0 && v < 24) return deMinutos(v * 60);
    return null;
  }
  const s = String(v).trim();
  if (/^0?\.\d+$/.test(s) || /^0,\d+$/.test(s)) return deMinutos(parseFloat(s.replace(',', '.')) * 1440);
  const m = normalizarTexto(s).match(/(\d{1,2})(?:\s*[:.H]\s*(\d{2}))?/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  if (hh > 23 || mm > 59) return null;
  return `${d2(hh)}:${d2(mm)}`;
}

/** Extrae teléfonos de uno o varios textos. Devuelve números españoles de
 *  9 cifras ('679171125') o internacionales con '+' ('+447700900123'). */
export function extraerTelefonos(...textos) {
  const out = [];
  const meter = (t) => { if (t && !out.includes(t)) out.push(t); };
  for (const texto of textos) {
    if (texto == null || texto === '') continue;
    for (const trozo of String(texto).split(/[,;/|\n]+|\s+[yY]\s+|\s+-\s+/)) {
      const s = trozo.trim();
      if (!s) continue;
      const internacional = s.startsWith('+') || s.startsWith('00');
      let dig = s.replace(/\D/g, '');
      if (s.startsWith('00')) dig = dig.slice(2);
      if (internacional) {
        if (dig.startsWith('34') && dig.length === 11) meter(dig.slice(2));
        else if (dig.length >= 6) meter('+' + dig);
        continue;
      }
      if (dig.length === 11 && dig.startsWith('34')) dig = dig.slice(2);
      if (dig.length === 18) { meter(dig.slice(0, 9)); meter(dig.slice(9)); continue; }
      if (dig.length >= 6) meter(dig);
    }
  }
  return out;
}

/** Para enlaces tel: → '+34679171125' */
export function telefonoInternacional(t) {
  if (!t) return '';
  if (t.startsWith('+')) return t;
  return t.length === 9 ? '+34' + t : t;
}

/** Para wa.me → '34679171125' (sin '+') */
export function telefonoWhatsApp(t) {
  return telefonoInternacional(t).replace(/^\+/, '');
}

/** '679 171 125' */
export function formatearTelefono(t) {
  if (!t) return '';
  if (/^\d{9}$/.test(t)) return `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}`;
  return t;
}

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a']);
/** 'BAR TORRES DE LA PLAYA' → 'Bar Torres de la Playa' */
export function capitalizar(s) {
  return String(s ?? '').toLowerCase().split(' ').map((p, i) =>
    (i > 0 && MINUSCULAS.has(p)) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

// ---------------------------------------------------------------------
//  Modelo de datos: valores por defecto
// ---------------------------------------------------------------------

export const ESTADOS = ['activo', 'vacaciones', 'baja', 'potencial'];
export const NOMBRE_ESTADO = { activo: 'Activo', vacaciones: 'Vacaciones', baja: 'Baja', potencial: 'Potencial' };

/** Campos de un cliente (además de los comunes id/creado/modificado/dispositivoId/borrado). */
export function clienteVacio() {
  return {
    codigo: '', nombreComercial: '', nombreFiscal: '', poblacion: '', zona: '', contacto: '',
    telefonos: [], diasLlamada: [], diasLlamadaDesde: null, diaCierre: '', formaPago: '',
    horaApertura: null, notas: '', pideHabitualmente: '', condiciones: '', pendienteCobro: null,
    // Fase 4: nombre y uso de cada teléfono ({ '600111222': { nombre: 'Jefe', uso: 'llamar' } }),
    // hora a partir de la que conviene llamar y condiciones especiales del cliente.
    telefonosInfo: {}, llamarDesde: null, condicionesEspeciales: [],
    importante: false, estado: 'activo', vacacionesDesde: null, vacacionesHasta: null,
    saltarSemana: null, fechaBaja: null, motivoBaja: '', hojasOrigen: '', origenImportacion: null,
    borrado: false, fechaBorrado: null,
  };
}

/** Una condición especial del cliente (descuento, precio, regalo…). */
export function condicionVacia() {
  return { id: '', producto: '', condicion: '', hasta: null, nota: '', creada: null };
}

// ---------------------------------------------------------------------
//  Teléfonos con nombre y uso
// ---------------------------------------------------------------------

/** Para qué sirve cada teléfono. 'todo' = llamar y WhatsApp. */
export const USOS_TELEFONO = { todo: 'Llamar y WhatsApp', llamar: 'Solo llamar', whatsapp: 'Solo WhatsApp' };
export const NOMBRES_TELEFONO = ['Jefe', 'Encargado', 'Pedidos', 'Bar', 'Cocina', 'Fijo', 'Móvil', 'Oficina'];

/** Teléfonos del cliente con su nombre y uso, en el orden guardado. */
export function telefonosDe(c) {
  const info = c?.telefonosInfo || {};
  return (c?.telefonos || []).map((numero) => ({
    numero,
    nombre: info[numero]?.nombre || '',
    uso: USOS_TELEFONO[info[numero]?.uso] ? info[numero].uso : 'todo',
  }));
}

/** Teléfonos que sirven para 'llamar' o para 'whatsapp'. Primero los marcados
 *  expresamente para eso («Solo WhatsApp» va antes que «Llamar y WhatsApp»).
 *  Si ninguno sirve, se devuelven todos (para no dejar al comercial sin poder llamar). */
export function telefonosPara(c, para) {
  const todos = telefonosDe(c);
  const vale = todos.filter((t) => t.uso === 'todo' || t.uso === para)
    .sort((a, b) => (a.uso === para ? 0 : 1) - (b.uso === para ? 0 : 1));
  return vale.length ? vale : todos;
}

/** 'Jefe · 600 111 222' o '600 111 222' */
export function textoTelefono(t) {
  return t.nombre ? `${t.nombre} · ${formatearTelefono(t.numero)}` : formatearTelefono(t.numero);
}

/** Para el Excel: 'Jefe: 600 111 222 (solo llamar); 965 000 000' */
export function telefonosConNombre(c) {
  return telefonosDe(c).map((t) =>
    `${t.nombre ? t.nombre + ': ' : ''}${formatearTelefono(t.numero)}${t.uso !== 'todo' ? ` (${USOS_TELEFONO[t.uso].toLowerCase()})` : ''}`).join('; ');
}

/** Lee la columna «Teléfonos con nombre» del Excel → { telefonos, info } */
export function leerTelefonosConNombre(texto) {
  const telefonos = [];
  const info = {};
  for (const trozo of String(texto ?? '').split(/[;\n]+/)) {
    const s = trozo.trim();
    if (!s) continue;
    const m = s.match(/^([^:\d+]*[^:\d\s+][^:\d+]*):\s*(.*)$/);
    const nombre = m ? m[1].trim() : '';
    let resto = m ? m[2] : s;
    const n = normalizarTexto(resto);
    const uso = /SOLO LLAMAR/.test(n) ? 'llamar' : /SOLO WHATSAPP/.test(n) ? 'whatsapp' : 'todo';
    resto = resto.replace(/\(.*?\)/g, ' ');
    const [numero] = extraerTelefonos(resto);
    if (!numero || telefonos.includes(numero)) continue;
    telefonos.push(numero);
    if (nombre || uso !== 'todo') info[numero] = { nombre, uso };
  }
  return { telefonos, info };
}

// ---------------------------------------------------------------------
//  Datos por completar
// ---------------------------------------------------------------------

/** Qué le falta a la ficha. Lo «importante» impide trabajar con el cliente
 *  (sin teléfono no se le puede llamar; sin día no sale en la lista). */
export function faltaPorConfigurar(c) {
  if (!c || c.estado === 'baja') return { importante: [], resto: [], todo: [] };
  const importante = [];
  const resto = [];
  if (!(c.telefonos || []).length) importante.push('telefonos');
  if (!(c.diasLlamada || []).length) importante.push('diasLlamada');
  if (!c.contacto) resto.push('contacto');
  if (!c.poblacion) resto.push('poblacion');
  if (c.estado !== 'potencial') {
    if (!c.nombreFiscal) resto.push('nombreFiscal');
    if (!c.formaPago) resto.push('formaPago');
  }
  return { importante, resto, todo: [...importante, ...resto] };
}

export const NOMBRE_DATO = {
  telefonos: 'teléfono', diasLlamada: 'día de llamada', contacto: 'contacto', poblacion: 'población',
  nombreFiscal: 'nombre fiscal', formaPago: 'forma de pago',
};

/** 'Falta: teléfono, día de llamada' */
export function textoFalta(campos) {
  return campos.length ? 'Falta: ' + campos.map((k) => NOMBRE_DATO[k] || k).join(', ') : '';
}

// ---------------------------------------------------------------------
//  Condiciones especiales del cliente
// ---------------------------------------------------------------------

/** Las que siguen vigentes en esa fecha (sin «hasta» o con «hasta» >= fecha). */
export function condicionesVigentes(c, fecha) {
  return (c?.condicionesEspeciales || []).filter((x) => !x.hasta || !fecha || x.hasta >= fecha);
}

/** 'Xoringer: −10 % (hasta 31/12)' */
export function textoCondicion(x, { conHasta = true } = {}) {
  const base = [x.producto, x.condicion].filter(Boolean).join(': ');
  return base + (conHasta && x.hasta ? ` (hasta el ${fechaCorta(x.hasta)})` : '');
}

/** El último pedido con texto de un cliente, anterior a `antesDe` (fecha), o null. */
export function ultimoPedidoConTexto(llamadasCliente, antesDe = null) {
  return [...llamadasCliente]
    .filter((r) => !r.borrado && r.resultado === 'pide' && r.pedido && r.pedido.trim() && (!antesDe || (r.fecha || r.fechaPrevista) < antesDe))
    .sort((a, b) => (b.fecha || b.fechaPrevista || '').localeCompare(a.fecha || a.fechaPrevista || '') ||
      String(b.modificado || '').localeCompare(String(a.modificado || '')))[0] || null;
}

// ---------------------------------------------------------------------
//  Encargos a la oficina (fase 5)
// ---------------------------------------------------------------------

/** Lista de encargos. `pide`: 'producto' o 'texto' si hace falta escribir algo. */
export const TIPOS_ENCARGO = [
  { id: 'catalogo_navidad', icono: '📕', texto: 'Enviar catálogo de Navidad' },
  { id: 'catalogo_general', icono: '📗', texto: 'Enviar catálogo general' },
  { id: 'tarifa', icono: '💶', texto: 'Enviar tarifa de precios' },
  { id: 'ficha_producto', icono: '🍷', texto: 'Enviar ficha de un producto', pide: 'producto' },
  { id: 'llamar_oficina', icono: '📞', texto: 'Que le llame la oficina' },
  { id: 'cobro', icono: '🧾', texto: 'Revisar un cobro o una factura' },
  { id: 'otro', icono: '✏️', texto: 'Otro', pide: 'texto' },
];
export const tipoEncargo = (id) => TIPOS_ENCARGO.find((t) => t.id === id) || { id, icono: '📌', texto: id || 'Encargo' };

/** Un encargo puede ser de un cliente o de varios a la vez (clienteIds). */
export function encargoVacio() {
  return {
    tipo: '', detalle: '', nota: '', clienteIds: [], fecha: null, hora: null, enviadoPor: '',
    borrado: false, fechaBorrado: null,
  };
}

/** 'Enviar ficha de un producto: Xoringer' · 'Otro' → lo que se escribió */
export function tituloEncargo(e) {
  const t = tipoEncargo(e.tipo);
  if (t.pide === 'texto') return e.detalle || t.texto;
  return t.texto + (e.detalle ? `: ${e.detalle}` : '');
}

/** Mensaje de WhatsApp para la oficina. Empieza siempre por «📌 ENCARGO». */
export function mensajeEncargo({ encargo, clientes, comercial, fecha, hora }) {
  const L = [`📌 ENCARGO · ${comercial || 'Comercial'}`];
  const nombre = (c) => capitalizar(c.nombreComercial) + (c.codigo ? ` (${c.codigo})` : '');
  const tels = (c) => {
    const wa = telefonosPara(c, 'whatsapp')[0];
    const ll = telefonosPara(c, 'llamar')[0];
    return { wa, ll: ll && ll.numero !== wa?.numero ? ll : null };
  };
  if (clientes.length === 1) {
    const c = clientes[0];
    const t = tels(c);
    L.push(tituloEncargo(encargo));
    L.push(`Cliente: ${nombre(c)}${c.poblacion ? ' · ' + capitalizar(c.poblacion) : ''}`);
    if (c.contacto) L.push(`Contacto: ${capitalizar(c.contacto)}`);
    if (t.wa) L.push(`WhatsApp: ${textoTelefono(t.wa)}`);
    if (t.ll) L.push(`Teléfono: ${textoTelefono(t.ll)}`);
    if (!t.wa && !t.ll) L.push('Sin teléfono en la app');
  } else {
    L.push(`${tituloEncargo(encargo)} · ${clientes.length} clientes:`);
    clientes.forEach((c, i) => {
      const t = tels(c);
      L.push(`${i + 1}. ` + [nombre(c), c.poblacion && capitalizar(c.poblacion), c.contacto && capitalizar(c.contacto),
        t.wa ? `WhatsApp ${textoTelefono(t.wa)}` : 'sin teléfono'].filter(Boolean).join(' · '));
    });
  }
  if (encargo.nota && encargo.nota.trim()) L.push(`Nota: ${encargo.nota.trim()}`);
  L.push(`— ${DIAS[diaSemana(fecha)]} ${fechaCorta(fecha)} ${hora}`);
  return L.join('\n');
}

export function registroVacio() {
  return {
    clienteId: null, fechaPrevista: null, fecha: null, resultado: null, pedido: '', nota: '',
    origen: 'llamada', intentos: [], volverALlamarDesde: null, enviadoOficina: false,
    horaEnviadoOficina: null, borrado: false, fechaBorrado: null,
  };
}

/** Recordatorio: clienteId es opcional (puede ser una tarea suelta). */
export function recordatorioVacio() {
  return { clienteId: null, fecha: null, texto: '', hecho: false, fechaHecho: null, borrado: false, fechaBorrado: null };
}

export function promocionVacia() {
  return {
    producto: '', detalle: '', precio: null, promocion: '', desde: null, hasta: null, tipo: '',
    fechaImportacion: null, borrado: false, fechaBorrado: null,
  };
}

/** Cómo llegó un pedido. «llamada» es la llamada normal de su día. */
export const ORIGENES_PEDIDO = { cliente_llama: 'Llamó el cliente', whatsapp: 'Por WhatsApp', visita: 'En visita' };

export const PLANTILLA_NO_CONTESTA =
  'Hola {contacto}, te he llamado para el pedido de esta semana, ¿necesitas algo? Un saludo, {comercial} (VinOliva)';

export function ajustesVacios() {
  return {
    id: 'ajustes', nombreComercial: '', whatsappOficina: '', contactoIvan: '',
    plantillas: { noContesta: PLANTILLA_NO_CONTESTA },
    semanasRiesgo: 3, primerUso: null, ultimaCopia: null, ultimoResumen: null, resumenesEnviados: [],
    avisoSemanaPasadaCerrado: null, avisoCompletarCerrado: null,
  };
}

// ---------------------------------------------------------------------
//  Estado del cliente en una fecha
// ---------------------------------------------------------------------

/** Estado efectivo de un cliente en una fecha:
 *  - las vacaciones con fecha de vuelta terminan solas ese día;
 *  - las vacaciones sin fecha duran hasta que se reactive a mano. */
export function estadoEnFecha(c, fecha) {
  if (c.estado === 'baja' || c.estado === 'potencial') return c.estado;
  if (c.vacacionesDesde && fecha >= c.vacacionesDesde && (!c.vacacionesHasta || fecha < c.vacacionesHasta)) {
    return 'vacaciones';
  }
  if (c.estado === 'vacaciones' && !c.vacacionesDesde) {
    return (c.vacacionesHasta && fecha >= c.vacacionesHasta) ? 'activo' : 'vacaciones';
  }
  return 'activo';
}

/** ¿Estuvo de vacaciones algún día entre `desde` (incluido) y `hasta` (excluido)? */
function vacacionesEntre(c, desde, hasta) {
  for (let f = desde; f < hasta; f = sumarDias(f, 1)) {
    if (estadoEnFecha(c, f) === 'vacaciones') return true;
  }
  return false;
}

// ---------------------------------------------------------------------
//  Registros de llamada
// ---------------------------------------------------------------------

export function esFinal(r) {
  return !!r && !r.borrado && (r.resultado === 'pide' || r.resultado === 'no_pide');
}

export function nuevoRegistro(clienteId, fechaPrevista, fecha, origen = 'llamada') {
  return { ...registroVacio(), clienteId, fechaPrevista, fecha: fecha || fechaPrevista, origen };
}

/** Recalcula resultado y "volver a llamar" a partir de la lista de intentos. */
export function recalcularRegistro(r) {
  let resultado = null;
  let volver = null;
  for (const i of r.intentos || []) {
    if (i.resultado === 'mas_tarde') volver = i.volverA;
    else { resultado = i.resultado; volver = null; }
  }
  const out = { ...r, resultado, volverALlamarDesde: volver };
  if (resultado !== 'pide') out.pedido = '';
  return out;
}

/** Aplica una acción a un registro y devuelve el registro nuevo.
 *  accion: {tipo:'pide', pedido} | {tipo:'no_pide', nota} | {tipo:'no_contesta'}
 *        | {tipo:'mas_tarde', hora:'17:00'} | {tipo:'whatsapp'} | {tipo:'enviado_oficina', marca} */
export function aplicarAccion(reg, accion, { fecha, hora }) {
  const r = { ...reg, intentos: [...(reg.intentos || [])] };
  const intento = (resultado, extra = {}) => r.intentos.push({ fecha, hora, resultado, whatsapp: false, ...extra });
  switch (accion.tipo) {
    case 'pide':
      intento('pide');
      r.pedido = (accion.pedido || '').trim();
      if (accion.nota != null) r.nota = accion.nota;
      break;
    case 'no_pide':
      intento('no_pide');
      if (accion.nota != null) r.nota = accion.nota.trim();
      break;
    case 'no_contesta':
      intento('no_contesta');
      break;
    case 'mas_tarde':
      intento('mas_tarde', { volverA: accion.hora });
      break;
    case 'whatsapp': {
      const i = r.intentos.length - 1;
      if (i >= 0) r.intentos[i] = { ...r.intentos[i], whatsapp: true };
      else intento('whatsapp', { whatsapp: true });
      return { ...r }; // no cambia el resultado
    }
    case 'enviado_oficina':
      return { ...r, enviadoOficina: true, horaEnviadoOficina: accion.marca || `${fecha}T${hora}` };
    default:
      throw new Error('Acción desconocida: ' + accion.tipo);
  }
  r.fecha = fecha;
  return recalcularRegistro(r);
}

/** Quita la última acción (para «Deshacer» desde «Hechos hoy»). */
export function deshacerUltimaAccion(reg) {
  const intentos = (reg.intentos || []).slice(0, -1);
  const r = recalcularRegistro({ ...reg, intentos });
  const ultimo = intentos[intentos.length - 1];
  r.fecha = ultimo ? ultimo.fecha : reg.fechaPrevista;
  return r;
}

/** Intentos sin contestar: { veces, ultimaHora, whatsapp } */
export function resumenNoContesta(r) {
  const nc = (r?.intentos || []).filter((i) => i.resultado === 'no_contesta');
  return {
    veces: nc.length,
    ultimaHora: nc.length ? nc[nc.length - 1].hora : null,
    whatsapp: nc.some((i) => i.whatsapp),
  };
}

// ---------------------------------------------------------------------
//  Situación de un cliente en una semana
// ---------------------------------------------------------------------

/** ¿Le tocaba llamar ese día? Los potenciales también se llaman (bloque Captación). */
function esElegible(c, f, primerUso) {
  if (primerUso && f < primerUso) return false;
  if (c.diasLlamadaDesde && f < c.diasLlamadaDesde) return false;
  const creado = fechaDeMarca(c.creado);
  if (creado && f < creado) return false;
  const est = estadoEnFecha(c, f);
  return est === 'activo' || est === 'potencial';
}

// ---------------------------------------------------------------------
//  Clientes en riesgo (llevan X semanas sin pedir)
// ---------------------------------------------------------------------

/** Último día en que cada cliente hizo un pedido: Map clienteId → 'YYYY-MM-DD'. */
export function ultimosPedidos(llamadas) {
  const m = new Map();
  for (const r of llamadas) {
    if (!esFinal(r) || r.resultado !== 'pide') continue;
    const f = r.fecha || r.fechaPrevista;
    if (!m.has(r.clienteId) || f > m.get(r.clienteId)) m.set(r.clienteId, f);
  }
  return m;
}

/** Semanas que lleva un cliente sin pedir, o null si no está «en riesgo».
 *  - Solo clientes activos y con día de llamada.
 *  - No marca a nadie hasta que la app lleve `umbral` semanas en uso.
 *  - Se cuenta desde lo más reciente de: primer uso de la app, alta del
 *    cliente, vuelta de vacaciones o último pedido. */
export function semanasSinPedir(c, ultimoPide, fecha, primerUso, umbral = 3) {
  if (!primerUso || !umbral || umbral < 1) return null;
  if (c.borrado || estadoEnFecha(c, fecha) !== 'activo' || !(c.diasLlamada || []).length) return null;
  if (diasEntre(primerUso, fecha) < umbral * 7) return null;
  let ref = primerUso;
  const creado = fechaDeMarca(c.creado);
  if (creado > ref) ref = creado;
  if (c.vacacionesHasta && c.vacacionesHasta <= fecha && c.vacacionesHasta > ref) ref = c.vacacionesHasta;
  if (ultimoPide && ultimoPide > ref) ref = ultimoPide;
  const semanas = Math.floor(diasEntre(ref, fecha) / 7);
  return semanas >= umbral ? semanas : null;
}

/** Map clienteId → semanas sin pedir, solo de los que están en riesgo. */
export function calcularRiesgo({ clientes, llamadas, fecha, primerUso, semanas = 3 }) {
  const ultimos = ultimosPedidos(llamadas);
  const m = new Map();
  for (const c of clientes) {
    const n = semanasSinPedir(c, ultimos.get(c.id), fecha, primerUso, semanas);
    if (n != null) m.set(c.id, n);
  }
  return m;
}

export const textoRiesgo = (n) => `${n} ${n === 1 ? 'semana' : 'semanas'} sin pedir`;

// ---------------------------------------------------------------------
//  Recordatorios
// ---------------------------------------------------------------------

/** Recordatorios por hacer que tocan hoy o ya han vencido (los de días
 *  anteriores siguen saliendo hasta que se marquen como hechos). */
export function recordatoriosDelDia(recordatorios, fecha) {
  return recordatorios
    .filter((r) => !r.borrado && !r.hecho && r.fecha && r.fecha <= fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado || '').localeCompare(String(b.creado || '')));
}

/** Recordatorios por hacer con fecha futura. */
export function recordatoriosProximos(recordatorios, fecha) {
  return recordatorios
    .filter((r) => !r.borrado && !r.hecho && r.fecha && r.fecha > fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado || '').localeCompare(String(b.creado || '')));
}

function agruparRegistros(llamadas, desde, hasta) {
  const m = new Map();
  for (const r of llamadas) {
    if (r.borrado) continue;
    const enRango = (r.fechaPrevista >= desde && r.fechaPrevista <= hasta) || (r.fecha >= desde && r.fecha <= hasta);
    if (!enRango) continue;
    let l = m.get(r.clienteId);
    if (!l) m.set(r.clienteId, (l = []));
    l.push(r);
  }
  return m;
}

/** Calcula, para un cliente y una semana:
 *  - los días que le tocaba llamar hasta `fecha` (incluida);
 *  - cuál fue el último día con resultado final (pide / no pide);
 *  - si hizo un pedido fuera de su día (tapa el resto de la semana);
 *  - qué días quedan sin resolver. */
function situacionSemana(c, regs, lunes, fecha, primerUso) {
  const domingo = sumarDias(lunes, 6);
  const porFecha = new Map();
  let ultimoFinal = '';
  let fueraDeDia = null;
  for (const r of regs) {
    if (r.fechaPrevista >= lunes && r.fechaPrevista <= domingo) {
      const prev = porFecha.get(r.fechaPrevista);
      if (!prev || (r.modificado || '') > (prev.modificado || '')) porFecha.set(r.fechaPrevista, r);
      if (esFinal(r) && r.fechaPrevista > ultimoFinal) ultimoFinal = r.fechaPrevista;
    }
    if (esFinal(r) && r.origen !== 'llamada' && r.resultado === 'pide' && r.fecha >= lunes && r.fecha <= domingo) {
      fueraDeDia = r;
    }
  }
  const saltada = c.saltarSemana === lunes;
  const debidos = [];
  for (const n of c.diasLlamada || []) {
    if (n < 1 || n > 5) continue;
    const f = fechaDeDia(lunes, n);
    if (f > fecha) continue;
    if (!esElegible(c, f, primerUso)) continue;
    debidos.push(f);
  }
  debidos.sort();
  const sinResolver = (saltada || fueraDeDia) ? [] : debidos.filter((f) => f > ultimoFinal);
  return { porFecha, ultimoFinal, fueraDeDia, saltada, debidos, sinResolver };
}

// ---------------------------------------------------------------------
//  Lista del día
// ---------------------------------------------------------------------

function compararTexto(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });
}

/** Hora a partir de la que se le puede llamar: la más tardía entre la apertura y «llamar a partir de». */
export function horaParaLlamar(c) {
  const hs = [c.horaApertura, c.llamarDesde].filter(Boolean).sort();
  return hs[hs.length - 1] || null;
}

function crearItem(c, reg, fechaPrevista, { fecha, hora, pendienteDe = [], riesgo = null, recordatorios = [] }) {
  const desde = horaParaLlamar(c);
  const abierto = !desde || hora >= desde;
  const noContesta = reg?.resultado === 'no_contesta';
  const volver = reg?.volverALlamarDesde || null;
  const volverCumplido = !!volver && hora >= volver;
  const nc = resumenNoContesta(reg);
  const etiquetas = [];
  if (recordatorios.length) {
    etiquetas.push({
      tipo: 'recordatorio',
      texto: `Recordatorio: ${recordatorios[0].texto}` + (recordatorios.length > 1 ? ` (+${recordatorios.length - 1})` : ''),
    });
  }
  if (pendienteDe.length) {
    etiquetas.push({ tipo: 'pendiente', texto: 'Pendiente del ' + pendienteDe.map((f) => DIAS[diaSemana(f)]).join(' y ') });
  }
  if (volver) {
    etiquetas.push(volverCumplido
      ? { tipo: 'volver', texto: `Te dijo que llamaras a las ${volver}` }
      : { tipo: 'tarde', texto: `Volver a llamar a las ${volver}` });
  }
  if (hoyCierra(c, fecha)) etiquetas.push({ tipo: 'aviso', texto: 'Hoy cierra' });
  if (!abierto) {
    etiquetas.push({ tipo: 'info', texto: desde === c.horaApertura ? `Abre a las ${desde}` : `Llamar a partir de las ${desde}` });
  }
  const conds = condicionesVigentes(c, fecha);
  if (conds.length) {
    const primera = [conds[0].producto, conds[0].condicion].filter(Boolean).join(' ');
    etiquetas.push({ tipo: 'condicion', texto: `Condiciones: ${primera}` + (conds.length > 1 ? ` (+${conds.length - 1})` : '') });
  }
  if (nc.veces) {
    etiquetas.push({
      tipo: 'nocontesta',
      texto: `No contestó · ${nc.veces} ${nc.veces === 1 ? 'intento' : 'intentos'} · último ${nc.ultimaHora}` +
        (nc.whatsapp ? ' · WhatsApp enviado' : ''),
    });
  }
  if (c.pendienteCobro && Number(c.pendienteCobro.importe) > 0) {
    etiquetas.push({ tipo: 'cobro', texto: `Cobro pendiente: ${formatearImporte(c.pendienteCobro.importe)}` });
  }
  if (riesgo != null) etiquetas.push({ tipo: 'riesgo', texto: textoRiesgo(riesgo) });
  if (!c.telefonos || !c.telefonos.length) etiquetas.push({ tipo: 'gris', texto: 'Sin teléfono' });
  return { cliente: c, registro: reg || null, fechaPrevista, abierto, noContesta, volver, volverCumplido, pendienteDe, etiquetas };
}

export function formatearImporte(n) {
  const v = Number(n);
  if (!isFinite(v)) return '';
  return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')) + ' €';
}

/** Orden dentro de un bloque:
 *  0) los que pidieron que se les llamara a una hora y ya ha llegado;
 *  1) importantes; 2) abiertos; 3) aún no abiertos; 4) no contestaron;
 *  a igualdad, por población y nombre. */
export function ordenarItems(items) {
  const grupo = (it) => (it.noContesta ? 3 : it.abierto ? 1 : 2);
  return [...items].sort((a, b) =>
    (a.volverCumplido ? 0 : 1) - (b.volverCumplido ? 0 : 1) ||
    (a.cliente.importante ? 0 : 1) - (b.cliente.importante ? 0 : 1) ||
    grupo(a) - grupo(b) ||
    compararTexto(a.cliente.poblacion, b.cliente.poblacion) ||
    compararTexto(a.cliente.nombreComercial, b.cliente.nombreComercial));
}

/** Calcula la pantalla Hoy. Las tareas del día NO se guardan: se calculan.
 *  Bloques: recordatorios · pendientes · hoy · masTarde · captacion · hechos. */
export function calcularListaDia({
  clientes, llamadas, fecha, hora, primerUso = null, conSemanaPasada = true,
  recordatorios = [], semanasRiesgo = 3,
}) {
  const dia = diaSemana(fecha);
  const lunes = lunesDe(fecha);
  const res = {
    fecha, hora, dia, lunes, finDeSemana: dia > 5,
    recordatorios: [], pendientes: [], hoy: [], masTarde: [], captacion: [], hechos: [],
    contador: { porLlamar: 0, hechos: 0, noContestan: 0, captacion: 0 },
    semanaPasadaSinLlamar: [],
  };
  const regsPorCliente = agruparRegistros(llamadas, lunes, sumarDias(lunes, 6));
  const riesgo = calcularRiesgo({ clientes, llamadas, fecha, primerUso, semanas: semanasRiesgo });

  // Recordatorios de hoy y vencidos
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const recPorCliente = new Map();
  for (const r of recordatoriosDelDia(recordatorios, fecha)) {
    const c = r.clienteId ? porId.get(r.clienteId) : null;
    if (r.clienteId && (!c || c.borrado)) continue; // su cliente se ha borrado
    res.recordatorios.push({ recordatorio: r, cliente: c || null, vencido: r.fecha < fecha });
    if (c) {
      if (!recPorCliente.has(c.id)) recPorCliente.set(c.id, []);
      recPorCliente.get(c.id).push(r);
    }
  }

  for (const c of clientes) {
    if (c.borrado) continue;
    const regs = regsPorCliente.get(c.id) || [];

    // Hechos hoy (resultado final apuntado hoy)
    const hechosHoy = regs.filter((r) => esFinal(r) && r.fecha === fecha)
      .sort((a, b) => String(a.modificado || '').localeCompare(String(b.modificado || '')));
    if (hechosHoy.length) {
      const r = hechosHoy[hechosHoy.length - 1];
      res.hechos.push({ cliente: c, registro: r, fechaPrevista: r.fechaPrevista, etiquetas: [] });
    }
    if (res.finDeSemana) continue;

    const s = situacionSemana(c, regs, lunes, fecha, primerUso);
    // Los días de vacaciones (o de antes de unas vacaciones) no cuentan como pendientes
    const sinResolver = s.sinResolver.filter((f) => f === fecha || !vacacionesEntre(c, f, fecha));
    if (!sinResolver.length) continue;

    const esHoy = sinResolver.includes(fecha);
    const fp = esHoy ? fecha : sinResolver[sinResolver.length - 1];
    const reg = s.porFecha.get(fp) || null;
    const it = crearItem(c, reg, fp, {
      fecha, hora, pendienteDe: esHoy ? [] : sinResolver,
      riesgo: riesgo.get(c.id) ?? null, recordatorios: recPorCliente.get(c.id) || [],
    });
    if (estadoEnFecha(c, fecha) === 'potencial') res.captacion.push(it); // todos sus casos van a Captación
    else if (it.volver && !it.volverCumplido) res.masTarde.push(it);
    else (esHoy ? res.hoy : res.pendientes).push(it);
  }

  res.pendientes = ordenarItems(res.pendientes);
  res.hoy = ordenarItems(res.hoy);
  // En Captación, los de «más tarde» que aún no toca van al final
  const esperando = (it) => (it.volver && !it.volverCumplido ? 1 : 0);
  res.captacion = ordenarItems(res.captacion).sort((a, b) => esperando(a) - esperando(b));
  res.masTarde.sort((a, b) => a.volver.localeCompare(b.volver) ||
    compararTexto(a.cliente.nombreComercial, b.cliente.nombreComercial));
  res.hechos.sort((a, b) => String(b.registro.modificado || '').localeCompare(String(a.registro.modificado || '')));

  const enLista = [...res.pendientes, ...res.hoy, ...res.masTarde];
  res.contador = {
    porLlamar: enLista.length,
    hechos: res.hechos.length,
    noContestan: enLista.filter((it) => it.noContesta).length,
    captacion: res.captacion.length,
  };

  // El lunes: aviso de los que quedaron sin llamar la semana pasada (no se arrastran)
  if (dia === 1 && conSemanaPasada) {
    const viernes = sumarDias(lunes, -3);
    const prev = calcularListaDia({ clientes, llamadas, fecha: viernes, hora: '23:59', primerUso, conSemanaPasada: false });
    res.semanaPasadaSinLlamar = [...prev.pendientes, ...prev.hoy, ...prev.masTarde];
  }
  return res;
}

// ---------------------------------------------------------------------
//  Vista de la semana
// ---------------------------------------------------------------------

export const NOMBRE_SITUACION = {
  pide: 'Pide', no_pide: 'No pide', no_contesta: 'No contesta', mas_tarde: 'Más tarde',
  pendiente: 'Sin llamar', por_llamar: 'Por llamar', saltado: 'Semana que viene',
  vacaciones: 'Vacaciones', cubierto: 'Resuelto otro día', sin_dato: '—',
};

/** Para cada día L–V: los clientes de ese día, su situación y los totales. */
export function calcularSemana({ clientes, llamadas, lunes, fecha, primerUso = null }) {
  const regsPorCliente = agruparRegistros(llamadas, lunes, sumarDias(lunes, 6));
  const viernes = sumarDias(lunes, 4);
  const dias = [1, 2, 3, 4, 5].map((n) => ({
    dia: n, fecha: fechaDeDia(lunes, n), items: [],
    cuentas: { clientes: 0, llamados: 0, pide: 0, noPide: 0, noContesta: 0, pendientes: 0, porLlamar: 0 },
  }));

  for (const c of clientes) {
    if (c.borrado) continue;
    const regs = regsPorCliente.get(c.id) || [];
    const s = situacionSemana(c, regs, lunes, viernes, primerUso);
    for (const n of c.diasLlamada || []) {
      if (n < 1 || n > 5) continue;
      const f = fechaDeDia(lunes, n);
      const r = s.porFecha.get(f) || null;
      const est = estadoEnFecha(c, f);
      let situacion;
      if (esFinal(r)) situacion = r.resultado;
      else if (est === 'baja') continue;
      else if (s.saltada) situacion = 'saltado';
      else if (est === 'vacaciones') situacion = 'vacaciones';
      else if (s.fueraDeDia || s.ultimoFinal > f) situacion = 'cubierto';
      else if (r?.resultado === 'no_contesta') situacion = 'no_contesta';
      else if (r?.volverALlamarDesde) situacion = 'mas_tarde';
      else if (f < fecha) situacion = esElegible(c, f, primerUso) ? 'pendiente' : 'sin_dato';
      else situacion = 'por_llamar';
      const d = dias[n - 1];
      d.items.push({ cliente: c, registro: r, fechaPrevista: f, situacion });
    }
  }
  for (const d of dias) {
    d.items.sort((a, b) => compararTexto(a.cliente.poblacion, b.cliente.poblacion) ||
      compararTexto(a.cliente.nombreComercial, b.cliente.nombreComercial));
    const k = d.cuentas;
    k.clientes = d.items.length;
    for (const it of d.items) {
      if (it.registro?.resultado) k.llamados++;
      if (it.situacion === 'pide') k.pide++;
      if (it.situacion === 'no_pide') k.noPide++;
      if (it.situacion === 'no_contesta') k.noContesta++;
      if (it.situacion === 'pendiente') k.pendientes++;
      if (it.situacion === 'por_llamar' || it.situacion === 'mas_tarde') k.porLlamar++;
    }
  }
  const total = { clientes: 0, llamados: 0, pide: 0, noPide: 0, noContesta: 0, pendientes: 0, porLlamar: 0 };
  for (const d of dias) for (const k of Object.keys(total)) total[k] += d.cuentas[k];
  return { lunes, dias, total };
}

// ---------------------------------------------------------------------
//  Mensajes de WhatsApp
// ---------------------------------------------------------------------

function primerNombre(s) {
  return capitalizar(String(s || '').trim().split(/\s+/)[0] || '');
}

/** Mensaje de pedido para la oficina. */
export function mensajePedido({ cliente, pedido, comercial, fecha, hora }) {
  const pob = cliente.poblacion ? ` (${capitalizar(cliente.poblacion)})` : '';
  const lineas = [`PEDIDO · ${capitalizar(cliente.nombreComercial)}${pob}`];
  const tel = telefonosPara(cliente, 'llamar')[0];
  const partes = [cliente.contacto ? capitalizar(cliente.contacto) : '', tel ? textoTelefono(tel) : ''].filter(Boolean);
  if (partes.length) lineas.push(`Contacto: ${partes.join(' · ')}`);
  if (pedido && pedido.trim()) lineas.push(pedido.trim());
  lineas.push(`— ${comercial || 'Comercial'}, ${DIAS[diaSemana(fecha)]} ${fechaCorta(fecha)} ${hora}`);
  return lineas.join('\n');
}

/** Rellena {contacto}, {nombre}, {comercial} (solo el nombre de pila) y {dia}. */
export function rellenarPlantilla(plantilla, { cliente, comercial, fecha }) {
  const vars = {
    contacto: cliente?.contacto ? capitalizar(cliente.contacto) : '',
    nombre: cliente?.nombreComercial ? capitalizar(cliente.nombreComercial) : '',
    comercial: primerNombre(comercial),
    dia: fecha ? DIAS[diaSemana(fecha)] : '',
  };
  return String(plantilla || '')
    .replace(/\{(contacto|nombre|comercial|dia)\}/g, (_, k) => vars[k])
    .replace(/ +([,.!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Enlace de WhatsApp a un número con texto opcional. */
export function enlaceWhatsApp(telefono, texto = '') {
  const num = telefonoWhatsApp(telefono);
  return `https://wa.me/${num}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}

// ---------------------------------------------------------------------
//  Promociones
// ---------------------------------------------------------------------

/** Fecha de una celda de Excel → 'YYYY-MM-DD' (o null).
 *  Acepta fechas de Excel, 'YYYY-MM-DD' y 'DD/MM/AAAA' (orden español). */
export function analizarFecha(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date || Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v)) return null;
    // +12 h: las fechas de Excel a medianoche pueden llegar una hora antes por la zona horaria
    return fechaLocal(new Date(v.getTime() + 12 * 3600 * 1000));
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Número de serie de Excel (días desde el 30/12/1899)
    const d = new Date(1899, 11, 30 + Math.floor(v), 12);
    return fechaLocal(d);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const f = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return esFechaValida(f) ? f : null;
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const anio = m[3].length === 2 ? '20' + m[3] : m[3];
    const f = `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return esFechaValida(f) ? f : null;
  }
  return null;
}

/** Promociones que se enseñan hoy: no caducadas (las de «Hasta» pasado se ocultan solas).
 *  Primero las que ya están en marcha; después las que empiezan más adelante. */
export function promocionesVigentes(promos, fecha) {
  return promos
    .filter((p) => !p.borrado && (!p.hasta || p.hasta >= fecha))
    .map((p) => ({ ...p, empezada: !p.desde || p.desde <= fecha }))
    .sort((a, b) => (b.empezada - a.empezada) || compararTexto(a.tipo, b.tipo) || compararTexto(a.producto, b.producto));
}

export function coincidePromo(p, consulta) {
  const q = normalizarTexto(consulta);
  if (!q) return true;
  const t = normalizarTexto([p.producto, p.detalle, p.promocion, p.tipo].join(' '));
  return q.split(' ').every((x) => t.includes(x));
}

// ---------------------------------------------------------------------
//  Búsqueda y filtros de clientes
// ---------------------------------------------------------------------

export function textoBusqueda(c) {
  return normalizarTexto([c.nombreComercial, c.nombreFiscal, c.poblacion, c.contacto, c.codigo,
    ...Object.values(c.telefonosInfo || {}).map((i) => i.nombre)].join(' ')) +
    ' ' + (c.telefonos || []).join(' ');
}

export function coincideBusqueda(c, consulta) {
  const q = normalizarTexto(consulta);
  if (!q) return true;
  const qDig = q.replace(/\D/g, '');
  const texto = textoBusqueda(c);
  if (qDig.length >= 3 && q.replace(/[\s\d]/g, '') === '') {
    return (c.telefonos || []).some((t) => t.includes(qDig));
  }
  return q.split(' ').every((p) => texto.includes(p));
}

/** Separa zonas compuestas: 'BELLREGUARD, RUTA DE ALEX' → ['BELLREGUARD', 'RUTA DE ALEX'] */
export function zonasDe(c) {
  return String(c.zona || '').split(',').map((z) => z.trim()).filter(Boolean);
}
