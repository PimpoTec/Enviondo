// ============================================================================
// VISTA: NUEVO VUELO — modo híbrido (rápido por defecto, detallado opcional)
// + turnos de adiestrador terrestre (entrada simplificada, sin horas de vuelo)
// ============================================================================

const ViewNuevoVuelo = {
  aeronaves: [],
  tipo: 'vuelo', // 'vuelo' | 'adiestrador'
  modoDetallado: false,
  esTravesia: false,
  esPiloto: true,
  discriminarRapido: false,
  progId: null,
  editId: null,
  editVuelo: null,
  params: null,

  async render(params) {
    const main = document.getElementById('main-content');
    this.aeronaves = await Repo.listarAeronaves();
    this.params = params || this.params;
    this.progId = this.params?.get('prog') || null;
    const desdeParam = this.params?.get('desde');
    const hastaParam = this.params?.get('hasta');
    if (desdeParam && hastaParam && desdeParam !== hastaParam) {
      this.esTravesia = true;
    }

    const nuevoEditId = this.params?.get('editar') || null;
    if (nuevoEditId && nuevoEditId !== this.editId) {
      this.editId = nuevoEditId;
      try {
        this.editVuelo = await Repo.obtenerVuelo(this.editId);
        this.tipo = (this.editVuelo.desde === 'TERR' && this.editVuelo.hasta === 'TERR') ? 'adiestrador' : 'vuelo';
        this.esTravesia = this.editVuelo.desde !== this.editVuelo.hasta;
        this.modoDetallado = this.tipo === 'vuelo';
      } catch (err) {
        this.editId = null;
        this.editVuelo = null;
        alert('No se pudo cargar el vuelo a editar: ' + (err.message || err));
      }
    } else if (!nuevoEditId) {
      this.editId = null;
      this.editVuelo = null;
    }

    if (!this.aeronaves.length) {
      main.innerHTML = `<div class="card empty-state">
        Todavía no cargaste ninguna aeronave. Necesitás al menos una ficha para poder registrar vuelos
        (de ahí sale la tarifa por hora para calcular el costo).
        <br><button class="btn" style="margin-top:12px" onclick="Router.irA('aeronaves')">Cargar aeronave</button>
      </div>`;
      return;
    }

    main.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h2 style="margin:0">${this.editId ? '✏️ Editar registro' : '➕ Nuevo registro'}</h2>
          ${this.tipo === 'vuelo' ? '<button class="btn secondary" id="btn-toggle-modo">Modo detallado</button>' : ''}
        </div>

        <div class="field" style="margin-bottom:16px">
          <div class="toggle-group">
            <button type="button" id="tg-tipo-vuelo" class="${this.tipo === 'vuelo' ? 'active' : ''}" ${this.editId ? 'disabled' : ''}>✈️ Vuelo</button>
            <button type="button" id="tg-tipo-adiestrador" class="${this.tipo === 'adiestrador' ? 'active' : ''}" ${this.editId ? 'disabled' : ''}>🖥️ Adiestrador terrestre</button>
          </div>
        </div>

        ${this.progId && this.tipo === 'vuelo' ? '<p class="muted">✈️ Precargado desde tu vuelo agendado — revisá los datos y completá el resto.</p>' : ''}
        ${this.editId ? '<p class="muted">✏️ Editando un registro existente.</p>' : ''}

        <div id="form-registro"></div>
      </div>
    `;

    document.getElementById('tg-tipo-vuelo').onclick = () => { this.tipo = 'vuelo'; this.render(); };
    document.getElementById('tg-tipo-adiestrador').onclick = () => { this.tipo = 'adiestrador'; this.render(); };
    if (this.tipo === 'vuelo') {
      document.getElementById('btn-toggle-modo').onclick = () => {
        this.modoDetallado = !this.modoDetallado;
        this._renderFormVuelo();
      };
    }

    if (this.tipo === 'adiestrador') {
      this._renderFormAdiestrador();
    } else {
      this._renderFormVuelo();
    }
  },

  // ==========================================================================
  // FORMULARIO DE VUELO
  // ==========================================================================
  _renderFormVuelo() {
    const cont = document.getElementById('form-registro');
    const params = this.params;
    const aeronavesVuelo = this.aeronaves.filter((a) => !a.es_simulador);

    if (!aeronavesVuelo.length) {
      cont.innerHTML = `<div class="empty-state">
        Todavía no cargaste ninguna aeronave (los simuladores no cuentan para vuelos reales).
        <br><button class="btn" style="margin-top:12px" onclick="Router.irA('aeronaves')">Cargar aeronave</button>
      </div>`;
      return;
    }

    cont.innerHTML = `
      <div class="field-row">
        <div class="field">
          <label>Fecha</label>
          <input type="date" id="f-fecha" value="${params?.get('fecha') || new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="field">
          <label>Aeronave</label>
          <select id="f-aeronave">
            ${aeronavesVuelo.map((a) => `<option value="${a.id}" ${a.id === params?.get('aeronave') ? 'selected' : ''}>${a.matricula} — ${a.marca_modelo}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field">
        <label>Origen (OACI)</label>
        <input type="text" id="f-desde" maxlength="4" placeholder="SABE" style="text-transform:uppercase" value="${params?.get('desde') || ''}" />
      </div>

      <div class="field">
        <label>¿Local (sobre aeródromo) o travesía?</label>
        <div class="toggle-group">
          <button type="button" id="tg-local" class="${this.esTravesia ? '' : 'active'}">Local</button>
          <button type="button" id="tg-travesia" class="${this.esTravesia ? 'active' : ''}">Travesía</button>
        </div>
        <p class="muted" style="margin:4px 0 0">Local = mismo aeródromo de salida y llegada.</p>
      </div>

      <div class="field" id="campo-hasta" style="display:${this.esTravesia ? 'block' : 'none'}">
        <label>Destino (OACI)</label>
        <input type="text" id="f-hasta" maxlength="4" placeholder="SADF" style="text-transform:uppercase" value="${params?.get('hasta') || ''}" />
      </div>

      <div class="field-row">
        <div class="field">
          <label>Hora salida (UTC)</label>
          <input type="time" id="f-hora-salida" />
        </div>
        <div class="field">
          <label>Hora llegada (UTC)</label>
          <input type="time" id="f-hora-llegada" />
        </div>
      </div>

      <div class="field">
        <label>Finalidad del vuelo</label>
        <select id="f-finalidad">
          <option value="INST">INST — Instrucción</option>
          <option value="ADAP">ADAP — Adaptación</option>
          <option value="REDAP">REDAP — Readaptación</option>
          <option value="EXA">EXA — Examen</option>
          <option value="ENTT">ENTT — Entrenamiento (escuela)</option>
          <option value="VP">VP — Vuelo privado</option>
        </select>
      </div>

      <!-- ============ MODO RÁPIDO ============ -->
      <div id="bloque-rapido" style="display:${this.modoDetallado ? 'none' : 'block'}">
        <div class="field">
          <label>Función</label>
          <div class="toggle-group">
            <button type="button" id="tg-piloto" class="active">Piloto (PIC)</button>
            <button type="button" id="tg-copiloto">Copiloto</button>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Tiempo total (hs.décimos)</label>
            <input type="number" step="0.1" min="0" id="f-tiempo-total" placeholder="ej. 1.5" />
            <p class="muted" id="tiempo-calculado" style="margin:4px 0 0"></p>
          </div>
          <div class="field">
            <label>De ese tiempo, ¿cuánto fue de noche?</label>
            <input type="number" step="0.1" min="0" id="f-horas-noche" value="0" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Aterrizajes de día</label>
            <input type="number" min="0" id="f-aterr-dia" value="1" />
          </div>
          <div class="field">
            <label>Aterrizajes de noche</label>
            <input type="number" min="0" id="f-aterr-noche" value="0" />
          </div>
          <div class="field">
            <label>Remolques <span class="muted">(planeador)</span></label>
            <input type="number" min="0" id="f-remolques" value="0" />
          </div>
        </div>

        <div class="field">
          <div class="toggle-group" style="max-width:320px">
            <button type="button" id="tg-discrim-no" class="${this.discriminarRapido ? '' : 'active'}">Sin discriminar tiempos</button>
            <button type="button" id="tg-discrim-si" class="${this.discriminarRapido ? 'active' : ''}">Discriminar tiempos</button>
          </div>
        </div>
        <div id="bloque-discrim-rapido" class="grid cols-3" style="display:${this.discriminarRapido ? 'grid' : 'none'}">
          <div class="field"><label>Instrucción de vuelo</label><input type="number" step="0.1" min="0" id="rd-instruccion_vuelo" value="0"></div>
          <div class="field"><label>Multimotor</label><input type="number" step="0.1" min="0" id="rd-multimotor" value="0"></div>
          <div class="field"><label>Reactor</label><input type="number" step="0.1" min="0" id="rd-reactor" value="0"></div>
          <div class="field"><label>Aeroaplicador</label><input type="number" step="0.1" min="0" id="rd-aeroaplicador" value="0"></div>
          <div class="field"><label>Instrumentos real (piloto)</label><input type="number" step="0.1" min="0" id="rd-instrumentos_real_piloto" value="0"></div>
          <div class="field"><label>Instrumentos real (copiloto)</label><input type="number" step="0.1" min="0" id="rd-instrumentos_real_copiloto" value="0"></div>
          <div class="field"><label>Instrumentos capota</label><input type="number" step="0.1" min="0" id="rd-instrumentos_capota" value="0"></div>
        </div>
      </div>

      <!-- ============ MODO DETALLADO ============ -->
      <div id="bloque-detallado" style="display:${this.modoDetallado ? 'block' : 'none'}">
        <h3>Tiempos de vuelo (hs.décimos) — buckets excluyentes del libro ANAC</h3>
        <div class="grid cols-2">
          <div class="field"><label>Sobre aeródromo · día · piloto</label><input type="number" step="0.1" min="0" id="d-saero_dia_piloto" value="0"></div>
          <div class="field"><label>Sobre aeródromo · día · copiloto</label><input type="number" step="0.1" min="0" id="d-saero_dia_copiloto" value="0"></div>
          <div class="field"><label>Sobre aeródromo · noche · piloto</label><input type="number" step="0.1" min="0" id="d-saero_noche_piloto" value="0"></div>
          <div class="field"><label>Sobre aeródromo · noche · copiloto</label><input type="number" step="0.1" min="0" id="d-saero_noche_copiloto" value="0"></div>
          <div class="field"><label>Travesía · día · piloto</label><input type="number" step="0.1" min="0" id="d-trav_dia_piloto" value="0"></div>
          <div class="field"><label>Travesía · día · copiloto</label><input type="number" step="0.1" min="0" id="d-trav_dia_copiloto" value="0"></div>
          <div class="field"><label>Travesía · noche · piloto</label><input type="number" step="0.1" min="0" id="d-trav_noche_piloto" value="0"></div>
          <div class="field"><label>Travesía · noche · copiloto</label><input type="number" step="0.1" min="0" id="d-trav_noche_copiloto" value="0"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Aterrizajes de día</label><input type="number" min="0" id="d-aterrizajes_dia" value="1"></div>
          <div class="field"><label>Aterrizajes de noche</label><input type="number" min="0" id="d-aterrizajes_noche" value="0"></div>
          <div class="field"><label>Remolques <span class="muted">(planeador)</span></label><input type="number" min="0" id="d-remolques" value="0"></div>
        </div>

        <h3>Discriminación (informativa — no se suma al total)</h3>
        <div class="grid cols-3">
          <div class="field"><label>Instrucción de vuelo</label><input type="number" step="0.1" min="0" id="d-instruccion_vuelo" value="0"></div>
          <div class="field"><label>Multimotor</label><input type="number" step="0.1" min="0" id="d-multimotor" value="0"></div>
          <div class="field"><label>Reactor</label><input type="number" step="0.1" min="0" id="d-reactor" value="0"></div>
          <div class="field"><label>Turbohélice</label><input type="number" step="0.1" min="0" id="d-turbohelice" value="0"></div>
          <div class="field"><label>Aeroaplicador</label><input type="number" step="0.1" min="0" id="d-aeroaplicador" value="0"></div>
          <div class="field"><label>Instrumentos real (piloto)</label><input type="number" step="0.1" min="0" id="d-instrumentos_real_piloto" value="0"></div>
          <div class="field"><label>Instrumentos real (copiloto)</label><input type="number" step="0.1" min="0" id="d-instrumentos_real_copiloto" value="0"></div>
          <div class="field"><label>Instrumentos capota</label><input type="number" step="0.1" min="0" id="d-instrumentos_capota" value="0"></div>
          <div class="field"><label>Adiestrador/simulador</label><input type="number" step="0.1" min="0" id="d-adiestrador_simulador" value="0"></div>
        </div>

        <h3>Certificación</h3>
        <div class="field-row">
          <div class="field"><label>Instructor (nombre)</label><input type="text" id="d-instructor_nombre"></div>
          <div class="field"><label>Instructor (matrícula)</label><input type="text" id="d-instructor_matricula"></div>
        </div>
      </div>

      <div class="field">
        <label>Observaciones</label>
        <textarea id="f-observaciones" rows="2"></textarea>
      </div>

      <div class="card" style="background:var(--bg-subtle);border:none;box-shadow:none;margin-bottom:12px">
        <div class="grid cols-3">
          <div class="stat"><div class="num" id="prev-tiempo">0.0</div><div class="lbl">Tiempo total</div></div>
          <div class="stat"><div class="num" id="prev-dia-noche">0.0 / 0.0</div><div class="lbl">Día / Noche</div></div>
          <div class="stat"><div class="num" id="prev-costo">$0</div><div class="lbl">Costo estimado</div></div>
        </div>
      </div>

      <p id="mensaje-validacion" class="muted"></p>
      <div class="btn-row">
        <button class="btn" id="btn-guardar-vuelo">${this.editId ? 'Guardar cambios' : 'Guardar vuelo'}</button>
        <button class="btn secondary" id="btn-limpiar">${this.editId ? 'Cancelar' : 'Limpiar'}</button>
      </div>
    `;

    this._bindVuelo();
    if (this.editVuelo) this._prefillEdicionVuelo();
    this._actualizarPreview();
  },

  _prefillEdicionVuelo() {
    const v = this.editVuelo;
    document.getElementById('f-fecha').value = v.fecha;
    document.getElementById('f-aeronave').value = v.aeronave_id;
    document.getElementById('f-desde').value = v.desde;
    if (this.esTravesia) document.getElementById('f-hasta').value = v.hasta;
    document.getElementById('f-hora-salida').value = (v.hora_salida_utc || '').slice(0, 5);
    document.getElementById('f-hora-llegada').value = (v.hora_llegada_utc || '').slice(0, 5);
    document.getElementById('f-finalidad').value = v.finalidad_vuelo;
    document.getElementById('f-observaciones').value = v.observaciones || '';
    Calc.CAMPOS_TIEMPO.forEach((c) => { document.getElementById('d-' + c).value = Calc.n(v[c]); });
    document.getElementById('d-aterrizajes_dia').value = Calc.n(v.aterrizajes_dia);
    document.getElementById('d-aterrizajes_noche').value = Calc.n(v.aterrizajes_noche);
    document.getElementById('d-remolques').value = Calc.n(v.remolques);
    document.getElementById('d-instruccion_vuelo').value = Calc.n(v.instruccion_vuelo);
    document.getElementById('d-multimotor').value = Calc.n(v.multimotor);
    document.getElementById('d-reactor').value = Calc.n(v.reactor);
    document.getElementById('d-turbohelice').value = Calc.n(v.turbohelice);
    document.getElementById('d-aeroaplicador').value = Calc.n(v.aeroaplicador);
    document.getElementById('d-instrumentos_real_piloto').value = Calc.n(v.instrumentos_real);
    document.getElementById('d-instrumentos_real_copiloto').value = 0;
    document.getElementById('d-instrumentos_capota').value = Calc.n(v.instrumentos_capota);
    document.getElementById('d-adiestrador_simulador').value = Calc.n(v.adiestrador_simulador);
    document.getElementById('d-instructor_nombre').value = v.instructor_nombre || '';
    document.getElementById('d-instructor_matricula').value = v.instructor_matricula || '';
  },

  _bindVuelo() {
    document.getElementById('tg-local').onclick = () => this._setToggle('local');
    document.getElementById('tg-travesia').onclick = () => this._setToggle('travesia');
    document.getElementById('tg-piloto').onclick = () => this._setRol('piloto');
    document.getElementById('tg-copiloto').onclick = () => this._setRol('copiloto');
    document.getElementById('tg-discrim-no').onclick = () => this._setDiscriminar(false);
    document.getElementById('tg-discrim-si').onclick = () => this._setDiscriminar(true);

    document.getElementById('f-desde').addEventListener('input', () => this._sincronizarHasta());

    ['f-hora-salida', 'f-hora-llegada'].forEach((id) => {
      document.getElementById(id).addEventListener('change', () => this._autocalcularTiempo());
    });

    document.getElementById('f-aeronave').addEventListener('change', () => this._actualizarPreview());

    const idsRapido = ['f-tiempo-total', 'f-horas-noche'];
    idsRapido.forEach((id) => document.getElementById(id).addEventListener('input', () => this._actualizarPreview()));

    Calc.CAMPOS_TIEMPO.forEach((c) => {
      const el = document.getElementById('d-' + c);
      if (el) el.addEventListener('input', () => this._actualizarPreview());
    });

    document.getElementById('btn-guardar-vuelo').onclick = () => this._guardar();
    document.getElementById('btn-limpiar').onclick = () => {
      if (this.editId) { Router.irA('bitacora'); return; }
      this.render();
    };
  },

  _sincronizarHasta() {
    if (!this.esTravesia) {
      document.getElementById('f-hasta').value = document.getElementById('f-desde').value;
    }
  },

  _setToggle(v) {
    this.esTravesia = v === 'travesia';
    document.getElementById('tg-local').classList.toggle('active', !this.esTravesia);
    document.getElementById('tg-travesia').classList.toggle('active', this.esTravesia);
    document.getElementById('campo-hasta').style.display = this.esTravesia ? 'block' : 'none';
    this._sincronizarHasta();
    this._actualizarPreview();
  },
  _setRol(v) {
    this.esPiloto = v === 'piloto';
    document.getElementById('tg-piloto').classList.toggle('active', this.esPiloto);
    document.getElementById('tg-copiloto').classList.toggle('active', !this.esPiloto);
    this._actualizarPreview();
  },
  _setDiscriminar(v) {
    this.discriminarRapido = v;
    document.getElementById('tg-discrim-no').classList.toggle('active', !v);
    document.getElementById('tg-discrim-si').classList.toggle('active', v);
    document.getElementById('bloque-discrim-rapido').style.display = v ? 'grid' : 'none';
  },

  _autocalcularTiempo() {
    const hs = document.getElementById('f-hora-salida').value;
    const hl = document.getElementById('f-hora-llegada').value;
    if (hs && hl) {
      const total = Calc.horasEntre(hs, hl);
      document.getElementById('f-tiempo-total').value = total;
      document.getElementById('tiempo-calculado').textContent = `Calculado del horario: ${total} hs`;
    }
    this._actualizarPreview();
  },

  _camposRapido() {
    const tiempoTotal = Calc.n(document.getElementById('f-tiempo-total').value);
    const horasNoche = Calc.n(document.getElementById('f-horas-noche').value);
    return Calc.repartirModoRapido({ tiempoTotal, esTravesia: this.esTravesia, esPiloto: this.esPiloto, horasNoche });
  },

  _camposDetallado() {
    const out = {};
    Calc.CAMPOS_TIEMPO.forEach((c) => { out[c] = Calc.n(document.getElementById('d-' + c).value); });
    return out;
  },

  _actualizarPreview() {
    const campos = this.modoDetallado ? this._camposDetallado() : this._camposRapido();
    const totales = Calc.calcularTotales(campos);
    const aeronaveId = document.getElementById('f-aeronave')?.value;
    const aeronave = this.aeronaves.find((a) => a.id === aeronaveId);
    const costo = Calc.calcularCosto(campos, aeronave);

    document.getElementById('prev-tiempo').textContent = totales.tiempo_total.toFixed(1);
    document.getElementById('prev-dia-noche').textContent = `${totales.total_dia.toFixed(1)} / ${totales.total_noche.toFixed(1)}`;
    document.getElementById('prev-costo').textContent = fmtMoneda(costo, aeronave?.moneda);
  },

  async _guardar() {
    const msg = document.getElementById('mensaje-validacion');
    msg.textContent = '';
    msg.className = 'muted';

    const fecha = document.getElementById('f-fecha').value;
    const desde = document.getElementById('f-desde').value.trim().toUpperCase();
    const hasta = this.esTravesia ? document.getElementById('f-hasta').value.trim().toUpperCase() : desde;
    const aeronave_id = document.getElementById('f-aeronave').value;
    const finalidad_vuelo = document.getElementById('f-finalidad').value;
    const hora_salida_utc = document.getElementById('f-hora-salida').value || null;
    const hora_llegada_utc = document.getElementById('f-hora-llegada').value || null;
    const observaciones = document.getElementById('f-observaciones').value;

    const avisos = [];
    if (!fecha) avisos.push('Falta la fecha.');
    if (desde.length !== 4) avisos.push('El código OACI de origen debería tener 4 letras.');
    if (hasta.length !== 4) avisos.push('El código OACI de destino debería tener 4 letras.');

    const camposTiempo = this.modoDetallado ? this._camposDetallado() : this._camposRapido();
    const totales = Calc.calcularTotales(camposTiempo);
    if (totales.tiempo_total <= 0) avisos.push('El tiempo total es 0 — ¿seguro que está bien cargado?');

    let campos = {
      fecha, hora_salida_utc, hora_llegada_utc, desde, hasta, finalidad_vuelo, aeronave_id,
      observaciones,
      ...Object.fromEntries(Calc.CAMPOS_TIEMPO.map((c) => [c, camposTiempo[c] || 0])),
      aterrizajes_dia: Calc.n(document.getElementById(this.modoDetallado ? 'd-aterrizajes_dia' : 'f-aterr-dia').value),
      aterrizajes_noche: Calc.n(document.getElementById(this.modoDetallado ? 'd-aterrizajes_noche' : 'f-aterr-noche').value),
      remolques: Calc.n(document.getElementById(this.modoDetallado ? 'd-remolques' : 'f-remolques').value),
      instruccion_vuelo: 0, multimotor: 0, reactor: 0, turbohelice: 0, aeroaplicador: 0,
      instrumentos_real: 0, instrumentos_capota: 0, adiestrador_simulador: 0,
      instructor_nombre: null, instructor_matricula: null,
    };

    if (this.modoDetallado) {
      campos.instruccion_vuelo = Calc.n(document.getElementById('d-instruccion_vuelo').value);
      campos.multimotor = Calc.n(document.getElementById('d-multimotor').value);
      campos.reactor = Calc.n(document.getElementById('d-reactor').value);
      campos.turbohelice = Calc.n(document.getElementById('d-turbohelice').value);
      campos.aeroaplicador = Calc.n(document.getElementById('d-aeroaplicador').value);
      campos.instrumentos_real = Calc.n(document.getElementById('d-instrumentos_real_piloto').value) + Calc.n(document.getElementById('d-instrumentos_real_copiloto').value);
      campos.instrumentos_capota = Calc.n(document.getElementById('d-instrumentos_capota').value);
      campos.adiestrador_simulador = Calc.n(document.getElementById('d-adiestrador_simulador').value);
      campos.instructor_nombre = document.getElementById('d-instructor_nombre').value || null;
      campos.instructor_matricula = document.getElementById('d-instructor_matricula').value || null;
    } else if (this.discriminarRapido) {
      campos.instruccion_vuelo = Calc.n(document.getElementById('rd-instruccion_vuelo').value);
      campos.multimotor = Calc.n(document.getElementById('rd-multimotor').value);
      campos.reactor = Calc.n(document.getElementById('rd-reactor').value);
      campos.aeroaplicador = Calc.n(document.getElementById('rd-aeroaplicador').value);
      campos.instrumentos_real = Calc.n(document.getElementById('rd-instrumentos_real_piloto').value) + Calc.n(document.getElementById('rd-instrumentos_real_copiloto').value);
      campos.instrumentos_capota = Calc.n(document.getElementById('rd-instrumentos_capota').value);
    }

    if (avisos.length) {
      msg.textContent = '⚠️ ' + avisos.join(' ');
      msg.className = 'muted';
      const ok = confirm('Hay observaciones:\n\n' + avisos.join('\n') + '\n\n¿Guardar igual?');
      if (!ok) return;
    }

    const btn = document.getElementById('btn-guardar-vuelo');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      if (this.editId) {
        await Repo.actualizarVuelo(this.editId, campos);
        msg.textContent = '✅ Cambios guardados.';
        msg.className = 'muted';
        this.editId = null;
        this.editVuelo = null;
        setTimeout(() => Router.irA('bitacora'), 700);
        return;
      }
      const res = await Repo.crearVuelo(campos);
      if (this.progId) {
        Repo.borrarVueloProgramado(this.progId).catch(() => {});
      }
      if (res.offline) {
        msg.textContent = '📴 Guardado localmente (sin conexión). Se va a sincronizar solo cuando vuelva la señal.';
      } else {
        msg.textContent = '✅ Vuelo guardado.';
      }
      msg.className = 'muted';
      setTimeout(() => Router.irA('bitacora'), 700);
    } catch (err) {
      msg.textContent = '❌ Error al guardar: ' + (err.message || err);
    } finally {
      btn.disabled = false;
      btn.textContent = this.editId ? 'Guardar cambios' : 'Guardar vuelo';
    }
  },

  // ==========================================================================
  // FORMULARIO DE ADIESTRADOR TERRESTRE — solo horario, aeronave/simulador
  // y tiempo de adiestrador. Sin horas de vuelo, sin ruta, sin aterrizajes.
  // ==========================================================================
  _renderFormAdiestrador() {
    const cont = document.getElementById('form-registro');
    const simuladores = this.aeronaves.filter((a) => a.es_simulador);

    if (!simuladores.length) {
      cont.innerHTML = `<div class="empty-state">
        Todavía no cargaste ningún simulador. Andá a Aeronaves → "🖥️ Simulador" para cargar uno
        (nombre, modelo y tarifa por hora nomás).
        <br><button class="btn" style="margin-top:12px" onclick="Router.irA('aeronaves')">Cargar simulador</button>
      </div>`;
      return;
    }

    cont.innerHTML = `
      <div class="field-row">
        <div class="field">
          <label>Fecha</label>
          <input type="date" id="at-fecha" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="field">
          <label>Simulador</label>
          <select id="at-aeronave">
            ${simuladores.map((a) => `<option value="${a.id}">${a.matricula} — ${a.marca_modelo}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Hora inicio</label>
          <input type="time" id="at-hora-inicio" />
        </div>
        <div class="field">
          <label>Hora fin</label>
          <input type="time" id="at-hora-fin" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Tiempo de adiestrador terrestre (hs.décimos)</label>
          <input type="number" step="0.1" min="0" id="at-tiempo" placeholder="ej. 1.0" />
          <p class="muted" id="at-tiempo-calculado" style="margin:4px 0 0"></p>
        </div>
        <div class="field">
          <label>Finalidad</label>
          <select id="at-finalidad">
            <option value="INST">INST — Instrucción</option>
            <option value="ADAP">ADAP — Adaptación</option>
            <option value="REDAP">REDAP — Readaptación</option>
            <option value="EXA">EXA — Examen</option>
            <option value="ENTT">ENTT — Entrenamiento (escuela)</option>
            <option value="VP">VP — Vuelo privado</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Observaciones</label>
        <textarea id="at-observaciones" rows="2"></textarea>
      </div>

      <div class="card" style="background:var(--bg-subtle);border:none;box-shadow:none;margin-bottom:12px">
        <div class="stat"><div class="num" id="at-prev-costo">$0</div><div class="lbl">Costo estimado</div></div>
      </div>

      <p id="mensaje-validacion" class="muted"></p>
      <div class="btn-row">
        <button class="btn" id="btn-guardar-adiestrador">${this.editId ? 'Guardar cambios' : 'Guardar turno'}</button>
        <button class="btn secondary" id="btn-limpiar">${this.editId ? 'Cancelar' : 'Limpiar'}</button>
      </div>
    `;

    const actualizarCostoAdiestrador = () => {
      const aeronave = simuladores.find((a) => a.id === document.getElementById('at-aeronave').value);
      const tiempo = Calc.n(document.getElementById('at-tiempo').value);
      const costo = Calc.calcularCosto({ adiestrador_simulador: tiempo }, aeronave);
      document.getElementById('at-prev-costo').textContent = fmtMoneda(costo, aeronave?.moneda);
    };

    ['at-hora-inicio', 'at-hora-fin'].forEach((id) => {
      document.getElementById(id).addEventListener('change', () => {
        const hi = document.getElementById('at-hora-inicio').value;
        const hf = document.getElementById('at-hora-fin').value;
        if (hi && hf) {
          const total = Calc.horasEntre(hi, hf);
          document.getElementById('at-tiempo').value = total;
          document.getElementById('at-tiempo-calculado').textContent = `Calculado del horario: ${total} hs`;
        }
        actualizarCostoAdiestrador();
      });
    });
    document.getElementById('at-aeronave').addEventListener('change', actualizarCostoAdiestrador);
    document.getElementById('at-tiempo').addEventListener('input', actualizarCostoAdiestrador);

    document.getElementById('btn-guardar-adiestrador').onclick = () => this._guardarAdiestrador();
    document.getElementById('btn-limpiar').onclick = () => {
      if (this.editId) { Router.irA('bitacora'); return; }
      this.render();
    };

    if (this.editVuelo) {
      const v = this.editVuelo;
      document.getElementById('at-fecha').value = v.fecha;
      document.getElementById('at-aeronave').value = v.aeronave_id;
      document.getElementById('at-hora-inicio').value = (v.hora_salida_utc || '').slice(0, 5);
      document.getElementById('at-hora-fin').value = (v.hora_llegada_utc || '').slice(0, 5);
      document.getElementById('at-tiempo').value = Calc.n(v.adiestrador_simulador);
      document.getElementById('at-finalidad').value = v.finalidad_vuelo || 'INST';
      document.getElementById('at-observaciones').value = (v.observaciones || '').replace(/^Turno de adiestrador terrestre( — )?/, '');
    }
    actualizarCostoAdiestrador();
  },

  async _guardarAdiestrador() {
    const msg = document.getElementById('mensaje-validacion');
    const fecha = document.getElementById('at-fecha').value;
    const aeronave_id = document.getElementById('at-aeronave').value;
    const tiempo = Calc.n(document.getElementById('at-tiempo').value);
    const hora_salida_utc = document.getElementById('at-hora-inicio').value || null;
    const hora_llegada_utc = document.getElementById('at-hora-fin').value || null;
    const finalidad_vuelo = document.getElementById('at-finalidad').value;
    const notasUsuario = document.getElementById('at-observaciones').value;

    if (!fecha || !tiempo) {
      msg.textContent = '⚠️ Falta la fecha o el tiempo de adiestrador.';
      return;
    }

    const campos = {
      fecha, hora_salida_utc, hora_llegada_utc, desde: 'TERR', hasta: 'TERR',
      finalidad_vuelo, aeronave_id,
      ...Object.fromEntries(Calc.CAMPOS_TIEMPO.map((c) => [c, 0])),
      aterrizajes_dia: 0, aterrizajes_noche: 0, remolques: 0,
      instruccion_vuelo: 0, multimotor: 0, reactor: 0, turbohelice: 0, aeroaplicador: 0,
      instrumentos_real: 0, instrumentos_capota: 0,
      adiestrador_simulador: tiempo,
      instructor_nombre: null, instructor_matricula: null,
      observaciones: ['Turno de adiestrador terrestre', notasUsuario].filter(Boolean).join(' — '),
    };

    const btn = document.getElementById('btn-guardar-adiestrador');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      if (this.editId) {
        await Repo.actualizarVuelo(this.editId, campos);
        msg.textContent = '✅ Cambios guardados.';
        msg.className = 'muted';
        this.editId = null;
        this.editVuelo = null;
        setTimeout(() => Router.irA('bitacora'), 700);
        return;
      }
      const res = await Repo.crearVuelo(campos);
      msg.textContent = res.offline ? '📴 Guardado localmente. Se sincroniza solo al volver la señal.' : '✅ Turno guardado.';
      msg.className = 'muted';
      setTimeout(() => Router.irA('bitacora'), 700);
    } catch (err) {
      msg.textContent = '❌ Error al guardar: ' + (err.message || err);
    } finally {
      btn.disabled = false;
      btn.textContent = this.editId ? 'Guardar cambios' : 'Guardar turno';
    }
  },
};

window.ViewNuevoVuelo = ViewNuevoVuelo;
