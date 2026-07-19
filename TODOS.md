# TODOS

## Regenerar icon-192.png / icon-512.png
**Qué:** `icons/icon.svg` ya tiene el vector nuevo (avión + fondo oscuro, paleta
Avionics Professional), pero `icons/icon-192.png` e `icons/icon-512.png` —
los que realmente usa `manifest.webmanifest` para instalar la PWA — siguen
con el diseño viejo (fondo azul + emoji ✈️).
**Por qué importa:** el ícono de la app en el celular/escritorio no coincide
con la nueva identidad visual.
**Contexto:** no había herramienta de rasterizado SVG→PNG disponible en el
entorno donde se hizo el rediseño. Se puede resolver con cualquier
conversor SVG→PNG (Inkscape, `resvg`, o un export manual desde un editor)
a 192x192 y 512x512 a partir de `icons/icon.svg`.
**Depende de:** nada, es independiente.

## Subir el tamaño de touch target de `.icon-btn`
**Qué:** `.icon-btn` (botón de menú hamburguesa, tema, logout en el topbar)
mide 36x36px; la recomendación de accesibilidad táctil es 44x44px mínimo.
**Por qué importa:** en uso real "parado al lado del avión con el celular"
(contexto explícito del producto), un target chico aumenta el error de tap.
**Contexto:** esto ya era así en el código original, antes del rediseño de
identidad visual — no es una regresión introducida ahora. Evaluar junto con
el resto de la pasada de accesibilidad, no aislado.
**Depende de:** nada, es independiente.
