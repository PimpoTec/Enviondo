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
    const [aeronaves, vuelos] = await Promise.all([Repo.listarAeronaves(), Repo.listarVuelos()]);
    this.aeronaves = aeronaves;
    // Años con al menos un vuelo cargado — para el atajo de "Año" de abajo,
    // que completa Desde/Hasta solo (1/ene al 31/dic) en vez de tener que
    // poner las dos fechas a mano cada vez que se quiere exportar un año
    // entero (el caso más común, ya que la Hoja ANAC arma "un archivo por año").
    const anios = [...new Set(vuelos.map((v) => v.fecha.slice(0, 4)))].sort().reverse();

    main.innerHTML = `
      <div class="card">
        <h2>${Icons.download(18)} Exportar</h2>
        <div class="grid cols-4">
          <div class="field"><label>Año <span class="muted">(atajo)</span></label>
            <select id="ex-anio">
              <option value="">Elegí un año…</option>
              ${anios.map((a) => `<option value="${a}">${a}</option>`).join('')}
            </select>
          </div>
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

    document.getElementById('ex-anio').onchange = (e) => {
      const anio = e.target.value;
      document.getElementById('ex-desde').value = anio ? `${anio}-01-01` : '';
      document.getElementById('ex-hasta').value = anio ? `${anio}-12-31` : '';
    };
    document.getElementById('btn-export-anac').onclick = () => this._exportarAnac();
    document.getElementById('btn-export-xlsx').onclick = () => this._exportarXlsx();
    document.getElementById('btn-export-pdf').onclick = () => this._exportarPdf();
    document.getElementById('btn-export-json').onclick = () => this._exportarJson();
    document.getElementById('btn-ver-fichas').onclick = () => this._toggleFichas();
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
      ruta: ExportadorAnac.formatearRuta(v.desde, v.hasta),
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

  // PDF pixel-fiel al tamaño físico real del papel (35.5 × 16.5 cm),
  // reusando la misma plantilla (SPEC) y el mismo cálculo de arrastre de
  // totales que el exportador de Excel (ExportadorAnac.construirLibroAnualHtml)
  // — así los dos formatos siempre coinciden en los números. Se abre en una
  // pestaña nueva y dispara la impresión del navegador (elegís "Guardar
  // como PDF" en el diálogo); @page ya viene dimensionado al papel real,
  // así que no hace falta tocar nada en ese diálogo.
  async _exportarPdf() {
    const btn = document.getElementById('btn-export-pdf');
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = Icons.tag('download', 'Generando…');
    try {
      const filtros = await this._filtros();
      const [vuelos, datosPiloto] = await Promise.all([Repo.listarVuelos(filtros), Repo.getDatosPiloto()]);
      if (!vuelos.length) { UI.toast('No hay vuelos con esos filtros.', 'warn'); return; }

      // Mismo arrastre real que el Excel: todo lo volado ANTES del primer
      // vuelo exportado, para que "exportar desde tal fecha" no arranque en 0.
      const fechaMinima = vuelos.reduce((min, v) => (v.fecha < min ? v.fecha : min), vuelos[0].fecha);
      const anteriores = await Repo.listarVuelos({
        hasta: this._diaAnterior(fechaMinima), aeronave_id: filtros.aeronave_id, finalidad_vuelo: filtros.finalidad_vuelo,
      });
      let carry = {
        porColumna: ExportadorAnac.sumarColumnas(anteriores),
        grandTotal: Calc.round2(anteriores.reduce((s, v) => s + Calc.n(v.tiempo_total), 0)),
      };

      const porAnio = ExportadorAnac.agruparPorAnio(vuelos);
      const anios = Object.keys(porAnio).sort();
      let paginasHtml = [];
      for (const anio of anios) {
        const resultado = ExportadorAnac.construirLibroAnualHtml({ anio, vuelos: porAnio[anio], datosPiloto, carryInicial: carry });
        paginasHtml = paginasHtml.concat(resultado.paginasHtml);
        carry = resultado.estadoFinal; // el año siguiente sigue acumulando, no resetea
      }

      const { ancho, alto, margen } = ExportadorAnac.PAGINA_MM;
      const ventana = window.open('', '_blank');
      ventana.document.write(`
        <html><head><title>Hoja de Libro de Vuelo — Res. ANAC 290/2012</title>
        <style>
          @page { size: ${ancho}mm ${alto}mm; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
          .hoja { width: ${ancho}mm; height: ${alto}mm; padding: ${margen}mm; page-break-after: always; }
          .hoja:last-child { page-break-after: auto; }
          table { width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; }
          td { border: 1px solid #000; padding: 0 2px; overflow: hidden; text-align: center; vertical-align: middle;
               font-size: 6.5pt; line-height: 1.05; }
          td.cab { font-size: 5.3pt; font-weight: bold; }
          td.tot { font-weight: bold; }
          td.num { font-family: 'Courier New', monospace; }
          td.izq { text-align: left; }
          @media screen {
            body { background: #999; }
            .hoja { background: #fff; margin: 10px auto; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
          }
        </style></head><body>
        ${paginasHtml.join('')}
        <script>window.onload = () => window.print();</script>
        </body></html>
      `);
      ventana.document.close();
    } catch (err) {
      UI.toast('Error al generar el PDF: ' + (err.message || err), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
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
