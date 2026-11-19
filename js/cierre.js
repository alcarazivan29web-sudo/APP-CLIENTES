// =====================================================================
//  cierre.js · Interruptor para APAGAR la app (versión de cierre).
//
//  Normalmente está en  activo: false  y no hace nada.
//
//  Para cerrar la app a todos los comerciales:
//   1. Pon  activo: true  aquí Y  CIERRE_ACTIVO = true  en sw.js.
//   2. Sube la versión (sw.js y js/version.js) y publícala en GitHub.
//   3. Espera a que los comerciales abran la app con conexión: la verán
//      «ya no está en uso» (se aplica sola, sin pulsar «Actualizar»).
//   4. Después despublica GitHub Pages (Settings → Pages → Unpublish).
//
//  borrarDatos: false → los datos se quedan en el móvil y la app solo deja
//                       hacer la copia de seguridad para mandarla a la oficina.
//  borrarDatos: true  → al abrirla, BORRA del móvil clientes, llamadas,
//                       pedidos y ajustes, y deja de funcionar sin conexión.
//                       Pide antes a los comerciales que manden su copia.
// =====================================================================

export const CIERRE = {
  activo: false,
  borrarDatos: false,
  mensaje: 'Esta app ya no se usa. Si tienes alguna duda, habla con la oficina de VinOliva.',
};
