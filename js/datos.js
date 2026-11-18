// =====================================================================
//  datos.js · ÚNICO módulo que habla con IndexedDB.
//  Las pantallas nunca tocan la base de datos directamente: usan estas
//  funciones. El día que haya sincronización con la nube, se añadirá aquí.
//
//  Reglas «preparada para la nube»:
//   - cada registro tiene id (UUID), creado, modificado y dispositivoId;
//   - no se borra nada: se marca borrado:true con su fecha;
//   - cada cambio se apunta en la tabla `cambios`;
//   - el esquema tiene versión y migraciones (ver migraciones.js).
// =====================================================================

import { marcaTiempo, ajustesVacios, fechaDeMarca } from './logica.js';
import { ESQUEMA_ACTUAL, COLECCIONES, migrar, crearCopia, leerCopia, completarAjustes } from './migraciones.js';
import { VERSION } from './version.js';

const VERSION_IDB = 1; // versión de la estructura de tablas de IndexedDB
const CAMPOS_TECNICOS = new Set(['id', 'creado', 'modificado', 'dispositivoId']);

let db = null;
let nombreBase = '';
let dispositivoId = '';
let relojAhora = () => new Date();
const cache = { clientes: new Map(), llamadas: new Map(), recordatorios: new Map(), promociones: new Map() };
let indiceRegistros = new Map(); // `${clienteId}|${fechaPrevista}` → id
let ajustes = null;

// ---------------------------------------------------------------------
//  Utilidades de IndexedDB
// ---------------------------------------------------------------------

const pedir = (req) => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });
const terminar = (tx) => new Promise((ok, mal) => {
  tx.oncomplete = () => ok();
  tx.onerror = () => mal(tx.error);
  tx.onabort = () => mal(tx.error || new Error('Transacción cancelada'));
});

function abrirIDB(nombre) {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(nombre, VERSION_IDB);
    req.onupgradeneeded = (ev) => {
      const b = req.result;
      if (ev.oldVersion < 1) {
        b.createObjectStore('clientes', { keyPath: 'id' });
        const ll = b.createObjectStore('llamadas', { keyPath: 'id' });
        ll.createIndex('clienteId', 'clienteId');
        ll.createIndex('fechaPrevista', 'fechaPrevista');
        b.createObjectStore('recordatorios', { keyPath: 'id' }).createIndex('clienteId', 'clienteId');
        b.createObjectStore('promociones', { keyPath: 'id' });
        const ca = b.createObjectStore('cambios', { keyPath: 'id' });
        ca.createIndex('entidadId', 'entidadId');
        ca.createIndex('fecha', 'fecha');
        b.createObjectStore('ajustes', { keyPath: 'id' });
        b.createObjectStore('meta', { keyPath: 'clave' });
      }
      // Futuras versiones de tablas: if (ev.oldVersion < 2) { … }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
    req.onblocked = () => mal(new Error('Cierra otras pestañas de la app y vuelve a abrirla.'));
  });
}

async function leerTodo(almacen) {
  const tx = db.transaction(almacen, 'readonly');
  return pedir(tx.objectStore(almacen).getAll());
}

async function leerMeta(clave) {
  const tx = db.transaction('meta', 'readonly');
  const r = await pedir(tx.objectStore('meta').get(clave));
  return r ? r.valor : undefined;
}

async function escribirMeta(clave, valor) {
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ clave, valor });
  await terminar(tx);
}

export function nuevoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Alternativa si el navegador no da randomUUID (p. ej. http en la red local)
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const ahora = () => marcaTiempo(relojAhora());

// ---------------------------------------------------------------------
//  Arranque y migraciones
// ---------------------------------------------------------------------

/** Abre la base, genera el id del móvil, migra los datos si hace falta y
 *  carga todo en memoria. `prueba: true` usa una base aparte (modo prueba). */
export async function iniciar({ prueba = false, reloj = () => new Date() } = {}) {
  relojAhora = reloj;
  nombreBase = prueba ? 'llamadas-vinoliva-prueba' : 'llamadas-vinoliva';
  db = await abrirIDB(nombreBase);

  dispositivoId = await leerMeta('dispositivoId');
  if (!dispositivoId) {
    dispositivoId = nuevoId();
    await escribirMeta('dispositivoId', dispositivoId);
  }

  const datos = {};
  for (const k of COLECCIONES) if (k !== 'cambios') datos[k] = await leerTodo(k);
  let esquema = await leerMeta('esquema');
  const hayDatos = datos.clientes.length || datos.llamadas.length;
  if (esquema === undefined) esquema = hayDatos ? 0 : ESQUEMA_ACTUAL;

  if (esquema < ESQUEMA_ACTUAL) {
    // Antes de migrar se guarda una copia completa dentro del propio móvil.
    datos.cambios = await leerTodo('cambios');
    const copia = crearCopia(datos, { dispositivoId, exportado: ahora(), esquema, versionApp: VERSION });
    await escribirMeta(`copiaAntesDeMigrarA${ESQUEMA_ACTUAL}`, copia);
    const migrados = migrar(datos, esquema, ESQUEMA_ACTUAL);
    await reemplazarTodo(migrados);
    Object.assign(datos, migrados);
  }
  if (esquema !== ESQUEMA_ACTUAL || (await leerMeta('esquema')) === undefined) {
    await escribirMeta('esquema', ESQUEMA_ACTUAL);
  }

  cargarCache(datos);

  if (!ajustes) {
    await guardarAjustes({ ...ajustesVacios(), primerUso: fechaDeMarca(ahora()) });
  } else if (!ajustes.primerUso) {
    await guardarAjustes({ primerUso: fechaDeMarca(ahora()) });
  }
}

function cargarCache(datos) {
  for (const k of ['clientes', 'llamadas', 'recordatorios', 'promociones']) {
    cache[k] = new Map(datos[k].map((o) => [o.id, o]));
  }
  ajustes = datos.ajustes.find((a) => a.id === 'ajustes') || null;
  if (ajustes) ajustes = completarAjustes(ajustes);
  reconstruirIndice();
}

function reconstruirIndice() {
  indiceRegistros = new Map();
  for (const r of cache.llamadas.values()) indexar(r);
}

function indexar(r) {
  const k = `${r.clienteId}|${r.fechaPrevista}`;
  if (r.borrado) {
    if (indiceRegistros.get(k) === r.id) indiceRegistros.delete(k);
    return;
  }
  const actual = indiceRegistros.get(k);
  const otro = actual && cache.llamadas.get(actual);
  if (!otro || otro.borrado || (r.modificado || '') >= (otro.modificado || '')) indiceRegistros.set(k, r.id);
}

async function reemplazarTodo(datos) {
  const tx = db.transaction(COLECCIONES, 'readwrite');
  for (const k of COLECCIONES) {
    const st = tx.objectStore(k);
    st.clear();
    for (const o of datos[k] || []) st.put(o);
  }
  await terminar(tx);
}

export async function pedirPersistencia() {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* sin soporte */ }
  return false;
}

export async function esPersistente() {
  try { return !!(await navigator.storage?.persisted?.()); } catch { return false; }
}

export const infoBase = () => ({ nombreBase, dispositivoId, esquema: ESQUEMA_ACTUAL });

// ---------------------------------------------------------------------
//  Escritura genérica con registro de cambios
// ---------------------------------------------------------------------

function iguales(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return (a ?? null) === (b ?? null);
  return JSON.stringify(a) === JSON.stringify(b);
}

function diferencias(antes, despues) {
  const out = [];
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  for (const k of claves) {
    if (CAMPOS_TECNICOS.has(k)) continue;
    if (!iguales(antes[k], despues[k])) out.push({ campo: k, antes: antes[k] ?? null, despues: despues[k] ?? null });
  }
  return out;
}

function cambio(entidad, entidadId, accion, campo, antes, despues, origen, fecha) {
  return {
    id: nuevoId(), entidad, entidadId, accion, campo, antes, despues,
    fecha, dispositivoId, origen, enviado: false,
  };
}

/** Guarda una lista de objetos en una colección (crea o actualiza) y apunta
 *  los cambios. Devuelve [{ anterior, nuevo }] por objeto. */
async function guardar(entidad, objetos, { origen = 'app' } = {}) {
  const marca = ahora();
  const tx = db.transaction([entidad, 'cambios'], 'readwrite');
  const st = tx.objectStore(entidad);
  const stc = tx.objectStore('cambios');
  const resultados = [];
  for (const o of objetos) {
    const anterior = o.id ? cache[entidad].get(o.id) : undefined;
    if (anterior) {
      const dif = diferencias(anterior, o);
      if (!dif.length) { resultados.push({ anterior, nuevo: anterior, sinCambios: true }); continue; }
      const nuevo = { ...anterior, ...o, id: anterior.id, creado: anterior.creado, modificado: marca, dispositivoId };
      st.put(nuevo);
      for (const d of dif) {
        const acc = d.campo === 'borrado' ? (d.despues ? 'borrar' : 'recuperar') : 'modificar';
        stc.put(cambio(entidad, nuevo.id, acc, d.campo, d.antes, d.despues, origen, marca));
      }
      resultados.push({ anterior, nuevo });
    } else {
      const nuevo = { ...o, id: o.id || nuevoId(), creado: o.creado || marca, modificado: marca, dispositivoId, borrado: !!o.borrado };
      st.put(nuevo);
      const { id, creado, modificado, dispositivoId: _d, ...resto } = nuevo;
      stc.put(cambio(entidad, nuevo.id, 'crear', '*', null, resto, origen, marca));
      resultados.push({ anterior: null, nuevo });
    }
  }
  await terminar(tx);
  for (const r of resultados) {
    cache[entidad].set(r.nuevo.id, r.nuevo);
    if (entidad === 'llamadas') indexar(r.nuevo);
  }
  return resultados;
}

/** Deshace: vuelve a poner la versión anterior, o borra (suave) si era nuevo. */
export async function restaurar(entidad, anterior, idNuevo) {
  if (anterior) return (await guardar(entidad, [anterior], { origen: 'deshacer' }))[0];
  const actual = cache[entidad].get(idNuevo);
  if (!actual) return null;
  return (await guardar(entidad, [{ ...actual, borrado: true, fechaBorrado: ahora() }], { origen: 'deshacer' }))[0];
}

export async function restaurarVarios(entidad, anteriores) {
  return guardar(entidad, anteriores, { origen: 'deshacer' });
}

// ---------------------------------------------------------------------
//  Clientes
// ---------------------------------------------------------------------

export function obtenerClientes({ incluirBorrados = false } = {}) {
  const out = [];
  for (const c of cache.clientes.values()) if (incluirBorrados || !c.borrado) out.push(c);
  return out;
}

export function obtenerCliente(id) {
  const c = cache.clientes.get(id);
  return c && !c.borrado ? c : null;
}

export async function guardarCliente(c, opciones) {
  return (await guardar('clientes', [c], opciones))[0];
}

export async function guardarClientes(lista, opciones) {
  return guardar('clientes', lista, opciones);
}

/** Borrado suave: el cliente se marca como borrado y la app lo oculta. */
export async function borrarCliente(id) {
  const c = cache.clientes.get(id);
  if (!c) return null;
  return guardarCliente({ ...c, borrado: true, fechaBorrado: ahora() });
}

/** Aplica un plan de importación (ver importar.js). */
export async function importarClientes(plan) {
  const lista = [
    ...plan.nuevos,
    ...plan.actualizaciones.map((a) => ({ ...cache.clientes.get(a.id), ...a.cambios })),
  ];
  return guardar('clientes', lista, { origen: 'importacion' });
}

// ---------------------------------------------------------------------
//  Registros de llamada
// ---------------------------------------------------------------------

export function obtenerLlamadas() {
  const out = [];
  for (const r of cache.llamadas.values()) if (!r.borrado) out.push(r);
  return out;
}

export function llamadasDeCliente(clienteId) {
  return obtenerLlamadas().filter((r) => r.clienteId === clienteId)
    .sort((a, b) => (b.fechaPrevista || '').localeCompare(a.fechaPrevista || '') ||
      String(b.modificado).localeCompare(String(a.modificado)));
}

/** El registro de un cliente para el día en que tocaba llamarle. */
export function registroDe(clienteId, fechaPrevista) {
  const id = indiceRegistros.get(`${clienteId}|${fechaPrevista}`);
  const r = id && cache.llamadas.get(id);
  return r && !r.borrado ? r : null;
}

export async function registrarLlamada(registro) {
  return (await guardar('llamadas', [registro]))[0];
}

// ---------------------------------------------------------------------
//  Recordatorios
// ---------------------------------------------------------------------

export function obtenerRecordatorios() {
  const out = [];
  for (const r of cache.recordatorios.values()) if (!r.borrado) out.push(r);
  return out;
}

export function recordatoriosDeCliente(clienteId) {
  return obtenerRecordatorios().filter((r) => r.clienteId === clienteId)
    .sort((a, b) => (a.hecho - b.hecho) || String(a.fecha).localeCompare(String(b.fecha)));
}

export async function guardarRecordatorio(r) {
  return (await guardar('recordatorios', [r]))[0];
}

/** Borrado suave. */
export async function borrarRecordatorio(id) {
  const r = cache.recordatorios.get(id);
  if (!r) return null;
  return guardarRecordatorio({ ...r, borrado: true, fechaBorrado: ahora() });
}

// ---------------------------------------------------------------------
//  Promociones
// ---------------------------------------------------------------------

export function obtenerPromociones() {
  const out = [];
  for (const p of cache.promociones.values()) if (!p.borrado) out.push(p);
  return out;
}

/** Cada importación SUSTITUYE a las promociones anteriores (que se marcan como borradas). */
export async function reemplazarPromociones(nuevas) {
  const marca = ahora();
  const viejas = obtenerPromociones().map((p) => ({ ...p, borrado: true, fechaBorrado: marca }));
  return guardar('promociones', [...viejas, ...nuevas], { origen: 'importacion' });
}

// ---------------------------------------------------------------------
//  Ajustes
// ---------------------------------------------------------------------

export function obtenerAjustes() {
  return ajustes || completarAjustes(ajustesVacios());
}

export async function guardarAjustes(parcial) {
  const base = ajustes || ajustesVacios();
  const nuevo = completarAjustes({ ...base, ...parcial, id: 'ajustes' });
  const tx = db.transaction(['ajustes', 'cambios'], 'readwrite');
  const marca = ahora();
  const final = { ...nuevo, creado: base.creado || marca, modificado: marca, dispositivoId };
  tx.objectStore('ajustes').put(final);
  for (const d of diferencias(base, final)) {
    tx.objectStore('cambios').put(cambio('ajustes', 'ajustes', 'modificar', d.campo, d.antes, d.despues, 'app', marca));
  }
  await terminar(tx);
  ajustes = final;
  return final;
}

// ---------------------------------------------------------------------
//  Registro de cambios
// ---------------------------------------------------------------------

export async function obtenerCambios() {
  return (await leerTodo('cambios')).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/** Marca cambios como enviados a la oficina (o lo deshace con enviado=false). */
export async function marcarCambiosEnviados(ids, enviado = true) {
  if (!ids.length) return 0;
  const tx = db.transaction('cambios', 'readwrite');
  const st = tx.objectStore('cambios');
  const marca = ahora();
  let n = 0;
  for (const id of ids) {
    const req = st.get(id);
    req.onsuccess = () => {
      const x = req.result;
      if (!x) return;
      st.put({ ...x, enviado, fechaEnviado: enviado ? marca : null });
      n++;
    };
  }
  await terminar(tx);
  return n;
}

// ---------------------------------------------------------------------
//  Copia de seguridad (mismo formato que una sincronización futura)
// ---------------------------------------------------------------------

export async function exportarCopia() {
  const datos = {};
  for (const k of COLECCIONES) datos[k] = await leerTodo(k);
  return crearCopia(datos, { dispositivoId, exportado: ahora(), versionApp: VERSION });
}

/** Sustituye TODOS los datos del móvil por los de la copia. */
export async function restaurarCopia(entrada) {
  const { datos } = leerCopia(entrada);
  await reemplazarTodo(datos);
  await escribirMeta('esquema', ESQUEMA_ACTUAL);
  cargarCache(datos);
  if (!ajustes) await guardarAjustes({ ...ajustesVacios(), primerUso: fechaDeMarca(ahora()) });
  return datos;
}
