# Agenda Comunicaciones 1.1.2 — Voz asistida limpia

Corrección focalizada del módulo “Crear por voz”. El formulario manual, backend, edición, estados, calendario, feriados y recordatorios se mantienen.

## Cambios
- Nueva barra moderna “mantener pulsado para hablar”.
- Transcripción reconstruida por hipótesis en vez de concatenar parciales.
- Reconciliación anti-eco entre reinicios del reconocimiento de Android/Chrome.
- Actividad, lugar y participantes se identifican y muestran separados.
- Soporte de lugares como “primera sala de la Corte”, “la segunda sala”, “sala número 1”, Zoom, etc.
- Participantes tienen un campo de revisión propio en el flujo de voz; al guardar se conservan dentro de DETALLE porque la planilla institucional no tiene columna PARTICIPANTES.
- La transcripción visual tiene altura limitada para que nunca vuelva a deformar la tarjeta/calendario.

No requiere cambios en Code.gs si ya está instalado el backend 1.0.7.
