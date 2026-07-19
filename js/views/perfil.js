// ============================================================================
// VISTA: PERFIL / LICENCIAS / VENCIMIENTOS
// Los mínimos son EDITABLES y referenciales — no reemplazan la normativa
// vigente (RAAC 61.129 y las especificaciones puntuales de cada curso).
// ============================================================================

// Claves de requisito que la app efectivamente sabe calcular con tus
// vuelos. Si agregás un requisito con otra clave, va a quedar guardado
// pero el progreso te va a mostrar 0 — no hay una fórmula para inventarlo.
const CLAVES_REQUISITO_DISPONIBLES = ['total', 'pic', 'travesia_pic', 'nocturnas', 'instrumentos', 'aterrizajes_noche', 'remolques'];

const ViewPerfil = {
  cursoActivo: 'PPA',
  esAdmin: false,

  async render() {
    const main = document.getElementById('main-content');
    const perfil = await Repo.getPerfilPiloto();
    this.cursoActivo = perfil.curso_activo;
    this.esAdmin = perfil.es_admin;
    const [config, vencimientos] = await Promise.all([
      Repo.listarConfigLicencia(this.cursoActivo), Repo.listarVencimientos(),
    ]);

    main.innerHTML = `
      <div class="card">
        <h2>🎓 Curso / carrera actual</h2>
        <div class="field">
          <label>¿Qué estás haciendo ahora?</label>
          <select id="p-curso">
            ${CURSOS.map((c) => `<option value="${c.id}" ${c.id === this.cursoActivo ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </div>
        <p class="muted">Esto define qué progreso te muestra el Dashboard. Podés cambiarlo cuando avances de curso — los mínimos de cada uno quedan guardados aparte.</p>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h2 style="margin:0">Mínimos del curso seleccionado (referencial)</h2>
          <label style="display:flex;align-items:center;gap:8px;font-weight:400;color:var(--text);font-size:13px">
            <input type="checkbox" id="p-admin" style="width:auto" ${this.esAdmin ? 'checked' : ''}> 🔓 Modo administrador
          </label>
        </div>
        <p class="muted">⚠️ Estos valores son configurables y orientativos. Confirmá siempre contra la normativa vigente antes de tomarlos como definitivos. Activá "Modo administrador" para poder editar, agregar o sacar requisitos (por ejemplo, para sumar la habilitación HVI a un curso).</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Requisito</th><th class="num">Mínimo</th>${this.esAdmin ? '<th></th>' : ''}</tr></thead>
          <tbody id="tbody-config">
            ${config.map((c) => `
              <tr>
                <td>${LABELS_REQUISITO[c.nombre_requisito] || c.nombre_requisito}</td>
                <td class="num">${this.esAdmin
                  ? `<input type="number" step="0.5" min="0" style="width:100px;text-align:right" data-id="${c.id}" value="${c.minimo_horas}">`
                  : `${c.minimo_horas}`}</td>
                ${this.esAdmin ? `<td>
                  <button class="btn ghost" onclick="ViewPerfil._guardarConfig('${c.id}')">💾</button>
                  <button class="btn ghost" onclick="ViewPerfil._borrarConfig('${c.id}')">🗑️</button>
                </td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table></div>

        ${this.esAdmin ? `
          <h3 style="margin-top:14px">Agregar requisito</h3>
          <div class="field-row">
            <div class="field"><label>Requisito</label>
              <select id="p-nuevo-requisito">
                ${CLAVES_REQUISITO_DISPONIBLES.map((k) => `<option value="${k}">${LABELS_REQUISITO[k] || k}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>Mínimo</label><input type="number" step="0.5" min="0" id="p-nuevo-minimo" value="0"></div>
          </div>
          <button class="btn secondary" id="btn-agregar-requisito">+ Agregar</button>
        ` : ''}
      </div>

      <div class="card">
        <h2>🪪 Vencimientos</h2>
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
                <td><span class="badge ${est.estado}">${est.texto}</span></td>
                <td>${v.notas || ''}</td>
                <td><button class="btn ghost" onclick="ViewPerfil._borrarVencimiento('${v.id}')">🗑️</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>
      </div>
    `;

    document.getElementById('p-curso').onchange = (e) => this._cambiarCurso(e.target.value);
    document.getElementById('p-admin').onchange = (e) => this._setAdmin(e.target.checked);
    document.getElementById('btn-agregar-vencimiento').onclick = () => this._agregarVencimiento();
    if (this.esAdmin) {
      document.getElementById('btn-agregar-requisito').onclick = () => this._agregarRequisito();
    }
  },

  async _cambiarCurso(cursoId) {
    try {
      await Repo.setCursoActivo(cursoId);
      this.render();
    } catch (err) {
      alert('Error al cambiar de curso: ' + (err.message || err));
    }
  },

  async _setAdmin(valor) {
    try {
      await Repo.setEsAdmin(valor);
      this.render();
    } catch (err) {
      alert('Error al cambiar el modo administrador: ' + (err.message || err));
    }
  },

  async _agregarRequisito() {
    const nombre = document.getElementById('p-nuevo-requisito').value;
    const minimo = Calc.n(document.getElementById('p-nuevo-minimo').value);
    try {
      await Repo.agregarConfigLicencia(this.cursoActivo, nombre, minimo);
      this.render();
    } catch (err) {
      alert('Error al agregar: ' + (err.message || err));
    }
  },

  async _borrarConfig(id) {
    if (!confirm('¿Sacar este requisito del curso?')) return;
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
};

window.ViewPerfil = ViewPerfil;
