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
    cont.innerHTML = programados.slice(0, 3).map((p, i) => {
      const [anio, mes, dia] = p.fecha.split('-');
      const fechaGrande = `${dia} ${MESES_CORTOS[Number(mes) - 1]}`;
      const metarId = `metar-${i}`;
      return `
        <div class="plan-card">
          <div class="plan-card-fecha">
            <p class="muted" style="margin:0">Fecha programada</p>
            <p style="margin:2px 0 0;font-size:20px;font-weight:700">${fechaGrande}</p>
            ${p.hora_prevista ? `<p style="margin:2px 0 0;font-family:var(--font-mono);color:var(--brand)">${p.hora_prevista.slice(0, 5)} ${obtenerPrefHorario() === 'local' ? 'hora local' : 'UTC'}</p>` : ''}
            ${/^[A-Z]{4}$/.test(p.desde || '') ? `
              <p class="muted" style="margin:14px 0 0">METAR ${p.desde}</p>
              <p id="${metarId}" class="muted" style="margin:2px 0 0;font-family:var(--font-mono);font-size:12px">Cargando…</p>
            ` : ''}
          </div>
          <div class="plan-card-detalle">
            <p class="muted" style="margin:0">Aeronave</p>
            <p style="margin:2px 0 10px;font-size:16px;font-weight:600">
              ${p.aeronaves?.matricula ? `${p.aeronaves.matricula} — ${p.aeronaves.marca_modelo}` : 'Sin definir'}
            </p>
            ${p.desde && p.hasta ? `
              <div class="plan-card-ruta">
                <span class="mono">${p.desde}</span>
                ${Icons.plane(16)}
                <span class="mono">${p.hasta}</span>
              </div>` : ''}
            ${p.instructor_nombre || p.notas ? `<p class="muted" style="margin:8px 0 0">${[p.instructor_nombre && `Instructor: ${p.instructor_nombre}`, p.notas].filter(Boolean).join(' · ')}</p>` : ''}
            <div class="btn-row" style="margin-top:10px">
              <button class="btn secondary" onclick="ViewDashboard._marcarComoVolado('${p.id}', '${p.aeronave_id || ''}', '${p.fecha}', '${p.desde || ''}', '${p.hasta || ''}')">Marcar como volado</button>
              <button class="btn ghost" onclick="ViewDashboard._borrarProgramado('${p.id}')">Borrar</button>
            </div>
          </div>
        </div>`;
    }).join('');

    programados.slice(0, 3).forEach((p, i) => {
      if (/^[A-Z]{4}$/.test(p.desde || '')) cargarMetar(p.desde, `metar-${i}`);
    });
  },

  _toggleFormProgramado() {
    const cont = document.getElementById('form-programado');
    const visible = cont.style.display !== 'none';
    if (visible) { cont.style.display = 'none'; return; }
    cont.innerHTML = `
      <div class="grid cols-2">
        <div class="field"><label>Fecha</label><input type="date" id="pv-fecha" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label>${labelHora('Hora prevista')}</label><input type="time" id="pv-hora"></div>
        <div class="field"><label>Aeronave</label>
          <select id="pv-aeronave"><option value="">Sin definir</option>
            ${this.aeronaves.map((a) => `<option value="${a.id}">${a.matricula} — ${a.marca_modelo}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Instructor</label><input type="text" id="pv-instructor"></div>
        <div class="field"><label>Desde (OACI)</label><input type="text" id="pv-desde" maxlength="4" style="text-transform:uppercase"></div>
        <div class="field"><label>Hasta (OACI)</label><input type="text" id="pv-hasta" maxlength="4" style="text-transform:uppercase"></div>
      </div>
      <div class="field"><label>Notas</label><input type="text" id="pv-notas"></div>
      <div class="btn-row"><button class="btn" id="btn-guardar-programado">Agendar</button></div>
    `;
    cont.style.display = 'block';
    document.getElementById('btn-guardar-programado').onclick = () => this._guardarProgramado();
  },

  async _guardarProgramado() {
    const fecha = document.getElementById('pv-fecha').value;
    if (!fecha) { alert('Elegí una fecha.'); return; }
    try {
      await Repo.crearVueloProgramado({
        fecha,
        hora_prevista: document.getElementById('pv-hora').value || null,
        aeronave_id: document.getElementById('pv-aeronave').value || null,
        desde: document.getElementById('pv-desde').value.trim().toUpperCase() || null,
        hasta: document.getElementById('pv-hasta').value.trim().toUpperCase() || null,
        instructor_nombre: document.getElementById('pv-instructor').value || null,
        notas: document.getElementById('pv-notas').value || null,
      });
      this.render();
    } catch (err) {
      alert('Error al agendar: ' + (err.message || err));
    }
  },

  _marcarComoVolado(id, aeronaveId, fecha, desde, hasta) {
    const params = new URLSearchParams({ prog: id, aeronave: aeronaveId || '', fecha, desde: desde || '', hasta: hasta || '' });
    Router.irA('nuevo-vuelo?' + params.toString());
  },

  async _borrarProgramado(id) {
    if (!confirm('¿Borrar este vuelo agendado?')) return;
    await Repo.borrarVueloProgramado(id);
    this.render();
  },
};

const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// METAR real del aeródromo de origen — servicio público de NOAA
// (aviationweather.gov), sin API key. aviationweather.gov no manda headers
// CORS, así que el pedido va a través de un proxy CORS público
// (allorigins.win) para que el navegador no lo bloquee. Si falla (código
// no existe, sin señal, el proxy caído), se muestra un aviso en vez de
// romper el resto de la card.
async function cargarMetar(icao, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  try {
    const destino = encodeURIComponent(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`);
    const resp = await fetch(`https://api.allorigins.win/raw?url=${destino}`);
    if (!resp.ok) throw new Error('sin respuesta');
    const texto = (await resp.text()).trim();
    el.textContent = texto || 'Sin METAR publicado para este aeródromo.';
  } catch {
    el.textContent = 'METAR no disponible.';
  }
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

  // Promedio ponderado por tamaño del requisito, no un promedio simple de
  // porcentajes: si un curso pide 200 hs y otro (ej. HAB_NOC) pide 3, ese
  // de 3 hs no puede pesar lo mismo que el de 200 — si no, faltar poco de
  // esas 3 hs hunde el % general aunque estés casi terminando el curso grande.
  const actualTotal = porCurso.reduce((s, c) => s + Math.min(c.actual, c.minimo), 0);
  const minimoTotal = porCurso.reduce((s, c) => s + c.minimo, 0);
  const promedio = minimoTotal > 0 ? Calc.round2(Math.min(100, (actualTotal / minimoTotal) * 100)) : 0;
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
