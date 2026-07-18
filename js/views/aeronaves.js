// ============================================================================
// VISTA: AERONAVES — ABM de fichas con tarifas diurna/nocturna.
// ============================================================================

const CLASES_AERONAVE = [
  { valor: 'monomotor', label: 'Monomotor' },
  { valor: 'multimotor', label: 'Multimotor' },
  { valor: 'reactor', label: 'Reactor' },
  { valor: 'turbohelice', label: 'Turbohélice' },
  { valor: 'aeroaplicador', label: 'Aeroaplicador' },
];

const ViewAeronaves = {
  editandoId: null,

  async render() {
    const main = document.getElementById('main-content');
    const aeronaves = await Repo.listarAeronaves();

    main.innerHTML = `
      <div class="card">
        <h2 id="titulo-form-aeronave">🛩️ Nueva aeronave</h2>
        <div class="grid cols-2">
          <div class="field"><label>Matrícula</label><input id="a-matricula" placeholder="LV-ABC"></div>
          <div class="field"><label>Modelo</label><input id="a-marca" placeholder="Cessna 152"></div>
          <div class="field"><label>Potencia</label><input id="a-potencia" placeholder="110 HP"></div>
          <div class="field"><label>Clase</label>
            <select id="a-clase">
              ${CLASES_AERONAVE.map((c) => `<option value="${c.valor}">${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Medio</label>
            <select id="a-medio"><option value="terrestre">Terrestre</option><option value="hidro">Hidro</option><option value="anfibio">Anfibio</option></select>
          </div>
          <div class="field"><label>Tarifa hora diurna</label><input type="number" step="0.01" min="0" id="a-tarifa-dia" value="0"></div>
          <div class="field"><label>Tarifa hora nocturna</label><input type="number" step="0.01" min="0" id="a-tarifa-noche" value="0"></div>
          <div class="field"><label>Moneda</label><input id="a-moneda" value="ARS"></div>
          <div class="field">
            <label>&nbsp;</label>
            <label style="display:flex;align-items:center;gap:8px;font-weight:400;color:var(--text)">
              <input type="checkbox" id="a-habitual" style="width:auto"> Es un avión que suelo volar
            </label>
          </div>
        </div>
        <div class="field"><label>Notas</label><textarea id="a-notas" rows="2"></textarea></div>
        <div class="btn-row">
          <button class="btn" id="btn-guardar-aeronave">Guardar</button>
          <button class="btn secondary" id="btn-cancelar-aeronave" style="display:none">Cancelar edición</button>
        </div>
      </div>

      <div class="card">
        <h2>Tus aeronaves</h2>
        <div class="table-wrap"><table>
          <thead><tr><th>Matrícula</th><th>Modelo</th><th>Clase</th><th class="num">Tarifa día</th><th class="num">Tarifa noche</th><th>Habitual</th><th></th></tr></thead>
          <tbody id="tbody-aeronaves"></tbody>
        </table></div>
      </div>
    `;

    document.getElementById('btn-guardar-aeronave').onclick = () => this._guardar();
    document.getElementById('btn-cancelar-aeronave').onclick = () => this.render();

    this._renderTabla(aeronaves);
  },

  _labelClase(valor) {
    return CLASES_AERONAVE.find((c) => c.valor === valor)?.label || valor;
  },

  _renderTabla(aeronaves) {
    const tbody = document.getElementById('tbody-aeronaves');
    if (!aeronaves.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Todavía no cargaste ninguna aeronave.</td></tr>`;
      return;
    }
    tbody.innerHTML = aeronaves.map((a) => `
      <tr>
        <td>${a.matricula}</td>
        <td>${a.marca_modelo}</td>
        <td>${this._labelClase(a.clase)}</td>
        <td class="num">${fmtMoneda(a.tarifa_hora_diurna, a.moneda)}</td>
        <td class="num">${fmtMoneda(a.tarifa_hora_nocturna, a.moneda)}</td>
        <td>${a.es_habitual ? '⭐' : ''}</td>
        <td>
          <button class="btn ghost" onclick='ViewAeronaves._editar(${JSON.stringify(a).replace(/'/g, "&apos;")})'>✏️</button>
          <button class="btn ghost" onclick="ViewAeronaves._borrar('${a.id}')">🗑️</button>
        </td>
      </tr>
    `).join('');
  },

  _editar(a) {
    this.editandoId = a.id;
    document.getElementById('titulo-form-aeronave').textContent = `✏️ Editando ${a.matricula}`;
    document.getElementById('a-matricula').value = a.matricula;
    document.getElementById('a-marca').value = a.marca_modelo;
    document.getElementById('a-potencia').value = a.potencia || '';
    document.getElementById('a-clase').value = a.clase || 'monomotor';
    document.getElementById('a-medio').value = a.medio;
    document.getElementById('a-tarifa-dia').value = a.tarifa_hora_diurna;
    document.getElementById('a-tarifa-noche').value = a.tarifa_hora_nocturna;
    document.getElementById('a-moneda').value = a.moneda;
    document.getElementById('a-habitual').checked = a.es_habitual;
    document.getElementById('a-notas').value = a.notas || '';
    document.getElementById('btn-cancelar-aeronave').style.display = 'inline-flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  async _guardar() {
    const matricula = document.getElementById('a-matricula').value.trim().toUpperCase();
    const marca_modelo = document.getElementById('a-marca').value.trim();
    if (!matricula || !marca_modelo) { alert('Matrícula y modelo son obligatorios.'); return; }

    const aeronave = {
      id: this.editandoId || undefined,
      matricula, marca_modelo,
      potencia: document.getElementById('a-potencia').value || null,
      clase: document.getElementById('a-clase').value,
      medio: document.getElementById('a-medio').value,
      tarifa_hora_diurna: Calc.n(document.getElementById('a-tarifa-dia').value),
      tarifa_hora_nocturna: Calc.n(document.getElementById('a-tarifa-noche').value),
      moneda: document.getElementById('a-moneda').value || 'ARS',
      es_habitual: document.getElementById('a-habitual').checked,
      notas: document.getElementById('a-notas').value || null,
    };

    try {
      await Repo.guardarAeronave(aeronave);
      this.editandoId = null;
      this.render();
    } catch (err) {
      alert('Error al guardar: ' + (err.message || err));
    }
  },

  async _borrar(id) {
    if (!confirm('¿Borrar esta aeronave? Si tiene vuelos cargados, no se va a poder borrar.')) return;
    try {
      await Repo.borrarAeronave(id);
      this.render();
    } catch (err) {
      alert('No se pudo borrar: ' + (err.message || err));
    }
  },
};

window.ViewAeronaves = ViewAeronaves;
