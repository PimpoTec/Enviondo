const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([
  path.join(ROOT, 'js/calc.js'),
  path.join(ROOT, 'js/views/totales.js'),
]);
const { calcularFrecuenciaAerodromos, calcularRutasFrecuentes } = window;

function vuelo(desde, hasta, tiempo_total = 1) {
  return { desde, hasta, tiempo_total };
}

test('calcularFrecuenciaAerodromos: cuenta cada aeródromo como origen y destino', () => {
  const vuelos = [vuelo('SADF', 'SADF'), vuelo('SADF', 'SABE')];
  const f = calcularFrecuenciaAerodromos(vuelos);
  assert.equal(f.SADF, 2);
  assert.equal(f.SABE, 1);
});

test('calcularFrecuenciaAerodromos: un vuelo local solo suma una vez el aeródromo (Set)', () => {
  const f = calcularFrecuenciaAerodromos([vuelo('SADF', 'SADF')]);
  assert.equal(f.SADF, 1);
});

test('calcularRutasFrecuentes: A-B y B-A cuentan como la misma ruta', () => {
  const vuelos = [vuelo('SADF', 'SABE', 1), vuelo('SABE', 'SADF', 1.5)];
  const rutas = calcularRutasFrecuentes(vuelos);
  assert.equal(rutas.length, 1);
  assert.equal(rutas[0].count, 2);
  assert.equal(rutas[0].horas, 2.5);
});

test('calcularRutasFrecuentes: ordena de más a menos volada', () => {
  const vuelos = [
    vuelo('SADF', 'SADF'), vuelo('SADF', 'SADF'), vuelo('SADF', 'SADF'),
    vuelo('SADF', 'SABE'),
  ];
  const rutas = calcularRutasFrecuentes(vuelos);
  assert.equal(rutas[0].desde, 'SADF');
  assert.equal(rutas[0].hasta, 'SADF');
  assert.equal(rutas[0].count, 3);
});

test('calcularRutasFrecuentes: ignora vuelos sin ruta cargada', () => {
  const rutas = calcularRutasFrecuentes([{ desde: null, hasta: null, tiempo_total: 1 }]);
  assert.equal(rutas.length, 0);
});
