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

const ViewTotales = {
  async render() {
    const main = document.getElementById('main-content');
    const [vuelos, cursosActivos] = await Promise.all([Repo.listarVuelos(), Repo.getCursosActivos()]);
    const agg = agregarVuelos(vuelos);

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

    main.innerHTML = `
      <div class="card">
        <h2>${Icons.award(18)} Progreso de licencia</h2>
        <div id="detalle-progreso-licencia"></div>
      </div>

      <div class="card">
        <h2>${Icons.barChart(18)} Totales acumulados</h2>
        <div class="grid cols-4">
          ${stat('Total general', agg.tiempo_total)}
          ${stat('PIC', agg.total_pic)}
          ${stat('Copiloto', agg.total_copiloto)}
          ${stat('Día', agg.total_dia)}
          ${stat('Noche', agg.total_noche)}
          ${stat('Travesía', agg.total_travesia)}
          ${stat('Travesía PIC', agg.travesia_pic)}
          ${stat('Vuelos cargados', vuelos.length, '')}
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

      <div class="card">
        <h2>${Icons.search(18)} Discriminaciones <span class="muted" style="font-weight:400">(informativo — ya están incluidas en los totales de arriba, no se suman aparte)</span></h2>
        <div class="grid cols-4">
          ${stat('Instrucción', agg.instruccion_vuelo)}
          ${stat('Multimotor', agg.multimotor)}
          ${stat('Reactor', agg.reactor)}
          ${stat('Turbohélice', agg.turbohelice)}
          ${stat('Aeroaplicador', agg.aeroaplicador)}
          ${stat('Instrumentos real', agg.instrumentos_real)}
          ${stat('Instrumentos capota', agg.instrumentos_capota)}
          ${stat('Adiestrador/Simulador', agg.adiestrador_simulador)}
        </div>
      </div>
    `;

    try { renderDetalleProgreso(configsPorCurso, agg); } catch (err) { console.error('Error renderizando progreso de licencia:', err); }
  },
};

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

function htmlItemsRequisito(items) {
  return items.map(({ req, actual, minimo, pct, faltan, esUnidad }) => `
    <div class="progreso-item">
      <div class="pi-head">
        <span class="nombre" style="text-transform:uppercase;letter-spacing:.02em;font-size:12px">${LABELS_REQUISITO[req.nombre_requisito] || req.nombre_requisito}</span>
        ${faltan <= 0
          ? '<span class="badge ok">Completo</span>'
          : `<span class="faltan">${actual}${esUnidad ? '' : ' hs'} / ${minimo}${esUnidad ? '' : ' hs'} — faltan ${faltan}${esUnidad ? '' : ' hs'}</span>`}
      </div>
      <div class="progreso-bar ${faltan <= 0 ? 'completo' : ''}"><span style="width:${pct}%"></span></div>
    </div>`).join('');
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

function stat(label, valor, sufijo = ' hs') {
  return `<div class="stat"><div class="num">${(valor ?? 0)}${sufijo}</div><div class="lbl">${label}</div></div>`;
}

window.ViewTotales = ViewTotales;
