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

## Hecho — tanda 3 (toasts, admin toggle, costos en exportar)
- [x] **Toasts y confirmaciones propias** (`js/ui.js`): `UI.toast` y
      `UI.confirmar` reemplazan todos los `alert()`/`confirm()` nativos.
- [x] **Toggle de vista admin** en Perfil (solo lo ve el admin): prende/apaga
      el panel de edición de mínimos. Por defecto queda en "usuario normal".
- [x] **Costos dentro de Exportar**: el resumen de costos (total, promedio/hora,
      proyección) y los desgloses por mes/aeronave se muestran en la pantalla
      de Exportar, con presentación más clara. Perfil linkea a una sola
      pantalla.

## Hecho — tanda 4 (todo lo pendiente P0/P1/P2)
- [x] **Slug METAR a `config.js`** (`window.METAR_FN_SLUG`): ya no está
      hardcodeado en la vista; cambiarlo no requiere tocar código.
- [x] **Monedas restringidas a ARS/USD**: el alta de aeronave usa un select
      (antes texto libre), evitando monedas exóticas que rompían los totales.
- [x] **Exportar en la barra inferior** (rotulado "Costos"): descubrible sin
      entrar a Perfil.
- [x] **Validación de OACI**: el campo se marca en rojo (`.campo-invalido`) y
      se limpia al tipear; igual se puede guardar.
- [x] **Cotización blue vía Edge Function**: `supabase/functions/cotizacion`
      como respaldo si el navegador bloquea las APIs públicas por CORS;
      `js/dolar.js` la usa antes de caer al cache.
- [x] **Ruta `#costos`** quitada de `RUTAS` (su contenido vive en Exportar;
      `costos.js` se mantiene por sus funciones de desglose).
- [x] **`inputmode="decimal"`** en los campos de horas/tarifas.
- [x] **Tema claro dedup**: el `data-theme` se fija siempre por JS (script
      inline + `app.js`), así se eliminó el `@media` duplicado del CSS.
- [x] **ARIA**: barra inferior con `role="tablist"`/`tab`/`aria-selected`,
      `aria-label` en botones de ícono; skeleton de carga en vez de "Cargando…".
- [x] **Tests**: `repartirModoRapido` mixto día/noche y `estadoVencimiento`
      (`tests/perfil.test.js`). 31 en verde.

## Hecho — tanda 5 (Hoja ANAC 290/2012 en Excel)
- [x] **Export "Hoja ANAC 290/2012 (.xlsx)"**: reproduce el formulario oficial
      (grilla con bordes, encabezados combinados, anchos), 15 renglones por hoja,
      totales por columna con fórmula viva que se arrastran a la hoja siguiente
      (`='Hoja N'!...`), y **un archivo por año**. Motor: ExcelJS (CDN).
      Módulo isomorfo `js/exportadorAnac.js` (probado en Node).
- [x] **Datos del piloto** en Perfil (nombre, licencia, nº, legajo) para la
      cabecera de la hoja. ⚠️ Requiere `sql/agregar_datos_piloto.sql`.
      `getDatosPiloto` es tolerante si aún no se corrió (no rompe el Perfil).

## Hecho — tanda 6 (4 bugs de la Hoja ANAC)
- [x] **Arrastre en 0 al filtrar por fecha**: ahora se busca el historial real
      (mismos filtros de aeronave/finalidad, sin límite de fecha inferior) y se
      usa como arrastre inicial — "exportar desde tal fecha" ya no resetea las
      horas a cero. El acumulado tampoco resetea entre años (es de carrera,
      como en el libro de papel): un export multi-año encadena el total real.
- [x] **Aeródromo doblado** en la Ficha por vuelo: vuelo local ahora muestra
      una sola fila "Aeródromo" en vez de "Desde"/"Hasta" repitiendo el mismo
      código. (En la Hoja ANAC nunca se duplicó — ahí ya mostraba un valor.)
- [x] **"MONOMOTOR" ilegible**: se abrevia (MONOM./MULTIM./REACTOR/TURBOH./
      AEROAP./SIMUL.) y se desactivó el wrap de texto en los renglones de datos
      (quedó solo en la cabecera) — antes cortaba palabras cortas en columnas
      angostas y se leían mal.
- [x] **Total en columna equivocada**: causa real — las columnas "Instructor"
      y "Piloto en instrucción" del formulario oficial son de NOMBRE (texto),
      no de horas; se estaban sumando como si fueran numéricas (mostrando
      "0.0" donde debía ir un nombre o nada). Se sacaron de los totales;
      "Instructor" ahora muestra el nombre real, "Piloto en instrucción" queda
      en blanco (no se usa). Los turnos de adiestrador/simulador (TERR-TERR)
      se excluyen de la hoja (no llevan renglón en el formulario oficial —
      sus horas se siguen viendo en Totales/Costos); se avisa cuántos quedaron
      afuera al exportar.
- [x] Tests de la lógica de mapeo (`tests/exportadorAnac.test.js`, sin
      necesitar ExcelJS): 42 en verde.

## Pendiente / ideas a futuro
- [ ] **Papelera** sigue solo en Perfil (aceptable: acción poco frecuente).
- [ ] **Hoja ANAC**: se podría permitir elegir el rango/año a exportar desde
      un selector, además de los filtros de fecha ya existentes.
- [ ] **Backfill** de `costo_congelado` en vuelos viejos en USD (no hay cómo
      saber la cotización histórica exacta; quedaría estimado).
- [ ] Migrar el resto de `onclick` inline (bitácora, vencimientos) a
      delegación, por prolijidad (hoy solo interpolan UUIDs, sin riesgo).
