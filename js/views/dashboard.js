// ============================================================================
// VISTA: DASHBOARD
// Orden de prioridad: 1) total de horas, 2) próximo vuelo, 3) progreso del
// curso activo, 4) vencimientos y currency, 5) costos (secundario, al final).
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
  if (dias < 0) return { estado: 'danger', texto: `❌ Vencido hace ${Math.abs(dias)} días` };
  if (dias <= (v.umbral_alerta_dias || 30)) return { estado: 'warn', texto: `⚠️ Vence en ${dias} días` };
  return { estado: 'ok', texto: `✅ Vigente (${dias} días)` };
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
        avisoHvi = '<p class="muted">⚠️ Todavía no elegiste cómo repartir tus 40 hs de instrumentos entre real y simulador — <a href="#perfil">andá a Perfil</a> para configurarlo.</p>';
      }
    }

    main.innerHTML = `
      <div class="card">
        <h2 style="margin-bottom:14px">🕐 Total de horas</h2>
        <div class="grid cols-4">
          <div class="stat"><div class="num">${agg.tiempo_total}</div><div class="lbl">Total</div></div>
          <div class="stat"><div class="num">${agg.total_pic}</div><div class="lbl">PIC</div></div>
          <div class="stat"><div class="num">${agg.total_dia}</div><div class="lbl">Día</div></div>
          <div class="stat"><div class="num">${agg.total_noche}</div><div class="lbl">Noche</div></div>
          <div class="stat"><div class="num">${agg.adiestrador_simulador}</div><div class="lbl">Simulador</div></div>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="margin:0">✈️ Próximo vuelo</h2>
          <button class="btn ghost" id="btn-mostrar-form-programado">+ Agendar</button>
        </div>
        <div id="form-programado" style="display:none;margin-bottom:14px"></div>
        <div id="proximo-vuelo"></div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="margin:0">🎓 Progreso: ${curso.id.replace('_', ' ')}</h2>
          <button class="btn ghost" onclick="Router.irA('perfil')">Cambiar curso →</button>
        </div>
        ${avisoHvi}
        <div id="resumen-progreso"></div>
        <button class="btn secondary" id="btn-detalle-progreso" style="margin-top:10px">Ver detalle</button>
        <div id="barras-progreso" style="display:none;margin-top:14px"></div>
      </div>

      <div class="card">
        <h2>🪪 Vencimientos y experiencia reciente</h2>
        <div id="vencimientos-lista"></div>
        <h3 style="margin-top:14px">Currency (RAAC 61.57, referencial)</h3>
        <div id="currency-lista"></div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="margin:0">📒 Últimos vuelos</h2>
          <button class="btn ghost" onclick="Router.irA('bitacora')">Ver todos →</button>
        </div>
        <div id="ultimos-vuelos"></div>
      </div>

      <div class="card" style="opacity:.85">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="margin:0 0 2px">💰 Costos</h3>
            <span class="muted">Gastado hasta ahora: ${fmtMoneda(agg.costo_total)}</span>
          </div>
          <button class="btn ghost" onclick="Router.irA('costos')">Ver detalle →</button>
        </div>
      </div>
    `;

    renderResumenProgreso(config, agg);
    renderBarrasProgreso(config, agg);
    renderUltimosVuelos(vuelos.slice(0, 6));
    renderVencimientos(vencimientos);
    renderCurrency(vuelos);
    this._renderProximoVuelo(programados);

    document.getElementById('btn-mostrar-form-programado').onclick = () => this._toggleFormProgramado();
    document.getElementById('btn-detalle-progreso').onclick = () => this._toggleDetalleProgreso();
  },

  _toggleDetalleProgreso() {
    const bloque = document.getElementById('barras-progreso');
    const btn = document.getElementById('btn-detalle-progreso');
    const visible = bloque.style.display !== 'none';
    bloque.style.display = visible ? 'none' : 'block';
    btn.textContent = visible ? 'Ver detalle' : 'Ocultar detalle';
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
        <div class="progreso-item" style="border:1px solid var(--border);border-radius:10px;padding:10px 12px">
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

function renderResumenProgreso(config, agg) {
  const cont = document.getElementById('resumen-progreso');
  if (!config.length) { cont.innerHTML = '<p class="muted">Sin requisitos configurados para este curso todavía.</p>'; return; }
  // El resumen usa el requisito "total" (horas totales) si existe; si no
  // (ej. APPL, que solo pide remolques), toma el primero de la lista.
  const principal = config.find((r) => r.nombre_requisito === 'total') || config[0];
  const actual = valorRequisito(principal.nombre_requisito, agg);
  const minimo = Calc.n(principal.minimo_horas);
  const pct = minimo > 0 ? Math.min(100, Calc.round2((actual / minimo) * 100)) : 0;
  const faltan = Math.max(0, Calc.round2(minimo - actual));
  const esUnidad = principal.nombre_requisito === 'aterrizajes_noche' || principal.nombre_requisito === 'remolques';
  cont.innerHTML = `
    <div class="progreso-item" style="margin-bottom:0">
      <div class="pi-head">
        <span class="nombre">${LABELS_REQUISITO[principal.nombre_requisito] || principal.nombre_requisito} — ${pct}%</span>
        <span class="faltan">${faltan <= 0 ? '¡completo! 🎉' : `faltan ${faltan}${esUnidad ? '' : ' hs'}`}</span>
      </div>
      <div class="progreso-bar ${faltan <= 0 ? 'completo' : ''}"><span style="width:${pct}%"></span></div>
    </div>`;
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
          <span class="faltan">${actual}${esUnidad ? '' : ' hs'} / ${minimo}${esUnidad ? '' : ' hs'} — ${faltan <= 0 ? '¡completo! 🎉' : `faltan ${faltan}${esUnidad ? '' : ' hs'}`}</span>
        </div>
        <div class="progreso-bar ${faltan <= 0 ? 'completo' : ''}"><span style="width:${pct}%"></span></div>
      </div>`;
  }).join('');
}

function renderUltimosVuelos(vuelos) {
  const cont = document.getElementById('ultimos-vuelos');
  if (!vuelos.length) { cont.innerHTML = '<div class="empty-state">Todavía no cargaste ningún vuelo. <br><button class="btn" style="margin-top:10px" onclick="Router.irA(\'nuevo-vuelo\')">Cargar el primero</button></div>'; return; }
  cont.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Fecha</th><th>Ruta</th><th>Aeronave</th><th class="num">Tiempo</th><th></th></tr></thead>
    <tbody>
      ${vuelos.map((v) => `
        <tr>
          <td>${fmtFecha(v.fecha)}</td>
          <td>${v.desde} → ${v.hasta}</td>
          <td>${v.aeronaves?.matricula || '—'}</td>
          <td class="num">${v.tiempo_total} hs</td>
          <td><button class="btn ghost" onclick="Router.irA('nuevo-vuelo?editar=${v.id}')">Editar</button></td>
        </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function renderVencimientos(vencimientos) {
  const cont = document.getElementById('vencimientos-lista');
  if (!vencimientos.length) { cont.innerHTML = '<p class="muted">No cargaste vencimientos todavía. Andá a Perfil para agregar (CMA, habilitaciones, IFR…).</p>'; return; }
  cont.innerHTML = vencimientos.map((v) => {
    const est = estadoVencimiento(v);
    return `<div class="chip"><span class="badge ${est.estado}">${est.texto}</span> ${v.tipo}</div>`;
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
    <div class="chip"><span class="badge ${okDia ? 'ok' : 'warn'}">${okDia ? '✅' : '⚠️'} ${aterrDia}/3</span> Despegues y aterrizajes (día, 90 días)</div>
    <div class="chip"><span class="badge ${okNoche ? 'ok' : 'warn'}">${okNoche ? '✅' : '⚠️'} ${aterrNoche}/3</span> Ídem nocturno (90 días)</div>
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
