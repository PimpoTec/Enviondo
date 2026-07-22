const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([
  path.join(ROOT, 'js/calc.js'),
  path.join(ROOT, 'js/views/totales.js'), // define distanciaNm, que usa _buscarMetarCercano
  path.join(ROOT, 'js/views/dashboard.js'),
]);
const { valorNocturnasAjustado, calcularProgresoPonderado, ViewDashboard, _buscarMetarCercano } = window;
window.SUPABASE_CONFIG = { url: 'https://x.test' };
window.METAR_FN_SLUG = 'metar';

// _urlCalendarioProgramado no depende de nada más de dashboard.js, pero sí
// de un global que normalmente pone js/app.js (obtenerPrefHorario) — se
// stubea acá antes de cada test para poder probar las dos preferencias.
ViewDashboard.aeronaves = [{ id: 'a1', matricula: 'LV-ABC' }];

test('valorNocturnasAjustado: sin HAB_NOC activo, usa las horas nocturnas tal cual', () => {
  const agg = { total_noche: 4.5 };
  const configsPorCurso = [{ cursoId: 'PCA', config: [{ nombre_requisito: 'nocturnas', minimo_horas: 5 }] }];
  assert.equal(valorNocturnasAjustado('PCA', agg, configsPorCurso), 4.5);
});

test('valorNocturnasAjustado: con HAB_NOC, las primeras horas van a completarlo', () => {
  const agg = { total_noche: 1.2 };
  const configsPorCurso = [
    { cursoId: 'PCA', config: [{ nombre_requisito: 'nocturnas', minimo_horas: 5 }] },
    { cursoId: 'HAB_NOC', config: [{ nombre_requisito: 'nocturnas', minimo_horas: 3 }] },
  ];
  // Todavía no completó las 3 hs de HAB_NOC (1.2 < 3): PCA no ve nada todavía.
  assert.equal(valorNocturnasAjustado('HAB_NOC', agg, configsPorCurso), 1.2);
  assert.equal(valorNocturnasAjustado('PCA', agg, configsPorCurso), 0);
});

test('valorNocturnasAjustado: una vez completo HAB_NOC, el resto cuenta para el otro curso', () => {
  const agg = { total_noche: 4.5 };
  const configsPorCurso = [
    { cursoId: 'PCA', config: [{ nombre_requisito: 'nocturnas', minimo_horas: 5 }] },
    { cursoId: 'HAB_NOC', config: [{ nombre_requisito: 'nocturnas', minimo_horas: 3 }] },
  ];
  assert.equal(valorNocturnasAjustado('HAB_NOC', agg, configsPorCurso), 3); // capado en su propio mínimo
  assert.equal(valorNocturnasAjustado('PCA', agg, configsPorCurso), 1.5); // 4.5 - 3
});

test('calcularProgresoPonderado: un curso grande casi completo no lo hunde uno chico recién empezado', () => {
  // Caso real que generó el bug original: PCA 185/200 (92.5%) + HAB_NOC recién
  // empezando no debería dar ~60% (promedio simple de %) sino ~91.6% (ponderado).
  const porCurso = [
    { actual: 185, minimo: 200 },
    { actual: 0, minimo: 3 },
  ];
  assert.equal(calcularProgresoPonderado(porCurso), 91.13);
});

test('calcularProgresoPonderado: un solo curso da su propio %', () => {
  assert.equal(calcularProgresoPonderado([{ actual: 50, minimo: 100 }]), 50);
});

test('calcularProgresoPonderado: se cappea en 100% aunque algún curso esté sobrecumplido', () => {
  const porCurso = [{ actual: 250, minimo: 200 }, { actual: 3, minimo: 3 }];
  assert.equal(calcularProgresoPonderado(porCurso), 100);
});

test('calcularProgresoPonderado: sin cursos con mínimo, da 0 en vez de NaN', () => {
  assert.equal(calcularProgresoPonderado([]), 0);
});

// ---- _urlCalendarioProgramado: link de "Agregar a Google Calendar" para
// un vuelo agendado, sin OAuth — ver comentario en dashboard.js. ----

test('_urlCalendarioProgramado: con hora prevista (pref UTC) y sin hora de fin, dura 1 hora', () => {
  window.obtenerPrefHorario = () => 'utc';
  const p = { fecha: '2026-08-10', hora_prevista: '14:30:00', hora_finalizacion: null, aeronave_id: 'a1', desde: 'SADF', hasta: 'SACO' };
  const url = new URL(ViewDashboard._urlCalendarioProgramado(p));
  assert.equal(url.searchParams.get('dates'), '20260810T143000Z/20260810T153000Z');
  assert.equal(url.searchParams.get('text'), 'Vuelo LV-ABC — SADF → SACO');
  assert.equal(url.searchParams.get('location'), 'SADF → SACO');
});

test('_urlCalendarioProgramado: respeta la hora de finalización si está cargada', () => {
  window.obtenerPrefHorario = () => 'utc';
  const p = { fecha: '2026-08-10', hora_prevista: '14:30:00', hora_finalizacion: '18:00:00', aeronave_id: 'a1' };
  const url = new URL(ViewDashboard._urlCalendarioProgramado(p));
  assert.equal(url.searchParams.get('dates'), '20260810T143000Z/20260810T180000Z');
});

test('_urlCalendarioProgramado: con preferencia "Hora local" (ART, UTC-3), convierte bien a UTC', () => {
  process.env.TZ = 'America/Argentina/Buenos_Aires';
  window.obtenerPrefHorario = () => 'local';
  const p = { fecha: '2026-08-10', hora_prevista: '14:30:00', hora_finalizacion: null, aeronave_id: 'a1' };
  const url = new URL(ViewDashboard._urlCalendarioProgramado(p));
  assert.equal(url.searchParams.get('dates'), '20260810T173000Z/20260810T183000Z');
  process.env.TZ = 'UTC';
});

test('_urlCalendarioProgramado: sin hora prevista, es un evento de todo el día', () => {
  window.obtenerPrefHorario = () => 'utc';
  const p = { fecha: '2026-08-10', hora_prevista: null, hora_finalizacion: null, aeronave_id: 'a1' };
  const url = new URL(ViewDashboard._urlCalendarioProgramado(p));
  assert.equal(url.searchParams.get('dates'), '20260810/20260811');
});

test('_urlCalendarioProgramado: vuelo local (mismo aeródromo) muestra un solo código, no una flecha', () => {
  window.obtenerPrefHorario = () => 'utc';
  const p = { fecha: '2026-08-10', hora_prevista: '10:00:00', aeronave_id: 'a1', desde: 'SADF', hasta: 'SADF' };
  const url = new URL(ViewDashboard._urlCalendarioProgramado(p));
  assert.equal(url.searchParams.get('location'), 'SADF');
});

// ---- _buscarMetarCercano: si el aeródromo pedido no tiene METAR/TAF, busca
// el más cercano (con código OACI) que sí tenga — ver dashboard.js. ----

// Set de aeródromos sintético (no el dataset real) para que la distancia y
// el orden de candidatos sean deterministas: ORIG en el origen, A/B/C cada
// vez más lejos en línea recta (mismo meridiano, separados 1° de latitud
// ≈ 60nm cada uno).
function armarAerodromosSinteticos() {
  window.COORDENADAS_AERODROMO = { ORIG: [0, 0], AAAA: [-1, 0], BBBB: [-2, 0], CCCC: [-3, 0] };
  window.AERODROMOS = [
    { code: 'ORIG', icao: 'ORIG' }, { code: 'AAAA', icao: 'AAAA' },
    { code: 'BBBB', icao: 'BBBB' }, { code: 'CCCC', icao: 'CCCC' },
  ];
}
function mockFetchConDatosEn(icaosConDatos) {
  window.fetch = async (url) => {
    const icao = new URL(url).searchParams.get('icao') || (url.match(/ids=([A-Z]{4})/) || [])[1];
    return { ok: true, text: async () => (icaosConDatos.has(icao) ? `METAR de prueba ${icao}` : '') };
  };
}

test('_buscarMetarCercano: salta el más cercano sin datos y devuelve el siguiente que sí tiene', async () => {
  armarAerodromosSinteticos();
  mockFetchConDatosEn(new Set(['BBBB'])); // AAAA (más cerca) no tiene, BBBB sí
  const r = await _buscarMetarCercano('ORIG', 'metar');
  assert.equal(r.icao, 'BBBB');
  assert.equal(r.nm, 120); // 2° de latitud ≈ 120nm
  assert.match(r.texto, /BBBB/);
});

test('_buscarMetarCercano: ninguno de los candidatos tiene datos → null', async () => {
  armarAerodromosSinteticos();
  mockFetchConDatosEn(new Set());
  const r = await _buscarMetarCercano('ORIG', 'metar');
  assert.equal(r, null);
});

test('_buscarMetarCercano: sin coordenadas del aeródromo pedido, no intenta nada → null', async () => {
  window.COORDENADAS_AERODROMO = {};
  window.AERODROMOS = [];
  let llamadas = 0;
  window.fetch = async () => { llamadas++; return { ok: true, text: async () => '' }; };
  const r = await _buscarMetarCercano('DESCONOCIDO', 'metar');
  assert.equal(r, null);
  assert.equal(llamadas, 0);
});

test('_buscarMetarCercano: respeta el tope de candidatos (no busca más allá)', async () => {
  armarAerodromosSinteticos();
  mockFetchConDatosEn(new Set(['CCCC'])); // el más lejos de los 3 sintéticos
  const r = await _buscarMetarCercano('ORIG', 'metar', 2); // tope 2: solo llegan AAAA y BBBB
  assert.equal(r, null);
});
