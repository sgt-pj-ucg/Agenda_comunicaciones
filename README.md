# Agenda Comunicaciones 1.0.4 — legibilidad y tarjetas premium

## Cambios

### Saludo superior
El saludo ya no se trunca en móvil.

Ejemplo:

`Buenas noches, Equipo Comunicaciones.`

Puede ocupar dos líneas cuando el ancho del teléfono lo exige.

### Tipos
Se aumentó la legibilidad de:

- Actividad
- Jurisdiccional
- Audiovisual
- Turno
- Efeméride
- Ausencias

La barra superior de cada tarjeta ahora tiene tipografía más grande, ícono mayor y un fondo tintado con el color del tipo.

### Tarjetas
Las tarjetas tienen:

- borde completo teñido por tipo;
- franja lateral de 5 px;
- sombra suave de dos niveles;
- ligero brillo interior;
- separación vertical mayor;
- interacción de presión/hover discreta.

Las actividades finalizadas siguen viéndose como pasadas, pero ya no quedan excesivamente deslavadas.

### Hora y metadatos
La hora, los badges y el estado aumentaron de tamaño y contraste.

### Logo
El encabezado utiliza directamente `icon-192.png`, el mismo recurso del PWA, para evitar que el símbolo aparezca vacío por problemas de caché o carga de un archivo secundario.

## Publicación
Reemplaza en GitHub los archivos de este paquete.

No es necesario volver a desplegar `Code.gs`; esta versión es exclusivamente visual.

Después de que GitHub Pages termine de publicar, cierra completamente la aplicación instalada y vuelve a abrirla. Si el ícono o estilos permanecen antiguos, elimina la PWA y vuelve a instalarla.
