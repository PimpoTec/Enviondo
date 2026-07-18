// ============================================================================
// VISTA: NUEVO VUELO — modo híbrido (rápido por defecto, detallado opcional)
// ============================================================================

const ViewNuevoVuelo = {
  aeronaves: [],
  modoDetallado: false,
  esTravesia: false,
  esPiloto: true,
  progId: null,

  async render(params) {
    const main = document.getElementById('main-content');
    this.aeronaves = await Repo.listarAeronaves();
    this.progId = params?.get('prog') || null;

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
          <h2 style="margin:0">➕ Nuevo vuelo</h2>
          <button class="btn secondary" id="btn-toggle-modo">Modo detallado</button>
        </div>

        ${this.progId ? '<p class="muted">✈️ Precargado desde tu vuelo agendado — revisá los datos y completá el resto.</p>' : ''}

        <div class="field-row">
          <div class="field">
            <label>Fecha</label>
            <input type="date" id="f-fecha" value="${params?.get('fecha') || new Date().toISOString().slice(0, 10)}" />
          </div>
          <div class="field">
            <label>Aeronave</label>
            <select id="f-aeronave">
              ${this.aeronaves.map((a) => `<option value="${a.id}" ${a.id === params?.get('aeronave') ? 'selected' : ''}>${a.matricula} — ${a.marca_modelo}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Desde (OACI)</label>
            <input type="text" id="f-desde" maxlength="4" placeholder="SABE" style="text-transform:uppercase" value="${params?.get('desde') || ''}" />
          </div>
          <div class="field">
            <label>Hasta (OACI)</label>
            <input type="text" id="f-hasta" maxlength="4" placeholder="SADF" style="text-transform:uppercase" value="${params?.get('hasta') || ''}" />
          </div>
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
            <option value="local">Local</option>
            <option value="instruccion">Instrucción</option>
            <option value="travesia">Travesía</option>
            <option value="trabajo_aereo">Trabajo aéreo</option>
            <option value="verificacion">Verificación</option>
            <option value="adiestramiento">Adiestramiento</option>
          </select>
        </div>

        <!-- ============ MODO RÁPIDO ============ -->
        <div id="bloque-rapido">
          <div class="field">
            <label>¿Local (sobre aeródromo) o travesía?</label>
            <div class="toggle-group">
              <button type="button" id="tg-local" class="active">Local</button>
              <button type="button" id="tg-travesia">Travesía</button>
            </div>
          </div>
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
        </div>

        <!-- ============ MODO DETALLADO ============ -->
        <div id="bloque-detallado" style="display:none">
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
            <div class="field"><label>Instrumentos real</label><input type="number" step="0.1" min="0" id="d-instrumentos_real" value="0"></div>
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
          <button class="btn" id="btn-guardar-vuelo">Guardar vuelo</button>
          <button class="btn secondary" id="btn-limpiar">Limpiar</button>
        </div>
      </div>
    `;

    this._bind();
    this._actualizarPreview();
  },

  _bind() {
    document.getElementById('btn-toggle-modo').onclick = () => {
      this.modoDetallado = !this.modoDetallado;
      document.getElementById('bloque-rapido').style.display = this.modoDetallado ? 'none' : 'block';
      document.getElementById('bloque-detallado').style.display = this.modoDetallado ? 'block' : 'none';
      document.getElementById('btn-toggle-modo').textContent = this.modoDetallado ? 'Modo rápido' : 'Modo detallado';
      this._actualizarPreview();
    };

    document.getElementById('tg-local').onclick = () => this._setToggle('local');
    document.getElementById('tg-travesia').onclick = () => this._setToggle('travesia');
    document.getElementById('tg-piloto').onclick = () => this._setRol('piloto');
    document.getElementById('tg-copiloto').onclick = () => this._setRol('copiloto');

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
    document.getElementById('btn-limpiar').onclick = () => this.render();
  },

  _setToggle(v) {
    this.esTravesia = v === 'travesia';
    document.getElementById('tg-local').classList.toggle('active', !this.esTravesia);
    document.getElementById('tg-travesia').classList.toggle('active', this.esTravesia);
    this._actualizarPreview();
  },
  _setRol(v) {
    this.esPiloto = v === 'piloto';
    document.getElementById('tg-piloto').classList.toggle('active', this.esPiloto);
    document.getElementById('tg-copiloto').classList.toggle('active', !this.esPiloto);
    this._actualizarPreview();
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
    const hasta = document.getElementById('f-hasta').value.trim().toUpperCase();
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
      Calc.CAMPOS_DISCRIMINACION.forEach((c) => { campos[c] = Calc.n(document.getElementById('d-' + c).value); });
      campos.instructor_nombre = document.getElementById('d-instructor_nombre').value || null;
      campos.instructor_matricula = document.getElementById('d-instructor_matricula').value || null;
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
      btn.textContent = 'Guardar vuelo';
    }
  },
};

window.ViewNuevoVuelo = ViewNuevoVuelo;
