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
  aeronaves: [],

  async render() {
    const main = document.getElementById('main-content');
    const aeronaves = await Repo.listarAeronaves();
    this.aeronaves = aeronaves;

    const total = aeronaves.length;
    const simuladores = aeronaves.filter((a) => a.es_simulador).length;
    const habituales = aeronaves.filter((a) => a.es_habitual).length;

    main.innerHTML = `
      <div class="flota-header">
        <div>
          <h2 style="margin:0 0 2px">Flota de aeronaves</h2>
          <p class="muted" style="margin:0">Tus aeronaves y simuladores, con sus tarifas horarias.</p>
        </div>
        <button class="btn" id="btn-mostrar-form">${Icons.plusCircle(16)} Agregar</button>
      </div>

      <div class="flota-stats">
        <div class="flota-stat"><p class="flota-stat-label">Total</p><p class="flota-stat-valor">${total}</p></div>
        <div class="flota-stat flota-stat-accent"><p class="flota-stat-label">Aeronaves</p><p class="flota-stat-valor">${total - simuladores}</p></div>
        <div class="flota-stat"><p class="flota-stat-label">Simuladores</p><p class="flota-stat-valor">${simuladores}</p></div>
        <div class="flota-stat"><p class="flota-stat-label">Preferidas</p><p class="flota-stat-valor">${habituales}</p></div>
      </div>

      <div class="aeronave-grid" id="grid-aeronaves"></div>

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
    this._renderGrid(aeronaves);
  },

  _renderForm() {
    const cont = document.getElementById('form-aeronave');
    document.getElementById('titulo-form-aeronave').innerHTML = this.tipo === 'simulador' ? Icons.tag('monitor', 'Nuevo simulador') : Icons.tag('plane', 'Nueva aeronave');

    if (this.tipo === 'simulador') {
      cont.innerHTML = `
        <div class="grid cols-2">
          <div class="field"><label>Nombre del simulador</label><input id="a-matricula" placeholder="SIM-01"></div>
          <div class="field"><label>Modelo</label><input id="a-marca" placeholder="Redbird FMX"></div>
          <div class="field"><label>Tarifa por hora</label><input type="number" inputmode="decimal" step="0.01" min="0" id="a-tarifa-dia" value="0"></div>
          <div class="field"><label>Moneda</label>
            <select id="a-moneda">
              <option value="ARS">ARS — Pesos</option>
              <option value="USD">USD — Dólares (se convierte a pesos al blue)</option>
            </select>
          </div>
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
          <div class="field"><label>Tarifa hora diurna</label><input type="number" inputmode="decimal" step="0.01" min="0" id="a-tarifa-dia" value="0"></div>
          <div class="field"><label>Tarifa hora nocturna</label><input type="number" inputmode="decimal" step="0.01" min="0" id="a-tarifa-noche" value="0"></div>
          <div class="field"><label>Moneda</label>
            <select id="a-moneda">
              <option value="ARS">ARS — Pesos</option>
              <option value="USD">USD — Dólares (se convierte a pesos al blue)</option>
            </select>
          </div>
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

  _renderGrid(aeronaves) {
    const grid = document.getElementById('grid-aeronaves');
    const tarjetas = aeronaves.map((a) => `
      <div class="aeronave-card">
        <div class="aeronave-card-top">
          <span class="aeronave-card-icono">${a.es_simulador ? Icons.monitor(28) : Icons.plane(28)}</span>
          <span class="aeronave-card-matricula">${a.matricula}</span>
        </div>
        <div class="aeronave-card-body">
          <div class="aeronave-card-titulo">
            <div>
              <h3>${a.marca_modelo}</h3>
              <p class="muted">${a.es_simulador ? 'Simulador' : (a.potencia || this._labelClase(a))}</p>
            </div>
            <div class="aeronave-card-acciones">
              <button class="btn ghost" data-accion="editar" data-id="${a.id}" title="Editar">${Icons.edit(16)}</button>
              <button class="btn ghost" data-accion="borrar" data-id="${a.id}" title="Borrar">${Icons.trash(16)}</button>
            </div>
          </div>
          <div class="aeronave-card-tarifas">
            <div class="aeronave-tarifa-row">
              <span class="aeronave-tarifa-label">${Icons.sun(14)} Tarifa diurna</span>
              <span class="aeronave-tarifa-valor">${fmtMoneda(a.tarifa_hora_diurna, a.moneda)}</span>
            </div>
            <div class="aeronave-tarifa-row">
              <span class="aeronave-tarifa-label">${Icons.moon(14)} Tarifa nocturna</span>
              <span class="aeronave-tarifa-valor">${a.es_simulador ? '—' : fmtMoneda(a.tarifa_hora_nocturna, a.moneda)}</span>
            </div>
          </div>
        </div>
        <div class="aeronave-card-footer">
          ${a.es_habitual
            ? `<span class="aeronave-card-preferida">${Icons.star(13)} Preferida</span>`
            : `<span class="muted">${a.es_simulador ? 'Simulador' : this._labelClase(a)}</span>`}
        </div>
      </div>
    `).join('');

    grid.innerHTML = tarjetas + `
      <button type="button" class="aeronave-card-nueva" id="btn-nueva-placeholder">
        <span class="aeronave-card-nueva-icono">${Icons.plusCircle(28)}</span>
        <p class="aeronave-card-nueva-titulo">Nueva aeronave</p>
        <p class="muted">Cargá matrícula, clase y tarifas horarias.</p>
      </button>
    `;

    if (!aeronaves.length) {
      grid.insertAdjacentHTML('afterbegin', `<p class="empty-state">Todavía no cargaste ninguna aeronave.</p>`);
    }

    document.getElementById('btn-nueva-placeholder').onclick = () => document.getElementById('btn-mostrar-form').click();

    // Delegación por id — evita serializar la aeronave entera (con notas/modelo
    // que pueden traer comillas) dentro de un atributo onclick.
    grid.querySelectorAll('button[data-accion]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.accion === 'editar') this._editar(b.dataset.id);
        else this._borrar(b.dataset.id);
      };
    });
  },

  async _editar(id) {
    const a = this.aeronaves.find((x) => x.id === id);
    if (!a) return;
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
      UI.toast(this.tipo === 'simulador' ? 'Nombre y modelo son obligatorios.' : 'Matrícula y modelo son obligatorios.', 'warn');
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
      UI.toast('Error al guardar: ' + (err.message || err), 'error');
    }
  },

  async _borrar(id) {
    if (!(await UI.confirmar('¿Borrar esta ficha? Si tiene vuelos cargados, no se va a poder borrar.', { ok: 'Borrar', peligro: true }))) return;
    try {
      await Repo.borrarAeronave(id);
      this.render();
    } catch (err) {
      UI.toast('No se pudo borrar: ' + (err.message || err), 'error');
    }
  },
};

window.ViewAeronaves = ViewAeronaves;
