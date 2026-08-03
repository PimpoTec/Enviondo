// ============================================================================
// VISTA: ORGANIZACIONES — capa B2B opcional (Fase 0). Un piloto que nunca
// entra acá no nota que esto existe: no toca el dashboard/bitácora/perfil
// de piloto individual. Se llega desde el ítem "Organizaciones" del menú
// de Perfil (ver js/views/perfil.js).
//
// Qué muestra:
//  - Invitaciones pendientes propias (aceptar/rechazar).
//  - Organizaciones a las que pertenezco (crear una nueva desde acá).
//  - Si soy owner/admin de una: listado de miembros + invitar por email.
// ============================================================================

const ViewOrganizaciones = {
  async render() {
    const main = document.getElementById('main-content');
    const membresias = await Repo.listarMisOrganizaciones();
    const pendientes = membresias.filter((m) => m.estado === 'invitado');
    const activas = membresias.filter((m) => m.estado === 'activo');

    main.innerHTML = `
      ${pendientes.length ? `
        <div class="card">
          <h2>${Icons.tag('bell', 'Invitaciones pendientes')}</h2>
          <div id="lista-pendientes"></div>
        </div>
      ` : ''}

      <div class="card">
        <h2>${Icons.tag('users', 'Mis organizaciones')}</h2>
        <div id="lista-organizaciones"></div>
        <button class="btn" id="btn-nueva-org" style="margin-top:12px">Crear organización</button>
      </div>

      <div id="detalle-organizacion"></div>
    `;

    if (pendientes.length) renderPendientes(pendientes);
    renderOrganizaciones(activas);

    document.getElementById('btn-nueva-org').onclick = () => abrirFormNuevaOrg();
  },
};

function renderPendientes(pendientes) {
  const cont = document.getElementById('lista-pendientes');
  cont.innerHTML = pendientes.map((m) => `
    <div class="progreso-item">
      <div class="pi-head">
        <span class="nombre">${m.organizaciones.nombre} <span class="muted">— ${LABELS_TIPO_ORGANIZACION[m.organizaciones.tipo]}, te invitaron como ${LABELS_ROL_ORGANIZACION[m.rol]}</span></span>
      </div>
      <div style="display:flex; gap:8px; margin-top:8px">
        <button class="btn" data-aceptar="${m.org_id}">Aceptar</button>
        <button class="btn btn-secundario" data-rechazar="${m.org_id}">Rechazar</button>
      </div>
    </div>
  `).join('');
  cont.querySelectorAll('[data-aceptar]').forEach((b) => {
    b.onclick = async () => {
      try { await Repo.aceptarInvitacion(b.dataset.aceptar); UI.toast('Invitación aceptada.', 'ok'); ViewOrganizaciones.render(); }
      catch (err) { UI.toast('Error al aceptar: ' + (err.message || err), 'error'); }
    };
  });
  cont.querySelectorAll('[data-rechazar]').forEach((b) => {
    b.onclick = async () => {
      if (!(await UI.confirmar('¿Rechazar esta invitación?'))) return;
      try { await Repo.rechazarInvitacion(b.dataset.rechazar); UI.toast('Invitación rechazada.', 'ok'); ViewOrganizaciones.render(); }
      catch (err) { UI.toast('Error al rechazar: ' + (err.message || err), 'error'); }
    };
  });
}

function renderOrganizaciones(activas) {
  const cont = document.getElementById('lista-organizaciones');
  if (!activas.length) { cont.innerHTML = '<p class="muted">Todavía no pertenecés a ninguna organización.</p>'; return; }
  cont.innerHTML = activas.map((m) => `
    <div class="progreso-item" data-org="${m.org_id}" style="cursor:pointer">
      <div class="pi-head">
        <span class="nombre">${m.organizaciones.nombre}</span>
        <span class="faltan">${LABELS_ROL_ORGANIZACION[m.rol]}</span>
      </div>
      <p class="muted" style="margin:4px 0 0">${LABELS_TIPO_ORGANIZACION[m.organizaciones.tipo]}</p>
    </div>
  `).join('');
  cont.querySelectorAll('[data-org]').forEach((el) => {
    el.onclick = () => renderDetalleOrganizacion(activas.find((m) => m.org_id === el.dataset.org));
  });
}

async function renderDetalleOrganizacion(membresia) {
  const cont = document.getElementById('detalle-organizacion');
  const esGestor = esOwnerOAdmin(membresia.rol);
  const [miembros, flota] = await Promise.all([
    esGestor ? Repo.listarMiembros(membresia.org_id) : Promise.resolve([]),
    Repo.listarFlotaOrg(membresia.org_id),
  ]);

  cont.innerHTML = `
    <div class="card">
      <h2>${membresia.organizaciones.nombre}</h2>
      ${esGestor ? `
        <div id="lista-miembros"></div>
        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
          <input type="email" id="invitar-email" placeholder="Email del piloto ya registrado" style="flex:1; min-width:200px">
          <select id="invitar-rol">
            <option value="piloto_vinculado">Piloto vinculado</option>
            <option value="instructor">Instructor/a</option>
            <option value="admin">Administrador/a</option>
          </select>
          <button class="btn" id="btn-invitar">Invitar</button>
        </div>
      ` : `<p class="muted">Sos ${LABELS_ROL_ORGANIZACION[membresia.rol]} de esta organización.</p>`}
      ${membresia.rol !== 'owner' ? `<button class="btn btn-secundario" id="btn-salir" style="margin-top:12px">Salir de la organización</button>` : ''}
    </div>

    <div class="card">
      <h2>${Icons.tag('plane', 'Flota')}</h2>
      <div id="lista-flota-org"></div>
      ${esGestor ? `<button class="btn" id="btn-nueva-aeronave-org" style="margin-top:12px">Agregar aeronave</button>` : ''}
      <div id="form-aeronave-org"></div>
    </div>
  `;

  if (esGestor) {
    renderMiembros(miembros, membresia.org_id);
    document.getElementById('btn-invitar').onclick = async () => {
      const email = document.getElementById('invitar-email').value.trim();
      const rol = document.getElementById('invitar-rol').value;
      if (!email) { UI.toast('Escribí un email.', 'warn'); return; }
      try {
        await Repo.invitarMiembro(membresia.org_id, email, rol);
        UI.toast('Invitación enviada.', 'ok');
        renderDetalleOrganizacion(membresia);
      } catch (err) {
        UI.toast('Error al invitar: ' + (err.message || err), 'error');
      }
    };
  }

  const btnSalir = document.getElementById('btn-salir');
  if (btnSalir) {
    btnSalir.onclick = async () => {
      if (!(await UI.confirmar('¿Salir de esta organización?', { peligro: true }))) return;
      try { await Repo.salirDeOrganizacion(membresia.org_id); UI.toast('Saliste de la organización.', 'ok'); ViewOrganizaciones.render(); }
      catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
    };
  }

  renderFlotaOrg(flota, membresia, esGestor);
  const btnNuevaAeronave = document.getElementById('btn-nueva-aeronave-org');
  if (btnNuevaAeronave) btnNuevaAeronave.onclick = () => abrirFormAeronaveOrg(membresia);
}

function renderFlotaOrg(flota, membresia, esGestor) {
  const cont = document.getElementById('lista-flota-org');
  if (!flota.length) { cont.innerHTML = '<p class="muted">Todavía no hay aeronaves cargadas en esta organización.</p>'; return; }
  cont.innerHTML = flota.map((a) => `
    <div class="progreso-item">
      <div class="pi-head">
        <span class="nombre">${a.matricula} <span class="muted">— ${a.marca_modelo}</span></span>
        <span class="faltan">${a.moneda} ${a.tarifa_hora_diurna}/hs día · ${a.tarifa_hora_nocturna}/hs noche</span>
      </div>
      ${a.horas_celula != null || a.horas_motor != null || a.proxima_inspeccion_anual ? `
        <p class="muted" style="margin:4px 0 0">
          ${a.horas_celula != null ? `Célula: ${a.horas_celula} hs. ` : ''}${a.horas_motor != null ? `Motor: ${a.horas_motor} hs. ` : ''}${a.proxima_inspeccion_anual ? `Próxima inspección anual: ${a.proxima_inspeccion_anual}` : ''}
        </p>
      ` : ''}
      ${esGestor ? `
        <div style="display:flex; gap:8px; margin-top:8px">
          <button class="btn btn-secundario" data-editar-aeronave="${a.id}">Editar</button>
          <button class="btn btn-secundario" data-borrar-aeronave="${a.id}">Borrar</button>
        </div>
      ` : ''}
    </div>
  `).join('');

  if (!esGestor) return;
  cont.querySelectorAll('[data-editar-aeronave]').forEach((b) => {
    b.onclick = () => abrirFormAeronaveOrg(membresia, flota.find((a) => a.id === b.dataset.editarAeronave));
  });
  cont.querySelectorAll('[data-borrar-aeronave]').forEach((b) => {
    b.onclick = async () => {
      if (!(await UI.confirmar('¿Borrar esta aeronave de la flota? Si tiene vuelos cargados, no se va a poder borrar.', { ok: 'Borrar', peligro: true }))) return;
      try { await Repo.borrarAeronaveOrg(b.dataset.borrarAeronave); UI.toast('Aeronave borrada.', 'ok'); renderDetalleOrganizacion(membresia); }
      catch (err) { UI.toast('No se pudo borrar: ' + (err.message || err), 'error'); }
    };
  });
}

function abrirFormAeronaveOrg(membresia, aeronave) {
  const cont = document.getElementById('form-aeronave-org');
  cont.innerHTML = `
    <div class="card" style="margin-top:12px">
      <h2>${aeronave ? 'Editar aeronave' : 'Nueva aeronave'}</h2>
      <div class="form-grupo"><label for="fo-matricula">Matrícula</label><input type="text" id="fo-matricula" value="${aeronave?.matricula || ''}"></div>
      <div class="form-grupo"><label for="fo-marca">Marca/Modelo</label><input type="text" id="fo-marca" value="${aeronave?.marca_modelo || ''}"></div>
      <div class="grid cols-3">
        <div class="form-grupo"><label for="fo-tarifa-dia">Tarifa/hora día</label><input type="number" id="fo-tarifa-dia" value="${aeronave?.tarifa_hora_diurna ?? 0}"></div>
        <div class="form-grupo"><label for="fo-tarifa-noche">Tarifa/hora noche</label><input type="number" id="fo-tarifa-noche" value="${aeronave?.tarifa_hora_nocturna ?? 0}"></div>
        <div class="form-grupo"><label for="fo-moneda">Moneda</label><input type="text" id="fo-moneda" value="${aeronave?.moneda || 'ARS'}"></div>
      </div>
      <div class="grid cols-3">
        <div class="form-grupo"><label for="fo-horas-celula">Horas de célula</label><input type="number" id="fo-horas-celula" value="${aeronave?.horas_celula ?? ''}"></div>
        <div class="form-grupo"><label for="fo-horas-motor">Horas de motor</label><input type="number" id="fo-horas-motor" value="${aeronave?.horas_motor ?? ''}"></div>
        <div class="form-grupo"><label for="fo-inspeccion">Próxima inspección anual</label><input type="date" id="fo-inspeccion" value="${aeronave?.proxima_inspeccion_anual || ''}"></div>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px">
        <button class="btn" id="btn-guardar-aeronave-org">Guardar</button>
        <button class="btn btn-secundario" id="btn-cancelar-aeronave-org">Cancelar</button>
      </div>
    </div>
  `;
  document.getElementById('btn-cancelar-aeronave-org').onclick = () => { cont.innerHTML = ''; };
  document.getElementById('btn-guardar-aeronave-org').onclick = async () => {
    const matricula = document.getElementById('fo-matricula').value.trim().toUpperCase();
    const marca_modelo = document.getElementById('fo-marca').value.trim();
    if (!matricula || !marca_modelo) { UI.toast('Matrícula y modelo son obligatorios.', 'warn'); return; }
    const datos = {
      id: aeronave?.id,
      matricula, marca_modelo,
      tarifa_hora_diurna: Calc.n(document.getElementById('fo-tarifa-dia').value),
      tarifa_hora_nocturna: Calc.n(document.getElementById('fo-tarifa-noche').value),
      moneda: document.getElementById('fo-moneda').value.trim() || 'ARS',
      horas_celula: document.getElementById('fo-horas-celula').value ? Calc.n(document.getElementById('fo-horas-celula').value) : null,
      horas_motor: document.getElementById('fo-horas-motor').value ? Calc.n(document.getElementById('fo-horas-motor').value) : null,
      proxima_inspeccion_anual: document.getElementById('fo-inspeccion').value || null,
    };
    try {
      await Repo.guardarAeronaveOrg(membresia.org_id, datos);
      UI.toast('Aeronave guardada.', 'ok');
      renderDetalleOrganizacion(membresia);
    } catch (err) {
      UI.toast('Error al guardar: ' + (err.message || err), 'error');
    }
  };
}

function renderMiembros(miembros, orgId) {
  const cont = document.getElementById('lista-miembros');
  if (!miembros.length) { cont.innerHTML = '<p class="muted">Sin otros miembros todavía.</p>'; return; }
  cont.innerHTML = miembros.map((m) => `
    <div class="progreso-item">
      <div class="pi-head">
        <span class="nombre">${LABELS_ROL_ORGANIZACION[m.rol]}${m.estado === 'invitado' ? ' <span class="muted">(invitación pendiente)</span>' : ''}</span>
        ${m.rol !== 'owner' ? `<button class="btn btn-secundario" data-quitar="${m.user_id}">Quitar</button>` : ''}
      </div>
    </div>
  `).join('');
  cont.querySelectorAll('[data-quitar]').forEach((b) => {
    b.onclick = async () => {
      if (!(await UI.confirmar('¿Dar de baja a este miembro?', { peligro: true }))) return;
      try { await Repo.quitarMiembro(orgId, b.dataset.quitar); UI.toast('Miembro dado de baja.', 'ok'); ViewOrganizaciones.render(); }
      catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
    };
  });
}

function abrirFormNuevaOrg() {
  const cont = document.getElementById('detalle-organizacion');
  cont.innerHTML = `
    <div class="card">
      <h2>Crear organización</h2>
      <div class="form-grupo">
        <label for="nueva-org-nombre">Nombre</label>
        <input type="text" id="nueva-org-nombre" placeholder="Ej. Aeroclub San Justo">
      </div>
      <div class="form-grupo">
        <label for="nueva-org-tipo">Tipo</label>
        <select id="nueva-org-tipo">
          <option value="escuela">Escuela de vuelo</option>
          <option value="empresa">Empresa de vuelos privados</option>
        </select>
      </div>
      <button class="btn" id="btn-crear-org">Crear</button>
    </div>
  `;
  document.getElementById('btn-crear-org').onclick = async () => {
    const nombre = document.getElementById('nueva-org-nombre').value.trim();
    const tipo = document.getElementById('nueva-org-tipo').value;
    if (!nombre) { UI.toast('Escribí un nombre.', 'warn'); return; }
    try {
      await Repo.crearOrganizacion(nombre, tipo);
      UI.toast('Organización creada.', 'ok');
      ViewOrganizaciones.render();
    } catch (err) {
      UI.toast('Error al crear: ' + (err.message || err), 'error');
    }
  };
}

window.ViewOrganizaciones = ViewOrganizaciones;
