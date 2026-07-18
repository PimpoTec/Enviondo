// ============================================================================
// VISTA: EXPORTAR — Excel (.xlsx), PDF simple (layout tabular 290/2012 vía
// impresión del navegador) y backup completo en JSON.
// ============================================================================

const COLUMNAS_290 = [
  ['fecha', 'Fecha'], ['hora_salida_utc', 'Hora salida'], ['desde', 'Desde'], ['hasta', 'Hasta'], ['hora_llegada_utc', 'Hora llegada'],
  ['finalidad_vuelo', 'Finalidad'], ['matricula', 'Matrícula'], ['marca_modelo', 'Marca/Modelo'],
  ['saero_dia_piloto', 'S/Aeródromo Día Piloto'], ['saero_dia_copiloto', 'S/Aeródromo Día Copiloto'],
  ['saero_noche_piloto', 'S/Aeródromo Noche Piloto'], ['saero_noche_copiloto', 'S/Aeródromo Noche Copiloto'],
  ['trav_dia_piloto', 'Travesía Día Piloto'], ['trav_dia_copiloto', 'Travesía Día Copiloto'],
  ['trav_noche_piloto', 'Travesía Noche Piloto'], ['trav_noche_copiloto', 'Travesía Noche Copiloto'],
  ['tiempo_total', 'Tiempo Total'], ['aterrizajes_dia', 'Aterr. Día'], ['aterrizajes_noche', 'Aterr. Noche'],
  ['instruccion_vuelo', 'Instrucción'], ['multimotor', 'Multimotor'], ['reactor', 'Reactor'], ['turbohelice', 'Turbohélice'],
  ['aeroaplicador', 'Aeroaplicador'], ['instrumentos_real', 'Instrumentos Real'], ['instrumentos_capota', 'Instrumentos Capota'],
  ['adiestrador_simulador', 'Adiestrador/Simulador'], ['instructor_nombre', 'Instructor'], ['instructor_matricula', 'Mat. Instructor'],
  ['observaciones', 'Observaciones'], ['costo', 'Costo'],
];

const ViewExportar = {
  aeronaves: [],

  async render() {
    const main = document.getElementById('main-content');
    this.aeronaves = await Repo.listarAeronaves();

    main.innerHTML = `
      <div class="card">
        <h2>⬇️ Exportar</h2>
        <div class="grid cols-4">
          <div class="field"><label>Desde</label><input type="date" id="ex-desde"></div>
          <div class="field"><label>Hasta</label><input type="date" id="ex-hasta"></div>
          <div class="field"><label>Aeronave</label>
            <select id="ex-aeronave"><option value="">Todas</option>
              ${this.aeronaves.map((a) => `<option value="${a.id}">${a.matricula}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Finalidad</label>
            <select id="ex-finalidad">
              <option value="">Todas</option>
              <option value="local">Local</option><option value="instruccion">Instrucción</option>
              <option value="travesia">Travesía</option><option value="trabajo_aereo">Trabajo aéreo</option>
              <option value="verificacion">Verificación</option><option value="adiestramiento">Adiestramiento</option>
            </select>
          </div>
        </div>

        <div class="btn-row" style="margin-top:10px">
          <button class="btn" id="btn-export-xlsx">📊 Excel (.xlsx)</button>
          <button class="btn secondary" id="btn-export-pdf">🖨️ PDF (formato 290/2012)</button>
          <button class="btn secondary" id="btn-export-json">🗄️ Backup JSON completo</button>
        </div>
        <p class="muted" style="margin-top:8px">El PDF pixel-perfect a la hoja de 35,5×16,5 cm queda como mejora futura; esta versión respeta el orden de columnas e imprime los totales acumulados al pie, lista para imprimir o guardar como PDF desde el navegador.</p>
      </div>
    `;

    document.getElementById('btn-export-xlsx').onclick = () => this._exportarXlsx();
    document.getElementById('btn-export-pdf').onclick = () => this._exportarPdf();
    document.getElementById('btn-export-json').onclick = () => this._exportarJson();
  },

  async _filtros() {
    return {
      desde: document.getElementById('ex-desde').value || undefined,
      hasta: document.getElementById('ex-hasta').value || undefined,
      aeronave_id: document.getElementById('ex-aeronave').value || undefined,
      finalidad_vuelo: document.getElementById('ex-finalidad').value || undefined,
    };
  },

  async _filasPlanas() {
    const vuelos = await Repo.listarVuelos(await this._filtros());
    return vuelos.map((v) => ({
      ...v,
      matricula: v.aeronaves?.matricula, marca_modelo: v.aeronaves?.marca_modelo,
      costo: Calc.calcularCosto(v, v.aeronaves),
    }));
  },

  async _exportarXlsx() {
    const filas = await this._filasPlanas();
    if (!filas.length) { alert('No hay vuelos con esos filtros.'); return; }
    const data = [COLUMNAS_290.map(([, label]) => label)];
    for (const f of filas) data.push(COLUMNAS_290.map(([key]) => f[key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Libro de Vuelo');
    XLSX.writeFile(wb, `libro-de-vuelo-${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  async _exportarPdf() {
    const filas = await this._filasPlanas();
    if (!filas.length) { alert('No hay vuelos con esos filtros.'); return; }
    const agg = agregarVuelos(filas.map((f) => ({ ...f, aeronaves: { tarifa_hora_diurna: 0, tarifa_hora_nocturna: 0 } })));
    const ventana = window.open('', '_blank');
    ventana.document.write(`
      <html><head><title>Hoja de Libro de Vuelo — Res. ANAC 290/2012</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10px;margin:12px}
        h1{font-size:14px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #999;padding:3px 4px;white-space:nowrap}
        th{background:#eee}
        tfoot td{font-weight:bold;background:#f5f5f5}
      </style></head><body>
      <h1>Hoja de Libro de Vuelo de Pilotos — Res. ANAC 290/2012</h1>
      <table>
        <thead><tr>${COLUMNAS_290.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
        <tbody>
          ${filas.map((f) => `<tr>${COLUMNAS_290.map(([k]) => `<td>${f[k] ?? ''}</td>`).join('')}</tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="16">Totales del período</td>
            <td colspan="15">Total: ${agg.tiempo_total} hs · PIC: ${agg.total_pic} hs · Día: ${agg.total_dia} hs · Noche: ${agg.total_noche} hs · Travesía: ${agg.total_travesia} hs</td>
          </tr>
        </tfoot>
      </table>
      <script>window.print();</script>
      </body></html>
    `);
    ventana.document.close();
  },

  async _exportarJson() {
    const [vuelos, aeronaves, config, vencimientos] = await Promise.all([
      Repo.listarVuelos(), Repo.listarAeronaves(), Repo.listarConfigLicencia(), Repo.listarVencimientos(),
    ]);
    const backup = { generado: new Date().toISOString(), vuelos, aeronaves, config_licencia: config, vencimientos };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-libro-de-vuelo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

window.ViewExportar = ViewExportar;
