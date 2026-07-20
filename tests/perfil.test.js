const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
// perfil.js define estadoVencimiento() al tope; necesita Calc (parseFechaLocal).
const { window } = loadApp([path.join(ROOT, 'js/calc.js'), path.join(ROOT, 'js/views/perfil.js')]);
const { estadoVencimiento } = window;

// Fecha local (YYYY-MM-DD) a N días de hoy, para tests deterministas.
function iso(offsetDias) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offsetDias);
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
