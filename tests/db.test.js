const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([
  path.join(ROOT, 'js/calc.js'),
  path.join(ROOT, 'js/db.js'),
]);
const { agregarVuelos, valorRequisito } = window;

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
