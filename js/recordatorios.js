// ============================================================================
// RECORDATORIOS — uno o varios avisos personalizados por evento (vuelo
// programado o vencimiento): "X días antes", "X horas antes", o una fecha y
// hora puntual. Se editan siempre desde el mismo modal, sin importar si se
// abre desde el evento (tarjeta de Próximo vuelo, fila de Alertas) o desde
// la lista centralizada de Perfil → Notificaciones — un solo componente,
// reutilizado en los tres lugares.
// "Editar" un recordatorio es borrarlo y crear el que corresponda: no hay
// edición in-place, la lista + alta + baja ya cubre el caso sin duplicar
// el formulario.
// ============================================================================

const TIPOS_DISPARO_RECORDATORIO = [
  ['dias_antes', 'días antes'],
  ['horas_antes', 'horas antes'],
  ['fecha_hora', 'en una fecha y hora puntual'],
];

function fmtFechaHoraRecordatorio(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function labelRecordatorio(r) {
  if (r.tipo_disparo === 'dias_antes') return `${r.valor} día(s) antes`;
  if (r.tipo_disparo === 'horas_antes') return `${r.valor} hora(s) antes`;
  if (r.tipo_disparo === 'fecha_hora') return `El ${fmtFechaHoraRecordatorio(r.fecha_hora)}`;
  return r.tipo_disparo;
}

const RecordatoriosUI = {
  // { eventoTipo: 'vuelo_programado'|'vencimiento', eventoId, titulo }
  abrir({ eventoTipo, eventoId, titulo }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box ancho" role="dialog" aria-modal="true">
        <h3 style="margin-top:0">${Icons.bell(18)} Recordatorios</h3>
        <p class="muted" style="margin:0 0 12px">${titulo}</p>
        <div id="rec-lista"><p class="muted">Cargando…</p></div>
        <div class="grid cols-2" style="margin-top:14px">
          <div class="field">
            <label>Avisarme</label>
            <select id="rec-tipo">${TIPOS_DISPARO_RECORDATORIO.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
          </div>
          <div class="field" id="rec-campo-valor"><label>Cantidad</label><input type="number" min="1" id="rec-valor" value="1"></div>
        </div>
        <div class="field"><label>Mensaje <span class="muted">(opcional)</span></label><input type="text" id="rec-mensaje" placeholder="Se arma uno automático si lo dejás vacío"></div>
        <div class="modal-acciones" style="justify-content:space-between">
          <button class="btn ghost" id="rec-cerrar">Cerrar</button>
          <button class="btn" id="rec-agregar">+ Agregar recordatorio</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const cerrar = () => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 180);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#rec-cerrar').onclick = cerrar;
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cerrar(); });

    const tipoSel = overlay.querySelector('#rec-tipo');
    const campoValor = overlay.querySelector('#rec-campo-valor');
    tipoSel.onchange = () => {
      campoValor.innerHTML = tipoSel.value === 'fecha_hora'
        ? '<label>Fecha y hora</label><input type="datetime-local" id="rec-valor">'
        : '<label>Cantidad</label><input type="number" min="1" id="rec-valor" value="1">';
    };

    const listaEl = overlay.querySelector('#rec-lista');
    const cargarLista = async () => {
      let items = [];
      try {
        items = await Repo.listarRecordatorios(eventoTipo, eventoId);
      } catch (err) {
        listaEl.innerHTML = `<p class="muted">Error al cargar: ${err.message || err}</p>`;
        return;
      }
      listaEl.innerHTML = items.length
        ? items.map((r) => `
          <div class="rec-item">
            <span class="rec-item-texto">${Icons.bell(14)} ${labelRecordatorio(r)}${r.mensaje ? ` — "${r.mensaje}"` : ''}</span>
            <button class="btn ghost" data-id="${r.id}">${Icons.trash(14)}</button>
          </div>`).join('')
        : '<p class="muted" style="margin:0">Sin recordatorios todavía para este evento.</p>';
      listaEl.querySelectorAll('button[data-id]').forEach((b) => {
        b.onclick = async () => {
          try {
            await Repo.borrarRecordatorio(b.dataset.id);
            cargarLista();
          } catch (err) {
            UI.toast('Error al borrar: ' + (err.message || err), 'error');
          }
        };
      });
    };
    cargarLista();

    overlay.querySelector('#rec-agregar').onclick = async () => {
      const tipo = tipoSel.value;
      const valorInput = overlay.querySelector('#rec-valor');
      const mensaje = overlay.querySelector('#rec-mensaje').value.trim() || null;
      try {
        if (tipo === 'fecha_hora') {
          if (!valorInput.value) { UI.toast('Elegí fecha y hora.', 'warn'); return; }
          await Repo.crearRecordatorio({ evento_tipo: eventoTipo, evento_id: eventoId, tipo_disparo: tipo, fecha_hora: new Date(valorInput.value).toISOString(), mensaje });
        } else {
          const valor = Calc.n(valorInput.value);
          if (!valor || valor <= 0) { UI.toast('Poné una cantidad mayor a 0.', 'warn'); return; }
          await Repo.crearRecordatorio({ evento_tipo: eventoTipo, evento_id: eventoId, tipo_disparo: tipo, valor, mensaje });
        }
        overlay.querySelector('#rec-mensaje').value = '';
        UI.toast('Recordatorio agregado.', 'ok');
        cargarLista();
      } catch (err) {
        UI.toast('Error al agregar: ' + (err.message || err), 'error');
      }
    };
  },
};

window.RecordatoriosUI = RecordatoriosUI;
window.labelRecordatorio = labelRecordatorio;
window.fmtFechaHoraRecordatorio = fmtFechaHoraRecordatorio;
