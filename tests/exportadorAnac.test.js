const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
// No requiere ExcelJS: solo testea el mapeo de datos (valorCelda) y los
// helpers puros (sumarColumnas, agruparPorAnio).
const { window } = loadApp([path.join(ROOT, 'js/calc.js'), path.join(ROOT, 'js/exportadorAnac.js')]);
const { ExportadorAnac } = window;

function vueloBase(extra = {}) {
  return Object.assign({
    fecha: '2025-03-05', hora_salida_utc: '12:00:00', hora_llegada_utc: '13:30:00',
    desde: 'SABE', hasta: 'SABE', finalidad_vuelo: 'INST',
    aeronaves: { marca_modelo: 'Cessna 152', matricula: 'LV-ABC', potencia: '110 HP', clase: 'monomotor' },
    saero_dia_piloto: 1.5, saero_dia_copiloto: 0, saero_noche_piloto: 0, saero_noche_copiloto: 0,
    trav_dia_piloto: 0, trav_dia_copiloto: 0, trav_noche_piloto: 0, trav_noche_copiloto: 0,
    aterrizajes_dia: 2, aterrizajes_noche: 0, instruccion_vuelo: 1.5,
    instructor_nombre: 'Juan Instructor', tiempo_total: 1.5,
  }, extra);
}

test('valorCelda: vuelo local muestra el aeródromo una sola vez (no doblado)', () => {
  const v = vueloBase({ desde: 'SABE', hasta: 'SABE' });
  assert.equal(ExportadorAnac.valorCelda(4, v), 'SABE');
});

test('valorCelda: travesía muestra origen-destino', () => {
  const v = vueloBase({ desde: 'SABE', hasta: 'SADF' });
  assert.equal(ExportadorAnac.valorCelda(4, v), 'SABE-SADF');
});

test('valorCelda: clase de aeronave se abrevia (evita texto cortado en columna angosta)', () => {
  assert.equal(ExportadorAnac.valorCelda(10, vueloBase({ aeronaves: { clase: 'monomotor' } })), 'MONOM.');
  assert.equal(ExportadorAnac.valorCelda(10, vueloBase({ aeronaves: { clase: 'multimotor' } })), 'MULTIM.');
  assert.equal(ExportadorAnac.valorCelda(10, vueloBase({ aeronaves: { clase: 'aeroaplicador' } })), 'AEROAP.');
});

test('valorCelda: clase tolera mayúsculas/espacios (no rompe el mapeo)', () => {
  assert.equal(ExportadorAnac.valorCelda(10, vueloBase({ aeronaves: { clase: ' Monomotor ' } })), 'MONOM.');
  assert.equal(ExportadorAnac.valorCelda(10, vueloBase({ aeronaves: { clase: '' } })), '');
});

test('valorCelda: turno de adiestrador/simulador (col 29) suma sus horas', () => {
  const v = vueloBase({ desde: 'TERR', hasta: 'TERR', adiestrador_simulador: 1.0, saero_dia_piloto: 0 });
  assert.equal(ExportadorAnac.valorCelda(29, v), 1);
});

test('COLS_ACUM incluye todas las columnas numéricas de la plantilla (incluido adiestrador, col 29)', () => {
  assert.equal(ExportadorAnac.COLS_ACUM.includes(29), true);
  assert.equal(ExportadorAnac.COLS_ACUM.includes(11), true);
});

test('sumarColumnas: suma el tiempo de vuelo (col 11) de varios vuelos', () => {
  const vuelos = [vueloBase({ saero_dia_piloto: 1.5 }), vueloBase({ saero_dia_piloto: 2.0 })];
  const sumas = ExportadorAnac.sumarColumnas(vuelos);
  assert.equal(sumas[11], 3.5);
});

test('sumarColumnas: incluye las horas de adiestrador de turnos TERR-TERR', () => {
  const vuelos = [vueloBase({ desde: 'TERR', hasta: 'TERR', saero_dia_piloto: 0, adiestrador_simulador: 2.0 })];
  const sumas = ExportadorAnac.sumarColumnas(vuelos);
  assert.equal(sumas[29], 2);
});

test('agruparPorAnio: agrupa por el año de la fecha', () => {
  const vuelos = [vueloBase({ fecha: '2025-01-10' }), vueloBase({ fecha: '2026-02-01' })];
  const porAnio = ExportadorAnac.agruparPorAnio(vuelos);
  assert.deepEqual(Object.keys(porAnio).sort(), ['2025', '2026']);
});
