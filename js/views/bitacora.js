// ============================================================================
// VISTA: BITÁCORA — lista de vuelos filtrable/ordenable/paginada, con
// edición rápida y borrado.
// ============================================================================

// Compartida entre el filtro de arriba y el panel de edición rápida — un
// solo lugar para no tener el mismo listado de códigos duplicado dos veces.
const FINALIDADES_VUELO = [
  ['INST', 'INST — Instrucción'], ['ADAP', 'ADAP — Adaptación'], ['REDAP', 'REDAP — Readaptación'],
  ['EXA', 'EXA — Examen'], ['ENTT', 'ENTT — Entrenamiento'], ['VP', 'VP — Vuelo privado'],
];

const PAGINA_TAMANIO = 10;

const ViewBitacora = {
  vuelos: [],
  filasActuales: [],
  aeronaves: [],
  orden: { campo: 'fecha', asc: false },
  pagina: 1,
  filaEditando: null, // id del vuelo con el panel de edición rápida abierto
  filtroAbierto: false, // el panel de filtros arranca colapsado (se usa cada tanto)

  // El filtro vive en la URL (#bitacora?desde=...&aeronave=...), no solo en
  // memoria — si el navegador descarga la pestaña en segundo plano (pasa
  // seguido en mobile) y la recargás al volver, la URL sigue teniendo el
  // filtro y la bitácora lo vuelve a aplicar solo, en vez de mostrarte todo
  // de nuevo como si nunca lo hubieras puesto.
  async render(params) {
    const main = document.getElementById('main-content');
    // Navegación fresca (el router siempre pasa `params`) vs re-render interno
    // (this.render() sin argumentos, ej. después de borrar un vuelo) — solo
    // una navegación fresca puede cambiar el filtro; un re-render interno
    // mantiene el que ya estaba aplicado.
    if (params !== undefined) {
      this.filtros = {
        desde: params.get('desde') || undefined,
        hasta: params.get('hasta') || undefined,
        aeronave_id: params.get('aeronave') || undefined,
        finalidad_vuelo: params.get('finalidad') || undefined,
      };
      this.pagina = 1;
      // Si venís de un link/recarga con un filtro ya puesto en la URL, el
      // panel arranca abierto (para que se vea qué está filtrando) — si no,
      // colapsado, que es el caso de uso más común (se usa cada tanto).
      this.filtroAbierto = Object.values(this.filtros).some(Boolean);
    }
    this.filtros = this.filtros || {};
    const [vuelos, aeronaves, vencimientos] = await Promise.all([
      Repo.listarVuelos(this.filtros), Repo.listarAeronaves(), Repo.listarVencimientos(),
    ]);
    this.vuelos = vuelos;
    this.aeronaves = aeronaves;
    const hayFiltroActivo = Object.values(this.filtros).some(Boolean);

    main.innerHTML = `
      <div class="pantalla-header">
        <div>
          <h1>Libro de Vuelo Digital</h1>
          <p class="muted" style="margin:0">Registro detallado de tus vuelos, formato ANAC 290/2012.</p>
        </div>
        <div class="pantalla-header-cta">
          <button class="btn" onclick="Router.irA('nuevo-vuelo')">${Icons.plusCircle(16)} Nuevo registro</button>
          <button class="btn secondary" onclick="Router.irA('exportar')">${Icons.download(16)} Exportar</button>
        </div>
      </div>

      <div class="card" style="padding:6px 16px">
        <button type="button" class="filtro-toggle" id="btn-toggle-filtro">
          ${Icons.tag('search', 'Filtros')}
          ${hayFiltroActivo ? '<span class="badge neutral">Activo</span>' : ''}
          <span class="filtro-toggle-chevron${this.filtroAbierto ? ' abierto' : ''}">${Icons.chevronRight(16)}</span>
        </button>
        <div class="filtro-panel${this.filtroAbierto ? '' : ' oculto'}">
          <div class="campo-filtro">
            <label>${Icons.calendar(14)} Rango de fecha</label>
            <div class="campo-filtro-rango">
              <input type="date" id="fx-desde" value="${this.filtros.desde || ''}">
              <span class="muted">—</span>
              <input type="date" id="fx-hasta" value="${this.filtros.hasta || ''}">
            </div>
          </div>
          <div class="campo-filtro">
            <label>${Icons.plane(14)} Matrícula</label>
            <select id="fx-aeronave"><option value="">Todas las aeronaves</option>
              ${this.aeronaves.map((a) => `<option value="${a.id}" ${a.id === this.filtros.aeronave_id ? 'selected' : ''}>${a.matricula}</option>`).join('')}
            </select>
          </div>
          <div class="campo-filtro">
            <label>${Icons.person(14)} Función</label>
            <select id="fx-finalidad">
              <option value="">Cualquier función</option>
              ${FINALIDADES_VUELO.map(([f, label]) => `<option value="${f}" ${f === this.filtros.finalidad_vuelo ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <button class="btn ghost" id="btn-limpiar-filtro" style="width:100%;justify-content:center">${Icons.tag('list', 'Limpiar filtros')}</button>
        </div>
      </div>

      <div class="card">
        <div class="vuelo-lista-header">
          <h2 style="margin:0">${Icons.list(18)} Vuelos</h2>
          <select id="orden-campo" class="orden-select">
            <option value="fecha-desc">Más recientes primero</option>
            <option value="fecha-asc">Más antiguos primero</option>
            <option value="tiempo_total-desc">Más horas primero</option>
            <option value="total_pic-desc">Más PIC primero</option>
          </select>
        </div>
        <div id="lista-vuelos" class="vuelo-lista"></div>
        <p class="muted vuelo-lista-resumen" id="vuelo-lista-resumen"></p>
        <div class="vuelo-paginacion" id="vuelo-paginacion"></div>
      </div>

      <div class="grid cols-2">
        <div class="card" id="tarjeta-estado-licencia"></div>
        <div class="card seal-card">
          ${Icons.shieldCheck(28)}
          <p style="margin:4px 0 0;font-weight:600">Libro foliado y verificado</p>
          <p class="muted" style="margin:0">Formato conforme a ANAC Res. 290/2012</p>
        </div>
      </div>

      <button type="button" class="fab" onclick="Router.irA('nuevo-vuelo')" aria-label="Nuevo registro">${Icons.plusCircle(24)}</button>
    `;

    document.getElementById('btn-toggle-filtro').onclick = () => {
      this.filtroAbierto = !this.filtroAbierto;
      document.querySelector('.filtro-panel').classList.toggle('oculto', !this.filtroAbierto);
      document.querySelector('.filtro-toggle-chevron').classList.toggle('abierto', this.filtroAbierto);
    };
    document.querySelectorAll('#fx-desde, #fx-hasta, #fx-aeronave, #fx-finalidad').forEach((el) => {
      el.addEventListener('change', () => this._aplicarFiltro());
    });
    document.getElementById('btn-limpiar-filtro').onclick = () => Router.irA('bitacora');
    document.getElementById('orden-campo').value = `${this.orden.campo}-${this.orden.asc ? 'asc' : 'desc'}`;
    document.getElementById('orden-campo').onchange = (e) => this._aplicarOrden(e.target.value);

    this.filasActuales = this._ordenar(this.vuelos);
    this._renderLista();
    this._renderEstadoLicencia(this.vuelos, vencimientos);
  },

  // Navega a la URL con el filtro puesto (en vez de solo refrescar la lista
  // en memoria) — así queda en el hash y sobrevive a una recarga.
  _aplicarFiltro() {
    const qs = new URLSearchParams();
    const desde = document.getElementById('fx-desde').value;
    const hasta = document.getElementById('fx-hasta').value;
    const aeronave = document.getElementById('fx-aeronave').value;
    const finalidad = document.getElementById('fx-finalidad').value;
    if (desde) qs.set('desde', desde);
    if (hasta) qs.set('hasta', hasta);
    if (aeronave) qs.set('aeronave', aeronave);
    if (finalidad) qs.set('finalidad', finalidad);
    const query = qs.toString();
    Router.irA('bitacora' + (query ? '?' + query : ''));
  },

  _ordenar(vuelos) {
    const { campo, asc } = this.orden;
    return [...vuelos].sort((a, b) => {
      const va = a[campo], vb = b[campo];
      return (va > vb ? 1 : va < vb ? -1 : 0) * (asc ? 1 : -1);
    });
  },

  // El select de orden reemplaza al click-en-columna de la tabla vieja (ya
  // no hay encabezado de tabla en el diseño de tarjetas) — mismo resultado,
  // elegido de una lista en vez de tocar un <th>.
  _aplicarOrden(valor) {
    const [campo, dir] = valor.split('-');
    this.orden = { campo, asc: dir === 'asc' };
    this.pagina = 1;
    this.filasActuales = this._ordenar(this.vuelos);
    this._renderLista();
  },

  // Lista de tarjetas (una por vuelo) + paginación client-side — el filtro
  // ya trae solo lo que corresponde desde Supabase, pero con meses/años de
  // vuelos cargados esa lista puede ser larga; mostrarla entera de un
  // saque hace un scroll eterno, así que se corta de a páginas de
  // PAGINA_TAMANIO como el resto de las listas largas de la app.
  _renderLista() {
    const cont = document.getElementById('lista-vuelos');
    const resumen = document.getElementById('vuelo-lista-resumen');
    const paginacion = document.getElementById('vuelo-paginacion');
    const total = this.filasActuales.length;

    if (!total) {
      cont.innerHTML = `<p class="empty-state">Sin vuelos con esos filtros.</p>`;
      resumen.textContent = '';
      paginacion.innerHTML = '';
      return;
    }

    const totalPaginas = Math.max(1, Math.ceil(total / PAGINA_TAMANIO));
    this.pagina = Math.min(Math.max(1, this.pagina), totalPaginas);
    const inicio = (this.pagina - 1) * PAGINA_TAMANIO;
    const vista = this.filasActuales.slice(inicio, inicio + PAGINA_TAMANIO);

    cont.innerHTML = vista.map((v) => `
      <div class="vuelo-item" data-id="${v.id}">
        ${this._vueloItemHtml(v)}
      </div>
      ${this.filaEditando === v.id ? this._panelEdicionInline(v) : ''}
    `).join('');

    resumen.textContent = `Mostrando ${inicio + 1}-${Math.min(inicio + PAGINA_TAMANIO, total)} de ${total} vuelo${total === 1 ? '' : 's'} registrado${total === 1 ? '' : 's'}`;
    paginacion.innerHTML = this._paginacionHtml(this.pagina, totalPaginas);

    // Tocar la tarjeta (en cualquier parte que no sea un botón de acción)
    // abre una ficha de solo lectura con los datos importantes del vuelo,
    // sin tener que entrar al modo edición para verlos. Va en un modal
    // aparte (no expandiendo la tarjeta) para no desalinear el resto de
    // la lista al abrirse.
    cont.querySelectorAll('.vuelo-item').forEach((item) => {
      item.onclick = (e) => {
        if (e.target.closest('button')) return;
        const v = this.filasActuales.find((x) => x.id === item.dataset.id);
        if (v) this._abrirFichaVuelo(v);
      };
    });
    cont.querySelectorAll('button[data-accion="toggle-edicion"]').forEach((b) => {
      b.onclick = () => {
        this.filaEditando = this.filaEditando === b.dataset.id ? null : b.dataset.id;
        this._renderLista();
      };
    });
    cont.querySelectorAll('button[data-accion="borrar"]').forEach((b) => {
      b.onclick = () => this._borrar(b.dataset.id);
    });
    if (this.filaEditando) this._bindEdicionInline(this.filaEditando);

    paginacion.querySelectorAll('button[data-pagina]').forEach((b) => {
      b.onclick = () => { this.pagina = Number(b.dataset.pagina); this._renderLista(); };
    });
  },

  // Contenido de una tarjeta de vuelo — fecha, aeronave, ruta, función y
  // tiempo total (día/noche/PIC/aterrizajes/costo quedan en la ficha
  // completa, un tap más allá, para no amontonar la lista).
  _vueloItemHtml(v) {
    const [anio, mes, dia] = v.fecha.split('-');
    const fechaLocal = Calc.parseFechaLocal(v.fecha);
    const diaSemana = fechaLocal ? DIAS_SEMANA[fechaLocal.getDay()] : '';
    const esTerr = v.desde === 'TERR' && v.hasta === 'TERR';
    const esLocal = v.desde === v.hasta;
    const esNocturno = Calc.n(v.total_noche) > 0;

    return `
      <div class="vuelo-item-fecha">
        <span class="vuelo-item-fecha-dia">${dia} ${MESES_CORTOS[Number(mes) - 1]}</span>
        <span class="vuelo-item-fecha-anio muted">${anio}${diaSemana ? ` · ${diaSemana}` : ''}</span>
      </div>
      <div class="vuelo-item-aeronave">
        <span class="icon">${Icons.plane(16)}</span>
        <div>
          <p class="vuelo-item-matricula">${v.aeronaves?.matricula || '—'}</p>
          <p class="muted vuelo-item-modelo">${v.aeronaves?.marca_modelo || ''}</p>
        </div>
      </div>
      <div class="vuelo-item-ruta">${esTerr ? 'Simulador' : `${v.desde}${esLocal ? '' : ` <span class="muted">→</span> ${v.hasta}`}`}</div>
      <span class="badge neutral vuelo-item-badge">${v.finalidad_vuelo || '—'}</span>
      <div class="vuelo-item-tiempo">
        <span class="icon">${esNocturno ? Icons.moon(14) : Icons.sun(14)}</span>
        <span>${v.tiempo_total} hs</span>
      </div>
      <div class="vuelo-item-acciones">
        <button class="btn ghost" data-accion="toggle-edicion" data-id="${v.id}" title="Edición rápida">${Icons.edit(15)}</button>
        <button class="btn ghost" data-accion="borrar" data-id="${v.id}" title="Borrar">${Icons.trash(15)}</button>
      </div>
    `;
  },

  // Máximo 5 botones de página visibles (con el actual centrado cuando se
  // puede) — con muchas páginas, listarlas todas sería más ruido que ayuda.
  _paginacionHtml(pagina, totalPaginas) {
    if (totalPaginas <= 1) return '';
    let ini = Math.max(1, pagina - 2);
    let fin = Math.min(totalPaginas, ini + 4);
    ini = Math.max(1, fin - 4);
    const botones = [];
    for (let p = ini; p <= fin; p++) {
      botones.push(`<button type="button" class="pag-num ${p === pagina ? 'active' : ''}" data-pagina="${p}">${p}</button>`);
    }
    return `
      <button type="button" class="pag-flecha" data-pagina="${pagina - 1}" ${pagina <= 1 ? 'disabled' : ''}>${Icons.chevronLeft(16)}</button>
      ${botones.join('')}
      <button type="button" class="pag-flecha" data-pagina="${pagina + 1}" ${pagina >= totalPaginas ? 'disabled' : ''}>${Icons.chevronRight(16)}</button>
    `;
  },

  // Ficha de solo lectura ("check-in") con los datos importantes del
  // vuelo — ruta con ciudades, aeronave, horarios, tiempos, distancia
  // (línea recta, si se conocen las coordenadas de los dos aeródromos) y
  // costo. Para corregir algo, "Edición rápida" abre el panel editable en
  // el lugar de esta misma ficha.
  _ticketHtml(v) {
    const esLocal = v.desde === v.hasta;
    const ciudadDesde = typeof ciudadDeAerodromo === 'function' ? ciudadDeAerodromo(v.desde) : '';
    const ciudadHasta = typeof ciudadDeAerodromo === 'function' ? ciudadDeAerodromo(v.hasta) : '';

    let distanciaTxt = null;
    if (!esLocal && window.CODIGO_CANONICO && window.COORDENADAS_AERODROMO && typeof distanciaNm === 'function') {
      const codDesde = window.CODIGO_CANONICO[v.desde] || v.desde;
      const codHasta = window.CODIGO_CANONICO[v.hasta] || v.hasta;
      const a = window.COORDENADAS_AERODROMO[codDesde], b = window.COORDENADAS_AERODROMO[codHasta];
      if (a && b) distanciaTxt = `${distanciaNm(a[0], a[1], b[0], b[1])} nm`;
    }

    const costo = Calc.costoRegistrado(v, v.aeronaves);
    const salida = v.hora_salida_utc ? v.hora_salida_utc.slice(0, 5) : '—';
    const llegada = v.hora_llegada_utc ? v.hora_llegada_utc.slice(0, 5) : '—';
    const finalidad = (FINALIDADES_VUELO.find(([f]) => f === v.finalidad_vuelo) || [v.finalidad_vuelo])[0] || '—';
    const tag = `${finalidad} · ${Calc.n(v.total_noche) > 0 ? 'NOCTURNO' : 'DIURNO'}`;
    // TERR/TERR es el marcador de turno de adiestrador terrestre (simulador),
    // no un aeródromo real (ver normalizarCodigoAerodromo en totales.js) —
    // mostrar "TERR ↔ TERR" ahí sería confuso, así que en su lugar va
    // "SIMULADOR" con la matrícula del equipo (el mismo campo aeronave).
    const esTerr = v.desde === 'TERR' && v.hasta === 'TERR';
    const rutaHtml = esTerr
      ? `<div class="ticket-punto centro">
          <p class="ticket-codigo">SIMULADOR</p>
          <p class="ticket-ciudad">${v.aeronaves?.matricula || '—'}</p>
          <span class="ticket-tag">${tag}</span>
        </div>`
      : `<div class="ticket-punto">
          <p class="ticket-codigo">${v.desde}</p>
          <p class="ticket-ciudad">${ciudadDesde || '—'}</p>
        </div>
        <div class="ticket-medio">
          <div class="ticket-avion">${Icons.plane(16)}</div>
          <span class="ticket-tag">${tag}</span>
        </div>
        <div class="ticket-punto derecha">
          <p class="ticket-codigo">${v.hasta}</p>
          <p class="ticket-ciudad">${esLocal ? (ciudadDesde || '—') : (ciudadHasta || '—')}</p>
        </div>`;

    return `
      <div class="ticket-head">
        <div>
          <p class="ticket-lbl">Matrícula</p>
          <p class="ticket-flightno">${v.aeronaves?.matricula || '—'}</p>
        </div>
        <div class="ticket-fecha">
          <p class="ticket-lbl">Fecha</p>
          <p class="ticket-fecha-valor">${fmtFecha(v.fecha)}</p>
        </div>
      </div>

      <div class="ticket-ruta">${rutaHtml}</div>

      <div class="ticket-perforado"></div>

      <div class="ticket-datos">
        <div class="ticket-dato"><p class="ticket-lbl">Salida UTC</p><p class="ticket-val">${salida}</p></div>
        <div class="ticket-dato"><p class="ticket-lbl">Llegada UTC</p><p class="ticket-val">${llegada}</p></div>
        <div class="ticket-dato"><p class="ticket-lbl">Duración</p><p class="ticket-val brand">${v.tiempo_total} hs</p></div>
        <div class="ticket-dato"><p class="ticket-lbl">Modelo</p><p class="ticket-val">${v.aeronaves?.marca_modelo || '—'}</p></div>
        <div class="ticket-dato"><p class="ticket-lbl">PIC</p><p class="ticket-val">${v.total_pic} hs</p></div>
        <div class="ticket-dato"><p class="ticket-lbl">Aterrizajes</p><p class="ticket-val">${v.aterrizajes_dia}d / ${v.aterrizajes_noche}n</p></div>
        ${distanciaTxt ? `<div class="ticket-dato"><p class="ticket-lbl">Distancia</p><p class="ticket-val">${distanciaTxt}</p></div>` : ''}
        <div class="ticket-dato"><p class="ticket-lbl">Costo</p><p class="ticket-val">${fmtMoneda(costo.monto, costo.moneda)}</p></div>
      </div>

      ${v.ruta_track && v.ruta_track.length ? `
      <p class="ticket-lbl" style="margin:14px 0 6px">${Icons.tag('mapPin', 'Recorrido real (FlightRadar24)')}</p>
      <div class="ticket-track-mapa-wrap">
        <div class="ticket-track-mapa" id="ticket-track-mapa-${v.id}"></div>
        <button type="button" class="ticket-track-expandir" data-accion="expandir-mapa" data-id="${v.id}" title="Ampliar mapa">${Icons.maximize(16)}</button>
      </div>` : ''}

      ${v.observaciones ? `<p class="plan-notas" style="margin-top:14px">${Icons.tag('list', v.observaciones)}</p>` : ''}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn secondary" data-accion="editar-desde-detalle" data-id="${v.id}">${Icons.tag('edit', 'Edición rápida')}</button>
        <button class="btn ghost" data-accion="editar-todo" data-id="${v.id}">Editar todo</button>
      </div>
    `;
  },

  // Ficha en un modal aparte (fondo oscuro difuminado, tarjeta encima) en
  // vez de una fila que se abre debajo del vuelo tocado — adentro de la
  // tabla (más columnas que ancho de pantalla) esa fila desalineaba el
  // resto de las columnas de las otras filas al abrirse. Se cierra con la
  // cruz, tocando afuera, con Escape, o con el botón "atrás" del celu
  // (pushea una entrada al historial al abrir y la consume al cerrar, para
  // que un "atrás" real después no quede pisado por esto).
  _abrirFichaVuelo(v) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay ticket-overlay';
    overlay.innerHTML = `
      <div class="ticket-modal" role="dialog" aria-modal="true">
        <button class="ticket-modal-cerrar" aria-label="Cerrar">${Icons.x(18)}</button>
        <div class="ticket">${this._ticketHtml(v)}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    if (v.ruta_track && v.ruta_track.length) this._renderTrackMapa(v);

    // El botón flotante de "nuevo registro" queda tapando el mapa de la
    // ficha (mismo rincón inferior derecho) — se oculta mientras la ficha
    // está abierta y vuelve al cerrarla.
    const fab = document.querySelector('.fab');
    if (fab) fab.style.display = 'none';

    let cerradoPorHistorial = false;
    const cerrar = () => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPopState);
      if (fab) fab.style.display = '';
      if (!cerradoPorHistorial) history.back();
    };
    const onPopState = () => { cerradoPorHistorial = true; cerrar(); };
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };

    history.pushState({ fichaVuelo: v.id }, '', location.href);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.ticket-modal-cerrar').onclick = cerrar;
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cerrar(); });
    const btnExpandir = overlay.querySelector('button[data-accion="expandir-mapa"]');
    if (btnExpandir) btnExpandir.onclick = () => this._expandirMapa(v);
    overlay.querySelector('button[data-accion="editar-desde-detalle"]').onclick = () => {
      cerrar();
      this.filaEditando = v.id;
      this._renderLista();
    };
    overlay.querySelector('button[data-accion="editar-todo"]').onclick = () => Router.irA('nuevo-vuelo?editar=' + v.id);
  },

  // Mapa "glass cockpit" (mismo estilo que el de Totales) con el recorrido
  // real cargado desde un .kml de FlightRadar24 — reintenta un rato por si
  // Leaflet (cargado `defer`) todavía no terminó de bajar.
  _renderTrackMapa(v, intentos = 0) {
    const cont = document.getElementById(`ticket-track-mapa-${v.id}`);
    if (!cont) return; // se cerró el modal mientras tanto
    if (typeof L === 'undefined') {
      if (intentos < 20) { setTimeout(() => this._renderTrackMapa(v, intentos + 1), 250); return; }
      cont.innerHTML = '<p class="muted" style="padding:10px;margin:0">No se pudo cargar el mapa (revisá tu conexión).</p>';
      return;
    }
    const map = L.map(cont, { scrollWheelZoom: false, zoomControl: false, attributionControl: false });
    this._dibujarTrackEnMapa(map, v.ruta_track);
  },

  // Mini mapa fijo (sin zoom/scroll propio) → modal grande para ver el
  // recorrido en detalle y poder acercar/alejar (zoom con rueda, pellizco
  // o los botones +/-, según el dispositivo).
  _expandirMapa(v) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay ticket-track-overlay-grande';
    overlay.innerHTML = `
      <div class="ticket-track-modal-grande">
        <button class="ticket-modal-cerrar" aria-label="Cerrar">${Icons.x(18)}</button>
        <div id="ticket-track-mapa-grande"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    this._renderTrackMapaGrande(v);

    const cerrar = () => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('.ticket-modal-cerrar').onclick = cerrar;
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cerrar(); });
  },

  _renderTrackMapaGrande(v, intentos = 0) {
    const cont = document.getElementById('ticket-track-mapa-grande');
    if (!cont) return; // se cerró el modal mientras tanto
    if (typeof L === 'undefined') {
      if (intentos < 20) { setTimeout(() => this._renderTrackMapaGrande(v, intentos + 1), 250); return; }
      cont.innerHTML = '<p class="muted" style="padding:10px;margin:0">No se pudo cargar el mapa (revisá tu conexión).</p>';
      return;
    }
    const map = L.map(cont, { zoomControl: true, attributionControl: false });
    this._dibujarTrackEnMapa(map, v.ruta_track);
  },

  _dibujarTrackEnMapa(map, puntos) {
    const tilesOscuros = temaActual() !== 'light';
    const tileUrl = tilesOscuros
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(tileUrl, { maxZoom: 19, subdomains: 'abcd' }).addTo(map);
    L.control.attribution({ prefix: false, position: 'bottomleft' }).addAttribution('© OpenStreetMap © CARTO').addTo(map);

    const linea = L.polyline(puntos, { color: '#ff9f1c', weight: 2 }).addTo(map);
    L.circleMarker(puntos[0], { radius: 5, color: '#5cc98a', fillColor: '#5cc98a', fillOpacity: 1 }).addTo(map)
      .bindTooltip('Despegue', { permanent: false });
    L.circleMarker(puntos[puntos.length - 1], { radius: 5, color: '#e8756c', fillColor: '#e8756c', fillOpacity: 1 }).addTo(map)
      .bindTooltip('Aterrizaje', { permanent: false });
    map.fitBounds(linea.getBounds(), { padding: [16, 16] });
  },

  // Edición rápida sin salir de la Bitácora — a propósito NO toca los
  // tiempos de vuelo (los 8 buckets del libro ANAC): esos números tienen
  // que quedar exactos, y reconstruirlos a ciegas desde "tiempo total" acá
  // podría pisar mal una carga con piloto+copiloto mixto o local+travesía
  // mixto. Para eso sigue estando "Editar todo" (el formulario completo,
  // con validación). Esto cubre el caso más común: corregir un dato
  // administrativo (fecha, ruta, finalidad, aterrizajes, observaciones)
  // sin tener que reabrir y volver a revisar todo el vuelo.
  _panelEdicionInline(v) {
    return `
      <div class="fila-edicion-inline">
        <div class="grid cols-4">
          <div class="field"><label>Fecha</label><input type="date" id="ie-fecha" value="${v.fecha}"></div>
          <div class="field"><label>Desde (OACI)</label><input maxlength="4" style="text-transform:uppercase" id="ie-desde" value="${v.desde}"></div>
          <div class="field"><label>Hasta (OACI)</label><input maxlength="4" style="text-transform:uppercase" id="ie-hasta" value="${v.hasta}"></div>
          <div class="field"><label>Finalidad</label>
            <select id="ie-finalidad">${FINALIDADES_VUELO.map(([f, label]) => `<option value="${f}" ${f === v.finalidad_vuelo ? 'selected' : ''}>${label}</option>`).join('')}</select>
          </div>
        </div>
        <div class="grid cols-4">
          <div class="field"><label>Aterrizajes de día</label><input type="number" min="0" id="ie-aterr-dia" value="${Calc.n(v.aterrizajes_dia)}"></div>
          <div class="field"><label>Aterrizajes de noche</label><input type="number" min="0" id="ie-aterr-noche" value="${Calc.n(v.aterrizajes_noche)}"></div>
          <div class="field" style="grid-column:span 2"><label>Observaciones</label><input id="ie-obs" value="${(v.observaciones || '').replace(/"/g, '&quot;')}"></div>
        </div>
        <p class="muted" style="margin:0 0 10px">Para corregir horas/tiempos de vuelo, usá "Editar todo" — acá solo se cambian los datos administrativos.</p>
        <div class="btn-row">
          <button class="btn" data-accion="guardar-inline">Guardar</button>
          <button class="btn ghost" data-accion="cancelar-inline">Cancelar</button>
          <button class="btn ghost" data-accion="editar-todo-inline">Editar todo</button>
        </div>
      </div>
    `;
  },

  _bindEdicionInline(id) {
    const panel = document.querySelector('.fila-edicion-inline');
    if (!panel) return;
    panel.querySelector('[data-accion="guardar-inline"]').onclick = () => this._guardarEdicionInline(id);
    panel.querySelector('[data-accion="cancelar-inline"]').onclick = () => {
      this.filaEditando = null;
      this._renderLista();
    };
    panel.querySelector('[data-accion="editar-todo-inline"]').onclick = () => Router.irA('nuevo-vuelo?editar=' + id);
  },

  async _guardarEdicionInline(id) {
    const desde = document.getElementById('ie-desde').value.trim().toUpperCase();
    const hasta = document.getElementById('ie-hasta').value.trim().toUpperCase();
    const cambios = {
      fecha: document.getElementById('ie-fecha').value,
      desde, hasta,
      finalidad_vuelo: document.getElementById('ie-finalidad').value,
      aterrizajes_dia: Calc.n(document.getElementById('ie-aterr-dia').value),
      aterrizajes_noche: Calc.n(document.getElementById('ie-aterr-noche').value),
      observaciones: document.getElementById('ie-obs').value || null,
    };
    if (!cambios.fecha || desde.length !== 4 || hasta.length !== 4) {
      UI.toast('Revisá la fecha y los códigos OACI (4 letras).', 'warn');
      return;
    }
    try {
      await Repo.actualizarVuelo(id, cambios);
      this.filaEditando = null;
      UI.toast('Vuelo actualizado.', 'ok');
      this.render();
    } catch (err) {
      UI.toast('Error al guardar: ' + (err.message || err), 'error');
    }
  },

  _renderEstadoLicencia(vuelos, vencimientos) {
    const cont = document.getElementById('tarjeta-estado-licencia');
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const hace90 = new Date(hoy); hace90.setDate(hace90.getDate() - 90);
    const horas90 = vuelos
      .filter((v) => Calc.parseFechaLocal(v.fecha) >= hace90)
      .reduce((s, v) => s + Calc.n(v.tiempo_total), 0);
    const proximo = vencimientos
      .filter((v) => Calc.parseFechaLocal(v.fecha_vencimiento) >= hoy)
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
    if (!(await UI.confirmar('¿Borrar este vuelo? Queda en la Papelera (Perfil) por si lo querés restaurar.', { ok: 'Borrar', peligro: true }))) return;
    try {
      await Repo.borrarVuelo(id);
      this.render();
    } catch (err) {
      UI.toast('Error al borrar: ' + (err.message || err), 'error');
    }
  },
};

window.ViewBitacora = ViewBitacora;
