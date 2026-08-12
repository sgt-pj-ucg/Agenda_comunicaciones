# Auditoría técnica — Agenda Comunicaciones 1.1.2

## Objetivo

Corregir exclusivamente el módulo **Crear por voz** después del caso observado en Android donde una sola frase terminó repetida muchas veces dentro de DETALLE y no se separaron correctamente LUGAR y PARTICIPANTES.

No se cambió el backend ni se reemplazó el ingreso manual.

## Causa encontrada

La sesión de voz anterior anexaba hipótesis parciales del reconocimiento. En Android/Chrome, una misma frase puede llegar varias veces como hipótesis progresivamente más largas, por ejemplo:

1. `agendar reunión`
2. `agendar reunión de pleno`
3. `agendar reunión de pleno para el día 15`
4. `agendar reunión de pleno para el día 15 de diciembre...`

Al anexarlas, el resultado podía transformarse en el texto repetitivo mostrado en la captura.

## Corrección anti-eco

`voice-session.js` 1.1.2 ya no concatena resultados parciales. Reconstruye la hipótesis vigente de cada sesión y la reconcilia con la anterior mediante solapamiento de palabras.

También se simuló el cierre/reinicio del reconocedor después de una pausa, comportamiento habitual en navegadores móviles.

### Prueba específica anti-eco

Entrada simulada en varios bloques acumulativos:

`agendar reunión de pleno para el día 15 de diciembre del 2026 a las 15 horas en primera sala de la corte participarán todos los ministros`

Resultado final:

`agendar reunión de pleno para el día 15 de diciembre del 2026 a las 15 horas en primera sala de la corte participarán todos los ministros`

La secuencia `agendar reunión` aparece **una sola vez**.

Resultado: **PASS**.

## Prueba exacta del caso reportado

Dictado:

`Agendar reunión de pleno para el día 15 de diciembre del 2026 a las 15 horas en primera sala de la corte participarán todos los ministros`

Interpretación obtenida:

- FECHA: `15/12/2026`
- HORA: `15:00`
- TIPO: `Actividad`
- ACTIVIDAD / DETALLE: `Reunión de pleno`
- LUGAR: `Primera sala de la corte`
- PARTICIPANTES: `Todos los ministros`
- ESTADO: `Por Confirmar`

Resultado: **PASS**.

## Flexibilidad de lenguaje

Se ejecutaron **38 frases adicionales** con variaciones de lenguaje, incluyendo:

- `Quiero agendar...`
- `Necesito registrar...`
- `Programa...`
- `Anota...`
- frases sin verbo de comando cuando ya se está dentro de Crear por voz;
- fechas absolutas y relativas;
- `mañana`, `pasado mañana`, viernes, fechas numéricas;
- `15:00`, `quince treinta`, `una y media de la tarde`, `cuatro y cuarto`;
- `primera sala`, `la segunda sala`, `sala dos`, `oficina`, `auditorio`, `tribunal`, `radio`, `Zoom`, `Teams`;
- `participarán`, `participan`, `asistirán`, `asisten`, `con participación de`, `junto a`, `a cargo de`, `responsable`, `participantes`;
- MM, PH, nombres completos y grupos como `todos los ministros`;
- Confirmada, Por Confirmar, Pendiente, Cancelada, Boletín y Redes Sociales;
- Actividad, Audiovisual, Jurisdiccional, Turno y Efeméride.

Resultado: **38/38 PASS**.

Además hubo un conjunto focalizado de **15 casos** sobre fecha/hora/lugar/participantes: **15/15 PASS**.

## Pulsar para hablar

Se probó el controlador de interacción:

- pulsar → inicia una vez;
- soltar → termina una vez;
- el `click` posterior no vuelve a iniciar;
- cancelación de puntero → cancela sin crear actividad.

Resultado: **PASS**.

## Participantes separados

Durante la revisión por voz:

- DETALLE contiene solo el nombre de la actividad;
- PARTICIPANTES se muestra en un campo independiente y editable;
- al guardar, se conserva como sufijo `· Participan: ...` dentro de DETALLE porque la planilla actual no tiene una columna PARTICIPANTES.

Se probó además que una **Nueva actividad manual** no hereda ese campo ni ese sufijo.

Resultado: **PASS**.

## Protección de lo existente

Comparación SHA-256 contra 1.1.1:

- `Code.gs`: idéntico
- `config.js`: idéntico
- `manifest.webmanifest`: idéntico
- todos los iconos: idénticos

El diff de `app.js` se limita al flujo de voz y a la composición controlada del sufijo de participantes cuando la actividad proviene de voz.

## Validaciones técnicas

- `app.js`: sintaxis correcta
- `voice-create.js`: sintaxis correcta
- `voice-session.js`: sintaxis correcta
- `voice-press.js`: sintaxis correcta
- `service-worker.js`: sintaxis correcta
- `Code.gs`: sintaxis correcta
- HTML: 104 IDs, sin duplicados
- CSS: sin errores de parseo
- cache PWA: actualizado a `agenda-comunicaciones-shell-112`

## Visual 1.1.2

El botón circular fue reemplazado por una **barra Push-to-Talk** de ancho completo:

- icono de micrófono a la izquierda;
- texto principal `MANTENGA PULSADO PARA HABLAR`;
- al presionar cambia a `ESCUCHANDO · SUELTE AL TERMINAR`;
- medidor animado de voz a la derecha;
- estado y cronómetro en una línea superior;
- ACTIVIDAD pasa a ser el primer dato identificado;
- transcripción limitada en altura para impedir que un texto largo vuelva a deformar la interfaz.

## Límite de la prueba

Las pruebas automáticas reproducen el patrón de eventos del reconocimiento de voz, incluida la entrega acumulativa y el reinicio tras una pausa. No sustituyen una prueba física final con el micrófono del mismo teléfono Android, ya que el hardware/servicio de reconocimiento pertenece al dispositivo.

Por eso, después de publicar 1.1.2, la prueba recomendada es repetir exactamente la frase del caso reportado y comprobar los seis campos antes de Guardar.
