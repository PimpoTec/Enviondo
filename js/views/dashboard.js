// ============================================================================
// VISTA: DASHBOARD
// Orden de prioridad: 1) progreso CPL, 2) últimos vuelos, 3) vencimientos
// y currency, 4) estadísticas por aeronave/ruta.
// ============================================================================

const LABELS_REQUISITO = {
  total: 'Total', pic: 'Piloto al mando (PIC)', travesia_pic: 'Travesía como PIC',
  nocturnas: 'Nocturnas', instrumentos: 'Instrumentos (real + capota)',
  aterrizajes_noche: 'Aterrizajes nocturnos',
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
  async render() {
    const main = document.getElementById('main-content');
    const [vuelos, config, vencimientos] = await Promise.all([
      Repo.listarVuelos(), Repo.listarConfigLicencia(), Repo.listarVencimientos(),
    ]);
    const agg = agregarVuelos(vuelos);

    main.innerHTML = `
      <div class="costos-sticky">
        <div class="mini-card">
          <div class="label">Gastado total</div>
          <div class="value">${fmtMoneda(agg.costo_total)}</div>
        </div>
        <div class="mini-card">
          <div class="label">Gasto del mes</div>
          <div class="value">${fmtMoneda(gastoDelMes(vuelos))}</div>
        </div>
      </div>

      <div class="card">
        <h2>🎓 Progreso hacia ${config[0]?.licencia_objetivo || 'CPL Avión'}</h2>
        <div id="barras-progreso"></div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="margin:0">📒 Últimos vuelos</h2>
          <button class="btn ghost" onclick="Router.irA('bitacora')">Ver todos →</button>
        </div>
        <div id="ultimos-vuelos"></div>
      </div>

      <div class="card">
        <h2>🪪 Vencimientos y experiencia reciente</h2>
        <div id="vencimientos-lista"></div>
        <h3 style="margin-top:14px">Currency (RAAC 61.57, referencial)</h3>
        <div id="currency-lista"></div>
      </div>

      <div class="card">
        <h2>🗺️ Estadísticas por aeronave y ruta</h2>
        <div id="stats-rutas"></div>
      </div>
    `;

    renderBarrasProgreso(config, agg);
    renderUltimosVuelos(vuelos.slice(0, 6));
    renderVencimientos(vencimientos);
    renderCurrency(vuelos);
    renderStatsRutas(vuelos);
  },
};

function renderBarrasProgreso(config, agg) {
  const cont = document.getElementById('barras-progreso');
  if (!config.length) { cont.innerHTML = '<p class="muted">Configurá tus mínimos en Perfil / Licencias.</p>'; return; }
  cont.innerHTML = config.map((req) => {
    const actual = valorRequisito(req.nombre_requisito, agg);
    const minimo = Calc.n(req.minimo_horas);
    const pct = minimo > 0 ? Math.min(100, Calc.round2((actual / minimo) * 100)) : 0;
    const faltan = Math.max(0, Calc.round2(minimo - actual));
    const esUnidad = req.nombre_requisito === 'aterrizajes_noche';
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
    <thead><tr><th>Fecha</th><th>Ruta</th><th>Aeronave</th><th class="num">Tiempo</th><th class="num">Costo</th><th></th></tr></thead>
    <tbody>
      ${vuelos.map((v) => `
        <tr>
          <td>${fmtFecha(v.fecha)}</td>
          <td>${v.desde} → ${v.hasta}</td>
          <td>${v.aeronaves?.matricula || '—'}</td>
          <td class="num">${v.tiempo_total} hs</td>
          <td class="num">${fmtMoneda(Calc.calcularCosto(v, v.aeronaves), v.aeronaves?.moneda)}</td>
          <td><button class="btn ghost" onclick="Router.irA('bitacora')">Editar</button></td>
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

function renderStatsRutas(vuelos) {
  const cont = document.getElementById('stats-rutas');
  if (!vuelos.length) { cont.innerHTML = '<p class="muted">Sin datos todavía.</p>'; return; }
  const porAeronave = {};
  const porRuta = {};
  for (const v of vuelos) {
    const mat = v.aeronaves?.matricula || '—';
    porAeronave[mat] = Calc.round2((porAeronave[mat] || 0) + Calc.n(v.tiempo_total));
    const ruta = `${v.desde}–${v.hasta}`;
    porRuta[ruta] = (porRuta[ruta] || 0) + 1;
  }
  const maxAer = Math.max(...Object.values(porAeronave), 1);
  const filasAer = Object.entries(porAeronave).sort((a, b) => b[1] - a[1]).map(([mat, hs]) => `
    <div class="progreso-item">
      <div class="pi-head"><span class="nombre">${mat}</span><span class="faltan">${hs} hs</span></div>
      <div class="progreso-bar"><span style="width:${Math.round((hs / maxAer) * 100)}%"></span></div>
    </div>`).join('');
  const rutasTop = Object.entries(porRuta).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([r, c]) => `<span class="chip">${r} · ${c}v</span>`).join('');
  cont.innerHTML = `
    <h3>Horas por aeronave</h3>
    ${filasAer}
    <h3 style="margin-top:14px">Rutas más voladas</h3>
    <div>${rutasTop}</div>
    <p class="muted" style="margin-top:8px">Mapa geográfico de rutas: mejora futura (requiere geocodificar OACI → lat/lon).</p>
  `;
}

function gastoDelMes(vuelos) {
  const hoy = new Date();
  const delMes = vuelos.filter((v) => {
    const f = new Date(v.fecha + 'T00:00:00');
    return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
  });
  return Calc.round2(delMes.reduce((s, v) => s + Calc.calcularCosto(v, v.aeronaves), 0));
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
