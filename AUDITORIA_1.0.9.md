# Auditoría Agenda Comunicaciones 1.0.9

## Objetivo

Agregar creación completa por voz y un recordatorio local 15 minutos antes sin alterar las funciones existentes de Agenda Comunicaciones.

## Regresión del backend

Se verificó que:

- `Code.gs` de 1.0.9 es idéntico byte a byte al `Code.gs` 1.0.7.
- `config.js` es idéntico al 1.0.7.
- `manifest.webmanifest` es idéntico al 1.0.7.
- se repitió la prueba del caso de edición con HORA original vacía;
- resultado: la fila correcta se resolvió y la hora original vacía se preservó.

## Pruebas del intérprete de voz

Se ejecutaron **48 frases positivas** con diferentes maneras de expresar:

- fecha;
- hora;
- lugar;
- tipo;
- estado;
- participantes/responsables;
- frases completas y fragmentos naturales.

Además se probaron **9 consultas que no deben considerarse órdenes de creación**, entre ellas:

- `Agenda de mañana`
- `Agenda del viernes`
- `Muéstrame la agenda del viernes`
- `Qué tengo mañana`
- `Busca actividades audiovisuales`
- `Cuál es mi próxima actividad`
- `Abre el calendario del 15 de agosto`

Resultado: las 48 frases de creación fueron interpretadas según los campos esperados y las 9 consultas no fueron clasificadas como creación.

También se probaron dos protecciones:

- si falta FECHA, el resultado la deja vacía;
- si se menciona una hora que no puede interpretarse, se muestra una advertencia.

## Pruebas funcionales de la interfaz

Se ejecutaron pruebas automáticas en un navegador Chromium con datos de demostración.

Se confirmó:

- carga inicial sin errores JavaScript;
- botón `+` operativo;
- `Nueva actividad` operativo;
- `Crear por voz` presente como alternativa separada;
- `Feriado` operativo;
- formulario manual conserva `Confirmada` como estado por defecto;
- creación por voz abre el mismo formulario, no guarda automáticamente;
- cancelar una creación por voz no altera la agenda;
- búsqueda por voz no abre el formulario de creación;
- cambio de tema operativo;
- Agenda / Calendario / Buscar operativos;
- creación manual sigue agregando eventos;
- edición sigue actualizando eventos;
- cambio de estado sigue funcionando;
- eliminación sigue funcionando.

## Pruebas de recordatorio

Se verificó:

- la campana queda apagada por defecto;
- con recordatorios desactivados no se crean temporizadores;
- una actividad futura con hora se programa;
- una actividad Cancelada no se programa;
- una actividad sin hora no se programa;
- una actividad dentro de la ventana de aviso genera una notificación;
- una segunda revisión no duplica el mismo aviso.

## PWA

Se comprobó:

- sintaxis correcta de `app.js`;
- sintaxis correcta de `voice-create.js`;
- sintaxis correcta de `Code.gs` como JavaScript;
- `manifest.webmanifest` es JSON válido;
- todos los archivos declarados en el shell del Service Worker existen;
- cache actualizado a `agenda-comunicaciones-shell-109`;
- referencias web actualizadas a `?v=109`.

## Diseño / compatibilidad

Se probó la interfaz en dimensiones móviles y de escritorio.

La nueva ficha de interpretación por voz se contiene correctamente dentro del formulario. El formulario móvil mantiene el mismo comportamiento de desplazamiento horizontal de los accesos rápidos de hora que ya existía en 1.0.7; no fue modificado para evitar alterar una interacción que ya estaba funcionando.

## Alcance conocido del recordatorio

El aviso de 15 minutos de esta versión es local. Los navegadores móviles pueden suspender JavaScript cuando una PWA permanece mucho tiempo en segundo plano o es cerrada por el sistema.

Por ello esta función debe considerarse **de prueba**. Para avisos garantizados con la PWA cerrada se recomienda implementar Web Push en una fase posterior.
