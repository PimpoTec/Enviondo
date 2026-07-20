# TODOS — hoja de ruta de mejoras

Prioridad: **P0** urgente/correctitud · **P1** alto valor · **P2** pulido.
Marcá `[x]` a medida que se completan.

## Hecho en esta tanda
- [x] Bitácora: ordenar por columna ya no descarta el filtro aplicado
      (ordena el conjunto mostrado, no siempre la lista completa).
- [x] Login: Enter envía el panel visible (email/registro/reset/nueva clave).
- [x] Nuevo vuelo: al abrir un vuelo nuevo se resetean los toggles (modo
      detallado, travesía, discriminación) en vez de heredar el estado del
      vuelo anterior.

## P0 — correctitud
- [ ] **Costos con monedas mixtas**: `costo_total`, "gasto por mes" y "por
      aeronave" suman importes de aeronaves con distinta `moneda` como si
      fueran una sola (se formatean todos en ARS). Agrupar por moneda o
      mostrar un total por cada una.
- [ ] **Slug METAR hardcodeado** (`smooth-processor`): frágil. Recrear la
      Edge Function con slug `metar` o mover el slug a `config.js`.
- [ ] **Fechas como UTC**: `new Date('YYYY-MM-DD')` parsea a medianoche UTC;
      comparado con `new Date()` local puede correrse un día (currency 90
      días, "próximo vencimiento"). Comparar siempre por string `YYYY-MM-DD`
      o construir la fecha en local.

## P1 — alto valor
- [ ] **Descubribilidad de navegación**: Costos, Exportar y Papelera solo se
      llegan desde Perfil. Sumar accesos directos o un menú.
- [ ] **Escapado en `onclick`**: `ViewAeronaves._editar` inyecta
      `JSON.stringify(a)` y `_marcarComoVolado` interpola campos crudos en
      atributos `onclick`. Migrar a `addEventListener` + `dataset`/índice.
- [ ] **Estado de guardado**: reemplazar `alert()`/`confirm()` por toasts y
      diálogos propios (consistencia visual, mejor en móvil).
- [ ] **Validación de OACI**: hoy solo avisa; permitir guardar igual está
      bien, pero marcar el campo en rojo y no depender de `confirm()`.
- [ ] **Editar vuelo**: `instrumentos_real` se reparte piloto/copiloto en el
      form pero la DB guarda una sola columna; al editar, todo vuelve a
      "piloto". Documentar o unificar el modelo.

## P2 — pulido / accesibilidad
- [ ] `inputmode="decimal"` en los campos numéricos de horas (teclado móvil).
- [ ] CSS: el bloque de tema claro está duplicado (`[data-theme="light"]` y
      `@media prefers-color-scheme`). Extraer a una sola lista de tokens.
- [ ] Foco/labels ARIA en toggles y navegación inferior (rol `tablist`).
- [ ] Skeletons en vez de "Cargando…" plano.
- [ ] Cobertura de tests: sumar `repartirModoRapido` en travesía/copiloto y
      `estadoVencimiento` (bordes de días).
