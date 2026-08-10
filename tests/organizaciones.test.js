const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([
  path.join(ROOT, 'js/calc.js'),
  path.join(ROOT, 'js/cache.js'), // Repo.aceptarInvitacion/rechazarInvitacion/salirDeOrganizacion invalidan cache
  path.join(ROOT, 'js/db.js'),
]);
const {
  Repo, esOwnerOAdmin, LABELS_ROL_ORGANIZACION, LABELS_TIPO_ORGANIZACION, LABELS_ESTADO_TURNO,
  LABELS_ESTADO_VUELO_ASIGNADO, LABELS_ESTADO_ORGANIZACION,
} = window;

// ---- esOwnerOAdmin: helper puro que usa la vista para decidir qué mostrar ----

test('esOwnerOAdmin es true para owner y admin', () => {
  assert.equal(esOwnerOAdmin('owner'), true);
  assert.equal(esOwnerOAdmin('admin'), true);
});

test('esOwnerOAdmin es false para instructor y piloto_vinculado', () => {
  assert.equal(esOwnerOAdmin('instructor'), false);
  assert.equal(esOwnerOAdmin('piloto_vinculado'), false);
});

test('LABELS_ROL_ORGANIZACION y LABELS_TIPO_ORGANIZACION cubren todos los valores del check de la base', () => {
  for (const rol of ['owner', 'admin', 'instructor', 'piloto_vinculado']) assert.ok(LABELS_ROL_ORGANIZACION[rol]);
  for (const tipo of ['escuela', 'empresa']) assert.ok(LABELS_TIPO_ORGANIZACION[tipo]);
});

// ---- Repo.*: wrappers finos sobre supabase — se prueba que arman la
// llamada correcta y que un error de la red/RLS se propaga (no se traga). ----

// Solo la cuenta admin de la app crea organizaciones — pasa por la Edge
// Function crear-organizacion (no por un rpc directo), porque puede
// necesitar invitar por mail a un owner que todavía no tiene cuenta.
test('crearOrganizacionAdmin invoca la Edge Function con nombre, tipo y owner_email', async () => {
  window.location = { origin: 'https://vuelux.test', pathname: '/' };
  let llamado = null;
  window.db = { functions: { invoke: async (slug, opts) => { llamado = { slug, opts }; return { data: { org_id: 'org-1' }, error: null }; } } };
  const id = await Repo.crearOrganizacionAdmin('Aeroclub Test', 'escuela', 'owner@ejemplo.com');
  assert.equal(id, 'org-1');
  assert.equal(llamado.slug, 'crear-organizacion');
  assert.equal(JSON.stringify(llamado.opts.body), JSON.stringify({
    nombre: 'Aeroclub Test', tipo: 'escuela', owner_email: 'owner@ejemplo.com', redirect_to: 'https://vuelux.test/',
  }));
});

test('crearOrganizacionAdmin propaga el error que viene en el body (ej. "no sos admin")', async () => {
  window.location = { origin: 'https://vuelux.test', pathname: '/' };
  window.db = { functions: { invoke: async () => ({ data: { error: 'Solo la cuenta admin de la app puede crear organizaciones' }, error: null }) } };
  await assert.rejects(() => Repo.crearOrganizacionAdmin('X', 'escuela', 'a@b.com'), /cuenta admin de la app/);
});

test('crearOrganizacionAdmin propaga el error de un status no-2xx de la función', async () => {
  window.location = { origin: 'https://vuelux.test', pathname: '/' };
  window.mensajeDeErrorFuncion = async () => 'Tipo de organización inválido: lo que sea';
  window.db = { functions: { invoke: async () => ({ data: null, error: new Error('Edge Function returned a non-2xx status code') }) } };
  await assert.rejects(() => Repo.crearOrganizacionAdmin('X', 'lo que sea', 'a@b.com'), /Tipo de organización inválido/);
});

test('invitarMiembro llama al rpc invitar_miembro con org, email y rol', async () => {
  let llamado = null;
  window.db = { rpc: async (fn, args) => { llamado = { fn, args }; return { data: 'miembro-1', error: null }; } };
  await Repo.invitarMiembro('org-1', 'piloto@ejemplo.com', 'instructor');
  assert.equal(llamado.fn, 'invitar_miembro');
  assert.equal(JSON.stringify(llamado.args), JSON.stringify({ p_org_id: 'org-1', p_email: 'piloto@ejemplo.com', p_rol: 'instructor' }));
});

test('aceptarInvitacion y rechazarInvitacion llaman al rpc correspondiente con el org_id', async () => {
  const llamadas = [];
  window.db = { rpc: async (fn, args) => { llamadas.push({ fn, args }); return { error: null }; } };
  await Repo.aceptarInvitacion('org-1');
  await Repo.rechazarInvitacion('org-2');
  assert.equal(JSON.stringify(llamadas), JSON.stringify([
    { fn: 'aceptar_invitacion', args: { p_org_id: 'org-1' } },
    { fn: 'rechazar_invitacion', args: { p_org_id: 'org-2' } },
  ]));
});

test('quitarMiembro llama al rpc quitar_miembro con org y usuario', async () => {
  let llamado = null;
  window.db = { rpc: async (fn, args) => { llamado = { fn, args }; return { error: null }; } };
  await Repo.quitarMiembro('org-1', 'user-2');
  assert.equal(llamado.fn, 'quitar_miembro');
  assert.equal(JSON.stringify(llamado.args), JSON.stringify({ p_org_id: 'org-1', p_user_id: 'user-2' }));
});

test('listarMisOrganizaciones filtra por user_id (no debe traer membresías ajenas)', async () => {
  let filtros = [];
  const query = {
    select: (cols) => { filtros.push(['select', cols]); return query; },
    eq: (col, val) => { filtros.push(['eq', col, val]); return query; },
    order: (col) => { filtros.push(['order', col]); return { data: [{ org_id: 'org-1', rol: 'owner', estado: 'activo' }], error: null }; },
  };
  window.db = {
    from: (tabla) => { filtros.push(['from', tabla]); return query; },
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
  };
  const data = await Repo.listarMisOrganizaciones();
  assert.equal(JSON.stringify(filtros), JSON.stringify([
    ['from', 'organizacion_miembros'], ['select', 'id, org_id, rol, estado, organizaciones(id, tipo, nombre, plan, estado)'],
    ['eq', 'user_id', 'user-1'], ['order', 'created_at'],
  ]));
  assert.equal(data[0].org_id, 'org-1');
});

test('salirDeOrganizacion propaga el error cuando el owner intenta salir', async () => {
  window.db = { rpc: async () => ({ error: new Error('El owner no puede salir de la organización') }) };
  await assert.rejects(() => Repo.salirDeOrganizacion('org-1'), /owner no puede salir/);
});

// ---- Flota de organización (Fase 2 B2B) ----

test('listarFlotaOrg filtra por org_id y ordena por matrícula', async () => {
  const filtros = [];
  const query = {
    select: (cols) => { filtros.push(['select', cols]); return query; },
    eq: (col, val) => { filtros.push(['eq', col, val]); return query; },
    order: (col) => { filtros.push(['order', col]); return { data: [{ id: 'a1', matricula: 'LV-AAA' }], error: null }; },
  };
  window.db = { from: (tabla) => { filtros.push(['from', tabla]); return query; } };
  const data = await Repo.listarFlotaOrg('org-1');
  assert.equal(JSON.stringify(filtros), JSON.stringify([['from', 'aeronaves'], ['select', '*'], ['eq', 'org_id', 'org-1'], ['order', 'matricula']]));
  assert.equal(data[0].matricula, 'LV-AAA');
});

test('guardarAeronaveOrg sin id inserta con org_id seteado y user_id null', async () => {
  let insertado = null;
  window.db = { from: () => ({ insert: async (row) => { insertado = row; return { error: null }; } }) };
  await Repo.guardarAeronaveOrg('org-1', { matricula: 'LV-BBB', marca_modelo: 'Cessna 152' });
  assert.equal(insertado.org_id, 'org-1');
  assert.equal(insertado.user_id, null);
  assert.equal(insertado.matricula, 'LV-BBB');
});

test('guardarAeronaveOrg con id actualiza en vez de insertar', async () => {
  let actualizado = null;
  let eqId = null;
  window.db = { from: () => ({ update: (row) => { actualizado = row; return { eq: async (col, val) => { eqId = val; return { error: null }; } }; } }) };
  await Repo.guardarAeronaveOrg('org-1', { id: 'a1', matricula: 'LV-CCC' });
  assert.equal(actualizado.id, 'a1');
  assert.equal(eqId, 'a1');
});

test('borrarAeronaveOrg propaga el error si RLS lo rechaza (no es owner/admin)', async () => {
  window.db = { from: () => ({ delete: () => ({ eq: async () => ({ error: new Error('new row violates row-level security policy') }) }) }) };
  await assert.rejects(() => Repo.borrarAeronaveOrg('a1'), /row-level security/);
});

// ---- Instructores (Fase 3 B2B) ----

test('listarInstructores filtra por org_id', async () => {
  const filtros = [];
  const query = {
    select: (cols) => { filtros.push(['select', cols]); return query; },
    eq: (col, val) => { filtros.push(['eq', col, val]); return query; },
    order: (col) => { filtros.push(['order', col]); return { data: [{ id: 'i1' }], error: null }; },
  };
  window.db = { from: (tabla) => { filtros.push(['from', tabla]); return query; } };
  const data = await Repo.listarInstructores('org-1');
  assert.equal(JSON.stringify(filtros), JSON.stringify([['from', 'instructores'], ['select', '*'], ['eq', 'org_id', 'org-1'], ['order', 'created_at']]));
  assert.equal(data[0].id, 'i1');
});

test('agregarInstructor inserta org_id, user_id y nro_licencia (null si no se pasa)', async () => {
  let insertado = null;
  window.db = { from: () => ({ insert: async (row) => { insertado = row; return { error: null }; } }) };
  await Repo.agregarInstructor('org-1', 'user-2', 'PIN-123');
  assert.equal(JSON.stringify(insertado), JSON.stringify({ org_id: 'org-1', user_id: 'user-2', nro_licencia: 'PIN-123' }));

  await Repo.agregarInstructor('org-1', 'user-3', '');
  assert.equal(insertado.nro_licencia, null);
});

test('agregarInstructor propaga el error si el user_id no es miembro con rol instructor', async () => {
  window.db = { from: () => ({ insert: async () => ({ error: new Error('new row violates row-level security policy') }) }) };
  await assert.rejects(() => Repo.agregarInstructor('org-1', 'user-2', ''), /row-level security/);
});

test('actualizarInstructor manda solo los cambios pasados', async () => {
  let actualizado = null;
  window.db = { from: () => ({ update: (row) => { actualizado = row; return { eq: async () => ({ error: null }) }; } }) };
  await Repo.actualizarInstructor('i1', { activo: false });
  assert.equal(JSON.stringify(actualizado), JSON.stringify({ activo: false }));
});

test('quitarInstructor borra por id', async () => {
  let idBorrado = null;
  window.db = { from: () => ({ delete: () => ({ eq: async (col, val) => { idBorrado = val; return { error: null }; } }) }) };
  await Repo.quitarInstructor('i1');
  assert.equal(idBorrado, 'i1');
});

test('listarVencimientosDeUsuario filtra por user_id (no por el usuario logueado)', async () => {
  const filtros = [];
  const query = {
    select: (cols) => { filtros.push(['select', cols]); return query; },
    eq: (col, val) => { filtros.push(['eq', col, val]); return query; },
    order: (col) => { filtros.push(['order', col]); return { data: [], error: null }; },
  };
  window.db = { from: (tabla) => { filtros.push(['from', tabla]); return query; } };
  await Repo.listarVencimientosDeUsuario('user-2');
  assert.equal(JSON.stringify(filtros), JSON.stringify([['from', 'vencimientos'], ['select', '*'], ['eq', 'user_id', 'user-2'], ['order', 'fecha_vencimiento']]));
});

test('listarVencimientosDeUsuario devuelve vacío (no error) si RLS no deja ver a ese usuario', async () => {
  window.db = { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }) };
  const data = await Repo.listarVencimientosDeUsuario('user-ajeno');
  assert.deepEqual(data, []);
});

// ---- Turnos (Fase 4 B2B) ----

test('LABELS_ESTADO_TURNO cubre los 3 estados del check de la base', () => {
  for (const estado of ['pendiente_autorizacion', 'confirmado', 'cancelado']) assert.ok(LABELS_ESTADO_TURNO[estado]);
});

test('listarTurnosOrg filtra por org_id y ordena por inicio', async () => {
  const filtros = [];
  const query = {
    select: (cols) => { filtros.push(['select', cols]); return query; },
    eq: (col, val) => { filtros.push(['eq', col, val]); return query; },
    order: (col) => { filtros.push(['order', col]); return { data: [{ id: 't1' }], error: null }; },
  };
  window.db = { from: (tabla) => { filtros.push(['from', tabla]); return query; } };
  const data = await Repo.listarTurnosOrg('org-1');
  assert.equal(JSON.stringify(filtros), JSON.stringify([['from', 'turnos'], ['select', '*'], ['eq', 'org_id', 'org-1'], ['order', 'inicio']]));
  assert.equal(data[0].id, 't1');
});

test('crearTurno llama al rpc crear_turno con todos los parámetros, instructor null si no se pasa', async () => {
  let llamado = null;
  window.db = { rpc: async (fn, args) => { llamado = { fn, args }; return { data: 'turno-1', error: null }; } };
  const id = await Repo.crearTurno('org-1', 'aer-1', '2026-08-10T10:00:00.000Z', '2026-08-10T11:00:00.000Z');
  assert.equal(id, 'turno-1');
  assert.equal(llamado.fn, 'crear_turno');
  assert.equal(JSON.stringify(llamado.args), JSON.stringify({
    p_org_id: 'org-1', p_aeronave_id: 'aer-1', p_inicio: '2026-08-10T10:00:00.000Z', p_fin: '2026-08-10T11:00:00.000Z', p_instructor_id: null,
  }));
});

test('crearTurno propaga el error de solapamiento del constraint de exclusión', async () => {
  window.db = { rpc: async () => ({ data: null, error: new Error('Ese horario ya está ocupado para esa aeronave') }) };
  await assert.rejects(() => Repo.crearTurno('org-1', 'aer-1', 'x', 'y'), /ya está ocupado/);
});

test('obtenerDisponibilidadTurnos filtra por org_id y trae una sola fila (o null)', async () => {
  const filtros = [];
  const query = {
    select: (cols) => { filtros.push(['select', cols]); return query; },
    eq: (col, val) => { filtros.push(['eq', col, val]); return query; },
    maybeSingle: async () => { filtros.push(['maybeSingle']); return { data: { org_id: 'org-1', hora_inicio: '08:00' }, error: null }; },
  };
  window.db = { from: (tabla) => { filtros.push(['from', tabla]); return query; } };
  const data = await Repo.obtenerDisponibilidadTurnos('org-1');
  assert.equal(JSON.stringify(filtros), JSON.stringify([['from', 'disponibilidad_turnos'], ['select', '*'], ['eq', 'org_id', 'org-1'], ['maybeSingle']]));
  assert.equal(data.hora_inicio, '08:00');
});

test('obtenerDisponibilidadTurnos devuelve null cuando la escuela todavía no configuró nada', async () => {
  window.db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
  const data = await Repo.obtenerDisponibilidadTurnos('org-1');
  assert.equal(data, null);
});

test('guardarDisponibilidadTurnos llama al rpc guardar_disponibilidad_turnos con todos los parámetros', async () => {
  let llamado = null;
  window.db = { rpc: async (fn, args) => { llamado = { fn, args }; return { error: null }; } };
  await Repo.guardarDisponibilidadTurnos('org-1', [1, 2, 3, 4, 5], '08:00', '20:00', 60);
  assert.equal(llamado.fn, 'guardar_disponibilidad_turnos');
  assert.equal(JSON.stringify(llamado.args), JSON.stringify({
    p_org_id: 'org-1', p_dias_semana: [1, 2, 3, 4, 5], p_hora_inicio: '08:00', p_hora_fin: '20:00', p_duracion_bloque_minutos: 60,
  }));
});

test('guardarDisponibilidadTurnos propaga el error si no sos owner/admin', async () => {
  window.db = { rpc: async () => ({ error: new Error('No tenés permiso para configurar la disponibilidad de esta organización') }) };
  await assert.rejects(() => Repo.guardarDisponibilidadTurnos('org-1', [1], '08:00', '20:00', 60), /No tenés permiso/);
});

test('obtenerNombresPilotosOrg llama al rpc nombres_pilotos_org y arma un mapa user_id -> nombre', async () => {
  let llamado = null;
  window.db = { rpc: async (fn, args) => { llamado = { fn, args }; return { data: [{ user_id: 'u1', nombre_completo: 'Juan Pérez' }, { user_id: 'u2', nombre_completo: null }], error: null }; } };
  const mapa = await Repo.obtenerNombresPilotosOrg('org-1', ['u1', 'u2']);
  assert.equal(llamado.fn, 'nombres_pilotos_org');
  assert.equal(JSON.stringify(llamado.args), JSON.stringify({ p_org_id: 'org-1', p_user_ids: ['u1', 'u2'] }));
  assert.equal(JSON.stringify(mapa), JSON.stringify({ u1: 'Juan Pérez' }));
});

test('obtenerNombresPilotosOrg no pega a la red si la lista de ids está vacía', async () => {
  window.db = { rpc: async () => { throw new Error('no debería llamarse'); } };
  const mapa = await Repo.obtenerNombresPilotosOrg('org-1', []);
  assert.equal(JSON.stringify(mapa), '{}');
});

test('confirmarTurno, rechazarTurno y cancelarTurno llaman cada uno a su rpc con el turno_id', async () => {
  const llamadas = [];
  window.db = { rpc: async (fn, args) => { llamadas.push({ fn, args }); return { error: null }; } };
  await Repo.confirmarTurno('t1');
  await Repo.rechazarTurno('t2');
  await Repo.cancelarTurno('t3');
  assert.equal(JSON.stringify(llamadas), JSON.stringify([
    { fn: 'confirmar_turno', args: { p_turno_id: 't1' } },
    { fn: 'rechazar_turno', args: { p_turno_id: 't2' } },
    { fn: 'cancelar_turno', args: { p_turno_id: 't3' } },
  ]));
});

// ---- Despacho / vuelos asignados (Fase 1 B2B) ----

test('LABELS_ESTADO_VUELO_ASIGNADO cubre los 4 estados del check de la base', () => {
  for (const estado of ['programado', 'en_curso', 'completado', 'cancelado']) assert.ok(LABELS_ESTADO_VUELO_ASIGNADO[estado]);
});

test('listarVuelosAsignadosOrg filtra por org_id y ordena por inicio', async () => {
  const filtros = [];
  const query = {
    select: (cols) => { filtros.push(['select', cols]); return query; },
    eq: (col, val) => { filtros.push(['eq', col, val]); return query; },
    order: (col) => { filtros.push(['order', col]); return { data: [{ id: 'v1' }], error: null }; },
  };
  window.db = { from: (tabla) => { filtros.push(['from', tabla]); return query; } };
  const data = await Repo.listarVuelosAsignadosOrg('org-1');
  assert.equal(JSON.stringify(filtros), JSON.stringify([['from', 'vuelos_asignados'], ['select', '*'], ['eq', 'org_id', 'org-1'], ['order', 'inicio']]));
  assert.equal(data[0].id, 'v1');
});

test('asignarVuelo llama al rpc asignar_vuelo con todos los parámetros', async () => {
  let llamado = null;
  window.db = { rpc: async (fn, args) => { llamado = { fn, args }; return { data: 'vuelo-1', error: null }; } };
  const id = await Repo.asignarVuelo('org-1', 'aer-1', 'user-2', 'SABE-SAZR', '2026-08-10T10:00:00.000Z', '2026-08-10T11:00:00.000Z');
  assert.equal(id, 'vuelo-1');
  assert.equal(llamado.fn, 'asignar_vuelo');
  assert.equal(JSON.stringify(llamado.args), JSON.stringify({
    p_org_id: 'org-1', p_aeronave_id: 'aer-1', p_piloto_user_id: 'user-2', p_tramo: 'SABE-SAZR', p_inicio: '2026-08-10T10:00:00.000Z', p_fin: '2026-08-10T11:00:00.000Z',
  }));
});

test('asignarVuelo propaga el error de solapamiento del constraint de exclusión', async () => {
  window.db = { rpc: async () => ({ data: null, error: new Error('Ese horario ya está ocupado para esa aeronave') }) };
  await assert.rejects(() => Repo.asignarVuelo('org-1', 'aer-1', 'user-2', 'X', 'a', 'b'), /ya está ocupado/);
});

test('actualizarEstadoVueloAsignado llama al rpc con el nuevo estado', async () => {
  let llamado = null;
  window.db = { rpc: async (fn, args) => { llamado = { fn, args }; return { error: null }; } };
  await Repo.actualizarEstadoVueloAsignado('v1', 'en_curso');
  assert.equal(llamado.fn, 'actualizar_estado_vuelo_asignado');
  assert.equal(JSON.stringify(llamado.args), JSON.stringify({ p_vuelo_id: 'v1', p_estado: 'en_curso' }));
});

test('cancelarVueloAsignado es un atajo de actualizarEstadoVueloAsignado a "cancelado"', async () => {
  let llamado = null;
  window.db = { rpc: async (fn, args) => { llamado = { fn, args }; return { error: null }; } };
  await Repo.cancelarVueloAsignado('v1');
  assert.equal(JSON.stringify(llamado.args), JSON.stringify({ p_vuelo_id: 'v1', p_estado: 'cancelado' }));
});

// ---- Panel admin de organizaciones ----

test('LABELS_ESTADO_ORGANIZACION cubre los 4 estados del check de la base', () => {
  for (const estado of ['pendiente_aprobacion', 'activa', 'suspendida', 'rechazada']) assert.ok(LABELS_ESTADO_ORGANIZACION[estado]);
});

test('listarOrganizacionesAdmin ordena por creación descendente', async () => {
  const filtros = [];
  const query = {
    select: (cols) => { filtros.push(['select', cols]); return query; },
    order: (col, opts) => { filtros.push(['order', col, opts]); return { data: [{ id: 'org-1' }], error: null }; },
  };
  window.db = { from: (tabla) => { filtros.push(['from', tabla]); return query; } };
  const data = await Repo.listarOrganizacionesAdmin();
  assert.equal(JSON.stringify(filtros), JSON.stringify([['from', 'organizaciones'], ['select', '*'], ['order', 'created_at', { ascending: false }]]));
  assert.equal(data[0].id, 'org-1');
});

test('aprobarOrganizacion/rechazarOrganizacion/suspenderOrganizacion/reactivarOrganizacion llaman cada uno a su rpc', async () => {
  const llamadas = [];
  window.db = { rpc: async (fn, args) => { llamadas.push({ fn, args }); return { error: null }; } };
  await Repo.aprobarOrganizacion('org-1');
  await Repo.rechazarOrganizacion('org-2');
  await Repo.suspenderOrganizacion('org-3');
  await Repo.reactivarOrganizacion('org-4');
  assert.equal(JSON.stringify(llamadas), JSON.stringify([
    { fn: 'aprobar_organizacion', args: { p_org_id: 'org-1' } },
    { fn: 'rechazar_organizacion', args: { p_org_id: 'org-2' } },
    { fn: 'suspender_organizacion', args: { p_org_id: 'org-3' } },
    { fn: 'reactivar_organizacion', args: { p_org_id: 'org-4' } },
  ]));
});

test('aprobarOrganizacion propaga el error si no sos la cuenta admin de la app', async () => {
  window.db = { rpc: async () => ({ error: new Error('Solo la cuenta admin de la app puede aprobar organizaciones') }) };
  await assert.rejects(() => Repo.aprobarOrganizacion('org-1'), /cuenta admin de la app/);
});
