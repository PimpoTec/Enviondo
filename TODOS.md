# TODOS

## Subir el tamaño de touch target de `.icon-btn`
**Qué:** `.icon-btn` (botón de menú hamburguesa, tema, logout en el topbar)
mide 36x36px; la recomendación de accesibilidad táctil es 44x44px mínimo.
**Por qué importa:** en uso real "parado al lado del avión con el celular"
(contexto explícito del producto), un target chico aumenta el error de tap.
**Contexto:** esto ya era así en el código original, antes del rediseño de
identidad visual — no es una regresión introducida ahora. Evaluar junto con
el resto de la pasada de accesibilidad, no aislado.
**Depende de:** nada, es independiente.
