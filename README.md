# Agenda Prensa 1.0.2 — lista para publicación

## Planilla definitiva

Spreadsheet ID:

`1bksbYIKRRv1F0gSp-UlIPRfkD-eu1arigSb2ZxBEdoQ`

Pestaña:

`Hoja 1`

Columnas:

`FECHA · DÍA · HORA · TIPO · DETALLE · LUGAR · ESTADO`

## Apps Script

La aplicación ya quedó configurada con esta implementación:

`https://script.google.com/macros/s/AKfycbw0QmwblTzoC2TJma0pranj-4wBlIBmNo0TjFvXW2mMH--DkndCO9vgzTTxiwxm4wbsxQ/exec`

No es necesario editar `config.js`.

## Publicación en GitHub Pages

Sube todo el contenido de esta carpeta/repositorio:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `service-worker.js`
- `manifest.webmanifest`
- carpeta `icons/`

`Code.gs` se conserva en el paquete solo como respaldo del backend y no se sube a GitHub Pages.

## Zona horaria

El backend trabaja con:

`America/Santiago`

También conviene configurar la propia planilla de Google Sheets con zona horaria Santiago.

## Separación de sistemas

Agenda Prensa utiliza:

- su propia planilla;
- su propia URL de Apps Script;
- su propia identidad visual;
- su propio PWA.

No comparte datos ni backend con Agenda Presidenta.
