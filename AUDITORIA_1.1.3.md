# Auditoría Agenda Comunicaciones 1.1.3 — corrección Android/Chrome

## Diagnóstico confirmado

La falla de la captura no estaba en la separación final de campos. El parser,
cuando recibe una frase limpia, interpreta correctamente:

- Actividad: Reunión de pleno
- Fecha: 15/12/2026
- Hora: 15:00
- Lugar: Primera sala de la Corte
- Participantes: Todos los ministros
- Tipo: Actividad
- Estado: Por Confirmar

El problema ocurría antes, en la captura de voz.

Android/Chrome puede entregar resultados acumulativos como si fueran varios
elementos:

1. `Reunión`
2. `Reunión de pleno`
3. `Reunión de pleno día quince`
4. `Reunión de pleno día quince de diciembre...`

La versión anterior concatenaba todos esos elementos. Esa era la causa exacta
de textos como `reunión reunión de reunión de pleno...`.

## Corrección 1.1.3

Los elementos de `event.results` ya no se unen con espacios. Se reconcilian con
un algoritmo que distingue entre:

- una hipótesis nueva más larga de la misma frase;
- una frase realmente nueva;
- una repetición;
- una continuación posterior a una pausa/reconexión.

Se añadió una segunda barrera: si el texto final aún muestra un patrón de eco
patológico, se rechaza la captura y NO se abre el formulario.

## Prueba exacta del usuario

Frase probada:

`Reunión de pleno. Día quince de diciembre de dos mil veintiséis. A las quince
horas. Lugar: primera sala de la Corte. Participarán todos los ministros.`

Resultado obtenido:

```json
{
  "FECHA": "15/12/2026",
  "HORA": "15:00",
  "TIPO": "Actividad",
  "DETALLE": "Reunión de pleno",
  "LUGAR": "Primera sala de la Corte",
  "ESTADO": "Por Confirmar",
  "PARTICIPANTES": "Todos los ministros"
}
```

**PASS**

## Simulación del error Android

Se simularon 8 hipótesis acumulativas crecientes, reproduciendo la clase de
eventos que generó la captura.

Texto canónico resultante:

`Reunión de pleno día quince de diciembre de dos mil veintiséis a las quince horas lugar primera sala de la Corte participarán todos los ministros`

Interpretación:

```json
{
  "FECHA": "15/12/2026",
  "HORA": "15:00",
  "TIPO": "Actividad",
  "DETALLE": "Reunión de pleno",
  "LUGAR": "Primera sala de la Corte",
  "ESTADO": "Por Confirmar",
  "PARTICIPANTES": "Todos los ministros"
}
```

**PASS**

## Otras pruebas

- Web Speech con frases segmentadas: PASS
- pausa y reconexión del reconocimiento: PASS
- detección del patrón antiguo de eco: PASS
- frase normal sin falso positivo anti-eco: PASS
- sintaxis app.js: PASS
- sintaxis voice-create.js: PASS
- sintaxis voice-session.js: PASS
- sintaxis voice-press.js: PASS
- sintaxis service-worker.js: PASS
- sintaxis Code.gs: PASS

## Regresión

Se confirmó sin cambios por hash:

- Code.gs
- config.js
- manifest.webmanifest
- todos los iconos

También se verificó que siguen presentes:

- crear actividad manual;
- editar;
- eliminar;
- cambiar estado;
- lectura `listar`;
- calendario;
- búsqueda;
- feriados;
- recordatorio de 15 minutos.

## Interfaz

El Push-to-Talk conserva el gesto:

**mantener pulsado → hablar → soltar**

pero se reforzó visualmente con un control azul-turquesa más contrastado,
micrófono luminoso y medidor de voz.

En la revisión posterior, el dictado original queda plegado bajo
`Ver dictado original`; los campos interpretados son los protagonistas y una
transcripción larga ya no puede dominar la pantalla.
