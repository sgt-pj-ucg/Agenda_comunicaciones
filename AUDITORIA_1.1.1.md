# Auditoría Agenda Comunicaciones 1.1.1 — Pulsar para hablar

## Motivo del cambio
La versión anterior trataba el dictado como una sesión que comenzaba al abrirse. Esta versión convierte el micrófono central en un control explícito de pulsar-para-hablar.

## Regla de interacción
- `pointerdown` / mantener presionado: inicia escucha prolongada;
- `pointerup` / soltar: termina, espera hasta 560 ms por el último resultado del navegador y recién después interpreta;
- `pointercancel`: cancela el intento, no crea nada;
- teclado Espacio/Enter: equivalente para accesibilidad/PC;
- Manos libres: alternativa opcional, no es el flujo principal.

## Motor de reconocimiento
- máximo de seguridad: 120 segundos;
- transcripción final y provisional;
- reconexión automática cuando el navegador finaliza una instancia durante una pausa;
- espera de cierre para no perder la última frase al soltar;
- cancelación elimina temporizadores pendientes.

## Matriz de lenguaje
Se validaron 51 formas de crear una actividad y 9 consultas que no deben interpretarse como creación.

## Regresión
Archivos deliberadamente intactos: `Code.gs`, `config.js`, `manifest.webmanifest`, `icons/apple-touch-icon.png`, `icons/comunicaciones-symbol.png`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/prensa-symbol.png`.

Marcadores funcionales conservados: creación manual, edición, eliminación, estado, calendario, búsqueda, tema, feriados y recordatorios.

## Pruebas técnicas
- sesión larga: {'instances': 2, 'done': 'Reunión con el pleno el quince de agosto Sala número uno', 'states': ['starting', 'listening', 'processing', 'idle'], 'ghost': False}
- pulsar/soltar: {'press': 3, 'release': 2, 'cancel': 1}
- IDs HTML duplicados: ninguno.
- Voice Studio ubicado en ámbito global correcto: verificado.
