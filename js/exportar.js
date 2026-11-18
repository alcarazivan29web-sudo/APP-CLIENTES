// =====================================================================
//  exportar.js · Exportar clientes a Excel y copia de seguridad en JSON.
// =====================================================================

import * as datos from './datos.js';
import { DIAS_EXCEL, NOMBRE_ESTADO, fechaNormal } from './logica.js';
import { compartirArchivo } from './ui.js';

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Mismas columnas que la importación y, al final, las columnas nuevas de la app. */
export function filasExportacionClientes(clientes) {
  const cabecera = ['ID', 'Nombre comercial', 'Nombre fiscal', 'Población', 'Zona / ruta', 'Contacto', 'Teléfono',
    'Teléfono 2', 'Días de llamada', 'Día que cierra', 'Forma de pago', 'Hora de apertura', 'Notas', 'Hojas de origen',
    'Estado', 'Vacaciones desde', 'Vacaciones hasta', 'Fecha de baja', 'Motivo de baja', 'Importante',
    'Pide habitualmente', 'Condiciones', 'Cobro pendiente (€)', 'Nota de cobro', 'Id interno'];
  const filas = clientes.map((c) => [
    c.codigo, c.nombreComercial, c.nombreFiscal, c.poblacion, c.zona, c.contacto,
    c.telefonos?.[0] || '', (c.telefonos || []).slice(1).join(', '),
    (c.diasLlamada || []).map((d) => DIAS_EXCEL[d]).join(', '),
    c.diaCierre, c.formaPago, c.horaApertura || '', c.notas, c.hojasOrigen,
    NOMBRE_ESTADO[c.estado] || c.estado, fechaNormal(c.vacacionesDesde), fechaNormal(c.vacacionesHasta),
    fechaNormal(c.fechaBaja), c.motivoBaja, c.importante ? 'Sí' : '',
    c.pideHabitualmente, c.condiciones, c.pendienteCobro?.importe ?? '', c.pendienteCobro?.nota ?? '', c.id,
  ]);
  return [cabecera, ...filas];
}

function libroExcel(nombreHoja, filas, anchos) {
  const XLSX = globalThis.XLSX;
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  if (anchos) hoja['!cols'] = anchos.map((w) => ({ wch: w }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  return new Blob([XLSX.write(libro, { bookType: 'xlsx', type: 'array' })], { type: TIPO_XLSX });
}

export async function exportarClientesExcel(fecha) {
  const clientes = datos.obtenerClientes().sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }));
  const blob = libroExcel('Clientes', filasExportacionClientes(clientes),
    [7, 32, 32, 18, 24, 16, 13, 24, 22, 18, 16, 10, 40, 20, 11, 12, 12, 12, 24, 10, 30, 30, 12, 20, 38]);
  return compartirArchivo(blob, `clientes_${fecha}.xlsx`, 'Clientes');
}

export async function hacerCopiaSeguridad(fecha) {
  const copia = await datos.exportarCopia();
  const blob = new Blob([JSON.stringify(copia)], { type: 'application/json' });
  const r = await compartirArchivo(blob, `copia_llamadas_${fecha}.json`, 'Copia de seguridad');
  if (r !== 'cancelado') await datos.guardarAjustes({ ultimaCopia: copia.exportado });
  return { resultado: r, copia };
}
