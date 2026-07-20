// ============================================================================
// VISTA: BITÁCORA — tabla filtrable/ordenable, con edición y borrado.
// ============================================================================

const ViewBitacora = {
  vuelos: [],
  filasActuales: [],
  aeronaves: [],
  orden: { campo: 'fecha', asc: false },

  async render() {
    const main = document.getElementById('main-content');
    const [vuelos, aeronaves, vencimientos] = await Promise.all([
      Repo.listarVuelos(), Repo.listarAeronaves(), Repo.listarVencimientos(),
    ]);
    this.vuelos = vuelos;
    this.aeronaves = aeronaves;

    main.innerHTML = `
      <div class="card">
        <h2>${Icons.list(18)} Bitácora</h2>
        <div class="grid cols-4">
          <div class="field"><label>Desde</label><input type="date" id="fx-desde"></div>
          <div class="field"><label>Hasta</label><input type="date" id="fx-hasta"></div>
          <div class="field"><label>Aeronave</label>
            <select id="fx-aeronave"><option value="">Todas</option>
              ${this.aeronaves.map((a) => `<option value="${a.id}">${a.matricula}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Finalidad</label>
            <select id="fx-finalidad">
              <option value="">Todas</option>
              <option value="INST">INST — Instrucción</option>
              <option value="ADAP">ADAP — Adaptación</option>
              <option value="REDAP">REDAP — Readaptación</option>
              <option value="EXA">EXA — Examen</option>
              <option value="ENTT">ENTT — Entrenamiento</option>
              <option value="VP">VP — Vuelo privado</option>
            </select>
          </div>
        </div>
        <div class="btn-row"><button class="btn secondary" id="btn-filtrar">Filtrar</button><button class="btn ghost" id="btn-limpiar-filtro">Limpiar</button></div>
      </div>

      <div class="card">
        <div class="table-wrap"><table id="tabla-bitacora">
          <thead><tr>
            <th data-orden="fecha">Fecha</th><th>Ruta</th><th>Aeronave</th><th>Finalidad</th>
            <th class="num" data-orden="tiempo_total">Tiempo</th>
            <th class="num">Día/Noche</th><th class="num" data-orden="total_pic">PIC</th>
            <th class="num">Aterr.</th><th class="num">Costo</th><th></th>
          </tr></thead>
          <tbody id="tbody-bitacora"></tbody>
        </table></div>
      </div>

      <div class="grid cols-2">
        <div class="card" id="tarjeta-estado-licencia"></div>
        <div class="card seal-card">
          ${Icons.shieldCheck(28)}
          <p style="margin:4px 0 0;font-weight:600">Libro foliado y verificado</p>
          <p class="muted" style="margin:0">Formato conforme a ANAC Res. 290/2012</p>
        </div>
      </div>
    `;

    document.getElementById('btn-filtrar').onclick = () => this._aplicarFiltro();
    document.getElementById('btn-limpiar-filtro').onclick = () => this.render();
    document.querySelectorAll('#tabla-bitacora th[data-orden]').forEach((th) => {
      th.style.cursor = 'pointer';
      th.onclick = () => this._ordenarPor(th.dataset.orden);
    });

    this.filasActuales = this.vuelos;
    this._renderFilas(this.filasActuales);
    this._renderEstadoLicencia(this.vuelos, vencimientos);
  },

  async _aplicarFiltro() {
    const filtros = {
      desde: document.getElementById('fx-desde').value || undefined,
      hasta: document.getElementById('fx-hasta').value || undefined,
      aeronave_id: document.getElementById('fx-aeronave').value || undefined,
      finalidad_vuelo: document.getElementById('fx-finalidad').value || undefined,
    };
    const filtrados = await Repo.listarVuelos(filtros);
    this.filasActuales = filtrados;
    this._renderFilas(this.filasActuales);
  },

  // Ordena el conjunto que se está mostrando ahora (filtrado o completo), no
  // siempre la lista entera — así ordenar no descarta el filtro aplicado.
  _ordenarPor(campo) {
    this.orden.asc = this.orden.campo === campo ? !this.orden.asc : false;
    this.orden.campo = campo;
    const filas = [...this.filasActuales].sort((a, b) => {
      const va = a[campo], vb = b[campo];
      return (va > vb ? 1 : va < vb ? -1 : 0) * (this.orden.asc ? 1 : -1);
    });
    this.filasActuales = filas;
    this._renderFilas(filas);
  },

  _renderFilas(vuelos) {
    const tbody = document.getElementById('tbody-bitacora');
    if (!vuelos.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-state">Sin vuelos con esos filtros.</td></tr>`;
      return;
    }
    tbody.innerHTML = vuelos.map((v) => `
      <tr>
        <td>${fmtFecha(v.fecha)}</td>
        <td>${v.desde} → ${v.hasta}</td>
        <td>${v.aeronaves?.matricula || '—'}</td>
        <td>${v.finalidad_vuelo}</td>
        <td class="num">${v.tiempo_total}</td>
        <td class="num">${v.total_dia} / ${v.total_noche}</td>
        <td class="num">${v.total_pic}</td>
        <td class="num">${v.aterrizajes_dia}d / ${v.aterrizajes_noche}n</td>
        <td class="num">${fmtMoneda(Calc.calcularCosto(v, v.aeronaves), v.aeronaves?.moneda)}</td>
        <td>
          <button class="btn ghost" onclick="Router.irA('nuevo-vuelo?editar=${v.id}')">${Icons.edit(16)}</button>
          <button class="btn ghost" onclick="ViewBitacora._borrar('${v.id}')">${Icons.trash(16)}</button>
        </td>
      </tr>
    `).join('');
  },

  _renderEstadoLicencia(vuelos, vencimientos) {
    const cont = document.getElementById('tarjeta-estado-licencia');
    const hace90 = new Date(); hace90.setDate(hace90.getDate() - 90);
    const horas90 = vuelos
      .filter((v) => new Date(v.fecha) >= hace90)
      .reduce((s, v) => s + Calc.n(v.tiempo_total), 0);
    const proximo = vencimientos
      .filter((v) => new Date(v.fecha_vencimiento + 'T00:00:00') >= new Date(new Date().toDateString()))
      .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0];
    const pct = Math.min(100, Calc.round2((horas90 / 40) * 100));

    cont.innerHTML = `
      <h3>${Icons.idCard(16)} Estado de licencia</h3>
      <div class="license-stat-row"><span class="muted">Últimos 90 días</span><span class="value">${Calc.round2(horas90)} hs</span></div>
      <div class="progreso-bar" style="margin-bottom:10px"><span style="width:${pct}%"></span></div>
      <p class="muted" style="margin:0">${proximo ? `Próximo vencimiento: ${proximo.tipo} — ${fmtFecha(proximo.fecha_vencimiento)}` : 'Sin vencimientos próximos cargados.'}</p>
    `;
  },

  async _borrar(id) {
    if (!confirm('¿Borrar este vuelo? Queda en la Papelera (Perfil) por si lo querés restaurar.')) return;
    try {
      await Repo.borrarVuelo(id);
      this.render();
    } catch (err) {
      alert('Error al borrar: ' + (err.message || err));
    }
  },
};

window.ViewBitacora = ViewBitacora;
