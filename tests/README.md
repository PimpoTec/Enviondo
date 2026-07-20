# Tests

Sin dependencias ni build — usan `node:test`, incluido en Node 18+.

```
node --test tests/*.test.js
```

No hay `package.json` en la raíz a propósito: el sitio se deploya como estático puro
(sin build) en Vercel, y agregar uno ahí podría cambiar cómo Vercel detecta/buildea
el proyecto. Los tests corren directo con Node, sin necesitarlo.

## Qué cubren

- `calc.test.js` — `Calc.calcularTotales`, `calcularCosto`, `repartirModoRapido`, `horasEntre`.
- `db.test.js` — `agregarVuelos`, `valorRequisito`.
- `dashboard.test.js` — `valorNocturnasAjustado` (reparto en cascada PCA/HAB_NOC) y
  `calcularProgresoPonderado` (el bug real del ~60% vs ~91% de esta sesión).
- `costo.test.js` — `costoRegistrado` (usa el costo congelado en ARS si existe) y
  `parseFechaLocal` (evita el corrimiento de un día por parseo en UTC).

`tests/_helpers/loadApp.js` carga los `<script>` de la app (que asignan a `window.X`)
en un sandbox de Node vía `vm`, sin necesitar un navegador.
