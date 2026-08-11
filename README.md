# Agenda Comunicaciones 1.0.3 — identidad visual

Esta versión mantiene la misma planilla, Apps Script y funcionamiento de Agenda Comunicaciones.

## Cambios visuales

- Nuevo logo e ícono PWA para Android/iPhone.
- Nombre visible: `Agenda Comunicaciones`.
- Encabezado: `Equipo Comunicaciones`.
- Iconografía SVG propia para cada tipo, consistente entre Android, iPhone y notebook.
- Colores con mayor separación visual:
  - Actividad: verde esmeralda
  - Jurisdiccional: azul intenso
  - Audiovisual: violeta
  - Turno: ámbar
  - Efeméride: coral
  - Ausencias: gris azulado

## Integrantes

La aplicación interpreta los códigos de la planilla solo para visualización:

- `MM` → `Margarett Molina`
- `PH` → `Paxelia Huerta`

La planilla original no se modifica. Si una celda contiene `MM-PH`, la interfaz mostrará ambos nombres completos.

La búsqueda también reconoce `Margarett Molina` y `Paxelia Huerta`.

## Publicación

Sube a GitHub el contenido de este paquete reemplazando los archivos anteriores.

`Code.gs` no necesita volver a desplegarse por estos cambios visuales; se incluye solo como respaldo y con la identidad textual actualizada.

Al publicar, cierra completamente la PWA instalada y vuelve a abrirla. Debido al cambio de ícono, en algunos teléfonos puede ser necesario eliminar el acceso instalado y volver a instalarlo para ver inmediatamente el nuevo logo.
