// ============================================================================
// VISTA: PERFIL / LICENCIAS / VENCIMIENTOS
// Los mínimos son EDITABLES y referenciales — no reemplazan la RAAC 61.129.
// ============================================================================

const ViewPerfil = {
  async render() {
    const main = document.getElementById('main-content');
    const [config, vencimientos] = await Promise.all([Repo.listarConfigLicencia(), Repo.listarVencimientos()]);

    main.innerHTML = `
      <div class="card">
        <h2>🎓 Objetivo de licencia — mínimos (referencial)</h2>
        <p class="muted">⚠️ Estos valores son configurables y orientativos. Confirmá siempre contra la RAAC 61.129 vigente antes de tomarlos como definitivos.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Requisito</th><th class="num">Mínimo (hs)</th><th></th></tr></thead>
          <tbody id="tbody-config">
            ${config.map((c) => `
              <tr>
                <td>${LABELS_REQUISITO[c.nombre_requisito] || c.nombre_requisito}</td>
                <td class="num"><input type="number" step="0.5" min="0" style="width:100px;text-align:right" data-id="${c.id}" value="${c.minimo_horas}"></td>
                <td><button class="btn ghost" onclick="ViewPerfil._guardarConfig('${c.id}')">💾</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table></div>
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

    document.getElementById('btn-agregar-vencimiento').onclick = () => this._agregarVencimiento();
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
