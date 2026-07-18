// ============================================================================
// VISTA: TOTALES Y DISCRIMINACIONES
// Las discriminaciones se muestran aparte y NO se suman al total general.
// ============================================================================

const ViewTotales = {
  async render() {
    const main = document.getElementById('main-content');
    const vuelos = await Repo.listarVuelos();
    const agg = agregarVuelos(vuelos);

    main.innerHTML = `
      <div class="card">
        <h2>📊 Totales acumulados</h2>
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
        <h2>🛬 Aterrizajes</h2>
        <div class="grid cols-3">
          ${stat('Día', agg.aterrizajes_dia, '')}
          ${stat('Noche', agg.aterrizajes_noche, '')}
          ${stat('Total', agg.aterrizajes_dia + agg.aterrizajes_noche, '')}
        </div>
      </div>

      <div class="card">
        <h2>🔎 Discriminaciones <span class="muted" style="font-weight:400">(informativo — ya están incluidas en los totales de arriba, no se suman aparte)</span></h2>
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
  },
};

function stat(label, valor, sufijo = ' hs') {
  return `<div class="stat"><div class="num">${(valor ?? 0)}${sufijo}</div><div class="lbl">${label}</div></div>`;
}

window.ViewTotales = ViewTotales;
