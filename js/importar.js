// =====================================================================
//  importar.js · Leer el Excel/CSV de clientes y preparar la importación.
//  filasAClientes() y planificarImportacion() son puras (se prueban con
//  node). leerArchivo() usa SheetJS (lib/xlsx.full.min.js) en el navegador.
// =====================================================================

import {
  normalizarTexto, analizarDias, analizarHora, extraerTelefonos, clienteVacio, analizarFecha, promocionVacia,
  leerTelefonosConNombre, idTipoEncargo, idMensajeOficina, TIPOS_ENCARGO, formatearTelefono,
} from './logica.js';

/** Columnas conocidas del Excel → campo de la app. Las demás se ignoran. */
export const COLUMNAS_CLIENTES = {
  codigo: ['ID', 'CODIGO', 'COD', 'CODIGO CLIENTE'],
  nombreComercial: ['NOMBRE COMERCIAL', 'NOMBRE', 'CLIENTE'],
  nombreFiscal: ['NOMBRE FISCAL', 'RAZON SOCIAL'],
  poblacion: ['POBLACION', 'LOCALIDAD', 'MUNICIPIO'],
  zona: ['ZONA / RUTA', 'ZONA/RUTA', 'ZONA', 'RUTA'],
  contacto: ['CONTACTO', 'PERSONA DE CONTACTO'],
  direccion: ['DIRECCION', 'DOMICILIO', 'DIRECCION POSTAL', 'CALLE'],
  email: ['EMAIL', 'E-MAIL', 'CORREO', 'CORREO ELECTRONICO', 'MAIL'],
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
export const CAMPOS_EXCEL = ['codigo', 'nombreComercial', 'nombreFiscal', 'poblacion', 'zona', 'contacto', 'direccion', 'email',
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
export const esEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));
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
    const emailTxt = texto(col(f, 'email'));
    const email = emailTxt.toLowerCase().replace(/^mailto:/, '').replace(/\s/g, '');
    if (email && !esEmail(email)) avisos.push(`Fila ${nFila} (${nombre}): «${emailTxt}» no parece un email (se guarda igual).`);
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
      direccion: texto(col(f, 'direccion')),
      email,
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
//  Fase 6 · Excel de la oficina: Promociones, Encargos, Mensaje y Números
// ---------------------------------------------------------------------

const esEjemplo = (v) => /^EJEMPLO/i.test(texto(v));

/** Busca la fila de cabecera que tiene alguna de las columnas indicadas
 *  y devuelve { iCab, mapa } con la posición de cada campo. */
function cabecera(filas, columnas, obligatoria) {
  const iCab = (filas || []).findIndex((f) => (f || []).some((c) => columnas[obligatoria].map(normalizarTexto).includes(normalizarTexto(c))));
  if (iCab < 0) return null;
  const mapa = {};
  filas[iCab].forEach((h, i) => {
    const n = normalizarTexto(h);
    const campo = Object.keys(columnas).find((k) => columnas[k].map(normalizarTexto).includes(n));
    if (campo && mapa[campo] === undefined) mapa[campo] = i;
  });
  return { iCab, mapa, col: (f, k) => (mapa[k] === undefined ? '' : (f || [])[mapa[k]]) };
}

export const COLUMNAS_ENCARGOS = {
  texto: ['ENCARGO', 'ENCARGOS', 'QUE SE PUEDE PEDIR', 'TIPO DE ENCARGO'],
  pide: ['HAY QUE ESCRIBIR', 'PIDE', 'EL COMERCIAL ESCRIBE'],
  icono: ['ICONO', 'EMOJI'],
};

/** Hoja «Encargos» → { tipos, avisos, ejemplos }. «Hay que escribir»: vacío,
 *  «Producto» (pide qué producto) o «Texto» (el comercial lo escribe). */
export function filasAEncargos(filas) {
  const avisos = [];
  const cab = cabecera(filas, COLUMNAS_ENCARGOS, 'texto');
  if (!cab) return { tipos: [], avisos: ['En la hoja «Encargos» no encuentro la columna «Encargo».'], ejemplos: 0 };
  const tipos = [];
  let ejemplos = 0;
  const vistos = new Set();
  for (let i = cab.iCab + 1; i < filas.length; i++) {
    const f = filas[i] || [];
    const t = texto(cab.col(f, 'texto'));
    if (!t) continue;
    if (esEjemplo(t)) { ejemplos++; continue; }
    const p = normalizarTexto(cab.col(f, 'pide'));
    const pide = !p || ['NO', 'NADA', '-'].includes(p) ? ''
      : p.includes('PRODUCTO') ? 'producto'
        : 'texto';
    const id = idTipoEncargo(t);
    if (vistos.has(id)) { avisos.push(`Fila ${i + 1}: «${t}» está repetido, se pone una vez.`); continue; }
    vistos.add(id);
    const deSerie = TIPOS_ENCARGO.find((x) => x.id === id);
    tipos.push({ id, texto: t, icono: texto(cab.col(f, 'icono')) || deSerie?.icono || '📌', pide });
  }
  return { tipos, avisos, ejemplos };
}

export const COLUMNAS_MENSAJE = {
  texto: ['MENSAJE', 'MENSAJE DE LA OFICINA', 'MENSAJE DE LA SEMANA', 'AVISO'],
  desde: ['DESDE', 'INICIO', 'FECHA INICIO'],
  hasta: ['HASTA', 'FIN', 'FECHA FIN'],
};

/** Hoja «Mensaje» → { mensajes, avisos, ejemplos }. Puede haber varios, cada uno con sus fechas. */
export function filasAMensajes(filas) {
  const avisos = [];
  const cab = cabecera(filas, COLUMNAS_MENSAJE, 'texto');
  if (!cab) return { mensajes: [], avisos: ['En la hoja «Mensaje» no encuentro la columna «Mensaje».'], ejemplos: 0 };
  const mensajes = [];
  let ejemplos = 0;
  for (let i = cab.iCab + 1; i < filas.length; i++) {
    const f = filas[i] || [];
    const t = String(cab.col(f, 'texto') ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).join('\n').trim();
    if (!t) continue;
    if (esEjemplo(t)) { ejemplos++; continue; }
    const m = { texto: t, desde: null, hasta: null };
    for (const k of ['desde', 'hasta']) {
      const v = cab.col(f, k);
      m[k] = analizarFecha(v);
      if (texto(v) && !m[k] && !(v instanceof Date)) avisos.push(`Mensaje de la fila ${i + 1}: no entiendo la fecha «${texto(v)}» de «${k}».`);
    }
    if (m.desde && m.hasta && m.hasta < m.desde) avisos.push(`Mensaje de la fila ${i + 1}: «hasta» es anterior a «desde».`);
    mensajes.push({ ...m, id: idMensajeOficina(m) });
  }
  return { mensajes, avisos, ejemplos };
}

/** Hoja «Números» (Dato | Valor) → { numeros: { whatsappOficina?, contactoIvan? }, avisos }.
 *  Solo cuentan los que vienen rellenos. */
export function filasANumeros(filas) {
  const avisos = [];
  const numeros = {};
  (filas || []).forEach((f, i) => {
    const clave = normalizarTexto((f || [])[0]);
    const valor = texto((f || [])[1]);
    if (!clave || !valor || esEjemplo(valor)) return;
    if (clave.includes('IVAN') || clave.includes('RESUMEN')) {
      const correo = valor.match(/\S+@\S+\.\S+/)?.[0];
      const tel = extraerTelefonos(valor)[0];
      if (correo || tel) numeros.contactoIvan = correo || formatearTelefono(tel);
      else avisos.push(`Fila ${i + 1}: «${valor}» no parece un teléfono ni un correo.`);
    } else if (clave.includes('OFICINA') || clave.includes('PEDIDOS')) {
      const tel = extraerTelefonos(valor)[0];
      if (tel) numeros.whatsappOficina = formatearTelefono(tel);
      else avisos.push(`Fila ${i + 1}: «${valor}» no parece un teléfono.`);
    }
  });
  return { numeros, avisos };
}

/** Hoja «Comerciales»: un nombre por fila (columna «Comercial» o la primera). */
export function filasAComerciales(filas) {
  const avisos = [];
  const iCab = (filas || []).findIndex((f) => ['COMERCIAL', 'COMERCIALES', 'NOMBRE'].includes(normalizarTexto((f || [])[0])));
  const nombres = [];
  const vistos = new Set();
  (filas || []).forEach((f, i) => {
    if (i <= iCab) return;
    const n = texto((f || [])[0]).replace(/\s+/g, ' ');
    if (!n || esEjemplo(n)) return;
    const k = normalizarTexto(n);
    if (vistos.has(k)) { avisos.push(`Fila ${i + 1}: «${n}» está repetido.`); return; }
    vistos.add(k);
    nombres.push(n);
  });
  return { comerciales: nombres, avisos };
}

const HOJAS_OFICINA = {
  promociones: ['PROMOCIONES', 'PROMOS', 'PROMOCION'],
  encargos: ['ENCARGOS', 'ENCARGO', 'LISTA DE ENCARGOS'],
  mensajes: ['MENSAJE', 'MENSAJES', 'MENSAJE DE LA SEMANA', 'MENSAJE DE LA OFICINA'],
  numeros: ['NUMEROS', 'TELEFONOS', 'CONTACTOS'],
  comerciales: ['COMERCIALES', 'LISTA DE COMERCIALES'],
};

/** Libro completo { nombreHoja: filas } → lo que trae cada hoja (o null si no viene).
 *  Un archivo antiguo con solo una hoja de promociones también vale. */
export function analizarExcelOficina(libro, { fecha = null } = {}) {
  const nombres = Object.keys(libro || {});
  const hoja = (k) => nombres.find((n) => HOJAS_OFICINA[k].includes(normalizarTexto(n)));
  const r = { promociones: null, encargos: null, mensajes: null, numeros: null, comerciales: null };
  let nPromos = hoja('promociones');
  if (!nPromos && !hoja('encargos') && !hoja('mensajes') && !hoja('numeros') && !hoja('comerciales') && nombres.length) nPromos = nombres[0];
  if (nPromos) r.promociones = filasAPromociones(libro[nPromos], { fecha });
  if (hoja('encargos')) r.encargos = filasAEncargos(libro[hoja('encargos')]);
  if (hoja('mensajes')) r.mensajes = filasAMensajes(libro[hoja('mensajes')]);
  if (hoja('numeros')) r.numeros = filasANumeros(libro[hoja('numeros')]);
  if (hoja('comerciales')) r.comerciales = filasAComerciales(libro[hoja('comerciales')]);
  return r;
}

/** Compara lo que trae el Excel con lo que hay en el móvil.
 *  Devuelve { cambios: [...], guardar: {ajustes}, promociones | null }.
 *  Reglas: las promociones sustituyen a las actuales (si el archivo trae alguna);
 *  la lista de encargos sustituye a la actual (si trae alguno); los mensajes
 *  sustituyen a los actuales (una hoja «Mensaje» vacía los quita); los números
 *  solo cambian si vienen rellenos. */
export function planExcelOficina(analisis, { ajustes, promocionesActuales = 0, fecha }) {
  const cambios = [];
  const avisos = [];
  const guardar = {};
  let promociones = null;
  const a = analisis;
  for (const k of ['promociones', 'encargos', 'mensajes', 'numeros', 'comerciales']) if (a[k]?.avisos?.length) avisos.push(...a[k].avisos);
  if (a.promociones) {
    const n = a.promociones.promociones.length;
    if (n) {
      promociones = a.promociones.promociones;
      const caducadas = promociones.filter((p) => p.hasta && fecha && p.hasta < fecha).length;
      cambios.push({ tipo: 'promociones', texto: `${n} ${n === 1 ? 'promoción' : 'promociones'}` +
        (promocionesActuales ? ` (sustituyen a las ${promocionesActuales} de ahora)` : ''),
      detalle: caducadas ? `${caducadas} ya ${caducadas === 1 ? 'ha caducado y no se verá' : 'han caducado y no se verán'}` : '' });
    } else {
      cambios.push({ tipo: 'promociones', texto: 'Promociones: el archivo no trae ninguna', detalle: promocionesActuales ? `Se quedan las ${promocionesActuales} de ahora.` : '', sinCambio: true });
    }
  }
  if (a.encargos) {
    const lista = a.encargos.tipos;
    if (lista.length) {
      const antes = JSON.stringify(ajustes.tiposEncargo || []);
      guardar.tiposEncargo = lista;
      cambios.push({ tipo: 'encargos', texto: `Lista de encargos: ${lista.length} ${lista.length === 1 ? 'opción' : 'opciones'}`,
        detalle: lista.map((t) => `${t.icono} ${t.texto}`).join(' · '), sinCambio: antes === JSON.stringify(lista) });
    } else {
      cambios.push({ tipo: 'encargos', texto: 'Lista de encargos: la hoja está vacía', detalle: 'Se queda la lista de ahora.', sinCambio: true });
    }
  }
  if (a.mensajes) {
    const lista = a.mensajes.mensajes;
    const antes = (ajustes.mensajesOficina || []).map((m) => m.id).join();
    guardar.mensajesOficina = lista;
    const sinCambio = antes === lista.map((m) => m.id).join();
    if (lista.length) {
      cambios.push({ tipo: 'mensajes', texto: lista.length === 1 ? 'Mensaje de la oficina' : `${lista.length} mensajes de la oficina`,
        detalle: lista.map((m) => m.texto.split('\n')[0] + (m.desde || m.hasta ? ` (${m.desde ? 'desde ' + m.desde.split('-').reverse().join('/') : ''}${m.desde && m.hasta ? ' ' : ''}${m.hasta ? 'hasta ' + m.hasta.split('-').reverse().join('/') : ''})` : '')).join(' · '),
        sinCambio });
    } else {
      cambios.push({ tipo: 'mensajes', texto: 'Mensaje de la oficina: ninguno',
        detalle: antes ? 'Se quita el mensaje que había.' : '', sinCambio });
    }
  }
  if (a.numeros) {
    const nombres = { whatsappOficina: 'WhatsApp de la oficina', contactoIvan: 'WhatsApp o correo de Iván' };
    for (const [k, v] of Object.entries(a.numeros.numeros)) {
      const igual = String(ajustes[k] || '').replace(/\s/g, '') === String(v).replace(/\s/g, '');
      if (!igual) guardar[k] = v;
      cambios.push({ tipo: 'numeros', texto: `${nombres[k]}: ${v}`, detalle: igual ? '' : (ajustes[k] ? `Antes: ${ajustes[k]}` : 'Antes estaba vacío'), sinCambio: igual });
    }
  }
  if (a.comerciales) {
    const lista = a.comerciales.comerciales;
    if (lista.length) {
      const igual = JSON.stringify(ajustes.comerciales || []) === JSON.stringify(lista);
      if (!igual) guardar.comerciales = lista;
      const nombre = String(ajustes.nombreComercial || '').trim();
      const mismo = lista.find((n) => normalizarTexto(n) === normalizarTexto(nombre));
      let detalle = '';
      if (mismo && mismo !== nombre) { guardar.nombreComercial = mismo; detalle = `Tu nombre se escribirá «${mismo}».`; }
      else if (nombre && !mismo) detalle = `«${nombre}» no está en la lista: después elige tu nombre en Más → Ajustes.`;
      else if (!nombre) detalle = 'Después elige tu nombre en Más → Ajustes.';
      cambios.push({ tipo: 'comerciales', texto: `Comerciales: ${lista.join(', ')}`, detalle, sinCambio: igual && !guardar.nombreComercial });
    } else {
      cambios.push({ tipo: 'comerciales', texto: 'Comerciales: la hoja está vacía', detalle: 'Se queda la lista de ahora.', sinCambio: true });
    }
  }
  const hayAlgo = cambios.some((c) => !c.sinCambio);
  if (guardar.mensajesOficina) {
    // Los «Entendido» de mensajes que ya no están se olvidan
    const ids = new Set(guardar.mensajesOficina.map((m) => m.id));
    guardar.mensajesVistos = (ajustes.mensajesVistos || []).filter((id) => ids.has(id));
  }
  return { cambios, avisos, guardar, promociones, hayAlgo };
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

/** Lee todas las hojas de un .xlsx → { nombreHoja: filas } (fechas y números como valores). */
export async function leerLibro(file) {
  const XLSX = globalThis.XLSX;
  if (!XLSX) throw new Error('No se ha cargado la librería de Excel.');
  const esTexto = /\.(csv|txt)$/i.test(file.name);
  const wb = esTexto
    ? XLSX.read(await file.text(), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const libro = {};
  for (const n of wb.SheetNames) {
    libro[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: !esTexto, defval: '', dateNF: 'yyyy-mm-dd' });
  }
  return libro;
}
