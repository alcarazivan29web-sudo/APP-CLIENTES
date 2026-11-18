# Llamadas VinOliva

App para el móvil Android del comercial. Al abrirla ve **a quién tiene que llamar hoy**. Llama con un toque, apunta cómo ha ido y, si hay pedido, lo manda a la oficina por WhatsApp.

- Es una **app web instalable** (PWA): se instala desde Chrome y funciona **sin conexión**.
- Los datos se guardan **solo en el móvil**. No hay servidor ni nube.
- **Los datos de clientes nunca están en el código ni se suben a GitHub.** Se cargan en el móvil con el botón «Importar».

**Estado:** fase 1 (Llamadas) terminada. Las fases 2 (Seguimiento) y 3 (Oficina) van después.

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

## 4. Importar los clientes (y, en la fase 3, las promociones) desde el móvil

1. Desde tu ordenador, mándale el Excel (`Clientes_Bonilla_para_app.xlsx`) por **WhatsApp** o por **correo**.
2. En su móvil, que **abra o descargue** el archivo desde WhatsApp. Así queda guardado en el móvil, normalmente en la carpeta *Descargas* o *Documentos → WhatsApp*.
3. En la app: **Más → Importar clientes (Excel o CSV)** y que elija el archivo.
4. Verá un resumen antes de guardar: cuántos clientes hay, cuántos sin teléfono, cuántos sin día y cuántos «posible duplicado». Pulsa **Importar**.

**Si se importa otra vez** (por ejemplo, con el Excel actualizado):
- los clientes se emparejan por su **ID** (C001, C002…);
- se actualizan los datos que vienen en el Excel, pero **una celda vacía no borra** lo que el comercial haya puesto en la app (por ejemplo, los días asignados);
- se conservan el estado, el historial, las vacaciones y los cambios hechos en la app;
- los clientes que no estén en el archivo **no se borran**.

**Reglas al importar:**
- Si «Día que cierra» o «Forma de pago» dice exactamente `CERRADO`, el cliente entra como **baja** con el motivo «Cerrado (según Excel)».
- Las columnas que la app no conoce se ignoran.

**Antes de importar:** corrige en el Excel la fila **C001** («JOSE PARSIFAL»), que tiene 11 teléfonos y un teléfono en «Población», y la **C004**, que tiene un email en «Población».

---

## 5. Configurar los números de la oficina y el tuyo

En la app: **Más → Ajustes**.

- **Tu nombre:** el del comercial, por ejemplo «Juan Bonilla». Sale al final de cada pedido.
- **WhatsApp de la oficina:** el número al que llegan los pedidos. Si se deja vacío, al enviar un pedido se abre el menú de compartir para elegir a quién.
- **WhatsApp o correo de Iván:** para el resumen semanal (fase 3).
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
   - `js/version.js` → `export const VERSION = '1.0.1';`
   - `sw.js` → `const VERSION = '1.0.1';`
3. Si has añadido un archivo nuevo de la app, añádelo también a la lista `ARCHIVOS` de `sw.js`.
4. Pasa los tests: `node --test`.
5. En GitHub Desktop: comprueba que en **Changes** no hay datos de clientes, escribe un resumen, pulsa **Commit to main** y luego **Push origin**.
6. En uno o dos minutos, cuando el comercial abra la app con conexión, verá arriba **«Hay una versión nueva · Actualizar»**. Al pulsarlo, la app se recarga y, si hace falta, **migra los datos** a la versión nueva. Antes de migrar guarda una copia interna, por si acaso.

---

## 8. Conectarla a la nube en el futuro (no está hecho)

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
- Varios comerciales.
- Ordenar los clientes a mano para seguir el orden de la ruta.
- Convertirla en un archivo APK (por ejemplo, con Capacitor).
- Notificaciones push.

---

## Estructura de archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `css/estilos.css` | La página y los estilos |
| `js/app.js` | Arranque, pestañas y aviso de versión nueva |
| `js/pantallas/` | Una pantalla por archivo: `hoy`, `semana`, `clientes`, `ficha` y `mas` |
| `js/acciones.js` | Llamar, WhatsApp, panel del resultado, más tarde, vacaciones, baja… |
| `js/logica.js` | Funciones puras: fechas, lista del día, orden, textos y mensajes |
| `js/datos.js` | **El único** que habla con la base de datos del móvil |
| `js/migraciones.js` | Versión de los datos, migraciones y formato de la copia |
| `js/importar.js`, `js/exportar.js` | Excel de entrada y de salida, y copia de seguridad |
| `js/reloj.js` | Fecha y hora, con el modo prueba |
| `js/ui.js` | Piezas de interfaz: paneles, avisos, botones… |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación y funcionamiento sin conexión |
| `lib/xlsx.full.min.js` | SheetJS 0.20.3, para leer y escribir Excel (descargado una vez) |
| `tests/` | Pruebas automáticas (`node --test`) |
| `datos-privados/` | Tus Excel. **No se sube nunca** |

**Peticiones a internet:** ninguna mientras se usa la app. Las únicas salidas son los enlaces que abre el propio comercial: `tel:` para llamar y `https://wa.me/…` para WhatsApp.
