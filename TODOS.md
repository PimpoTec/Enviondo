# TODOS — hoja de ruta de mejoras

Prioridad: **P0** urgente/correctitud · **P1** alto valor · **P2** pulido.
Marcá `[x]` a medida que se completan.

## Hecho — tanda 1 (UX)
- [x] Bitácora: ordenar por columna ya no descarta el filtro aplicado.
- [x] Login: Enter envía el panel visible.
- [x] Nuevo vuelo: al abrir un vuelo nuevo se resetean los toggles.

## Hecho — tanda 2 (costos en dólares, fechas, METAR, seguridad)
- [x] **Costo congelado en pesos**: al guardar un vuelo de una aeronave que
      cobra en USD, se convierte con el dólar blue (venta) del momento y se
      clava el importe en ARS (`vuelos.costo_congelado` + `cotizacion_usada`).
      El gasto histórico no cambia aunque el dólar suba/baje. Vuelos viejos
      siguen calculándose con la tarifa. ⚠️ Requiere correr
      `sql/agregar_costo_congelado.sql` en Supabase.
- [x] **Fechas locales**: `Calc.parseFechaLocal` reemplaza `new Date('YYYY-MM-DD')`
      (que parseaba en UTC) en currency, vencimientos y estado de licencia.
- [x] **METAR/TAF con respaldo**: si no se puede refrescar, muestra el último
      leído con un aviso "de hace X h" (solo si tiene ≥ 1 hora).
- [x] **`onclick` con datos crudos → delegación**: dashboard (próximo vuelo) y
      tabla de aeronaves ahora usan `dataset` + lookup, sin serializar objetos
      ni interpolar campos en atributos HTML.
- [x] **`instrumentos_real` unificado**: un solo campo (antes se dividía en
      piloto/copiloto y se perdía el dato al editar).

## P0 — correctitud pendiente
- [ ] **Slug METAR hardcodeado** (`smooth-processor`): recrear la Edge
      Function con slug `metar` o moverlo a `config.js`.
- [ ] **Monedas exóticas**: si aparece una aeronave en EUR u otra ≠ ARS/USD,
      el total la suma como ARS. Hoy solo se convierte USD→ARS (dólar blue).

## P1 — alto valor
- [ ] **Descubribilidad de navegación**: Costos, Exportar y Papelera solo se
      llegan desde Perfil. Sumar accesos directos o un menú.
- [ ] **Estado de guardado**: reemplazar `alert()`/`confirm()` por toasts y
      diálogos propios (consistencia visual, mejor en móvil).
- [ ] **Validación de OACI**: marcar el campo en rojo en vez de depender de
      `confirm()`.
- [ ] **Cotización blue vía Edge Function**: si dolarapi/bluelytics bloquean
      por CORS, agregar un proxy propio (igual que el METAR).

## P2 — pulido / accesibilidad
- [ ] `inputmode="decimal"` en los campos numéricos de horas (teclado móvil).
- [ ] CSS: el bloque de tema claro está duplicado (`[data-theme="light"]` y
      `@media prefers-color-scheme`). Extraer a una sola lista de tokens.
- [ ] Foco/labels ARIA en toggles y navegación inferior (rol `tablist`).
- [ ] Skeletons en vez de "Cargando…" plano.
- [ ] Cobertura de tests: sumar `repartirModoRapido` en travesía/copiloto y
      `estadoVencimiento` (bordes de días).
