// ============================================================================
// VISTA: ORGANIZACIONES — capa B2B opcional (Fase 0). Un piloto que nunca
// entra acá no nota que esto existe: no toca el dashboard/bitácora/perfil
// de piloto individual. Se llega desde el ítem "Organizaciones" del menú
// de Perfil (ver js/views/perfil.js).
//
// Qué muestra:
//  - Invitaciones pendientes propias (aceptar/rechazar).
//  - Organizaciones a las que pertenezco.
//  - Si soy owner/admin de una: listado de miembros + invitar por email.
//
// Crear una organización nueva NO se hace desde acá: solo la cuenta admin
// de la app puede darlas de alta (asignando el owner por email), desde
// Perfil → Preferencias → Admin → Organizaciones — ver
// sql/restringir_creacion_organizaciones.sql. Un piloto que no pertenece
// a ninguna organización todavía solo puede esperar a que lo inviten.
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
      </div>

      <div id="detalle-organizacion"></div>
    `;

    if (pendientes.length) renderPendientes(pendientes);
    renderOrganizaciones(activas);
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
  if (!activas.length) { cont.innerHTML = '<p class="muted">Todavía no pertenecés a ninguna organización. Si tenés que estar en una escuela o empresa, pedile al administrador de la app que la cree y te asigne.</p>'; return; }
  cont.innerHTML = activas.map((m) => `
    <div class="progreso-item" data-org="${m.org_id}" style="cursor:pointer">
      <div class="pi-head">
        <span class="nombre">${m.organizaciones.nombre}</span>
        <span class="faltan">${LABELS_ROL_ORGANIZACION[m.rol]}</span>
      </div>
      <p class="muted" style="margin:4px 0 0">${LABELS_TIPO_ORGANIZACION[m.organizaciones.tipo]}${m.organizaciones.estado !== 'activa' ? ` · ${LABELS_ESTADO_ORGANIZACION[m.organizaciones.estado]}` : ''}</p>
    </div>
  `).join('');
  cont.querySelectorAll('[data-org]').forEach((el) => {
    el.onclick = () => renderDetalleOrganizacion(activas.find((m) => m.org_id === el.dataset.org));
  });
}

async function renderDetalleOrganizacion(membresia) {
  const cont = document.getElementById('detalle-organizacion');
  const esGestor = esOwnerOAdmin(membresia.rol);
  const [miembros, flota, instructores, turnos, despacho] = await Promise.all([
    esGestor ? Repo.listarMiembros(membresia.org_id) : Promise.resolve([]),
    Repo.listarFlotaOrg(membresia.org_id),
    Repo.listarInstructores(membresia.org_id),
    Repo.listarTurnosOrg(membresia.org_id),
    Repo.listarVuelosAsignadosOrg(membresia.org_id),
  ]);

  const activa = membresia.organizaciones.estado === 'activa';

  cont.innerHTML = `
    ${!activa ? `
      <div class="card" style="border:1px solid var(--warn)">
        <h2>${Icons.tag('alertTriangle', 'Organización ' + (LABELS_ESTADO_ORGANIZACION[membresia.organizaciones.estado] || membresia.organizaciones.estado).toLowerCase())}</h2>
        <p class="muted">${membresia.organizaciones.estado === 'pendiente_aprobacion'
          ? 'Todavía la tiene que aprobar el admin de la app antes de poder cargar flota, instructores o turnos. Podés seguir invitando miembros mientras tanto.'
          : membresia.organizaciones.estado === 'suspendida'
            ? 'Está suspendida por el admin de la app — la flota, instructores y turnos quedan en pausa hasta que se reactive.'
            : 'El admin de la app rechazó esta organización.'}</p>
      </div>
    ` : ''}

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

    ${activa ? `
      <div class="card">
        <h2>${Icons.tag('plane', 'Flota')}</h2>
        <div id="lista-flota-org"></div>
        ${esGestor ? `<button class="btn" id="btn-nueva-aeronave-org" style="margin-top:12px">Agregar aeronave</button>` : ''}
        <div id="form-aeronave-org"></div>
      </div>
    ` : ''}

    ${activa && membresia.organizaciones.tipo === 'escuela' ? `
      <div class="card">
        <h2>${Icons.tag('idCard', 'Instructores')}</h2>
        <div id="lista-instructores"></div>
        ${esGestor ? `<div id="form-instructor-org" style="margin-top:12px"></div>` : ''}
      </div>
    ` : ''}

    ${activa && membresia.organizaciones.tipo === 'escuela' ? `
      <div class="card">
        <h2>${Icons.tag('calendar', 'Turnos')}</h2>
        ${flota.length ? `
          <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap">
            <select id="turno-aeronave">
              ${flota.map((a) => `<option value="${a.id}">${a.matricula} — ${a.marca_modelo}</option>`).join('')}
            </select>
            ${instructores.filter((i) => i.activo).length ? `
              <select id="turno-instructor">
                <option value="">Sin instructor</option>
                ${instructores.filter((i) => i.activo).map((i) => `<option value="${i.id}">${i.nro_licencia || ('Instructor ...' + i.user_id.slice(-6))}</option>`).join('')}
              </select>
            ` : ''}
            <input type="datetime-local" id="turno-inicio">
            <input type="datetime-local" id="turno-fin">
            <button class="btn" id="btn-reservar-turno">Reservar</button>
          </div>
          <p class="muted" style="margin-top:4px">${membresia.rol === 'piloto_vinculado' ? 'Como piloto vinculado, tu turno se confirma directo.' : 'Tu turno queda pendiente de autorización de un owner/admin.'}</p>
        ` : `<p class="muted">Todavía no hay aeronaves en la flota para reservar un turno.</p>`}
        <div id="lista-turnos" style="margin-top:12px"></div>
      </div>
    ` : ''}

    ${activa && membresia.organizaciones.tipo === 'empresa' ? `
      <div class="card">
        <h2>${Icons.tag('calendar', 'Despacho')}</h2>
        ${esGestor && flota.length && miembros.filter((m) => m.estado === 'activo').length ? `
          <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap">
            <select id="despacho-aeronave">
              ${flota.map((a) => `<option value="${a.id}">${a.matricula} — ${a.marca_modelo}</option>`).join('')}
            </select>
            <select id="despacho-piloto">
              ${miembros.filter((m) => m.estado === 'activo').map((m) => `<option value="${m.user_id}">${LABELS_ROL_ORGANIZACION[m.rol]} ...${m.user_id.slice(-6)}</option>`).join('')}
            </select>
            <input type="text" id="despacho-tramo" placeholder="Tramo (ej. SABE-SAZR)">
            <input type="datetime-local" id="despacho-inicio">
            <input type="datetime-local" id="despacho-fin">
            <button class="btn" id="btn-asignar-vuelo">Asignar</button>
          </div>
        ` : esGestor ? `<p class="muted">Para asignar un vuelo hace falta al menos una aeronave en la flota y un miembro activo.</p>` : ''}
        <div id="lista-despacho" style="margin-top:12px"></div>
      </div>
    ` : ''}
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

  if (!activa) return;

  renderFlotaOrg(flota, membresia, esGestor);
  const btnNuevaAeronave = document.getElementById('btn-nueva-aeronave-org');
  if (btnNuevaAeronave) btnNuevaAeronave.onclick = () => abrirFormAeronaveOrg(membresia);

  if (membresia.organizaciones.tipo === 'escuela') {
    await renderInstructores(instructores, miembros, membresia, esGestor);

    await renderTurnos(turnos, flota, membresia, esGestor);
    const btnReservar = document.getElementById('btn-reservar-turno');
    if (btnReservar) {
      btnReservar.onclick = async () => {
        const aeronaveId = document.getElementById('turno-aeronave').value;
        const instructorSel = document.getElementById('turno-instructor');
        const inicio = document.getElementById('turno-inicio').value;
        const fin = document.getElementById('turno-fin').value;
        if (!inicio || !fin) { UI.toast('Elegí inicio y fin del turno.', 'warn'); return; }
        try {
          await Repo.crearTurno(membresia.org_id, aeronaveId, new Date(inicio).toISOString(), new Date(fin).toISOString(), instructorSel ? instructorSel.value : null);
          UI.toast('Turno registrado.', 'ok');
          renderDetalleOrganizacion(membresia);
        } catch (err) {
          UI.toast('Error al reservar: ' + (err.message || err), 'error');
        }
      };
    }
  }

  if (membresia.organizaciones.tipo === 'empresa') {
    await renderDespacho(despacho, flota, miembros, membresia, esGestor);
    const btnAsignar = document.getElementById('btn-asignar-vuelo');
    if (btnAsignar) {
      btnAsignar.onclick = async () => {
        const aeronaveId = document.getElementById('despacho-aeronave').value;
        const pilotoId = document.getElementById('despacho-piloto').value;
        const tramo = document.getElementById('despacho-tramo').value.trim();
        const inicio = document.getElementById('despacho-inicio').value;
        const fin = document.getElementById('despacho-fin').value;
        if (!pilotoId) { UI.toast('No hay ningún piloto vinculado para asignar todavía.', 'warn'); return; }
        if (!tramo || !inicio || !fin) { UI.toast('Completá tramo, inicio y fin.', 'warn'); return; }
        try {
          await Repo.asignarVuelo(membresia.org_id, aeronaveId, pilotoId, tramo, new Date(inicio).toISOString(), new Date(fin).toISOString());
          UI.toast('Vuelo asignado.', 'ok');
          renderDetalleOrganizacion(membresia);
        } catch (err) {
          UI.toast('Error al asignar: ' + (err.message || err), 'error');
        }
      };
    }
  }
}

// Wrapper de refresco: organizaciones.js normalmente refresca volviendo a
// pintar toda la pantalla de detalle (renderDetalleOrganizacion). Cuando
// estas mismas funciones se reusan desde js/views/escuela.js (pantalla
// dedicada, sin ese contenedor), la membresía que se pasa trae un
// `.rerender()` propio a usar en su lugar.
function refrescarOrg(membresia) {
  return membresia.rerender ? membresia.rerender() : renderDetalleOrganizacion(membresia);
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
      try { await Repo.borrarAeronaveOrg(b.dataset.borrarAeronave); UI.toast('Aeronave borrada.', 'ok'); refrescarOrg(membresia); }
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
      refrescarOrg(membresia);
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

async function renderInstructores(instructores, miembros, membresia, esGestor) {
  const cont = document.getElementById('lista-instructores');

  // El estado de vencimientos de cada instructor solo lo puede leer
  // owner/admin (ver política "vencimientos_select_org_instructor" en
  // sql/agregar_instructores.sql) — para un piloto vinculado esta consulta
  // volvería vacía igual, así que ni se hace.
  const vencimientosPorInstructor = esGestor
    ? Object.fromEntries(await Promise.all(instructores.map(async (i) => [i.id, await Repo.listarVencimientosDeUsuario(i.user_id)])))
    : {};

  if (!instructores.length) {
    cont.innerHTML = '<p class="muted">Todavía no hay instructores dados de alta.</p>';
  } else {
    cont.innerHTML = instructores.map((i) => {
      const vencimientos = vencimientosPorInstructor[i.id] || [];
      const peor = vencimientos.map(estadoVencimiento).sort((a, b) => a.dias - b.dias)[0];
      return `
        <div class="progreso-item">
          <div class="pi-head">
            <span class="nombre">${i.nro_licencia || 'Sin nro. de licencia'} ${!i.activo ? '<span class="muted">(inactivo)</span>' : ''}</span>
            ${peor ? `<span class="badge ${peor.estado}">${peor.texto}</span>` : ''}
          </div>
          ${esGestor ? `
            <div style="display:flex; gap:8px; margin-top:8px">
              <button class="btn btn-secundario" data-toggle-instructor="${i.id}" data-activo="${i.activo}">${i.activo ? 'Marcar inactivo' : 'Marcar activo'}</button>
              <button class="btn btn-secundario" data-quitar-instructor="${i.id}">Quitar</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  if (!esGestor) return;

  cont.querySelectorAll('[data-toggle-instructor]').forEach((b) => {
    b.onclick = async () => {
      try {
        await Repo.actualizarInstructor(b.dataset.toggleInstructor, { activo: b.dataset.activo !== 'true' });
        renderDetalleOrganizacion(membresia);
      } catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
    };
  });
  cont.querySelectorAll('[data-quitar-instructor]').forEach((b) => {
    b.onclick = async () => {
      if (!(await UI.confirmar('¿Quitar a este instructor?', { peligro: true }))) return;
      try { await Repo.quitarInstructor(b.dataset.quitarInstructor); UI.toast('Instructor quitado.', 'ok'); renderDetalleOrganizacion(membresia); }
      catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
    };
  });

  const formCont = document.getElementById('form-instructor-org');
  const yaInstructores = new Set(instructores.map((i) => i.user_id));
  const candidatos = miembros.filter((m) => m.rol === 'instructor' && m.estado === 'activo' && !yaInstructores.has(m.user_id));
  if (!candidatos.length) {
    formCont.innerHTML = '<p class="muted">Para dar de alta un instructor, primero invitalo como miembro con rol "Instructor/a" más arriba.</p>';
    return;
  }
  formCont.innerHTML = `
    <div style="display:flex; gap:8px; flex-wrap:wrap">
      <select id="instructor-user-id">
        ${candidatos.map((m) => `<option value="${m.user_id}">Miembro ...${m.user_id.slice(-6)} (invitado el ${new Date(m.created_at).toLocaleDateString()})</option>`).join('')}
      </select>
      <input type="text" id="instructor-nro-licencia" placeholder="Nro. de licencia (opcional)">
      <button class="btn" id="btn-agregar-instructor">Dar de alta</button>
    </div>
  `;
  document.getElementById('btn-agregar-instructor').onclick = async () => {
    const userId = document.getElementById('instructor-user-id').value;
    const nroLicencia = document.getElementById('instructor-nro-licencia').value.trim();
    try {
      await Repo.agregarInstructor(membresia.org_id, userId, nroLicencia);
      UI.toast('Instructor dado de alta.', 'ok');
      renderDetalleOrganizacion(membresia);
    } catch (err) {
      UI.toast('Error: ' + (err.message || err), 'error');
    }
  };
}

async function renderTurnos(turnos, flota, membresia, esGestor) {
  const cont = document.getElementById('lista-turnos');
  const user = await usuarioActual();
  const aeronavePorId = Object.fromEntries(flota.map((a) => [a.id, a]));

  // Los cancelados no aportan nada a la vista del día a día, y los turnos
  // ya pasados tampoco — la agenda es "de ahora en adelante".
  const ahora = new Date();
  const vigentes = turnos.filter((t) => t.estado !== 'cancelado' && new Date(t.fin) >= ahora);
  if (!vigentes.length) { cont.innerHTML = '<p class="muted">Sin turnos próximos.</p>'; return; }

  cont.innerHTML = vigentes.map((t) => {
    const esPropio = t.piloto_user_id === user?.id;
    const aeronave = aeronavePorId[t.aeronave_id];
    return `
      <div class="progreso-item">
        <div class="pi-head">
          <span class="nombre">${aeronave ? aeronave.matricula : 'Aeronave'} <span class="muted">${new Date(t.inicio).toLocaleString()} → ${new Date(t.fin).toLocaleString()}</span></span>
          <span class="badge ${t.estado === 'confirmado' ? 'ok' : t.estado === 'cancelado' ? 'danger' : 'warn'}">${LABELS_ESTADO_TURNO[t.estado]}</span>
        </div>
        <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap">
          ${esGestor && t.estado === 'pendiente_autorizacion' ? `
            <button class="btn" data-confirmar-turno="${t.id}">Confirmar</button>
            <button class="btn btn-secundario" data-rechazar-turno="${t.id}">Rechazar</button>
          ` : ''}
          ${(esPropio || esGestor) && t.estado !== 'cancelado' ? `<button class="btn btn-secundario" data-cancelar-turno="${t.id}">Cancelar</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  cont.querySelectorAll('[data-confirmar-turno]').forEach((b) => {
    b.onclick = async () => {
      try { await Repo.confirmarTurno(b.dataset.confirmarTurno); UI.toast('Turno confirmado.', 'ok'); renderDetalleOrganizacion(membresia); }
      catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
    };
  });
  cont.querySelectorAll('[data-rechazar-turno]').forEach((b) => {
    b.onclick = async () => {
      if (!(await UI.confirmar('¿Rechazar este turno?'))) return;
      try { await Repo.rechazarTurno(b.dataset.rechazarTurno); UI.toast('Turno rechazado.', 'ok'); renderDetalleOrganizacion(membresia); }
      catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
    };
  });
  cont.querySelectorAll('[data-cancelar-turno]').forEach((b) => {
    b.onclick = async () => {
      if (!(await UI.confirmar('¿Cancelar este turno?', { peligro: true }))) return;
      try { await Repo.cancelarTurno(b.dataset.cancelarTurno); UI.toast('Turno cancelado.', 'ok'); renderDetalleOrganizacion(membresia); }
      catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
    };
  });
}

async function renderDespacho(despacho, flota, miembros, membresia, esGestor) {
  const cont = document.getElementById('lista-despacho');
  const aeronavePorId = Object.fromEntries(flota.map((a) => [a.id, a]));
  const rolPorPiloto = Object.fromEntries(miembros.map((m) => [m.user_id, m.rol]));

  const ahora = new Date();
  const vigentes = despacho.filter((v) => v.estado !== 'cancelado' && new Date(v.fin) >= ahora);
  if (!vigentes.length) { cont.innerHTML = '<p class="muted">Sin vuelos asignados próximos.</p>'; return; }

  cont.innerHTML = vigentes.map((v) => {
    const aeronave = aeronavePorId[v.aeronave_id];
    const rolPiloto = rolPorPiloto[v.piloto_user_id];
    return `
      <div class="progreso-item">
        <div class="pi-head">
          <span class="nombre">${v.tramo} <span class="muted">— ${aeronave ? aeronave.matricula : 'Aeronave'} · ${rolPiloto ? LABELS_ROL_ORGANIZACION[rolPiloto] : 'Piloto'} ...${v.piloto_user_id.slice(-6)}</span></span>
          <span class="badge ${v.estado === 'completado' ? 'ok' : v.estado === 'cancelado' ? 'danger' : 'warn'}">${LABELS_ESTADO_VUELO_ASIGNADO[v.estado]}</span>
        </div>
        <p class="muted" style="margin:4px 0 0">${new Date(v.inicio).toLocaleString()} → ${new Date(v.fin).toLocaleString()}</p>
        ${esGestor ? `
          <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap">
            ${v.estado === 'programado' ? `<button class="btn btn-secundario" data-estado-vuelo="${v.id}" data-nuevo-estado="en_curso">Marcar en curso</button>` : ''}
            ${v.estado === 'en_curso' ? `<button class="btn btn-secundario" data-estado-vuelo="${v.id}" data-nuevo-estado="completado">Marcar completado</button>` : ''}
            ${v.estado !== 'cancelado' ? `<button class="btn btn-secundario" data-estado-vuelo="${v.id}" data-nuevo-estado="cancelado">Cancelar</button>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  if (!esGestor) return;
  cont.querySelectorAll('[data-estado-vuelo]').forEach((b) => {
    b.onclick = async () => {
      if (b.dataset.nuevoEstado === 'cancelado' && !(await UI.confirmar('¿Cancelar este vuelo asignado?', { peligro: true }))) return;
      try {
        await Repo.actualizarEstadoVueloAsignado(b.dataset.estadoVuelo, b.dataset.nuevoEstado);
        UI.toast('Vuelo actualizado.', 'ok');
        refrescarOrg(membresia);
      } catch (err) {
        UI.toast('Error: ' + (err.message || err), 'error');
      }
    };
  });
}

window.ViewOrganizaciones = ViewOrganizaciones;
