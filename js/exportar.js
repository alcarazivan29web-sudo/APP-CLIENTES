// =====================================================================
//  exportar.js · Exportar clientes a Excel y copia de seguridad en JSON.
// =====================================================================

import * as datos from './datos.js';
import {
  DIAS_EXCEL, NOMBRE_ESTADO, fechaNormal, telefonosConNombre, textoCondicion, faltaPorConfigurar, textoFalta,
  tituloEncargo, telefonosPara, textoTelefono,
} from './logica.js';
import {
  hojasExcelSemanal, nombreExcelSemanal, filasHistorial, nombreArchivoComercial, COLUMNAS_COMUNES,
} from './informes.js';
import { compartirArchivo } from './ui.js';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Mismas columnas que la importación y, al final, las columnas nuevas de la app. */
export function filasExportacionClientes(clientes) {
  const cabecera = ['ID', 'Nombre comercial', 'Nombre fiscal', 'Población', 'Dirección', 'Zona / ruta', 'Contacto', 'Teléfono',
    'Teléfono 2', 'Email', 'Días de llamada', 'Día que cierra', 'Forma de pago', 'Hora de apertura', 'Notas', 'Hojas de origen',
    'Estado', 'Vacaciones desde', 'Vacaciones hasta', 'Fecha de baja', 'Motivo de baja', 'Importante',
    'Pide habitualmente', 'Condiciones', 'Cobro pendiente (€)', 'Nota de cobro',
    'Teléfonos con nombre', 'Llamar a partir de', 'Condiciones especiales', 'Falta por configurar', 'Id interno'];
  const filas = clientes.map((c) => [
    c.codigo, c.nombreComercial, c.nombreFiscal, c.poblacion, c.direccion || '', c.zona, c.contacto,
    c.telefonos?.[0] || '', (c.telefonos || []).slice(1).join(', '), c.email || '',
    (c.diasLlamada || []).map((d) => DIAS_EXCEL[d]).join(', '),
    c.diaCierre, c.formaPago, c.horaApertura || '', c.notas, c.hojasOrigen,
    NOMBRE_ESTADO[c.estado] || c.estado, fechaNormal(c.vacacionesDesde), fechaNormal(c.vacacionesHasta),
    fechaNormal(c.fechaBaja), c.motivoBaja, c.importante ? 'Sí' : '',
    c.pideHabitualmente, c.condiciones, c.pendienteCobro?.importe ?? '', c.pendienteCobro?.nota ?? '',
    telefonosConNombre(c), c.llamarDesde || '',
    (c.condicionesEspeciales || []).map((x) => textoCondicion(x)).join(' · '),
    textoFalta(faltaPorConfigurar(c).todo).replace(/^Falta: /, ''), c.id,
  ]);
  return [cabecera, ...filas];
}

function libroExcel(nombreHoja, filas, anchos) {
  return libroVariasHojas({ [nombreHoja]: filas }, { [nombreHoja]: anchos });
}

/** hojas: { nombre: [cabecera, ...filas] }. Anchos automáticos si no se dan. */
function libroVariasHojas(hojas, anchos = {}) {
  const XLSX = globalThis.XLSX;
  if (!XLSX) throw new Error('No se ha cargado la librería de Excel.');
  const libro = XLSX.utils.book_new();
  for (const [nombre, filas] of Object.entries(hojas)) {
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    const w = anchos[nombre] || (filas[0] || []).map((_, i) =>
      Math.min(50, Math.max(8, ...filas.slice(0, 200).map((f) => String(f[i] ?? '').length + 2))));
    hoja['!cols'] = w.map((x) => ({ wch: x }));
    if (filas.length) hoja['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: (filas[0] || []).length - 1 } }) };
    XLSX.utils.book_append_sheet(libro, hoja, nombre);
  }
  return new Blob([XLSX.write(libro, { bookType: 'xlsx', type: 'array' })], { type: TIPO_XLSX });
}

/** Excel de la semana para la oficina (formato fijo, una hoja por tipo de dato). */
export async function exportarExcelSemanal(datosDeLaSemana, comercial) {
  const blob = libroVariasHojas(hojasExcelSemanal(datosDeLaSemana, comercial));
  return compartirArchivo(blob, nombreExcelSemanal(datosDeLaSemana.lunes, comercial), 'Excel de la semana');
}

/** Todo el historial de llamadas y pedidos desde el primer día. */
export async function exportarHistorial(fecha) {
  const comercial = datos.obtenerAjustes().nombreComercial;
  const filas = filasHistorial({ llamadas: datos.obtenerLlamadas(), clientes: datos.obtenerClientes({ incluirBorrados: true }), comercial });
  const blob = libroVariasHojas({ Historial: filas });
  return compartirArchivo(blob, `historial_${fecha}_${nombreArchivoComercial(comercial)}.xlsx`, 'Historial');
}

/** Cambios para ICG en Excel. */
export async function exportarCambiosICG(filasICG, fecha) {
  const comercial = datos.obtenerAjustes().nombreComercial || 'Comercial';
  const filas = [
    [...COLUMNAS_COMUNES.filter((c) => c !== 'Semana'), 'Fecha del cambio', 'Campo', 'Antes', 'Después', '¿Cliente nuevo?'],
    ...filasICG.map((x) => [comercial, x.codigo, x.cliente, x.fecha, x.campo, x.antes, x.despues, x.tipo === 'nuevo' ? 'Sí' : '']),
  ];
  const blob = libroVariasHojas({ 'Cambios ICG': filas });
  return compartirArchivo(blob, `cambios_icg_${fecha}_${nombreArchivoComercial(comercial)}.xlsx`, 'Cambios para ICG');
}

/** Lista de clientes de un encargo (cuando son muchos, la oficina lo tiene más cómodo en Excel). */
export function filasListaEncargo(encargo, clientes, comercial) {
  const cab = ['Comercial', 'Fecha', 'Encargo', 'Nota', 'Código', 'Cliente', 'Población', 'Contacto', 'WhatsApp', 'Teléfono para llamar'];
  return [cab, ...clientes.map((c) => [comercial, encargo.fecha, tituloEncargo(encargo), encargo.nota || '', c.codigo || '',
    c.nombreComercial, c.poblacion || '', c.contacto || '',
    telefonosPara(c, 'whatsapp')[0] ? textoTelefono(telefonosPara(c, 'whatsapp')[0]) : '',
    telefonosPara(c, 'llamar')[0] ? textoTelefono(telefonosPara(c, 'llamar')[0]) : ''])];
}

export async function exportarListaEncargo(encargo, clientes, fecha) {
  const comercial = datos.obtenerAjustes().nombreComercial || 'Comercial';
  const blob = libroVariasHojas({ Encargo: filasListaEncargo(encargo, clientes, comercial) });
  return compartirArchivo(blob, `encargo_${fecha}_${nombreArchivoComercial(comercial)}.xlsx`, 'Encargo para la oficina');
}

export async function exportarClientesExcel(fecha) {
  const clientes = datos.obtenerClientes().sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
  const blob = libroExcel('Clientes', filasExportacionClientes(clientes),
    [7, 32, 32, 18, 32, 24, 16, 13, 24, 28, 22, 18, 16, 10, 40, 20, 11, 12, 12, 12, 24, 10, 30, 30, 12, 20, 40, 10, 40, 30, 38]);
  return compartirArchivo(blob, `clientes_${fecha}.xlsx`, 'Clientes');
}

export async function hacerCopiaSeguridad(fecha) {
  const copia = await datos.exportarCopia();
  const blob = new Blob([JSON.stringify(copia)], { type: 'application/json' });
  const r = await compartirArchivo(blob, `copia_llamadas_${fecha}.json`, 'Copia de seguridad');
  if (r !== 'cancelado') await datos.guardarAjustes({ ultimaCopia: copia.exportado });
  return { resultado: r, copia };
}
