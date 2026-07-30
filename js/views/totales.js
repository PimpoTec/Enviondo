// ============================================================================
// VISTA: TOTALES Y DISCRIMINACIONES
// Las discriminaciones se muestran aparte y NO se suman al total general.
// ============================================================================

// Agrupa los requisitos de un curso "grande" (con varios frentes, ej.
// PCA+HVI) en dos bloques temáticos en vez de mostrar el nombre del curso
// como título — así se lee como progreso hacia la licencia, no como una
// lista de configuración. Un curso puntual (ej. HAB_NOC, un solo
// requisito) sigue mostrando su propio nombre como título.
const GRUPO_EXPERIENCIA = ['pic', 'travesia_pic', 'aterrizajes_noche', 'remolques'];
const GRUPO_INSTRUMENTAL = ['total', 'instrumentos', 'instrumentos_sim', 'nocturnas'];

// Un mismo aeródromo puede estar guardado en vuelos.desde/hasta con
// cualquiera de sus tres códigos (local, OACI o IATA) — depende de cómo
// se haya tipeado esa vez, incluso de antes de que la app distinguiera
// los tres. Sin normalizar, "MOR" y "SADM" (Morón local/OACI) contarían
// como dos aeródromos distintos y partirían las estadísticas al medio.
// window.CODIGO_CANONICO (js/aerodromos.js) resuelve cualquiera de los
// tres al código canónico; si no lo reconoce, se usa tal cual vino.
// "TERR" es el marcador de turno de adiestrador/simulador (no es un
// aeródromo real, ver nuevoVuelo.js _guardarAdiestrador) — no cuenta para
// nada de esto, por eso devuelve null en vez de "normalizarlo".
function normalizarCodigoAerodromo(code) {
  if (!code || code === 'TERR') return null;
  return (window.CODIGO_CANONICO && window.CODIGO_CANONICO[code]) || code;
}

// Cuántas veces aparece cada aeródromo (como origen o destino) en la
// bitácora. Pura, sin DOM — la usa tanto el mapa como para decidir el
// tamaño de cada marcador.
function calcularFrecuenciaAerodromos(vuelos) {
  const map = {};
  for (const v of vuelos) {
    for (const code of new Set([normalizarCodigoAerodromo(v.desde), normalizarCodigoAerodromo(v.hasta)])) {
      if (!code) continue;
      map[code] = (map[code] || 0) + 1;
    }
  }
  return map;
}

// Rutas más voladas — A-B y B-A cuentan como la misma ruta (no importa la
// dirección del vuelo para el ranking). Ordenadas de más a menos frecuente.
// Incluye las matrículas que hicieron esa ruta (para la ficha del mapa al
// tocarla) y la duración media (promedio de tiempo_total de esos vuelos).
function calcularRutasFrecuentes(vuelos) {
  const map = {};
  for (const v of vuelos) {
    if (!v.desde || !v.hasta) continue;
    const desde = normalizarCodigoAerodromo(v.desde);
    const hasta = normalizarCodigoAerodromo(v.hasta);
    if (!desde || !hasta) continue; // TERR (turno de adiestrador/simulador)
    const key = [desde, hasta].sort().join('|');
    if (!map[key]) map[key] = { desde, hasta, count: 0, horas: 0, matriculas: new Set() };
    map[key].count++;
    map[key].horas = Calc.round2(map[key].horas + Calc.n(v.tiempo_total));
    if (v.aeronaves?.matricula) map[key].matriculas.add(v.aeronaves.matricula);
  }
  return Object.values(map)
    .map((r) => ({ ...r, matriculas: [...r.matriculas], duracionMedia: Calc.round2(r.horas / r.count) }))
    .sort((a, b) => b.count - a.count);
}

// distanciaNm vive en js/calc.js (la usan también Bitácora y Dashboard).

// "1.75" (hs.décimos) → "01:45", para mostrar la duración media como
// horas:minutos, más legible que el decimal en la ficha del mapa.
function fmtDuracionHhMm(horasDecimal) {
  const totalMin = Math.round(horasDecimal * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const ViewTotales = {
  async render() {
    const main = document.getElementById('main-content');
    const [vuelos, cursosActivos] = await Promise.all([Repo.listarVuelos(), Repo.getCursosActivos()]);
    const agg = agregarVuelos(vuelos);
    const rutas = calcularRutasFrecuentes(vuelos);

    let hviSimHoras = null;
    if (cursosActivos.includes('PCA_HVI')) hviSimHoras = await Repo.getHviSimHoras();

    const configsPorCurso = await Promise.all(cursosActivos.map(async (cursoId) => {
      let config = await Repo.listarConfigLicencia(cursoId);
      if (cursoId === 'PCA_HVI' && hviSimHoras !== null && hviSimHoras !== undefined) {
        config = config.filter((c) => c.nombre_requisito !== 'instrumentos').concat([
          { nombre_requisito: 'instrumentos', minimo_horas: Calc.round2(40 - hviSimHoras) },
          { nombre_requisito: 'instrumentos_sim', minimo_horas: hviSimHoras },
        ]);
      }
      return { cursoId, curso: CURSOS.find((c) => c.id === cursoId), config };
    }));

    const horasMes = calcularHorasEsteMes(vuelos);
    const porAeronave = calcularHorasPorAeronave(vuelos);

    main.innerHTML = `
      <div class="card resumen-general">
        <p class="resumen-general-label">${Icons.clock(14)} Tiempo total de vuelo</p>
        <p class="resumen-general-valor"><span id="resumen-horas">0</span><span class="resumen-general-unidad">horas</span></p>
        ${horasMes > 0 ? `<p class="resumen-general-mes">+${horasMes} hs este mes</p>` : ''}
      </div>

      <div class="grid cols-2">
        <div class="card stat-mini">
          <p class="stat-mini-label">${Icons.list(14)} Vuelos</p>
          <p class="stat-mini-valor">${vuelos.length}</p>
          <p class="muted" style="margin:0">Operaciones totales</p>
        </div>
        <div class="card stat-mini">
          <p class="stat-mini-label">${Icons.plane(14)} Aeronaves</p>
          <p class="stat-mini-valor">${porAeronave.length}</p>
          <p class="muted" style="margin:0">Voladas hasta hoy</p>
        </div>
      </div>

      ${porAeronave.length ? `
      <div class="card">
        <h2>${Icons.plane(18)} Horas por aeronave</h2>
        <div class="aeronave-horas-lista">
          ${porAeronave.map((a) => `
            <div class="aeronave-horas-item">
              <span>${a.matricula}${a.modelo ? ` <span class="muted">${a.modelo}</span>` : ''}</span>
              <span class="aeronave-horas-valor">${a.horas} hs</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="card">
        <h2>${Icons.award(18)} Progreso de licencia</h2>
        <div id="detalle-progreso-licencia"></div>
      </div>

      <div class="card">
        <h2>${Icons.barChart(18)} Totales acumulados</h2>
        <div class="grid cols-4">
          ${stat('PIC', agg.total_pic, ' hs', 'PIC = Piloto al mando')}
          ${stat('Copiloto', agg.total_copiloto)}
          ${stat('Día', agg.total_dia)}
          ${stat('Noche', agg.total_noche)}
          ${stat('Travesía', agg.total_travesia)}
          ${stat('Travesía PIC', agg.travesia_pic, ' hs', 'Vuelos de travesía (no locales) donde fuiste piloto al mando')}
        </div>
      </div>

      <div class="card">
        <h2>${Icons.landing(18)} Aterrizajes y remolques</h2>
        <div class="grid cols-4">
          ${stat('Día', agg.aterrizajes_dia, '')}
          ${stat('Noche', agg.aterrizajes_noche, '')}
          ${stat('Total aterrizajes', agg.aterrizajes_dia + agg.aterrizajes_noche, '')}
          ${stat('Remolques', agg.remolques, '')}
        </div>
      </div>

      ${vuelos.length ? `
      <div class="card" style="padding:16px 16px 12px">
        <h2>${Icons.mapPin(18)} Mapa de rutas</h2>
        <div class="mapa-wrap" id="mapa-wrap">
          <div id="mapa-rutas" style="width:100%;height:100%"></div>
          <div class="mapa-ficha-ruta" id="mapa-ficha-ruta"></div>
        </div>
        <p class="muted" id="mapa-rutas-nota" style="margin:8px 0 0"></p>
      </div>

      <div class="card">
        <h2>${Icons.barChart(18)} Rutas más voladas</h2>
        <div class="table-wrap"><table>
          <thead><tr><th>Ruta</th><th class="num">Vuelos</th><th class="num">Horas</th></tr></thead>
          <tbody>
            ${rutas.slice(0, 15).map((r) => `<tr><td>${r.desde}${r.desde === r.hasta ? '' : ' ↔ ' + r.hasta}</td><td class="num">${r.count}</td><td class="num">${r.horas}</td></tr>`).join('')}
          </tbody>
        </table></div>
      </div>` : ''}
    `;

    const resumenHoras = document.getElementById('resumen-horas');
    if (resumenHoras && typeof animarNumero === 'function') animarNumero(resumenHoras, agg.tiempo_total);

    try { renderDetalleProgreso(configsPorCurso, agg); } catch (err) { console.error('Error renderizando progreso de licencia:', err); }
    if (vuelos.length) { try { renderMapaRutas(vuelos); } catch (err) { console.error('Error renderizando el mapa de rutas:', err); } }
    animarStats(main);
  },
};

// Suma de horas de vuelos con fecha dentro del mes calendario actual —
// mismo criterio simple que "Últimos 90 días" en otras pantallas, pero
// acotado al mes en curso (no una ventana móvil de N días).
function calcularHorasEsteMes(vuelos) {
  const hoy = new Date();
  const total = vuelos.reduce((s, v) => {
    const f = Calc.parseFechaLocal(v.fecha);
    if (!f || f.getFullYear() !== hoy.getFullYear() || f.getMonth() !== hoy.getMonth()) return s;
    return s + Calc.n(v.tiempo_total);
  }, 0);
  return Calc.round2(total);
}

// Horas totales voladas en cada aeronave (por matrícula), de mayor a menor.
function calcularHorasPorAeronave(vuelos) {
  const map = {};
  for (const v of vuelos) {
    const key = v.aeronaves?.matricula || 'Sin aeronave asignada';
    if (!map[key]) map[key] = { matricula: key, modelo: v.aeronaves?.marca_modelo || '', horas: 0 };
    map[key].horas = Calc.round2(map[key].horas + Calc.n(v.tiempo_total));
  }
  return Object.values(map).sort((a, b) => b.horas - a.horas);
}

function calcularItemsRequisito(cursoId, config, agg, configsPorCurso) {
  const items = config.map((req) => {
    const actual = req.nombre_requisito === 'nocturnas'
      ? valorNocturnasAjustado(cursoId, agg, configsPorCurso)
      : valorRequisito(req.nombre_requisito, agg);
    const minimo = Calc.n(req.minimo_horas);
    const pct = minimo > 0 ? Math.min(100, Calc.round2((actual / minimo) * 100)) : 0;
    const faltan = Math.max(0, Calc.round2(minimo - actual));
    const esUnidad = req.nombre_requisito === 'aterrizajes_noche' || req.nombre_requisito === 'remolques';
    return { req, actual, minimo, pct, faltan, esUnidad };
  });
  // Mayor % completado primero; entre los que ya están al 100%, el que
  // tiene más horas/unidades voladas (cantidad) va primero.
  items.sort((a, b) => b.pct - a.pct || (b.pct === 100 ? b.actual - a.actual : 0));
  return items;
}

// Antes iba todo en una sola línea de texto corrido ("184.5 hs / 200 hs —
// faltan 15.5 hs"), que en un renglón angosto de celular se cortaba mal y
// costaba leer de un vistazo cuánto llevás y cuánto falta. Ahora son 3
// piezas separadas: el nombre + una etiqueta de estado bien visible
// (Completo / Faltan X hs), y aparte, en grande, "llevado de meta".
// LABELS_REQUISITO vive en js/db.js (se carga antes que cualquier vista).
function htmlItemsRequisito(items) {
  return items.map(({ req, actual, minimo, pct, faltan, esUnidad }) => {
    const unidad = esUnidad ? '' : ' hs';
    return `
    <div class="progreso-item">
      <div class="pi-head">
        <span class="nombre">${LABELS_REQUISITO[req.nombre_requisito] || req.nombre_requisito}</span>
        ${faltan <= 0
          ? '<span class="badge ok">Completo</span>'
          : `<span class="badge neutral">Faltan ${faltan}${unidad}</span>`}
      </div>
      <p class="pi-cifras"><span class="pi-actual">${actual}${unidad}</span><span class="pi-de">de ${minimo}${unidad}</span></p>
      <div class="progreso-bar ${faltan <= 0 ? 'completo' : ''}"><span style="width:${pct}%"></span></div>
    </div>`;
  }).join('');
}

function renderDetalleProgreso(configsPorCurso, agg) {
  const cont = document.getElementById('detalle-progreso-licencia');
  const conRequisitos = configsPorCurso.filter(({ config }) => config.length);
  if (!conRequisitos.length) { cont.innerHTML = '<p class="muted">Sin requisitos configurados para los cursos activos todavía — elegí un curso en Perfil.</p>'; return; }

  cont.innerHTML = conRequisitos.map(({ cursoId, curso, config }) => {
    const experiencia = config.filter((r) => GRUPO_EXPERIENCIA.includes(r.nombre_requisito));
    const instrumental = config.filter((r) => GRUPO_INSTRUMENTAL.includes(r.nombre_requisito));
    const esCursoGrande = experiencia.length && instrumental.length;

    if (!esCursoGrande) {
      const items = calcularItemsRequisito(cursoId, config, agg, configsPorCurso);
      return `<h3 style="margin-top:14px">${curso?.label || cursoId}</h3>${htmlItemsRequisito(items)}`;
    }

    return `
      <h3 style="margin-top:14px">Experiencia de vuelo</h3>
      ${htmlItemsRequisito(calcularItemsRequisito(cursoId, experiencia, agg, configsPorCurso))}
      <h3 style="margin-top:14px">Instrumental y nocturno</h3>
      ${htmlItemsRequisito(calcularItemsRequisito(cursoId, instrumental, agg, configsPorCurso))}
    `;
  }).join('');
}

function stat(label, valor, sufijo = ' hs', title = '') {
  const v = valor ?? 0;
  // data-valor/data-sufijo: el número arranca en 0 y sube animado (ver
  // animarStats, llamado al final de render()) — más "vivo" que aparecer
  // de golpe. Si por lo que sea no corre el JS, igual queda el valor real
  // (rehidratado en el próximo render), nunca queda pegado en 0.
  return `<div class="stat"><div class="num" data-valor="${v}" data-sufijo="${sufijo}">0${sufijo}</div><div class="lbl"${title ? ` title="${title}"` : ''}>${label}</div></div>`;
}

function animarStats(root) {
  if (typeof animarNumero !== 'function') return;
  root.querySelectorAll('.stat .num[data-valor]').forEach((el) => {
    animarNumero(el, Number(el.dataset.valor), { sufijo: el.dataset.sufijo || '' });
  });
}

// Mapa "glass cockpit" (Leaflet + OpenStreetMap): marcador por aeródromo
// volado (tamaño según frecuencia), etiquetas que aparecen según el zoom
// (alejado = solo los más transitados, para no amontonar texto) y líneas
// de ruta que al tocarlas muestran una ficha con distancia, duración media
// y qué aeronaves la volaron. Cubre 831 de los ~857 aeródromos del
// dataset (ver js/coordenadas.js) — los que quedan sin coordenada se
// listan aparte en vez de dibujar una ubicación inventada.
//
// El script de Leaflet se carga `defer` desde un CDN — si esta función
// corre ANTES de que termine de bajar (ej. primera carga en una conexión
// lenta), `L` todavía no existe. En vez de rendirse al toque, reintenta
// cada 250ms durante 5s — cubre la carrera sin bloquear nada si carga rápido.
function renderMapaRutas(vuelos, intentos = 0) {
  const cont = document.getElementById('mapa-rutas');
  if (!cont) return; // se navegó fuera de Totales mientras tanto
  if (typeof L === 'undefined') {
    if (intentos < 20) { setTimeout(() => renderMapaRutas(vuelos, intentos + 1), 250); return; }
    cont.innerHTML = '<p class="muted" style="padding:12px;margin:0">No se pudo cargar el mapa (revisá tu conexión).</p>';
    return;
  }

  const nota = document.getElementById('mapa-rutas-nota');
  const frecuencia = calcularFrecuenciaAerodromos(vuelos);
  const codigos = Object.keys(frecuencia);
  const coordenadas = window.COORDENADAS_AERODROMO || {};
  const conCoords = codigos.filter((c) => coordenadas[c]);
  const sinCoords = codigos.filter((c) => !coordenadas[c]);

  if (!conCoords.length) {
    cont.innerHTML = '<p class="muted" style="padding:12px;margin:0">Ninguno de tus aeródromos volados tiene código OACI reconocido todavía — el mapa no tiene nada para mostrar.</p>';
    return;
  }

  const map = L.map(cont, { scrollWheelZoom: false, zoomControl: false, attributionControl: false }).setView([-38.5, -63.5], 4);
  // Tiles oscuros de verdad (CartoDB Dark Matter) en vez de filtrar con CSS
  // el mapa clarito de OpenStreetMap — antes quedaba grisáceo/lavado, esto
  // es un basemap pensado para tema oscuro desde el vamos.
  const tilesOscuros = temaActual() !== 'light';
  const tileUrl = tilesOscuros
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  L.tileLayer(tileUrl, { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
  L.control.attribution({ prefix: false, position: 'bottomleft' }).addAttribution('© OpenStreetMap © CARTO').addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Botón "recentrar" propio (equivalente al "mi ubicación" del mockup,
  // pero acá no hay GPS: vuelve a encuadrar todos los aeródromos volados).
  const BotonRecentrar = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const btn = L.DomUtil.create('div', 'mapa-btn-recentrar mapa-panel');
      btn.innerHTML = Icons.mapPin(16);
      L.DomEvent.on(btn, 'click', (e) => { L.DomEvent.stop(e); encuadrarTodo(); });
      return btn;
    },
  });
  map.addControl(new BotonRecentrar());

  const ficha = document.getElementById('mapa-ficha-ruta');
  const rutas = calcularRutasFrecuentes(vuelos);

  // Líneas primero (van debajo de los marcadores). El área tocable de una
  // polyline es exactamente su grosor visual — con 2-7px es casi
  // imposible acertarle a mano. Por eso cada ruta son en realidad DOS
  // líneas superpuestas: la fina que se ve, y una invisible mucho más
  // ancha (24px) encima que es la que realmente recibe el click/touch —
  // truco estándar de Leaflet para no tener que engordar visualmente la
  // línea solo para que se pueda tocar.
  rutas.forEach((r) => {
    if (r.desde === r.hasta) return;
    const a = coordenadas[r.desde], b = coordenadas[r.hasta];
    if (!a || !b) return;
    L.polyline([a, b], {
      className: 'mapa-ruta-linea', color: '#ff9f1c', weight: Math.min(2 + r.count * 0.6, 7), opacity: 0.6,
      interactive: false,
    }).addTo(map);
    const areaTactil = L.polyline([a, b], {
      className: 'mapa-ruta-linea', weight: 24, opacity: 0,
    }).addTo(map);
    areaTactil.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      mostrarFichaRuta(ficha, r, distanciaNm(a[0], a[1], b[0], b[1]));
    });
  });

  const maxFrec = Math.max(...conCoords.map((c) => frecuencia[c]));
  const marcadores = {};
  const bounds = [];
  conCoords.forEach((c) => {
    const punto = coordenadas[c];
    bounds.push(punto);
    const radio = 4 + (frecuencia[c] / maxFrec) * 10;
    const aero = (window.AERODROMOS || []).find((a) => a.code === c);
    const icono = L.divIcon({
      className: '', html: `<div class="mapa-marcador-ping" style="width:${radio * 2.4}px;height:${radio * 2.4}px;margin:${-radio * 1.2}px 0 0 ${-radio * 1.2}px"></div><div class="mapa-marcador-punto" style="width:${radio * 2}px;height:${radio * 2}px;margin:${-radio}px 0 0 ${-radio}px"></div>`,
      iconSize: [0, 0],
    });
    const marker = L.marker(punto, { icon: icono })
      .addTo(map)
      .bindTooltip(c, { permanent: true, direction: 'top', offset: [0, -radio - 2], className: 'mapa-etiqueta' })
      .bindPopup(`<strong>${c}</strong>${aero ? ' — ' + aero.nombre : ''}<br>${frecuencia[c]} vuelo(s)`);
    marcadores[c] = marker;
  });

  // Alejado: solo se ven las etiquetas de los aeródromos más transitados
  // (si no, a nivel país queda todo tapado de texto). Al acercar zoom,
  // aparecen más — a partir de cierto nivel, todas. Además de la cantidad
  // por zoom, se descarta una etiqueta si cae a menos de DIST_MIN_PX de
  // otra ya aceptada (ej. dos aeródromos del mismo AMBA se pisan cuando el
  // mapa está encuadrado para mostrar todo el país) — siempre gana el más
  // transitado de los dos, nunca el que salió primero en el objeto.
  const DIST_MIN_PX = 34;
  const ordenPorFrecuencia = [...conCoords].sort((a, b) => frecuencia[b] - frecuencia[a]);
  function actualizarEtiquetas() {
    const zoom = map.getZoom();
    const topN = zoom <= 5 ? 5 : zoom <= 7 ? 15 : Infinity;
    const candidatos = ordenPorFrecuencia.slice(0, topN);
    const aceptados = new Set();
    const puntosAceptados = [];
    candidatos.forEach((c) => {
      const punto = map.latLngToContainerPoint(marcadores[c].getLatLng());
      const choca = puntosAceptados.some((p) => Math.hypot(p.x - punto.x, p.y - punto.y) < DIST_MIN_PX);
      if (!choca) { aceptados.add(c); puntosAceptados.push(punto); }
    });
    Object.entries(marcadores).forEach(([c, marker]) => {
      if (aceptados.has(c)) marker.openTooltip(); else marker.closeTooltip();
    });
  }
  map.on('zoomend', actualizarEtiquetas);
  map.on('click', () => ficha.classList.remove('visible'));

  function encuadrarTodo() {
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    else map.setView(bounds[0], 9);
  }
  encuadrarTodo();
  actualizarEtiquetas();

  nota.textContent = sinCoords.length
    ? `${sinCoords.length} aeródromo(s) con código local (sin OACI reconocido) no se muestran en el mapa: ${sinCoords.join(', ')}.`
    : '';
}

// Ficha flotante con los datos REALES de la ruta tocada — nada de datos de
// relleno: distancia en línea recta (haversine), duración media (promedio
// de tiempo_total de esos vuelos) y qué matrículas la volaron.
function mostrarFichaRuta(ficha, ruta, distancia) {
  ficha.innerHTML = `
    <div class="mapa-ficha-ruta-head">
      <h4>${ruta.desde} ${ruta.desde === ruta.hasta ? '' : '↔ ' + ruta.hasta}</h4>
      <button aria-label="Cerrar">${Icons.xCircle(16)}</button>
    </div>
    <div class="mapa-ficha-stats">
      <div><span class="lbl">Distancia</span><span class="val">${distancia}<span class="unidad">nm</span></span></div>
      <div><span class="lbl">Duración media</span><span class="val">${fmtDuracionHhMm(ruta.duracionMedia)}<span class="unidad">hs</span></span></div>
      <div><span class="lbl">Vuelos</span><span class="val">${ruta.count}</span></div>
    </div>
    <div class="mapa-ficha-aeronaves">
      ${ruta.matriculas.length ? `Aeronaves: ${ruta.matriculas.join(', ')}` : 'Sin aeronave registrada en estos vuelos.'}
    </div>
  `;
  ficha.classList.add('visible');
  ficha.querySelector('button').onclick = () => ficha.classList.remove('visible');
}

window.ViewTotales = ViewTotales;
