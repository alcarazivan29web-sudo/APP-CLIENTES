// =====================================================================
//  migraciones.js · Versión del esquema de datos, migraciones y formato
//  de la copia de seguridad. Funciones PURAS (sin IndexedDB) para poder
//  probarlas con `node --test`. Las usa datos.js.
//
//  Cómo añadir una migración en el futuro:
//    1. Sube ESQUEMA_ACTUAL (por ejemplo a 2).
//    2. Añade MIGRACIONES[2] = (datos) => datosTransformados.
//       Debe CONSERVAR todos los registros: solo añade o transforma campos.
//    3. Añade un test en tests/migraciones.test.js.
// =====================================================================

import { clienteVacio, registroVacio, ajustesVacios, recordatorioVacio, promocionVacia } from './logica.js';

export const ESQUEMA_ACTUAL = 2;
export const FORMATO_COPIA = 'llamadas-vinoliva';
export const COLECCIONES = ['clientes', 'llamadas', 'recordatorios', 'promociones', 'cambios', 'ajustes'];

function rellenar(base, obj) {
  const out = { ...base, ...obj };
  // Los campos que vienen como null/undefined en una versión antigua toman el valor por defecto
  for (const k of Object.keys(base)) if (out[k] === undefined) out[k] = base[k];
  return out;
}

export const completarCliente = (c) => rellenar(clienteVacio(), c);
export const completarRegistro = (r) => rellenar(registroVacio(), r);
export const completarRecordatorio = (r) => rellenar(recordatorioVacio(), r);
export const completarPromocion = (p) => rellenar(promocionVacia(), p);
export const completarAjustes = (a) => {
  const base = ajustesVacios();
  return { ...rellenar(base, a), plantillas: { ...base.plantillas, ...(a.plantillas || {}) } };
};

export const MIGRACIONES = {
  // Versión 1: primera versión. Asegura que todos los registros tienen todos los campos.
  1: (d) => ({
    ...d,
    clientes: d.clientes.map(completarCliente),
    llamadas: d.llamadas.map(completarRegistro),
    recordatorios: d.recordatorios.map(completarRecordatorio),
    promociones: d.promociones.map(completarPromocion),
    ajustes: d.ajustes.length ? d.ajustes.map(completarAjustes) : [],
  }),
  // Versión 2 (app 1.3.0, fase 4): los clientes reciben telefonosInfo, llamarDesde y
  // condicionesEspeciales vacíos. No se toca ningún dato que ya existiera.
  2: (d) => ({
    ...d,
    clientes: d.clientes.map(completarCliente),
  }),
};

/** Deja un objeto de datos con todas las colecciones (vacías si faltan). */
export function normalizarDatos(datos = {}) {
  const out = {};
  for (const k of COLECCIONES) out[k] = Array.isArray(datos[k]) ? datos[k] : [];
  return out;
}

/** Lleva los datos de la versión `desde` a la `hasta`, paso a paso. */
export function migrar(datos, desde, hasta = ESQUEMA_ACTUAL, migraciones = MIGRACIONES) {
  let d = normalizarDatos(datos);
  if (desde > hasta) throw new Error(`Los datos son de una versión más nueva (${desde}) que la app (${hasta}). Actualiza la app.`);
  for (let v = desde + 1; v <= hasta; v++) {
    const m = migraciones[v];
    if (!m) throw new Error(`Falta la migración a la versión ${v}`);
    d = normalizarDatos(m(d));
  }
  return d;
}

/** Copia de seguridad. Es el MISMO formato que usaría una sincronización futura:
 *  { formato, esquema, exportado, dispositivoId, datos: { clientes:[], llamadas:[], … } } */
export function crearCopia(datos, { dispositivoId, exportado, esquema = ESQUEMA_ACTUAL, versionApp = '' }) {
  return {
    formato: FORMATO_COPIA,
    esquema,
    versionApp,
    exportado,
    dispositivoId,
    datos: normalizarDatos(datos),
  };
}

/** Lee una copia (texto JSON u objeto), la valida y la migra a la versión actual. */
export function leerCopia(entrada) {
  let copia = entrada;
  if (typeof entrada === 'string') {
    try { copia = JSON.parse(entrada); } catch { throw new Error('El archivo no es una copia válida (no es JSON).'); }
  }
  if (!copia || copia.formato !== FORMATO_COPIA || typeof copia.esquema !== 'number' || !copia.datos) {
    throw new Error('El archivo no es una copia de seguridad de esta app.');
  }
  const datos = migrar(copia.datos, copia.esquema, ESQUEMA_ACTUAL);
  return { datos, esquema: copia.esquema, exportado: copia.exportado, dispositivoId: copia.dispositivoId };
}
