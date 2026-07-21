const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([
  path.join(ROOT, 'js/calc.js'),
  path.join(ROOT, 'js/views/totales.js'),
]);
const { calcularFrecuenciaAerodromos, calcularRutasFrecuentes, distanciaKm, fmtDuracionHhMm } = window;

function vuelo(desde, hasta, tiempo_total = 1, matricula) {
  return { desde, hasta, tiempo_total, aeronaves: matricula ? { matricula } : undefined };
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

test('calcularRutasFrecuentes: junta las matrículas distintas que volaron esa ruta', () => {
  const vuelos = [
    vuelo('SADF', 'SABE', 1, 'LV-ABC'),
    vuelo('SADF', 'SABE', 1.2, 'LV-XYZ'),
    vuelo('SADF', 'SABE', 0.8, 'LV-ABC'), // repetida: no debe duplicarse
  ];
  const rutas = calcularRutasFrecuentes(vuelos);
  // Los arrays que salen del sandbox de loadApp son de otro "realm" — deepEqual
  // los compara por estructura pero falla la referencia; comparamos como JSON.
  assert.equal(JSON.stringify(rutas[0].matriculas.sort()), JSON.stringify(['LV-ABC', 'LV-XYZ']));
});

test('calcularRutasFrecuentes: duracionMedia es el promedio de tiempo_total de la ruta', () => {
  const vuelos = [vuelo('SADF', 'SABE', 1), vuelo('SADF', 'SABE', 2)];
  const rutas = calcularRutasFrecuentes(vuelos);
  assert.equal(rutas[0].duracionMedia, 1.5);
});

test('distanciaKm: SADF a SABE da un valor chico y positivo (aeródromos cercanos, mismo AMBA)', () => {
  // SADF (San Fernando) y SABE (Aeroparque) están a ~15km en línea recta.
  const km = distanciaKm(-34.4532, -58.5896, -34.5592, -58.4156);
  assert.ok(km > 10 && km < 25, `esperaba entre 10 y 25km, dio ${km}`);
});

test('distanciaKm: mismo punto da 0', () => {
  assert.equal(distanciaKm(-34.5, -58.5, -34.5, -58.5), 0);
});

test('fmtDuracionHhMm: convierte horas.décimos a HH:MM', () => {
  assert.equal(fmtDuracionHhMm(1.75), '01:45');
  assert.equal(fmtDuracionHhMm(0.5), '00:30');
  assert.equal(fmtDuracionHhMm(2), '02:00');
});
