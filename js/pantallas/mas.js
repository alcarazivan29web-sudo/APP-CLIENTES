// =====================================================================
//  Pantalla «Más»: importar/exportar, copia de seguridad y ajustes.
// =====================================================================

import * as datos from '../datos.js';
import { filasAClientes, planificarImportacion, leerArchivo } from '../importar.js';
import { exportarClientesExcel, hacerCopiaSeguridad, exportarHistorial } from '../exportar.js';
import { abrirPromos, flujoImportarOficina, abrirMensajes, estadoOficina, abrirResumen, abrirCambiosICG, contarCambiosICG } from './oficina.js';
import { leerCopia } from '../migraciones.js';
import {
  fechaNormal, fechaDeMarca, horaDeMarca, PLANTILLA_NO_CONTESTA, rellenarPlantilla,
  recordatoriosDelDia, recordatoriosProximos, fechaCorta, DIAS, diaSemana, capitalizarPrimera,
} from '../logica.js';
import * as acciones from '../acciones.js';
import { VERSION } from '../version.js';
import { h, hoja, toast, confirmar, elegirArchivo, pantallaCompleta } from '../ui.js';

const ACEPTA_EXCEL = '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';

export function render(cont, ctx) {
  const aj = datos.obtenerAjustes();
  const info = datos.infoBase();
  const n = datos.obtenerClientes().length;

  const tarjeta = (titulo, ...hijos) => h('section', { class: 'tarjeta-mas' }, h('h2', {}, titulo), ...hijos);
  const boton = (texto, fn, clase = 'btn-secundario') => h('button', { class: `btn ${clase} btn-ancho`, onClick: fn }, texto);

  const ultima = aj.ultimaCopia ? `${fechaNormal(fechaDeMarca(aj.ultimaCopia))} a las ${horaDeMarca(aj.ultimaCopia)}` : 'nunca';
  const persist = h('span', {}, '…');
  const { fecha } = ctx.reloj.ahoraFH();
  const ofi = estadoOficina(fecha);
  const numCambios = h('span', {}, 'Cambios para ICG');
  contarCambiosICG().then((n) => { numCambios.textContent = `Cambios para ICG (${n} ${n === 1 ? 'pendiente' : 'pendientes'})`; }).catch(() => {});
  datos.esPersistente().then((p) => { persist.textContent = p ? 'sí' : 'no (Android podría borrarlos si falta espacio)'; });

  cont.replaceChildren(
    h('header', { class: 'cabecera-pantalla' }, h('h1', {}, 'Más')),
    tarjeta('Clientes',
      h('p', { class: 'texto-ayuda' }, `${n} clientes en el móvil.`),
      boton('Importar clientes (Excel o CSV)', () => flujoImportarClientes(ctx), 'btn-principal'),
      boton('Exportar clientes a Excel', async () => {
        const r = await exportarClientesExcel(ctx.reloj.ahoraFH().fecha);
        if (r === 'descargado') toast('Excel guardado en Descargas');
      }),
      boton('Exportar historial de llamadas y pedidos', async () => {
        try {
          const r = await exportarHistorial(ctx.reloj.ahoraFH().fecha);
          if (r === 'descargado') toast('Excel guardado en Descargas');
        } catch (e) { toast('No se pudo crear el Excel: ' + e.message, { duracion: 7000 }); }
      })),
    tarjeta('Para la oficina',
      h('p', { class: 'texto-ayuda' }, 'El resumen de la semana para Iván (WhatsApp o correo) y el Excel semanal con todo el detalle.'),
      boton('Resumen semanal', () => abrirResumen(ctx), 'btn-principal'),
      boton(numCambios, () => abrirCambiosICG(ctx))),
    tarjeta('De la oficina',
      h('p', { class: 'texto-ayuda' }, `${ofi.texto}.`),
      h('p', { class: 'texto-ayuda' }, ofi.ultima
        ? `Último Excel de la oficina: ${fechaNormal(ofi.ultima.fecha)}.`
        : 'La oficina manda un Excel con las promociones, la lista de encargos, el mensaje de la semana y sus números. Cada importación sustituye a lo anterior.'),
      boton('Importar Excel de la oficina', () => flujoImportarOficina(ctx), 'btn-principal'),
      boton(`Ver promociones (${ofi.promos})`, () => abrirPromos(ctx)),
      ofi.mensajes ? boton(`Ver mensaje de la oficina${ofi.mensajes > 1 ? ` (${ofi.mensajes})` : ''}`, () => abrirMensajes(ctx)) : null),
    tarjeta('Recordatorios', ...seccionRecordatorios(ctx)),
    tarjeta('Copia de seguridad',
      h('p', { class: 'texto-ayuda' }, `Última copia: ${ultima}. Guarda todo (clientes, llamadas, pedidos y ajustes) en un archivo. Mándatelo por WhatsApp o correo para no perder nada si se rompe o cambias de móvil.`),
      boton('Hacer copia de seguridad', () => exportarYAvisar(ctx), 'btn-principal'),
      boton('Restaurar una copia', () => restaurar(ctx))),
    tarjeta('Ajustes', formAjustes(ctx, aj)),
    tarjeta('Acerca de',
      h('p', {}, `Llamadas VinOliva · versión ${VERSION}`),
      h('p', { class: 'texto-ayuda' }, `Datos guardados solo en este móvil. Almacenamiento protegido: `, persist, '.'),
      ctx.reloj.esPrueba ? h('p', { class: 'texto-ayuda' }, `MODO PRUEBA: base de datos aparte (${info.nombreBase}).`) : null,
      h('p', { class: 'texto-ayuda' }, `Usando la app desde el ${fechaNormal(aj.primerUso)}.`)),
  );
}

// ---------------------------------------------------------------------
//  Recordatorios pendientes (de hoy, vencidos y próximos)
// ---------------------------------------------------------------------

function seccionRecordatorios(ctx) {
  const { fecha } = ctx.reloj.ahoraFH();
  const todos = datos.obtenerRecordatorios();
  const deHoy = recordatoriosDelDia(todos, fecha);
  const proximos = recordatoriosProximos(todos, fecha);
  const fila = (r) => {
    const c = r.clienteId ? datos.obtenerCliente(r.clienteId) : null;
    return h('button', { class: 'fila-recordatorio', onClick: () => acciones.opcionesRecordatorio(r) },
      h('span', { class: 'fr-fecha' + (r.fecha < fecha ? ' vencido' : '') }, capitalizarPrimera(DIAS[diaSemana(r.fecha)]).slice(0, 3) + ' ' + fechaCorta(r.fecha)),
      h('span', { class: 'fr-texto' }, r.texto, c ? h('small', {}, ' · ' + c.nombreComercial) : null));
  };
  return [
    h('p', { class: 'texto-ayuda' }, deHoy.length + proximos.length
      ? `${deHoy.length} para hoy o vencidos · ${proximos.length} próximos.`
      : 'No tienes recordatorios pendientes.'),
    ...deHoy.map(fila),
    proximos.length ? h('details', {}, h('summary', {}, `Próximos (${proximos.length})`), proximos.slice(0, 100).map(fila)) : null,
    h('button', { class: 'btn btn-secundario btn-ancho', onClick: () => acciones.editarRecordatorio({ elegirCliente: true }) }, '+ Nuevo recordatorio'),
  ];
}

// ---------------------------------------------------------------------
//  Ajustes
// ---------------------------------------------------------------------

function formAjustes(ctx, aj) {
  const campo = (etiqueta, valor, ayuda, extra = {}) => {
    const el = extra.multilinea
      ? h('textarea', { class: 'campo', rows: 4 }, valor || '')
      : h('input', { class: 'campo', type: extra.tipo || 'text', value: valor || '', inputmode: extra.inputmode, placeholder: extra.placeholder });
    return { el, grupo: h('label', { class: 'campo-grupo' }, h('span', { class: 'etiqueta-campo' }, etiqueta), el, ayuda ? h('span', { class: 'texto-ayuda' }, ayuda) : null) };
  };
  const nombre = campo('Tu nombre', aj.nombreComercial, 'Sale al final de los pedidos que mandas a la oficina.', { placeholder: 'Ej.: Juan Bonilla' });
  const oficina = campo('WhatsApp de la oficina (pedidos)', aj.whatsappOficina, 'Si lo dejas vacío, se abrirá el menú de compartir para elegir a quién mandarlo.', { tipo: 'tel', inputmode: 'tel', placeholder: 'Ej.: 600 123 456' });
  const ivan = campo('WhatsApp o correo de Iván (resumen semanal)', aj.contactoIvan, null, { placeholder: 'Ej.: 600 123 456 o correo@ejemplo.com' });
  const plantilla = campo('Mensaje cuando no contesta', aj.plantillas.noContesta,
    'Puedes usar {contacto}, {nombre} (del bar), {comercial} (tu nombre de pila) y {dia}.', { multilinea: true });
  const riesgo = campo('Semanas sin pedir para marcar «en riesgo»', String(aj.semanasRiesgo ?? 3),
    'Un cliente activo que lleve estas semanas sin pedir sale con la etiqueta «X semanas sin pedir».', { tipo: 'number', inputmode: 'numeric' });
  riesgo.el.min = '1'; riesgo.el.max = '52';
  const vista = h('p', { class: 'vista-previa' });
  const actualizarVista = () => {
    vista.textContent = 'Ejemplo: ' + rellenarPlantilla(plantilla.el.value, {
      cliente: { contacto: 'FERNANDO', nombreComercial: 'BAR TORRES' }, comercial: nombre.el.value || 'Juan', fecha: ctx.reloj.ahoraFH().fecha,
    });
  };
  plantilla.el.addEventListener('input', actualizarVista);
  nombre.el.addEventListener('input', actualizarVista);
  actualizarVista();

  return h('div', {},
    nombre.grupo, oficina.grupo, ivan.grupo, plantilla.grupo, vista,
    h('button', {
      class: 'btn btn-texto',
      onClick: () => { plantilla.el.value = PLANTILLA_NO_CONTESTA; actualizarVista(); },
    }, 'Volver al mensaje original'),
    riesgo.grupo,
    h('button', {
      class: 'btn btn-principal btn-ancho',
      onClick: async () => {
        const sem = Math.round(Number(riesgo.el.value));
        if (!(sem >= 1 && sem <= 52)) { toast('Las semanas para «en riesgo» tienen que ser un número entre 1 y 52'); riesgo.el.focus(); return; }
        await datos.guardarAjustes({
          semanasRiesgo: sem,
          nombreComercial: nombre.el.value.trim(),
          whatsappOficina: oficina.el.value.trim(),
          contactoIvan: ivan.el.value.trim(),
          plantillas: { ...aj.plantillas, noContesta: plantilla.el.value.trim() || PLANTILLA_NO_CONTESTA },
        });
        toast('Ajustes guardados');
        ctx.refrescar();
      },
    }, 'Guardar ajustes'));
}

// ---------------------------------------------------------------------
//  Copia de seguridad
// ---------------------------------------------------------------------

export async function exportarYAvisar(ctx) {
  try {
    const { resultado } = await hacerCopiaSeguridad(ctx.reloj.ahoraFH().fecha);
    if (resultado === 'descargado') toast('Copia guardada en Descargas. Mándatela por WhatsApp o correo.', { duracion: 7000 });
    else if (resultado === 'compartido') toast('Copia de seguridad hecha');
    ctx.refrescar();
  } catch (e) {
    toast('No se pudo hacer la copia: ' + e.message);
  }
}

async function restaurar(ctx) {
  const file = await elegirArchivo('.json,application/json,text/plain');
  if (!file) return;
  let info;
  const texto = await file.text();
  try { info = leerCopia(texto); } catch (e) { toast(e.message, { duracion: 7000 }); return; }
  const nCli = info.datos.clientes.filter((c) => !c.borrado).length;
  const nLl = info.datos.llamadas.filter((c) => !c.borrado).length;
  const cuando = info.exportado ? `${fechaNormal(fechaDeMarca(info.exportado))} a las ${horaDeMarca(info.exportado)}` : 'fecha desconocida';
  const ok = await confirmar(
    `Copia del ${cuando}: ${nCli} clientes y ${nLl} llamadas. Se BORRARÁ todo lo que hay ahora en el móvil y se sustituirá por la copia. ¿Seguir?`,
    { ok: 'Restaurar', peligro: true, titulo: 'Restaurar copia' });
  if (!ok) return;
  try {
    await datos.restaurarCopia(texto);
    toast('Copia restaurada');
    ctx.refrescar();
  } catch (e) {
    toast('No se pudo restaurar: ' + e.message, { duracion: 7000 });
  }
}

// ---------------------------------------------------------------------
//  Importar clientes (también se usa desde la bienvenida)
// ---------------------------------------------------------------------

export async function flujoImportarClientes(ctx, alTerminar) {
  const file = await elegirArchivo(ACEPTA_EXCEL);
  if (!file) return false;
  let leido;
  try {
    const filas = await leerArchivo(file, 'Clientes');
    leido = filasAClientes(filas);
  } catch (e) {
    toast('No se pudo leer el archivo: ' + e.message, { duracion: 7000 });
    return false;
  }
  if (!leido.clientes.length) {
    toast(leido.avisos[0] || 'El archivo no tiene clientes.', { duracion: 7000 });
    return false;
  }
  const { fecha } = ctx.reloj.ahoraFH();
  const plan = planificarImportacion(leido.clientes, datos.obtenerClientes({ incluirBorrados: true }),
    { fecha, archivo: file.name, columnas: leido.columnas });
  return new Promise((resolver) => {
    const r = plan.resumen;
    const linea = (num, texto, clase = '') => h('li', { class: clase }, h('strong', {}, String(num)), ' ', texto);
    pantallaCompleta({
      titulo: 'Importar clientes',
      alCerrar: () => resolver(false),
      contenido: (cerrar) => h('div', { class: 'importar' },
        h('p', {}, `Archivo: ${file.name}`),
        h('ul', { class: 'resumen-importar' },
          linea(r.total, 'clientes en el archivo'),
          linea(r.nuevos, 'nuevos'),
          r.actualizados ? linea(r.actualizados, 'ya existían y se actualizan') : null,
          r.sinCambios ? linea(r.sinCambios, 'ya existían, sin cambios') : null,
          linea(r.sinTelefono, 'sin teléfono', r.sinTelefono ? 'aviso' : ''),
          linea(r.sinDia, 'sin día de llamada (asígnalo en Clientes → «Sin día asignado»)', r.sinDia ? 'aviso' : ''),
          linea(r.posibleDuplicado, 'marcados como «POSIBLE DUPLICADO»', r.posibleDuplicado ? 'aviso' : ''),
          r.bajaCerrado ? linea(r.bajaCerrado, 'entran como baja porque el Excel dice CERRADO', 'aviso') : null),
        plan.actualizaciones.length ? h('details', {}, h('summary', {}, 'Ver qué se actualiza'),
          h('ul', { class: 'lista-simple' }, plan.actualizaciones.slice(0, 100).map((a) =>
            h('li', {}, `${a.nombre}: ${Object.keys(a.cambios).filter((k) => k !== 'diasLlamadaDesde').join(', ')}`)))) : null,
        leido.avisos.length ? h('details', {}, h('summary', {}, `Avisos al leer el archivo (${leido.avisos.length})`),
          h('ul', { class: 'lista-simple' }, leido.avisos.slice(0, 200).map((a) => h('li', {}, a)))) : null,
        h('p', { class: 'texto-ayuda' }, 'Se conservan el estado, el historial, las vacaciones y lo que hayas cambiado en la app. Una celda vacía en el Excel no borra datos. Los clientes que no estén en el archivo no se borran.'),
        h('div', { class: 'columna-botones' },
          h('button', {
            class: 'btn btn-principal btn-ancho',
            disabled: !plan.nuevos.length && !plan.actualizaciones.length,
            onClick: async (ev) => {
              ev.target.disabled = true;
              try {
                await datos.importarClientes(plan);
                toast(`Importados: ${r.nuevos} nuevos, ${r.actualizados} actualizados`);
                resolver(true); // antes de cerrar(): cerrar() llama a alCerrar, que resolvería «false»
                cerrar();
                alTerminar?.();
                ctx.refrescar();
              } catch (e) {
                ev.target.disabled = false;
                toast('Error al guardar: ' + e.message, { duracion: 7000 });
              }
            },
          }, plan.nuevos.length || plan.actualizaciones.length ? 'Importar' : 'No hay nada que importar'),
          h('button', { class: 'btn btn-secundario btn-ancho', onClick: () => cerrar() }, 'Cancelar'))),
    });
  });
}

// ---------------------------------------------------------------------
//  Bienvenida (primera vez)
// ---------------------------------------------------------------------

export function bienvenida(ctx, alTerminar) {
  const nombre = h('input', { class: 'campo', type: 'text', placeholder: 'Ej.: Juan Bonilla', autocomplete: 'name' });
  const guardarNombre = async () => {
    const v = nombre.value.trim();
    if (!v) { toast('Escribe tu nombre'); nombre.focus(); return false; }
    await datos.guardarAjustes({ nombreComercial: v });
    return true;
  };
  const pc = pantallaCompleta({
    titulo: 'Bienvenido',
    contenido: () => h('div', { class: 'bienvenida' },
      h('img', { src: 'icons/icono-192.png', alt: '', width: 96, height: 96 }),
      h('h2', {}, 'Llamadas VinOliva'),
      h('p', {}, 'Cada día verás a quién tienes que llamar. Primero, dinos tu nombre:'),
      nombre,
      h('div', { class: 'columna-botones' },
        h('button', {
          class: 'btn btn-principal btn-ancho',
          onClick: async () => {
            if (!await guardarNombre()) return;
            await flujoImportarClientes(ctx);
            // Si ya hay clientes guardados, la bienvenida ha terminado
            if (datos.obtenerClientes().length) { pc.cerrar(); alTerminar(); }
          },
        }, 'Importar clientes desde Excel'),
        h('button', {
          class: 'btn btn-secundario btn-ancho',
          onClick: async () => { if (await guardarNombre()) { pc.cerrar(); alTerminar(); } },
        }, 'Empezar vacío'))),
  });
  pc.cuerpo.closest('.pantalla-completa').querySelector('.pc-volver').style.visibility = 'hidden';
}
