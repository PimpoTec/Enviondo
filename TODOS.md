# TODOS — hoja de ruta de mejoras

Prioridad: **P0** urgente/correctitud · **P1** alto valor · **P2** pulido.
Marcá `[x]` a medida que se completan.

## Hecho — tanda 15 (rediseño de la tarjeta "Próximo vuelo", según foto)
- [x] Layout de una sola columna con secciones separadas por línea (antes era
      dos columnas lado a lado): Fecha programada → METAR/TAF → Aeronave.
- [x] "Editar plan" se movió junto a la etiqueta "Aeronave" (antes era un
      ícono en la fila de acciones de abajo).
- [x] Matrícula + modelo en texto grande ("LV-WXY (Piper Archer)").
- [x] Ruta con el código OACI grande y el **nombre de la ciudad** debajo
      (nuevo — sale del mismo dataset de `js/aerodromos.js` que usa el
      autocomplete), conectados con línea punteada y el ícono de avión al medio.
- [x] Etiquetas tipo "badge" al pie (tipo de vuelo elegido, Travesía, Con
      instructor) en vez de una lista de pares clave/valor.
- [x] Color celeste fijo para el texto de METAR/TAF (`.plan-clima`), como
      excepción documentada en `DESIGN.md` a la regla de "solo naranja de
      marca" — imita el resaltado de datos meteorológicos de un instrumento.

## Hecho — tanda 14 (editar vuelos agendados)
- [x] Botón "Editar" (ícono lápiz) en cada tarjeta de "Próximo vuelo", junto
      a "Marcar como volado"/"Borrar". Abre el mismo formulario de
      "Programar vuelo" con todos los campos precargados (fecha, hora,
      aeronave, instructor, desde/hasta, tipo de vuelo, notas); el botón pasa
      a decir "Guardar cambios" y actualiza el registro en vez de crear uno
      nuevo. Nuevo `Repo.actualizarVueloProgramado`.

## Hecho — tanda 13 (tipo de vuelo agendado, opcional)
- [x] **"Programar vuelo"**: nuevo campo opcional "Tipo de vuelo" (Vuelo
      Solo / Vuelo de Instrucción / Capota / Nocturno / Navegación / Examen).
      Si no lo elegís, la tarjeta de "Próximo vuelo" sigue mostrando
      Local/Travesía deducido del destino, como siempre. Requiere correr
      `sql/agregar_tipo_vuelo_programado.sql` en Supabase.

## Hecho — tanda 12 (sobrevivir a que el navegador descargue la pestaña)
Causa: en mobile (más todavía si la app está "instalada" como PWA, que es
`display: standalone` en el manifest), el sistema operativo suele descargar
de memoria una pestaña/app en segundo plano para liberar RAM. Al volver, el
navegador hace una recarga completa desde cero — y todo lo que vivía solo en
memoria de JS (formulario sin guardar, filtro aplicado, en qué sección de
Perfil estabas) se pierde, como si nunca hubiera estado.
- [x] **Nuevo vuelo — borrador automático**: mientras cargás un vuelo nuevo
      (no mientras editás uno existente), cada cambio en el formulario se
      guarda solo en `localStorage`. Si la pestaña se recarga a mitad de
      carga, al volver a "Nuevo vuelo" se restaura el borrador (con un aviso
      de que se recuperó) en vez de arrancar en blanco. Se borra solo al
      guardar el vuelo con éxito o al tocar "Limpiar".
- [x] **Bitácora — filtro en la URL**: `#bitacora?desde=...&aeronave=...` en
      vez de vivir solo en memoria — una recarga vuelve a aplicar el mismo
      filtro en vez de mostrar todo de nuevo. Borrar un vuelo desde una vista
      filtrada ya no descarta el filtro al refrescar la tabla.
- [x] **Perfil — sección en la URL**: `#perfil?seccion=personales` (etc.) en
      vez de un estado interno — un reload te devuelve a la misma sección en
      vez de mandarte al menú.
- [ ] Pendiente si hace falta más: los filtros de Exportar (fecha/aeronave/
      finalidad) todavía viven solo en memoria — impacto menor porque no
      hacen desaparecer una vista, solo hay que volver a elegirlos antes de
      exportar. Mismo patrón que Bitácora si en algún momento molesta.

## Hecho — tanda 10 (feedback de carga + un round-trip menos por acción)
- [x] **`UI.skeletonDiferido`**: esqueleto de carga que solo aparece si la
      pantalla/sección tarda más de 150ms — si la respuesta es casi
      instantánea, no hay parpadeo de "cargando". Conectado en el router
      (toda navegación por hash) y en Perfil (los cambios de sección son
      internos, no pasan por el router, así que no tenían ningún feedback).
- [x] **`usuarioActual()` usa `getSession()` en vez de `getUser()`**:
      `getUser()` siempre hace un viaje de ida y vuelta al servidor de
      Supabase para revalidar la sesión; `getSession()` la lee local (sin
      red) — la seguridad real la sigue imponiendo RLS del lado del
      servidor, no esta función. Esto saca un round-trip de red de CADA
      "guardar" de la app (vuelos, aeronaves, vencimientos, cursos, datos del
      piloto) y de `esAdminApp()` (que se llama al entrar a Preferencias).

## Hecho — tanda 11 (cache local, stale-while-revalidate)
- [x] **`js/cache.js`**: cachea en `localStorage` los datos que solo cambian
      cuando VOS los editás con los propios botones (crear/editar/borrar) —
      vuelos, aeronaves/tarifas, vencimientos, vuelos programados, cursos
      activos, reparto HVI, datos del piloto, mínimos de licencia. Al pedirlos,
      se devuelve lo cacheado AL INSTANTE (sin esperar red) mientras se
      refresca calladamente en el fondo (stale-while-revalidate) para la
      próxima vez. Cuando guardás/borrás algo, esa entrada se invalida al
      toque — el próximo pedido trae la versión real, no una vieja.
      `listarVuelos()` solo cachea el pedido sin filtros (el más común); las
      consultas filtradas (Bitácora filtrada, Exportar) van directo a la red.
- [x] Se invalida todo el cache al **cerrar sesión** (para que otra cuenta en
      el mismo dispositivo no vea ni por un instante datos de la anterior) y
      se invalidan los vuelos al **sincronizar la cola offline**.
- [x] Tests del módulo de cache (`tests/cache.test.js`, con un `localStorage`
      falso para el sandbox de Node): 48 en verde en total.

## Ideas para seguir reduciendo la latencia (no implementadas todavía)
- [ ] **Región del proyecto de Supabase**: si el proyecto no está en
      `sa-east-1` (São Paulo) u otra región cercana a Argentina, cada consulta
      paga latencia de distancia que ningún cambio de código puede achicar.
      Vale la pena confirmarlo en el dashboard de Supabase (Project Settings).

## Hecho — tanda 9 (arranque lento de TODA la app)
- [x] **Causa real de "tarda 10 segundos para entrar a cualquier lado"**:
      `xlsx` (SheetJS) y `exceljs` se cargaban como `<script>` normales
      (bloqueantes) desde CDN, ~270KB cada una, usadas por un solo botón cada
      una en Exportar — pero el navegador tenía que terminar de bajarlas
      ANTES de ejecutar una sola línea del código propio de la app (login,
      dashboard, todo). Con conexión lenta, eso bloqueaba el arranque entero.
      Se marcaron `defer`: siguen listas antes de que el usuario llegue a
      exportar algo, pero ya no frenan el resto de la app.

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
