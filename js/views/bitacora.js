// ============================================================================
// VISTA: BITÁCORA — tabla filtrable/ordenable, con edición y borrado.
// ============================================================================

const ViewBitacora = {
  vuelos: [],
  aeronaves: [],
  orden: { campo: 'fecha', asc: false },

  async render() {
    const main = document.getElementById('main-content');
    [this.vuelos, this.aeronaves] = await Promise.all([Repo.listarVuelos(), Repo.listarAeronaves()]);

    main.innerHTML = `
      <div class="card">
        <h2>📒 Bitácora</h2>
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
    `;

    document.getElementById('btn-filtrar').onclick = () => this._aplicarFiltro();
    document.getElementById('btn-limpiar-filtro').onclick = () => this.render();
    document.querySelectorAll('#tabla-bitacora th[data-orden]').forEach((th) => {
      th.style.cursor = 'pointer';
      th.onclick = () => this._ordenarPor(th.dataset.orden);
    });

    this._renderFilas(this.vuelos);
  },

  async _aplicarFiltro() {
    const filtros = {
      desde: document.getElementById('fx-desde').value || undefined,
      hasta: document.getElementById('fx-hasta').value || undefined,
      aeronave_id: document.getElementById('fx-aeronave').value || undefined,
      finalidad_vuelo: document.getElementById('fx-finalidad').value || undefined,
    };
    const filtrados = await Repo.listarVuelos(filtros);
    this._renderFilas(filtrados);
  },

  _ordenarPor(campo) {
    this.orden.asc = this.orden.campo === campo ? !this.orden.asc : false;
    this.orden.campo = campo;
    const filas = [...this.vuelos].sort((a, b) => {
      const va = a[campo], vb = b[campo];
      return (va > vb ? 1 : va < vb ? -1 : 0) * (this.orden.asc ? 1 : -1);
    });
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
          <button class="btn ghost" onclick="Router.irA('nuevo-vuelo?editar=${v.id}')">✏️</button>
          <button class="btn ghost" onclick="ViewBitacora._borrar('${v.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  },

  async _borrar(id) {
    if (!confirm('¿Borrar este vuelo? No se puede deshacer.')) return;
    try {
      await Repo.borrarVuelo(id);
      this.render();
    } catch (err) {
      alert('Error al borrar: ' + (err.message || err));
    }
  },
};

window.ViewBitacora = ViewBitacora;
