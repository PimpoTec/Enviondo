// ============================================================================
// VISTA: DASHBOARD
// Orden de prioridad: 1) total de horas + progreso del curso activo (hero),
// 2) último registro + CTA nuevo vuelo, 3) próximo vuelo agendado,
// 4) detalle de progreso por requisito, 5) vencimientos y currency,
// 6) últimos vuelos, 7) costos (secundario, al final).
// ============================================================================

const LABELS_REQUISITO = {
  total: 'Total', pic: 'Piloto al mando (PIC)', travesia_pic: 'Travesía como PIC',
  nocturnas: 'Nocturnas', instrumentos: 'Instrumentos (real + capota)',
  instrumentos_sim: 'Instrumentos en simulador (FSTD)',
  aterrizajes_noche: 'Aterrizajes nocturnos', remolques: 'Remolques',
};

function estadoVencimiento(v) {
  const hoy = new Date();
  const fv = new Date(v.fecha_vencimiento + 'T00:00:00');
  const dias = Math.round((fv - hoy) / 86400000);
  if (dias < 0) return { estado: 'danger', icon: 'xCircle', texto: `Vencido hace ${Math.abs(dias)} días` };
  if (dias <= (v.umbral_alerta_dias || 30)) return { estado: 'warn', icon: 'alertTriangle', texto: `Vence en ${dias} días` };
  return { estado: 'ok', icon: 'checkCircle', texto: `Vigente (${dias} días)` };
}

const ViewDashboard = {
  aeronaves: [],

  async render() {
    const main = document.getElementById('main-content');
    const [vuelos, cursoActivo, vencimientos, programados, aeronaves] = await Promise.all([
      Repo.listarVuelos(), Repo.getCursoActivo(), Repo.listarVencimientos(),
      Repo.listarVuelosProgramados(), Repo.listarAeronaves(),
    ]);
    this.aeronaves = aeronaves;
    let config = await Repo.listarConfigLicencia(cursoActivo);
    const agg = agregarVuelos(vuelos);
    const curso = CURSOS.find((c) => c.id === cursoActivo) || CURSOS[1];

    // El PCA+HVI reparte sus 40 hs de instrumentos entre real y simulador
    // según lo que el piloto haya elegido en Perfil (no es un mínimo fijo
    // igual para todos, así que no vive en la tabla global de requisitos).
    let avisoHvi = '';
    if (cursoActivo === 'PCA_HVI') {
      const simHoras = await Repo.getHviSimHoras();
      if (simHoras !== null && simHoras !== undefined) {
        config = config.filter((c) => c.nombre_requisito !== 'instrumentos').concat([
          { nombre_requisito: 'instrumentos', minimo_horas: Calc.round2(40 - simHoras) },
          { nombre_requisito: 'instrumentos_sim', minimo_horas: simHoras },
        ]);
      } else {
        avisoHvi = `<p class="muted">${Icons.tag('alertTriangle', 'Todavía no elegiste cómo repartir tus 40 hs de instrumentos entre real y simulador — <a href="#perfil">andá a Perfil</a> para configurarlo.')}</p>`;
      }
    }

    const ultimo = vuelos[0];

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
              <span class="kpi-unit">Horas</span>
            </div>
          </div>
          <div style="flex:1;min-width:220px">
            <p class="muted" style="margin:0 0 2px">Progreso licencia</p>
            <p style="margin:0 0 12px;font-size:18px;font-weight:600">${curso.id.replace('_', ' ')}</p>
            <div class="grid cols-2" style="margin-bottom:10px">
              <div class="doc-card">
                <p class="muted" style="margin:0">Objetivo</p>
                <p id="hero-objetivo" style="margin:2px 0 0;font-family:var(--font-mono);font-variant-numeric:tabular-nums"></p>
              </div>
              <div class="doc-card">
                <p class="muted" style="margin:0">Resta</p>
                <p id="hero-resta" style="margin:2px 0 0;font-family:var(--font-mono);color:var(--brand);font-variant-numeric:tabular-nums"></p>
              </div>
            </div>
            <div class="progreso-bar"><span id="hero-bar" style="width:0%"></span></div>
            <div style="display:flex;justify-content:space-between;margin-top:6px">
              <span class="muted" id="hero-pct"></span>
              <span class="muted">Simulador: ${agg.adiestrador_simulador} hs</span>
            </div>
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

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="margin:0">${Icons.award(18)} Detalle de progreso</h2>
          <button class="btn ghost" onclick="Router.irA('perfil')">Cambiar curso →</button>
        </div>
        ${avisoHvi}
        <div id="barras-progreso"></div>
      </div>

      <div class="card card-compact">
        <h3>${Icons.list(16)} Último registro</h3>
        ${ultimo
          ? `<p style="margin:0;font-family:var(--font-mono)">${ultimo.aeronaves?.matricula || '—'}</p>
             <p class="muted" style="margin:4px 0 0">${ultimo.desde} → ${ultimo.hasta} (${ultimo.tiempo_total} hs)</p>`
          : `<p class="muted" style="margin:0">Todavía no cargaste ningún vuelo.</p>`}
      </div>

      <div class="card card-compact">
        <h3>${Icons.idCard(16)} Vencimientos y experiencia reciente</h3>
        <div id="vencimientos-lista" class="grid cols-4"></div>
        <h3 style="margin-top:14px">Currency (RAAC 61.57, referencial)</h3>
        <div id="currency-lista"></div>
      </div>

      <div class="card card-compact">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3 style="margin:0">${Icons.list(16)} Últimos vuelos</h3>
          <button class="btn ghost" onclick="Router.irA('bitacora')">Ver todos →</button>
        </div>
        <div id="ultimos-vuelos"></div>
      </div>

      <div class="card card-compact" style="opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="margin:0 0 2px">${Icons.dollar(16)} Costos</h3>
            <span class="muted">Gastado hasta ahora: ${fmtMoneda(agg.costo_total)}</span>
          </div>
          <button class="btn ghost" onclick="Router.irA('costos')">Ver detalle →</button>
        </div>
      </div>
    `;

    document.getElementById('btn-mostrar-form-programado').onclick = () => this._toggleFormProgramado();

    // Cada renderer corre aislado: si uno falla con un dato inesperado de
    // esta cuenta puntual, no debe tirar abajo los botones ni el resto de
    // las secciones (ya conectados arriba).
    const pasos = [
      () => renderHeroProgreso(config, agg),
      () => renderBarrasProgreso(config, agg),
      () => renderUltimosVuelos(vuelos.slice(0, 6)),
      () => renderVencimientos(vencimientos),
      () => renderCurrency(vuelos),
      () => this._renderProximoVuelo(programados),
    ];
    for (const paso of pasos) {
      try { paso(); } catch (err) { console.error('Error renderizando sección del dashboard:', err); }
    }
  },

  _renderProximoVuelo(programados) {
    const cont = document.getElementById('proximo-vuelo');
    if (!programados.length) {
      cont.innerHTML = `<p class="muted">No tenés vuelos agendados. Usá "+ Agendar" para cargar el próximo.</p>`;
      return;
    }
    cont.innerHTML = programados.slice(0, 3).map((p) => {
      const dias = Math.round((new Date(p.fecha + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
      const cuando = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`;
      return `
        <div class="progreso-item" style="border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px">
          <div class="pi-head">
            <span class="nombre">${fmtFecha(p.fecha)} ${p.hora_prevista ? '· ' + p.hora_prevista.slice(0, 5) : ''} — <span class="badge ok">${cuando}</span></span>
          </div>
          <div class="muted" style="margin:4px 0 8px">
            ${p.aeronaves?.matricula ? p.aeronaves.matricula + ' — ' + p.aeronaves.marca_modelo : 'Aeronave sin definir'}
            ${p.desde && p.hasta ? ` · ${p.desde} → ${p.hasta}` : ''}
            ${p.instructor_nombre ? ` · Instructor: ${p.instructor_nombre}` : ''}
            ${p.notas ? ` · ${p.notas}` : ''}
          </div>
          <div class="btn-row">
            <button class="btn secondary" onclick="ViewDashboard._marcarComoVolado('${p.id}', '${p.aeronave_id || ''}', '${p.fecha}', '${p.desde || ''}', '${p.hasta || ''}')">Marcar como volado</button>
            <button class="btn ghost" onclick="ViewDashboard._borrarProgramado('${p.id}')">Borrar</button>
          </div>
        </div>`;
    }).join('');
  },

  _toggleFormProgramado() {
    const cont = document.getElementById('form-programado');
    const visible = cont.style.display !== 'none';
    if (visible) { cont.style.display = 'none'; return; }
    cont.innerHTML = `
      <div class="grid cols-2">
        <div class="field"><label>Fecha</label><input type="date" id="pv-fecha" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label>Hora prevista</label><input type="time" id="pv-hora"></div>
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

function renderHeroProgreso(config, agg) {
  const objetivo = document.getElementById('hero-objetivo');
  const resta = document.getElementById('hero-resta');
  const bar = document.getElementById('hero-bar');
  const pctLabel = document.getElementById('hero-pct');
  const ring = document.getElementById('ring-fill');
  const CIRC = 402; // 2 * PI * r(64)

  if (!config.length) {
    objetivo.textContent = '—'; resta.textContent = '—'; pctLabel.textContent = 'Sin requisitos configurados';
    return;
  }
  const principal = config.find((r) => r.nombre_requisito === 'total') || config[0];
  const actual = valorRequisito(principal.nombre_requisito, agg);
  const minimo = Calc.n(principal.minimo_horas);
  const pct = minimo > 0 ? Math.min(100, Calc.round2((actual / minimo) * 100)) : 0;
  const faltan = Math.max(0, Calc.round2(minimo - actual));
  const esUnidad = principal.nombre_requisito === 'aterrizajes_noche' || principal.nombre_requisito === 'remolques';

  objetivo.textContent = `${minimo}${esUnidad ? '' : ' hs'}`;
  resta.textContent = faltan <= 0 ? '¡Completo!' : `${faltan}${esUnidad ? '' : ' hs'}`;
  bar.style.width = pct + '%';
  pctLabel.textContent = `${pct}% completado`;
  ring.style.strokeDashoffset = CIRC - (CIRC * pct) / 100;
}

function renderBarrasProgreso(config, agg) {
  const cont = document.getElementById('barras-progreso');
  if (!config.length) { cont.innerHTML = '<p class="muted">Sin requisitos configurados para este curso todavía.</p>'; return; }
  cont.innerHTML = config.map((req) => {
    const actual = valorRequisito(req.nombre_requisito, agg);
    const minimo = Calc.n(req.minimo_horas);
    const pct = minimo > 0 ? Math.min(100, Calc.round2((actual / minimo) * 100)) : 0;
    const faltan = Math.max(0, Calc.round2(minimo - actual));
    const esUnidad = req.nombre_requisito === 'aterrizajes_noche' || req.nombre_requisito === 'remolques';
    return `
      <div class="progreso-item">
        <div class="pi-head">
          <span class="nombre">${LABELS_REQUISITO[req.nombre_requisito] || req.nombre_requisito}</span>
          <span class="faltan">${actual}${esUnidad ? '' : ' hs'} / ${minimo}${esUnidad ? '' : ' hs'} — ${faltan <= 0 ? 'completo' : `faltan ${faltan}${esUnidad ? '' : ' hs'}`}</span>
        </div>
        <div class="progreso-bar ${faltan <= 0 ? 'completo' : ''}"><span style="width:${pct}%"></span></div>
      </div>`;
  }).join('');
}

function renderUltimosVuelos(vuelos) {
  const cont = document.getElementById('ultimos-vuelos');
  if (!vuelos.length) { cont.innerHTML = `<div class="empty-state">Todavía no cargaste ningún vuelo. <br><button class="btn" style="margin-top:10px" onclick="Router.irA('nuevo-vuelo')">Cargar el primero</button></div>`; return; }
  cont.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Fecha</th><th>Ruta</th><th>Aeronave</th><th class="num">Tiempo</th><th></th></tr></thead>
    <tbody>
      ${vuelos.map((v) => `
        <tr>
          <td>${fmtFecha(v.fecha)}</td>
          <td>${v.desde} → ${v.hasta}</td>
          <td>${v.aeronaves?.matricula || '—'}</td>
          <td class="num">${v.tiempo_total} hs</td>
          <td><button class="btn ghost" onclick="Router.irA('nuevo-vuelo?editar=${v.id}')">${Icons.edit(16)}</button></td>
        </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function renderVencimientos(vencimientos) {
  const cont = document.getElementById('vencimientos-lista');
  if (!vencimientos.length) { cont.innerHTML = '<p class="muted">No cargaste vencimientos todavía. Andá a Perfil para agregar (CMA, habilitaciones, IFR…).</p>'; return; }
  cont.innerHTML = vencimientos.map((v) => {
    const est = estadoVencimiento(v);
    return `
      <div class="doc-card">
        <div class="doc-head">
          <span class="icon">${Icons.medical(18)}</span>
          <span class="badge ${est.estado}">${Icons[est.icon](12)} ${est.texto}</span>
        </div>
        <p class="doc-tipo">${v.tipo}</p>
        <p class="doc-fecha">${fmtFecha(v.fecha_vencimiento)}</p>
      </div>`;
  }).join('');
}

function renderCurrency(vuelos) {
  const cont = document.getElementById('currency-lista');
  const hace90 = new Date(); hace90.setDate(hace90.getDate() - 90);
  const recientes = vuelos.filter((v) => new Date(v.fecha) >= hace90);
  const aterrDia = recientes.reduce((s, v) => s + Calc.n(v.aterrizajes_dia), 0);
  const aterrNoche = recientes.reduce((s, v) => s + Calc.n(v.aterrizajes_noche), 0);
  const okDia = aterrDia >= 3, okNoche = aterrNoche >= 3;
  cont.innerHTML = `
    <div class="chip"><span class="badge ${okDia ? 'ok' : 'warn'}">${Icons[okDia ? 'checkCircle' : 'alertTriangle'](12)} ${aterrDia}/3</span> Despegues y aterrizajes (día, 90 días)</div>
    <div class="chip"><span class="badge ${okNoche ? 'ok' : 'warn'}">${Icons[okNoche ? 'checkCircle' : 'alertTriangle'](12)} ${aterrNoche}/3</span> Ídem nocturno (90 días)</div>
  `;
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
