// ============================================================================
// VISTA: ESCUELA — pantalla "modo organización". A diferencia de
// js/views/organizaciones.js (que muestra TODAS las organizaciones propias
// en una sola pantalla larga, pensada para gestionarlas desde Perfil), acá
// un piloto "entra" a UNA organización puntual (llega desde la pestaña
// "Escuela" del menú de abajo, ver js/router.js) y navega sus propias
// sub-pantallas: Dashboard, Turnos (o Despacho si es empresa) y Flota.
//
// La Flota reusa las mismas funciones de renderizado que organizaciones.js
// (renderFlotaOrg/abrirFormAeronaveOrg son funciones globales de ese
// archivo — no hace falta duplicarlas, este archivo se carga después en
// index.html). El Dashboard y la grilla de Turnos son nuevos: la grilla es
// el pedido central de esta pantalla — un calendario de bloques según la
// disponibilidad que configuró el owner/admin (sql/agregar_disponibilidad_turnos.sql).
// ============================================================================

const ViewEscuela = {
  async render(params) {
    const main = document.getElementById('main-content');
    const orgId = params.get('org');
    const vista = params.get('vista') || 'dashboard';

    if (!orgId) {
      main.innerHTML = '<div class="card"><p class="muted">Elegí una escuela desde la pestaña de abajo.</p></div>';
      return;
    }

    const membresias = await Repo.listarMisOrganizaciones();
    const membresia = membresias.find((m) => m.org_id === orgId && m.estado === 'activo');
    if (!membresia) {
      main.innerHTML = '<div class="card"><p class="muted">No pertenecés (o ya no pertenecés) a esta organización.</p></div>';
      return;
    }

    const org = membresia.organizaciones;
    if (org.estado !== 'activa') {
      main.innerHTML = `
        <div class="card" style="border:1px solid var(--warn)">
          <h2>${Icons.tag('alertTriangle', org.nombre)}</h2>
          <p class="muted">${org.estado === 'pendiente_aprobacion'
            ? 'Todavía la tiene que aprobar el admin de la app antes de poder operar.'
            : org.estado === 'suspendida'
              ? 'Está suspendida por el admin de la app.'
              : 'El admin de la app rechazó esta organización.'}</p>
        </div>
      `;
      return;
    }

    const esGestor = esOwnerOAdmin(membresia.rol);
    if (vista === 'flota') return renderVistaFlota(main, membresia, esGestor);
    if (vista === 'despacho') return renderVistaDespacho(main, membresia, esGestor);
    if (vista === 'turnos') return renderVistaTurnos(main, membresia, esGestor);
    return renderVistaDashboard(main, membresia, esGestor);
  },
};

// ----------------------------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------------------------
async function renderVistaDashboard(main, membresia, esGestor) {
  const org = membresia.organizaciones;
  const esEmpresa = org.tipo === 'empresa';
  const [flota, agenda] = await Promise.all([
    Repo.listarFlotaOrg(membresia.org_id),
    esEmpresa ? Repo.listarVuelosAsignadosOrg(membresia.org_id) : Repo.listarTurnosOrg(membresia.org_id),
  ]);

  const ahora = new Date();
  const proximos = agenda
    .filter((t) => t.estado !== 'cancelado' && new Date(t.fin) >= ahora)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
    .slice(0, 5);
  const pendientes = esEmpresa ? [] : agenda.filter((t) => t.estado === 'pendiente_autorizacion');
  const aeronavePorId = Object.fromEntries(flota.map((a) => [a.id, a]));

  main.innerHTML = `
    <div class="card">
      <h2>${org.nombre}</h2>
      <p class="muted">Sos ${LABELS_ROL_ORGANIZACION[membresia.rol]} — ${LABELS_TIPO_ORGANIZACION[org.tipo]}</p>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h2>${Icons.tag('plane', 'Aviones operativos')}</h2>
        <p style="font-size:28px; font-weight:700; margin:4px 0">${flota.length}</p>
        <p class="muted">Aeronaves cargadas en la flota</p>
      </div>
      ${esGestor && !esEmpresa ? `
        <div class="card">
          <h2>${Icons.tag('bell', 'Pendientes de autorización')}</h2>
          <p style="font-size:28px; font-weight:700; margin:4px 0">${pendientes.length}</p>
          <p class="muted">${pendientes.length ? 'Turnos esperando tu confirmación' : 'Sin turnos pendientes'}</p>
        </div>
      ` : ''}
    </div>

    <div class="card">
      <h2>${Icons.tag('calendar', esEmpresa ? 'Próximos vuelos asignados' : 'Próximos turnos reservados')}</h2>
      <div id="dash-proximos"></div>
    </div>
  `;

  const cont = document.getElementById('dash-proximos');
  if (!proximos.length) {
    cont.innerHTML = `<p class="muted">${esEmpresa ? 'Sin vuelos asignados próximos.' : 'Sin turnos próximos.'}</p>`;
  } else {
    cont.innerHTML = proximos.map((t) => {
      const aeronave = aeronavePorId[t.aeronave_id];
      const titulo = esEmpresa ? (t.tramo || 'Vuelo') : (aeronave ? aeronave.matricula : 'Aeronave');
      const estadoLabel = esEmpresa ? LABELS_ESTADO_VUELO_ASIGNADO[t.estado] : LABELS_ESTADO_TURNO[t.estado];
      return `
        <div class="progreso-item">
          <div class="pi-head">
            <span class="nombre">${titulo} <span class="muted">${new Date(t.inicio).toLocaleString()} → ${new Date(t.fin).toLocaleString()}</span></span>
            <span class="badge ${t.estado === 'confirmado' || t.estado === 'completado' ? 'ok' : 'warn'}">${estadoLabel}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ----------------------------------------------------------------------------
// FLOTA — reusa renderFlotaOrg / abrirFormAeronaveOrg de organizaciones.js
// ----------------------------------------------------------------------------
async function renderVistaFlota(main, membresia, esGestor) {
  const flota = await Repo.listarFlotaOrg(membresia.org_id);
  main.innerHTML = `
    <div class="card">
      <h2>${Icons.tag('plane', 'Flota')}</h2>
      <div id="lista-flota-org"></div>
      ${esGestor ? `<button class="btn" id="btn-nueva-aeronave-org" style="margin-top:12px">Agregar aeronave</button>` : ''}
      <div id="form-aeronave-org"></div>
    </div>
  `;
  renderFlotaOrg(flota, { org_id: membresia.org_id, rerender: () => renderVistaFlota(main, membresia, esGestor) }, esGestor);
  const btnNueva = document.getElementById('btn-nueva-aeronave-org');
  if (btnNueva) btnNueva.onclick = () => abrirFormAeronaveOrg({ org_id: membresia.org_id, rerender: () => renderVistaFlota(main, membresia, esGestor) });
}

// ----------------------------------------------------------------------------
// DESPACHO (empresas)
// ----------------------------------------------------------------------------
async function renderVistaDespacho(main, membresia, esGestor) {
  const [flota, miembros, despacho] = await Promise.all([
    Repo.listarFlotaOrg(membresia.org_id),
    esGestor ? Repo.listarMiembros(membresia.org_id) : Promise.resolve([]),
    Repo.listarVuelosAsignadosOrg(membresia.org_id),
  ]);
  const activos = miembros.filter((m) => m.estado === 'activo');

  main.innerHTML = `
    <div class="card">
      <h2>${Icons.tag('calendar', 'Despacho')}</h2>
      ${esGestor && flota.length && activos.length ? `
        <div style="display:flex; gap:8px; margin-top:4px; flex-wrap:wrap">
          <select id="despacho-aeronave">
            ${flota.map((a) => `<option value="${a.id}">${a.matricula} — ${a.marca_modelo}</option>`).join('')}
          </select>
          <select id="despacho-piloto">
            ${activos.map((m) => `<option value="${m.user_id}">${LABELS_ROL_ORGANIZACION[m.rol]} ...${m.user_id.slice(-6)}</option>`).join('')}
          </select>
          <input type="text" id="despacho-tramo" placeholder="Tramo (ej. SABE-SAZR)">
          <input type="datetime-local" id="despacho-inicio">
          <input type="datetime-local" id="despacho-fin">
          <button class="btn" id="btn-asignar-vuelo">Asignar</button>
        </div>
      ` : esGestor ? `<p class="muted">Para asignar un vuelo hace falta al menos una aeronave en la flota y un miembro activo.</p>` : ''}
      <div id="lista-despacho" style="margin-top:12px"></div>
    </div>
  `;

  await renderDespacho(despacho, flota, miembros, { org_id: membresia.org_id, organizaciones: membresia.organizaciones, rerender: () => renderVistaDespacho(main, membresia, esGestor) }, esGestor);

  const btnAsignar = document.getElementById('btn-asignar-vuelo');
  if (btnAsignar) {
    btnAsignar.onclick = async () => {
      const aeronaveId = document.getElementById('despacho-aeronave').value;
      const pilotoId = document.getElementById('despacho-piloto').value;
      const tramo = document.getElementById('despacho-tramo').value.trim();
      const inicio = document.getElementById('despacho-inicio').value;
      const fin = document.getElementById('despacho-fin').value;
      if (!tramo || !inicio || !fin) { UI.toast('Completá tramo, inicio y fin.', 'warn'); return; }
      try {
        await Repo.asignarVuelo(membresia.org_id, aeronaveId, pilotoId, tramo, new Date(inicio).toISOString(), new Date(fin).toISOString());
        UI.toast('Vuelo asignado.', 'ok');
        renderVistaDespacho(main, membresia, esGestor);
      } catch (err) {
        UI.toast('Error al asignar: ' + (err.message || err), 'error');
      }
    };
  }
}

// ----------------------------------------------------------------------------
// TURNOS — grilla estilo calendario, en bloques según la disponibilidad
// configurada por el owner/admin. Un piloto ve 7 días hacia adelante para
// la aeronave elegida; clickea un bloque libre para reservarlo, o uno
// ocupado para ver el detalle (y confirmar/rechazar/cancelar si corresponde).
// ----------------------------------------------------------------------------
async function renderVistaTurnos(main, membresia, esGestor) {
  const orgId = membresia.org_id;
  const [flota, instructores, turnos, disponibilidad] = await Promise.all([
    Repo.listarFlotaOrg(orgId),
    Repo.listarInstructores(orgId),
    Repo.listarTurnosOrg(orgId),
    Repo.obtenerDisponibilidadTurnos(orgId),
  ]);

  main.innerHTML = `
    <div class="card">
      <h2>${Icons.tag('calendar', 'Turnos')}</h2>
      ${esGestor ? `<button class="btn btn-secundario" id="btn-config-horario">${disponibilidad ? 'Editar horario' : 'Configurar horario'}</button>` : ''}
      <div id="config-horario"></div>
    </div>
    ${!disponibilidad ? `
      <div class="card"><p class="muted">Esta escuela todavía no configuró su horario de turnos.${esGestor ? ' Usá el botón de arriba para configurarlo.' : ' Avisale al owner/admin.'}</p></div>
    ` : !flota.length ? `
      <div class="card"><p class="muted">Todavía no hay aeronaves en la flota.</p></div>
    ` : `
      <div class="card">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px">
          <select id="turnos-aeronave">
            ${flota.map((a) => `<option value="${a.id}">${a.matricula} — ${a.marca_modelo}</option>`).join('')}
          </select>
          ${instructores.filter((i) => i.activo).length ? `
            <select id="turnos-instructor">
              <option value="">Sin instructor</option>
              ${instructores.filter((i) => i.activo).map((i) => `<option value="${i.id}">${i.nro_licencia || ('Instructor ...' + i.user_id.slice(-6))}</option>`).join('')}
            </select>
          ` : ''}
        </div>
        <div id="grilla-turnos" style="overflow-x:auto"></div>
      </div>
      <div id="detalle-bloque"></div>
    `}
  `;

  if (esGestor) {
    document.getElementById('btn-config-horario').onclick = () => abrirFormHorario(orgId, disponibilidad, () => renderVistaTurnos(main, membresia, esGestor));
  }
  if (!disponibilidad || !flota.length) return;

  const selAeronave = document.getElementById('turnos-aeronave');
  const pintarGrilla = () => renderGrillaTurnos(orgId, selAeronave.value, turnos, disponibilidad, membresia, esGestor);
  selAeronave.onchange = pintarGrilla;
  pintarGrilla();
}

function abrirFormHorario(orgId, disponibilidad, alGuardar) {
  const cont = document.getElementById('config-horario');
  const dias = disponibilidad?.dias_semana || [1, 2, 3, 4, 5];
  const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  cont.innerHTML = `
    <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--borde)">
      <div class="form-grupo">
        <label>Días habilitados</label>
        <div style="display:flex; gap:10px; flex-wrap:wrap">
          ${nombresDias.map((n, i) => `
            <label style="display:flex; align-items:center; gap:4px; font-weight:normal">
              <input type="checkbox" data-dia="${i}" ${dias.includes(i) ? 'checked' : ''}> ${n}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="grid cols-3">
        <div class="form-grupo"><label for="cfg-hora-inicio">Apertura</label><input type="time" id="cfg-hora-inicio" value="${disponibilidad?.hora_inicio?.slice(0, 5) || '08:00'}"></div>
        <div class="form-grupo"><label for="cfg-hora-fin">Cierre</label><input type="time" id="cfg-hora-fin" value="${disponibilidad?.hora_fin?.slice(0, 5) || '20:00'}"></div>
        <div class="form-grupo"><label for="cfg-duracion">Duración del bloque (min)</label><input type="number" id="cfg-duracion" value="${disponibilidad?.duracion_bloque_minutos || 60}" min="1"></div>
      </div>
      <button class="btn" id="btn-guardar-horario">Guardar</button>
    </div>
  `;
  document.getElementById('btn-guardar-horario').onclick = async () => {
    const diasSel = Array.from(cont.querySelectorAll('[data-dia]:checked')).map((el) => Number(el.dataset.dia));
    if (!diasSel.length) { UI.toast('Elegí al menos un día.', 'warn'); return; }
    const horaInicio = document.getElementById('cfg-hora-inicio').value;
    const horaFin = document.getElementById('cfg-hora-fin').value;
    const duracion = Number(document.getElementById('cfg-duracion').value);
    try {
      await Repo.guardarDisponibilidadTurnos(orgId, diasSel, horaInicio, horaFin, duracion);
      UI.toast('Horario guardado.', 'ok');
      alGuardar();
    } catch (err) {
      UI.toast('Error al guardar: ' + (err.message || err), 'error');
    }
  };
}

function renderGrillaTurnos(orgId, aeronaveId, turnos, disponibilidad, membresia, esGestor) {
  const grilla = document.getElementById('grilla-turnos');
  const detalle = document.getElementById('detalle-bloque');
  detalle.innerHTML = '';

  const [hIni, mIni] = disponibilidad.hora_inicio.split(':').map(Number);
  const [hFin, mFin] = disponibilidad.hora_fin.split(':').map(Number);
  const duracion = disponibilidad.duracion_bloque_minutos;
  const minutosDia = hFin * 60 + mFin - (hIni * 60 + mIni);
  const cantBloques = Math.floor(minutosDia / duracion);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + i);
    return d;
  });

  const turnosAeronave = turnos.filter((t) => t.aeronave_id === aeronaveId && t.estado !== 'cancelado');

  const filas = Array.from({ length: cantBloques }, (_, i) => (hIni * 60 + mIni) + i * duracion);

  let html = '<table class="tabla-turnos" style="border-collapse:collapse; width:100%; min-width:640px">';
  html += '<thead><tr><th></th>' + dias.map((d) => `<th style="padding:6px; text-align:center">${d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' })}</th>`).join('') + '</tr></thead><tbody>';

  for (const minutosInicio of filas) {
    const hh = String(Math.floor(minutosInicio / 60)).padStart(2, '0');
    const mm = String(minutosInicio % 60).padStart(2, '0');
    html += `<tr><td class="muted" style="padding:4px 8px; white-space:nowrap">${hh}:${mm}</td>`;
    for (const dia of dias) {
      const diaSemana = dia.getDay();
      const habilitado = disponibilidad.dias_semana.includes(diaSemana);
      if (!habilitado) { html += '<td style="padding:2px"></td>'; continue; }
      const inicio = new Date(dia);
      inicio.setMinutes(minutosInicio);
      const fin = new Date(inicio.getTime() + duracion * 60000);
      const turno = turnosAeronave.find((t) => new Date(t.inicio) < fin && new Date(t.fin) > inicio);
      const pasado = fin < new Date();
      let color = 'var(--ok, #1a7f37)';
      let texto = 'Libre';
      if (turno) {
        color = turno.estado === 'confirmado' ? 'var(--danger, #c0392b)' : 'var(--warn, #d9822b)';
        texto = LABELS_ESTADO_TURNO[turno.estado];
      } else if (pasado) {
        color = 'var(--muted, #888)';
        texto = '—';
      }
      html += `<td style="padding:2px">
        <button class="btn-bloque" data-inicio="${inicio.toISOString()}" data-fin="${fin.toISOString()}" data-turno="${turno ? turno.id : ''}" ${!turno && pasado ? 'disabled' : ''}
          style="width:100%; padding:6px 2px; font-size:11px; border:1px solid ${color}; color:${color}; background:transparent; border-radius:6px; cursor:${!turno && pasado ? 'default' : 'pointer'}">
          ${texto}
        </button>
      </td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  grilla.innerHTML = html;

  grilla.querySelectorAll('.btn-bloque').forEach((b) => {
    if (b.disabled) return;
    b.onclick = () => {
      if (b.dataset.turno) {
        mostrarDetalleTurno(turnosAeronave.find((t) => t.id === b.dataset.turno), membresia, esGestor);
      } else {
        mostrarFormReserva(orgId, b.dataset.inicio, b.dataset.fin, aeronaveId, membresia);
      }
    };
  });
}

async function mostrarDetalleTurno(turno, membresia, esGestor) {
  const detalle = document.getElementById('detalle-bloque');
  const user = await usuarioActual();
  const esPropio = turno.piloto_user_id === user?.id;
  detalle.innerHTML = `
    <div class="card">
      <h2>${Icons.tag('calendar', 'Detalle del turno')}</h2>
      <p>${new Date(turno.inicio).toLocaleString()} → ${new Date(turno.fin).toLocaleString()}</p>
      <p class="muted">Estado: ${LABELS_ESTADO_TURNO[turno.estado]}</p>
      <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap">
        ${esGestor && turno.estado === 'pendiente_autorizacion' ? `
          <button class="btn" id="btn-confirmar-turno">Confirmar</button>
          <button class="btn btn-secundario" id="btn-rechazar-turno">Rechazar</button>
        ` : ''}
        ${(esPropio || esGestor) && turno.estado !== 'cancelado' ? `<button class="btn btn-secundario" id="btn-cancelar-turno">Cancelar</button>` : ''}
      </div>
    </div>
  `;
  const refrescar = () => window.Router.navegar();
  const btnConfirmar = document.getElementById('btn-confirmar-turno');
  if (btnConfirmar) btnConfirmar.onclick = async () => {
    try { await Repo.confirmarTurno(turno.id); UI.toast('Turno confirmado.', 'ok'); refrescar(); }
    catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
  };
  const btnRechazar = document.getElementById('btn-rechazar-turno');
  if (btnRechazar) btnRechazar.onclick = async () => {
    if (!(await UI.confirmar('¿Rechazar este turno?'))) return;
    try { await Repo.rechazarTurno(turno.id); UI.toast('Turno rechazado.', 'ok'); refrescar(); }
    catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
  };
  const btnCancelar = document.getElementById('btn-cancelar-turno');
  if (btnCancelar) btnCancelar.onclick = async () => {
    if (!(await UI.confirmar('¿Cancelar este turno?', { peligro: true }))) return;
    try { await Repo.cancelarTurno(turno.id); UI.toast('Turno cancelado.', 'ok'); refrescar(); }
    catch (err) { UI.toast('Error: ' + (err.message || err), 'error'); }
  };
}

function mostrarFormReserva(orgId, inicioIso, finIso, aeronaveId, membresia) {
  const detalle = document.getElementById('detalle-bloque');
  const instructorSel = document.getElementById('turnos-instructor');
  detalle.innerHTML = `
    <div class="card">
      <h2>${Icons.tag('plusCircle', 'Reservar turno')}</h2>
      <p>${new Date(inicioIso).toLocaleString()} → ${new Date(finIso).toLocaleString()}</p>
      <p class="muted">${membresia.rol === 'piloto_vinculado' ? 'Se confirma directo.' : 'Queda pendiente de autorización de un owner/admin.'}</p>
      <div style="display:flex; gap:8px; margin-top:8px">
        <button class="btn" id="btn-confirmar-reserva">Reservar</button>
        <button class="btn btn-secundario" id="btn-cancelar-reserva">Cancelar</button>
      </div>
    </div>
  `;
  document.getElementById('btn-cancelar-reserva').onclick = () => { detalle.innerHTML = ''; };
  document.getElementById('btn-confirmar-reserva').onclick = async () => {
    try {
      await Repo.crearTurno(orgId, aeronaveId, inicioIso, finIso, instructorSel ? (instructorSel.value || null) : null);
      UI.toast('Turno reservado.', 'ok');
      window.Router.navegar();
    } catch (err) {
      UI.toast('Error al reservar: ' + (err.message || err), 'error');
    }
  };
}

window.ViewEscuela = ViewEscuela;
