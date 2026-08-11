# Agenda Comunicaciones 1.0.6 — seguridad de escritura en Google Sheets

## Auditoría realizada

Se revisó el backend de Agenda Comunicaciones buscando el mismo tipo de error
reportado en Agenda Presidenta.

### Problema 1 — setNumberFormat

Se encontraron 7 operaciones:

`setNumberFormat('dd/MM/yyyy')`

Estas podían producir el mensaje:

`No puedes configurar el formato de número de las celdas de una columna con texto.`

Se eliminaron las 7.

La corrección cubre:

- crear actividad;
- editar actividad;
- crear feriado;
- editar feriado;
- importar/actualizar feriados oficiales;
- crear nuevas filas de feriados oficiales;
- creación inicial de `FERIADOS_CHILE`.

### Problema 2 — copiar formato de la fila anterior

Al crear una actividad se ejecutaba:

`copyPreviousRowFormat_`

Esa operación no es necesaria para la aplicación y puede entrar en conflicto
con una tabla de Google Sheets que tenga columnas tipadas.

Se eliminó también esa copia de formato.

## Resultado

El backend ahora:

- escribe únicamente los valores;
- normaliza FECHA como `dd/MM/yyyy`;
- normaliza HORA como `HH:mm`;
- respeta los tipos/formato que ya tenga configurada la planilla;
- no modifica el formato de ninguna columna de la agenda;
- mantiene la búsqueda robusta de filas para editar/eliminar.

Se realizó además una auditoría automática y el `Code.gs` final no contiene
ninguna llamada a:

- `setNumberFormat`
- `setNumberFormats`
- `copyFormatToRange`

## Qué no cambia

No se modificaron:

- diseño de la aplicación;
- GitHub Pages;
- URL de Apps Script;
- planilla;
- lógica de MM / PH;
- voz;
- calendario;
- feriados;
- creación, edición y eliminación desde la interfaz.

## Instalación

Esta actualización es exclusivamente de backend:

1. abra Apps Script de Agenda Comunicaciones;
2. reemplace el contenido por el nuevo `Code.gs`;
3. actualice la implementación existente;
4. conserve la misma URL `/exec`.

No es necesario subir nuevos archivos a GitHub para esta corrección.
