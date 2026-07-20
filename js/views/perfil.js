// ============================================================================
// VISTA: PERFIL — menú interno (como Ajustes): elegís a qué entrar.
// Datos Personales · Preferencias · Costos · Exportar · Alertas · Papelera.
// Costos y Exportar navegan a su propia pantalla (ya existían como vistas
// completas); el resto se muestra adentro de Perfil mismo.
// ============================================================================

// Claves de requisito que la app efectivamente sabe calcular con tus
// vuelos. Si el admin agrega un requisito con otra clave, va a quedar
// guardado pero el progreso va a mostrar 0 — no hay una fórmula para
// inventarlo.
const CLAVES_REQUISITO_DISPONIBLES = ['total', 'pic', 'travesia_pic', 'nocturnas', 'instrumentos', 'instrumentos_sim', 'aterrizajes_noche', 'remolques'];

const LABELS_REQUISITO = {
  total: 'Total', pic: 'Piloto al mando (PIC)', travesia_pic: 'Travesía como PIC',
  nocturnas: 'Nocturnas', instrumentos: 'Instrumentos (real + capota)',
  instrumentos_sim: 'Instrumentos en simulador (FSTD)',
  aterrizajes_noche: 'Aterrizajes nocturnos', remolques: 'Remolques',
};

const MENU_PERFIL = [
  { id: 'personales', icon: 'person', label: 'Datos Personales', desc: 'Cursos, licencia, contraseña' },
  { id: 'preferencias', icon: 'wrench', label: 'Preferencias', desc: 'Tema, huso horario' },
  { id: 'costos', icon: 'dollar', label: 'Costos', desc: 'Gasto de la carrera', ruta: 'costos' },
  { id: 'exportar', icon: 'download', label: 'Exportar', desc: 'Hoja ANAC, Excel, PDF, backup', ruta: 'exportar' },
  { id: 'alertas', icon: 'alertTriangle', label: 'Alertas', desc: 'Vencimientos, currency' },
  { id: 'notificaciones', icon: 'bell', label: 'Notificaciones', desc: 'Avisos push de vencimientos y vuelos' },
  { id: 'papelera', icon: 'trash', label: 'Papelera', desc: 'Vuelos borrados' },
];

function estadoVencimiento(v) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fv = Calc.parseFechaLocal(v.fecha_vencimiento);
  const dias = Math.round((fv - hoy) / 86400000);
  if (dias < 0) return { estado: 'danger', icon: 'xCircle', texto: `Vencido hace ${Math.abs(dias)} días` };
  if (dias <= (v.umbral_alerta_dias || 30)) return { estado: 'warn', icon: 'alertTriangle', texto: `Vence en ${dias} días` };
  return { estado: 'ok', icon: 'checkCircle', texto: `Vigente (${dias} días)` };
}

const ViewPerfil = {
  seccion: null, // null = menú · 'personales' | 'preferencias' | 'alertas' | 'papelera'
  cursosActivos: ['PPA'],
  esAdmin: false,
  mostrarAdmin: false,
  hviSimHoras: null,
  datosPiloto: {},
  notifConfig: {},
  permisoNotif: 'default',
  notifSuscripto: false,
  recordatoriosTodos: [],

  // Cada sección pide solo los datos que realmente usa — antes render()
  // hacía SIEMPRE las 6 consultas (cursos, admin, vencimientos, vuelos,
  // papelera, datos del piloto) sin importar a qué sección iba, lo que hacía
  // sentir lenta la navegación dentro de Perfil (ida y vuelta a Supabase por
  // algo que ni se mostraba). Preferencias, por ejemplo, no necesita ni
  // vuelos ni papelera ni datos del piloto.
  async render(params) {
    const main = document.getElementById('main-content');

    // Navegación fresca (el router siempre pasa `params`) vs re-render interno
    // (this.render() sin argumentos, tras guardar algo) — mismo patrón que
    // ViewNuevoVuelo: solo una navegación fresca puede cambiar de sección.
    if (params !== undefined) {
      const seccionPedida = params?.get('seccion');
      this.seccion = MENU_PERFIL.some((m) => m.id === seccionPedida && !m.ruta) ? seccionPedida : null;
    }
    // La vista de admin queda apagada por defecto: aunque seas el admin, la
    // app se ve como para un piloto normal hasta que la prendas vos mismo.
    this.mostrarAdmin = localStorage.getItem('admin_ui') === '1';

    // Entrar a una sección no pasa por el router (no cambia el hash), así que
    // el esqueleto diferido del router no aplica acá — se muestra este por
    // las mismas reglas: solo si tarda, nunca para una respuesta instantánea.
    const cancelarSkeleton = UI.skeletonDiferido(main);
    try {
      if (!this.seccion) {
        const [papelera, vencimientos] = await Promise.all([Repo.listarVuelosBorrados(), Repo.listarVencimientos()]);
        main.innerHTML = this._htmlMenu(papelera.length, vencimientos);
        this._bindMenu();
        return;
      }

      const volver = `<button class="btn ghost" id="btn-volver-perfil" style="margin-bottom:12px">← Perfil</button>`;
      if (this.seccion === 'personales') {
        const [cursosActivos, datosPiloto] = await Promise.all([Repo.getCursosActivos(), Repo.getDatosPiloto()]);
        this.cursosActivos = cursosActivos;
        this.datosPiloto = datosPiloto || {};
        if (this.cursosActivos.includes('PCA_HVI')) this.hviSimHoras = await Repo.getHviSimHoras();
        main.innerHTML = volver + this._htmlPersonales();
        this._bindPersonales();
      } else if (this.seccion === 'preferencias') {
        this.esAdmin = await Repo.esAdminApp();
        main.innerHTML = volver + this._htmlPreferencias();
        this._bindPreferencias();
        if (this.esAdmin && this.mostrarAdmin) await this._renderPanelAdmin();
      } else if (this.seccion === 'alertas') {
        const [vencimientos, vuelos] = await Promise.all([Repo.listarVencimientos(), Repo.listarVuelos()]);
        main.innerHTML = volver + this._htmlAlertas(vencimientos);
        this._bindAlertas();
        try { renderCurrency(vuelos); } catch (err) { console.error('Error renderizando currency:', err); }
      } else if (this.seccion === 'notificaciones') {
        this.notifConfig = await Repo.getNotifConfig();
        this.permisoNotif = Notificaciones.permiso();
        this.notifSuscripto = !!(await Notificaciones.suscripcionActual());
        if (this.notifSuscripto) {
          const [recordatorios, programados, vencimientos] = await Promise.all([
            Repo.listarRecordatoriosTodos(), Repo.listarVuelosProgramados(), Repo.listarVencimientos(),
          ]);
          this.recordatoriosTodos = recordatorios;
          this._eventosProgramados = programados;
          this._eventosVencimientos = vencimientos;
        }
        main.innerHTML = volver + this._htmlNotificaciones();
        this._bindNotificaciones();
      } else if (this.seccion === 'papelera') {
        const papelera = await Repo.listarVuelosBorrados();
        main.innerHTML = volver + this._htmlPapelera(papelera);
        this._bindPapelera();
      }
      document.getElementById('btn-volver-perfil').onclick = () => Router.irA('perfil');
    } finally {
      cancelarSkeleton();
    }
  },

  // ==========================================================================
  // MENÚ PRINCIPAL
  // ==========================================================================
  _htmlMenu(papeleraLen, vencimientos) {
    const alertasPend = vencimientos.filter((v) => estadoVencimiento(v).estado !== 'ok').length;
    return `
      <div class="card" style="padding:6px 16px">
        <div class="menu-list">
          ${MENU_PERFIL.map((m) => {
            const badge = m.id === 'papelera' && papeleraLen ? `<span class="badge warn">${papeleraLen}</span>`
              : m.id === 'alertas' && alertasPend ? `<span class="badge warn">${alertasPend}</span>` : '';
            return `
            <button class="menu-item" data-id="${m.id}" data-ruta="${m.ruta || ''}">
              <span class="menu-item-icon">${Icons[m.icon](20)}</span>
              <span class="menu-item-text">
                <span class="menu-item-label">${m.label}</span>
                <span class="menu-item-desc">${m.desc}</span>
              </span>
              ${badge}
              ${Icons.chevronRight(18)}
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <button class="btn ghost" id="btn-logout" style="width:100%;justify-content:center">${Icons.tag('logOut', 'Cerrar sesión')}</button>
      </div>
    `;
  },

  _bindMenu() {
    // Navega por hash (no solo cambia this.seccion en memoria) para que la
    // sección en la que estás quede en la URL — si el navegador descarga la
    // pestaña en segundo plano y volvés, la recarga te devuelve a la misma
    // sección en vez de al menú.
    document.querySelectorAll('.menu-item').forEach((b) => {
      b.onclick = () => Router.irA(b.dataset.ruta || ('perfil?seccion=' + b.dataset.id));
    });
    document.getElementById('btn-logout').onclick = () => Auth.cerrarSesion();
  },

  // ==========================================================================
  // DATOS PERSONALES — cursos, datos del piloto, cambiar contraseña
  // ==========================================================================
  _htmlPersonales() {
    return `
      <div class="card">
        <h2>${Icons.award(18)} Cursos / carreras activas</h2>
        <div class="field">
          <label>¿Qué estás haciendo ahora? (podés tildar más de uno, ej. un curso + una habilitación en paralelo)</label>
          <div id="p-cursos-lista" style="display:flex;flex-direction:column;gap:4px">
            ${CURSOS.map((c) => `
              <label style="display:flex;align-items:center;gap:8px;font-weight:400;color:var(--text)">
                <input type="checkbox" class="p-curso-check" value="${c.id}" style="width:auto" ${this.cursosActivos.includes(c.id) ? 'checked' : ''}>
                ${c.label}
              </label>`).join('')}
          </div>
        </div>
        <p class="muted">Esto define qué progreso te muestra el Dashboard. Podés cambiarlo cuando avances de curso o sumar una habilitación.</p>
      </div>

      ${this.cursosActivos.includes('PCA_HVI') ? this._htmlRepartoHvi() : ''}

      <div class="card">
        <h2>${Icons.idCard(18)} Datos del piloto</h2>
        <p class="muted" style="margin:0 0 10px">Se usan para completar la cabecera de la Hoja de Libro de Vuelo (ANAC 290/2012) cuando exportás.</p>
        <div class="grid cols-4">
          <div class="field"><label>Apellido y Nombre</label><input id="dp-nombre" value="${(this.datosPiloto.nombre_completo || '').replace(/"/g, '&quot;')}"></div>
          <div class="field"><label>Licencia</label><input id="dp-licencia" value="${(this.datosPiloto.licencia || '').replace(/"/g, '&quot;')}" placeholder="PPA / PCA…"></div>
          <div class="field"><label>Nº de licencia</label><input id="dp-lic-num" value="${(this.datosPiloto.licencia_numero || '').replace(/"/g, '&quot;')}"></div>
          <div class="field"><label>Legajo Nº</label><input id="dp-legajo" value="${(this.datosPiloto.legajo || '').replace(/"/g, '&quot;')}"></div>
        </div>
        <button class="btn" id="btn-guardar-datos-piloto" style="margin-top:8px">Guardar datos</button>
      </div>

      <div class="card">
        <h2>${Icons.lock(18)} Cambiar contraseña</h2>
        <div class="field"><label>Contraseña nueva</label><input type="password" id="cp-nueva" placeholder="Mínimo 6 caracteres"></div>
        <button class="btn secondary" id="btn-cambiar-clave">Cambiar contraseña</button>
      </div>

      <div class="card">
        <button class="btn ghost" id="btn-logout-personales" style="width:100%;justify-content:center">${Icons.tag('logOut', 'Cerrar sesión')}</button>
      </div>
    `;
  },

  _bindPersonales() {
    document.querySelectorAll('.p-curso-check').forEach((chk) => {
      chk.onchange = () => this._cambiarCursos();
    });
    document.getElementById('btn-guardar-datos-piloto').onclick = () => this._guardarDatosPiloto();
    document.getElementById('btn-cambiar-clave').onclick = () => this._cambiarPassword();
    document.getElementById('btn-logout-personales').onclick = () => Auth.cerrarSesion();
    if (this.cursosActivos.includes('PCA_HVI')) {
      document.getElementById('btn-guardar-hvi').onclick = () => this._guardarReparto();
      document.getElementById('hvi-sim').addEventListener('input', (e) => {
        const sim = Math.min(20, Math.max(0, Calc.n(e.target.value)));
        document.getElementById('hvi-real').value = Calc.round2(40 - sim);
      });
    }
  },

  _htmlRepartoHvi() {
    const yaElegido = this.hviSimHoras !== null && this.hviSimHoras !== undefined;
    const simActual = yaElegido ? this.hviSimHoras : 20;
    const realActual = Calc.round2(40 - simActual);
    return `
      <div class="card" style="border:1px solid var(--brand)">
        <h2>${Icons.award(18)} Reparto de instrumentos (HVI)</h2>
        <p class="muted">La RAAC (61.315.d) pide 40 hs de vuelo por instrumentos en total, de las cuales podés hacer <strong>hasta 20</strong> en simulador (FSTD) — el resto tiene que ser vuelo real. Elegís vos cómo repartirlas.</p>
        ${!yaElegido ? `<p class="muted">${Icons.tag('alertTriangle', 'Todavía no elegiste tu reparto — completalo para que el progreso te calcule bien.')}</p>` : ''}
        <div class="field-row">
          <div class="field">
            <label>Horas en simulador (0 a 20)</label>
            <input type="number" min="0" max="20" inputmode="decimal" step="0.5" id="hvi-sim" value="${simActual}">
          </div>
          <div class="field">
            <label>Horas reales (se completan solas)</label>
            <input type="number" id="hvi-real" value="${realActual}" disabled>
          </div>
        </div>
        <button class="btn" id="btn-guardar-hvi">Guardar reparto</button>
      </div>
    `;
  },

  async _cambiarPassword() {
    const input = document.getElementById('cp-nueva');
    const nueva = input.value;
    if (!nueva || nueva.length < 6) { UI.toast('La contraseña tiene que tener al menos 6 caracteres.', 'warn'); return; }
    try {
      const { error } = await Auth.actualizarPassword(nueva);
      if (error) { UI.toast('Error al cambiar la contraseña: ' + error.message, 'error'); return; }
      input.value = '';
      UI.toast('Contraseña actualizada.', 'ok');
    } catch (err) {
      UI.toast('Error al cambiar la contraseña: ' + (err.message || err), 'error');
    }
  },

  // ==========================================================================
  // PREFERENCIAS — tema, huso horario, vista de administrador (+ su panel)
  // ==========================================================================
  _htmlPreferencias() {
    const temaGuardado = temaActual();
    const horarioGuardado = obtenerPrefHorario();
    return `
      <div class="card">
        <h2>${Icons.wrench(18)} Preferencias</h2>
        <div class="field">
          <label>Tema</label>
          <div class="toggle-group" id="pref-tema" style="max-width:280px">
            <button type="button" data-valor="dark" class="${temaGuardado === 'dark' ? 'active' : ''}">${Icons.tag('moon', 'Oscuro')}</button>
            <button type="button" data-valor="light" class="${temaGuardado === 'light' ? 'active' : ''}">${Icons.tag('sun', 'Claro')}</button>
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Huso horario al cargar vuelos</label>
          <div class="toggle-group" id="pref-horario" style="max-width:280px">
            <button type="button" data-valor="utc" class="${horarioGuardado === 'utc' ? 'active' : ''}">UTC</button>
            <button type="button" data-valor="local" class="${horarioGuardado === 'local' ? 'active' : ''}">Hora local</button>
          </div>
          <p class="muted" style="margin:4px 0 0">Define qué aclaran los casilleros de hora al cargar un vuelo (ej. "Hora salida (UTC)").</p>
        </div>
        ${this.esAdmin ? `
        <div class="field" style="margin:12px 0 0">
          <label>${Icons.tag('lock', 'Vista de administrador')}</label>
          <div class="toggle-group" id="pref-admin" style="max-width:280px">
            <button type="button" data-valor="0" class="${this.mostrarAdmin ? '' : 'active'}">Usuario normal</button>
            <button type="button" data-valor="1" class="${this.mostrarAdmin ? 'active' : ''}">Admin</button>
          </div>
          <p class="muted" style="margin:4px 0 0">Solo vos ves esta opción. Con <strong>Admin</strong> aparece el panel para editar los mínimos de licencia (globales, para todos los usuarios). En <strong>Usuario normal</strong> la app se ve como para cualquier piloto.</p>
        </div>` : ''}
      </div>

      <div id="bloque-licencias"></div>
    `;
  },

  _bindPreferencias() {
    // Tema, horario y el toggle de admin son preferencias 100% locales
    // (localStorage) — no dependen de nada en Supabase. Actualizarlas con un
    // this.render() completo dispararía de nuevo las 6 consultas de red del
    // menú (cursos, vencimientos, vuelos, papelera, datos del piloto...) solo
    // para prender un botón, y eso es lo que se siente "lento": cada toque
    // esperando la vuelta del servidor para algo que es instantáneo. Acá se
    // actualiza en el momento, sin tocar la red.
    document.querySelectorAll('#pref-tema button').forEach((b) => {
      b.onclick = () => {
        setTema(b.dataset.valor);
        document.querySelectorAll('#pref-tema button').forEach((x) => x.classList.toggle('active', x === b));
      };
    });
    document.querySelectorAll('#pref-horario button').forEach((b) => {
      b.onclick = () => {
        guardarPrefHorario(b.dataset.valor);
        document.querySelectorAll('#pref-horario button').forEach((x) => x.classList.toggle('active', x === b));
      };
    });
    document.querySelectorAll('#pref-admin button').forEach((b) => {
      b.onclick = async () => {
        localStorage.setItem('admin_ui', b.dataset.valor);
        document.querySelectorAll('#pref-admin button').forEach((x) => x.classList.toggle('active', x === b));
        this.mostrarAdmin = b.dataset.valor === '1';
        if (this.mostrarAdmin) await this._renderPanelAdmin();
        else document.getElementById('bloque-licencias').innerHTML = '';
      };
    });
  },

  // ---- Vista admin: TODOS los cursos con sus requisitos, editables ----
  async _renderPanelAdmin() {
    const cont = document.getElementById('bloque-licencias');
    const todos = await Repo.listarConfigLicenciaTodos();

    cont.innerHTML = `
      <div class="card" style="border:1px solid var(--brand)">
        <h2>${Icons.lock(18)} Panel de administración de licencias</h2>
        <p class="muted">Estos mínimos son GLOBALES: los ve todo el que use la app. Cambiarlos acá actualiza el progreso de todos al instante. Usalo cuando cambie la normativa (RAAC) o quieras sumar una habilitación (ej. HVI).</p>
        ${CURSOS.map((curso) => this._tablaCursoAdmin(curso, todos.filter((r) => r.curso_id === curso.id))).join('')}
      </div>
    `;

    CURSOS.forEach((curso) => {
      document.getElementById(`btn-agregar-${curso.id}`).onclick = () => this._agregarRequisito(curso.id);
    });
  },

  _tablaCursoAdmin(curso, requisitos) {
    return `
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
        <h3>${curso.label}</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Requisito</th><th class="num">Mínimo</th><th></th></tr></thead>
          <tbody>
            ${requisitos.map((c) => `
              <tr>
                <td>${LABELS_REQUISITO[c.nombre_requisito] || c.nombre_requisito}</td>
                <td class="num"><input type="number" inputmode="decimal" step="0.5" min="0" style="width:100px;text-align:right" data-id="${c.id}" value="${c.minimo_horas}"></td>
                <td>
                  <button class="btn ghost" onclick="ViewPerfil._guardarConfig('${c.id}')">${Icons.save(16)}</button>
                  <button class="btn ghost" onclick="ViewPerfil._borrarConfig('${c.id}')">${Icons.trash(16)}</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="3" class="empty-state">Sin requisitos.</td></tr>'}
          </tbody>
        </table></div>
        <div class="field-row" style="margin-top:8px">
          <div class="field"><label>Agregar requisito</label>
            <select id="p-nuevo-requisito-${curso.id}">
              ${CLAVES_REQUISITO_DISPONIBLES.map((k) => `<option value="${k}">${LABELS_REQUISITO[k] || k}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Mínimo</label><input type="number" inputmode="decimal" step="0.5" min="0" id="p-nuevo-minimo-${curso.id}" value="0"></div>
          <div class="field" style="display:flex;align-items:flex-end">
            <button class="btn secondary" id="btn-agregar-${curso.id}">+ Agregar</button>
          </div>
        </div>
      </div>
    `;
  },

  // ==========================================================================
  // ALERTAS — vencimientos + currency
  // ==========================================================================
  _htmlAlertas(vencimientos) {
    this._vencimientosVista = vencimientos;
    return `
      <div class="card">
        <h2>${Icons.idCard(18)} Vencimientos</h2>
        <div class="grid cols-4">
          <div class="field"><label>Tipo</label>
            <select id="v-tipo">
              <option value="CMA">Certificado Médico Aeronáutico</option>
              <option value="habilitacion">Habilitación</option>
              <option value="IFR">Habilitación IFR</option>
              <option value="currency_nocturno">Currency nocturno</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div class="field"><label>Fecha de vencimiento</label><input type="date" id="v-fecha"></div>
          <div class="field"><label>Umbral de alerta (días)</label><input type="number" min="1" id="v-umbral" value="30"></div>
          <div class="field"><label>Notas</label><input id="v-notas"></div>
        </div>
        <div class="field" style="max-width:460px">
          <label style="display:flex;align-items:center;gap:8px;font-weight:400;color:var(--text)">
            <input type="checkbox" id="v-rodante" style="width:auto">
            Se resetea si volás (currency — ej. "vencés si no volás cada 30 días")
          </label>
          <div id="v-rodante-campo" style="display:none;margin-top:6px;max-width:200px">
            <label>Cada cuántos días tenés que volar</label>
            <input type="number" min="1" id="v-intervalo-dias" value="30">
          </div>
        </div>
        <button class="btn" id="btn-agregar-vencimiento">Agregar vencimiento</button>

        <div class="table-wrap" style="margin-top:14px"><table>
          <thead><tr><th>Tipo</th><th>Vence</th><th>Estado</th><th>Notas</th><th></th></tr></thead>
          <tbody id="tbody-vencimientos">
            ${vencimientos.map((v) => {
              const est = estadoVencimiento(v);
              return `<tr>
                <td>${v.tipo}${v.rodante ? ` <span class="muted" style="font-size:11px">(cada ${v.intervalo_dias}d)</span>` : ''}</td>
                <td>${fmtFecha(v.fecha_vencimiento)}</td>
                <td><span class="badge ${est.estado}">${Icons[est.icon](12)} ${est.texto}</span></td>
                <td>${v.notas || ''}</td>
                <td>
                  <button class="btn ghost" data-accion="recordatorios" data-id="${v.id}" title="Recordatorios">${Icons.bell(16)}</button>
                  <button class="btn ghost" data-accion="borrar" data-id="${v.id}" title="Borrar">${Icons.trash(16)}</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>

        <h3 style="margin-top:14px">Currency (RAAC 61.57, referencial)</h3>
        <div id="currency-lista"></div>
      </div>
    `;
  },

  _bindAlertas() {
    document.getElementById('btn-agregar-vencimiento').onclick = () => this._agregarVencimiento();
    document.getElementById('v-rodante').onchange = (e) => {
      document.getElementById('v-rodante-campo').style.display = e.target.checked ? 'block' : 'none';
    };
    document.querySelectorAll('#tbody-vencimientos button[data-accion]').forEach((b) => {
      b.onclick = () => {
        const v = this._vencimientosVista.find((x) => x.id === b.dataset.id);
        if (!v) return;
        if (b.dataset.accion === 'recordatorios') {
          RecordatoriosUI.abrir({ eventoTipo: 'vencimiento', eventoId: v.id, titulo: `${v.tipo} — vence ${fmtFecha(v.fecha_vencimiento)}` });
        } else {
          this._borrarVencimiento(v.id);
        }
      };
    });
  },

  // ==========================================================================
  // NOTIFICACIONES — Web Push nativo (VAPID) + Supabase, sin terceros.
  // Requiere haber corrido sql/agregar_notificaciones_push.sql, desplegado
  // supabase/functions/notificaciones-push y completado VAPID_PUBLIC_KEY en
  // js/config.js (ver README.md sección 8) — sin eso, esta pantalla explica
  // qué falta en vez de romperse.
  // ==========================================================================
  _htmlNotificaciones() {
    if (this.permisoNotif === 'unsupported') {
      return `
        <div class="card">
          <h2>${Icons.bellOff(18)} Notificaciones no disponibles</h2>
          <p class="muted">Este navegador no soporta notificaciones push. En iPhone/iPad: agregá la app a la pantalla de inicio primero (Safari no entrega push a una pestaña común, solo a la app instalada).</p>
        </div>`;
    }
    if (!window.VAPID_PUBLIC_KEY) {
      return `
        <div class="card">
          <h2>${Icons.bell(18)} Notificaciones</h2>
          <p class="muted">${Icons.tag('alertTriangle', 'Todavía falta terminar de configurar esto del lado del servidor (clave VAPID_PUBLIC_KEY en js/config.js) — ver README.md, sección 8.')}</p>
        </div>`;
    }
    if (this.permisoNotif === 'denied') {
      return `
        <div class="card">
          <h2>${Icons.bellOff(18)} Notificaciones bloqueadas</h2>
          <p class="muted">Bloqueaste el permiso de notificaciones para esta app. Para reactivarlo, entrá a la configuración del sitio en tu navegador (el ícono de candado/info junto a la URL) y cambiá "Notificaciones" a permitir.</p>
        </div>`;
    }
    if (!this.notifSuscripto) {
      return `
        <div class="card">
          <h2>${Icons.bell(18)} Activar notificaciones</h2>
          <p class="muted">Recibí un aviso cuando se acerque un vencimiento (CMA, habilitación, IFR, currency) o un vuelo programado. Se activa por dispositivo — si usás el celu y la notebook, activalo en cada uno.</p>
          <button class="btn" id="btn-activar-notif">${Icons.tag('bell', 'Activar notificaciones en este dispositivo')}</button>
        </div>`;
    }
    const cfg = this.notifConfig;
    return `
      <div class="card">
        <h2>${Icons.bell(18)} Notificaciones</h2>
        <p class="muted" style="margin:0 0 10px">${Icons.tag('checkCircle', 'Activas en este dispositivo.')}</p>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;font-weight:400;color:var(--text)">
            <input type="checkbox" id="nf-vencimientos" style="width:auto" ${cfg.vencimientos !== false ? 'checked' : ''}>
            Vencimientos (CMA, habilitaciones, IFR, currency)
          </label>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;font-weight:400;color:var(--text)">
            <input type="checkbox" id="nf-vuelos" style="width:auto" ${cfg.vuelos_programados !== false ? 'checked' : ''}>
            Vuelos programados
          </label>
        </div>
        <div class="field" style="max-width:220px">
          <label>Avisar con cuántas horas de anticipación</label>
          <input type="number" min="1" id="nf-horas-antes" value="${cfg.horas_antes_vuelo ?? 12}">
        </div>
        <p class="muted" style="margin:0 0 10px">Esto es el default: se usa solo en los eventos que no tengan ningún recordatorio propio configurado. Para avisos más específicos (varios por evento, X días antes, una fecha puntual), agregalos desde el vuelo programado o el vencimiento — quedan listados abajo.</p>
        <button class="btn" id="btn-guardar-notif">Guardar preferencias</button>
      </div>

      <div class="card">
        <h2>${Icons.list(18)} Recordatorios personalizados</h2>
        ${this.recordatoriosTodos.length
          ? this.recordatoriosTodos.map((r) => `
            <div class="rec-item">
              <span class="rec-item-texto">${Icons.bell(14)} <strong>${this._descripcionEvento(r.evento_tipo, r.evento_id)}</strong> — ${labelRecordatorio(r)}</span>
              <button class="btn ghost" data-accion="borrar-recordatorio" data-id="${r.id}">${Icons.trash(14)}</button>
            </div>`).join('')
          : '<p class="muted" style="margin:0">Todavía no creaste ninguno — se agregan desde un vuelo programado o un vencimiento puntual (botón de campanita).</p>'}
      </div>

      <div class="card">
        <button class="btn secondary" id="btn-prueba-notif" style="width:100%;justify-content:center">${Icons.tag('bell', 'Enviar notificación de prueba')}</button>
        <button class="btn ghost" id="btn-desactivar-notif" style="width:100%;justify-content:center;margin-top:8px">${Icons.tag('bellOff', 'Desactivar en este dispositivo')}</button>
      </div>
    `;
  },

  _descripcionEvento(tipo, id) {
    if (tipo === 'vuelo_programado') {
      const p = (this._eventosProgramados || []).find((x) => x.id === id);
      if (!p) return 'Vuelo programado (ya no existe)';
      return `Vuelo del ${fmtFecha(p.fecha)}${p.desde ? ' — ' + p.desde + (p.hasta && p.hasta !== p.desde ? ' → ' + p.hasta : '') : ''}`;
    }
    const v = (this._eventosVencimientos || []).find((x) => x.id === id);
    if (!v) return 'Vencimiento (ya no existe)';
    return `${v.tipo} — vence ${fmtFecha(v.fecha_vencimiento)}`;
  },

  _bindNotificaciones() {
    const btnActivar = document.getElementById('btn-activar-notif');
    if (btnActivar) btnActivar.onclick = () => this._activarNotif();
    const btnGuardar = document.getElementById('btn-guardar-notif');
    if (btnGuardar) btnGuardar.onclick = () => this._guardarNotifConfig();
    const btnPrueba = document.getElementById('btn-prueba-notif');
    if (btnPrueba) btnPrueba.onclick = () => this._probarNotif();
    const btnDesactivar = document.getElementById('btn-desactivar-notif');
    if (btnDesactivar) btnDesactivar.onclick = () => this._desactivarNotif();
    document.querySelectorAll('[data-accion="borrar-recordatorio"]').forEach((b) => {
      b.onclick = async () => {
        try {
          await Repo.borrarRecordatorio(b.dataset.id);
          this.render();
        } catch (err) {
          UI.toast('Error al borrar: ' + (err.message || err), 'error');
        }
      };
    });
  },

  async _activarNotif() {
    try {
      await Notificaciones.activar();
      UI.toast('Notificaciones activadas en este dispositivo.', 'ok');
      this.render();
    } catch (err) {
      UI.toast(err.message || 'No se pudo activar.', 'error');
    }
  },

  async _guardarNotifConfig() {
    try {
      await Repo.setNotifConfig({
        vencimientos: document.getElementById('nf-vencimientos').checked,
        vuelos_programados: document.getElementById('nf-vuelos').checked,
        horas_antes_vuelo: Calc.n(document.getElementById('nf-horas-antes').value) || 12,
      });
      UI.toast('Preferencias de notificaciones guardadas.', 'ok');
    } catch (err) {
      UI.toast('Error al guardar: ' + (err.message || err), 'error');
    }
  },

  async _probarNotif() {
    try {
      await Notificaciones.enviarPrueba();
      UI.toast('Notificación de prueba enviada — debería llegarte en unos segundos.', 'ok');
    } catch (err) {
      UI.toast('Error al enviar la prueba: ' + (err.message || err), 'error');
    }
  },

  async _desactivarNotif() {
    if (!(await UI.confirmar('¿Desactivar las notificaciones en este dispositivo?'))) return;
    try {
      await Notificaciones.desactivar();
      UI.toast('Notificaciones desactivadas en este dispositivo.', 'ok');
      this.render();
    } catch (err) {
      UI.toast('Error al desactivar: ' + (err.message || err), 'error');
    }
  },

  // ==========================================================================
  // PAPELERA
  // ==========================================================================
  _htmlPapelera(papelera) {
    return `
      <div class="card">
        <h2>${Icons.trash(18)} Papelera ${papelera.length ? `<span class="badge warn">${papelera.length}</span>` : ''}</h2>
        ${papelera.length
          ? `<p class="muted">Los vuelos borrados quedan acá hasta que los restaurés o los borrés definitivamente — nunca desaparecen solos.</p>
             <div class="table-wrap"><table>
               <thead><tr><th>Fecha</th><th>Ruta</th><th>Aeronave</th><th class="num">Tiempo</th><th></th></tr></thead>
               <tbody>
                 ${papelera.map((v) => `
                   <tr>
                     <td>${fmtFecha(v.fecha)}</td>
                     <td>${v.desde} → ${v.hasta}</td>
                     <td>${v.aeronaves?.matricula || '—'}</td>
                     <td class="num">${v.tiempo_total} hs</td>
                     <td>
                       <button class="btn ghost" onclick="ViewPerfil._restaurarVuelo('${v.id}')">${Icons.tag('checkCircle', 'Restaurar')}</button>
                       <button class="btn ghost" onclick="ViewPerfil._borrarVueloPermanente('${v.id}')">${Icons.trash(16)}</button>
                     </td>
                   </tr>`).join('')}
               </tbody>
             </table></div>`
          : `<p class="muted" style="margin:0">Vacía — los vuelos que borres van a aparecer acá primero.</p>`}
      </div>
    `;
  },

  _bindPapelera() {},

  // ==========================================================================
  // ACCIONES COMPARTIDAS
  // ==========================================================================
  async _guardarReparto() {
    const sim = Math.min(20, Math.max(0, Calc.n(document.getElementById('hvi-sim').value)));
    try {
      await Repo.setHviSimHoras(sim);
      this.render();
    } catch (err) {
      UI.toast('Error al guardar el reparto: ' + (err.message || err), 'error');
    }
  },

  async _cambiarCursos() {
    const seleccionados = [...document.querySelectorAll('.p-curso-check:checked')].map((chk) => chk.value);
    if (!seleccionados.length) { UI.toast('Tildá al menos un curso.', 'warn'); this.render(); return; }
    try {
      await Repo.setCursosActivos(seleccionados);
      this.render();
    } catch (err) {
      UI.toast('Error al cambiar de curso: ' + (err.message || err), 'error');
    }
  },

  async _agregarRequisito(cursoId) {
    const nombre = document.getElementById(`p-nuevo-requisito-${cursoId}`).value;
    const minimo = Calc.n(document.getElementById(`p-nuevo-minimo-${cursoId}`).value);
    try {
      await Repo.agregarConfigLicencia(cursoId, nombre, minimo);
      this.render();
    } catch (err) {
      UI.toast('Error al agregar (¿tenés permiso de administrador?): ' + (err.message || err), 'error');
    }
  },

  async _borrarConfig(id) {
    if (!(await UI.confirmar('¿Sacar este requisito? Se aplica para todos los usuarios.', { ok: 'Sacar', peligro: true }))) return;
    try {
      await Repo.borrarConfigLicencia(id);
      this.render();
    } catch (err) {
      UI.toast('Error al borrar: ' + (err.message || err), 'error');
    }
  },

  async _guardarConfig(id) {
    const input = document.querySelector(`input[data-id="${id}"]`);
    try {
      await Repo.guardarConfigLicencia({ id, minimo_horas: Calc.n(input.value) });
      this.render();
    } catch (err) {
      UI.toast('Error al guardar: ' + (err.message || err), 'error');
    }
  },

  async _guardarDatosPiloto() {
    try {
      await Repo.setDatosPiloto({
        nombre_completo: document.getElementById('dp-nombre').value.trim() || null,
        licencia: document.getElementById('dp-licencia').value.trim() || null,
        licencia_numero: document.getElementById('dp-lic-num').value.trim() || null,
        legajo: document.getElementById('dp-legajo').value.trim() || null,
      });
      UI.toast('Datos del piloto guardados.', 'ok');
    } catch (err) {
      UI.toast('Error al guardar: ' + (err.message || err), 'error');
    }
  },

  async _agregarVencimiento() {
    const tipo = document.getElementById('v-tipo').value;
    const fecha_vencimiento = document.getElementById('v-fecha').value;
    if (!fecha_vencimiento) { UI.toast('Elegí una fecha.', 'warn'); return; }
    const rodante = document.getElementById('v-rodante').checked;
    try {
      const id = await Repo.guardarVencimiento({
        tipo, fecha_vencimiento,
        umbral_alerta_dias: Calc.n(document.getElementById('v-umbral').value) || 30,
        notas: document.getElementById('v-notas').value || null,
        rodante,
        intervalo_dias: rodante ? (Calc.n(document.getElementById('v-intervalo-dias').value) || 30) : null,
      });
      this.render();
      const crear = await UI.confirmar('¿Deseás crear notificaciones para este vencimiento?', { ok: 'Sí, crear', cancel: 'No' });
      if (crear) {
        RecordatoriosUI.abrir({ eventoTipo: 'vencimiento', eventoId: id, titulo: `${tipo} — vence ${fmtFecha(fecha_vencimiento)}` });
      }
    } catch (err) {
      UI.toast('Error al guardar: ' + (err.message || err), 'error');
    }
  },

  async _borrarVencimiento(id) {
    if (!(await UI.confirmar('¿Borrar este vencimiento?', { ok: 'Borrar', peligro: true }))) return;
    await Repo.borrarVencimiento(id);
    this.render();
  },

  async _restaurarVuelo(id) {
    try {
      await Repo.restaurarVuelo(id);
      this.render();
    } catch (err) {
      UI.toast('Error al restaurar: ' + (err.message || err), 'error');
    }
  },

  async _borrarVueloPermanente(id) {
    if (!(await UI.confirmar('Esto lo borra para siempre, no se puede deshacer. ¿Seguro?', { ok: 'Borrar para siempre', peligro: true }))) return;
    try {
      await Repo.borrarVueloPermanente(id);
      this.render();
    } catch (err) {
      UI.toast('Error al borrar: ' + (err.message || err), 'error');
    }
  },
};

function renderCurrency(vuelos) {
  const cont = document.getElementById('currency-lista');
  const hace90 = new Date(); hace90.setHours(0, 0, 0, 0); hace90.setDate(hace90.getDate() - 90);
  const recientes = vuelos.filter((v) => Calc.parseFechaLocal(v.fecha) >= hace90);
  const aterrDia = recientes.reduce((s, v) => s + Calc.n(v.aterrizajes_dia), 0);
  const aterrNoche = recientes.reduce((s, v) => s + Calc.n(v.aterrizajes_noche), 0);
  const okDia = aterrDia >= 3, okNoche = aterrNoche >= 3;
  cont.innerHTML = `
    <div class="chip"><span class="badge ${okDia ? 'ok' : 'warn'}">${Icons[okDia ? 'checkCircle' : 'alertTriangle'](12)} ${aterrDia}/3</span> Despegues y aterrizajes (día, 90 días)</div>
    <div class="chip"><span class="badge ${okNoche ? 'ok' : 'warn'}">${Icons[okNoche ? 'checkCircle' : 'alertTriangle'](12)} ${aterrNoche}/3</span> Ídem nocturno (90 días)</div>
  `;
}

window.ViewPerfil = ViewPerfil;
