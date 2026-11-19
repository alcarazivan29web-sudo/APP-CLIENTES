// =====================================================================
//  importar.js · Leer el Excel/CSV de clientes y preparar la importación.
//  filasAClientes() y planificarImportacion() son puras (se prueban con
//  node). leerArchivo() usa SheetJS (lib/xlsx.full.min.js) en el navegador.
// =====================================================================

import {
  normalizarTexto, analizarDias, analizarHora, extraerTelefonos, clienteVacio, analizarFecha, promocionVacia,
  leerTelefonosConNombre,
} from './logica.js';

/** Columnas conocidas del Excel → campo de la app. Las demás se ignoran. */
export const COLUMNAS_CLIENTES = {
  codigo: ['ID', 'CODIGO', 'COD', 'CODIGO CLIENTE'],
  nombreComercial: ['NOMBRE COMERCIAL', 'NOMBRE', 'CLIENTE'],
  nombreFiscal: ['NOMBRE FISCAL', 'RAZON SOCIAL'],
  poblacion: ['POBLACION', 'LOCALIDAD', 'MUNICIPIO'],
  zona: ['ZONA / RUTA', 'ZONA/RUTA', 'ZONA', 'RUTA'],
  contacto: ['CONTACTO', 'PERSONA DE CONTACTO'],
  telefono1: ['TELEFONO', 'TELEFONO 1', 'TEL', 'MOVIL'],
  telefono2: ['TELEFONO 2', 'TEL 2', 'OTROS TELEFONOS'],
  telefonosConNombre: ['TELEFONOS CON NOMBRE'],
  llamarDesde: ['LLAMAR A PARTIR DE', 'LLAMAR DESDE', 'MEJOR HORA PARA LLAMAR'],
  diasLlamada: ['DIAS DE LLAMADA', 'DIA DE LLAMADA', 'DIAS LLAMADA', 'DIAS'],
  diaCierre: ['DIA QUE CIERRA', 'CIERRA', 'DIA DE CIERRE', 'CIERRE'],
  formaPago: ['FORMA DE PAGO', 'PAGO'],
  horaApertura: ['HORA DE APERTURA', 'APERTURA', 'ABRE'],
  notas: ['NOTAS', 'OBSERVACIONES'],
  hojasOrigen: ['HOJAS DE ORIGEN'],
};

/** Campos que vienen del Excel y que una nueva importación puede actualizar. */
export const CAMPOS_EXCEL = ['codigo', 'nombreComercial', 'nombreFiscal', 'poblacion', 'zona', 'contacto',
  'telefonos', 'telefonosInfo', 'diasLlamada', 'diaCierre', 'formaPago', 'horaApertura', 'llamarDesde', 'notas', 'hojasOrigen'];

function mapaCabeceras(cabecera) {
  const mapa = {};
  const ignoradas = [];
  cabecera.forEach((h, i) => {
    const n = normalizarTexto(h);
    if (!n) return;
    const campo = Object.keys(COLUMNAS_CLIENTES).find((k) => COLUMNAS_CLIENTES[k].includes(n));
    if (campo && mapa[campo] === undefined) mapa[campo] = i;
    else ignoradas.push(String(h));
  });
  return { mapa, ignoradas };
}

const texto = (v) => (v == null ? '' : String(v).trim());
const vacio = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

/** Convierte las filas de la hoja (array de arrays, la primera es la cabecera)
 *  en datos de cliente. No guarda nada. */
export function filasAClientes(filas) {
  const avisos = [];
  if (!filas || !filas.length) return { clientes: [], avisos: ['El archivo está vacío.'], columnas: new Set(), ignoradas: [] };
  // La cabecera es la primera fila que tenga «Nombre comercial» o «ID»
  let iCab = filas.findIndex((f) => (f || []).some((c) => ['NOMBRE COMERCIAL', 'ID', 'NOMBRE'].includes(normalizarTexto(c))));
  if (iCab < 0) iCab = 0;
  const { mapa, ignoradas } = mapaCabeceras(filas[iCab]);
  if (mapa.nombreComercial === undefined) {
    return { clientes: [], avisos: ['No encuentro la columna «Nombre comercial».'], columnas: new Set(), ignoradas };
  }
  const col = (fila, campo) => (mapa[campo] === undefined ? undefined : fila[mapa[campo]]);
  const columnas = new Set(Object.keys(mapa));
  if (columnas.has('telefono1') || columnas.has('telefono2') || columnas.has('telefonosConNombre')) columnas.add('telefonos');
  if (columnas.has('telefonosConNombre')) columnas.add('telefonosInfo');

  const clientes = [];
  const vistos = new Map();
  for (let i = iCab + 1; i < filas.length; i++) {
    const f = filas[i] || [];
    if (!f.some((v) => texto(v))) continue;
    const nFila = i + 1;
    const nombre = texto(col(f, 'nombreComercial')) || texto(col(f, 'nombreFiscal'));
    if (!nombre) { avisos.push(`Fila ${nFila}: sin nombre, no se importa.`); continue; }
    const dias = analizarDias(col(f, 'diasLlamada'));
    if (dias.desconocidos.length) avisos.push(`Fila ${nFila} (${nombre}): no entiendo «${dias.desconocidos.join(' ')}» en los días de llamada.`);
    if (dias.finDeSemana.length) avisos.push(`Fila ${nFila} (${nombre}): los días de llamada solo pueden ser de lunes a viernes; se ignora el fin de semana.`);
    const horaTxt = col(f, 'horaApertura');
    const hora = analizarHora(horaTxt);
    if (texto(horaTxt) && !hora) avisos.push(`Fila ${nFila} (${nombre}): no entiendo la hora de apertura «${texto(horaTxt)}».`);
    const llamarTxt = col(f, 'llamarDesde');
    const llamarDesde = analizarHora(llamarTxt);
    if (texto(llamarTxt) && !llamarDesde) avisos.push(`Fila ${nFila} (${nombre}): no entiendo la hora «${texto(llamarTxt)}» de «Llamar a partir de».`);
    // «Teléfonos con nombre» (lo escribe la propia app al exportar) añade nombres y uso
    const conNombre = leerTelefonosConNombre(col(f, 'telefonosConNombre'));
    const telefonos = extraerTelefonos(col(f, 'telefono1'), col(f, 'telefono2'));
    for (const t of conNombre.telefonos) if (!telefonos.includes(t)) telefonos.push(t);
    const c = {
      codigo: texto(col(f, 'codigo')),
      nombreComercial: nombre,
      nombreFiscal: texto(col(f, 'nombreFiscal')),
      poblacion: texto(col(f, 'poblacion')),
      zona: texto(col(f, 'zona')),
      contacto: texto(col(f, 'contacto')),
      telefonos,
      telefonosInfo: conNombre.info,
      diasLlamada: dias.dias,
      diaCierre: texto(col(f, 'diaCierre')),
      formaPago: texto(col(f, 'formaPago')),
      horaApertura: hora,
      llamarDesde,
      notas: texto(col(f, 'notas')),
      hojasOrigen: texto(col(f, 'hojasOrigen')),
      _fila: nFila,
    };
    if (c.codigo) {
      if (vistos.has(c.codigo)) {
        avisos.push(`Fila ${nFila}: el ID ${c.codigo} está repetido (fila ${vistos.get(c.codigo)}); se usa esta última.`);
        const j = clientes.findIndex((x) => x.codigo === c.codigo);
        clientes.splice(j, 1);
      }
      vistos.set(c.codigo, nFila);
    }
    clientes.push(c);
  }
  return { clientes, avisos, columnas, ignoradas };
}

function claveSinCodigo(c) {
  return normalizarTexto(c.nombreComercial) + '|' + normalizarTexto(c.poblacion);
}

/** ¿El Excel dice que el local está cerrado? ('CERRADO' en día que cierra o forma de pago) */
export function marcadoCerrado(c) {
  return normalizarTexto(c.diaCierre) === 'CERRADO' || normalizarTexto(c.formaPago) === 'CERRADO';
}

/** Compara lo que viene del archivo con lo que ya hay en el móvil.
 *  - Empareja por código (o, si no hay código, por nombre + población).
 *  - Actualiza los datos que vienen en el Excel; una celda VACÍA no borra
 *    un dato que ya exista en la app (por ejemplo, los días asignados).
 *  - Los teléfonos nuevos del Excel se añaden a los que ya tiene el móvil.
 *  - Conserva estado, historial, vacaciones y campos que solo están en la app.
 *  - Los clientes que no vienen en el archivo no se tocan. */
export function planificarImportacion(delArchivo, existentes, { fecha, archivo = '', columnas = null } = {}) {
  const cols = columnas || new Set(CAMPOS_EXCEL);
  const porCodigo = new Map();
  const porNombre = new Map();
  for (const e of existentes) {
    if (e.borrado) continue;
    if (e.codigo) porCodigo.set(e.codigo, e);
    else porNombre.set(claveSinCodigo(e), e);
  }
  const nuevos = [];
  const actualizaciones = [];
  let sinCambios = 0;
  const resumen = {
    total: delArchivo.length, nuevos: 0, actualizados: 0, sinCambios: 0,
    sinTelefono: 0, sinDia: 0, posibleDuplicado: 0, bajaCerrado: 0, sinCodigo: 0,
  };

  for (const d of delArchivo) {
    if (!d.telefonos.length) resumen.sinTelefono++;
    if (!d.diasLlamada.length) resumen.sinDia++;
    if (/POSIBLE DUPLICADO/i.test(d.notas)) resumen.posibleDuplicado++;
    if (!d.codigo) resumen.sinCodigo++;
    const existente = d.codigo ? porCodigo.get(d.codigo) : porNombre.get(claveSinCodigo(d));

    if (!existente) {
      const c = { ...clienteVacio() };
      for (const k of CAMPOS_EXCEL) c[k] = d[k];
      c.diasLlamadaDesde = fecha;
      c.origenImportacion = { archivo, fecha, fila: d._fila };
      if (marcadoCerrado(d)) {
        c.estado = 'baja';
        c.fechaBaja = fecha;
        c.motivoBaja = 'Cerrado (según Excel)';
        resumen.bajaCerrado++;
      }
      nuevos.push(c);
      continue;
    }

    const cambios = {};
    for (const k of CAMPOS_EXCEL) {
      if (k === 'telefonos' ? !cols.has('telefonos') : !cols.has(k)) continue;
      let nuevo = d[k];
      if (vacio(nuevo)) continue; // una celda vacía no borra datos de la app
      // Los nombres de teléfono se suman a los que ya tenga la app
      if (k === 'telefonosInfo') nuevo = { ...(existente.telefonosInfo || {}), ...nuevo };
      // Los teléfonos del Excel se AÑADEN a los del móvil (no se pierde el que haya
      // apuntado el comercial). Para quitar uno, se borra en la ficha.
      if (k === 'telefonos') nuevo = [...(existente.telefonos || []), ...nuevo.filter((t) => !(existente.telefonos || []).includes(t))];
      if (JSON.stringify(nuevo) !== JSON.stringify(existente[k] ?? null)) cambios[k] = nuevo;
    }
    if (cambios.diasLlamada) cambios.diasLlamadaDesde = fecha;
    if (Object.keys(cambios).length) {
      actualizaciones.push({ id: existente.id, nombre: existente.nombreComercial, cambios });
    } else sinCambios++;
  }
  resumen.nuevos = nuevos.length;
  resumen.actualizados = actualizaciones.length;
  resumen.sinCambios = sinCambios;
  return { nuevos, actualizaciones, resumen };
}

// ---------------------------------------------------------------------
//  Promociones
// ---------------------------------------------------------------------

export const COLUMNAS_PROMOS = {
  producto: ['PRODUCTO', 'ARTICULO', 'VINO'],
  detalle: ['DETALLE', 'DESCRIPCION'],
  precio: ['PRECIO (€)', 'PRECIO', 'PRECIO €', 'PVP'],
  promocion: ['PROMOCION', 'OFERTA', 'DESCUENTO'],
  desde: ['DESDE', 'INICIO', 'FECHA INICIO'],
  hasta: ['HASTA', 'FIN', 'FECHA FIN'],
  tipo: ['TIPO', 'CATEGORIA'],
};

/** '6,95 €' / 6.95 / '1.200,50' → número (o null). */
export function analizarPrecio(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).replace(/[€\s]/g, '');
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return s && isFinite(n) ? n : null;
}

/** Filas de la hoja «Promociones» → { promociones, avisos, ignoradas }.
 *  Se ignoran las filas vacías y las que empiezan por «EJEMPLO». */
export function filasAPromociones(filas, { fecha = null } = {}) {
  const avisos = [];
  if (!filas || !filas.length) return { promociones: [], avisos: ['El archivo está vacío.'], ejemplos: 0 };
  let iCab = filas.findIndex((f) => (f || []).some((c) => normalizarTexto(c) === 'PRODUCTO'));
  if (iCab < 0) return { promociones: [], avisos: ['No encuentro la columna «Producto».'], ejemplos: 0 };
  const mapa = {};
  filas[iCab].forEach((h, i) => {
    const n = normalizarTexto(h);
    const campo = Object.keys(COLUMNAS_PROMOS).find((k) => COLUMNAS_PROMOS[k].map(normalizarTexto).includes(n));
    if (campo && mapa[campo] === undefined) mapa[campo] = i;
  });
  const col = (f, k) => (mapa[k] === undefined ? '' : f[mapa[k]]);
  const promociones = [];
  let ejemplos = 0;
  for (let i = iCab + 1; i < filas.length; i++) {
    const f = filas[i] || [];
    const producto = texto(col(f, 'producto'));
    if (!producto) { if (f.some((v) => texto(v))) avisos.push(`Fila ${i + 1}: sin producto, no se importa.`); continue; }
    if (/^EJEMPLO/i.test(producto)) { ejemplos++; continue; }
    const p = { ...promocionVacia(), producto, detalle: texto(col(f, 'detalle')), promocion: texto(col(f, 'promocion')),
      tipo: texto(col(f, 'tipo')), precio: analizarPrecio(col(f, 'precio')), fechaImportacion: fecha };
    for (const k of ['desde', 'hasta']) {
      const v = col(f, k);
      p[k] = analizarFecha(v);
      if (texto(v) && !p[k] && !(v instanceof Date)) avisos.push(`Fila ${i + 1} (${producto}): no entiendo la fecha «${texto(v)}» de «${k}».`);
    }
    if (texto(col(f, 'precio')) && p.precio == null) avisos.push(`Fila ${i + 1} (${producto}): no entiendo el precio «${texto(col(f, 'precio'))}».`);
    promociones.push(p);
  }
  return { promociones, avisos, ejemplos };
}

// ---------------------------------------------------------------------
//  Navegador: leer el archivo con SheetJS
// ---------------------------------------------------------------------

/** Lee un .xlsx/.xls/.csv y devuelve las filas de la hoja indicada (o la primera). */
export async function leerArchivo(file, hojaPreferida, { crudo = false } = {}) {
  const XLSX = globalThis.XLSX;
  if (!XLSX) throw new Error('No se ha cargado la librería de Excel.');
  const esTexto = /\.(csv|txt)$/i.test(file.name);
  const wb = esTexto
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const nombre = wb.SheetNames.find((n) => normalizarTexto(n) === normalizarTexto(hojaPreferida)) || wb.SheetNames[0];
  const hoja = wb.Sheets[nombre];
  // crudo: números y fechas como valores (para promociones); si no, como texto
  return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: crudo && !esTexto, defval: '', dateNF: 'yyyy-mm-dd' });
}
