// =====================================================================
//  app.js · Arranque, pestañas y service worker.
// =====================================================================

import * as datos from './datos.js';
import * as acciones from './acciones.js';
import { crearReloj } from './reloj.js';
import { h, hayHojaAbierta, toast } from './ui.js';
import { fechaNormal } from './logica.js';
import * as hoy from './pantallas/hoy.js';
import * as semana from './pantallas/semana.js';
import * as clientes from './pantallas/clientes.js';
import * as mas from './pantallas/mas.js';
import { abrirFicha } from './pantallas/ficha.js';

const PANTALLAS = { hoy, semana, clientes, mas };
const PESTANAS = [['hoy', 'Hoy', '☎'], ['semana', 'Semana', '▦'], ['clientes', 'Clientes', '☰'], ['mas', 'Más', '⋯']];

const reloj = crearReloj(location.search);
const contenido = document.getElementById('contenido');
let actual = sessionStorage.getItem('pestana') || 'hoy';
if (!PANTALLAS[actual]) actual = 'hoy';

const ctx = {
  reloj,
  fichaAbierta: null,
  refrescar,
  irA,
  abrirFicha: (id) => abrirFicha(ctx, id),
};

function irA(p) {
  actual = p;
  sessionStorage.setItem('pestana', p);
  window.scrollTo(0, 0);
  refrescar();
}

function refrescar() {
  const y = window.scrollY;
  try {
    PANTALLAS[actual].render(contenido, ctx);
  } catch (e) {
    console.error(e);
    contenido.replaceChildren(h('div', { class: 'aviso' }, h('p', {}, 'Ha habido un error al pintar la pantalla: ' + e.message)));
  }
  pintarPestanas();
  window.scrollTo(0, y);
  ctx.fichaAbierta?.();
}

function pintarPestanas() {
  const nav = document.getElementById('pestanas');
  nav.replaceChildren(...PESTANAS.map(([id, texto, icono]) => h('button', {
    class: 'pestana' + (id === actual ? ' activa' : ''), 'aria-current': id === actual ? 'page' : null,
    onClick: () => irA(id),
  }, h('span', { class: 'pestana-icono', 'aria-hidden': 'true' }, icono), h('span', {}, texto))));
}

// ---------------------------------------------------------------------
//  Service worker: funcionar sin conexión y avisar de versiones nuevas
// ---------------------------------------------------------------------

function avisoVersionNueva(reg) {
  if (document.querySelector('.aviso-version')) return;
  const barra = h('div', { class: 'aviso-version', role: 'alert' },
    h('span', {}, 'Hay una versión nueva'),
    h('button', {
      class: 'btn btn-principal btn-peq',
      onClick: () => { reg.waiting?.postMessage('actualizar'); barra.remove(); },
    }, 'Actualizar'));
  document.body.append(barra);
}

async function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    if (reg.waiting && navigator.serviceWorker.controller) avisoVersionNueva(reg);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisoVersionNueva(reg);
      });
    });
    // La primera vez que se abre la app no había service worker: al instalarse
    // toma el control, pero NO hay que recargar (cortaría la bienvenida o la
    // importación). Solo se recarga al pasar a una versión nueva.
    let habiaControlador = !!navigator.serviceWorker.controller;
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!habiaControlador) { habiaControlador = true; return; }
      if (recargando) return;
      recargando = true;
      location.reload(); // al recargar, datos.iniciar() ejecuta las migraciones
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  } catch (e) {
    console.warn('No se pudo registrar el service worker', e);
  }
}

// ---------------------------------------------------------------------
//  Arranque
// ---------------------------------------------------------------------

async function arrancar() {
  if (reloj.esPrueba) {
    const { fecha, hora } = reloj.ahoraFH();
    document.body.append(h('div', { class: 'banda-prueba' }, `MODO PRUEBA · ${fechaNormal(fecha)} ${hora}`));
    document.body.classList.add('con-banda');
  }
  try {
    await datos.iniciar({ prueba: reloj.esPrueba, reloj: reloj.ahora });
  } catch (e) {
    contenido.replaceChildren(h('div', { class: 'aviso' }, h('p', {}, 'No se pudo abrir la base de datos: ' + e.message)));
    return;
  }
  datos.pedirPersistencia();
  acciones.configurar(ctx);
  registrarSW();

  const aj = datos.obtenerAjustes();
  if (!aj.nombreComercial && !datos.obtenerClientes().length) {
    pintarPestanas();
    mas.bienvenida(ctx, () => irA('hoy'));
  } else {
    refrescar();
  }

  // Al volver a la app (después de una llamada): preguntar cómo ha ido
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!hayHojaAbierta()) refrescar();
    acciones.revisarLlamadaEnCurso();
  });
  acciones.revisarLlamadaEnCurso({ alRecargar: true });

  // Cada minuto se recalcula (horas de apertura, «más tarde»…)
  setInterval(() => {
    if (document.visibilityState === 'visible' && !hayHojaAbierta() && actual !== 'clientes') refrescar();
  }, 60 * 1000);

  window.addEventListener('error', (ev) => toast('Error: ' + ev.message));
  window.addEventListener('unhandledrejection', (ev) => toast('Error: ' + (ev.reason?.message || ev.reason)));
}

arrancar();
