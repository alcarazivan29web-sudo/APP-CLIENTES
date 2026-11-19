// =====================================================================
//  crm.js · Excel para el CRM de la oficina (fase 7).
//
//  Es un CONTRATO con el CRM: las hojas y las columnas tienen nombre fijo
//  y no se cambian sin subir FORMATO_CRM y avisar (ver
//  docs/FORMATO_EXCEL_CRM.md). Siempre lleva TODO el historial: el CRM lo
//  importa sin duplicar gracias a los ids.
//  Funciones puras: se prueban con node.
// =====================================================================

import {
  DIAS_EXCEL, NOMBRE_SITUACION, telefonosConNombre, telefonosPara, textoCondicion, faltaPorConfigurar,
  textoFalta, estadoEnFecha, normalizarTexto,
} from './logica.js';

export const FORMATO_CRM = 1;

export const COLUMNAS_CRM = {
  Info: ['Dato', 'Valor'],
  Clientes: [
    'Id cliente', 'Comercial', 'Código ICG', 'Nombre comercial', 'Nombre fiscal', 'Población', 'Dirección',
    'Zona / ruta', 'Contacto', 'Teléfono', 'Otros teléfonos', 'Teléfonos con nombre', 'Email', 'Días de llamada',
    'Día que cierra', 'Hora de apertura', 'Llamar a partir de', 'Forma de pago', 'Estado', 'Vacaciones desde',
    'Vacaciones hasta', 'Fecha de baja', 'Motivo de baja', 'Importante', 'Pide habitualmente', 'Otras condiciones',
    'Condiciones especiales', 'Cobro pendiente (€)', 'Nota del cobro', 'Notas', 'Falta por configurar',
    'Creado', 'Modificado', 'Borrado en la app',
  ],
  Llamadas: [
    'Id llamada', 'Id cliente', 'Comercial', 'Código ICG', 'Cliente', 'Población', 'Fecha', 'Fecha prevista', 'Hora',
    'Resultado', 'Resultado (texto)', 'Hubo pedido', 'Pedido', 'Cómo', 'Nota', 'Nº intentos', 'Intentos',
    'WhatsApp enviado', 'Pendiente de volver a llamar', 'Volver a llamar a las', 'Enviado a la oficina',
    'Hora de envío a la oficina', 'Modificado', 'Anulada',
  ],
};

/** Valores cerrados (el CRM los mapea a sus listas). */
export const RESULTADOS_CRM = ['pide', 'no_pide', 'no_contesta', 'mas_tarde', 'whatsapp'];
export const ESTADOS_CRM = ['activo', 'vacaciones', 'baja', 'potencial'];
export const COMO_CRM = ['llamada', 'cliente_llama', 'whatsapp', 'visita'];

const siNo = (v) => (v ? 'Sí' : 'No');
const tieneActividad = (r) => !!((r.intentos || []).length || r.resultado);

/** 'Juan Bonilla' → 'juan-bonilla' (para el nombre del archivo). */
export function nombreArchivoCRM(comercial, fecha) {
  const slug = normalizarTexto(comercial || 'comercial').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'comercial';
  return `crm_${slug}_${fecha}.xlsx`;
}

/** ¿Queda pendiente de volver a llamar? Solo si es lo último que pasó con ese cliente. */
function pendientes(llamadas) {
  const ultimo = new Map();
  for (const r of llamadas) {
    if (r.borrado || !tieneActividad(r)) continue;
    const clave = `${r.fecha || r.fechaPrevista}|${r.modificado || ''}`;
    const prev = ultimo.get(r.clienteId);
    if (!prev || clave > prev.clave) ultimo.set(r.clienteId, { clave, id: r.id });
  }
  const out = new Set();
  for (const r of llamadas) {
    if (ultimo.get(r.clienteId)?.id !== r.id) continue;
    if (r.resultado === 'no_contesta' || (!r.resultado && r.volverALlamarDesde)) out.add(r.id);
  }
  return out;
}

/**
 * Hojas del Excel para el CRM: { Info, Clientes, Llamadas }.
 * clientes y llamadas deben incluir los borrados (salen marcados).
 */
export function hojasExcelCRM({ clientes, llamadas, comercial, dispositivoId, exportado, fecha, version }) {
  const nombre = comercial || 'Comercial';
  const porId = new Map(clientes.map((c) => [c.id, c]));

  const filasClientes = [...clientes]
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }) || String(a.nombreComercial).localeCompare(String(b.nombreComercial), 'es'))
    .map((c) => {
      const tels = c.telefonos || [];
      const principal = telefonosPara(c, 'llamar')[0]?.numero || tels[0] || '';
      return [
        c.id, nombre, c.codigo || '', c.nombreComercial || '', c.nombreFiscal || '', c.poblacion || '', c.direccion || '',
        c.zona || '', c.contacto || '', principal, tels.filter((t) => t !== principal).join(', '), telefonosConNombre(c),
        c.email || '', (c.diasLlamada || []).map((d) => DIAS_EXCEL[d]).join(', '),
        c.diaCierre || '', c.horaApertura || '', c.llamarDesde || '', c.formaPago || '', estadoEnFecha(c, fecha),
        c.vacacionesDesde || '', c.vacacionesHasta || '', c.fechaBaja || '', c.motivoBaja || '', siNo(c.importante),
        c.pideHabitualmente || '', c.condiciones || '',
        (c.condicionesEspeciales || []).map((x) => textoCondicion(x, { conHasta: true })).join(' · '),
        c.pendienteCobro?.importe ?? '', c.pendienteCobro?.nota || '', c.notas || '',
        c.borrado ? '' : textoFalta(faltaPorConfigurar(c).todo).replace(/^Falta: /, ''),
        c.creado || '', c.modificado || '', siNo(c.borrado),
      ];
    });

  const pend = pendientes(llamadas);
  const filasLlamadas = llamadas
    .filter((r) => tieneActividad(r) || r.borrado)
    .sort((a, b) => String(a.fecha || a.fechaPrevista).localeCompare(String(b.fecha || b.fechaPrevista)) || String(a.modificado).localeCompare(String(b.modificado)))
    .map((r) => {
      const c = porId.get(r.clienteId) || {};
      const intentos = r.intentos || [];
      const ultimo = intentos[intentos.length - 1];
      const resultado = r.resultado || (r.volverALlamarDesde ? 'mas_tarde' : '');
      const anulada = r.borrado || !tieneActividad(r);
      return [
        r.id, r.clienteId || '', nombre, c.codigo || '', c.nombreComercial || '(cliente borrado)', c.poblacion || '',
        r.fecha || r.fechaPrevista || '', r.fechaPrevista || '', ultimo?.hora || '',
        anulada ? '' : resultado, anulada ? '' : (NOMBRE_SITUACION[resultado] || (resultado === 'whatsapp' ? 'WhatsApp' : '')),
        siNo(!anulada && r.resultado === 'pide'), r.resultado === 'pide' ? (r.pedido || '') : '', r.origen || 'llamada', r.nota || '',
        intentos.length,
        intentos.map((i) => `${i.hora} ${NOMBRE_SITUACION[i.resultado] || i.resultado}` +
          `${i.volverA ? ' (' + i.volverA + ')' : ''}${i.whatsapp ? ' + WhatsApp' : ''}`).join(' · '),
        siNo(intentos.some((i) => i.whatsapp)), siNo(!anulada && pend.has(r.id)), r.volverALlamarDesde || '',
        r.resultado === 'pide' ? siNo(r.enviadoOficina) : '', r.horaEnviadoOficina || '',
        r.modificado || '', siNo(anulada),
      ];
    });

  const info = [
    ['Formato', `CRM VinOliva v${FORMATO_CRM}`],
    ['Comercial', nombre],
    ['Id del móvil', dispositivoId || ''],
    ['Exportado', exportado || ''],
    ['Versión de la app', version || ''],
    ['Clientes', clientes.filter((c) => !c.borrado).length],
    ['Llamadas', filasLlamadas.filter((f) => f[f.length - 1] === 'No').length],
  ];

  return {
    Info: [COLUMNAS_CRM.Info, ...info],
    Clientes: [COLUMNAS_CRM.Clientes, ...filasClientes],
    Llamadas: [COLUMNAS_CRM.Llamadas, ...filasLlamadas],
  };
}
