const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { Calc } = loadApp([path.join(ROOT, 'js/calc.js')]);

test('costoRegistrado: prefiere el costo congelado (ARS) si el vuelo lo trae', () => {
  const aeronave = { moneda: 'USD', tarifa_hora_diurna: 100, tarifa_hora_nocturna: 100 };
  const vuelo = { costo_congelado: 123456.78, trav_dia_piloto: 1 };
  const c = Calc.costoRegistrado(vuelo, aeronave);
  assert.equal(c.monto, 123456.78);
  assert.equal(c.moneda, 'ARS');
  assert.equal(c.congelado, true);
});

test('costoRegistrado: sin congelado, calcula al vuelo con la tarifa de la aeronave', () => {
  const aeronave = { moneda: 'ARS', tarifa_hora_diurna: 200, tarifa_hora_nocturna: 300 };
  const vuelo = { saero_dia_piloto: 2 }; // 2 hs de día
  const c = Calc.costoRegistrado(vuelo, aeronave);
  assert.equal(c.monto, 400);
  assert.equal(c.moneda, 'ARS');
  assert.equal(c.congelado, false);
});

test('costoRegistrado: costo_congelado = 0 sigue siendo un valor válido (no cae al cálculo)', () => {
  const vuelo = { costo_congelado: 0, saero_dia_piloto: 5 };
  const aeronave = { moneda: 'ARS', tarifa_hora_diurna: 999 };
  const c = Calc.costoRegistrado(vuelo, aeronave);
  assert.equal(c.monto, 0);
  assert.equal(c.congelado, true);
});

test('parseFechaLocal: arma la fecha a medianoche local (no UTC)', () => {
  const d = Calc.parseFechaLocal('2026-07-20');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 6); // julio = 6
  assert.equal(d.getDate(), 20);
  assert.equal(d.getHours(), 0);
});

test('parseFechaLocal: tolera timestamps largos y valores vacíos', () => {
  assert.equal(Calc.parseFechaLocal('2026-07-20T13:45:00Z').getDate(), 20);
  assert.equal(Calc.parseFechaLocal(''), null);
  assert.equal(Calc.parseFechaLocal(null), null);
});
