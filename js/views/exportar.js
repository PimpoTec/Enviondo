// ============================================================================
// VISTA: EXPORTAR — Excel (.xlsx), PDF simple (layout tabular 290/2012 vía
// impresión del navegador) y backup completo en JSON.
// ============================================================================

const COLUMNAS_290 = [
  ['fecha', 'Fecha'], ['hora_salida_utc', 'Hora salida'], ['ruta', 'Desde / Hasta'], ['hora_llegada_utc', 'Hora llegada'],
  ['finalidad_vuelo', 'Finalidad'], ['matricula', 'Matrícula'], ['marca_modelo', 'Marca/Modelo'],
  ['saero_dia_piloto', 'S/Aeródromo Día Piloto'], ['saero_dia_copiloto', 'S/Aeródromo Día Copiloto'],
  ['saero_noche_piloto', 'S/Aeródromo Noche Piloto'], ['saero_noche_copiloto', 'S/Aeródromo Noche Copiloto'],
  ['trav_dia_piloto', 'Travesía Día Piloto'], ['trav_dia_copiloto', 'Travesía Día Copiloto'],
  ['trav_noche_piloto', 'Travesía Noche Piloto'], ['trav_noche_copiloto', 'Travesía Noche Copiloto'],
  ['tiempo_total', 'Tiempo Total'], ['aterrizajes_dia', 'Aterr. Día'], ['aterrizajes_noche', 'Aterr. Noche'], ['remolques', 'Remolques'],
  ['instruccion_vuelo', 'Instrucción'], ['multimotor', 'Multimotor'], ['reactor', 'Reactor'], ['turbohelice', 'Turbohélice'],
  ['aeroaplicador', 'Aeroaplicador'], ['instrumentos_real', 'Instrumentos Real'], ['instrumentos_capota', 'Instrumentos Capota'],
  ['adiestrador_simulador', 'Adiestrador/Simulador'], ['instructor_nombre', 'Instructor'], ['instructor_matricula', 'Mat. Instructor'],
  ['observaciones', 'Observaciones'], ['costo', 'Costo'],
];

const ViewExportar = {
  aeronaves: [],

  async render() {
    const main = document.getElementById('main-content');
    const [aeronaves, vuelos, cursosActivos] = await Promise.all([
      Repo.listarAeronaves(), Repo.listarVuelos(), Repo.getCursosActivos(),
    ]);
    this.aeronaves = aeronaves;

    // ---- Resumen de costos (antes vivía en su propia pantalla; ahora se ve
    // acá, junto a la exportación) ----
    const configsPorCurso = await Promise.all(cursosActivos.map((id) => Repo.listarConfigLicencia(id)));
    const agg = agregarVuelos(vuelos);
    const costoPromedioHora = agg.tiempo_total > 0 ? Calc.round2(agg.costo_total / agg.tiempo_total) : 0;
    const reqsTotal = configsPorCurso.flat().filter((c) => c.nombre_requisito === 'total');
    const reqTotal = reqsTotal.length ? reqsTotal.reduce((a, b) => (Calc.n(b.minimo_horas) > Calc.n(a.minimo_horas) ? b : a)) : null;
    const curso = CURSOS.find((c) => c.id === reqTotal?.curso_id) || CURSOS.find((c) => c.id === cursosActivos[0]) || CURSOS[1];
    const horasFaltantes = reqTotal ? Math.max(0, Calc.round2(Calc.n(reqTotal.minimo_horas) - agg.tiempo_total)) : 0;
    const proyeccion = Calc.round2(horasFaltantes * costoPromedioHora);

    main.innerHTML = `
      <div class="card">
        <h2>${Icons.dollar(18)} Costos de la carrera</h2>
        <div class="grid cols-3">
          <div class="stat"><div class="num">${fmtMoneda(agg.costo_total)}</div><div class="lbl">Gastado total</div></div>
          <div class="stat"><div class="num">${fmtMoneda(costoPromedioHora)}</div><div class="lbl">Promedio / hora</div></div>
          <div class="stat"><div class="num">${fmtMoneda(proyeccion)}</div><div class="lbl">Falta para ${curso.id}</div></div>
        </div>
        <p class="muted" style="margin-top:8px">Proyección: faltan ${horasFaltantes} hs para el total de ${curso.label}, al costo promedio por hora de hasta ahora. Lo que volaste en aeronaves que cobran en dólares ya quedó convertido a pesos al valor del día en que lo cargaste.</p>
        <div class="grid cols-2" style="margin-top:6px">
          <div>
            <h3 style="margin-top:8px">${Icons.barChart(16)} Gasto por mes</h3>
            <div id="gasto-mes"></div>
          </div>
          <div>
            <h3 style="margin-top:8px">${Icons.plane(16)} Costo por aeronave</h3>
            <div id="gasto-aeronave"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>${Icons.download(18)} Exportar</h2>
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
              <option value="INST">INST — Instrucción</option><option value="ADAP">ADAP — Adaptación</option>
              <option value="REDAP">REDAP — Readaptación</option><option value="EXA">EXA — Examen</option>
              <option value="ENTT">ENTT — Entrenamiento</option><option value="VP">VP — Vuelo privado</option>
            </select>
          </div>
        </div>

        <div class="btn-row" style="margin-top:10px">
          <button class="btn" id="btn-export-anac">${Icons.tag('idCard', 'Hoja ANAC 290/2012 (.xlsx)')}</button>
          <button class="btn secondary" id="btn-export-xlsx">${Icons.tag('barChart', 'Planilla simple (.xlsx)')}</button>
          <button class="btn secondary" id="btn-export-pdf">${Icons.tag('print', 'PDF (columnas 290/2012)')}</button>
          <button class="btn secondary" id="btn-export-json">${Icons.tag('archive', 'Backup JSON completo')}</button>
        </div>
        <p class="muted" style="margin-top:8px">La <strong>Hoja ANAC</strong> reproduce el formulario oficial (35,5×16,5 cm): 15 renglones por hoja, totales que se arrastran a la siguiente y <strong>un archivo por año</strong>. Completá tus datos de piloto en Perfil para que salga la cabecera. La "planilla simple" es la misma info en una tabla plana para analizar.</p>
      </div>

      <div class="card">
        <h2>${Icons.idCard(18)} Ficha para cargar en cad.anac.gob.ar</h2>
        <p class="muted">No tengo acceso al formulario online de ANAC (pide tu login) para calzar los campos exactos, así que esta ficha usa el formato oficial 290/2012 (mismo orden de columnas del PDF/Excel) — un vuelo a la vez, en grande, para tenerla al lado mientras cargás en la web de ANAC. Si el formulario online pide los datos en otro orden o con otros nombres, contame y la ajusto.</p>
        <button class="btn secondary" id="btn-ver-fichas">${Icons.tag('list', 'Ver fichas por vuelo')}</button>
        <div id="fichas-anac" style="display:none;margin-top:14px"></div>
      </div>
    `;

    document.getElementById('btn-export-anac').onclick = () => this._exportarAnac();
    document.getElementById('btn-export-xlsx').onclick = () => this._exportarXlsx();
    document.getElementById('btn-export-pdf').onclick = () => this._exportarPdf();
    document.getElementById('btn-export-json').onclick = () => this._exportarJson();
    document.getElementById('btn-ver-fichas').onclick = () => this._toggleFichas();

    // Desgloses de costo (funciones compartidas con la vista de costos).
    renderGastoPorMes(vuelos);
    renderGastoPorAeronave(vuelos);
  },

  async _toggleFichas() {
    const cont = document.getElementById('fichas-anac');
    const visible = cont.style.display !== 'none';
    if (visible) { cont.style.display = 'none'; return; }
    const filas = await this._filasPlanas();
    if (!filas.length) { UI.toast('No hay vuelos con esos filtros.', 'warn'); return; }
    this._fichasFilas = filas;
    this._fichaIndex = 0;
    cont.style.display = 'block';
    this._renderFicha();
  },

  _renderFicha() {
    const cont = document.getElementById('fichas-anac');
    const filas = this._fichasFilas;
    const i = this._fichaIndex;
    const f = filas[i];
    const esLocal = f.desde === f.hasta;
    cont.innerHTML = `
      <div class="doc-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span class="muted">Vuelo ${i + 1} de ${filas.length}</span>
          <span class="muted">${fmtFecha(f.fecha)} · ${esLocal ? f.desde : `${f.desde} → ${f.hasta}`}</span>
        </div>
        <div class="table-wrap"><table>
          ${COLUMNAS_290.filter(([k]) => f[k] !== null && f[k] !== undefined && f[k] !== '' && f[k] !== 0).map(([k, label]) => `
            <tr><td class="muted" style="white-space:nowrap">${label}</td><td style="font-family:var(--font-mono)">${f[k]}</td></tr>
          `).join('')}
        </table></div>
      </div>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn secondary" id="btn-ficha-prev" ${i === 0 ? 'disabled' : ''}>← Anterior</button>
        <button class="btn secondary" id="btn-ficha-next" ${i === filas.length - 1 ? 'disabled' : ''}>Siguiente →</button>
      </div>
    `;
    document.getElementById('btn-ficha-prev').onclick = () => { this._fichaIndex--; this._renderFicha(); };
    document.getElementById('btn-ficha-next').onclick = () => { this._fichaIndex++; this._renderFicha(); };
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
      // Una sola columna de ruta: si es local (mismo aeródromo) no repite el
      // código dos veces.
      ruta: v.desde === v.hasta ? v.desde : `${v.desde}-${v.hasta}`,
      matricula: v.aeronaves?.matricula, marca_modelo: v.aeronaves?.marca_modelo,
      costo: Calc.costoRegistrado(v, v.aeronaves).monto,
    }));
  },

  // Un día antes de una fecha ISO 'YYYY-MM-DD', en formato ISO (fecha local,
  // sin líos de huso horario).
  _diaAnterior(iso) {
    const d = Calc.parseFechaLocal(iso);
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  async _exportarAnac() {
    if (typeof ExcelJS === 'undefined') {
      UI.toast('No se pudo cargar la librería de Excel (revisá tu conexión).', 'error');
      return;
    }
    const btn = document.getElementById('btn-export-anac');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = Icons.tag('download', 'Generando…');
    try {
      const filtros = await this._filtros();
      const [vuelos, datosPiloto] = await Promise.all([Repo.listarVuelos(filtros), Repo.getDatosPiloto()]);
      if (!vuelos.length) { UI.toast('No hay vuelos con esos filtros.', 'warn'); return; }

      // Arrastre real: todo lo volado ANTES del primer vuelo exportado (mismo
      // filtro de aeronave/finalidad si se aplicó, sin límite de fecha
      // inferior) — así "exportar desde tal fecha" no arranca en 0, sino con
      // las horas que ya tenías acumuladas hasta ese momento.
      const fechaMinima = vuelos.reduce((min, v) => (v.fecha < min ? v.fecha : min), vuelos[0].fecha);
      const anteriores = await Repo.listarVuelos({
        hasta: this._diaAnterior(fechaMinima),
        aeronave_id: filtros.aeronave_id,
        finalidad_vuelo: filtros.finalidad_vuelo,
      });
      let carry = {
        porColumna: ExportadorAnac.sumarColumnas(anteriores),
        grandTotal: Calc.round2(anteriores.reduce((s, v) => s + Calc.n(v.tiempo_total), 0)),
      };

      const porAnio = ExportadorAnac.agruparPorAnio(vuelos);
      const anios = Object.keys(porAnio).sort();
      for (const anio of anios) {
        const { workbook, estadoFinal } = ExportadorAnac.construirLibroAnual(ExcelJS, {
          anio, vuelos: porAnio[anio], datosPiloto, carryInicial: carry,
        });
        carry = estadoFinal; // el año siguiente sigue acumulando, no resetea
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `libro-de-vuelo-${anio}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        // Pequeña pausa entre descargas para que el navegador no las bloquee.
        if (anios.length > 1) await new Promise((r) => setTimeout(r, 400));
      }
      UI.toast(anios.length > 1 ? `Se generaron ${anios.length} archivos (uno por año).` : 'Hoja generada.', 'ok');
    } catch (err) {
      UI.toast('Error al generar la hoja: ' + (err.message || err), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  },

  async _exportarXlsx() {
    const filas = await this._filasPlanas();
    if (!filas.length) { UI.toast('No hay vuelos con esos filtros.', 'warn'); return; }
    const data = [COLUMNAS_290.map(([, label]) => label)];
    for (const f of filas) data.push(COLUMNAS_290.map(([key]) => f[key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Libro de Vuelo');
    XLSX.writeFile(wb, `libro-de-vuelo-${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  async _exportarPdf() {
    const filas = await this._filasPlanas();
    if (!filas.length) { UI.toast('No hay vuelos con esos filtros.', 'warn'); return; }
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
    const [vuelos, aeronaves, config, vencimientos, programados] = await Promise.all([
      Repo.listarVuelos(), Repo.listarAeronaves(), Repo.listarConfigLicenciaTodos(), Repo.listarVencimientos(),
      Repo.listarVuelosProgramados(),
    ]);
    const backup = { generado: new Date().toISOString(), vuelos, aeronaves, config_licencia: config, vencimientos, vuelos_programados: programados };
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
