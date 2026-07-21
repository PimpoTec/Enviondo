const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([
  path.join(ROOT, 'js/calc.js'),
  path.join(ROOT, 'js/views/totales.js'),
]);
const { calcularFrecuenciaAerodromos, calcularRutasFrecuentes, distanciaNm, fmtDuracionHhMm } = window;

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

test('distanciaNm: SADF a SABE da un valor chico y positivo (aeródromos cercanos, mismo AMBA)', () => {
  // SADF (San Fernando) y SABE (Aeroparque) están a ~8nm en línea recta (~15km).
  const nm = distanciaNm(-34.4532, -58.5896, -34.5592, -58.4156);
  assert.ok(nm > 5 && nm < 14, `esperaba entre 5 y 14nm, dio ${nm}`);
});

test('distanciaNm: mismo punto da 0', () => {
  assert.equal(distanciaNm(-34.5, -58.5, -34.5, -58.5), 0);
});

test('fmtDuracionHhMm: convierte horas.décimos a HH:MM', () => {
  assert.equal(fmtDuracionHhMm(1.75), '01:45');
  assert.equal(fmtDuracionHhMm(0.5), '00:30');
  assert.equal(fmtDuracionHhMm(2), '02:00');
});

// ---- Normalización de código (local/OACI/IATA → canónico) — evita que un
// mismo aeródromo quede partido en dos en las estadísticas según con qué
// código haya quedado guardado cada vuelo (ver window.CODIGO_CANONICO). ----

test('calcularFrecuenciaAerodromos: normaliza el código local al canónico (OACI) antes de contar', () => {
  window.CODIGO_CANONICO = { MOR: 'SADM' };
  const f = calcularFrecuenciaAerodromos([vuelo('SADF', 'MOR'), vuelo('SADF', 'SADM')]);
  assert.equal(f.SADM, 2); // "MOR" y "SADM" cuentan como el mismo aeródromo
  assert.equal(f.MOR, undefined);
  delete window.CODIGO_CANONICO;
});

test('calcularRutasFrecuentes: junta la misma ruta aunque un vuelo use el código local y otro el OACI', () => {
  window.CODIGO_CANONICO = { MOR: 'SADM' };
  const vuelos = [vuelo('SADF', 'MOR', 1), vuelo('SADF', 'SADM', 1)];
  const rutas = calcularRutasFrecuentes(vuelos);
  assert.equal(rutas.length, 1);
  assert.equal(rutas[0].count, 2);
  delete window.CODIGO_CANONICO;
});

test('calcularFrecuenciaAerodromos: sin CODIGO_CANONICO (o código desconocido), usa el código tal cual', () => {
  const f = calcularFrecuenciaAerodromos([vuelo('SADF', 'ZZZZ')]);
  assert.equal(f.ZZZZ, 1);
  assert.equal(f.SADF, 1);
});

test('calcularFrecuenciaAerodromos: TERR (turno de adiestrador/simulador) no cuenta como aeródromo', () => {
  const f = calcularFrecuenciaAerodromos([vuelo('TERR', 'TERR')]);
  assert.deepEqual(Object.keys(f), []);
});

test('calcularRutasFrecuentes: TERR no genera ninguna ruta', () => {
  const rutas = calcularRutasFrecuentes([vuelo('TERR', 'TERR')]);
  assert.equal(rutas.length, 0);
});
