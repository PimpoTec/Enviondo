const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
// perfil.js define estadoVencimiento() al tope; necesita Calc (parseFechaLocal).
const { window } = loadApp([path.join(ROOT, 'js/calc.js'), path.join(ROOT, 'js/views/perfil.js')]);
const { estadoVencimiento, calcularVentanaCurrency, calcularEstadoHabilitacion } = window;

// Fecha local (YYYY-MM-DD) a N días de hoy, para tests deterministas.
function iso(offsetDias) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Fecha local a N meses de hoy (negativo = pasado), para los escenarios de
// repaso de vuelo / inactividad (ventanas de 24 meses).
function isoMeses(offsetMeses) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() + offsetMeses);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('estadoVencimiento: fecha pasada => vencido (danger)', () => {
  const r = estadoVencimiento({ fecha_vencimiento: iso(-5) });
  assert.equal(r.estado, 'danger');
  assert.match(r.texto, /Vencido hace 5 días/);
});

test('estadoVencimiento: dentro del umbral => por vencer (warn)', () => {
  const r = estadoVencimiento({ fecha_vencimiento: iso(10), umbral_alerta_dias: 30 });
  assert.equal(r.estado, 'warn');
  assert.match(r.texto, /Vence en 10 días/);
});

test('estadoVencimiento: lejos en el futuro => vigente (ok)', () => {
  const r = estadoVencimiento({ fecha_vencimiento: iso(100), umbral_alerta_dias: 30 });
  assert.equal(r.estado, 'ok');
});

test('estadoVencimiento: vence hoy cae dentro del umbral (warn)', () => {
  const r = estadoVencimiento({ fecha_vencimiento: iso(0), umbral_alerta_dias: 30 });
  assert.equal(r.estado, 'warn');
  assert.match(r.texto, /Vence en 0 días/);
});

test('estadoVencimiento: umbral por defecto 30 cuando no se especifica', () => {
  assert.equal(estadoVencimiento({ fecha_vencimiento: iso(20) }).estado, 'warn');
  assert.equal(estadoVencimiento({ fecha_vencimiento: iso(40) }).estado, 'ok');
});

// ---- calcularVentanaCurrency: 90 días general, 180 para PPA/Planeador ----

test('calcularVentanaCurrency: PCA (comercial) usa 90 días', () => {
  assert.equal(calcularVentanaCurrency(['PCA']), 90);
});

test('calcularVentanaCurrency: PPA (privado) usa 180 días', () => {
  assert.equal(calcularVentanaCurrency(['PPA']), 180);
});

test('calcularVentanaCurrency: APPL (planeador) usa 180 días', () => {
  assert.equal(calcularVentanaCurrency(['APPL']), 180);
});

test('calcularVentanaCurrency: con PPA y PCA_HVI activos a la vez, gana el más estricto (90)', () => {
  assert.equal(calcularVentanaCurrency(['PPA', 'PCA_HVI']), 90);
});

test('calcularVentanaCurrency: sin cursos activos o cursos sin ventana propia, default 90', () => {
  assert.equal(calcularVentanaCurrency([]), 90);
  assert.equal(calcularVentanaCurrency(['HAB_NOC']), 90);
});

// ---- calcularEstadoHabilitacion: flujograma de la Guía RAAC Parte 61 ----

function vuelo(fecha, over = {}) {
  return { fecha, aterrizajes_dia: 0, aterrizajes_noche: 0, ...over };
}

test('calcularEstadoHabilitacion: sin repaso de vuelo cargado, pide cargarlo (neutral)', () => {
  const r = calcularEstadoHabilitacion({ repasoVuelo: null, vuelos: [vuelo(iso(-10))], diasVentanaCurrency: 90 });
  assert.equal(r.nivel, 'neutral');
});

test('calcularEstadoHabilitacion: repaso de vuelo vencido, no podés volar solo (danger)', () => {
  const r = calcularEstadoHabilitacion({
    repasoVuelo: { fecha_vencimiento: iso(-5) },
    vuelos: [vuelo(iso(-10))],
    diasVentanaCurrency: 90,
  });
  assert.equal(r.nivel, 'danger');
  assert.match(r.titulo, /No podés volar solo/);
});

test('calcularEstadoHabilitacion: repaso vigente y experiencia reciente cumplida => ok', () => {
  const r = calcularEstadoHabilitacion({
    repasoVuelo: { fecha_vencimiento: iso(300) },
    vuelos: [vuelo(iso(-5), { aterrizajes_dia: 3 }), vuelo(iso(-10), { aterrizajes_noche: 3 })],
    diasVentanaCurrency: 90,
  });
  assert.equal(r.nivel, 'ok');
});

test('calcularEstadoHabilitacion: repaso vigente pero sin experiencia reciente => auto-reentrenamiento (warn)', () => {
  const r = calcularEstadoHabilitacion({
    repasoVuelo: { fecha_vencimiento: iso(300) },
    vuelos: [vuelo(iso(-5), { aterrizajes_dia: 1 })],
    diasVentanaCurrency: 90,
  });
  assert.equal(r.nivel, 'warn');
  assert.match(r.titulo, /Auto-reentrenamiento/);
});

test('calcularEstadoHabilitacion: más de 24 meses sin volar nada => pérdida total (danger), aunque el repaso "diga" vigente', () => {
  const r = calcularEstadoHabilitacion({
    repasoVuelo: { fecha_vencimiento: iso(300) },
    vuelos: [vuelo(isoMeses(-30))],
    diasVentanaCurrency: 90,
  });
  assert.equal(r.nivel, 'danger');
  assert.match(r.titulo, /Atribuciones perdidas/);
});

test('calcularEstadoHabilitacion: sin vuelos cargados nunca, no dispara la inactividad de 24 meses (no hay de qué inactividad hablar)', () => {
  const r = calcularEstadoHabilitacion({ repasoVuelo: null, vuelos: [], diasVentanaCurrency: 90 });
  assert.equal(r.nivel, 'neutral');
});
