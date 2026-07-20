# TODOS — hoja de ruta de mejoras

Prioridad: **P0** urgente/correctitud · **P1** alto valor · **P2** pulido.
Marcá `[x]` a medida que se completan.

## Hecho — tanda 8 (sensación de app lenta / botones "celestes")
- [x] **Resaltado táctil nativo**: Android/Chrome pintaba un flash celeste
      por defecto al tocar cualquier botón (el highlight táctil del sistema,
      no algo del diseño). Se desactivó globalmente
      (`-webkit-tap-highlight-color: transparent`) y se sumó feedback propio
      donde faltaba (`.menu-item:active`).
- [x] **`touch-action: manipulation`** en botones/links/inputs — saca el
      delay de doble-tap-zoom en mobile.
- [x] **Perfil hacía 6 consultas a Supabase en CADA click**, incluso para
      cosas 100% locales (tema, huso horario, toggle de admin viven en
      `localStorage`). Ahora esos tres toggles actualizan el DOM al toque,
      sin ir a la red.
- [x] **Cada sección de Perfil pedía los datos de las 6 juntas** aunque solo
      usara 1 o 2 (ej. entrar a Preferencias no necesita vuelos, papelera ni
      datos del piloto). Ahora cada sección hace solo las consultas que
      realmente necesita — Preferencias 1, Papelera 1, Alertas 2,
      Personales 2-3 (antes siempre 6).

## Hecho — tanda 7 (Perfil como menú interno)
- [x] **Costos fuera de la barra inferior**: la barra vuelve a sus 4 íconos
      originales (Inicio, Bitácora, Aeronaves, Totales). Costos y Exportar ya
      no son destinos de primer nivel.
- [x] **Perfil = menú interno** (estilo Ajustes): al entrar mostrás una lista
      de 6 opciones — Datos Personales, Preferencias, Costos, Exportar,
      Alertas, Papelera — con badges de aviso (papelera con vuelos, alertas
      pendientes). Cada una abre su contenido con un botón "← Perfil" para
      volver.
- [x] **Datos Personales**: cursos/carreras activas, reparto HVI, datos del
      piloto (nombre/licencia/legajo) y **cambiar contraseña** (nuevo, usando
      `Auth.actualizarPassword` con la sesión activa).
- [x] **Preferencias**: tema, huso horario y el toggle/panel de administrador
      (antes sueltos en la pantalla única de Perfil).
- [x] **Costos y Exportar** vuelven a ser pantallas propias (se deshizo el
      merge de la tanda 3): Costos con su resumen y gráficos; Exportar con
      las herramientas de exportación y la ficha ANAC — accesibles solo desde
      el menú de Perfil.
- [x] **Alertas**: vencimientos + currency (antes en la pantalla única).
- [x] **Papelera**: sin cambios de contenido, ahora en su propia sección.

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

## Hecho — tanda 6 (4 bugs de la Hoja ANAC) — con una corrección posterior
- [x] **Arrastre en 0 al filtrar por fecha**: se busca el historial real
      (mismos filtros de aeronave/finalidad, sin límite de fecha inferior) y se
      usa como arrastre inicial — "exportar desde tal fecha" ya no resetea las
      horas a cero. El acumulado tampoco resetea entre años (es de carrera,
      como en el libro de papel): un export multi-año encadena el total real.
- [x] **Aeródromo doblado**: NO era la Hoja ANAC (ahí ya mostraba un solo
      valor) — era la "Planilla simple (.xlsx)" y la Ficha por vuelo, que
      tenían columnas separadas "Desde"/"Hasta" repitiendo el mismo código en
      vuelos locales. Se unificaron en una sola columna "Desde / Hasta" (o
      "ruta") en ambas.
- [x] **"MONOMOTOR" ilegible**: se abrevia (MONOM./MULTIM./REACTOR/TURBOH./
      AEROAP./SIMUL.), tolerante a mayúsculas/espacios.
- [x] **Recuadro "Total horas" mal ubicado/cortado**: al arreglar el punto
      anterior (desactivar wrap en los renglones de datos para que la
      abreviación de clase no se corte), sin querer se le sacó el wrap
      TAMBIÉN al recuadro de "Total horas de vuelo", que si lo necesita
      (3 líneas cortas) — quedó amontonado/ilegible, exactamente el problema
      original. Corregido: wrap explícito solo en ese recuadro, fila más alta,
      texto más corto ("TOTAL HS. VUELO / PÁG. ANTERIOR/SIGUIENTE / N.N").
  - ⚠️ **Revertido por error de interpretación**: en el primer intento de este
    fix había sacado las horas de adiestrador/simulador de la hoja (asumiendo
    que "Instructor"/"Piloto en instrucción" eran campos de nombre) — el
    usuario confirmó que ESO estaba bien antes y no había que tocarlo. Se
    restauró el mapeo original (col 29 = horas de adiestrador, sumadas en los
    totales; turnos TERR-TERR incluidos como renglón normal).
- [x] Tests de la lógica de mapeo (`tests/exportadorAnac.test.js`, sin
      necesitar ExcelJS): 43 en verde.

## Pendiente / ideas a futuro
- [ ] **Papelera** sigue solo en Perfil (aceptable: acción poco frecuente).
- [ ] **Hoja ANAC**: se podría permitir elegir el rango/año a exportar desde
      un selector, además de los filtros de fecha ya existentes.
- [ ] **Backfill** de `costo_congelado` en vuelos viejos en USD (no hay cómo
      saber la cotización histórica exacta; quedaría estimado).
- [ ] Migrar el resto de `onclick` inline (bitácora, vencimientos) a
      delegación, por prolijidad (hoy solo interpolan UUIDs, sin riesgo).
