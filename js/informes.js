// =====================================================================
//  informes.js · Fase 3 «Oficina»: resumen semanal, cambios para ICG,
//  Excel semanal e historial. Funciones PURAS (sin DOM ni base de
//  datos) para poder probarlas con `node --test`.
//
//  El Excel semanal tiene SIEMPRE el mismo formato para poder juntar los
//  de todos los comerciales: cada hoja empieza por
//  Comercial · Semana · Código · Cliente.
// =====================================================================

import {
  DIAS, DIAS_EXCEL, NOMBRE_ESTADO, NOMBRE_SITUACION, ORIGENES_PEDIDO,
  sumarDias, diasEntre, diaSemana, fechaCorta, fechaDeMarca, capitalizar, capitalizarPrimera,
  formatearTelefono, esFinal, calcularSemana, calcularRiesgo, ultimosPedidos,
  recordatoriosDelDia, normalizarTexto,
} from './logica.js';

const dia3 = (f) => capitalizarPrimera(DIAS[diaSemana(f)]).slice(0, 3);
const compararTexto = (a, b) => String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });
const ultimoIntento = (r) => (r?.intentos?.length ? r.intentos[r.intentos.length - 1] : null);

/** «Juan Bonilla» → «Juan_Bonilla» (para el nombre del archivo). */
export function nombreArchivoComercial(nombre) {
  const n = normalizarTexto(nombre || 'Comercial').toLowerCase()
    .split(' ').filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('_');
  return n.replace(/[^A-Za-z0-9_]/g, '') || 'Comercial';
}

export const nombreExcelSemanal = (lunes, comercial) => `semana_${lunes}_${nombreArchivoComercial(comercial)}.xlsx`;

// ---------------------------------------------------------------------
//  Cambios para ICG
// ---------------------------------------------------------------------

/** Campos que interesan a la oficina para actualizar ICG. */
export const CAMPOS_ICG = {
  nombreComercial: 'Nombre comercial', nombreFiscal: 'Nombre fiscal', telefonos: 'Teléfonos', contacto: 'Contacto',
  poblacion: 'Población', diasLlamada: 'Días de llamada', diaCierre: 'Día que cierra', formaPago: 'Forma de pago',
  estado: 'Estado', borrado: 'Borrado de la app',
};

export function valorICG(campo, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '(vacío)';
  if (campo === 'telefonos') return v.map(formatearTelefono).join(' · ');
  if (campo === 'diasLlamada') return v.map((d) => DIAS_EXCEL[d]).join(', ');
  if (campo === 'estado') return NOMBRE_ESTADO[v] || v;
  if (campo === 'borrado') return v ? 'Sí' : 'No';
  return String(v);
}

function resumenClienteNuevo(c) {
  return [
    c.poblacion, c.contacto && `contacto ${capitalizar(c.contacto)}`,
    (c.telefonos || []).length && (c.telefonos || []).map(formatearTelefono).join(' · '),
    (c.diasLlamada || []).length && `llamar ${valorICG('diasLlamada', c.diasLlamada)}`,
    c.formaPago, c.estado === 'potencial' && 'potencial',
  ].filter(Boolean).join(' · ');
}

const igualesJSON = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Lista neta de cambios de clientes hechos en la app (no por importar el Excel):
 *  por cliente y campo, el valor antes del primer cambio → el valor después del
 *  último. Si al final vuelve a ser igual (p. ej. se deshizo), no sale.
 *  Devuelve { filas, ids } (ids = todos los cambios incluidos, para marcarlos como enviados). */
export function cambiosParaICG({ cambios, clientes, incluirEnviados = false }) {
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const relevantes = cambios
    .filter((x) => x.entidad === 'clientes' && x.origen !== 'importacion' && (incluirEnviados || !x.enviado))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const nuevos = new Map(); // clienteId → { cambio, ids }
  const grupos = new Map(); // `${clienteId}|${campo}` → { primero, ultimo, ids }
  const ids = [];
  for (const x of relevantes) {
    if (x.accion === 'crear') { nuevos.set(x.entidadId, { cambio: x, ids: [x.id] }); ids.push(x.id); continue; }
    if (!CAMPOS_ICG[x.campo]) continue;
    ids.push(x.id);
    const k = `${x.entidadId}|${x.campo}`;
    const g = grupos.get(k);
    if (g) { g.ultimo = x; g.ids.push(x.id); } else grupos.set(k, { primero: x, ultimo: x, ids: [x.id] });
  }
  const filas = [];
  for (const [clienteId, n] of nuevos) {
    const c = porId.get(clienteId);
    if (!c || c.borrado) continue; // creado y borrado: no interesa
    filas.push({
      tipo: 'nuevo', clienteId, codigo: c.codigo || '', cliente: c.nombreComercial, campo: 'Cliente nuevo',
      antes: '', despues: resumenClienteNuevo(c), fecha: fechaDeMarca(n.cambio.fecha), ids: n.ids,
    });
  }
  for (const g of grupos.values()) {
    const clienteId = g.primero.entidadId;
    if (nuevos.has(clienteId)) { nuevos.get(clienteId).ids.push(...g.ids); continue; } // ya va como «nuevo»
    if (igualesJSON(g.primero.antes, g.ultimo.despues)) continue;
    const c = porId.get(clienteId);
    if (!c) continue;
    const campo = g.primero.campo;
    filas.push({
      tipo: 'cambio', clienteId, codigo: c.codigo || '', cliente: c.nombreComercial, campoClave: campo,
      campo: CAMPOS_ICG[campo], antes: valorICG(campo, g.primero.antes), despues: valorICG(campo, g.ultimo.despues),
      fecha: fechaDeMarca(g.ultimo.fecha), ids: g.ids,
    });
  }
  filas.sort((a, b) => compararTexto(a.cliente, b.cliente) || (a.tipo === 'nuevo' ? -1 : 1) || compararTexto(a.campo, b.campo));
  return { filas, ids };
}

// ---------------------------------------------------------------------
//  Datos de una semana (base del resumen y del Excel semanal)
// ---------------------------------------------------------------------

/** Junta todo lo que pasó en la semana del `lunes`, hasta `fecha` (si la semana
 *  no ha terminado) o hasta el domingo. */
export function datosSemana({ clientes, llamadas, recordatorios = [], cambios = [], lunes, fecha, primerUso, semanasRiesgo = 3 }) {
  const domingo = sumarDias(lunes, 6);
  const viernes = sumarDias(lunes, 4);
  const fechaRef = fecha < domingo ? fecha : domingo;
  const vivos = clientes.filter((c) => !c.borrado);
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const semana = calcularSemana({ clientes: vivos, llamadas, lunes, fecha: fechaRef, primerUso });
  const enSemana = (f) => !!f && f >= lunes && f <= domingo;

  const pedidos = llamadas
    .filter((r) => esFinal(r) && r.resultado === 'pide' && enSemana(r.fecha))
    .map((r) => {
      const i = [...(r.intentos || [])].reverse().find((x) => x.resultado === 'pide');
      return { registro: r, cliente: porId.get(r.clienteId), fecha: r.fecha, hora: i?.hora || '' };
    })
    .filter((p) => p.cliente)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));

  // Sin llamar o sin localizar (lo que quedó abierto hasta fechaRef)
  const abiertos = new Map();
  for (const d of semana.dias) {
    if (d.fecha > fechaRef) continue;
    for (const it of d.items) {
      if (!['pendiente', 'por_llamar', 'no_contesta', 'mas_tarde'].includes(it.situacion)) continue;
      abiertos.set(it.cliente.id, { cliente: it.cliente, fecha: d.fecha, situacion: it.situacion });
    }
  }
  const sinLlamar = [...abiertos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha) || compararTexto(a.cliente.nombreComercial, b.cliente.nombreComercial));

  const mapaRiesgo = calcularRiesgo({ clientes: vivos, llamadas, fecha: fechaRef, primerUso, semanas: semanasRiesgo });
  const riesgo = [...mapaRiesgo].map(([id, semanas]) => ({ cliente: porId.get(id), semanas }))
    .sort((a, b) => b.semanas - a.semanas || compararTexto(a.cliente.nombreComercial, b.cliente.nombreComercial));

  const bajas = vivos.filter((c) => c.estado === 'baja' && enSemana(c.fechaBaja) && c.motivoBaja !== 'Cerrado (según Excel)');
  const vacaciones = vivos.filter((c) => enSemana(c.vacacionesDesde));
  const altas = vivos.filter((c) => !c.origenImportacion && enSemana(fechaDeMarca(c.creado)));
  const nuevosClientes = altas.filter((c) => c.estado !== 'potencial');
  const nuevosPotenciales = altas.filter((c) => c.estado === 'potencial');
  const pasanACliente = cambios
    .filter((x) => x.entidad === 'clientes' && x.campo === 'estado' && x.antes === 'potencial' && x.despues === 'activo' && enSemana(fechaDeMarca(x.fecha)))
    .map((x) => porId.get(x.entidadId)).filter((c, i, arr) => c && !c.borrado && c.estado === 'activo' && arr.indexOf(c) === i);
  const potencialesLlamados = semana.dias.flatMap((d) => d.items)
    .filter((it) => it.cliente.estado === 'potencial' && it.registro?.resultado);

  const recordatoriosPendientes = recordatoriosDelDia(recordatorios, fechaRef)
    .map((r) => ({ recordatorio: r, cliente: r.clienteId ? porId.get(r.clienteId) : null }))
    .filter((x) => !x.recordatorio.clienteId || (x.cliente && !x.cliente.borrado));

  const icg = cambiosParaICG({ cambios, clientes });

  return {
    lunes, viernes, domingo, fechaRef, terminada: fechaRef >= viernes, semana, pedidos, sinLlamar, riesgo,
    bajas, vacaciones, nuevosClientes, nuevosPotenciales, pasanACliente, potencialesLlamados,
    recordatoriosPendientes, cambiosICG: icg.filas, idsCambiosICG: icg.ids,
    // Para el Excel
    clientes: vivos, llamadas, recordatorios, mapaRiesgo, ultimos: ultimosPedidos(llamadas),
  };
}

// ---------------------------------------------------------------------
//  Texto del resumen semanal (WhatsApp: *negrita*, _cursiva_)
// ---------------------------------------------------------------------

const nombreYPueblo = (c) => capitalizar(c.nombreComercial) + (c.poblacion ? ` (${capitalizar(c.poblacion)})` : '');
const recortar = (s, n = 110) => {
  const t = String(s || '').replace(/\s*\n\s*/g, ' · ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

export function textoResumenSemanal(d, comercial) {
  const L = [];
  L.push(`*RESUMEN SEMANA ${fechaCorta(d.lunes)} – ${fechaCorta(d.viernes)}*`);
  L.push(`${comercial || 'Comercial'} · VinOliva`);
  if (!d.terminada) L.push(`_Hasta el ${DIAS[diaSemana(d.fechaRef)]} ${fechaCorta(d.fechaRef)}: la semana aún no ha terminado._`);

  const seccion = (titulo, items, fmt, max = 30, vacio = null) => {
    if (!items.length && vacio == null) return;
    L.push('', `*${titulo}${items.length ? ` (${items.length})` : ''}*`);
    if (!items.length) { L.push(vacio); return; }
    for (const it of items.slice(0, max)) L.push('• ' + fmt(it));
    if (items.length > max) L.push(`… y ${items.length - max} más (en el Excel)`);
  };

  L.push('', '*LLAMADAS*');
  const linea = (k) => `${k.llamados} ${k.llamados === 1 ? 'llamado' : 'llamados'} · ${k.pide} pide · ${k.noPide} no pide · ${k.noContesta} no contesta · ${k.pendientes} sin llamar${k.porLlamar ? ` · ${k.porLlamar} por llamar` : ''}`;
  for (const dia of d.semana.dias) {
    if (dia.fecha > d.fechaRef) continue;
    L.push(`${dia3(dia.fecha)}: ${dia.cuentas.clientes ? linea(dia.cuentas) : 'sin clientes'}`);
  }
  L.push(`*Total:* ${linea(d.semana.total)}`);

  seccion('PEDIDOS', d.pedidos, (p) => {
    const origen = ORIGENES_PEDIDO[p.registro.origen] ? ` · ${ORIGENES_PEDIDO[p.registro.origen].toLowerCase()}` : '';
    const txt = p.registro.pedido ? `: ${recortar(p.registro.pedido)}` : '';
    return `${nombreYPueblo(p.cliente)} · ${dia3(p.fecha)} ${fechaCorta(p.fecha)}${origen}${txt}` +
      (p.registro.enviadoOficina ? '' : ' _(no enviado a oficina)_');
  }, 40, 'Ninguno');
  seccion('SIN LLAMAR O SIN LOCALIZAR', d.sinLlamar, (x) =>
    `${nombreYPueblo(x.cliente)} · ${dia3(x.fecha)} · ${NOMBRE_SITUACION[x.situacion].toLowerCase()}`);
  seccion('EN RIESGO', d.riesgo, (x) => `${nombreYPueblo(x.cliente)} · ${x.semanas} semanas sin pedir`);
  seccion('BAJAS NUEVAS', d.bajas, (c) => `${nombreYPueblo(c)}${c.motivoBaja ? ' · ' + c.motivoBaja : ''}`);
  seccion('VACACIONES', d.vacaciones, (c) => `${nombreYPueblo(c)} · ${c.vacacionesHasta ? 'vuelve el ' + fechaCorta(c.vacacionesHasta) : 'sin fecha de vuelta'}`);
  seccion('CLIENTES NUEVOS', d.nuevosClientes, (c) => nombreYPueblo(c));
  seccion('POTENCIALES NUEVOS', d.nuevosPotenciales, (c) => nombreYPueblo(c));
  seccion('PASAN DE POTENCIAL A CLIENTE', d.pasanACliente, (c) => nombreYPueblo(c));
  seccion('POTENCIALES LLAMADOS', d.potencialesLlamados, (it) => `${nombreYPueblo(it.cliente)} · ${NOMBRE_SITUACION[it.registro.resultado] || it.registro.resultado}`);
  seccion('RECORDATORIOS SIN HACER', d.recordatoriosPendientes, (x) =>
    `${fechaCorta(x.recordatorio.fecha)} · ${recortar(x.recordatorio.texto, 80)}${x.cliente ? ' · ' + capitalizar(x.cliente.nombreComercial) : ''}`);
  seccion('CAMBIOS PARA ACTUALIZAR EN ICG', d.cambiosICG, (x) => x.tipo === 'nuevo'
    ? `NUEVO: ${capitalizar(x.cliente)}${x.codigo ? ' (' + x.codigo + ')' : ''}: ${x.despues}`
    : `${capitalizar(x.cliente)}${x.codigo ? ' (' + x.codigo + ')' : ''} · ${x.campo}: ${x.antes} → ${x.despues}`, 60);
  return L.join('\n');
}

// ---------------------------------------------------------------------
//  Excel semanal: una hoja por tipo de dato, columnas fijas
// ---------------------------------------------------------------------

export const COLUMNAS_COMUNES = ['Comercial', 'Semana', 'Código', 'Cliente'];
export const COLUMNAS_EXCEL_SEMANAL = {
  Resumen: ['Día', 'Fecha', 'Clientes del día', 'Llamados', 'Pide', 'No pide', 'No contesta', 'Sin llamar', 'Por llamar'],
  Llamadas: ['Fecha prevista', 'Día', 'Población', 'Resultado', 'Cómo', 'Nº intentos', 'Hora último intento', 'WhatsApp enviado', 'Apuntado el'],
  Pedidos: ['Fecha', 'Hora', 'Población', 'Cómo llegó', 'Pedido', 'Enviado a oficina', 'Hora de envío'],
  Clientes: ['Nombre fiscal', 'Población', 'Zona', 'Contacto', 'Días de llamada', 'Estado', 'Importante', 'Último pedido',
    'Semanas sin pedir', 'En riesgo', 'Cobro pendiente €', 'Nota del cobro', 'Pide habitualmente', 'Condiciones', 'Id interno'],
  'Cambios ICG': ['Fecha del cambio', 'Campo', 'Antes', 'Después', '¿Cliente nuevo?'],
  Recordatorios: ['Fecha', 'Texto', 'Estado', 'Hecho el'],
};

const siNo = (v) => (v ? 'Sí' : 'No');
const textoOrigen = (o) => ORIGENES_PEDIDO[o] || 'Llamada';
const marcaEnvio = (m) => (m ? String(m).replace('T', ' ').slice(0, 16) : '');

/** Devuelve { nombreHoja: [cabecera, ...filas] } (arrays listos para SheetJS). */
export function hojasExcelSemanal(d, comercial) {
  const com = comercial || 'Comercial';
  const pre = (c) => [com, d.lunes, c?.codigo || '', c?.nombreComercial || ''];
  const hojas = {};
  const crear = (nombre, filas) => { hojas[nombre] = [[...COLUMNAS_COMUNES, ...COLUMNAS_EXCEL_SEMANAL[nombre]], ...filas]; };

  crear('Resumen', [
    ...d.semana.dias.map((dia) => [com, d.lunes, '', '', capitalizarPrimera(DIAS[dia.dia]), dia.fecha,
      dia.cuentas.clientes, dia.cuentas.llamados, dia.cuentas.pide, dia.cuentas.noPide, dia.cuentas.noContesta, dia.cuentas.pendientes, dia.cuentas.porLlamar]),
    [com, d.lunes, '', '', 'Total', '', d.semana.total.clientes, d.semana.total.llamados, d.semana.total.pide,
      d.semana.total.noPide, d.semana.total.noContesta, d.semana.total.pendientes, d.semana.total.porLlamar],
  ]);

  // Llamadas: cada cliente en cada día que le tocaba + los registros de otros días (pedidos fuera de día…)
  const filasLl = [];
  const vistos = new Set();
  for (const dia of d.semana.dias) {
    for (const it of dia.items) {
      const r = it.registro;
      if (r) vistos.add(r.id);
      const u = ultimoIntento(r);
      filasLl.push([...pre(it.cliente), dia.fecha, capitalizarPrimera(DIAS[dia.dia]), it.cliente.poblacion || '',
        NOMBRE_SITUACION[it.situacion] || it.situacion, r ? textoOrigen(r.origen) : '', r?.intentos?.length || 0,
        u?.hora || '', siNo((r?.intentos || []).some((i) => i.whatsapp)), r?.fecha && r.intentos?.length ? r.fecha : '']);
    }
  }
  const porId = new Map(d.clientes.map((c) => [c.id, c]));
  for (const r of d.llamadas) {
    if (r.borrado || vistos.has(r.id) || !r.intentos?.length) continue;
    if (!((r.fechaPrevista >= d.lunes && r.fechaPrevista <= d.domingo) || (r.fecha >= d.lunes && r.fecha <= d.domingo))) continue;
    const c = porId.get(r.clienteId);
    if (!c) continue;
    const u = ultimoIntento(r);
    filasLl.push([...pre(c), r.fechaPrevista, capitalizarPrimera(DIAS[diaSemana(r.fechaPrevista)]), c.poblacion || '',
      NOMBRE_SITUACION[r.resultado] || (r.volverALlamarDesde ? 'Más tarde' : ''), textoOrigen(r.origen), r.intentos.length,
      u?.hora || '', siNo(r.intentos.some((i) => i.whatsapp)), r.fecha || '']);
  }
  filasLl.sort((a, b) => a[4].localeCompare(b[4]) || compararTexto(a[3], b[3]));
  crear('Llamadas', filasLl);

  crear('Pedidos', d.pedidos.map((p) => [...pre(p.cliente), p.fecha, p.hora, p.cliente.poblacion || '',
    textoOrigen(p.registro.origen), p.registro.pedido || '', siNo(p.registro.enviadoOficina), marcaEnvio(p.registro.horaEnviadoOficina)]));

  crear('Clientes', [...d.clientes]
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }) || compararTexto(a.nombreComercial, b.nombreComercial))
    .map((c) => {
      const ultimo = d.ultimos.get(c.id) || '';
      return [...pre(c), c.nombreFiscal || '', c.poblacion || '', c.zona || '', c.contacto || '',
        (c.diasLlamada || []).map((x) => DIAS_EXCEL[x]).join(', '), NOMBRE_ESTADO[c.estado] || c.estado, c.importante ? 'Sí' : '',
        ultimo, ultimo ? Math.floor(diasEntre(ultimo, d.fechaRef) / 7) : '', d.mapaRiesgo.has(c.id) ? 'Sí' : '',
        c.pendienteCobro?.importe ?? '', c.pendienteCobro?.nota || '', c.pideHabitualmente || '', c.condiciones || '', c.id];
    }));

  crear('Cambios ICG', d.cambiosICG.map((x) => [com, d.lunes, x.codigo, x.cliente, x.fecha, x.campo, x.antes, x.despues, x.tipo === 'nuevo' ? 'Sí' : '']));

  const recs = d.recordatorios.filter((r) => !r.borrado && r.fecha && r.fecha <= d.domingo &&
    (r.fecha >= d.lunes || !r.hecho || (r.fechaHecho && r.fechaHecho >= d.lunes)));
  crear('Recordatorios', recs.sort((a, b) => a.fecha.localeCompare(b.fecha)).map((r) => {
    const c = r.clienteId ? porId.get(r.clienteId) : null;
    const estado = r.hecho ? 'Hecho' : r.fecha < d.fechaRef ? 'Vencido' : 'Pendiente';
    return [...pre(c), r.fecha, r.texto, estado, r.fechaHecho || ''];
  }));
  return hojas;
}

// ---------------------------------------------------------------------
//  Historial completo de llamadas y pedidos
// ---------------------------------------------------------------------

export const COLUMNAS_HISTORIAL = ['Comercial', 'Fecha prevista', 'Día', 'Código', 'Cliente', 'Población', 'Resultado',
  'Cómo', 'Pedido', 'Nota', 'Intentos', 'Enviado a oficina', 'Apuntado el', 'Id registro'];

export function filasHistorial({ llamadas, clientes, comercial }) {
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const filas = llamadas
    .filter((r) => !r.borrado && (r.intentos?.length || r.resultado))
    .sort((a, b) => String(a.fechaPrevista).localeCompare(String(b.fechaPrevista)) || String(a.modificado).localeCompare(String(b.modificado)))
    .map((r) => {
      const c = porId.get(r.clienteId) || {};
      const intentos = (r.intentos || []).map((i) => `${i.hora} ${NOMBRE_SITUACION[i.resultado] || i.resultado}` +
        `${i.volverA ? ' (' + i.volverA + ')' : ''}${i.whatsapp ? ' + WhatsApp' : ''}`).join(' · ');
      return [comercial || 'Comercial', r.fechaPrevista, capitalizarPrimera(DIAS[diaSemana(r.fechaPrevista)]), c.codigo || '',
        c.nombreComercial || '(cliente borrado)', c.poblacion || '',
        NOMBRE_SITUACION[r.resultado] || (r.volverALlamarDesde ? 'Más tarde' : ''), textoOrigen(r.origen), r.pedido || '',
        r.nota || '', intentos, r.resultado === 'pide' ? siNo(r.enviadoOficina) : '', r.fecha || '', r.id];
    });
  return [COLUMNAS_HISTORIAL, ...filas];
}

