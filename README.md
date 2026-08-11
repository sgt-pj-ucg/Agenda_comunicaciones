# Agenda Comunicaciones 1.0.5 — corrección y revisión del resumen

## Corrección principal

La aplicación tenía el mismo patrón que Agenda Presidenta: una próxima actividad
con estado `Pendiente` o `Por Confirmar` podía generar además un chip separado de
`tarea(s) por revisar`.

En teléfonos angostos ese segundo chip podía quedar parcialmente visible a la
derecha.

Ahora:

- el estado de la próxima actividad se integra dentro de la propia ficha;
- esa misma actividad no se vuelve a contar como aviso adicional;
- si existen otras pendientes, se informa solo la cantidad adicional;
- la ficha Próxima actividad ocupa todo el ancho en móvil;
- los demás avisos bajan de línea y nunca quedan cortados horizontalmente.

## Otros errores corregidos durante la revisión

### MM / PH en resumen superior
La próxima actividad ahora expande también:

- `MM` → `Margarett Molina`
- `PH` → `Paxelia Huerta`

Esto ya ocurría en las tarjetas, pero no en el resumen ejecutivo.

### Boletín
Se corrigió el plural incorrecto:

- antes podía mostrarse `2 boletínes`
- ahora muestra `2 boletines`

### Estados editoriales
Si la próxima actividad tiene estado:

- Boletín
- Redes Sociales
- Por Confirmar
- Pendiente

el estado aparece de forma compacta dentro de la ficha de Próxima actividad,
sin crear una tarjeta redundante.

### Ausencias
Una jornada compuesta completamente por Ausencias no genera un segundo chip
redundante de ausencia. Si la ausencia convive con otros tipos, sí se informa.

## Sin cambios de backend

No se modificaron:

- planilla Google Sheets
- Code.gs
- URL de Apps Script
- creación, edición o eliminación
- voz
- calendario
- feriados

Solo deben actualizarse los archivos web en GitHub.
