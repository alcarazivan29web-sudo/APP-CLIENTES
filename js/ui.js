// =====================================================================
//  ui.js · Piezas de interfaz reutilizables (sin lógica de negocio).
// =====================================================================

/** Crea un elemento: h('button', {class:'btn', onClick: fn}, 'Texto') */
export function h(tag, props = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  agregar(el, hijos);
  return el;
}

function agregar(el, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

// ---------------------------------------------------------------------
//  Hoja que sube desde abajo (bottom sheet)
// ---------------------------------------------------------------------

const pilaHojas = [];

export function hayHojaAbierta() {
  return pilaHojas.length > 0 || !!document.querySelector('.pantalla-completa');
}

/** Abre una hoja desde abajo. contenido: Node o función (cerrar) => Node */
export function hoja({ titulo, contenido, alCerrar } = {}) {
  const fondo = h('div', { class: 'hoja-fondo' });
  const caja = h('div', { class: 'hoja', role: 'dialog', 'aria-modal': 'true' });
  let cerrada = false;
  const cerrar = () => {
    if (cerrada) return;
    cerrada = true;
    fondo.classList.add('saliendo');
    const i = pilaHojas.indexOf(fondo);
    if (i >= 0) pilaHojas.splice(i, 1);
    setTimeout(() => fondo.remove(), 180);
    alCerrar?.();
  };
  const cuerpo = h('div', { class: 'hoja-cuerpo' });
  const poner = (c) => cuerpo.replaceChildren(typeof c === 'function' ? c(cerrar) : c);
  caja.append(
    h('div', { class: 'hoja-asa' }),
    titulo ? h('h2', { class: 'hoja-titulo' }, titulo) : null,
    cuerpo,
  );
  poner(contenido || '');
  fondo.append(caja);
  fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
  document.body.append(fondo);
  pilaHojas.push(fondo);
  requestAnimationFrame(() => fondo.classList.add('visible'));
  return {
    cerrar,
    poner,
    titulo: (t) => { const el = caja.querySelector('.hoja-titulo'); if (el) el.textContent = t; },
  };
}

/** Pregunta Sí/No. Devuelve una promesa con true/false. */
export function confirmar(texto, { ok = 'Sí', cancelar = 'Cancelar', peligro = false, titulo } = {}) {
  return new Promise((resolver) => {
    let respondido = false;
    const responder = (v, cerrar) => { respondido = true; cerrar(); resolver(v); };
    hoja({
      titulo: titulo || null,
      alCerrar: () => { if (!respondido) resolver(false); },
      contenido: (cerrar) => h('div', {},
        h('p', { class: 'texto-confirmar' }, texto),
        h('div', { class: 'fila-botones' },
          h('button', { class: 'btn btn-secundario', onClick: () => responder(false, cerrar) }, cancelar),
          h('button', { class: 'btn ' + (peligro ? 'btn-peligro' : 'btn-principal'), onClick: () => responder(true, cerrar) }, ok),
        )),
    });
  });
}

/** Muestra un mensaje breve con un texto de entrada y devuelve el valor (o null). */
export function pedirTexto({ titulo, etiqueta, valor = '', ok = 'Guardar', multilinea = false, tipo = 'text' }) {
  return new Promise((resolver) => {
    let respondido = false;
    const campo = multilinea
      ? h('textarea', { class: 'campo', rows: 4 }, valor)
      : h('input', { class: 'campo', type: tipo, value: valor });
    hoja({
      titulo,
      alCerrar: () => { if (!respondido) resolver(null); },
      contenido: (cerrar) => h('div', {},
        etiqueta ? h('label', { class: 'etiqueta-campo' }, etiqueta) : null,
        campo,
        h('div', { class: 'fila-botones' },
          h('button', { class: 'btn btn-secundario', onClick: () => cerrar() }, 'Cancelar'),
          h('button', { class: 'btn btn-principal', onClick: () => { respondido = true; cerrar(); resolver(campo.value); } }, ok),
        )),
    });
    setTimeout(() => campo.focus(), 250);
  });
}

// ---------------------------------------------------------------------
//  Aviso breve abajo (con «Deshacer» opcional)
// ---------------------------------------------------------------------

let toastActual = null;
export function toast(texto, { deshacer, duracion = 5000 } = {}) {
  toastActual?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, h('span', {}, texto));
  if (deshacer) {
    el.append(h('button', {
      class: 'toast-boton',
      onClick: async () => { el.remove(); await deshacer(); },
    }, 'Deshacer'));
  }
  document.body.append(el);
  toastActual = el;
  requestAnimationFrame(() => el.classList.add('visible'));
  setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 250); }, duracion);
}

// ---------------------------------------------------------------------
//  Pantalla completa (ficha del cliente, importación…)
// ---------------------------------------------------------------------

export function pantallaCompleta({ titulo, contenido, acciones = [], alCerrar }) {
  const cont = h('div', { class: 'pantalla-completa' });
  const cerrar = () => { cont.remove(); window.removeEventListener('popstate', alVolver); alCerrar?.(); };
  const alVolver = () => cerrar();
  const cuerpo = h('div', { class: 'pc-cuerpo' });
  cont.append(
    h('header', { class: 'pc-cabecera' },
      h('button', { class: 'pc-volver', 'aria-label': 'Volver', onClick: () => cerrar() }, '‹ Volver'),
      h('h1', { class: 'pc-titulo' }, titulo),
      ...acciones),
    cuerpo,
  );
  cuerpo.append(typeof contenido === 'function' ? contenido(cerrar) : contenido);
  document.body.append(cont);
  return { cerrar, cuerpo, poner: (c) => cuerpo.replaceChildren(c) };
}

// ---------------------------------------------------------------------
//  Enlaces externos, compartir y archivos
// ---------------------------------------------------------------------

/** Abre tel: o WhatsApp. Son las ÚNICAS salidas de la app. */
export function abrirEnlace(url) {
  if (url.startsWith('tel:')) { window.location.href = url; return; }
  const a = h('a', { href: url, target: '_blank', rel: 'noopener' });
  document.body.append(a);
  a.click();
  a.remove();
}

export async function compartirTexto(texto, titulo = '') {
  if (navigator.share) {
    try { await navigator.share({ text: texto, title: titulo }); return 'compartido'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
  }
  try { await navigator.clipboard.writeText(texto); toast('Texto copiado: pégalo donde quieras'); return 'copiado'; }
  catch { return 'error'; }
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Comparte un archivo con el menú de Android (WhatsApp, correo…). Si el móvil
 *  no lo permite, lo descarga. Devuelve 'compartido' | 'descargado' | 'cancelado'. */
export async function compartirArchivo(blob, nombre, titulo = nombre) {
  const tipos = [blob.type, 'text/plain'].filter(Boolean);
  for (const tipo of tipos) {
    const file = new File([blob], nombre, { type: tipo });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: titulo }); return 'compartido'; }
      catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
      break;
    }
  }
  descargar(blob, nombre);
  return 'descargado';
}

/** Abre el selector de archivos. Devuelve el File elegido o null. */
export function elegirArchivo(accept) {
  return new Promise((resolver) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => { resolver(input.files[0] || null); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

/** Botones de días L M X J V que se pueden marcar. Devuelve {el, valor()} */
export function selectorDias(inicial = []) {
  const sel = new Set(inicial);
  const letras = ['L', 'M', 'X', 'J', 'V'];
  const el = h('div', { class: 'selector-dias', role: 'group' });
  letras.forEach((l, i) => {
    const n = i + 1;
    const b = h('button', {
      type: 'button', class: 'dia-btn' + (sel.has(n) ? ' activo' : ''), 'aria-pressed': String(sel.has(n)),
      onClick: () => {
        if (sel.has(n)) sel.delete(n); else sel.add(n);
        b.classList.toggle('activo', sel.has(n));
        b.setAttribute('aria-pressed', String(sel.has(n)));
      },
    }, l);
    el.append(b);
  });
  return { el, valor: () => [...sel].sort((a, b) => a - b) };
}
