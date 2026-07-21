// ============================================================================
// VISTA: BITÁCORA — tabla filtrable/ordenable, con edición y borrado.
// ============================================================================

// Compartida entre el filtro de arriba y el panel de edición rápida — un
// solo lugar para no tener el mismo listado de códigos duplicado dos veces.
const FINALIDADES_VUELO = [
  ['INST', 'INST — Instrucción'], ['ADAP', 'ADAP — Adaptación'], ['REDAP', 'REDAP — Readaptación'],
  ['EXA', 'EXA — Examen'], ['ENTT', 'ENTT — Entrenamiento'], ['VP', 'VP — Vuelo privado'],
];

const ViewBitacora = {
  vuelos: [],
  filasActuales: [],
  aeronaves: [],
  orden: { campo: 'fecha', asc: false },
  filaEditando: null, // id del vuelo con el panel de edición rápida abierto

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
    }
    this.filtros = this.filtros || {};
    const [vuelos, aeronaves, vencimientos] = await Promise.all([
      Repo.listarVuelos(this.filtros), Repo.listarAeronaves(), Repo.listarVencimientos(),
    ]);
    this.vuelos = vuelos;
    this.aeronaves = aeronaves;

    main.innerHTML = `
      <div class="card">
        <h2>${Icons.list(18)} Bitácora</h2>
        <div class="grid cols-4">
          <div class="field"><label>Desde</label><input type="date" id="fx-desde" value="${this.filtros.desde || ''}"></div>
          <div class="field"><label>Hasta</label><input type="date" id="fx-hasta" value="${this.filtros.hasta || ''}"></div>
          <div class="field"><label>Aeronave</label>
            <select id="fx-aeronave"><option value="">Todas</option>
              ${this.aeronaves.map((a) => `<option value="${a.id}" ${a.id === this.filtros.aeronave_id ? 'selected' : ''}>${a.matricula}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Finalidad</label>
            <select id="fx-finalidad">
              <option value="">Todas</option>
              ${FINALIDADES_VUELO.map(([f, label]) => `<option value="${f}" ${f === this.filtros.finalidad_vuelo ? 'selected' : ''}>${label}</option>`).join('')}
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
    document.getElementById('btn-limpiar-filtro').onclick = () => Router.irA('bitacora');
    document.querySelectorAll('#tabla-bitacora th[data-orden]').forEach((th) => {
      th.style.cursor = 'pointer';
      th.onclick = () => this._ordenarPor(th.dataset.orden);
    });

    this.filasActuales = this.vuelos;
    this._renderFilas(this.filasActuales);
    this._renderEstadoLicencia(this.vuelos, vencimientos);
  },

  // Navega a la URL con el filtro puesto (en vez de solo refrescar la tabla
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
        <td class="num">${(() => { const c = Calc.costoRegistrado(v, v.aeronaves); return fmtMoneda(c.monto, c.moneda); })()}</td>
        <td>
          <button class="btn ghost" data-accion="toggle-edicion" data-id="${v.id}" title="Edición rápida">${Icons.edit(16)}</button>
          <button class="btn ghost" onclick="ViewBitacora._borrar('${v.id}')">${Icons.trash(16)}</button>
        </td>
      </tr>
      ${this.filaEditando === v.id ? this._filaEdicionInline(v) : ''}
    `).join('');
    tbody.querySelectorAll('button[data-accion="toggle-edicion"]').forEach((b) => {
      b.onclick = () => {
        this.filaEditando = this.filaEditando === b.dataset.id ? null : b.dataset.id;
        this._renderFilas(this.filasActuales);
      };
    });
    if (this.filaEditando) this._bindEdicionInline(this.filaEditando);
  },

  // Edición rápida sin salir de la Bitácora — a propósito NO toca los
  // tiempos de vuelo (los 8 buckets del libro ANAC): esos números tienen
  // que quedar exactos, y reconstruirlos a ciegas desde "tiempo total" acá
  // podría pisar mal una carga con piloto+copiloto mixto o local+travesía
  // mixto. Para eso sigue estando "Editar todo" (el formulario completo,
  // con validación). Esto cubre el caso más común: corregir un dato
  // administrativo (fecha, ruta, finalidad, aterrizajes, observaciones)
  // sin tener que reabrir y volver a revisar todo el vuelo.
  _filaEdicionInline(v) {
    return `
      <tr class="fila-edicion-inline">
        <td colspan="10">
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
            <button class="btn ghost" onclick="Router.irA('nuevo-vuelo?editar=${v.id}')">Editar todo</button>
          </div>
        </td>
      </tr>
    `;
  },

  _bindEdicionInline(id) {
    const fila = document.querySelector('.fila-edicion-inline');
    if (!fila) return;
    fila.querySelector('[data-accion="guardar-inline"]').onclick = () => this._guardarEdicionInline(id);
    fila.querySelector('[data-accion="cancelar-inline"]').onclick = () => {
      this.filaEditando = null;
      this._renderFilas(this.filasActuales);
    };
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
