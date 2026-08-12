# Agenda Comunicaciones 1.1.1 — Pulsar para hablar

## Experiencia principal
`+ → Crear por voz` abre un estudio dedicado. La forma principal de dictar es:

1. mantener pulsado el micrófono central;
2. hablar con naturalidad, haciendo pausas si es necesario;
3. soltar cuando termine;
4. la app interpreta el dictado y abre el formulario habitual para revisar;
5. nada se guarda hasta pulsar `Guardar actividad`.

Mientras se mantiene pulsado, el botón cambia a `SUELTE PARA TERMINAR`, aparecen anillos/onda activos, cronómetro, transcripción en vivo y campos detectados.

Existe un modo alternativo `Manos libres` para PC/accesibilidad.

## Seguridad y compatibilidad
La creación manual sigue intacta y es independiente del flujo de voz. Buscar por voz y dictar solo el campo Detalle siguen usando el controlador corto anterior.

`Code.gs`, `config.js`, `manifest.webmanifest` e íconos no fueron modificados. El backend continúa siendo 1.0.7.

Los recordatorios de 15 minutos se mantienen sin cambios.

## Pruebas
- 51 frases de creación por voz;
- 9 consultas verificadas para no crear actividades por error;
- motor largo probado con resultado final que llega después de soltar;
- pulsar/soltar probado con puntero y teclado;
- cancelación durante procesamiento no dispara creación;
- sintaxis correcta en app.js, voice-create.js, voice-session.js, voice-press.js y Code.gs.
