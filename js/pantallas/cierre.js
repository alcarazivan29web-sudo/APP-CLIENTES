// =====================================================================
//  Pantalla de cierre: sale en lugar de la app cuando CIERRE.activo es
//  true (ver js/cierre.js). No hay pestañas ni se puede trabajar.
// =====================================================================

import * as datos from '../datos.js';
import { hacerCopiaSeguridad } from '../exportar.js';
import { fechaLocal } from '../logica.js';
import { h, toast } from '../ui.js';

const BASES = ['llamadas-vinoliva', 'llamadas-vinoliva-prueba'];

function borrarBase(nombre) {
  return new Promise((res) => {
    let bloqueada = false;
    const r = indexedDB.deleteDatabase(nombre);
    r.onsuccess = () => res(true);
    r.onerror = () => res(false);
    r.onblocked = () => { bloqueada = true; };
    setTimeout(() => res(!bloqueada), 5000);
  });
}

/** Borra todo lo que la app guarda en el móvil y quita la copia sin conexión. */
export async function borrarTodo() {
  let ok = true;
  for (const n of BASES) ok = (await borrarBase(n)) && ok;
  try {
    for (const k of await caches.keys()) if (k.startsWith('llamadas-vinoliva-')) await caches.delete(k);
  } catch { ok = false; }
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* nada */ }
  try {
    for (const r of (await navigator.serviceWorker?.getRegistrations?.()) || []) await r.unregister();
  } catch { ok = false; }
  return ok;
}

const desinstalar = () => h('ol', {},
  h('li', {}, 'Mantén pulsado el icono de la app en la pantalla del móvil.'),
  h('li', {}, 'Pulsa «Desinstalar» (o «Quitar»).'));

export async function mostrarCierre(contenedor, cierre, { prueba = false } = {}) {
  document.getElementById('pestanas')?.replaceChildren();
  const caja = h('section', { class: 'pantalla-cierre' },
    h('p', { class: 'cierre-marca' }, 'VinOliva'),
    h('h1', {}, 'Esta app ya no está en uso'),
    h('p', { class: 'mensaje-texto' }, cierre.mensaje || ''));
  contenedor.replaceChildren(caja);

  if (cierre.borrarDatos) {
    const estado = h('p', {}, 'Borrando los datos de este móvil…');
    caja.append(estado);
    const ok = await borrarTodo();
    estado.textContent = ok
      ? 'Los datos de la app se han borrado de este móvil. Ya puedes desinstalarla:'
      : 'No se ha podido borrar todo. Cierra la app del todo, vuelve a abrirla y, después, desinstálala:';
    caja.append(desinstalar());
    return;
  }

  // Los datos siguen en el móvil: se puede hacer la copia para la oficina
  try {
    await datos.iniciar({ prueba });
  } catch {
    caja.append(h('p', {}, 'Ya puedes desinstalarla:'), desinstalar());
    return;
  }
  const n = datos.obtenerClientes().length;
  caja.append(
    h('p', {}, n
      ? `Tus datos (${n} clientes, llamadas y pedidos) siguen en este móvil. Antes de desinstalar la app, haz una copia de seguridad y mándala a la oficina.`
      : 'No queda ningún cliente en este móvil.'),
    n ? h('button', {
      class: 'btn btn-principal btn-ancho',
      onClick: async () => {
        try {
          const { resultado } = await hacerCopiaSeguridad(fechaLocal(new Date()));
          if (resultado === 'descargado') toast('Copia guardada en Descargas. Mándala a la oficina por WhatsApp o correo.', { duracion: 8000 });
          else if (resultado === 'compartido') toast('Copia de seguridad hecha');
        } catch (e) { toast('No se pudo hacer la copia: ' + e.message, { duracion: 7000 }); }
      },
    }, 'Hacer copia de seguridad y mandarla') : null,
    h('p', {}, 'Después, para quitar la app:'),
    desinstalar());
}
