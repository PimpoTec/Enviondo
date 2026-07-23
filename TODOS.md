# TODOS — hoja de ruta de mejoras

Prioridad: **P0** urgente/correctitud · **P1** alto valor · **P2** pulido.
Marcá `[x]` a medida que se completan.

## Hecho — tanda 46 (feedback puntual sobre la tanda 45: Dashboard, Bitácora, Aeronaves, Totales)
- [x] **Dashboard**: el anillo de progreso general ya se veía centrado; los
      anillos individuales por curso (ej. con licencia + habilitación en
      paralelo) quedaban pegados a la izquierda en mobile — se centran con
      `justify-content: center` en `.cursos-anillos`. Se sacó el panel de
      bienvenida (nombre + fondo con glow) por pedido explícito ("no me
      gusta como me recibe la app"); en su lugar, una franja compacta y
      clickeable arriba del todo con el próximo vuelo agendado (cuenta
      regresiva, aeronave, ruta — sin foto ni saludo), que lleva a la
      ficha completa de más abajo. Vuelve el botón "Nuevo vuelo" de ancho
      completo como estaba antes de la tanda 45, y se saca el botón
      "Exportar logbook" del Dashboard (ya vive en Perfil → Exportar).
- [x] **Bitácora**: rediseño completo del encabezado y el listado, según
      mockup — título "Libro de Vuelo Digital" + botones "Nuevo registro"
      y "Exportar", card de filtros con ícono por campo (rango de fecha,
      matrícula, función) que aplica el filtro solo (sin botón
      "Filtrar" — cambiar cualquier campo dispara la búsqueda), botón
      "Limpiar filtros". La tabla pasa a ser una lista de tarjetas por
      vuelo (fecha, aeronave, ruta, función, tiempo con ícono sol/luna
      según diurno/nocturno) con paginación de a 10 (antes se mostraban
      todos los vuelos filtrados de una — con meses de historial es un
      scroll eterno); el orden por columna del header viejo se reemplaza
      por un select "Ordenar por" (mismo resultado, sin encabezado de
      tabla). Botón flotante (FAB) de "nuevo registro" en mobile. La
      ficha modal y el panel de edición rápida siguen intactos (solo se
      adaptó el panel de `<tr><td>` a un `<div>`, ya no hay tabla).
- [x] **Aeronaves**: se agregó foto editable por ficha (subida real a
      Supabase Storage, bucket público `aeronaves-fotos` con políticas
      de escritura por dueño — `sql/agregar_foto_aeronave.sql` y
      `schema.sql` actualizados, documentado en README § 9). Botón de
      cámara en la tarjeta para agregar/cambiar la foto, y una cruz para
      quitarla; sin foto propia, sigue el degradé + ícono de siempre.
- [x] **Totales**: reordenado según mockup — "Resumen general" (horas
      totales, con "+X hs este mes" real calculado sobre el mes
      calendario actual), tarjeta de cantidad de vuelos, "Horas por
      aeronave" (nuevo, `calcularHorasPorAeronave` — suma tiempo_total
      por matrícula) y "Discriminación de horas" con el mismo diseño de
      barra que "Progreso de licencia" (barra = proporción sobre el
      total general, no un mínimo). "Monomotor" no es un campo propio en
      la base — se muestra como aproximación derivada (total menos las
      categorías que sí se cargan a mano), aclarado en un comentario;
      "Totales acumulados" pierde los dos campos que ahora están arriba
      (total general, cantidad de vuelos) para no duplicar.
- [x] Verificado con Playwright (oscuro y claro) las 4 pantallas tocadas,
      incluyendo la ficha y edición rápida de Bitácora (para confirmar
      que sobreviven al cambio de tabla a tarjetas) y una foto de
      ejemplo en Aeronaves. 92 tests en verde (se sumaron 4 nuevos para
      `calcularHorasPorAeronave`/`calcularHorasEsteMes`).

## Hecho — tanda 45 (sistema de diseño "AeroMetric": traducido a vanilla CSS/JS en toda la app)
- [x] A pedido, se pasaron 4 mockups (Bitácora, Aeronaves, Dashboard, Perfil)
      + 2 `DESIGN.md` + 3 `code.html` (Tailwind + Material Symbols,
      nombre "AeroMetric") con la instrucción de mantener ese estilo visual
      en toda la app. Decisión explícita, comunicada antes de empezar: se
      adapta el lenguaje visual (glassmorphism, tipografía Hanken Grotesk +
      Inter, acento naranja, radios más redondeados) al sistema vanilla
      CSS/JS existente — **sin** migrar a Tailwind/React ni al set de
      Material Symbols Outlined (se sigue usando `Icons.js`, el set de SVG
      propio), y **sin** fotos reales de aeronave (no hay función de subida
      de fotos — se usa un degradé + ícono grande en su lugar).
- [x] **Identidad**: la app pasa a llamarse **Enviondo** también en la UI
      (antes solo en el repo/branches) — header, `<title>`, login,
      `manifest.webmanifest` (`name`/`short_name`).
- [x] **Base global**: `--radius`/`--radius-sm` un poco más redondeados,
      tipografía de títulos Hanken Grotesk (`--font-headline`), tokens de
      vidrio (`--glass-bg`/`--glass-border`/`--glow-primary`, con el efecto
      de vidrio desactivado en tema claro vía override) aplicados a
      `.card`, `header.topbar`, `.bottom-nav`, `.modal-box`, `.ticket-modal`.
      Tablas rediseñadas como filas-tarjeta separadas (`border-spacing` en
      vez de `border-collapse`, esquinas redondeadas, barrita de acento al
      pasar el mouse) — verificado que la fila de edición inline de
      Bitácora (`.fila-edicion-inline`, con su `<td display:block>`) sigue
      viéndose bien con el nuevo espaciado.
- [x] **Aeronaves**: de tabla plana a grilla tipo "bento" — fila de stats
      (Total/Aeronaves/Simuladores/Preferidas, 100% datos reales, sin
      inventar "en taller" que no existe en el modelo), una tarjeta por
      aeronave/simulador (header con degradé + ícono + matrícula, tarifas
      diurna/nocturna con íconos sol/luna, pie con "Preferida" si aplica),
      y una tarjeta punteada "Nueva aeronave" al final de la grilla.
- [x] **Dashboard**: nuevo panel de bienvenida (glow ambiental, saludo con
      el nombre del piloto si está cargado en Datos Personales, mensaje
      corto sobre el próximo vuelo agendado, botones "Nuevo vuelo" /
      "Exportar logbook", anillos decorativos). El progreso de licencia
      pasa de una lista de texto + barra combinada a un anillo chico por
      curso activo (PPA/PCA/etc., cada uno con su % y "faltan X hs"), con
      el % combinado como texto aparte solo si hay más de un curso activo.
- [x] **Perfil**: los vencimientos pasan de tabla a tarjetas con acento de
      color a la izquierda según urgencia (vigente/por vencer/vencido) y
      una barra fina de proximidad dentro de la ventana de alerta (solo
      con datos reales: días restantes vs. umbral configurado — no se
      inventa una "vigencia total" que la app no registra). Banner de
      alerta crítica en el menú de Perfil cuando hay algo realmente
      vencido, con acción directa a Alertas.
- [x] Verificado con Playwright (tema oscuro y claro) cada pantalla tocada:
      tabla de Bitácora + fila de edición inline, grilla de Aeronaves,
      hero + anillos por curso del Dashboard, menú y Alertas de Perfil.
      88 tests siguen en verde (cambios de presentación, sin tocar lógica
      pura — `estadoVencimiento()` solo suma un campo `dias`/`umbral`
      adicional al objeto que ya devolvía).
- [x] Pendiente si se quiere seguir esta línea: Costos y Exportar (dentro
      de Perfil) no se tocaron — quedaron con el estilo de base ya
      heredado (cards/tablas/botones), sin secciones propias del mockup.

## Hecho — tanda 44 (pulido visual "profesional y moderno": Dashboard, Bitácora, Totales)
- [x] A pedido, primer pasada de una mejora visual más grande — usando
      21st.dev (`mcp__21ST_CHAT__search_picker`) como inspiración
      (stat cards con conteo animado, tablas con hover suave, la ficha
      de vuelo tipo "boarding pass" ya coincidía con esa dirección)
      adaptada a mano al sistema de diseño vanilla CSS existente (nada
      de React/Tailwind, es solo referencia visual).
- [x] **Base global**: token `--shadow-lg` (elevación para estados
      destacados), animación de entrada sutil en `.card`
      (`@keyframes card-in`, respeta `prefers-reduced-motion`), y un
      helper nuevo `animarNumero()` (`js/app.js`) — cuenta desde 0 hasta
      el valor final con ease-out cúbico en vez de aparecer de golpe,
      sin dependencias.
- [x] **Dashboard**: el número de horas totales del hero (centro del
      anillo de progreso) ahora cuenta animado en vez de aparecer fijo.
- [x] **Totales**: `.stat` (usado en las 4 grillas de agregados) pasa de
      "número suelto" a una tarjeta de KPI de verdad — chip de fondo,
      borde, y el valor cuenta animado (`stat()` guarda el valor real en
      `data-valor`, `animarStats()` lo anima al terminar de renderizar;
      si el JS no corre por lo que sea, igual queda el valor correcto).
- [x] **Bitácora**: filas de la tabla con una barrita de acento naranja
      que aparece a la izquierda al tocar/pasar el mouse (transición de
      color, no aparece de la nada), sobre el mismo highlight de fondo
      que ya existía.
- [x] Verificado con Playwright en tema oscuro y claro: el número del
      hero efectivamente cuenta (valor intermedio ≠ inicial ni final
      capturado a mitad de la animación), las tarjetas de stat se ven
      con el chip nuevo, y el acento de hover de la tabla aparece
      correctamente en ambos temas. 88 tests siguen en verde (cambios
      visuales, sin tocar lógica pura).
- [x] Pendiente si se quiere seguir esta misma línea: el mapa de rutas y
      la ficha de vuelo ya habían tenido su propio rediseño en tandas
      anteriores (23, 32) y ya están alineados con esta dirección — no
      se tocaron de nuevo acá. Buen próximo paso: pedir puntualmente qué
      parte se ve floja todavía para una segunda pasada más específica.

## Hecho — tanda 43 (ficha de vuelo de Bitácora: de fila de tabla a modal)
- [x] Reportado con foto: al tocar un vuelo, la fila de detalle que se
      abría debajo desalineaba las columnas de las OTRAS filas de la
      tabla (Ruta/Aeronave/Finalidad se corrían para la derecha, dejando
      un hueco raro). A pedido: en vez de una fila de tabla, la ficha
      ahora es un modal — fondo oscuro difuminado (`backdrop-filter:
      blur`) con la tarjeta encima, mismo estilo que la ficha ya tenía.
      Se cierra con la cruz arriba a la derecha, tocando afuera del
      recuadro, con Escape, o con el botón "atrás" del celu (pushea una
      entrada al historial al abrir y la consume al cerrar, así un
      "atrás" real después no queda pisado por esto).
- [x] De paso, se simplifica bastante: al ya no vivir adentro de un
      `<td colspan>` de la tabla, se cae TODO el código que hacía falta
      para lidiar con eso — el `display:block` del `<td>`, el cálculo a
      mano de ancho/margen contra `.table-wrap` (tandas 33, 39), el
      reset de scroll horizontal al abrir. El modal se centra solo, como
      cualquier otro modal de la app (`.modal-overlay`).
      `filaDetalle` (estado ya no necesario) sacado de `ViewBitacora`;
      `_filaDetalleVuelo`/`_bindDetalleVuelo` reemplazados por
      `_ticketHtml` (solo el contenido) + `_abrirFichaVuelo` (el modal).
- [x] Bug propio encontrado al verificar: la cruz de cerrar (arriba a la
      derecha del modal) quedaba tapando la fecha del encabezado del
      ticket — arreglado con `padding-right` en `.ticket-head`.
- [x] Verificado con Playwright: posición del encabezado de la tabla
      IDÉNTICA antes/después de abrir el modal (el bug reportado ya no
      pasa), cierre con cruz/click afuera/"atrás" del navegador, y que
      "Edición rápida" cierra el modal y abre el panel de edición
      inline correctamente. 88 tests siguen en verde (sin tests nuevos:
      es una reestructuración de DOM/UI, no lógica pura nueva).

## Hecho — tanda 42 (METAR/TAF: registro propio para no rebuscar cada vez)
- [x] A pedido: la búsqueda del aeródromo cercano (tanda 41) se repetía
      de cero cada vez que se abría el dashboard, aunque ya se supiera de
      antes que, por ejemplo, SADM no tiene TAF propio — "que se ponga a
      pensar la app" cada carga. Ahora, una vez resuelto (el propio
      aeródromo tiene, un cercano tiene, o ninguno tiene), queda guardado
      en un registro propio en `localStorage` (`_guardarMetarRegistro`/
      `_leerMetarRegistro`, 30 días de vigencia — una estación no
      aparece/desaparece de un día para el otro) con a qué código pedirle
      la próxima vez. Las cargas siguientes van directo ahí: sin
      registro, 3 pedidos de red (verificado con Playwright); con
      registro ya guardado, 1 solo pedido.
      El TEXTO del reporte se sigue pidiendo fresco siempre (cambia hora
      a hora) — lo que se evita repetir es la BÚSQUEDA de dónde
      conseguirlo. Si el código registrado deja de responder (estación
      caída un rato), no disparamos una rebúsqueda completa por eso
      solo — se muestra la última cache que haya.
- [x] 5 tests nuevos para `_leerMetarRegistro`/`_guardarMetarRegistro`
      (round-trip, TTL de 30 días, metar/taf independientes, sin nada
      guardado). Hubo que agregar un `localStorage` en memoria al
      sandbox de `tests/_helpers/loadApp.js` (no viene por default en un
      `vm.createContext` vacío — los guardados fallaban silenciosos,
      atrapados por el propio try/catch de storage lleno). 88 tests en
      total, todos en verde.

## Hecho — tanda 41 (METAR/TAF: si el aeródromo no tiene, mostrar el más cercano que sí)
- [x] A pedido: muchos aeródromos chicos/privados nunca tuvieron estación
      meteorológica propia (no es un problema de conexión, simplemente no
      hay METAR/TAF para ese código) — antes el cartel quedaba vacío
      ("Sin METAR publicado"). Ahora, si el aeródromo pedido no tiene, se
      busca el aeródromo con código OACI más cercano que sí tenga datos
      (probando de más cerca a más lejos, tope de 6 para no demorar de
      más) y se muestra ESO, con un aviso bien visible (badge amarillo,
      mismo estilo que las alertas de vencimiento) aclarando que no es el
      del aeródromo pedido y a cuántas millas náuticas está.
- [x] El aviso de sustituto queda guardado en la cache local junto con el
      texto — así, si después no hay conexión y se muestra el último dato
      leído, se sigue viendo la aclaración (no puede confundirse con el
      clima real del aeródromo pedido).
- [x] Refactor menor: `cargarMetar` se partió en `_fetchMetarCrudo`
      (un pedido, sin tocar el DOM — reusable), `_buscarMetarCercano`
      (la búsqueda por distancia) y `_renderMetarTexto` (pinta el badge +
      el texto). Tests nuevos para `_buscarMetarCercano` con un dataset
      sintético de aeródromos y `fetch` mockeado (4 casos: salta el más
      cercano sin datos, ninguno tiene, sin coordenadas del pedido, tope
      de candidatos) — 83 tests en total, todos en verde. Verificado
      visualmente con Playwright que el badge se ve bien y no rompe el
      `<p>` contenedor (se usan `<span>` con `display:flex`/`block`, no
      `<div>`, porque bloques adentro de un párrafo no son válidos).

## Hecho — tanda 40 (fix: el evento de calendario salía de 30 min, ignorando los horarios)
- [x] Reportado: al agregar un vuelo agendado a Google Calendar (tanda
      39), el evento salía siempre de 30 min, sin respetar el horario
      previsto/de arribo cargado. Causa: `_urlCalendarioProgramado`
      armaba la URL con `URLSearchParams`, que codifica automáticamente
      la "/" entre el inicio y el fin del parámetro `dates` como `%2F` —
      el endpoint de Google Calendar no la decodifica bien ahí, descarta
      el rango completo (formato "inválido" desde su punto de vista) y
      cae al evento rápido de 30 min por default, aunque el resto de los
      datos (título, ubicación) sí llegaban bien.
- [x] Arreglo: la URL se arma a mano para poder dejar esa "/" literal sin
      codificar en `dates` (síntoma y arreglo confirmados por búsqueda —
      es un gotcha documentado de este endpoint), mientras el resto de
      los campos (texto, detalles, ubicación) se siguen codificando con
      `encodeURIComponent` normalmente. Los 5 tests de la tanda 39 siguen
      en verde sin cambios (`URL`/`.searchParams` decodifican la "/" al
      leer, esté codificada o no, así que no hacía falta tocarlos).
- [x] Confirmado (ya estaba anduviendo así desde la tanda 39, doble
      chequeo a pedido): la hora cargada se interpreta según la
      preferencia de huso horario vigente (UTC u Hora local) y se
      convierte a UTC real antes de mandarla — Google Calendar la
      traduce solo a la zona horaria de quien abre el link, sin importar
      con qué preferencia se cargó originalmente.

## Hecho — tanda 39 (agregar vuelo agendado a Google Calendar, sin OAuth)
- [x] A pedido: opción simple, sin ninguna configuración externa (se
      evaluó la alternativa con OAuth real — ver conversación — y se
      eligió esta por menor costo/mantenimiento para una app personal).
      Nuevo botón de calendario (ícono, junto a Recordatorios/Borrar) en
      cada tarjeta de "Próximo vuelo", y se ofrece automáticamente al
      agendar un vuelo nuevo (mismo patrón que "¿Deseás crear
      notificaciones?"). Abre un link `calendar.google.com/.../render`
      con el evento ya completado (matrícula, ruta, horario, instructor,
      notas) — un toque de "Guardar" del lado del usuario. Sin cuenta
      para "vincular": usa la que ya esté abierta en el navegador/celu.
- [x] `hora_prevista`/`hora_finalizacion` se cargan según la preferencia
      de huso horario vigente al agendar (UTC u Hora local — ver
      `labelHora`/`obtenerPrefHorario`), así que se interpretan con esa
      preferencia ACTUAL antes de pasarlas a UTC real para Google
      Calendar (que las traduce solo a la zona horaria de quien abre el
      link). Sin hora prevista, evento de todo el día.
- [x] 5 tests nuevos (`tests/dashboard.test.js`) para
      `_urlCalendarioProgramado`: hora prevista + fin por default (1h),
      hora de finalización explícita, preferencia "Hora local" (ART,
      UTC-3) convertida bien a UTC, evento de todo el día sin hora, y
      vuelo local (mismo aeródromo) sin flecha en la ubicación. Hubo que
      agregar `URL`/`URLSearchParams` al sandbox de
      `tests/_helpers/loadApp.js` (no vienen por default en un
      `vm.createContext` vacío).

## Hecho — tanda 38 (costo de vuelos viejos, coordenadas de LAD-2968)
- [x] Vuelos cargados directo en Supabase (fuera de la app) quedan con
      `costo_congelado` en 0 en vez de null — `costoRegistrado` lo toma
      como "congelado a $0" válido y nunca recalcula con la tarifa
      actual, aunque se cargue bien en Aeronaves. A pedido explícito, NO
      se toca ese dato viejo (backfillear con la tarifa de hoy podría ser
      un monto incorrecto y generar más confusión que dejarlo en 0).
- [x] En cambio, para vuelos NUEVOS con fecha de más de un mes de atraso
      (`nuevoVuelo.js`, tanto el formulario normal como el de turno de
      adiestrador/simulador): antes de guardar, se pregunta si la tarifa
      vigente de la aeronave es la misma que la de ese momento, o si hay
      que cargar un valor especial — así no se congela en silencio un
      costo que puede no ser el que realmente se pagó. Si se cierra el
      diálogo sin elegir, o se cancela/deja vacío el monto especial, NO
      se guarda solo (hay que resolver la pregunta primero).
      Agregados `UI.elegir()` (n botones a elección, no solo Aceptar/
      Cancelar) y `UI.prompt()` (input numérico propio, sin el prompt()
      nativo) a `js/ui.js`, mismo patrón visual que `UI.confirmar()`.
- [x] Coordenadas de **LAD-2968** (Córdoba) conseguidas por el usuario:
      33°07.532'S 62°04.656'O → `[-33.1255, -62.0776]`. Agregado a
      `js/aerodromos.js` (nombre "Lugar apto Nº 2968") y
      `js/coordenadas.js` — quedaba pendiente desde la tanda 28 (no se
      había podido conseguir por WebFetch/WebSearch, bloqueados en las
      fuentes oficiales).
- [x] Aclarado: el filtro de fecha "Desde/Hasta" de Exportar YA aplica a
      la Hoja ANAC (no solo a la planilla simple) — no era un gap real,
      la entrada de "Pendiente / ideas a futuro" de más abajo ya lo decía
      pero quedó confuso en la conversación. Sin cambios de código.

## Hecho — tanda 37 (recordatorio de fecha/hora puntual llegaba casi una hora tarde)
- [x] Reportado: recordatorio puesto para "hoy a las 19:24" no llegó. El
      cron (tandas 35-36) corría cada una hora en punto (`0 * * * *`) —
      un recordatorio de fecha/hora puntual solo se revisa cuando corre
      el cron, así que uno puesto para las 19:24 recién lo agarraba el
      tick de las 20:00, casi una hora después. No es un bug de entrega,
      es la granularidad del cron.
- [x] Arreglo: intervalo bajado a cada 5 minutos (`*/5 * * * *`) — el
      atraso máximo para un recordatorio puntual baja de ~1h a ~5min.
      Actualizado el template de `sql/agregar_notificaciones_push.sql`
      (con `cron.alter_job(... schedule := ...)` para cambiar solo el
      intervalo de un cron ya programado) y el README (sección 8).
      Costo de invocaciones extra insignificante para una app de un solo
      usuario (~8.600/mes contra las 500.000 gratis de Supabase).

## Hecho — tanda 36 (avisos automáticos: "a veces sí, a veces no")
- [x] Después de arreglar el timeout de pg_net (tanda 35), los avisos
      seguían llegando de forma inconsistente — a veces sí, a veces no o
      con demora larga. Causa: `webpush.sendNotification` se llamaba sin
      especificar `urgency`, así que por default viaja con prioridad
      normal — Android puede demorar bastante la entrega de mensajes de
      prioridad normal si el celu está en modo Doze/ahorro de batería,
      hasta que el sistema decida "despertar" solo.
- [x] Arreglo: `{ urgency: 'high' }` en la llamada a
      `webpush.sendNotification` (`mandarATodos`, usada tanto por el
      botón de prueba como por el cron) — le pide al servicio de push
      que salte esa espera y entregue de inmediato.

## Hecho — tanda 35 (diagnóstico: avisos automáticos no llegaban — timeout de pg_net)
- [x] Reportado: el botón "Enviar notificación de prueba" funciona, pero
      los avisos automáticos (recordatorios, vencimientos, vuelos
      programados) nunca llegan. Diagnosticado en vivo contra el proyecto
      real: el cron (`pg_cron`) SÍ estaba programado y corriendo cada
      hora, pero `pg_net` corta la conexión a los 5000ms por default y la
      Edge Function (cold start + imports `npm:`) tardaba ~4.9s y se
      pasaba — `cron.job_run_details` decía "succeeded" igual (solo
      confirma que se lanzó el pedido), pero `net._http_response` tenía
      `status_code` null y `error_msg` "Timeout of 5000 ms reached".
- [x] Arreglo: subir `timeout_milliseconds` a 30000 en el `net.http_post`
      del cron. Actualizado el template de
      `sql/agregar_notificaciones_push.sql` (con `cron.alter_job` para
      quien ya tenga el cron viejo programado) y el README (sección 8)
      con este síntoma exacto, para que no haga falta repetir todo el
      diagnóstico la próxima vez.
- [x] Confirmado resuelto en producción: se agregaron logs temporales
      (`DIAG-RECORDATORIO`) a `procesarRecordatorio`, se redesplegó desde
      el dashboard (sin CLI, pegando el código en Edge Functions → Code),
      y la corrida siguiente procesó el recordatorio de prueba de punta a
      punta (`mandarATodos` → `{ total: 2, enviados: 2 }` → marcado como
      enviado). El push llegó al celu con algo de latencia (normal en Web
      Push, no siempre es instantáneo — depende del estado de
      batería/Doze del dispositivo). Logs de diagnóstico sacados
      (`git show 30a1b4a:...` restaurado tal cual, sin las líneas
      `DIAG-*`) — falta redesplegar esta versión limpia una vez más.

## Hecho — tanda 34 (3 detalles de la ficha de vuelo: ruta descentrada, local sin ciudad, TERR)
- [x] El ícono de avión entre los dos códigos no quedaba centrado de
      verdad cuando un nombre de ciudad era mucho más largo que el otro
      (ej. "CAPITÁN SARMIENTO" vs "SAN FERNANDO") — los dos lados
      ocupaban solo lo que su contenido necesitaba, corriendo el ícono
      hacia el lado más corto. Ahora ambos lados tienen el mismo ancho
      (`flex: 1 1 0`), así que el ícono queda siempre en el medio real.
- [x] Vuelo local (mismo aeródromo de origen y destino): el lado derecho
      quedaba en blanco en vez de repetir el nombre de la ciudad.
- [x] Vuelos con TERR/TERR (turno de adiestrador terrestre/simulador, no
      es un aeródromo real) mostraban "TERR ↔ TERR" en la ruta, confuso.
      Ahora en su lugar dice "SIMULADOR" con la matrícula del equipo.

## Hecho — tanda 33 (ficha de vuelo descentrada en la tabla de Bitácora)
- [x] Bug reportado con foto: la ficha de tanda 32 quedaba pegada al borde
      izquierdo de la fila en vez de centrada, con un montón de espacio
      vacío a la derecha en compu (y algo similar en celu). Causa: la
      tabla de Bitácora es más ancha que la pantalla y scrollea de costado
      (`.table-wrap { overflow-x: auto }`); el `<td colspan>` de la ficha
      (con `display:block` para no forzar el ancho de toda la tabla — ver
      tanda 31) se achica al ancho de la propia ficha en vez de estirarse
      a lo ancho de la fila, así que `margin:auto` no tenía espacio de
      sobra para repartir y centrar.
- [x] Arreglado calculando ancho y margen a mano en JS
      (`_bindDetalleVuelo`) contra el ancho realmente visible de
      `.table-wrap`, y reseteando el scroll horizontal de la tabla a 0 al
      abrir la ficha (si había quedado scrolleada de antes, el centrado
      quedaba corrido). Verificado con Playwright en 390px (celu) y
      1440px (compu), con y sin scroll horizontal previo — centrado exacto
      en los dos, sin overflow.

## Hecho — tanda 32 (ficha de vuelo estilo "tarjeta de embarque" en Bitácora)
- [x] Rediseño de la ficha de detalle (tanda 31) a pedido: ahora sigue el
      estilo boarding-pass de la referencia — matrícula y fecha arriba,
      códigos de aeródromo grandes con un ícono de avión en círculo y un
      tag (finalidad · diurno/nocturno) en el medio, separador punteado, y
      una grilla de 2 columnas con salida/llegada UTC, duración, modelo,
      PIC, aterrizajes, distancia (NM) y costo. Clases nuevas
      `.ticket-*`; se sacó `.detalle-vuelo-stats` (quedó sin uso).

## Hecho — tanda 31 (mapa con tema oscuro real, ficha de vuelo en Bitácora, bottom-nav)
- [x] Mapa de rutas (Totales): las tiles ahora son CartoDB Dark Matter/Light
      de verdad (según el tema activo) en vez de tiles claros de OSM con un
      filtro CSS de grises encima — se veía lavado/con poco contraste,
      sobre todo con etiquetas cerca (ej. SDL/SADL en AMBA).
- [x] Bitácora: tocar una fila (fuera de los botones de acción) abre una
      "ficha de check-in" de solo lectura con lo importante de un vistazo —
      ruta con ciudades, aeronave, horario UTC, tiempo total, día/noche,
      PIC, aterrizajes, distancia en NM y costo — sin tener que entrar a
      edición. Nuevo estado `filaDetalle`, mutuamente excluyente con
      `filaEditando` (abrir uno cierra el otro).
- [x] Bug encontrado en la verificación de la ficha nueva: el grid de
      estadísticas (`grid cols-4`, mínimo 140px por columna) vive adentro
      de un `<td colspan>` de una tabla con layout automático — eso forzaba
      la tabla entera a ~800-1100px de ancho y la mitad de los datos
      (tiempo total, día/noche, PIC, costo) quedaban solo alcanzables
      scrolleando de costado, texto contrario al pedido de "verlo de
      un vistazo". Arreglado con una clase propia (`detalle-vuelo-stats`,
      `minmax(0,1fr)`, 2 columnas en mobile / 4 en pantallas más anchas) y
      sacando el `<td>` del cálculo de ancho de la tabla (`display:block`).
- [x] Bug reportado: al hacer scroll hacia abajo, el mapa tapaba la barra
      de navegación inferior. La barra fija no tenía capa de composición
      propia, así que el navegador podía pintarla mal (por debajo del
      mapa, que tiene una animación de "ping" corriendo sin parar) durante
      el scroll en mobile. Arreglado dándole su propia capa
      (`transform: translateZ(0)`), subiendo su z-index muy por encima de
      cualquier elemento del mapa, y conteniendo el z-index interno del
      mapa (controles de Leaflet, ficha de ruta) en su propio contexto de
      apilamiento (`.mapa-wrap { z-index: 0 }`) para que nunca compita
      contra elementos fijos de la página.

## Hecho — tanda 30 (distancia del mapa en NM en vez de km)
- [x] La ficha de ruta del mapa (Totales) mostraba la distancia en km —
      ahora en millas náuticas (NM), la unidad estándar de aviación.
      `distanciaKm` renombrada a `distanciaNm`, mismo cálculo de haversine
      con el radio terrestre en NM.

## Hecho — tanda 29 (progreso de licencia más claro: horas hechas vs. faltantes)
- [x] Cada requisito venía como una sola línea corrida ("184.5 hs / 200 hs
      — faltan 15.5 hs") que en pantalla angosta se cortaba mal y costaba
      leer de un vistazo. Ahora son piezas separadas: el número llevado en
      grande y destacado ("184.5 hs de 200 hs"), y una etiqueta bien
      visible a la derecha del nombre ("Faltan 15.5 hs" o "Completo") en
      vez de texto corrido — responde directo las dos preguntas ("¿cuánto
      llevo?" / "¿cuánto falta?") sin tener que parsear una oración.

## Hecho — tanda 28 (correcciones puntuales al dataset de aeródromos)
- [x] **TERR** (marcador de turno de adiestrador/simulador, no es un
      aeródromo real) ya no cuenta para nada del mapa — antes aparecía en
      la lista de "sin coordenadas". `normalizarCodigoAerodromo` lo
      excluye desde la raíz.
- [x] **SRDS** agregado a `CODIGO_CANONICO` → alias de **CTS** (Capitán
      Sarmiento), que ya estaba en el dataset con coordenadas.
- [x] **BGI** (Ezpeleta) agregado como aeródromo nuevo, con coordenadas.
- [x] **LAD-2968**: no lo pude resolver — los sitios oficiales de ANAC/FADA
      que listan los "Lugares Aptos Denunciados" (LAD, pistas privadas
      declaradas) rechazan la descarga automática (403) y no está
      indexado en buscadores. Pendiente: si conseguís la coordenada del
      PDF de ANAC a mano, la cargo.

## Hecho — tanda 27 (fix: rutas "perdidas" tras el dataset nuevo — MOR, PTA, SNT, etc.)
- [x] **Causa real**: el registro oficial reconoce OACI para varios
      aeródromos que la fuente anterior no sabía que lo tenían (ej. Morón
      local "MOR" → ahora se sabe que es "SADM"). Su código canónico
      cambió de local a OACI — los vuelos ya cargados con el código viejo
      ("MOR") dejaron de encontrar coincidencia en el mapa.
- [x] `window.CODIGO_CANONICO` (NEW, en `js/aerodromos.js`): alias de
      local/OACI/IATA → código canónico, para los 928 códigos del
      dataset. `calcularFrecuenciaAerodromos`/`calcularRutasFrecuentes`
      (Totales) y `ciudadDeAerodromo` (Dashboard) normalizan por acá antes
      de agrupar/buscar — así un vuelo guardado como "MOR" y otro como
      "SADM" cuentan como el mismo aeródromo/ruta, sin importar con qué
      código haya quedado cada uno. Con tests.

## Hecho — tanda 26 (dataset oficial de aeródromos: local + OACI + IATA, cobertura 100%)
- [x] `js/aerodromos.js` reconstruido desde el registro oficial que pasaste
      (`aeropuertos_detalle.csv`, 693 aeródromos/helipuertos) — ahora cada
      entrada tiene sus tres códigos por separado (`local`, `icao`,
      `iata`) en vez de uno solo. Se conservan además 44 códigos OACI que
      la app ya reconocía y no están en este registro (fuente anterior),
      para no perder cobertura — total 737 aeródromos.
- [x] Autocomplete (`js/autocomplete.js`): ahora busca por CUALQUIERA de
      los tres códigos, no solo el canónico — tipeás "EZE" (local o IATA)
      o "SAEZ" (OACI) y encontrás el mismo Ezeiza. La sugerencia muestra
      los códigos alternativos entre paréntesis para confirmar que es el
      correcto. Siempre se guarda el mismo código canónico (OACI si tiene,
      si no el local) en `vuelos.desde/hasta` — así el mismo aeródromo no
      queda partido en dos según con qué código lo hayas tipeado, y no se
      rompen las estadísticas de rutas ni el mapa.
- [x] `js/coordenadas.js` reconstruido con las coordenadas del mismo
      registro oficial — **cobertura 100% (737/737)**, mejor que el 97%
      de antes. Ojo: las columnas latitud/longitud del CSV venían
      invertidas (confirmado cruzando contra el texto en grados/minutos/
      segundos de las 693 filas) — ya corregido al importar.

## Hecho — tanda 25 (fix: tocar una ruta era casi imposible)
- [x] El área tocable de una polyline de Leaflet es exactamente su grosor
      visual (2-7px según cuánto se voló) — casi imposible de acertar con
      el dedo. Ahora cada ruta son dos líneas superpuestas: la fina que se
      ve (sin interacción) y una invisible de 24px encima que es la que
      recibe el toque — la línea no se ve más gruesa, pero tolera hasta
      ~12px de error. Verificado con Playwright: clicks con offset
      perpendicular de hasta 12px abren la ficha; a partir de 15px no
      (correcto, ya no es "tocar la ruta").

## Hecho — tanda 24 (fix: ficha de ruta sin fondo)
- [x] La ficha que aparece al tocar una ruta (distancia/duración/aeronaves)
      tenía posición y tamaño pero le faltaba el `background`/blur — el
      texto quedaba flotando transparente arriba del mapa en vez de una
      tarjeta legible. `.mapa-ficha-ruta` ahora tiene su propio fondo
      glass (antes solo lo tenía la clase genérica `.mapa-panel`, que
      nunca se le había aplicado a este elemento). Confirmado con captura.

## Hecho — tanda 23 (mapa de rutas: rediseño "glass cockpit" + interactivo)
- [x] **Bug real corregido**: el mapa a veces no cargaba ("revisá tu
      conexión") por una carrera de tiempos — `renderMapaRutas()` corría
      antes de que terminara de bajar el script `defer` de Leaflet. Ahora
      reintenta cada 250ms hasta 5s antes de rendirse. De paso, CDN
      cambiado de unpkg a jsdelivr (el mismo que ya usás para xlsx/exceljs).
- [x] Rediseño visual completo siguiendo el mockup que pasaste: paneles
      translúcidos con blur ("glass panel"), marcadores con animación de
      ping + glow naranja, controles de zoom y botón de recentrar
      flotantes con el mismo estilo. Todo con los tokens reales de
      `css/styles.css` (`--brand`, `--brand-glow`, etc.) — no se metió
      Tailwind ni una paleta nueva, es la misma identidad "Avionics
      Professional" que ya tenía la app.
- [x] Etiquetas según zoom: alejado (país completo) solo se ven los 5
      aeródromos más transitados; acercando aparecen más, hasta mostrarlos
      todos. Además, si dos etiquetas quedan a menos de 34px una de otra
      (ej. dos aeródromos del mismo AMBA vistos desde lejos), se oculta la
      del menos transitado en vez de superponerse ilegibles.
- [x] Tocar una ruta (línea entre dos aeródromos) abre una ficha con datos
      reales de esa ruta: distancia en línea recta (haversine), duración
      media (promedio real de tiempo_total), cantidad de vuelos y qué
      matrículas la volaron — nada de datos de relleno.
      `calcularRutasFrecuentes` ahora también junta las matrículas y
      calcula la duración media; `distanciaKm`/`fmtDuracionHhMm` (NEW,
      con tests). Verificado con Playwright + Leaflet real (sin conexión
      a los tiles desde este entorno, pero la lógica de clicks/etiquetas
      corrió contra la librería real y dio los números esperados).

## Hecho — tanda 22 (mapa de rutas: cobertura 97%, no solo los OACI)
- [x] `js/coordenadas.js` ampliado de 162 a **831 de 857 aeródromos (97%)**.
      El dato que faltaba: OurAirports (la misma fuente ya usada para
      armar `aerodromos.js`) también publica coordenadas para los
      aeródromos de código LOCAL (no solo los OACI), vía su campo
      `local_code` — cruzando por ahí en vez de solo por ICAO se resolvió
      casi todo el dataset de una. Quedan 26 aeródromos sin coordenada
      (no aparecen en ninguna de las dos fuentes con ese código) — se
      siguen listando aparte en el mapa, sin inventarles ubicación.

## Hecho — tanda 21 (P0/P1 del análisis: papelera en schema.sql, edición inline, PDF pixel-perfect, mapa de rutas)
- [x] **P0** — `sql/agregar_papelera_vuelos.sql` (columna `deleted_at`) ya
      estaba fuera de `schema.sql`, el único archivo de migración en esa
      situación. Ahora está en el lugar cronológico que le corresponde,
      junto a las demás actualizaciones de `vuelos`.
- [x] **P1** — Edición inline en Bitácora: el ícono de lápiz abre un panel
      debajo de la fila con los datos administrativos (fecha, ruta,
      finalidad, aterrizajes, observaciones) para corregir sin salir de la
      pantalla. A propósito NO toca los tiempos de vuelo ahí (los 8
      buckets del libro ANAC) — reconstruirlos a ciegas desde un total
      podría pisar mal una carga con piloto+copiloto o local+travesía
      mixto; para eso sigue estando "Editar todo" (el formulario completo).
- [x] **P1** — PDF pixel-perfect: `ExportadorAnac.construirLibroAnualHtml`
      (NEW) reusa la MISMA plantilla (`SPEC`: celdas, merges, anchos,
      extraída del .xls oficial) y el mismo cálculo de arrastre de totales
      que el Excel, pero arma HTML dimensionado al tamaño físico real del
      papel (35,5 × 16,5 cm exactos, vía `@page`) en vez de una tabla
      genérica. Se abre en una pestaña e imprime — "Guardar como PDF" ya
      sale con las medidas correctas. Verificado visualmente (Playwright):
      arrastre de totales entre hojas correcto, tamaño de página exacto.
- [x] **P1** — Mapa de rutas (Totales, NEW): Leaflet + OpenStreetMap (CDN),
      un marcador por aeródromo volado (tamaño según frecuencia) y líneas
      entre pares de travesía, más una tabla de "rutas más voladas".
      `js/coordenadas.js` (NEW) tiene lat/lon para 162 de los ~857
      aeródromos del dataset — los que tienen código OACI, cruzados contra
      una fuente pública (mwgg/Airports, dominio público). Los que solo
      tienen código local (aeroclubes/pistas chicas, la mayoría del
      dataset) se listan aparte como "sin coordenadas" en vez de
      inventarles una ubicación.
- [x] Corregido un dato inexacto en el README ("hoy se muestra un ranking
      de rutas") — esa función no existía, era aspiracional de un análisis
      anterior; ya no hace falta la aclaración porque el mapa está hecho.

Quedan pendientes del análisis original: los códigos ANAC reales para
multimotor/reactor/turbohélice/aeroaplicador (necesito que los pases vos,
no se pueden inventar) y separar `perfil.js`/`nuevoVuelo.js` en módulos si
siguen creciendo (P2, sin apuro).

## Hecho — tanda 20 (ícono de notificación en Android + layout de botones)
- [x] `icons/badge-192.png` (NEW): silueta blanca del avión de papel sobre
      fondo transparente, generada a partir de `icons/icon.svg`. Android
      solo usa el canal alfa del `badge` para armar el ícono de la barra de
      estado (el color SIEMPRE lo pinta el propio SO) — pasarle el logo a
      color entero, sin transparencia, hacía que se viera como un cuadrado
      blanco liso en vez de la forma del avión. `sw.js` ahora usa este
      archivo en el campo `badge` de `showNotification` (antes apuntaba a
      `icon-192.png`, a color). Cache bumpeado a v24.
- [x] Los 3 botones de la tarjeta de "Próximo vuelo" ("Marcar como volado" +
      recordatorios + borrar) quedaban mal en pantallas angostas: el
      `.btn-row` genérico (flex-wrap) dejaba el tercero solo en un renglón
      aparte. Ahora es un layout dedicado (`.plan-acciones`): el botón de
      texto se achica lo que haga falta y los dos íconos quedan siempre
      agrupados a la derecha, sin wrap.

## Hecho — tanda 19 (recordatorios personalizados, uno o varios por evento)
- [x] `js/recordatorios.js` (NEW): modal reutilizable (`RecordatoriosUI.abrir`)
      para agregar/borrar recordatorios de un vuelo programado o un
      vencimiento puntual — "X días antes", "X horas antes" o una fecha y
      hora específica, tantos como quieras por evento. Se usa desde tres
      lugares: la tarjeta de "Próximo vuelo" (Dashboard), la fila de
      Alertas (Perfil) y la lista centralizada de Perfil → Notificaciones.
- [x] Al agendar un vuelo nuevo, la app pregunta "¿Deseás crear
      notificaciones para este vuelo?" y si decís que sí abre el modal ya
      apuntando a ese vuelo. Mismo flujo al agregar un vencimiento.
- [x] "Hora de finalización" (opcional) en Vuelo programado: si se carga,
      se crea sola un recordatorio para el otro día a las 9 con el
      recordatorio de cargar los datos reales del vuelo — se recrea sola
      si se edita la hora, se borra si se saca.
- [x] Vencimientos "rodantes" (currency: "vencés si no volás cada N días"):
      tildando "Se resetea si volás" en Alertas, `fecha_vencimiento` deja
      de ser fija — un trigger en Postgres la recalcula sola cada vez que
      cargás/editás/borrás un vuelo, como fecha del último vuelo +
      intervalo (nunca retrocede). Ej: ventana de 30 días, volás al día 24
      → el vencimiento se corre a "ese vuelo + 30" de nuevo.
- [x] Edge Function reescrita: procesa los recordatorios personalizados de
      cada evento (con `ultimo_aviso_clave` para no repetir el mismo aviso
      dos veces, pero volver a habilitarse solo si el evento se corre — vuelo
      reprogramado o vencimiento rodante reseteado) y sigue usando el aviso
      general (toggles + horas de anticipación) como respaldo para los
      eventos que no tengan ningún recordatorio propio — no rompe lo que ya
      andaba.
- [x] `sql/agregar_recordatorios_personalizados.sql` (+ incluido en
      `schema.sql`): tabla `recordatorios`, columnas nuevas en
      `vencimientos` (`rodante`, `intervalo_dias`) y `vuelos_programados`
      (`hora_finalizacion`), triggers de recálculo, RLS.
- [x] `README.md` sección 8.1 (nueva): los 2 pasos que faltan si ya tenías
      las notificaciones simples andando (correr el SQL nuevo, redesplegar
      la función).

## Hecho — tanda 18 (notificaciones push: Vencimientos y Vuelos programados)
- [x] Pestaña nueva **Notificaciones** en Perfil (`js/views/perfil.js`):
      activar/desactivar por dispositivo, toggles de "Vencimientos" y
      "Vuelos programados", horas de anticipación configurables, botón de
      prueba y estados claros para no soportado / permiso bloqueado / falta
      configurar el servidor.
- [x] `js/notificaciones.js` (NEW): pide permiso SIEMPRE desde el click del
      usuario (nunca al cargar la página), suscribe con `pushManager` y
      convierte la VAPID public key de base64url a `Uint8Array` a mano
      (`urlBase64ToUint8Array` — si no, `subscribe()` tira `InvalidAccessError`
      o falla en silencio). Probado en `tests/notificaciones.test.js`.
- [x] `sw.js`: handlers de `push` (muestra la notificación) y
      `notificationclick` (foco a la pestaña abierta o abre una nueva).
      Cache bumpeado a v21.
- [x] `supabase/functions/notificaciones-push` (NEW, Deno + `web-push`):
      modo `test` (identifica al usuario por su JWT, ignora sus
      preferencias) y modo `cron` (autenticado con un `CRON_SECRET` propio,
      NO la service_role key en texto plano; barre todos los usuarios,
      manda vencimientos en estado warn/danger no avisados hoy y vuelos
      programados dentro de la ventana de horas configurada, y borra
      suscripciones que el navegador ya descartó (404/410)).
- [x] `sql/agregar_notificaciones_push.sql` (+ incluido en `schema.sql`):
      tablas `push_subscriptions` (conflicto por `endpoint`, no por
      `user_id` — soporta varios dispositivos por usuario) y
      `notif_config`, columnas de control `vencimientos.ultimo_aviso` /
      `vuelos_programados.aviso_enviado` para no repetir el mismo aviso,
      RLS en las dos tablas nuevas, y bloque comentado para programar el
      cron por hora con `pg_cron` + `pg_net`.
- [x] `README.md` sección 8 (nueva): guía paso a paso completa para dejar
      esto funcionando (generar VAPID, desplegar la función, secretos,
      correr el SQL, programar el cron) — es 100% opcional, sin este paso
      la app sigue andando igual, solo que la pestaña avisa qué falta.

## Hecho — tanda 17 (ajustes al carrusel de "Próximo vuelo")
- [x] Tarjetas centradas en el carrusel: `scroll-snap-align: center` +
      padding lateral proporcional (`6%`) en `.plan-carrusel`, así cada
      tarjeta "asoma" simétrico a izquierda y derecha en vez de pegarse
      contra el borde izquierdo como antes (`scroll-snap-align: start`).
- [x] Indicadores (`.plan-indicadores`) centrados y con el mismo ancho que
      la tarjeta (88% / 380px en desktop), para que queden alineados
      justo arriba del carrusel en vez de ocupar todo el ancho del card
      contenedor.
- [x] Orden de las secciones dentro de la tarjeta: "Aeronave" (matrícula,
      ruta, etiquetas, notas) ahora va antes de METAR/TAF, no después.
      Los botones de acción ("Marcar como volado" / borrar) se separaron
      en su propia sección al final, para que sigan siendo lo último de
      la tarjeta sin importar si hay METAR/TAF o no.

## Hecho — tanda 16 (carrusel horizontal para varios vuelos agendados)
- [x] Si hay más de un vuelo agendado, ya no se apilan verticalmente — van en
      un carrusel horizontal con scroll-snap nativo (sin librerías): deslizás
      y cada tarjeta encaja de a una, como una historia de Instagram.
- [x] Indicadores finitos arriba (uno por tarjeta) que muestran en cuál
      estás — se prende solo con `IntersectionObserver`, sin timer/auto-
      avance. Tocar un indicador salta directo a esa tarjeta.
      Con un solo vuelo agendado no se muestran (no hace falta indicar nada).

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
- [ ] **Hoja ANAC**: el rango de fechas YA se puede elegir (filtros
      Desde/Hasta de Exportar, se aplican a las 4 opciones de export) —
      lo que falta, si hiciera falta más, es un selector de año directo
      en vez de tener que poner las dos fechas a mano.
- [ ] **Backfill** de `costo_congelado` en vuelos viejos en USD (no hay cómo
      saber la cotización histórica exacta; quedaría estimado).
- [ ] Migrar el resto de `onclick` inline (bitácora, vencimientos) a
      delegación, por prolijidad (hoy solo interpolan UUIDs, sin riesgo).
