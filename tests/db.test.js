const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([
  path.join(ROOT, 'js/calc.js'),
  path.join(ROOT, 'js/db.js'),
]);
const { agregarVuelos, valorRequisito, ordenarAeronavesPorUso, _mezclarConfigPersonal, _borrarFotoStorage } = window;

test('agregarVuelos suma tiempo_total y costo de varios vuelos', () => {
  const vuelos = [
    { tiempo_total: 1.2, total_dia: 1.2, total_noche: 0, total_pic: 1.2, aterrizajes_dia: 1, aeronaves: { tarifa_hora_diurna: 100, tarifa_hora_nocturna: 100 } },
    { tiempo_total: 2, total_dia: 1, total_noche: 1, total_pic: 2, trav_dia_piloto: 1, trav_noche_piloto: 1, aeronaves: { tarifa_hora_diurna: 100, tarifa_hora_nocturna: 100 } },
  ];
  const agg = agregarVuelos(vuelos);
  assert.equal(agg.tiempo_total, 3.2);
  assert.equal(agg.total_pic, 3.2);
});

test('agregarVuelos con lista vacía da todo en cero, no rompe', () => {
  const agg = agregarVuelos([]);
  assert.equal(agg.tiempo_total, 0);
  assert.equal(agg.costo_total, 0);
});

test('valorRequisito mapea cada clave al campo correcto del agregado', () => {
  const agg = { tiempo_total: 10, total_pic: 8, total_noche: 2, aterrizajes_noche: 3, remolques: 5, adiestrador_simulador: 4, instrumentos_real: 1, instrumentos_capota: 0.5 };
  assert.equal(valorRequisito('total', agg), 10);
  assert.equal(valorRequisito('pic', agg), 8);
  assert.equal(valorRequisito('nocturnas', agg), 2);
  assert.equal(valorRequisito('aterrizajes_noche', agg), 3);
  assert.equal(valorRequisito('remolques', agg), 5);
  assert.equal(valorRequisito('instrumentos_sim', agg), 4);
  assert.equal(valorRequisito('instrumentos', agg), 1.5); // real + capota
});

test('valorRequisito con clave desconocida devuelve 0 (no inventa)', () => {
  assert.equal(valorRequisito('algo_que_no_existe', {}), 0);
});

// ---- ordenarAeronavesPorUso: preferidas primero, luego por más reciente ----

test('ordenarAeronavesPorUso: las preferidas (es_habitual) van primero, sin importar el uso', () => {
  const aeronaves = [
    { id: 'a1', matricula: 'LV-AAA', es_habitual: false },
    { id: 'a2', matricula: 'LV-BBB', es_habitual: true },
  ];
  const vuelos = [{ aeronave_id: 'a1', fecha: '2026-07-20' }]; // a1 se voló hace poco, a2 nunca
  const orden = ordenarAeronavesPorUso(aeronaves, vuelos);
  assert.equal(orden[0].id, 'a2');
  assert.equal(orden[1].id, 'a1');
});

test('ordenarAeronavesPorUso: dentro del mismo grupo, la voladas más recientemente va arriba', () => {
  const aeronaves = [
    { id: 'a1', matricula: 'LV-AAA', es_habitual: false },
    { id: 'a2', matricula: 'LV-BBB', es_habitual: false },
    { id: 'a3', matricula: 'LV-CCC', es_habitual: false },
  ];
  const vuelos = [
    { aeronave_id: 'a1', fecha: '2026-01-01' },
    { aeronave_id: 'a2', fecha: '2026-07-01' },
    { aeronave_id: 'a1', fecha: '2026-03-01' }, // el vuelo más nuevo de a1, no el primero
  ];
  const orden = ordenarAeronavesPorUso(aeronaves, vuelos);
  // Los arrays que salen del sandbox de loadApp son de otro "realm" — deepEqual
  // los compara por estructura pero falla la referencia; comparamos como JSON.
  assert.equal(JSON.stringify(orden.map((a) => a.id)), JSON.stringify(['a2', 'a1', 'a3'])); // a3 nunca se voló, al final
});

test('ordenarAeronavesPorUso: sin ningún vuelo cargado, cae a orden alfabético dentro del grupo', () => {
  const aeronaves = [
    { id: 'a1', matricula: 'LV-ZZZ', es_habitual: false },
    { id: 'a2', matricula: 'LV-AAA', es_habitual: false },
  ];
  const orden = ordenarAeronavesPorUso(aeronaves, []);
  assert.equal(orden[0].matricula, 'LV-AAA');
});

test('ordenarAeronavesPorUso: ignora vuelos de simulador (sin aeronave_id) sin romper', () => {
  const aeronaves = [{ id: 'a1', matricula: 'LV-AAA', es_habitual: false }];
  const vuelos = [{ aeronave_id: null, fecha: '2026-07-20' }];
  const orden = ordenarAeronavesPorUso(aeronaves, vuelos);
  assert.equal(orden.length, 1);
});

// ---- _mezclarConfigPersonal: mínimos de referencia + personalizaciones ----
test('_mezclarConfigPersonal: sin personalizaciones, devuelve los globales tal cual (personalizado: false)', () => {
  const globales = [{ id: 'g1', curso_id: 'PPA', nombre_requisito: 'total', minimo_horas: 40, orden: 1 }];
  const out = _mezclarConfigPersonal(globales, []);
  assert.equal(out.length, 1);
  assert.equal(out[0].minimo_horas, 40);
  assert.equal(out[0].personalizado, false);
});

test('_mezclarConfigPersonal: con una personalización, reemplaza el mínimo de ESE requisito y lo marca', () => {
  const globales = [
    { id: 'g1', curso_id: 'PCA', nombre_requisito: 'total', minimo_horas: 200, orden: 1 },
    { id: 'g2', curso_id: 'PCA', nombre_requisito: 'pic', minimo_horas: 100, orden: 2 },
  ];
  const personales = [{ curso_id: 'PCA', nombre_requisito: 'total', minimo_horas: 250 }];
  const out = _mezclarConfigPersonal(globales, personales);
  assert.equal(out.find((r) => r.nombre_requisito === 'total').minimo_horas, 250);
  assert.equal(out.find((r) => r.nombre_requisito === 'total').personalizado, true);
  assert.equal(out.find((r) => r.nombre_requisito === 'pic').minimo_horas, 100);
  assert.equal(out.find((r) => r.nombre_requisito === 'pic').personalizado, false);
});

test('_mezclarConfigPersonal: sin ningún requisito global, devuelve vacío aunque haya personalizaciones sueltas', () => {
  const out = _mezclarConfigPersonal([], [{ curso_id: 'PCA', nombre_requisito: 'total', minimo_horas: 999 }]);
  assert.equal(out.length, 0);
});

// ---- _borrarFotoStorage: limpieza de la foto vieja al reemplazar/sacar una ----
test('_borrarFotoStorage: extrae el path después de "/aeronaves-fotos/" y llama remove() con ese path', async () => {
  const removidos = [];
  window.db = { storage: { from: (bucket) => ({ remove: async (paths) => { removidos.push({ bucket, paths }); return { error: null }; } }) } };
  await _borrarFotoStorage('https://xyz.supabase.co/storage/v1/object/public/aeronaves-fotos/user123/aero1-111.jpg');
  assert.equal(removidos.length, 1);
  assert.equal(removidos[0].bucket, 'aeronaves-fotos');
  // Los arrays que salen del sandbox de loadApp son de otro "realm" —
  // deepEqual los compara por estructura pero falla la referencia.
  assert.equal(JSON.stringify(removidos[0].paths), JSON.stringify(['user123/aero1-111.jpg']));
});

test('_borrarFotoStorage: decodifica caracteres de la URL (ej. espacios como %20)', async () => {
  const removidos = [];
  window.db = { storage: { from: () => ({ remove: async (paths) => { removidos.push(paths); return { error: null }; } }) } };
  await _borrarFotoStorage('https://xyz.supabase.co/storage/v1/object/public/aeronaves-fotos/user123/foto%20vieja.jpg');
  assert.equal(JSON.stringify(removidos[0]), JSON.stringify(['user123/foto vieja.jpg']));
});

test('_borrarFotoStorage: URL que no matchea el patrón esperado, no llama a Storage ni tira error', async () => {
  let llamado = false;
  window.db = { storage: { from: () => ({ remove: async () => { llamado = true; return { error: null }; } }) } };
  await assert.doesNotReject(_borrarFotoStorage('https://otro-dominio.com/algo.jpg'));
  assert.equal(llamado, false);
});

test('_borrarFotoStorage: si Storage tira una excepción, no se propaga (best-effort)', async () => {
  window.db = { storage: { from: () => ({ remove: async () => { throw new Error('403 forbidden'); } }) } };
  await assert.doesNotReject(_borrarFotoStorage('https://xyz.supabase.co/storage/v1/object/public/aeronaves-fotos/user123/aero1-111.jpg'));
});
