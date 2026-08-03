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
  const miembros = esGestor ? await Repo.listarMiembros(membresia.org_id) : [];

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
