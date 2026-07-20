const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([path.join(ROOT, 'js/calc.js')]);
const { Calc } = window;

test('calcularTotales suma los 8 buckets en los totales correctos', () => {
  const t = Calc.calcularTotales({
    saero_dia_piloto: 1, saero_dia_copiloto: 0.5,
    saero_noche_piloto: 0.2, saero_noche_copiloto: 0,
    trav_dia_piloto: 2, trav_dia_copiloto: 0,
    trav_noche_piloto: 0.3, trav_noche_copiloto: 0,
  });
  assert.equal(t.tiempo_total, 4);
  assert.equal(t.total_dia, 3.5);
  assert.equal(t.total_noche, 0.5);
  assert.equal(t.total_pic, 3.5); // saero_dia_piloto + saero_noche_piloto + trav_dia_piloto + trav_noche_piloto
  assert.equal(t.total_travesia, 2.3);
});

test('calcularCosto: día y noche a tarifas distintas, simulador aparte', () => {
  const aeronave = { tarifa_hora_diurna: 100, tarifa_hora_nocturna: 150 };
  const costo = Calc.calcularCosto({ saero_dia_piloto: 2, saero_noche_piloto: 1 }, aeronave);
  assert.equal(costo, 350); // 2*100 + 1*150

  const simulador = { es_simulador: true, tarifa_hora_diurna: 80, tarifa_hora_nocturna: 80 };
  const costoSim = Calc.calcularCosto({ adiestrador_simulador: 1.5 }, simulador);
  assert.equal(costoSim, 120); // 1.5 * 80, sin importar tarifa_hora_nocturna
});

test('calcularCosto sin aeronave devuelve 0, no rompe', () => {
  assert.equal(Calc.calcularCosto({ saero_dia_piloto: 5 }, null), 0);
});

test('repartirModoRapido: local de día, PIC', () => {
  const out = Calc.repartirModoRapido({ tiempoTotal: 1.5, esTravesia: false, esPiloto: true, horasNoche: 0 });
  assert.equal(out.saero_dia_piloto, 1.5);
  assert.equal(out.saero_noche_piloto, 0);
  assert.equal(out.trav_dia_piloto, 0);
});

test('repartirModoRapido: travesía de noche, copiloto', () => {
  const out = Calc.repartirModoRapido({ tiempoTotal: 2, esTravesia: true, esPiloto: false, horasNoche: 2 });
  assert.equal(out.trav_noche_copiloto, 2);
  assert.equal(out.trav_dia_copiloto, 0);
});

test('repartirModoRapido: horasNoche nunca supera el total', () => {
  const out = Calc.repartirModoRapido({ tiempoTotal: 1, esTravesia: false, esPiloto: true, horasNoche: 5 });
  assert.equal(out.saero_noche_piloto, 1);
  assert.equal(out.saero_dia_piloto, 0);
});

test('repartirModoRapido: travesía con parte de día y parte de noche, PIC', () => {
  const out = Calc.repartirModoRapido({ tiempoTotal: 2.5, esTravesia: true, esPiloto: true, horasNoche: 1 });
  assert.equal(out.trav_dia_piloto, 1.5); // 2.5 - 1
  assert.equal(out.trav_noche_piloto, 1);
  assert.equal(out.saero_dia_piloto, 0); // nada cae en "sobre aeródromo"
});

test('horasEntre: vuelo normal dentro del mismo día', () => {
  assert.equal(Calc.horasEntre('10:00', '11:30'), 1.5);
});

test('horasEntre: cruza medianoche', () => {
  assert.equal(Calc.horasEntre('23:00', '01:00'), 2);
});

test('horasEntre: sin horarios devuelve 0', () => {
  assert.equal(Calc.horasEntre('', ''), 0);
  assert.equal(Calc.horasEntre(null, '10:00'), 0);
});

test('horasEntre: usa el cuadro centésimal, no minutos/60', () => {
  assert.equal(Calc.horasEntre('10:00', '11:20'), 1.3); // 1h20m: 20 min → 0.3 (no 1.33)
  assert.equal(Calc.horasEntre('10:00', '10:15'), 0.3); // 15 min → 0.3
  assert.equal(Calc.horasEntre('10:00', '10:58'), 1.0); // 58 min → añade hora
  assert.equal(Calc.horasEntre('08:10', '09:37'), 1.5); // 1h27m: 27 min → 0.5
});

test('minutosADecimo: bordes de los tramos del cuadro', () => {
  assert.equal(Calc.minutosADecimo(2), 0.0);
  assert.equal(Calc.minutosADecimo(3), 0.1);
  assert.equal(Calc.minutosADecimo(20), 0.3);
  assert.equal(Calc.minutosADecimo(21), 0.4);
  assert.equal(Calc.minutosADecimo(57), 0.9);
  assert.equal(Calc.minutosADecimo(58), 1.0);
  assert.equal(Calc.minutosADecimo(60), 1.0);
});

test('minutosAHoras: horas enteras + décimo del tramo', () => {
  assert.equal(Calc.minutosAHoras(60), 1.0);
  assert.equal(Calc.minutosAHoras(80), 1.3);   // 1h20m
  assert.equal(Calc.minutosAHoras(118), 2.0);  // 1h58m → añade hora
  assert.equal(Calc.minutosAHoras(0), 0);
});
