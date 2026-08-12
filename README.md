# Agenda Comunicaciones 1.0.7 — edición robusta

## Problema verificado

Agenda Comunicaciones tenía el mismo defecto lógico detectado en Agenda Presidenta.

El backend utilizaba:

`horaOriginal || horaNueva`

Cuando la hora original estaba vacía, reemplazaba ese valor por la hora nueva
antes de localizar la fila.

Ejemplo real de la planilla:

- fila 4
- 03/08/2026
- Audiovisual
- Short sin cuña visita a radio
- hora original: vacía

Si se intentaba agregarle una hora, el backend podía buscar esa actividad por la
hora nueva y no encontrarla.

## Corrección

Ahora los valores originales vacíos se preservan expresamente.

La identificación de filas usa:

1. número de fila real;
2. fecha + hora original + detalle;
3. si no existe coincidencia exacta, fecha + detalle únicamente cuando hay una
   sola fila posible.

Si existen varias coincidencias, no modifica ninguna.

## Sincronización

Agenda Comunicaciones ya utilizaba Apps Script para leer y escribir, por lo que
no requería la migración estructural realizada en Agenda Presidenta.

Se reforzó:

- `listar` con esquema `comunicaciones-live-v1`;
- versión de backend `1.0.7`;
- fila real tras editar;
- fila real tras cambiar estado.

La interfaz detecta si se publica por error un Code.gs antiguo.

## Prueba de regresión

Se reprodujo el caso de una actividad Audiovisual en fila 4 con hora original
vacía y edición hacia una nueva hora.

Resultado:

`OK fila=4`

## Instalación

Esta versión requiere actualizar ambos lados.

1. Primero reemplazar Code.gs en Apps Script y actualizar la implementación
   existente.
2. Después subir los archivos web 1.0.7 a GitHub.

La URL /exec no cambia.
