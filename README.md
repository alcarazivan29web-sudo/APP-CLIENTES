# Llamadas VinOliva

App para el móvil Android del comercial. Al abrirla ve **a quién tiene que llamar hoy**. Llama con un toque, apunta cómo ha ido y, si hay pedido, lo manda a la oficina por WhatsApp.

- Es una **app web instalable** (PWA): se instala desde Chrome y funciona **sin conexión**.
- Los datos se guardan **solo en el móvil**. No hay servidor ni nube.
- **Los datos de clientes nunca están en el código ni se suben a GitHub.** Se cargan en el móvil con el botón «Importar».

**Estado:** fases 1 (Llamadas), 2 (Seguimiento), 3 (Oficina), 4 (Ficha completa), 5 (Encargos a la oficina) y 6 (La oficina manda) terminadas. Fase 7 (conexión con el CRM de la oficina) en marcha. Versión 1.6.0.

**Qué hace la fase 2:**
- **Registrar pedido** (ficha o menú ⋯): pedidos que llegan fuera de su día (llamó el cliente, WhatsApp o visita). Ese cliente ya no sale para llamar el resto de la semana.
- **Recordatorios** (botón «+ Recordatorio» en Hoy, ficha o Más): salen arriba del todo el día que tocan y siguen saliendo como «vencidos» hasta marcarlos como hechos.
- **Clientes en riesgo:** la etiqueta «X semanas sin pedir» (3 por defecto, se cambia en Ajustes). No marca a nadie hasta que la app lleve ese tiempo en uso. Solo cuenta clientes activos con día de llamada.
- **Ficha:** ★ importante, pide habitualmente, condiciones y cobro pendiente. Filtros «En riesgo» y «Cobro pendiente» en Clientes.
- **Potenciales:** con el + de Clientes, eligiendo «Potencial». Si tienen día, salen en el bloque **Captación** de Hoy. Si piden, la app pregunta «¿Pasar a cliente?».

**Qué hace la fase 3:**
- **Resumen semanal para Iván:** desde el viernes a las 12:00 sale en Hoy el aviso «Enviar resumen de la semana a Iván». El lunes sigue saliendo si no se envió el viernes. Se abre también desde **Más → Resumen semanal**, donde se pueden ver semanas anteriores. Lleva llamadas por día, pedidos, quién se quedó sin llamar, clientes en riesgo, bajas, vacaciones, clientes y potenciales nuevos, recordatorios sin hacer y cambios para ICG. Se envía por WhatsApp o por correo, según lo que haya en Ajustes.
- **Excel de la semana:** botón «Enviar Excel de la semana» en el resumen. Se llama `semana_AAAA-MM-DD_Nombre.xlsx` y tiene siempre las mismas hojas: Resumen, Llamadas, Pedidos, Clientes, Cambios ICG y Recordatorios. Todas empiezan por las columnas Comercial · Semana · Código · Cliente, para poder juntar los Excel de varios comerciales. La hoja Clientes **no lleva teléfonos**.
- **Cambios para ICG** (Más): los datos de clientes que el comercial ha cambiado en la app (teléfono, contacto, forma de pago…), con el antes y el después, para actualizarlos en ICG. Se exportan a Excel. Al enviar el resumen se marcan solos como enviados, con la opción de deshacer.
- **Promociones:** botón **Promos** en Hoy, con buscador. Se cargan con el **Excel de la oficina** (Más → «Importar Excel de la oficina»). Cada importación sustituye a las anteriores. Las caducadas no se ven y las que aún no han empezado salen al final, más claras.
- **Exportar historial** (Más): todas las llamadas y pedidos en un Excel.

**Qué hace la fase 4:**
- **Varios teléfonos con nombre:** en la ficha, cada teléfono lleva un nombre (Jefe, Pedidos, Bar…) y para qué sirve: «Llamar y WhatsApp», «Solo llamar» o «Solo WhatsApp». Al pulsar Llamar o WhatsApp, si solo hay uno que sirva, se abre directo; si hay varios, la app pregunta mostrando el nombre de cada uno.
- **Obligatorio al crear un cliente:** nombre y teléfono. Si no tiene día de llamada, la app avisa de que no saldrá en Hoy.
- **Falta por configurar:** la ficha avisa de lo que le falta (teléfono, día, contacto, población, nombre fiscal, forma de pago) y cada dato lleva a su campo. En Clientes, el filtro «Por completar» y la etiqueta «Sin teléfono». En Hoy, un aviso con los clientes sin teléfono o sin día (se puede ocultar ese día).
- **Condiciones especiales:** descuentos o precios solo para un cliente (producto, condición, hasta cuándo y nota). Salen en su tarjeta de Hoy y al apuntar sus pedidos; las caducadas dejan de salir. La oficina las ve en el resumen del viernes («Condiciones nuevas») y en la hoja «Condiciones» del Excel semanal. Las promociones para todos siguen en «Promos».
- **Repetir último pedido:** al apuntar un pedido, un botón copia el último que hizo ese cliente.
- **Llamar a partir de:** una hora por cliente (por ejemplo, «el jefe llega a las 11»). Hasta esa hora, el cliente sale más abajo en Hoy.

**Qué hace la fase 5:**
- **«📌 Pedir a la oficina»** (en la ficha y en el menú ⋯): el comercial elige un encargo y a la **oficina** le llega un WhatsApp que empieza por «📌 ENCARGO» con los datos del cliente: nombre, código, población, contacto, su WhatsApp y su teléfono para llamar. Los encargos son:
  - enviar el catálogo de Navidad;
  - enviar el catálogo general;
  - enviar la tarifa de precios;
  - enviar la ficha de un producto (pregunta cuál);
  - que le llame la oficina;
  - revisar un cobro o una factura;
  - otro (lo escribe él).

  Se puede añadir una nota, y antes de enviar se ve el mensaje tal como llegará.
- **A varios clientes a la vez:** en Clientes → «Seleccionar», se marcan los clientes y se pulsa «📌 Oficina». Llega un solo mensaje con la lista. Si son muchos, se puede mandar también la lista en Excel.
- **Queda apuntado:** en la ficha de cada cliente («Pedido a la oficina»), en el resumen del viernes («Encargos a la oficina») y en la hoja «Encargos» del Excel semanal.
- Va al **WhatsApp de la oficina** de Ajustes, el mismo de los pedidos. Si está vacío, se abre el menú de compartir.

**Qué hace la fase 6:**
- **Un solo Excel de la oficina** (`Excel_oficina_plantilla.xlsx`, en `datos-privados/`) con cuatro hojas: **Promociones**, **Encargos** (la lista de cosas que el comercial puede pedir a la oficina), **Mensaje** (el aviso de la semana) y **Números** (WhatsApp de la oficina y el tuyo). En la app: **Más → «Importar Excel de la oficina»**. Antes de importar, la app enseña qué cambia. Un Excel antiguo de solo promociones también vale.
- **Mensaje de la oficina:** sale arriba en Hoy («📣 Mensaje de la oficina») hasta que el comercial pulsa **Entendido**. Puede tener fechas «desde» y «hasta». Se vuelve a ver en Más → «Ver mensaje de la oficina».
- **Lista de encargos de la oficina:** si el Excel trae la hoja Encargos, el botón «📌 Pedir a la oficina» enseña esa lista. Siempre queda una opción para escribir libremente. Los encargos ya enviados conservan su nombre aunque cambie la lista.
- **Versión de cierre preparada y apagada:** ver el apartado 8.

**Fase 7 (en marcha) · Conexión con el CRM de la oficina:**
- La ficha del cliente tiene **Dirección** y **Email** (con botón «Correo»). Se importan y exportan en el Excel de clientes (columnas «Dirección» y «Email», también valen «Correo», «Domicilio»…) y salen en la hoja Clientes del Excel semanal.

---

## 1. Probarla en el ordenador

Necesitas el Terminal del Mac.

1. Abre el Terminal y entra en la carpeta de la app:
   ```bash
   cd "/Users/ialcaraz/Desktop/Espacio IA/APP-CLIENTES"
   ```
2. Levanta un servidor local (solo lo ves tú, desde este Mac):
   ```bash
   python3 -m http.server 8000 --bind 127.0.0.1
   ```
3. Abre Chrome y entra en <http://localhost:8000>.
4. Para pararlo, vuelve al Terminal y pulsa `Ctrl + C`.

**Modo prueba.** Añade a la dirección `?hoy=2026-11-18&hora=10:30` y la app hará como si fuera ese día y esa hora:
<http://localhost:8000/?hoy=2026-11-18&hora=10:30>

En modo prueba arriba sale una banda morada y se usa **otra base de datos aparte**, así que puedes trastear sin estropear los datos de verdad.

**Tests (pruebas automáticas).** Comprueban que la lógica funciona. Desde la carpeta de la app:
```bash
node --test
```
Para probar la importación con los Excel reales de `datos-privados/`:
```bash
node tests/probar-importacion-real.js
```

---

## 2. Publicarla gratis en GitHub Pages

GitHub Pages aloja la app gratis con una dirección del tipo `https://TU-USUARIO.github.io/app-llamadas-vinoliva/`. Para que sea gratis, el repositorio tiene que ser **público**. No pasa nada: solo se sube el código, y el archivo `.gitignore` impide subir los Excel, la carpeta `datos-privados/` y las copias de seguridad.

Usaremos **GitHub Desktop**, un programa con botones que respeta el `.gitignore`.

### La primera vez

1. Descarga e instala GitHub Desktop: <https://desktop.github.com>. Ábrelo y entra con tu cuenta de GitHub.
2. Menú **File → Add Local Repository…** y elige la carpeta `APP-CLIENTES`.
3. Te dirá que no es un repositorio. Pulsa **create a repository**:
   - **Name:** `app-llamadas-vinoliva`
   - Deja el resto como está y pulsa **Create Repository**.
4. **Comprueba que no se sube ningún dato.** A la izquierda, en la pestaña **Changes**, verás la lista de archivos. **No** puede aparecer:
   - la carpeta `datos-privados`;
   - ningún archivo `.xlsx`, `.csv` o `copia_llamadas_….json`.

   Si aparece alguno, **para** y avísame.
5. Abajo a la izquierda, en **Summary**, escribe `Primera versión` y pulsa **Commit to main**.
6. Arriba pulsa **Publish repository**. **Quita** la marca de «Keep this code private» y pulsa **Publish Repository**.
7. Ve a <https://github.com>, abre tu repositorio `app-llamadas-vinoliva` → **Settings** → **Pages** (menú de la izquierda).
8. En **Build and deployment → Source** elige **Deploy from a branch**. En **Branch** elige **main** y **/ (root)**, y pulsa **Save**.
9. Espera uno o dos minutos y recarga esa página. Arriba saldrá **«Your site is live at https://TU-USUARIO.github.io/app-llamadas-vinoliva/»**. Ese es el enlace para el comercial.

### Cómo comprobar que no se ha subido ningún dato de clientes

- En la web de GitHub, abre el repositorio: en la lista de archivos **no** debe estar `datos-privados` ni ningún `.xlsx`.
- O desde el Terminal, dentro de la carpeta, ejecuta esto. No debe salir **nada**:
  ```bash
  git ls-files | grep -iE "\.(xlsx|xls|csv)$|datos-privados|copia_"
  ```

---

## 3. Instalarla en el Android del comercial

1. Mándale el enlace de GitHub Pages por WhatsApp.
2. Que lo abra con **Chrome**. Si WhatsApp lo abre en su navegador interno, que toque el menú ⋮ → «Abrir en Chrome».
3. En Chrome: menú **⋮** → **«Instalar aplicación»** o **«Añadir a pantalla de inicio»** → **Instalar**.
4. Aparecerá el icono **Llamadas** (azul y dorado) en la pantalla de inicio. A partir de ahí, que la abra siempre desde ese icono.
5. La primera vez pide su nombre y ofrece **«Importar clientes desde Excel»** o **«Empezar vacío»**.

Funciona sin conexión. Solo hace falta internet para enviar WhatsApps.

---

## 4. Importar los clientes y el Excel de la oficina desde el móvil

1. Desde tu ordenador, mándale el Excel (`Clientes_Bonilla_para_app.xlsx`) por **WhatsApp** o por **correo**.
2. En su móvil, que **abra o descargue** el archivo desde WhatsApp. Así queda guardado en el móvil, normalmente en la carpeta *Descargas* o *Documentos → WhatsApp*.
3. En la app: **Más → Importar clientes (Excel o CSV)** y que elija el archivo.
4. Verá un resumen antes de guardar: cuántos clientes hay, cuántos sin teléfono, cuántos sin día y cuántos «posible duplicado». Pulsa **Importar**.

**Si se importa otra vez** (por ejemplo, con el Excel actualizado):
- los clientes se emparejan por su **ID** (C001, C002…);
- se actualizan los datos que vienen en el Excel, pero **una celda vacía no borra** lo que el comercial haya puesto en la app (por ejemplo, los días asignados);
- los **teléfonos nuevos del Excel se añaden** a los que ya tiene el móvil: no se pierde el que haya apuntado el comercial, ni su nombre;
- se conservan el estado, el historial, las vacaciones y los cambios hechos en la app;
- los clientes que no estén en el archivo **no se borran**.

**Reglas al importar:**
- Si «Día que cierra» o «Forma de pago» dice exactamente `CERRADO`, el cliente entra como **baja** con el motivo «Cerrado (según Excel)».
- Las columnas que la app no conoce se ignoran.
- Si el Excel trae las columnas **«Teléfonos con nombre»** o **«Llamar a partir de»** (las pone la propia app al exportar), también se leen. Así, exportar los clientes y volver a importarlos no pierde nada.
- Las condiciones especiales, el estado, el historial y lo demás que solo existe en la app **no se importan desde Excel**: para pasar todo a otro móvil se usa la **copia de seguridad**.

**Antes de importar:** corrige en el Excel la fila **C001** («JOSE PARSIFAL»), que tiene 11 teléfonos y un teléfono en «Población», y la **C004**, que tiene un email en «Población».

### Excel de la oficina (promociones, encargos, mensaje y números)

1. Rellena la plantilla `Excel_oficina_plantilla.xlsx` (en `datos-privados/`). La hoja **LEEME** explica cada hoja.
   - **Promociones:** Producto, Detalle, Precio (€), Promoción, Desde, Hasta y Tipo. Solo «Producto» es obligatoria.
   - **Encargos:** uno por fila. «Hay que escribir»: vacío, «Producto» o «Texto». «Icono» es opcional. Viene rellena con la lista actual.
   - **Mensaje:** el aviso de la semana, con Desde y Hasta opcionales. Para varias líneas dentro de una celda: Alt + Intro.
   - **Números:** WhatsApp de la oficina y el tuyo. Solo cambian si los rellenas.
2. Las filas que empiecen por **EJEMPLO** se ignoran: puedes dejarlas como guía.
3. Mándale el Excel por WhatsApp o correo y que lo abra o descargue en el móvil.
4. En la app: **Más → «Importar Excel de la oficina»**. Verá qué cambia y pulsará **Importar**.
5. Qué sustituye a qué:
   - las **promociones** sustituyen a todas las anteriores (manda siempre todas las vigentes). Si la hoja no trae ninguna, se quedan las de antes;
   - la **lista de encargos** sustituye a la anterior. Si la hoja está vacía, se queda la de antes;
   - los **mensajes** sustituyen a los anteriores. Si la hoja Mensaje está vacía, se quita el mensaje;
   - los **números** solo cambian si vienen rellenos.

**Ojo:** no cambies los nombres de las hojas ni de las columnas.

---

## 5. Configurar los números de la oficina y el tuyo

En la app: **Más → Ajustes**.

- **Tu nombre:** el del comercial, por ejemplo «Juan Bonilla». Sale al final de cada pedido.
- **WhatsApp de la oficina:** el número al que llegan los pedidos. Si se deja vacío, al enviar un pedido se abre el menú de compartir para elegir a quién. También se puede cambiar con la hoja «Números» del Excel de la oficina.
- **WhatsApp o correo de Iván:** para el resumen semanal. Si es un número, se envía por WhatsApp. Si es un correo, se abre el correo con el texto ya escrito. Si se deja vacío, se abre el menú de compartir.
- **Mensaje cuando no contesta:** se puede cambiar. Usa `{contacto}`, `{nombre}`, `{comercial}` y `{dia}`.

Pulsa **Guardar ajustes**.

---

## 6. Copia de seguridad (¡importante!)

Los datos viven **solo en el móvil**. Si el móvil se rompe, se pierde o se borran los datos de Chrome, **se pierde todo** si no hay copia.

- **Hacer copia:** **Más → Hacer copia de seguridad**. Se abre el menú de compartir: que se la mande a sí mismo (o a ti) por WhatsApp o por correo. Si el móvil no deja compartir el archivo, se guarda en *Descargas*. El archivo se llama `copia_llamadas_AAAA-MM-DD.json`.
- **Recordatorio:** si pasan más de 7 días sin copia, la pantalla Hoy lo avisa.
- **Restaurar:** **Más → Restaurar una copia** y elegir el archivo. Pide confirmación porque **sustituye todo** lo que hay en el móvil.
- Para pasar la app a un móvil nuevo: hacer la copia en el viejo, instalar la app en el nuevo y restaurar.

Las copias **no** se suben a GitHub: el `.gitignore` las excluye.

---

## 7. Publicar una versión nueva sin que el comercial pierda sus datos

Los datos están en el móvil (IndexedDB), **no** en los archivos de la app. Actualizar la app no los toca.

1. Haz los cambios en los archivos.
2. Sube el número de versión en **dos sitios** (el mismo número en los dos):
   - `js/version.js` → `export const VERSION = '1.6.0';`
   - `sw.js` → `const VERSION = '1.6.0';`
3. Si has añadido un archivo nuevo de la app, añádelo también a la lista `ARCHIVOS` de `sw.js`.
4. Pasa los tests: `node --test`.
5. En GitHub Desktop: comprueba que en **Changes** no hay datos de clientes, escribe un resumen, pulsa **Commit to main** y luego **Push origin**.
6. En uno o dos minutos, cuando el comercial abra la app con conexión, verá arriba **«Hay una versión nueva · Actualizar»**. Al pulsarlo, la app se recarga y, si hace falta, **migra los datos** a la versión nueva. Antes de migrar guarda una copia interna, por si acaso.

---

## 8. Cerrar la app (versión de cierre)

La app está publicada en tu GitHub, así que la puedes cerrar cuando quieras. Pero **las copias instaladas en los móviles siguen funcionando sin conexión** aunque despubliques la web. Por eso, primero hay que mandarles una «versión de cierre». Ya está preparada y **apagada** en `js/cierre.js`.

1. **Antes de nada:** pide a cada comercial que haga la copia de seguridad y te la mande.
2. En `js/cierre.js` pon `activo: true`. Elige también:
   - `borrarDatos: false` → los datos se quedan en el móvil y la app solo deja hacer la copia de seguridad para mandártela;
   - `borrarDatos: true` → al abrirla, la app **borra** del móvil los clientes, las llamadas, los pedidos y los ajustes, y deja de funcionar sin conexión.

   Puedes cambiar también el texto de `mensaje`.
3. En `sw.js` pon `const CIERRE_ACTIVO = true;`.
4. Sube la versión en los dos sitios (apartado 7) y publícala.
5. Cada comercial verá **«Esta app ya no está en uso»** la próxima vez que la abra **con conexión**. La versión de cierre entra sola, sin pulsar «Actualizar».
6. Cuando ya la hayan abierto todos, despublica la web: en GitHub, **Settings → Pages → Unpublish site**. Si quieres, borra también el repositorio.

Si cambias de idea: vuelve a poner `activo: false` y `CIERRE_ACTIVO = false`, sube la versión y publícala. Si los datos no se borraron, todo vuelve a estar como antes.

Por ahora el cierre es **para todos a la vez**. Cerrarla solo para un comercial necesita la fase 7 (la nube).

---

## 9. Conectarla a la nube en el futuro (no está hecho)

La app ya está preparada para la nube:

- todo pasa por un solo módulo, `js/datos.js`;
- cada registro tiene un identificador único (`id`), las fechas `creado` y `modificado`, y el `dispositivoId` del móvil que lo cambió;
- nada se borra de verdad: se marca como `borrado`;
- cada cambio queda apuntado en la tabla `cambios`;
- la copia de seguridad usa el mismo formato que usaría una sincronización.

Cuando llegue el momento, en un servicio como **Supabase** o **Firebase** se crearían las mismas tablas (clientes, llamadas, recordatorios, promociones y ajustes) con los mismos campos. Después se añadiría a `js/datos.js` una función `sincronizar()` que, al haber conexión:
1. envía los registros cuyo `modificado` sea posterior a la última sincronización;
2. descarga los que hayan cambiado otros móviles u otros usuarios;
3. ante un mismo registro, se queda con el `modificado` más reciente.

Las pantallas no tendrían que cambiar. Con eso vendrían las cuentas de usuario y un panel para la oficina.

---

## Posibles mejoras (fuera de esta versión)

- Sincronización real con la nube, cuentas de usuario y panel para la oficina.
- Varios comerciales: los Excel semanales ya llevan el nombre del comercial y el mismo formato, para poder juntarlos.
- WhatsApp automático cuando el cliente no contesta (necesitaría la API de WhatsApp Business y un servidor).
- Ordenar los clientes a mano para seguir el orden de la ruta.
- Convertirla en un archivo APK (por ejemplo, con Capacitor).
- Notificaciones push.

---

## Estructura de archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `css/estilos.css` | La página y los estilos |
| `js/app.js` | Arranque, pestañas y aviso de versión nueva |
| `js/pantallas/` | Una pantalla por archivo: `hoy`, `semana`, `clientes`, `ficha`, `mas`, `oficina` (resumen, ICG, promociones y Excel de la oficina) y `cierre` (pantalla de la versión de cierre) |
| `js/acciones.js` | Llamar, WhatsApp, panel del resultado, más tarde, vacaciones, baja… |
| `js/logica.js` | Funciones puras: fechas, lista del día, orden, textos y mensajes |
| `js/informes.js` | Funciones puras: resumen semanal, Excel de la semana, cambios ICG e historial |
| `js/datos.js` | **El único** que habla con la base de datos del móvil |
| `js/migraciones.js` | Versión de los datos, migraciones y formato de la copia |
| `js/importar.js`, `js/exportar.js` | Excel de entrada y de salida, y copia de seguridad |
| `js/cierre.js` | Interruptor de la versión de cierre (apagado) |
| `js/reloj.js` | Fecha y hora, con el modo prueba |
| `js/ui.js` | Piezas de interfaz: paneles, avisos, botones… |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación y funcionamiento sin conexión |
| `lib/xlsx.full.min.js` | SheetJS 0.20.3, para leer y escribir Excel (descargado una vez) |
| `tests/` | Pruebas automáticas (`node --test`) |
| `datos-privados/` | Tus Excel. **No se sube nunca** |

**Peticiones a internet:** ninguna mientras se usa la app. Las únicas salidas son los enlaces que abre el propio comercial: `tel:` para llamar, `https://wa.me/…` para WhatsApp y `mailto:` para mandar el resumen por correo.
