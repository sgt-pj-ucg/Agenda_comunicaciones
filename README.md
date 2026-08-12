# Agenda Comunicaciones 1.0.9 — versión auditada

Esta versión mantiene la Agenda Comunicaciones existente y agrega dos funciones opcionales:

1. **Crear por voz**, como una alternativa adicional al ingreso manual.
2. **Recordatorio local 15 minutos antes**, activable mediante la campana del encabezado.

## Importante: no se reemplaza lo que ya funciona

El flujo manual continúa intacto:

- `+` → `Nueva actividad`
- edición
- eliminación
- cambio de estado
- calendario
- búsqueda
- dictado del campo DETALLE
- feriados
- tema claro/oscuro

La creación completa por voz aparece como una tercera alternativa dentro del botón `+`.

El micrófono de búsqueda sigue dedicado a consultas y navegación; no se reutiliza para crear actividades. Esto evita que una consulta como `Agenda del viernes` se confunda con una orden de creación.

## Crear por voz

Ruta:

`+` → `Crear por voz`

En este modo no es obligatorio comenzar diciendo “Agenda…”. Puede dictarse de forma natural, por ejemplo:

`Reunión con el pleno para el 15 de agosto de 2026 a la una y media de la tarde en sala número 1, participarán todos los ministros.`

La app intenta interpretar:

- FECHA
- HORA
- TIPO
- DETALLE
- LUGAR
- ESTADO

La planilla de Comunicaciones no tiene columna PARTICIPANTES. Cuando se detecta una expresión explícita como `participarán`, `a cargo de` o `responsable`, esa información se conserva dentro de DETALLE.

### Seguridad

La voz **nunca guarda automáticamente**.

Después del reconocimiento:

1. abre el mismo formulario utilizado por el ingreso manual;
2. completa solo los campos reconocidos;
3. muestra el texto que fue escuchado;
4. permite modificar cualquier campo;
5. exige pulsar `Guardar actividad`.

Si no se reconoce una fecha, el campo FECHA queda vacío. No se inventa “hoy” ni otra fecha y el formulario no permite guardar hasta corregirla.

Por defecto, las actividades creadas por voz quedan `Por Confirmar`, salvo que el dictado diga expresamente otro estado.

## Lenguaje flexible probado

El intérprete acepta, entre otros:

- hoy, mañana, pasado mañana;
- lunes, viernes, próximo lunes, este viernes;
- `15/08/2026`, `15-08-2026`, `2026-11-05`;
- `15 de agosto de 2026`;
- `quince de agosto de dos mil veintiséis`;
- `primero de septiembre`;
- `13:30`, `13.30`, `14 20`;
- `13 horas con 30 minutos`;
- `trece treinta`;
- `una y media de la tarde`;
- `cuatro y cuarto de la tarde`;
- `1:30 de la tarde`;
- `4:05 p m`;
- `sin hora`;
- sala, oficina, tribunal, radio, auditorio, Zoom, Teams, Meet;
- Confirmada, Por Confirmar, Pendiente, Cancelada, Boletín y Redes Sociales;
- Actividad, Jurisdiccional, Audiovisual, Turno, Efeméride y Ausencias.

También hay inferencias conservadoras:

- `grabación`, `video`, `reel`, `short` → Audiovisual;
- `sentencia`, `audiencia`, `alegatos` → Jurisdiccional.

Estas inferencias solo completan TIPO. El texto original se conserva en DETALLE para que la usuaria pueda revisarlo.

## Recordatorio 15 minutos antes

La campana del encabezado está desactivada por defecto.

Al activarla:

- solicita permiso de notificaciones;
- envía una notificación de prueba;
- programa un aviso 15 minutos antes de actividades que tengan hora;
- ignora actividades Canceladas;
- ignora actividades sin hora;
- evita repetir el mismo aviso en el dispositivo.

Esta primera versión utiliza recordatorios locales de la PWA. Es apropiada para probar la experiencia, pero **no garantiza** el aviso si el sistema operativo ha cerrado completamente la PWA. Para esa garantía se requiere una segunda fase con Web Push/FCM.

## Backend

`Code.gs` es exactamente el backend 1.0.7 de edición robusta. No se modificó para agregar la voz ni los recordatorios.

Por lo tanto, si Apps Script 1.0.7 ya está desplegado, para pasar de 1.0.7 a 1.0.9 basta actualizar los archivos web de GitHub.

## Validación

La auditoría completa se encuentra en `AUDITORIA_1.0.9.md`.
