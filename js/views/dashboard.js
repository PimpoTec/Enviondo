// ============================================================================
// VISTA: DASHBOARD — despejado a lo esencial: 1) total de horas + progreso
// de licencia (hero), 2) botón nuevo vuelo, 3) próximo vuelo agendado (con
// METAR real del aeródromo de origen). El resto (detalle de progreso,
// vencimientos, últimos vuelos, costos) vive en Perfil, un tap más allá.
// ============================================================================

const ViewDashboard = {
  aeronaves: [],

  async render() {
    const main = document.getElementById('main-content');
    const [vuelos, cursosActivos, programados, aeronaves] = await Promise.all([
      Repo.listarVuelos(), Repo.getCursosActivos(),
      Repo.listarVuelosProgramados(), Repo.listarAeronaves(),
    ]);
    this.aeronaves = aeronaves;
    const agg = agregarVuelos(vuelos);

    const configsPorCurso = await Promise.all(cursosActivos.map(async (cursoId) => {
      let config = await Repo.listarConfigLicencia(cursoId);
      if (cursoId === 'PCA_HVI') {
        const simHoras = await Repo.getHviSimHoras();
        if (simHoras !== null && simHoras !== undefined) {
          config = config.filter((c) => c.nombre_requisito !== 'instrumentos').concat([
            { nombre_requisito: 'instrumentos', minimo_horas: Calc.round2(40 - simHoras) },
            { nombre_requisito: 'instrumentos_sim', minimo_horas: simHoras },
          ]);
        }
      }
      return { cursoId, curso: CURSOS.find((c) => c.id === cursoId), config };
    }));

    main.innerHTML = `
      <div class="card">
        <h2>${Icons.clock(18)} Total de horas y progreso de licencia</h2>
        <div class="hero-hours">
          <div class="ring-wrap">
            <svg width="168" height="168" viewBox="0 0 168 168">
              <circle class="ring-track" cx="84" cy="84" r="64" fill="none" stroke-width="9"></circle>
              <circle id="ring-fill" class="ring-fill" cx="84" cy="84" r="64" fill="none" stroke-width="9"
                stroke-linecap="round" stroke-dasharray="402" stroke-dashoffset="402"></circle>
            </svg>
            <div class="ring-label">
              <span class="kpi">${agg.tiempo_total}</span>
              <span class="kpi-unit">Horas${agg.adiestrador_simulador > 0 ? ` · ${agg.adiestrador_simulador} sim.` : ''}</span>
            </div>
          </div>
          <div style="flex:1;min-width:220px">
            <p class="muted" style="margin:0 0 2px">Progreso licencia</p>
            <p style="margin:0 0 12px;font-size:18px;font-weight:600">${cursosActivos.map((id) => id.replace('_', ' ')).join(' + ')}</p>
            <div id="hero-cursos-lista" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px"></div>
            <div class="progreso-bar"><span id="hero-bar" style="width:0%"></span></div>
            <p class="muted" id="hero-pct" style="margin:6px 0 0"></p>
          </div>
        </div>
      </div>

      <button class="btn" style="width:100%;padding:16px;gap:10px;margin-bottom:16px" onclick="Router.irA('nuevo-vuelo')">
        <span>Nuevo vuelo</span>${Icons.plusCircle(18)}
      </button>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="margin:0">${Icons.calendar(18)} Próximo vuelo</h2>
          <button class="btn ghost" id="btn-mostrar-form-programado">Programar vuelo</button>
        </div>
        <div id="form-programado" style="display:none;margin-bottom:14px"></div>
        <div id="proximo-vuelo"></div>
      </div>
    `;

    document.getElementById('btn-mostrar-form-programado').onclick = () => this._toggleFormProgramado();

    try { renderHeroProgreso(configsPorCurso, agg); } catch (err) { console.error('Error renderizando progreso del dashboard:', err); }
    try { this._renderProximoVuelo(programados); } catch (err) { console.error('Error renderizando próximo vuelo:', err); }
  },

  _renderProximoVuelo(programados) {
    const cont = document.getElementById('proximo-vuelo');
    if (!programados.length) {
      cont.innerHTML = `<p class="muted">No tenés vuelos agendados. Usá "Programar vuelo" para cargar el próximo.</p>`;
      return;
    }
    const vista = programados.slice(0, 3);
    this._programadosVista = vista;
    const tarjetas = vista.map((p, i) => {
      const [anio, mes, dia] = p.fecha.split('-');
      const fechaGrande = `${dia} ${MESES_CORTOS[Number(mes) - 1]}`;
      const metarId = `metar-${i}`;
      const tafId = `taf-${i}`;

      const fechaLocal = Calc.parseFechaLocal(p.fecha);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const diasFaltan = fechaLocal ? Math.round((fechaLocal - hoy) / 86400000) : null;
      const cuenta = diasFaltan === null ? '' : diasFaltan <= 0 ? 'Hoy' : diasFaltan === 1 ? 'Mañana' : `En ${diasFaltan} días`;
      const diaSemana = fechaLocal ? DIAS_SEMANA[fechaLocal.getDay()] : '';
      const esLocal = p.desde && p.hasta && p.desde === p.hasta;
      const prefLabel = obtenerPrefHorario() === 'local' ? 'hora local' : 'UTC';
      const matricula = p.aeronaves?.matricula || 'Sin asignar';
      const modelo = p.aeronaves?.marca_modelo || '';
      const ciudadDesde = ciudadDeAerodromo(p.desde);
      const ciudadHasta = ciudadDeAerodromo(p.hasta);

      // Etiquetas informativas: el tipo elegido al agendar (si lo eligió),
      // "Travesía" si no es local y no quedó ya cubierto por el tipo, y si
      // hay instructor asignado. Nada inventado — solo lo que la app sabe.
      const badges = [];
      if (p.tipo_vuelo) badges.push(labelTipoVueloProgramado(p.tipo_vuelo));
      if (p.desde && p.hasta && !esLocal && p.tipo_vuelo !== 'navegacion') badges.push('Travesía');
      if (p.instructor_nombre) badges.push('Con instructor');

      return `
        <div class="plan-card" data-idx="${i}">
          <div class="plan-seccion">
            <div class="plan-head-row">
              <div>
                <p class="plan-label">Fecha programada</p>
                <p class="plan-fecha-grande">${fechaGrande}${diaSemana ? ` <span class="muted" style="font-size:13px;font-weight:500">· ${diaSemana}</span>` : ''}</p>
                ${p.hora_prevista ? `<p class="plan-hora">${p.hora_prevista.slice(0, 5)} ${prefLabel}</p>` : ''}
              </div>
              ${cuenta ? `<span class="plan-countdown">${Icons.clock(13)} ${cuenta}</span>` : ''}
            </div>
          </div>

          <div class="plan-seccion">
            <div class="plan-head-row">
              <p class="plan-label">Aeronave</p>
              <button class="plan-btn-editar" data-accion="editar" data-idx="${i}">Editar plan</button>
            </div>
            <p class="plan-aeronave-grande">${matricula}${modelo ? ` <span class="modelo">(${modelo})</span>` : ''}</p>

            ${p.desde && p.hasta ? (esLocal ? `
              <div class="plan-ruta">
                <div class="plan-ruta-punto">
                  <span class="plan-ruta-codigo">${p.desde}</span>
                  <span class="plan-ruta-ciudad">${ciudadDesde || 'Vuelo local'}</span>
                </div>
              </div>` : `
              <div class="plan-ruta">
                <div class="plan-ruta-punto">
                  <span class="plan-ruta-codigo">${p.desde}</span>
                  <span class="plan-ruta-ciudad">${ciudadDesde || '—'}</span>
                </div>
                <div class="plan-ruta-linea">${Icons.plane(16)}</div>
                <div class="plan-ruta-punto derecha">
                  <span class="plan-ruta-codigo">${p.hasta}</span>
                  <span class="plan-ruta-ciudad">${ciudadHasta || '—'}</span>
                </div>
              </div>`) : ''}

            ${badges.length ? `<div class="plan-badges">${badges.map((b) => `<span class="plan-badge">${b}</span>`).join('')}</div>` : ''}

            ${p.notas ? `<p class="plan-notas">${Icons.tag('list', p.notas)}</p>` : ''}
          </div>

          ${/^[A-Z]{4}$/.test(p.desde || '') ? `
          <div class="plan-seccion">
            <p class="plan-label">METAR ${p.desde}</p>
            <p id="${metarId}" class="plan-clima">Cargando…</p>
          </div>
          <div class="plan-seccion">
            <p class="plan-label">TAF ${p.desde}</p>
            <p id="${tafId}" class="plan-clima">Cargando…</p>
          </div>` : ''}

          <div class="plan-seccion">
            <div class="btn-row plan-acciones">
              <button class="btn secondary" data-accion="volado" data-idx="${i}">Marcar como volado</button>
              <button class="btn ghost" data-accion="recordatorios" data-idx="${i}">${Icons.bell(16)}</button>
              <button class="btn ghost" data-accion="borrar" data-idx="${i}">${Icons.trash(16)}</button>
            </div>
          </div>
        </div>`;
    }).join('');

    // Varios vuelos agendados no se apilan uno debajo del otro — van en un
    // carrusel horizontal con scroll-snap nativo (deslizás y cada tarjeta
    // encaja de a una, como una historia). Los indicadores de arriba (solo
    // si hay más de uno) muestran en cuál estás.
    const indicadores = vista.length > 1
      ? `<div class="plan-indicadores" id="plan-indicadores">${vista.map((_, idx) => `<span class="plan-indicador" data-idx="${idx}"></span>`).join('')}</div>`
      : '';
    cont.innerHTML = `${indicadores}<div class="plan-carrusel" id="plan-carrusel">${tarjetas}</div>`;

    // Delegación por índice: evita interpolar campos crudos (desde/hasta,
    // notas) dentro de un atributo onclick, que rompería con comillas.
    cont.querySelectorAll('button[data-accion]').forEach((b) => {
      b.onclick = () => {
        const p = this._programadosVista[Number(b.dataset.idx)];
        if (!p) return;
        if (b.dataset.accion === 'volado') this._marcarComoVolado(p.id, p.aeronave_id, p.fecha, p.desde, p.hasta);
        else if (b.dataset.accion === 'editar') this._toggleFormProgramado(p);
        else if (b.dataset.accion === 'recordatorios') {
          RecordatoriosUI.abrir({
            eventoTipo: 'vuelo_programado',
            eventoId: p.id,
            titulo: `Vuelo del ${fmtFecha(p.fecha)}${p.desde ? ' — ' + p.desde + (p.hasta && p.hasta !== p.desde ? ' → ' + p.hasta : '') : ''}`,
          });
        } else this._borrarProgramado(p.id);
      };
    });

    if (vista.length > 1) this._bindCarruselProgramados();

    vista.forEach((p, i) => {
      if (/^[A-Z]{4}$/.test(p.desde || '')) {
        cargarMetar(p.desde, `metar-${i}`, 'metar');
        cargarMetar(p.desde, `taf-${i}`, 'taf');
      }
    });
  },

  // Prende el indicador de la tarjeta que está más a la vista mientras se
  // desliza el carrusel, y hace que tocar un indicador salte a esa tarjeta.
  _bindCarruselProgramados() {
    const carrusel = document.getElementById('plan-carrusel');
    const tarjetas = carrusel.querySelectorAll('.plan-card');
    const indicadores = document.querySelectorAll('#plan-indicadores .plan-indicador');

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = Number(entry.target.dataset.idx);
        indicadores.forEach((el, i) => el.classList.toggle('activo', i === idx));
      });
    }, { root: carrusel, threshold: 0.6 });
    tarjetas.forEach((el) => obs.observe(el));

    indicadores.forEach((el, idx) => {
      el.onclick = () => tarjetas[idx]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    });
  },

  // Mismo formulario para agendar uno nuevo o editar uno existente — si se
  // pasa `editando` (el vuelo agendado completo), precarga todos los campos
  // con lo que ya tenía y el botón guarda los cambios en vez de crear otro.
  _toggleFormProgramado(editando) {
    const cont = document.getElementById('form-programado');
    const visible = cont.style.display !== 'none';
    if (visible && !editando) { cont.style.display = 'none'; this._editandoProgramado = null; return; }

    this._editandoProgramado = editando || null;
    const p = editando || {};
    cont.innerHTML = `
      <div class="grid cols-2">
        <div class="field"><label>Fecha</label><input type="date" id="pv-fecha" value="${p.fecha || new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label>${labelHora('Hora prevista')}</label><input type="time" id="pv-hora" value="${(p.hora_prevista || '').slice(0, 5)}"></div>
        <div class="field">
          <label>Hora de finalización <span class="muted">(opcional)</span></label>
          <input type="time" id="pv-hora-fin" value="${(p.hora_finalizacion || '').slice(0, 5)}">
          <p class="muted" style="margin:4px 0 0">Si la completás, se crea solo un recordatorio para cargar los datos del vuelo al otro día.</p>
        </div>
        <div class="field"><label>Aeronave</label>
          <select id="pv-aeronave"><option value="">Sin definir</option>
            ${this.aeronaves.map((a) => `<option value="${a.id}" ${a.id === p.aeronave_id ? 'selected' : ''}>${a.matricula} — ${a.marca_modelo}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Instructor</label><input type="text" id="pv-instructor" value="${(p.instructor_nombre || '').replace(/"/g, '&quot;')}"></div>
        <div class="field"><label>Desde (OACI)</label><input type="text" id="pv-desde" maxlength="4" style="text-transform:uppercase" value="${p.desde || ''}"></div>
        <div class="field"><label>Hasta (OACI)</label><input type="text" id="pv-hasta" maxlength="4" style="text-transform:uppercase" value="${p.hasta || ''}"></div>
        <div class="field">
          <label>Tipo de vuelo <span class="muted">(opcional)</span></label>
          <select id="pv-tipo">
            <option value="">Sin especificar — usa Local/Travesía según destino</option>
            ${TIPOS_VUELO_PROGRAMADO.map(([c, label]) => `<option value="${c}" ${c === p.tipo_vuelo ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field"><label>Notas</label><input type="text" id="pv-notas" value="${(p.notas || '').replace(/"/g, '&quot;')}"></div>
      <div class="btn-row">
        <button class="btn" id="btn-guardar-programado">${editando ? 'Guardar cambios' : 'Agendar'}</button>
        ${editando ? '<button class="btn ghost" id="btn-cancelar-programado">Cancelar</button>' : ''}
      </div>
    `;
    cont.style.display = 'block';
    document.getElementById('btn-guardar-programado').onclick = () => this._guardarProgramado();
    if (editando) {
      document.getElementById('btn-cancelar-programado').onclick = () => {
        cont.style.display = 'none';
        this._editandoProgramado = null;
      };
      cont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    Autocomplete.attachAerodromo(document.getElementById('pv-desde'));
    Autocomplete.attachAerodromo(document.getElementById('pv-hasta'));
  },

  async _guardarProgramado() {
    const fecha = document.getElementById('pv-fecha').value;
    if (!fecha) { UI.toast('Elegí una fecha.', 'warn'); return; }
    const horaFin = document.getElementById('pv-hora-fin').value || null;
    const payload = {
      fecha,
      hora_prevista: document.getElementById('pv-hora').value || null,
      hora_finalizacion: horaFin,
      aeronave_id: document.getElementById('pv-aeronave').value || null,
      desde: document.getElementById('pv-desde').value.trim().toUpperCase() || null,
      hasta: document.getElementById('pv-hasta').value.trim().toUpperCase() || null,
      instructor_nombre: document.getElementById('pv-instructor').value || null,
      tipo_vuelo: document.getElementById('pv-tipo').value || null,
      notas: document.getElementById('pv-notas').value || null,
    };
    const esNuevo = !this._editandoProgramado;
    try {
      let id;
      if (this._editandoProgramado) {
        id = this._editandoProgramado.id;
        await Repo.actualizarVueloProgramado(id, payload);
        UI.toast('Vuelo agendado actualizado.', 'ok');
      } else {
        id = await Repo.crearVueloProgramado(payload);
      }
      await this._sincronizarRecordatorioCargaDatos(id, fecha, horaFin);
      this._editandoProgramado = null;
      this.render();
      if (esNuevo) {
        const crear = await UI.confirmar('¿Deseás crear notificaciones para este vuelo?', { ok: 'Sí, crear', cancel: 'No' });
        if (crear) {
          RecordatoriosUI.abrir({
            eventoTipo: 'vuelo_programado',
            eventoId: id,
            titulo: `Vuelo del ${fmtFecha(fecha)}${payload.desde ? ' — ' + payload.desde + (payload.hasta && payload.hasta !== payload.desde ? ' → ' + payload.hasta : '') : ''}`,
          });
        }
      }
    } catch (err) {
      UI.toast('Error al agendar: ' + (err.message || err), 'error');
    }
  },

  // La "hora de finalización" arma sola un recordatorio de tipo
  // auto_cargar_datos para el otro día a las 9 (elegido así porque avisar
  // apenas termina el vuelo suele agarrar al piloto todavía en el aeródromo,
  // sin ganas de cargar datos en el celu). Si se saca la hora de fin, se
  // borra el recordatorio automático; si se vuelve a cargar, se recrea con
  // la fecha nueva — nunca queda uno viejo colgado.
  async _sincronizarRecordatorioCargaDatos(vueloProgramadoId, fecha, horaFin) {
    const existentes = await Repo.listarRecordatorios('vuelo_programado', vueloProgramadoId);
    for (const r of existentes.filter((r) => r.origen === 'auto_cargar_datos')) {
      await Repo.borrarRecordatorio(r.id);
    }
    if (!horaFin) return;
    const d = Calc.parseFechaLocal(fecha);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    await Repo.crearRecordatorio({
      evento_tipo: 'vuelo_programado',
      evento_id: vueloProgramadoId,
      tipo_disparo: 'fecha_hora',
      fecha_hora: d.toISOString(),
      mensaje: 'Recordá cargar los datos de este vuelo.',
      origen: 'auto_cargar_datos',
    });
  },

  _marcarComoVolado(id, aeronaveId, fecha, desde, hasta) {
    const params = new URLSearchParams({ prog: id, aeronave: aeronaveId || '', fecha, desde: desde || '', hasta: hasta || '' });
    Router.irA('nuevo-vuelo?' + params.toString());
  },

  async _borrarProgramado(id) {
    if (!(await UI.confirmar('¿Borrar este vuelo agendado?', { ok: 'Borrar', peligro: true }))) return;
    await Repo.borrarVueloProgramado(id);
    this.render();
  },
};

const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Tipo de vuelo agendado — completamente opcional. Si no se elige nada, la
// tarjeta de "Próximo vuelo" sigue mostrando Local/Travesía deducido del
// destino, como siempre; si se elige uno, se muestra este en su lugar.
const TIPOS_VUELO_PROGRAMADO = [
  ['solo', 'Vuelo Solo'],
  ['instruccion', 'Vuelo de Instrucción'],
  ['capota', 'Capota'],
  ['nocturno', 'Nocturno'],
  ['navegacion', 'Navegación'],
  ['examen', 'Examen'],
];
function labelTipoVueloProgramado(codigo) {
  return TIPOS_VUELO_PROGRAMADO.find(([c]) => c === codigo)?.[1] || codigo;
}

// Nombre de ciudad para un código OACI/local, del mismo dataset que usa el
// autocomplete de aeródromos — para mostrar "PALOMAR" debajo de "SADP".
function ciudadDeAerodromo(code) {
  if (!code) return '';
  const a = (window.AERODROMOS || []).find((x) => x.code === code);
  return a?.ciudad || '';
}

// METAR/TAF real del aeródromo de origen — servicio público de NOAA
// (aviationweather.gov), sin API key. aviationweather.gov no manda headers
// CORS, así que el pedido no puede ir directo desde el navegador. Primero
// se intenta la Edge Function propia (supabase/functions/metar) — corre
// server-side, sin depender de terceros. Si todavía no está deployada (o
// falla), cae a un proxy CORS público (allorigins.win) como red de
// contención, para que el dato no deje de funcionar de un día para el otro.
//
// OJO: el nombre que se ve en "Name" en el dashboard de Supabase es solo
// una etiqueta — no cambia el slug/URL real de la función, que queda fijo
// desde el momento en que se creó (acá quedó "smooth-processor" en vez de
// "metar" porque así la generó Supabase al crearla). Si algún día se borra
// y se recrea con el slug "metar" desde el vamos, actualizar esta URL.
function _metarCacheKey(icao, tipo) { return `metar_cache_${tipo}_${icao}`; }

function _guardarMetarCache(icao, tipo, texto) {
  try { localStorage.setItem(_metarCacheKey(icao, tipo), JSON.stringify({ texto, ts: Date.now() })); } catch { /* storage lleno */ }
}
function _leerMetarCache(icao, tipo) {
  try { return JSON.parse(localStorage.getItem(_metarCacheKey(icao, tipo)) || 'null'); } catch { return null; }
}
function _horasDesde(ts) { return (Date.now() - ts) / 3600000; }

async function cargarMetar(icao, elId, tipo = 'metar') {
  const el = document.getElementById(elId);
  if (!el) return;

  const propia = `${window.SUPABASE_CONFIG.url}/functions/v1/${window.METAR_FN_SLUG}?icao=${icao}&tipo=${tipo}`;
  const destino = encodeURIComponent(`https://aviationweather.gov/api/data/${tipo}?ids=${icao}&format=raw`);
  const proxyPublico = `https://api.allorigins.win/raw?url=${destino}`;

  for (const url of [propia, proxyPublico]) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const texto = (await resp.text()).trim();
      if (texto) _guardarMetarCache(icao, tipo, texto);
      el.textContent = texto || `Sin ${tipo.toUpperCase()} publicado para este aeródromo.`;
      return;
    } catch { /* intenta la siguiente fuente */ }
  }

  // No se pudo refrescar: mostramos el último dato leído, con un aviso de
  // antigüedad solo si tiene 1 hora o más (si es más reciente, sirve tal cual).
  const cache = _leerMetarCache(icao, tipo);
  if (cache && cache.texto) {
    const horas = _horasDesde(cache.ts);
    el.textContent = cache.texto;
    if (horas >= 1) {
      const aviso = document.createElement('span');
      aviso.className = 'muted';
      aviso.style.cssText = 'display:block;font-size:11px;margin-top:2px';
      aviso.innerHTML = Icons.tag('alertTriangle', `${tipo.toUpperCase()} de hace ${Math.round(horas)} h — sin conexión al servicio`);
      el.appendChild(aviso);
    }
    return;
  }
  el.textContent = `${tipo.toUpperCase()} no disponible.`;
}

// Cuando "Habilitación de Vuelo Nocturno" (HAB_NOC) está activa junto a otro
// curso que también pide horas nocturnas (ej. PCA pide 5), las horas
// nocturnas voladas van primero a completar la habilitación (sus 3 hs) —
// recién las que sobran después de eso cuentan para el otro curso. No es
// que las mismas horas cuenten dos veces para dos requisitos distintos.
function valorNocturnasAjustado(cursoId, agg, configsPorCurso) {
  const habNoc = configsPorCurso.find((c) => c.cursoId === 'HAB_NOC');
  if (!habNoc) return agg.total_noche;
  const reqHabNoc = habNoc.config.find((r) => r.nombre_requisito === 'nocturnas');
  const minimoHabNoc = Calc.n(reqHabNoc?.minimo_horas);
  if (cursoId === 'HAB_NOC') return Math.min(agg.total_noche, minimoHabNoc);
  return Math.max(0, Calc.round2(agg.total_noche - minimoHabNoc));
}

// Promedio ponderado por tamaño del requisito, no un promedio simple de
// porcentajes: si un curso pide 200 hs y otro (ej. HAB_NOC) pide 3, ese de
// 3 hs no puede pesar lo mismo que el de 200 — si no, faltar poco de esas
// 3 hs hunde el % general aunque estés casi terminando el curso grande.
// Pura (sin DOM) a propósito, para poder testearla — ver tests/dashboard.test.js.
function calcularProgresoPonderado(porCurso) {
  const actualTotal = porCurso.reduce((s, c) => s + Math.min(c.actual, c.minimo), 0);
  const minimoTotal = porCurso.reduce((s, c) => s + c.minimo, 0);
  return minimoTotal > 0 ? Calc.round2(Math.min(100, (actualTotal / minimoTotal) * 100)) : 0;
}

// Promedia el progreso entre todos los cursos activos, ponderado por
// tamaño de requisito (ver comentario en la función), y lo pinta en el
// anillo grande del hero.
function renderHeroProgreso(configsPorCurso, agg) {
  const lista = document.getElementById('hero-cursos-lista');
  const bar = document.getElementById('hero-bar');
  const pctLabel = document.getElementById('hero-pct');
  const ring = document.getElementById('ring-fill');
  const CIRC = 402; // 2 * PI * r(64)

  const conRequisitos = configsPorCurso.filter(({ config }) => config.length);
  if (!conRequisitos.length) {
    lista.innerHTML = '<p class="muted" style="margin:0">Sin requisitos configurados todavía.</p>';
    pctLabel.textContent = 'Sin requisitos configurados';
    bar.style.width = '0%';
    ring.style.strokeDashoffset = CIRC;
    return;
  }

  const porCurso = conRequisitos.map(({ cursoId, curso, config }) => {
    const principal = config.find((r) => r.nombre_requisito === 'total') || config[0];
    const actual = principal.nombre_requisito === 'nocturnas'
      ? valorNocturnasAjustado(cursoId, agg, configsPorCurso)
      : valorRequisito(principal.nombre_requisito, agg);
    const minimo = Calc.n(principal.minimo_horas);
    const pct = minimo > 0 ? Math.min(100, Calc.round2((actual / minimo) * 100)) : 0;
    const faltan = Math.max(0, Calc.round2(minimo - actual));
    const esUnidad = principal.nombre_requisito === 'aterrizajes_noche' || principal.nombre_requisito === 'remolques';
    return { cursoId, curso, principal, actual, minimo, pct, faltan, esUnidad };
  });

  lista.innerHTML = porCurso.map(({ cursoId, curso, principal, pct, faltan, esUnidad }) => `
    <div class="doc-card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <span class="muted">${cursoId.replace('_', ' ')} — ${LABELS_REQUISITO[principal.nombre_requisito] || principal.nombre_requisito}</span>
        <span style="font-family:var(--font-mono);flex-shrink:0">${pct}%</span>
      </div>
      <p class="muted" style="margin:2px 0 0">${faltan <= 0 ? '¡Completo!' : `faltan ${faltan}${esUnidad ? '' : ' hs'}`}</p>
    </div>`).join('');

  const promedio = calcularProgresoPonderado(porCurso);
  bar.style.width = promedio + '%';
  pctLabel.textContent = porCurso.length > 1 ? `Progreso combinado: ${promedio}% completado` : `${promedio}% completado`;
  ring.style.strokeDashoffset = CIRC - (CIRC * promedio) / 100;
}

function fmtMoneda(x, moneda = 'ARS') {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda || 'ARS', maximumFractionDigits: 0 }).format(x || 0);
  } catch {
    return `$${(x || 0).toFixed(0)}`;
  }
}
function fmtFecha(f) {
  if (!f) return '—';
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
}

window.ViewDashboard = ViewDashboard;
window.fmtMoneda = fmtMoneda;
window.fmtFecha = fmtFecha;
