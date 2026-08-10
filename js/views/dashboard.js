// ============================================================================
// VISTA: DASHBOARD — despejado a lo esencial: 1) total de horas + progreso
// de licencia (hero), 2) botón nuevo vuelo, 3) próximo vuelo agendado (con
// METAR real del aeródromo de origen). El resto (detalle de progreso,
// vencimientos, últimos vuelos, costos) vive en Perfil, un tap más allá.
// ============================================================================

const ViewDashboard = {
  aeronaves: [],

  async render() {
    const main = document.getElementById('main-content');
    const [vuelos, cursosActivos, programados, aeronaves] = await Promise.all([
      Repo.listarVuelos(), Repo.getCursosActivos(),
      Repo.listarVuelosProgramados(), Repo.listarAeronaves(),
    ]);
    this.aeronaves = aeronaves;
    const agg = agregarVuelos(vuelos);

    const configsPorCurso = await Promise.all(cursosActivos.map(async (cursoId) => {
      let config = await Repo.listarConfigLicencia(cursoId);
      if (cursoId === 'PCA_HVI') {
        const simHoras = await Repo.getHviSimHoras();
        if (simHoras !== null && simHoras !== undefined) {
          config = config.filter((c) => c.nombre_requisito !== 'instrumentos').concat([
            { nombre_requisito: 'instrumentos', minimo_horas: Calc.round2(40 - simHoras) },
            { nombre_requisito: 'instrumentos_sim', minimo_horas: simHoras },
          ]);
        }
      }
      return { cursoId, curso: CURSOS.find((c) => c.id === cursoId), config };
    }));

    main.innerHTML = `
      ${this._htmlBannerProximoVuelo(programados)}
      ${this._htmlPrimerosPasos(aeronaves, vuelos)}

      <div class="card">
        <h2>${Icons.clock(18)} Total de horas y progreso de licencia</h2>
        <div class="hero-hours">
          <div class="hero-ring-col">
            <div class="ring-wrap">
              <svg width="168" height="168" viewBox="0 0 168 168">
                <circle class="ring-track" cx="84" cy="84" r="64" fill="none" stroke-width="9"></circle>
                <circle id="ring-fill" class="ring-fill" cx="84" cy="84" r="64" fill="none" stroke-width="9"
                  stroke-linecap="round" stroke-dasharray="402" stroke-dashoffset="402"></circle>
              </svg>
              <div class="ring-label">
                <span class="kpi" id="hero-horas-total">0</span>
                <span class="kpi-unit">Horas${agg.adiestrador_simulador > 0 ? ` · ${agg.adiestrador_simulador} sim.` : ''}</span>
              </div>
            </div>
            <p class="hero-ring-pct" id="hero-progreso-pct"></p>
          </div>
          <div id="hero-cursos-lista" style="flex:1;min-width:220px"></div>
        </div>
      </div>

      <button class="btn" style="width:100%;padding:16px;gap:10px;margin-bottom:16px" onclick="Router.irA('nuevo-vuelo')">
        <span>Nuevo vuelo</span>${Icons.plusCircle(18)}
      </button>

      <div class="card" id="card-proximo-vuelo">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="margin:0">${Icons.calendar(18)} Próximo vuelo</h2>
          <button class="btn ghost" id="btn-mostrar-form-programado">Programar vuelo</button>
        </div>
        <div id="form-programado" style="display:none;margin-bottom:14px"></div>
        <div id="proximo-vuelo"></div>
      </div>
    `;

    document.getElementById('btn-mostrar-form-programado').onclick = () => this._toggleFormProgramado();
    const btnBanner = document.getElementById('btn-ir-proximo-vuelo');
    if (btnBanner) btnBanner.onclick = () => document.getElementById('card-proximo-vuelo').scrollIntoView({ behavior: 'smooth' });

    try { renderHeroProgreso(configsPorCurso, agg); } catch (err) { console.error('Error renderizando progreso del dashboard:', err); }
    try { this._renderProximoVuelo(programados); } catch (err) { console.error('Error renderizando próximo vuelo:', err); }
  },

  // Franja compacta arriba del todo con el próximo vuelo agendado — sin
  // saludo ni foto, solo lo esencial (cuándo, en qué, a dónde). Clickeable:
  // lleva a la ficha completa (con METAR/TAF) que ya está más abajo.
  _htmlBannerProximoVuelo(programados) {
    if (!programados.length) return '';
    const p = programados[0];
    const [, mes, dia] = p.fecha.split('-');
    const fechaChica = `${dia} ${MESES_CORTOS[Number(mes) - 1]}`;
    const fechaLocal = Calc.parseFechaLocal(p.fecha);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const diasFaltan = fechaLocal ? Math.round((fechaLocal - hoy) / 86400000) : null;
    const cuenta = diasFaltan === null ? fechaChica
      : diasFaltan < 0 ? (diasFaltan === -1 ? 'Ayer' : `Hace ${-diasFaltan} días`)
      : diasFaltan === 0 ? 'Hoy' : diasFaltan === 1 ? 'Mañana' : `En ${diasFaltan} días`;
    const hora = p.hora_prevista ? ` · ${p.hora_prevista.slice(0, 5)}` : '';
    const matricula = p.aeronaves?.matricula || 'Sin asignar';
    const esLocal = p.desde && p.hasta && p.desde === p.hasta;
    const ruta = p.desde && p.hasta ? (esLocal ? 'Vuelo local' : `${p.desde} → ${p.hasta}`) : '';

    return `
      <button type="button" class="dash-proximo-banner" id="btn-ir-proximo-vuelo">
        <span class="dash-proximo-banner-cuenta">${Icons.calendar(15)} ${cuenta}${hora}</span>
        <span class="dash-proximo-banner-detalle">
          <span class="dash-proximo-banner-matricula">${matricula}</span>
          ${ruta ? `<span class="muted">${ruta}</span>` : ''}
        </span>
        ${Icons.chevronRight(16)}
      </button>
    `;
  },

  // Guía de primeros pasos para un piloto que recién entra — antes de esto,
  // un usuario nuevo caía directo a un dashboard vacío (anillo en 0%, "Sin
  // requisitos configurados", "No tenés vuelos agendados") sin que nada le
  // dijera por dónde arrancar. Desaparece sola apenas cargás tu primer
  // vuelo — a partir de ahí el dashboard ya tiene datos propios que mostrar.
  _htmlPrimerosPasos(aeronaves, vuelos) {
    if (vuelos.length) return '';
    const hayAeronave = aeronaves.length > 0;
    const paso = (n, hecho, titulo, desc, ruta) => `
      <div class="paso-item${hecho ? ' hecho' : ''}">
        <span class="paso-icono">${hecho ? Icons.checkCircle(20) : `<span class="paso-numero">${n}</span>`}</span>
        <div class="paso-texto">
          <p class="paso-titulo">${titulo}</p>
          <p class="paso-desc muted">${desc}</p>
        </div>
        ${!hecho ? `<button class="btn secondary" onclick="Router.irA('${ruta}')">Ir</button>` : ''}
      </div>`;
    return `
      <div class="card pasos-card">
        <h2>${Icons.tag('plane', 'Primeros pasos')}</h2>
        <p class="muted" style="margin:0 0 12px">Che, bienvenido — esto es lo que hace falta para arrancar a llevar tu libro de vuelo acá.</p>
        ${paso(1, hayAeronave, 'Cargá tu primera aeronave', 'Matrícula, modelo y tarifa por hora — de ahí sale el costo de cada vuelo. Los simuladores también van acá.', 'aeronaves')}
        ${paso(2, false, 'Revisá tus mínimos de licencia', 'En Perfil → Datos Personales elegís qué curso estás haciendo (viene precargado en PPA) y confirmás los mínimos de horas contra la RAAC 61.129 vigente.', 'perfil?seccion=personales')}
        ${paso(3, false, 'Cargá tu primer vuelo', hayAeronave ? 'Modo rápido (tiempo total) o detallado (los 8 campos del libro ANAC), como prefieras.' : 'Necesitás al menos una aeronave cargada antes de este paso.', 'nuevo-vuelo')}
      </div>
    `;
  },

  _renderProximoVuelo(programados) {
    const cont = document.getElementById('proximo-vuelo');
    if (!programados.length) {
      cont.innerHTML = `<p class="muted">No tenés vuelos agendados. Usá "Programar vuelo" para cargar el próximo.</p>`;
      return;
    }
    const vista = programados.slice(0, 3);
    this._programadosVista = vista;
    const tarjetas = vista.map((p, i) => {
      const [anio, mes, dia] = p.fecha.split('-');
      const fechaGrande = `${dia} ${MESES_CORTOS[Number(mes) - 1]}`;
      const metarId = `metar-${i}`;
      const tafId = `taf-${i}`;

      const fechaLocal = Calc.parseFechaLocal(p.fecha);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const diasFaltan = fechaLocal ? Math.round((fechaLocal - hoy) / 86400000) : null;
      // Atrasado (fecha ya pasada y todavía sin cargar) es un caso aparte
      // de "Hoy" — antes ambos caían en el mismo "diasFaltan <= 0" y un
      // vuelo de hace tres días se seguía mostrando como si fuera de hoy.
      const atrasado = diasFaltan !== null && diasFaltan < 0;
      const cuenta = diasFaltan === null ? '' : atrasado ? (diasFaltan === -1 ? 'Ayer' : `Hace ${-diasFaltan} días`) : diasFaltan === 0 ? 'Hoy' : diasFaltan === 1 ? 'Mañana' : `En ${diasFaltan} días`;
      const diaSemana = fechaLocal ? DIAS_SEMANA[fechaLocal.getDay()] : '';
      const esLocal = p.desde && p.hasta && p.desde === p.hasta;
      const prefLabel = obtenerPrefHorario() === 'local' ? 'hora local' : 'UTC';
      const matricula = p.aeronaves?.matricula || 'Sin asignar';
      const modelo = p.aeronaves?.marca_modelo || '';
      const ciudadDesde = ciudadDeAerodromo(p.desde);
      const ciudadHasta = ciudadDeAerodromo(p.hasta);

      // Etiquetas informativas: el tipo elegido al agendar (si lo eligió),
      // "Travesía" si no es local y no quedó ya cubierto por el tipo, y si
      // hay instructor asignado. Nada inventado — solo lo que la app sabe.
      const badges = [];
      if (p.tipo_vuelo) badges.push(labelTipoVueloProgramado(p.tipo_vuelo));
      if (p.desde && p.hasta && !esLocal && p.tipo_vuelo !== 'navegacion') badges.push('Travesía');
      if (p.instructor_nombre) badges.push('Con instructor');

      return `
        <div class="plan-card" data-idx="${i}">
          <div class="plan-seccion">
            <div class="plan-head-row">
              <div>
                <p class="plan-label">Fecha programada</p>
                <p class="plan-fecha-grande">${fechaGrande}${diaSemana ? ` <span class="muted" style="font-size:13px;font-weight:500">· ${diaSemana}</span>` : ''}</p>
                ${p.hora_prevista ? `<p class="plan-hora">${p.hora_prevista.slice(0, 5)} ${prefLabel}</p>` : ''}
              </div>
              ${cuenta ? `<span class="plan-countdown"${atrasado ? ' style="color:var(--warn, #d9822b)"' : ''}>${Icons.tag(atrasado ? 'alertTriangle' : 'clock', cuenta)}</span>` : ''}
            </div>
          </div>

          <div class="plan-seccion">
            <div class="plan-head-row">
              <p class="plan-label">Aeronave</p>
              <button class="plan-btn-editar" data-accion="editar" data-idx="${i}">Editar plan</button>
            </div>
            <p class="plan-aeronave-grande">${matricula}${modelo ? ` <span class="modelo">(${modelo})</span>` : ''}</p>

            ${p.desde && p.hasta ? (esLocal ? `
              <div class="plan-ruta">
                <div class="plan-ruta-punto">
                  <span class="plan-ruta-codigo">${p.desde}</span>
                  <span class="plan-ruta-ciudad">${ciudadDesde || 'Vuelo local'}</span>
                </div>
              </div>` : `
              <div class="plan-ruta">
                <div class="plan-ruta-punto">
                  <span class="plan-ruta-codigo">${p.desde}</span>
                  <span class="plan-ruta-ciudad">${ciudadDesde || '—'}</span>
                </div>
                <div class="plan-ruta-linea">${Icons.plane(16)}</div>
                <div class="plan-ruta-punto derecha">
                  <span class="plan-ruta-codigo">${p.hasta}</span>
                  <span class="plan-ruta-ciudad">${ciudadHasta || '—'}</span>
                </div>
              </div>`) : ''}

            ${badges.length ? `<div class="plan-badges">${badges.map((b) => `<span class="plan-badge">${b}</span>`).join('')}</div>` : ''}

            ${p.notas ? `<p class="plan-notas">${Icons.tag('list', UI.escapeHtml(p.notas))}</p>` : ''}
          </div>

          ${/^[A-Z]{4}$/.test(p.desde || '') ? `
          <div class="plan-seccion">
            <p class="plan-label">METAR ${p.desde}</p>
            <p id="${metarId}" class="plan-clima">Cargando…</p>
          </div>
          <div class="plan-seccion">
            <p class="plan-label">TAF ${p.desde}</p>
            <p id="${tafId}" class="plan-clima">Cargando…</p>
          </div>` : ''}

          <div class="plan-seccion">
            <div class="plan-acciones">
              <button class="btn secondary" data-accion="volado" data-idx="${i}">Marcar como volado</button>
              <div class="plan-acciones-iconos">
                <button class="btn ghost" data-accion="calendario" data-idx="${i}" title="Agregar a Google Calendar">${Icons.calendar(16)}</button>
                <button class="btn ghost" data-accion="recordatorios" data-idx="${i}" title="Recordatorios">${Icons.bell(16)}</button>
                <button class="btn ghost" data-accion="borrar" data-idx="${i}" title="Borrar">${Icons.trash(16)}</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    // Varios vuelos agendados no se apilan uno debajo del otro — van en un
    // carrusel horizontal con scroll-snap nativo (deslizás y cada tarjeta
    // encaja de a una, como una historia). Los indicadores de arriba (solo
    // si hay más de uno) muestran en cuál estás.
    const indicadores = vista.length > 1
      ? `<div class="plan-indicadores" id="plan-indicadores">${vista.map((_, idx) => `<span class="plan-indicador" data-idx="${idx}"></span>`).join('')}</div>`
      : '';
    cont.innerHTML = `${indicadores}<div class="plan-carrusel" id="plan-carrusel">${tarjetas}</div>`;

    // Delegación por índice: evita interpolar campos crudos (desde/hasta,
    // notas) dentro de un atributo onclick, que rompería con comillas.
    cont.querySelectorAll('button[data-accion]').forEach((b) => {
      b.onclick = () => {
        const p = this._programadosVista[Number(b.dataset.idx)];
        if (!p) return;
        if (b.dataset.accion === 'volado') this._marcarComoVolado(p.id, p.aeronave_id, p.fecha, p.desde, p.hasta);
        else if (b.dataset.accion === 'editar') this._toggleFormProgramado(p);
        else if (b.dataset.accion === 'calendario') {
          window.open(this._urlCalendarioProgramado(p), '_blank');
        } else if (b.dataset.accion === 'recordatorios') {
          RecordatoriosUI.abrir({
            eventoTipo: 'vuelo_programado',
            eventoId: p.id,
            titulo: `Vuelo del ${fmtFecha(p.fecha)}${p.desde ? ' — ' + p.desde + (p.hasta && p.hasta !== p.desde ? ' → ' + p.hasta : '') : ''}`,
          });
        } else this._borrarProgramado(p.id);
      };
    });

    if (vista.length > 1) this._bindCarruselProgramados();

    vista.forEach((p, i) => {
      if (/^[A-Z]{4}$/.test(p.desde || '')) {
        cargarMetar(p.desde, `metar-${i}`, 'metar');
        cargarMetar(p.desde, `taf-${i}`, 'taf');
      }
    });
  },

  // Prende el indicador de la tarjeta que está más a la vista mientras se
  // desliza el carrusel, y hace que tocar un indicador salte a esa tarjeta.
  _bindCarruselProgramados() {
    const carrusel = document.getElementById('plan-carrusel');
    const tarjetas = carrusel.querySelectorAll('.plan-card');
    const indicadores = document.querySelectorAll('#plan-indicadores .plan-indicador');

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = Number(entry.target.dataset.idx);
        indicadores.forEach((el, i) => el.classList.toggle('activo', i === idx));
      });
    }, { root: carrusel, threshold: 0.6 });
    tarjetas.forEach((el) => obs.observe(el));

    indicadores.forEach((el, idx) => {
      el.onclick = () => tarjetas[idx]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    });
  },

  // Arma un link de "Agregar a Google Calendar" con el evento ya completado
  // (un toque de "Guardar" del lado del usuario) — sin OAuth ni cuenta para
  // vincular, usa la que ya esté abierta en el navegador/celu. `hora_prevista`
  // se cargó según la preferencia de huso horario vigente al crear el vuelo
  // agendado (ver labelHora/obtenerPrefHorario), así que se interpreta con
  // la preferencia ACTUAL para pasarla a UTC real — Google Calendar la
  // traduce solo a la zona horaria de quien lo abre.
  _urlCalendarioProgramado(p) {
    const matricula = p.aeronaves?.matricula || this.aeronaves.find((a) => a.id === p.aeronave_id)?.matricula || '';
    const esLocal = p.desde && p.hasta && p.desde === p.hasta;
    const ruta = p.desde ? (esLocal || !p.hasta ? p.desde : `${p.desde} → ${p.hasta}`) : '';
    const titulo = `Vuelo${matricula ? ' ' + matricula : ''}${ruta ? ' — ' + ruta : ''}`;
    const detalles = [
      p.instructor_nombre ? `Instructor: ${p.instructor_nombre}` : '',
      p.notas || '',
    ].filter(Boolean).join('\n');

    const utcDeCampo = (hhmm) => {
      const [hh, mm] = hhmm.slice(0, 5).split(':').map(Number);
      if (obtenerPrefHorario() === 'local') {
        const d = Calc.parseFechaLocal(p.fecha);
        d.setHours(hh, mm, 0, 0);
        return d;
      }
      return new Date(`${p.fecha}T${hhmm.slice(0, 5)}:00Z`);
    };
    const fmtUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    let dates;
    if (p.hora_prevista) {
      const inicio = utcDeCampo(p.hora_prevista);
      const fin = p.hora_finalizacion ? utcDeCampo(p.hora_finalizacion) : new Date(inicio.getTime() + 3600000);
      dates = `${fmtUtc(inicio)}/${fmtUtc(fin > inicio ? fin : new Date(inicio.getTime() + 3600000))}`;
    } else {
      // Sin hora prevista: evento de todo el día. Formato Google Calendar
      // para todo el día es fecha de inicio / fecha del día SIGUIENTE.
      const soloFecha = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const inicio = Calc.parseFechaLocal(p.fecha);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 1);
      dates = `${soloFecha(inicio)}/${soloFecha(fin)}`;
    }

    // OJO: `dates` se arma a mano (no con URLSearchParams) porque la "/"
    // entre el inicio y el fin tiene que viajar LITERAL en la URL — el
    // endpoint de Google no la decodifica bien si llega como %2F (codificarla
    // hacía que Google descartara todo el rango y creara un evento de 30 min
    // por default, ignorando los horarios cargados).
    const partes = [
      'action=TEMPLATE',
      `text=${encodeURIComponent(titulo)}`,
      `dates=${dates}`,
      `details=${encodeURIComponent(detalles)}`,
    ];
    if (ruta) partes.push(`location=${encodeURIComponent(ruta)}`);
    return `https://calendar.google.com/calendar/render?${partes.join('&')}`;
  },

  // Mismo formulario para agendar uno nuevo o editar uno existente — si se
  // pasa `editando` (el vuelo agendado completo), precarga todos los campos
  // con lo que ya tenía y el botón guarda los cambios en vez de crear otro.
  _toggleFormProgramado(editando) {
    const cont = document.getElementById('form-programado');
    const visible = cont.style.display !== 'none';
    if (visible && !editando) { cont.style.display = 'none'; this._editandoProgramado = null; return; }

    this._editandoProgramado = editando || null;
    const p = editando || {};
    cont.innerHTML = `
      <div class="grid cols-2">
        <div class="field"><label>Fecha</label><input type="date" id="pv-fecha" value="${p.fecha || new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label>${labelHora('Hora prevista')}</label><input type="time" id="pv-hora" value="${(p.hora_prevista || '').slice(0, 5)}"></div>
        <div class="field">
          <label>Hora de finalización <span class="muted">(opcional)</span></label>
          <input type="time" id="pv-hora-fin" value="${(p.hora_finalizacion || '').slice(0, 5)}">
          <p class="muted" style="margin:4px 0 0">Si la completás, se crea solo un recordatorio para cargar los datos del vuelo al otro día.</p>
        </div>
        <div class="field"><label>Aeronave</label>
          <select id="pv-aeronave"><option value="">Sin definir</option>
            ${this.aeronaves.map((a) => `<option value="${a.id}" ${a.id === p.aeronave_id ? 'selected' : ''}>${a.matricula} — ${a.marca_modelo}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Instructor</label><input type="text" id="pv-instructor" value="${(p.instructor_nombre || '').replace(/"/g, '&quot;')}"></div>
        <div class="field"><label>Desde (OACI)</label><input type="text" id="pv-desde" maxlength="4" style="text-transform:uppercase" value="${p.desde || ''}"></div>
        <div class="field"><label>Hasta (OACI)</label><input type="text" id="pv-hasta" maxlength="4" style="text-transform:uppercase" value="${p.hasta || ''}"></div>
        <div class="field">
          <label>Tipo de vuelo <span class="muted">(opcional)</span></label>
          <select id="pv-tipo">
            <option value="">Sin especificar — usa Local/Travesía según destino</option>
            ${TIPOS_VUELO_PROGRAMADO.map(([c, label]) => `<option value="${c}" ${c === p.tipo_vuelo ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field"><label>Notas</label><input type="text" id="pv-notas" value="${(p.notas || '').replace(/"/g, '&quot;')}"></div>
      <div class="btn-row">
        <button class="btn" id="btn-guardar-programado">${editando ? 'Guardar cambios' : 'Agendar'}</button>
        ${editando ? '<button class="btn ghost" id="btn-cancelar-programado">Cancelar</button>' : ''}
      </div>
    `;
    cont.style.display = 'block';
    document.getElementById('btn-guardar-programado').onclick = () => this._guardarProgramado();
    if (editando) {
      document.getElementById('btn-cancelar-programado').onclick = () => {
        cont.style.display = 'none';
        this._editandoProgramado = null;
      };
      cont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    Autocomplete.attachAerodromo(document.getElementById('pv-desde'));
    Autocomplete.attachAerodromo(document.getElementById('pv-hasta'));
  },

  async _guardarProgramado() {
    const fecha = document.getElementById('pv-fecha').value;
    if (!fecha) { UI.toast('Elegí una fecha.', 'warn'); return; }
    const horaFin = document.getElementById('pv-hora-fin').value || null;
    const payload = {
      fecha,
      hora_prevista: document.getElementById('pv-hora').value || null,
      hora_finalizacion: horaFin,
      aeronave_id: document.getElementById('pv-aeronave').value || null,
      desde: document.getElementById('pv-desde').value.trim().toUpperCase() || null,
      hasta: document.getElementById('pv-hasta').value.trim().toUpperCase() || null,
      instructor_nombre: document.getElementById('pv-instructor').value || null,
      tipo_vuelo: document.getElementById('pv-tipo').value || null,
      notas: document.getElementById('pv-notas').value || null,
    };
    const esNuevo = !this._editandoProgramado;
    try {
      let id;
      if (this._editandoProgramado) {
        id = this._editandoProgramado.id;
        await Repo.actualizarVueloProgramado(id, payload);
        UI.toast('Vuelo agendado actualizado.', 'ok');
      } else {
        id = await Repo.crearVueloProgramado(payload);
      }
      await this._sincronizarRecordatorioCargaDatos(id, fecha, horaFin);
      this._editandoProgramado = null;
      this.render();
      if (esNuevo) {
        const alCalendario = await UI.confirmar('¿Agregar este vuelo a tu Google Calendar?', { ok: 'Sí, agregar', cancel: 'No' });
        if (alCalendario) window.open(this._urlCalendarioProgramado({ ...payload, id }), '_blank');

        const crear = await UI.confirmar('¿Deseás crear notificaciones para este vuelo?', { ok: 'Sí, crear', cancel: 'No' });
        if (crear) {
          RecordatoriosUI.abrir({
            eventoTipo: 'vuelo_programado',
            eventoId: id,
            titulo: `Vuelo del ${fmtFecha(fecha)}${payload.desde ? ' — ' + payload.desde + (payload.hasta && payload.hasta !== payload.desde ? ' → ' + payload.hasta : '') : ''}`,
          });
        }
      }
    } catch (err) {
      UI.toast('Error al agendar: ' + (err.message || err), 'error');
    }
  },

  // La "hora de finalización" arma sola un recordatorio de tipo
  // auto_cargar_datos para el otro día a las 9 (elegido así porque avisar
  // apenas termina el vuelo suele agarrar al piloto todavía en el aeródromo,
  // sin ganas de cargar datos en el celu). Si se saca la hora de fin, se
  // borra el recordatorio automático; si se vuelve a cargar, se recrea con
  // la fecha nueva — nunca queda uno viejo colgado.
  async _sincronizarRecordatorioCargaDatos(vueloProgramadoId, fecha, horaFin) {
    const existentes = await Repo.listarRecordatorios('vuelo_programado', vueloProgramadoId);
    for (const r of existentes.filter((r) => r.origen === 'auto_cargar_datos')) {
      await Repo.borrarRecordatorio(r.id);
    }
    if (!horaFin) return;
    const d = Calc.parseFechaLocal(fecha);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    await Repo.crearRecordatorio({
      evento_tipo: 'vuelo_programado',
      evento_id: vueloProgramadoId,
      tipo_disparo: 'fecha_hora',
      fecha_hora: d.toISOString(),
      mensaje: 'Recordá cargar los datos de este vuelo.',
      origen: 'auto_cargar_datos',
    });
  },

  _marcarComoVolado(id, aeronaveId, fecha, desde, hasta) {
    const params = new URLSearchParams({ prog: id, aeronave: aeronaveId || '', fecha, desde: desde || '', hasta: hasta || '' });
    Router.irA('nuevo-vuelo?' + params.toString());
  },

  async _borrarProgramado(id) {
    if (!(await UI.confirmar('¿Borrar este vuelo agendado?', { ok: 'Borrar', peligro: true }))) return;
    await Repo.borrarVueloProgramado(id);
    this.render();
  },
};

const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Tipo de vuelo agendado — completamente opcional. Si no se elige nada, la
// tarjeta de "Próximo vuelo" sigue mostrando Local/Travesía deducido del
// destino, como siempre; si se elige uno, se muestra este en su lugar.
const TIPOS_VUELO_PROGRAMADO = [
  ['solo', 'Vuelo Solo'],
  ['instruccion', 'Vuelo de Instrucción'],
  ['capota', 'Capota'],
  ['nocturno', 'Nocturno'],
  ['navegacion', 'Navegación'],
  ['examen', 'Examen'],
];
function labelTipoVueloProgramado(codigo) {
  return TIPOS_VUELO_PROGRAMADO.find(([c]) => c === codigo)?.[1] || codigo;
}

// Nombre de ciudad para un código OACI/local, del mismo dataset que usa el
// autocomplete de aeródromos — para mostrar "PALOMAR" debajo de "SADP".
function ciudadDeAerodromo(code) {
  if (!code) return '';
  // Un vuelo programado puede tener guardado el local/OACI/IATA según
  // cómo se haya tipeado — se normaliza al código canónico antes de
  // buscar (ver window.CODIGO_CANONICO en js/aerodromos.js).
  const canonico = (window.CODIGO_CANONICO && window.CODIGO_CANONICO[code]) || code;
  const a = (window.AERODROMOS || []).find((x) => x.code === canonico);
  return a?.ciudad || '';
}

// METAR/TAF real del aeródromo de origen — servicio público de NOAA
// (aviationweather.gov), sin API key. aviationweather.gov no manda headers
// CORS, así que el pedido no puede ir directo desde el navegador. Primero
// se intenta la Edge Function propia (supabase/functions/metar) — corre
// server-side, sin depender de terceros. Si todavía no está deployada (o
// falla), cae a un proxy CORS público (allorigins.win) como red de
// contención, para que el dato no deje de funcionar de un día para el otro.
//
// OJO: el nombre que se ve en "Name" en el dashboard de Supabase es solo
// una etiqueta — no cambia el slug/URL real de la función, que queda fijo
// desde el momento en que se creó (acá quedó "smooth-processor" en vez de
// "metar" porque así la generó Supabase al crearla). Si algún día se borra
// y se recrea con el slug "metar" desde el vamos, actualizar esta URL.
function _metarCacheKey(icao, tipo) { return `metar_cache_${tipo}_${icao}`; }

// `sustituto` (si el dato no es del aeródromo pedido sino del más cercano
// que sí tiene) viaja en la cache para que el aviso de "no es de este
// aeródromo" se siga viendo aunque después se muestre desde cache offline.
function _guardarMetarCache(icao, tipo, texto, sustituto = null) {
  try { localStorage.setItem(_metarCacheKey(icao, tipo), JSON.stringify({ texto, ts: Date.now(), sustituto })); } catch { /* storage lleno */ }
}
function _leerMetarCache(icao, tipo) {
  try { return JSON.parse(localStorage.getItem(_metarCacheKey(icao, tipo)) || 'null'); } catch { return null; }
}
function _horasDesde(ts) { return (Date.now() - ts) / 3600000; }

// Registro propio de "a qué código conviene pedirle este reporte" — para no
// tener que rebuscar entre los aeródromos cercanos cada vez que se abre el
// dashboard. NO es el texto del reporte (eso cambia hora a hora y se sigue
// pidiendo fresco siempre) — es la "receta" de dónde conseguirlo: el mismo
// código (tiene lo suyo), uno cercano ({icao, nm}, ver _buscarMetarCercano)
// o null (confirmado que ni uno ni el otro tienen). Una estación no aparece
// ni desaparece de un día para el otro, así que 30 días de vigencia alcanza
// de sobra y evita la búsqueda completa en casi todas las cargas.
function _metarRegistroKey(icao, tipo) { return `metar_registro_${tipo}_${icao}`; }
const REGISTRO_METAR_TTL_MS = 30 * 24 * 3600000;

function _guardarMetarRegistro(icao, tipo, resuelto) {
  try { localStorage.setItem(_metarRegistroKey(icao, tipo), JSON.stringify({ resuelto, ts: Date.now() })); } catch { /* storage lleno */ }
}
function _leerMetarRegistro(icao, tipo) {
  try {
    const r = JSON.parse(localStorage.getItem(_metarRegistroKey(icao, tipo)) || 'null');
    if (!r || (Date.now() - r.ts) > REGISTRO_METAR_TTL_MS) return { vigente: false };
    return { vigente: true, resuelto: r.resuelto };
  } catch { return { vigente: false }; }
}

// Un solo pedido de METAR/TAF crudo (propia Edge Function, con el proxy CORS
// público como red de contención) — sin tocar el DOM, para poder reusarlo
// tanto para el aeródromo pedido como para buscar en los cercanos.
async function _fetchMetarCrudo(icao, tipo) {
  const propia = `${window.SUPABASE_CONFIG.url}/functions/v1/${window.METAR_FN_SLUG}?icao=${icao}&tipo=${tipo}`;
  const destino = encodeURIComponent(`https://aviationweather.gov/api/data/${tipo}?ids=${icao}&format=raw`);
  const proxyPublico = `https://api.allorigins.win/raw?url=${destino}`;
  for (const url of [propia, proxyPublico]) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const texto = (await resp.text()).trim();
      if (texto) return texto;
    } catch { /* intenta la siguiente fuente */ }
  }
  return null;
}

// Muchos aeródromos chicos/privados no tienen estación meteorológica propia
// (sin METAR/TAF publicado nunca, no es un problema de conexión) — en vez de
// dejar el cartel vacío, se busca el aeródromo con código OACI más cercano
// que sí tenga, probando de más cerca a más lejos hasta encontrar uno (tope
// de 6 para no demorar de más si varios seguidos tampoco tienen).
async function _buscarMetarCercano(icaoOriginal, tipo, maxCandidatos = 6) {
  const coords = window.COORDENADAS_AERODROMO || {};
  const origen = coords[icaoOriginal];
  if (!origen || typeof distanciaNm !== 'function') return null;

  const candidatos = (window.AERODROMOS || [])
    .filter((a) => a.icao && a.icao !== icaoOriginal && coords[a.icao])
    .map((a) => ({ icao: a.icao, nm: distanciaNm(origen[0], origen[1], coords[a.icao][0], coords[a.icao][1]) }))
    .sort((a, b) => a.nm - b.nm)
    .slice(0, maxCandidatos);

  for (const c of candidatos) {
    const texto = await _fetchMetarCrudo(c.icao, tipo);
    if (texto) return { icao: c.icao, nm: Math.round(c.nm), texto };
  }
  return null;
}

// Aviso bien visible (mismo estilo que las alertas de vencimiento) cuando el
// METAR/TAF mostrado no es del aeródromo pedido sino del más cercano que sí
// tiene — para que no se confunda con el clima real de ahí.
function _renderMetarTexto(el, tipo, texto, sustituto) {
  // <span>, no <div>: el.plan-clima es un <p> y un bloque adentro de un
  // párrafo no es válido — display:flex (en vez de inline-flex, el default
  // de .badge) alcanza para que el aviso quede en su propia línea arriba
  // del texto, sin tener que meter un elemento de bloque de verdad.
  el.innerHTML = '';
  if (sustituto) {
    const aviso = document.createElement('span');
    aviso.className = 'badge warn';
    aviso.style.cssText = 'display:flex;margin-bottom:4px;white-space:normal';
    aviso.innerHTML = Icons.tag('alertTriangle', `No es de acá — ${tipo.toUpperCase()} de ${sustituto.icao}, el más cercano con datos (a ${sustituto.nm} nm)`);
    el.appendChild(aviso);
  }
  const cuerpo = document.createElement('span');
  cuerpo.style.display = 'block';
  cuerpo.textContent = texto;
  el.appendChild(cuerpo);
}

// Ni el aeródromo pedido ni ninguno cercano dieron datos (recién ahora, o ya
// lo sabíamos por el registro): mostramos el último leído (con su aviso de
// sustituto, si lo tenía) y, si tiene 1 hora o más, aclaramos la antigüedad
// — antes de esa hora sirve tal cual. Sin nada en cache, el mensaje final.
function _mostrarUltimaCacheOFallback(el, icao, tipo) {
  const cache = _leerMetarCache(icao, tipo);
  if (cache && cache.texto) {
    _renderMetarTexto(el, tipo, cache.texto, cache.sustituto);
    const horas = _horasDesde(cache.ts);
    if (horas >= 1) {
      const aviso = document.createElement('span');
      aviso.className = 'muted';
      aviso.style.cssText = 'display:block;font-size:11px;margin-top:2px';
      aviso.innerHTML = Icons.tag('alertTriangle', `${tipo.toUpperCase()} de hace ${Math.round(horas)} h — sin conexión al servicio`);
      el.appendChild(aviso);
    }
    return;
  }
  el.textContent = `${tipo.toUpperCase()} no disponible (ni acá ni en aeródromos cercanos).`;
}

async function cargarMetar(icao, elId, tipo = 'metar') {
  const el = document.getElementById(elId);
  if (!el) return;

  // Si ya sabemos (de una carga anterior, últimos 30 días) a qué código
  // pedirle esto — el mismo aeródromo, uno cercano, o ninguno — vamos
  // directo ahí en vez de rebuscar entre los cercanos de nuevo cada vez.
  const registro = _leerMetarRegistro(icao, tipo);
  if (registro.vigente) {
    if (registro.resuelto === null) { _mostrarUltimaCacheOFallback(el, icao, tipo); return; }
    const sustituto = registro.resuelto.icao !== icao ? registro.resuelto : null;
    const texto = await _fetchMetarCrudo(registro.resuelto.icao, tipo);
    if (texto) {
      _guardarMetarCache(icao, tipo, texto, sustituto);
      _renderMetarTexto(el, tipo, texto, sustituto);
      return;
    }
    // El registro decía que ahí solía haber — pero esta vez no respondió
    // (estación caída un rato, o dejó de reportar). No repetimos la
    // búsqueda completa por eso solo; mostramos la última cache que haya.
    _mostrarUltimaCacheOFallback(el, icao, tipo);
    return;
  }

  // Primera vez para este aeródromo (o el registro venció): se descubre de
  // cero dónde hay datos, y se guarda la receta para la próxima.
  const texto = await _fetchMetarCrudo(icao, tipo);
  if (texto) {
    _guardarMetarRegistro(icao, tipo, { icao, nm: 0 });
    _guardarMetarCache(icao, tipo, texto);
    _renderMetarTexto(el, tipo, texto, null);
    return;
  }

  const cercano = await _buscarMetarCercano(icao, tipo);
  if (cercano) {
    const sustituto = { icao: cercano.icao, nm: cercano.nm };
    _guardarMetarRegistro(icao, tipo, sustituto);
    _guardarMetarCache(icao, tipo, cercano.texto, sustituto);
    _renderMetarTexto(el, tipo, cercano.texto, sustituto);
    return;
  }

  _guardarMetarRegistro(icao, tipo, null);
  _mostrarUltimaCacheOFallback(el, icao, tipo);
}

// valorNocturnasAjustado vive en js/db.js (junto a valorRequisito — la usa
// también Totales).

// Promedio ponderado por tamaño del requisito, no un promedio simple de
// porcentajes: si un curso pide 200 hs y otro (ej. HAB_NOC) pide 3, ese de
// 3 hs no puede pesar lo mismo que el de 200 — si no, faltar poco de esas
// 3 hs hunde el % general aunque estés casi terminando el curso grande.
// Pura (sin DOM) a propósito, para poder testearla — ver tests/dashboard.test.js.
function calcularProgresoPonderado(porCurso) {
  const actualTotal = porCurso.reduce((s, c) => s + Math.min(c.actual, c.minimo), 0);
  const minimoTotal = porCurso.reduce((s, c) => s + c.minimo, 0);
  return minimoTotal > 0 ? Calc.round2(Math.min(100, (actualTotal / minimoTotal) * 100)) : 0;
}

// Promedia el progreso entre todos los cursos activos, ponderado por
// tamaño de requisito (ver comentario en la función), y lo pinta en el
// anillo grande del hero.
function renderHeroProgreso(configsPorCurso, agg) {
  const lista = document.getElementById('hero-cursos-lista');
  const ring = document.getElementById('ring-fill');
  const horasTotal = document.getElementById('hero-horas-total');
  const pctLabel = document.getElementById('hero-progreso-pct');
  const CIRC = 402; // 2 * PI * r(64)
  const CIRC_MINI = 226; // 2 * PI * r(36)

  if (horasTotal && typeof animarNumero === 'function') animarNumero(horasTotal, agg.tiempo_total);

  const conRequisitos = configsPorCurso.filter(({ config }) => config.length);
  if (!conRequisitos.length) {
    lista.innerHTML = '<p class="muted" style="margin:0">Sin requisitos configurados todavía.</p>';
    ring.style.strokeDashoffset = CIRC;
    if (pctLabel) pctLabel.textContent = '';
    return;
  }

  const porCurso = conRequisitos.map(({ cursoId, curso, config }) => {
    const principal = config.find((r) => r.nombre_requisito === 'total') || config[0];
    const actual = principal.nombre_requisito === 'nocturnas'
      ? valorNocturnasAjustado(cursoId, agg, configsPorCurso)
      : valorRequisito(principal.nombre_requisito, agg);
    const minimo = Calc.n(principal.minimo_horas);
    const pct = minimo > 0 ? Math.min(100, Calc.round2((actual / minimo) * 100)) : 0;
    const faltan = Math.max(0, Calc.round2(minimo - actual));
    const esUnidad = principal.nombre_requisito === 'aterrizajes_noche' || principal.nombre_requisito === 'remolques';
    return { cursoId, curso, principal, actual, minimo, pct, faltan, esUnidad };
  });

  const promedio = calcularProgresoPonderado(porCurso);
  if (pctLabel) pctLabel.textContent = promedio + '%';

  lista.innerHTML = `
    <div class="cursos-anillos">
      ${porCurso.map(({ cursoId, principal, pct, faltan, esUnidad }) => {
        const offset = CIRC_MINI - (CIRC_MINI * pct) / 100;
        const estado = faltan <= 0 ? '¡Completo!' : `faltan ${faltan}${esUnidad ? '' : ' hs'}`;
        return `
          <div class="curso-anillo">
            <div class="curso-anillo-svg">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle class="ring-track" cx="40" cy="40" r="36" fill="none" stroke-width="7"></circle>
                <circle class="ring-fill" cx="40" cy="40" r="36" fill="none" stroke-width="7"
                  stroke-linecap="round" stroke-dasharray="${CIRC_MINI}" stroke-dashoffset="${offset}"></circle>
              </svg>
              <span class="curso-anillo-pct">${pct}%</span>
            </div>
            <p class="curso-anillo-nombre">${cursoId.replace('_', ' ')}</p>
            <p class="curso-anillo-estado muted">${estado}</p>
          </div>`;
      }).join('')}
    </div>
  `;

  ring.style.strokeDashoffset = CIRC - (CIRC * promedio) / 100;
}

function fmtMoneda(x, moneda = 'ARS') {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda || 'ARS', maximumFractionDigits: 0 }).format(x || 0);
  } catch {
    return `$${(x || 0).toFixed(0)}`;
  }
}
function fmtFecha(f) {
  if (!f) return '—';
  const [y, m, d] = f.split('-');
  return `${d}/${m}/${y}`;
}

window.ViewDashboard = ViewDashboard;
window.fmtMoneda = fmtMoneda;
window.fmtFecha = fmtFecha;
