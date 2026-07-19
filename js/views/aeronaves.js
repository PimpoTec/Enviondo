// ============================================================================
// VISTA: AERONAVES — ABM de fichas con tarifas diurna/nocturna.
// También viven acá los "simuladores" (adiestrador terrestre), con una
// ficha simplificada: nombre, modelo y tarifa por hora nomás.
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
  tipo: 'aeronave', // 'aeronave' | 'simulador'
  mostrandoForm: false,

  async render() {
    const main = document.getElementById('main-content');
    const aeronaves = await Repo.listarAeronaves();

    main.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="margin:0">Tus aeronaves y simuladores</h2>
          <button class="btn" id="btn-mostrar-form">+ Agregar</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Matrícula / Nombre</th><th>Modelo</th><th>Clase</th><th class="num">Tarifa día</th><th class="num">Tarifa noche</th><th>Habitual</th><th></th></tr></thead>
          <tbody id="tbody-aeronaves"></tbody>
        </table></div>
      </div>

      <div class="card" id="card-form-aeronave" style="display:${this.mostrandoForm ? 'block' : 'none'}">
        <h2 id="titulo-form-aeronave">${Icons.plane(18)} Nueva ficha</h2>

        <div class="field" style="margin-bottom:16px">
          <div class="toggle-group">
            <button type="button" id="tg-tipo-aeronave" class="${this.tipo === 'aeronave' ? 'active' : ''}">${Icons.tag('plane', 'Aeronave')}</button>
            <button type="button" id="tg-tipo-simulador" class="${this.tipo === 'simulador' ? 'active' : ''}">${Icons.tag('monitor', 'Simulador')}</button>
          </div>
        </div>

        <div id="form-aeronave"></div>
      </div>
    `;

    document.getElementById('btn-mostrar-form').onclick = () => {
      this.editandoId = null;
      this.mostrandoForm = true;
      document.getElementById('card-form-aeronave').style.display = 'block';
      this._renderForm();
      document.getElementById('card-form-aeronave').scrollIntoView({ behavior: 'smooth' });
    };
    document.getElementById('tg-tipo-aeronave').onclick = () => { this.tipo = 'aeronave'; this.editandoId = null; this._renderForm(); };
    document.getElementById('tg-tipo-simulador').onclick = () => { this.tipo = 'simulador'; this.editandoId = null; this._renderForm(); };

    if (this.mostrandoForm) this._renderForm();
    this._renderTabla(aeronaves);
  },

  _renderForm() {
    const cont = document.getElementById('form-aeronave');
    document.getElementById('titulo-form-aeronave').innerHTML = this.tipo === 'simulador' ? Icons.tag('monitor', 'Nuevo simulador') : Icons.tag('plane', 'Nueva aeronave');

    if (this.tipo === 'simulador') {
      cont.innerHTML = `
        <div class="grid cols-2">
          <div class="field"><label>Nombre del simulador</label><input id="a-matricula" placeholder="SIM-01"></div>
          <div class="field"><label>Modelo</label><input id="a-marca" placeholder="Redbird FMX"></div>
          <div class="field"><label>Tarifa por hora</label><input type="number" step="0.01" min="0" id="a-tarifa-dia" value="0"></div>
          <div class="field"><label>Moneda</label><input id="a-moneda" value="ARS"></div>
        </div>
        <div class="btn-row">
          <button class="btn" id="btn-guardar-aeronave">Guardar</button>
          <button class="btn secondary" id="btn-cancelar-aeronave">Cancelar</button>
        </div>
      `;
    } else {
      cont.innerHTML = `
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
          <button class="btn secondary" id="btn-cancelar-aeronave">Cancelar</button>
        </div>
      `;
    }

    document.getElementById('btn-guardar-aeronave').onclick = () => this._guardar();
    document.getElementById('btn-cancelar-aeronave').onclick = () => { this.editandoId = null; this.mostrandoForm = false; this.render(); };
  },

  _labelClase(a) {
    if (a.es_simulador) return 'Simulador';
    return CLASES_AERONAVE.find((c) => c.valor === a.clase)?.label || a.clase;
  },

  _renderTabla(aeronaves) {
    const tbody = document.getElementById('tbody-aeronaves');
    if (!aeronaves.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Todavía no cargaste ninguna aeronave.</td></tr>`;
      return;
    }
    tbody.innerHTML = aeronaves.map((a) => `
      <tr>
        <td>${a.es_simulador ? Icons.monitor(14) + ' ' : ''}${a.matricula}</td>
        <td>${a.marca_modelo}</td>
        <td>${this._labelClase(a)}</td>
        <td class="num">${fmtMoneda(a.tarifa_hora_diurna, a.moneda)}</td>
        <td class="num">${a.es_simulador ? '—' : fmtMoneda(a.tarifa_hora_nocturna, a.moneda)}</td>
        <td>${a.es_habitual ? Icons.star(14) : ''}</td>
        <td>
          <button class="btn ghost" onclick='ViewAeronaves._editar(${JSON.stringify(a).replace(/'/g, "&apos;")})'>${Icons.edit(16)}</button>
          <button class="btn ghost" onclick="ViewAeronaves._borrar('${a.id}')">${Icons.trash(16)}</button>
        </td>
      </tr>
    `).join('');
  },

  async _editar(a) {
    this.editandoId = a.id;
    this.tipo = a.es_simulador ? 'simulador' : 'aeronave';
    this.mostrandoForm = true;
    await this.render();

    document.getElementById('titulo-form-aeronave').innerHTML = Icons.tag('edit', `Editando ${a.matricula}`);
    document.getElementById('a-matricula').value = a.matricula;
    document.getElementById('a-marca').value = a.marca_modelo;
    document.getElementById('a-tarifa-dia').value = a.tarifa_hora_diurna;
    document.getElementById('a-moneda').value = a.moneda;
    if (this.tipo === 'aeronave') {
      document.getElementById('a-potencia').value = a.potencia || '';
      document.getElementById('a-clase').value = a.clase || 'monomotor';
      document.getElementById('a-medio').value = a.medio;
      document.getElementById('a-tarifa-noche').value = a.tarifa_hora_nocturna;
      document.getElementById('a-habitual').checked = a.es_habitual;
      document.getElementById('a-notas').value = a.notas || '';
    }
    document.getElementById('card-form-aeronave').scrollIntoView({ behavior: 'smooth' });
  },

  async _guardar() {
    const matricula = document.getElementById('a-matricula').value.trim().toUpperCase();
    const marca_modelo = document.getElementById('a-marca').value.trim();
    if (!matricula || !marca_modelo) {
      alert(this.tipo === 'simulador' ? 'Nombre y modelo son obligatorios.' : 'Matrícula y modelo son obligatorios.');
      return;
    }

    let aeronave;
    if (this.tipo === 'simulador') {
      const tarifa = Calc.n(document.getElementById('a-tarifa-dia').value);
      aeronave = {
        id: this.editandoId || undefined,
        matricula, marca_modelo,
        potencia: null, clase: 'simulador', medio: 'terrestre',
        tarifa_hora_diurna: tarifa, tarifa_hora_nocturna: tarifa,
        moneda: document.getElementById('a-moneda').value || 'ARS',
        es_habitual: false, es_simulador: true, notas: null,
      };
    } else {
      aeronave = {
        id: this.editandoId || undefined,
        matricula, marca_modelo,
        potencia: document.getElementById('a-potencia').value || null,
        clase: document.getElementById('a-clase').value,
        medio: document.getElementById('a-medio').value,
        tarifa_hora_diurna: Calc.n(document.getElementById('a-tarifa-dia').value),
        tarifa_hora_nocturna: Calc.n(document.getElementById('a-tarifa-noche').value),
        moneda: document.getElementById('a-moneda').value || 'ARS',
        es_habitual: document.getElementById('a-habitual').checked,
        es_simulador: false,
        notas: document.getElementById('a-notas').value || null,
      };
    }

    try {
      await Repo.guardarAeronave(aeronave);
      this.editandoId = null;
      this.mostrandoForm = false;
      this.render();
    } catch (err) {
      alert('Error al guardar: ' + (err.message || err));
    }
  },

  async _borrar(id) {
    if (!confirm('¿Borrar esta ficha? Si tiene vuelos cargados, no se va a poder borrar.')) return;
    try {
      await Repo.borrarAeronave(id);
      this.render();
    } catch (err) {
      alert('No se pudo borrar: ' + (err.message || err));
    }
  },
};

window.ViewAeronaves = ViewAeronaves;
