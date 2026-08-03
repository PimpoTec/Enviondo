const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([
  path.join(ROOT, 'js/calc.js'),
  path.join(ROOT, 'js/db.js'),
]);
const { Repo, esOwnerOAdmin, LABELS_ROL_ORGANIZACION, LABELS_TIPO_ORGANIZACION } = window;

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

test('crearOrganizacion llama al rpc crear_organizacion con nombre y tipo', async () => {
  let llamado = null;
  window.db = { rpc: async (fn, args) => { llamado = { fn, args }; return { data: 'org-1', error: null }; } };
  const id = await Repo.crearOrganizacion('Aeroclub Test', 'escuela');
  assert.equal(id, 'org-1');
  assert.equal(llamado.fn, 'crear_organizacion');
  assert.equal(JSON.stringify(llamado.args), JSON.stringify({ p_nombre: 'Aeroclub Test', p_tipo: 'escuela' }));
});

test('crearOrganizacion propaga el error si el rpc falla', async () => {
  window.db = { rpc: async () => ({ data: null, error: new Error('tipo inválido') }) };
  await assert.rejects(() => Repo.crearOrganizacion('X', 'lo que sea'), /tipo inválido/);
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

test('listarMisOrganizaciones arma el select con el join a organizaciones', async () => {
  let filtros = [];
  const query = {
    select: (cols) => { filtros.push(['select', cols]); return query; },
    order: (col) => { filtros.push(['order', col]); return { data: [{ org_id: 'org-1', rol: 'owner', estado: 'activo' }], error: null }; },
  };
  window.db = { from: (tabla) => { filtros.push(['from', tabla]); return query; } };
  const data = await Repo.listarMisOrganizaciones();
  assert.equal(filtros[0][1], 'organizacion_miembros');
  assert.equal(data[0].org_id, 'org-1');
});

test('salirDeOrganizacion propaga el error cuando el owner intenta salir', async () => {
  window.db = { rpc: async () => ({ error: new Error('El owner no puede salir de la organización') }) };
  await assert.rejects(() => Repo.salirDeOrganizacion('org-1'), /owner no puede salir/);
});
