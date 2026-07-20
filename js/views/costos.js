// ============================================================================
// VISTA: COSTOS — gasto por mes/aeronave, promedio por hora, proyección a CPL.
// ============================================================================

const ViewCostos = {
  async render() {
    const main = document.getElementById('main-content');
    const vuelos = await Repo.listarVuelos();
    const cursosActivos = await Repo.getCursosActivos();
    const configsPorCurso = await Promise.all(cursosActivos.map((id) => Repo.listarConfigLicencia(id)));
    const agg = agregarVuelos(vuelos);
    const costoPromedioHora = agg.tiempo_total > 0 ? Calc.round2(agg.costo_total / agg.tiempo_total) : 0;

    // Con más de un curso activo, la proyección se calcula contra el que
    // pida más horas totales (el objetivo "grande", ej. PCA por sobre una
    // habilitación puntual como HAB_NOC que no tiene requisito "total").
    const reqsTotal = configsPorCurso.flat().filter((c) => c.nombre_requisito === 'total');
    const reqTotal = reqsTotal.length ? reqsTotal.reduce((a, b) => (Calc.n(b.minimo_horas) > Calc.n(a.minimo_horas) ? b : a)) : null;
    const curso = CURSOS.find((c) => c.id === reqTotal?.curso_id) || CURSOS.find((c) => c.id === cursosActivos[0]) || CURSOS[1];
    const horasFaltantes = reqTotal ? Math.max(0, Calc.round2(Calc.n(reqTotal.minimo_horas) - agg.tiempo_total)) : 0;
    const proyeccion = Calc.round2(horasFaltantes * costoPromedioHora);

    main.innerHTML = `
      <div class="card">
        <h2>${Icons.dollar(18)} Resumen de costos</h2>
        <div class="grid cols-3">
          <div class="stat"><div class="num">${fmtMoneda(agg.costo_total)}</div><div class="lbl">Gastado total</div></div>
          <div class="stat"><div class="num">${fmtMoneda(costoPromedioHora)}</div><div class="lbl">Costo promedio / hora</div></div>
          <div class="stat"><div class="num">${fmtMoneda(proyeccion)}</div><div class="lbl">Proyección hasta completar ${curso.id}</div></div>
        </div>
        <p class="muted" style="margin-top:8px">Proyección = horas que faltan para el total de ${curso.label} (${horasFaltantes} hs) × costo promedio por hora volada hasta ahora.</p>
      </div>

      <div class="card">
        <h2>Gasto por mes</h2>
        <div id="gasto-mes"></div>
      </div>

      <div class="card">
        <h2>Costo acumulado por aeronave</h2>
        <div id="gasto-aeronave"></div>
      </div>
    `;

    renderGastoPorMes(vuelos);
    renderGastoPorAeronave(vuelos);
  },
};

function renderGastoPorMes(vuelos) {
  const cont = document.getElementById('gasto-mes');
  const porMes = {};
  for (const v of vuelos) {
    const key = v.fecha.slice(0, 7); // YYYY-MM
    porMes[key] = Calc.round2((porMes[key] || 0) + Calc.costoRegistrado(v, v.aeronaves).monto);
  }
  const claves = Object.keys(porMes).sort().slice(-12);
  if (!claves.length) { cont.innerHTML = '<p class="muted">Sin datos todavía.</p>'; return; }
  const max = Math.max(...claves.map((k) => porMes[k]), 1);
  cont.innerHTML = claves.map((k) => `
    <div class="progreso-item">
      <div class="pi-head"><span class="nombre">${k}</span><span class="faltan">${fmtMoneda(porMes[k])}</span></div>
      <div class="progreso-bar"><span style="width:${Math.round((porMes[k] / max) * 100)}%"></span></div>
    </div>
  `).join('');
}

function renderGastoPorAeronave(vuelos) {
  const cont = document.getElementById('gasto-aeronave');
  const porAeronave = {};
  for (const v of vuelos) {
    const mat = v.aeronaves?.matricula || '—';
    porAeronave[mat] = Calc.round2((porAeronave[mat] || 0) + Calc.costoRegistrado(v, v.aeronaves).monto);
  }
  const entradas = Object.entries(porAeronave).sort((a, b) => b[1] - a[1]);
  if (!entradas.length) { cont.innerHTML = '<p class="muted">Sin datos todavía.</p>'; return; }
  const max = Math.max(...entradas.map(([, v]) => v), 1);
  cont.innerHTML = entradas.map(([mat, v]) => `
    <div class="progreso-item">
      <div class="pi-head"><span class="nombre">${mat}</span><span class="faltan">${fmtMoneda(v)}</span></div>
      <div class="progreso-bar"><span style="width:${Math.round((v / max) * 100)}%"></span></div>
    </div>
  `).join('');
}

window.ViewCostos = ViewCostos;
