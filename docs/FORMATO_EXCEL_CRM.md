# Formato del «Excel para el CRM» · versión 1

Este es el acuerdo entre la app de llamadas (la de los comerciales) y el CRM de la oficina. El código que genera el Excel está en `js/crm.js`, y los tests están en `tests/crm.test.js`.

- **Quién lo genera:** el comercial, desde la app, en **Más → Para la oficina → «Exportar para el CRM»**.
- **Nombre del archivo:** `crm_<comercial>_<AAAA-MM-DD>.xlsx`; por ejemplo, `crm_juan-bonilla_2026-11-19.xlsx`.
- **Qué lleva:** **todo** el historial, no solo la semana. Así, si un comercial se salta una semana, no se pierde nada. Reimportar el mismo archivo o uno más nuevo **no duplica nada**, porque cada fila trae su id.
- **Si cambia el formato:** el formato no cambia sin subir `FORMATO_CRM` en `js/crm.js` (hoja Info → «CRM VinOliva vN») y sin actualizar este documento. Las columnas nuevas se añadirán **siempre al final** de su hoja.

## Reglas generales

- **Fechas:** `AAAA-MM-DD`. Las horas van en `HH:MM`.
- **Marcas de tiempo («Creado», «Modificado», «Exportado»):** ISO con zona horaria, por ejemplo `2026-11-19T18:00:00.000+01:00`.
- **Sí/No:** se escribe literalmente `Sí` o `No`.
- **Ids:** son textos únicos y estables que genera la app y que no cambian nunca. Sirven para actualizar sin duplicar; por ejemplo, se pueden guardar en `idArtefacto`.
  - «Id cliente» es único dentro del móvil de un comercial.
  - Para estar seguros entre comerciales, usad la clave `Id del móvil` + `Id cliente`.
- **Celdas vacías:** una celda vacía significa «la app no tiene ese dato». **No** debe borrar lo que ya tenga el CRM.
- **Borrados:** la app nunca borra de verdad. Lo borrado sale marcado: «Borrado en la app» en Clientes y «Anulada» en Llamadas.

## Hoja «Info» (Dato | Valor)

| Dato | Ejemplo | Para qué |
|---|---|---|
| Formato | `CRM VinOliva v1` | Comprobar que el CRM entiende el archivo |
| Comercial | `Juan Bonilla` | El nombre que el comercial puso en Ajustes |
| Id del móvil | `c7c7e29d-…` | Identifica el móvil o la instalación; es estable |
| Exportado | `2026-11-19T18:00:00.000+01:00` | Cuándo se generó |
| Versión de la app | `1.6.0` | |
| Clientes | `302` | Clientes no borrados |
| Llamadas | `57` | Llamadas no anuladas |

## Hoja «Clientes» (una fila por cliente, incluidos los borrados)

| # | Columna | Valores |
|---|---|---|
| 1 | Id cliente | id interno de la app (estable) |
| 2 | Comercial | igual que en Info |
| 3 | Código ICG | `C023`… Puede estar vacío en clientes nuevos o potenciales |
| 4 | Nombre comercial | |
| 5 | Nombre fiscal | |
| 6 | Población | |
| 7 | Dirección | |
| 8 | Zona / ruta | |
| 9 | Contacto | persona de contacto |
| 10 | Teléfono | el principal para llamar (9 cifras, sin espacios) |
| 11 | Otros teléfonos | separados por `, ` |
| 12 | Teléfonos con nombre | `Jefe: 600 111 222 (solo llamar); Pedidos: 611 222 333 (solo WhatsApp)` |
| 13 | Email | en minúsculas |
| 14 | Días de llamada | `LUNES, JUEVES` |
| 15 | Día que cierra | texto libre |
| 16 | Hora de apertura | `HH:MM` |
| 17 | Llamar a partir de | `HH:MM` |
| 18 | Forma de pago | texto libre |
| 19 | Estado | lista cerrada: `activo`, `vacaciones`, `baja`, `potencial` (estado del día de la exportación) |
| 20 | Vacaciones desde | fecha |
| 21 | Vacaciones hasta | fecha |
| 22 | Fecha de baja | fecha |
| 23 | Motivo de baja | |
| 24 | Importante | `Sí` / `No` |
| 25 | Pide habitualmente | texto libre |
| 26 | Otras condiciones | texto libre |
| 27 | Condiciones especiales | `Xoringer −10 % hasta 31/12 · …` (texto, separado por ` · `) |
| 28 | Cobro pendiente (€) | número |
| 29 | Nota del cobro | |
| 30 | Notas | |
| 31 | Falta por configurar | `teléfono, día de llamada, …` |
| 32 | Creado | marca de tiempo |
| 33 | Modificado | marca de tiempo (sirve para saber si ha cambiado desde la última importación) |
| 34 | Borrado en la app | `Sí` / `No` |

## Hoja «Llamadas» (una fila por llamada)

Una «llamada» es todo lo que pasó con un cliente un día concreto:
- puede tener varios intentos; por ejemplo, no contesta a las 10:00 y pide a las 12:00;
- la fila lleva el resultado final;
- también son llamadas los pedidos que llegan sin llamar, cuando el cliente llama, por WhatsApp o en una visita.

| # | Columna | Valores |
|---|---|---|
| 1 | Id llamada | id interno (estable) |
| 2 | Id cliente | enlaza con la hoja Clientes |
| 3 | Comercial | |
| 4 | Código ICG | del cliente |
| 5 | Cliente | nombre comercial |
| 6 | Población | |
| 7 | Fecha | día del último intento |
| 8 | Fecha prevista | día que tocaba llamar |
| 9 | Hora | hora del último intento |
| 10 | Resultado | lista cerrada: `pide`, `no_pide`, `no_contesta`, `mas_tarde`, `whatsapp` (vacío si está anulada) |
| 11 | Resultado (texto) | `Pide`, `No pide`, `No contesta`, `Más tarde`, `WhatsApp` |
| 12 | Hubo pedido | `Sí` / `No` |
| 13 | Pedido | texto libre del pedido |
| 14 | Cómo | lista cerrada: `llamada`, `cliente_llama`, `whatsapp`, `visita` |
| 15 | Nota | |
| 16 | Nº intentos | número |
| 17 | Intentos | `10:00 No contesta + WhatsApp · 12:00 Pide` |
| 18 | WhatsApp enviado | `Sí` / `No` |
| 19 | Pendiente de volver a llamar | `Sí` si es lo último que pasó con ese cliente y quedó en `no_contesta` o `mas_tarde` |
| 20 | Volver a llamar a las | `HH:MM` (para `mas_tarde`) |
| 21 | Enviado a la oficina | `Sí` / `No` (solo si hubo pedido) |
| 22 | Hora de envío a la oficina | marca |
| 23 | Modificado | marca de tiempo |
| 24 | Anulada | `Sí` si el comercial la deshizo o la borró. Si el CRM la tenía, debe marcarla como anulada, sin borrarla |

## Sugerencias para el importador del CRM

- **Primero, la hoja Clientes; después, Llamadas.**
- **Cómo se reconoce a un cliente:** por `Id del móvil` + `Id cliente` si ya se importó antes. Si no, por `Código ICG`. Si tampoco, por nombre y población, y eso se le enseña a Iván como «parecido» para que él confirme.
- **Datos que no coinciden con la ficha del CRM:** salen como cambio propuesto, con su origen (comercial y fecha de «Exportado»). Nunca se sobrescriben a ciegas.
- **Cambios de «Pendiente de volver a llamar»:** una misma llamada puede pasar de `Sí` a `No` en un Excel posterior. Se actualiza por `Id llamada`.
