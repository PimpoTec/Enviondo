// ============================================================================
// VISTA: PERFIL / LICENCIAS / VENCIMIENTOS
// Los mínimos son GLOBALES (los mismos para todos los pilotos que usen la
// app) y referenciales — no reemplazan la normativa vigente. Solo la
// cuenta admin (ver js/config.js ADMIN_EMAIL) puede editarlos; el resto
// los ve de solo lectura. RLS en Supabase hace cumplir esto del lado del
// servidor, no solo acá en la interfaz.
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

function estadoVencimiento(v) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fv = Calc.parseFechaLocal(v.fecha_vencimiento);
  const dias = Math.round((fv - hoy) / 86400000);
  if (dias < 0) return { estado: 'danger', icon: 'xCircle', texto: `Vencido hace ${Math.abs(dias)} días` };
  if (dias <= (v.umbral_alerta_dias || 30)) return { estado: 'warn', icon: 'alertTriangle', texto: `Vence en ${dias} días` };
  return { estado: 'ok', icon: 'checkCircle', texto: `Vigente (${dias} días)` };
}

const ViewPerfil = {
  cursosActivos: ['PPA'],
  esAdmin: false,
  hviSimHoras: null,

  async render() {
    const main = document.getElementById('main-content');
    const [cursosActivos, esAdmin, vencimientos, vuelos, papelera] = await Promise.all([
      Repo.getCursosActivos(), Repo.esAdminApp(), Repo.listarVencimientos(), Repo.listarVuelos(), Repo.listarVuelosBorrados(),
    ]);
    this.cursosActivos = cursosActivos;
    this.esAdmin = esAdmin;
    if (this.cursosActivos.includes('PCA_HVI')) {
      this.hviSimHoras = await Repo.getHviSimHoras();
    }

    const temaGuardado = temaActual();
    const horarioGuardado = obtenerPrefHorario();

    main.innerHTML = `
      <div class="card">
        <h2>${Icons.person(18)} Preferencias</h2>
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
      </div>

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

      <div id="bloque-licencias"></div>

      <div class="card">
        <h2>${Icons.dollar(18)} Costos y exportación</h2>
        <div class="btn-row">
          <button class="btn secondary" onclick="Router.irA('costos')">${Icons.tag('dollar', 'Ver costos de la carrera')}</button>
          <button class="btn secondary" onclick="Router.irA('exportar')">${Icons.tag('download', 'Exportar libro de vuelo')}</button>
        </div>
      </div>

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
        <button class="btn" id="btn-agregar-vencimiento">Agregar vencimiento</button>

        <div class="table-wrap" style="margin-top:14px"><table>
          <thead><tr><th>Tipo</th><th>Vence</th><th>Estado</th><th>Notas</th><th></th></tr></thead>
          <tbody id="tbody-vencimientos">
            ${vencimientos.map((v) => {
              const est = estadoVencimiento(v);
              return `<tr>
                <td>${v.tipo}</td><td>${fmtFecha(v.fecha_vencimiento)}</td>
                <td><span class="badge ${est.estado}">${Icons[est.icon](12)} ${est.texto}</span></td>
                <td>${v.notas || ''}</td>
                <td><button class="btn ghost" onclick="ViewPerfil._borrarVencimiento('${v.id}')">${Icons.trash(16)}</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>

        <h3 style="margin-top:14px">Currency (RAAC 61.57, referencial)</h3>
        <div id="currency-lista"></div>
      </div>

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

      <div class="card">
        <button class="btn ghost" id="btn-logout" style="width:100%;justify-content:center">${Icons.tag('logOut', 'Cerrar sesión')}</button>
      </div>
    `;

    document.querySelectorAll('#pref-tema button').forEach((b) => {
      b.onclick = () => { setTema(b.dataset.valor); this.render(); };
    });
    document.querySelectorAll('#pref-horario button').forEach((b) => {
      b.onclick = () => { guardarPrefHorario(b.dataset.valor); this.render(); };
    });
    document.querySelectorAll('.p-curso-check').forEach((chk) => {
      chk.onchange = () => this._cambiarCursos();
    });
    document.getElementById('btn-agregar-vencimiento').onclick = () => this._agregarVencimiento();
    document.getElementById('btn-logout').onclick = () => Auth.cerrarSesion();
    if (this.cursosActivos.includes('PCA_HVI')) {
      document.getElementById('btn-guardar-hvi').onclick = () => this._guardarReparto();
      document.getElementById('hvi-sim').addEventListener('input', (e) => {
        const sim = Math.min(20, Math.max(0, Calc.n(e.target.value)));
        document.getElementById('hvi-real').value = Calc.round2(40 - sim);
      });
    }

    try { renderCurrency(vuelos); } catch (err) { console.error('Error renderizando currency en Perfil:', err); }

    if (this.esAdmin) await this._renderPanelAdmin();
  },

  // ---- Reparto instrumentos real/simulador para PCA_HVI (61.315(d)) ----
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
            <input type="number" min="0" max="20" step="0.5" id="hvi-sim" value="${simActual}">
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

  async _guardarReparto() {
    const sim = Math.min(20, Math.max(0, Calc.n(document.getElementById('hvi-sim').value)));
    try {
      await Repo.setHviSimHoras(sim);
      this.render();
    } catch (err) {
      alert('Error al guardar el reparto: ' + (err.message || err));
    }
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
                <td class="num"><input type="number" step="0.5" min="0" style="width:100px;text-align:right" data-id="${c.id}" value="${c.minimo_horas}"></td>
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
          <div class="field"><label>Mínimo</label><input type="number" step="0.5" min="0" id="p-nuevo-minimo-${curso.id}" value="0"></div>
          <div class="field" style="display:flex;align-items:flex-end">
            <button class="btn secondary" id="btn-agregar-${curso.id}">+ Agregar</button>
          </div>
        </div>
      </div>
    `;
  },

  async _cambiarCursos() {
    const seleccionados = [...document.querySelectorAll('.p-curso-check:checked')].map((chk) => chk.value);
    if (!seleccionados.length) { alert('Tildá al menos un curso.'); this.render(); return; }
    try {
      await Repo.setCursosActivos(seleccionados);
      this.render();
    } catch (err) {
      alert('Error al cambiar de curso: ' + (err.message || err));
    }
  },

  async _agregarRequisito(cursoId) {
    const nombre = document.getElementById(`p-nuevo-requisito-${cursoId}`).value;
    const minimo = Calc.n(document.getElementById(`p-nuevo-minimo-${cursoId}`).value);
    try {
      await Repo.agregarConfigLicencia(cursoId, nombre, minimo);
      this.render();
    } catch (err) {
      alert('Error al agregar (¿tenés permiso de administrador?): ' + (err.message || err));
    }
  },

  async _borrarConfig(id) {
    if (!confirm('¿Sacar este requisito? Se aplica para todos los usuarios.')) return;
    try {
      await Repo.borrarConfigLicencia(id);
      this.render();
    } catch (err) {
      alert('Error al borrar: ' + (err.message || err));
    }
  },

  async _guardarConfig(id) {
    const input = document.querySelector(`input[data-id="${id}"]`);
    try {
      await Repo.guardarConfigLicencia({ id, minimo_horas: Calc.n(input.value) });
      this.render();
    } catch (err) {
      alert('Error al guardar: ' + (err.message || err));
    }
  },

  async _agregarVencimiento() {
    const tipo = document.getElementById('v-tipo').value;
    const fecha_vencimiento = document.getElementById('v-fecha').value;
    if (!fecha_vencimiento) { alert('Elegí una fecha.'); return; }
    try {
      await Repo.guardarVencimiento({
        tipo, fecha_vencimiento,
        umbral_alerta_dias: Calc.n(document.getElementById('v-umbral').value) || 30,
        notas: document.getElementById('v-notas').value || null,
      });
      this.render();
    } catch (err) {
      alert('Error al guardar: ' + (err.message || err));
    }
  },

  async _borrarVencimiento(id) {
    if (!confirm('¿Borrar este vencimiento?')) return;
    await Repo.borrarVencimiento(id);
    this.render();
  },

  async _restaurarVuelo(id) {
    try {
      await Repo.restaurarVuelo(id);
      this.render();
    } catch (err) {
      alert('Error al restaurar: ' + (err.message || err));
    }
  },

  async _borrarVueloPermanente(id) {
    if (!confirm('Esto lo borra para siempre, no se puede deshacer. ¿Seguro?')) return;
    try {
      await Repo.borrarVueloPermanente(id);
      this.render();
    } catch (err) {
      alert('Error al borrar: ' + (err.message || err));
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
