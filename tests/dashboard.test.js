const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([
  path.join(ROOT, 'js/calc.js'),
  path.join(ROOT, 'js/views/dashboard.js'),
]);
const { valorNocturnasAjustado, calcularProgresoPonderado } = window;

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
