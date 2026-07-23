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
  expandidas: new Set(), // ids de fichas abiertas — colapsadas por default, para no ocupar toda la pantalla con una flota grande

  async render() {
    const main = document.getElementById('main-content');
    const aeronaves = await Repo.listarAeronaves();
    this.aeronaves = aeronaves;

    const total = aeronaves.length;
    const simuladores = aeronaves.filter((a) => a.es_simulador).length;
    const habituales = aeronaves.filter((a) => a.es_habitual).length;

    main.innerHTML = `
      <div class="pantalla-header">
        <div>
          <h1>Flota de aeronaves</h1>
          <p class="muted" style="margin:0">Tus aeronaves y simuladores, con sus tarifas horarias.</p>
        </div>
        <div class="pantalla-header-cta">
          <button class="btn" id="btn-mostrar-form">${Icons.plusCircle(16)} Agregar</button>
        </div>
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
          <div class="field"><label>Base (aeródromo)</label><input type="text" id="a-base" maxlength="4" placeholder="SADF" style="text-transform:uppercase"></div>
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
    if (this.tipo === 'aeronave' && typeof Autocomplete !== 'undefined') Autocomplete.attachAerodromo(document.getElementById('a-base'));
  },

  _labelClase(a) {
    if (a.es_simulador) return 'Simulador';
    return CLASES_AERONAVE.find((c) => c.valor === a.clase)?.label || a.clase;
  },

  // Colapsada por default (solo matrícula/modelo/base, una línea) — con
  // una flota grande, mostrar todas las tarjetas abiertas de una hacía
  // scrollear un montón para ver la lista completa. Al tocar la fila se
  // expande y aparece todo lo que ya había (foto, tarifas, acciones).
  _renderGrid(aeronaves) {
    const grid = document.getElementById('grid-aeronaves');
    const tarjetas = aeronaves.map((a) => {
      const abierta = this.expandidas.has(a.id);
      return `
      <div class="aeronave-card">
        <button type="button" class="aeronave-card-resumen" data-toggle="${a.id}">
          <span class="aeronave-card-resumen-icono">${a.es_simulador ? Icons.monitor(18) : Icons.plane(18)}</span>
          <span class="aeronave-card-resumen-texto">
            <span class="aeronave-card-resumen-matricula">${a.matricula}</span>
            <span class="muted">${a.marca_modelo}</span>
          </span>
          ${!a.es_simulador ? `<span class="badge neutral">${a.base_aerodromo || '—'}</span>` : ''}
          <span class="aeronave-card-resumen-chevron${abierta ? ' abierta' : ''}">${Icons.chevronRight(16)}</span>
        </button>
        ${abierta ? `
        <div class="aeronave-card-detalle">
          <div class="aeronave-card-top"${a.foto_url ? ` style="background-image:linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.45)), url('${a.foto_url.replace(/'/g, '%27')}');background-size:cover;background-position:center"` : ''}>
            ${!a.foto_url ? `<span class="aeronave-card-icono">${a.es_simulador ? Icons.monitor(28) : Icons.plane(28)}</span>` : ''}
            <button type="button" class="aeronave-card-foto-btn" data-accion="foto" data-id="${a.id}" title="${a.foto_url ? 'Cambiar foto' : 'Agregar foto'}">${Icons.camera(14)}</button>
            ${a.foto_url ? `<button type="button" class="aeronave-card-foto-quitar" data-accion="quitar-foto" data-id="${a.id}" title="Quitar foto">${Icons.x(12)}</button>` : ''}
          </div>
          <div class="aeronave-card-body">
            <div class="aeronave-card-acciones">
              <button class="btn ghost" data-accion="editar" data-id="${a.id}" title="Editar">${Icons.edit(16)}</button>
              <button class="btn ghost" data-accion="borrar" data-id="${a.id}" title="Borrar">${Icons.trash(16)}</button>
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
        </div>` : ''}
      </div>`;
    }).join('');

    grid.innerHTML = tarjetas + `
      <button type="button" class="aeronave-card-nueva" id="btn-nueva-placeholder">
        <span class="aeronave-card-nueva-icono">${Icons.plusCircle(28)}</span>
        <p class="aeronave-card-nueva-titulo">Nueva aeronave</p>
        <p class="muted">Cargá matrícula, clase y tarifas horarias.</p>
      </button>
      <input type="file" id="input-foto-aeronave" accept="image/*" style="display:none">
    `;

    if (!aeronaves.length) {
      grid.insertAdjacentHTML('afterbegin', `<p class="empty-state">Todavía no cargaste ninguna aeronave.</p>`);
    }

    document.getElementById('btn-nueva-placeholder').onclick = () => document.getElementById('btn-mostrar-form').click();

    grid.querySelectorAll('button[data-toggle]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.toggle;
        if (this.expandidas.has(id)) this.expandidas.delete(id); else this.expandidas.add(id);
        this._renderGrid(this.aeronaves);
      };
    });

    const inputFoto = document.getElementById('input-foto-aeronave');
    inputFoto.onchange = () => {
      const file = inputFoto.files[0];
      if (file) this._subirFoto(inputFoto.dataset.aeronaveId, file);
      inputFoto.value = '';
    };

    // Delegación por id — evita serializar la aeronave entera (con notas/modelo
    // que pueden traer comillas) dentro de un atributo onclick.
    grid.querySelectorAll('button[data-accion]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.accion === 'editar') this._editar(b.dataset.id);
        else if (b.dataset.accion === 'borrar') this._borrar(b.dataset.id);
        else if (b.dataset.accion === 'foto') { inputFoto.dataset.aeronaveId = b.dataset.id; inputFoto.click(); }
        else if (b.dataset.accion === 'quitar-foto') this._quitarFoto(b.dataset.id);
      };
    });
  },

  async _subirFoto(id, file) {
    if (!file.type.startsWith('image/')) { UI.toast('Elegí un archivo de imagen.', 'warn'); return; }
    if (file.size > 5 * 1024 * 1024) { UI.toast('La imagen no puede pesar más de 5 MB.', 'warn'); return; }
    try {
      await Repo.subirFotoAeronave(id, file);
      UI.toast('Foto actualizada.', 'ok');
      this.render();
    } catch (err) {
      UI.toast('Error al subir la foto: ' + (err.message || err), 'error');
    }
  },

  async _quitarFoto(id) {
    if (!(await UI.confirmar('¿Quitar la foto de esta ficha?'))) return;
    try {
      await Repo.quitarFotoAeronave(id);
      this.render();
    } catch (err) {
      UI.toast('Error al quitar la foto: ' + (err.message || err), 'error');
    }
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
      document.getElementById('a-base').value = a.base_aerodromo || '';
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
        base_aerodromo: document.getElementById('a-base').value.trim().toUpperCase() || null,
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
