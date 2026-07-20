const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([path.join(ROOT, 'js/recordatorios.js')]);
const { labelRecordatorio, fmtFechaHoraRecordatorio } = window;

test('labelRecordatorio: dias_antes', () => {
  assert.equal(labelRecordatorio({ tipo_disparo: 'dias_antes', valor: 10 }), '10 día(s) antes');
});

test('labelRecordatorio: horas_antes', () => {
  assert.equal(labelRecordatorio({ tipo_disparo: 'horas_antes', valor: 3 }), '3 hora(s) antes');
});

test('labelRecordatorio: fecha_hora usa fmtFechaHoraRecordatorio', () => {
  const iso = '2026-08-15T12:30:00.000Z';
  const r = labelRecordatorio({ tipo_disparo: 'fecha_hora', fecha_hora: iso });
  assert.equal(r, `El ${fmtFechaHoraRecordatorio(iso)}`);
  assert.match(r, /^El /);
});

test('fmtFechaHoraRecordatorio: sin fecha devuelve guion', () => {
  assert.equal(fmtFechaHoraRecordatorio(null), '—');
});
