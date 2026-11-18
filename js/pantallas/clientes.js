// =====================================================================
//  Pantalla «Clientes»: buscador, filtros y asignar días a varios.
// =====================================================================

import * as datos from '../datos.js';
import { coincideBusqueda, zonasDe, estadoEnFecha, DIAS_LETRA, NOMBRE_ESTADO } from '../logica.js';
import { h, hoja, toast, selectorDias } from '../ui.js';

const filtros = { texto: '', dia: '', zona: '', poblacion: '', estado: 'sin_baja', importantes: false };
let seleccionando = false;
const seleccion = new Set();
const LIMITE = 150; // tarjetas que se pintan de golpe (el resto con «Ver más»)
let mostrar = LIMITE;

const compararEs = (a, b) => String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });

function filtrar(clientes, fecha) {
  return clientes.filter((c) => {
    const est = estadoEnFecha(c, fecha);
    if (filtros.estado === 'sin_baja' && est === 'baja') return false;
    if (!['sin_baja', 'todos'].includes(filtros.estado) && est !== filtros.estado) return false;
    if (filtros.dia === 'sin' && (c.diasLlamada || []).length) return false;
    if (filtros.dia && filtros.dia !== 'sin' && !(c.diasLlamada || []).includes(Number(filtros.dia))) return false;
    if (filtros.zona && !zonasDe(c).includes(filtros.zona)) return false;
    if (filtros.poblacion && c.poblacion !== filtros.poblacion) return false;
    if (filtros.importantes && !c.importante) return false;
    return coincideBusqueda(c, filtros.texto);
  }).sort((a, b) => compararEs(a.nombreComercial, b.nombreComercial));
}

function numFiltros() {
  return ['dia', 'zona', 'poblacion'].filter((k) => filtros[k]).length +
    (filtros.estado !== 'sin_baja' ? 1 : 0) + (filtros.importantes ? 1 : 0);
}

export function render(cont, ctx) {
  const { fecha } = ctx.reloj.ahoraFH();
  const todos = datos.obtenerClientes();
  const lista = filtrar(todos, fecha);
  for (const id of [...seleccion]) if (!todos.some((c) => c.id === id)) seleccion.delete(id);

  const buscador = h('input', {
    class: 'campo buscador', type: 'search', placeholder: 'Buscar nombre, población, contacto o teléfono',
    value: filtros.texto, 'aria-label': 'Buscar clientes',
  });
  let temporizador;
  buscador.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      filtros.texto = buscador.value; mostrar = LIMITE;
      const pos = buscador.selectionStart;
      ctx.refrescar();
      const nuevo = cont.querySelector('.buscador');
      if (nuevo) { nuevo.focus(); try { nuevo.setSelectionRange(pos, pos); } catch { /* */ } }
    }, 200);
  });

  const chip = (texto, activo, fn) => h('button', { class: 'chip-filtro' + (activo ? ' activo' : ''), onClick: fn }, texto);
  const nf = numFiltros();
  const chips = h('div', { class: 'chips' },
    chip('Sin día asignado', filtros.dia === 'sin', () => { filtros.dia = filtros.dia === 'sin' ? '' : 'sin'; mostrar = LIMITE; ctx.refrescar(); }),
    chip('★ Importantes', filtros.importantes, () => { filtros.importantes = !filtros.importantes; ctx.refrescar(); }),
    chip(nf ? `Filtros (${nf})` : 'Filtros', nf > 0, () => abrirFiltros(ctx, todos)),
    nf || filtros.texto ? chip('Quitar filtros', false, () => {
      Object.assign(filtros, { texto: '', dia: '', zona: '', poblacion: '', estado: 'sin_baja', importantes: false });
      ctx.refrescar();
    }) : null);

  const barraSel = seleccionando
    ? h('div', { class: 'barra-seleccion' },
      h('span', {}, `${seleccion.size} seleccionados`),
      h('button', { class: 'btn btn-texto', onClick: () => { lista.forEach((c) => seleccion.add(c.id)); ctx.refrescar(); } }, `Todos (${lista.length})`),
      h('button', { class: 'btn btn-texto', onClick: () => { seleccion.clear(); ctx.refrescar(); } }, 'Ninguno'))
    : null;

  const filas = h('div', { class: 'lista-clientes' },
    lista.slice(0, mostrar).map((c) => filaCliente(c, fecha, ctx)),
    lista.length > mostrar ? h('button', { class: 'btn btn-secundario btn-ancho', onClick: () => { mostrar += LIMITE; ctx.refrescar(); } },
      `Ver ${Math.min(LIMITE, lista.length - mostrar)} más`) : null,
    lista.length ? null : h('p', { class: 'vacio-bloque' }, todos.length ? 'Ningún cliente coincide.' : 'Todavía no hay clientes. Impórtalos desde «Más».'));

  const pie = seleccionando
    ? h('div', { class: 'pie-accion' },
      h('button', { class: 'btn btn-secundario', onClick: () => { seleccionando = false; seleccion.clear(); ctx.refrescar(); } }, 'Cancelar'),
      h('button', { class: 'btn btn-principal', disabled: !seleccion.size, onClick: () => asignarDias(ctx) }, `Asignar día (${seleccion.size})`))
    : h('button', { class: 'fab', 'aria-label': 'Añadir cliente', onClick: () => ctx.abrirFicha(null) }, '+');

  cont.replaceChildren(...[
    h('header', { class: 'cabecera-pantalla' },
      h('h1', {}, 'Clientes'),
      h('button', { class: 'btn btn-secundario btn-peq', onClick: () => { seleccionando = !seleccionando; seleccion.clear(); ctx.refrescar(); } },
        seleccionando ? 'Terminar' : 'Seleccionar')),
    buscador, chips,
    h('p', { class: 'contador-lista' }, `${lista.length} de ${todos.length} clientes`),
    barraSel, filas, pie].filter(Boolean));
}

function filaCliente(c, fecha, ctx) {
  const est = estadoEnFecha(c, fecha);
  const dias = (c.diasLlamada || []).map((d) => DIAS_LETRA[d]).join(' ');
  const sel = seleccion.has(c.id);
  return h('button', {
    class: 'fila-cliente' + (sel ? ' seleccionada' : '') + (est === 'baja' ? ' baja' : ''),
    onClick: () => {
      if (seleccionando) { if (sel) seleccion.delete(c.id); else seleccion.add(c.id); ctx.refrescar(); } else ctx.abrirFicha(c.id);
    },
  },
  seleccionando ? h('span', { class: 'casilla' + (sel ? ' marcada' : ''), 'aria-hidden': 'true' }, sel ? '✓' : '') : null,
  h('span', { class: 'fc-texto' },
    h('span', { class: 'fc-nombre' }, (c.importante ? '★ ' : '') + c.nombreComercial),
    h('span', { class: 'fc-sub' }, [c.poblacion, c.contacto].filter(Boolean).join(' · ') || ' ')),
  h('span', { class: 'fc-lado' },
    dias ? h('span', { class: 'fc-dias' }, dias) : h('span', { class: 'fc-dias vacio' }, 'Sin día'),
    est !== 'activo' ? h('span', { class: `chip est-${est}` }, NOMBRE_ESTADO[est]) : null));
}

function abrirFiltros(ctx, todos) {
  const opciones = (lista) => lista.map(([v, t]) => h('option', { value: v }, t));
  const zonas = [...new Set(todos.flatMap(zonasDe))].sort(compararEs);
  const pobls = [...new Set(todos.map((c) => c.poblacion).filter(Boolean))].sort(compararEs);
  const sDia = h('select', { class: 'campo' }, opciones([['', 'Todos'], ['1', 'Lunes'], ['2', 'Martes'], ['3', 'Miércoles'], ['4', 'Jueves'], ['5', 'Viernes'], ['sin', 'Sin día asignado']]));
  const sZona = h('select', { class: 'campo' }, opciones([['', 'Todas'], ...zonas.map((z) => [z, z])]));
  const sPob = h('select', { class: 'campo' }, opciones([['', 'Todas'], ...pobls.map((p) => [p, p])]));
  const sEst = h('select', { class: 'campo' }, opciones([['sin_baja', 'Todos menos bajas'], ['activo', 'Activos'], ['vacaciones', 'De vacaciones'], ['baja', 'De baja'], ['todos', 'Todos']]));
  const cImp = h('input', { type: 'checkbox', checked: filtros.importantes });
  sDia.value = filtros.dia; sZona.value = filtros.zona; sPob.value = filtros.poblacion; sEst.value = filtros.estado;
  const campo = (t, el) => h('label', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, t), el);
  hoja({
    titulo: 'Filtros',
    contenido: (cerrar) => h('div', {},
      campo('Día de llamada', sDia), campo('Zona / ruta', sZona), campo('Población', sPob), campo('Estado', sEst),
      h('label', { class: 'casilla-fila' }, cImp, ' Solo importantes'),
      h('div', { class: 'fila-botones' },
        h('button', { class: 'btn btn-secundario', onClick: () => cerrar() }, 'Cancelar'),
        h('button', {
          class: 'btn btn-principal',
          onClick: () => {
            Object.assign(filtros, { dia: sDia.value, zona: sZona.value, poblacion: sPob.value, estado: sEst.value, importantes: cImp.checked });
            mostrar = LIMITE; cerrar(); ctx.refrescar();
          },
        }, 'Aplicar'))),
  });
}

function asignarDias(ctx) {
  const sel = selectorDias([]);
  const n = seleccion.size;
  hoja({
    titulo: `Asignar día a ${n} ${n === 1 ? 'cliente' : 'clientes'}`,
    contenido: (cerrar) => h('div', {},
      h('p', { class: 'texto-info' }, 'Elige uno o varios días:'),
      sel.el,
      h('div', { class: 'columna-botones' },
        h('button', { class: 'btn btn-principal btn-ancho', onClick: () => aplicar('anadir', cerrar) }, 'Añadir a sus días'),
        h('button', { class: 'btn btn-secundario btn-ancho', onClick: () => aplicar('sustituir', cerrar) }, 'Sustituir sus días'),
        h('button', { class: 'btn btn-texto', onClick: () => cerrar() }, 'Cancelar'))),
  });

  async function aplicar(modo, cerrar) {
    const dias = sel.valor();
    if (!dias.length && modo === 'anadir') { toast('Elige al menos un día'); return; }
    cerrar();
    const { fecha } = ctx.reloj.ahoraFH();
    const cambiados = [];
    for (const id of seleccion) {
      const c = datos.obtenerCliente(id);
      if (!c) continue;
      const nuevos = modo === 'anadir' ? [...new Set([...(c.diasLlamada || []), ...dias])].sort((a, b) => a - b) : dias;
      if (JSON.stringify(nuevos) === JSON.stringify(c.diasLlamada || [])) continue;
      cambiados.push({ ...c, diasLlamada: nuevos, diasLlamadaDesde: fecha });
    }
    const res = await datos.guardarClientes(cambiados);
    const anteriores = res.filter((r) => r.anterior).map((r) => r.anterior);
    seleccionando = false;
    seleccion.clear();
    ctx.refrescar();
    toast(`Días asignados a ${anteriores.length} ${anteriores.length === 1 ? 'cliente' : 'clientes'}`, {
      deshacer: async () => { await datos.restaurarVarios('clientes', anteriores); ctx.refrescar(); toast('Deshecho'); },
    });
  }
}
