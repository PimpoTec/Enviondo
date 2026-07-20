// ============================================================================
// CÁLCULO — reglas del formato ANAC 290/2012
// Los 8 campos de tiempo son buckets EXCLUYENTES. Las "discriminaciones"
// (multimotor, reactor, instrucción, instrumentos, etc.) están comprendidas
// DENTRO de esos tiempos y NUNCA se suman aparte al total general.
// ============================================================================

const CAMPOS_TIEMPO = [
  'saero_dia_piloto', 'saero_dia_copiloto',
  'saero_noche_piloto', 'saero_noche_copiloto',
  'trav_dia_piloto', 'trav_dia_copiloto',
  'trav_noche_piloto', 'trav_noche_copiloto',
];

const CAMPOS_DISCRIMINACION = [
  'instruccion_vuelo', 'multimotor', 'reactor', 'turbohelice',
  'aeroaplicador', 'instrumentos_real', 'instrumentos_capota',
  'adiestrador_simulador',
];

function n(v) {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : 0;
}

function calcularTotales(vuelo) {
  const t = Object.fromEntries(CAMPOS_TIEMPO.map((c) => [c, n(vuelo[c])]));
  const tiempo_total =
    t.saero_dia_piloto + t.saero_dia_copiloto +
    t.saero_noche_piloto + t.saero_noche_copiloto +
    t.trav_dia_piloto + t.trav_dia_copiloto +
    t.trav_noche_piloto + t.trav_noche_copiloto;

  const total_dia = t.saero_dia_piloto + t.saero_dia_copiloto + t.trav_dia_piloto + t.trav_dia_copiloto;
  const total_noche = t.saero_noche_piloto + t.saero_noche_copiloto + t.trav_noche_piloto + t.trav_noche_copiloto;
  const total_pic = t.saero_dia_piloto + t.saero_noche_piloto + t.trav_dia_piloto + t.trav_noche_piloto;
  const total_copiloto = t.saero_dia_copiloto + t.saero_noche_copiloto + t.trav_dia_copiloto + t.trav_noche_copiloto;
  const total_travesia = t.trav_dia_piloto + t.trav_dia_copiloto + t.trav_noche_piloto + t.trav_noche_copiloto;

  return { tiempo_total, total_dia, total_noche, total_pic, total_copiloto, total_travesia };
}

// Costo = horas de día * tarifa diurna + horas de noche * tarifa nocturna.
// Para simuladores (turnos de adiestrador terrestre) no hay buckets de
// tiempo de vuelo, así que el costo sale de las horas de adiestrador por
// la tarifa del simulador. El usuario nunca carga plata a mano.
function calcularCosto(vuelo, aeronave) {
  if (!aeronave) return 0;
  if (aeronave.es_simulador) {
    return round2(n(vuelo.adiestrador_simulador) * n(aeronave.tarifa_hora_diurna));
  }
  const { total_dia, total_noche } = calcularTotales(vuelo);
  return round2(
    total_dia * n(aeronave.tarifa_hora_diurna) +
    total_noche * n(aeronave.tarifa_hora_nocturna)
  );
}

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

// Costo a mostrar/sumar para un vuelo ya guardado. Si el vuelo trae un costo
// congelado (importe en ARS clavado al cargarlo, ej. convertido del dólar
// blue del día), se usa ese —así el gasto histórico no se mueve aunque cambie
// el dólar o la tarifa—. Si no (vuelos viejos), se calcula al vuelo con la
// tarifa de la aeronave, como antes. Devuelve { monto, moneda }.
function costoRegistrado(vuelo, aeronave) {
  const congelado = vuelo ? Number(vuelo.costo_congelado) : NaN;
  if (Number.isFinite(congelado)) return { monto: round2(congelado), moneda: 'ARS', congelado: true };
  return { monto: calcularCosto(vuelo, aeronave), moneda: (aeronave && aeronave.moneda) || 'ARS', congelado: false };
}

// Parsea 'YYYY-MM-DD' como fecha LOCAL a medianoche. Evita el bug de
// new Date('2026-01-01'), que la interpreta como UTC y puede correrse un día
// al comparar contra new Date() (hora local) según el huso del usuario.
function parseFechaLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Reparte un tiempo total día/noche entre los 8 campos, según:
// - esLocal (aeródromo) o travesía
// - esPiloto (PIC) o copiloto
// - horasNoche (parte del total que fue de noche; el resto es de día)
function repartirModoRapido({ tiempoTotal, esTravesia, esPiloto, horasNoche }) {
  const total = n(tiempoTotal);
  let hn = Math.min(n(horasNoche), total);
  let hd = round2(total - hn);
  hn = round2(hn);

  const prefijo = esTravesia ? 'trav' : 'saero';
  const rol = esPiloto ? 'piloto' : 'copiloto';

  const out = Object.fromEntries(CAMPOS_TIEMPO.map((c) => [c, 0]));
  out[`${prefijo}_dia_${rol}`] = hd;
  out[`${prefijo}_noche_${rol}`] = hn;
  return out;
}

// Convierte los minutos sueltos (0 a 60) de una hora al décimo que
// corresponde según el "Cuadro de horas centésimales" que se usa en el libro
// de vuelo — NO es minutos/60. Los tramos son fijos: p. ej. 15 a 20 min = 0.3,
// y de 58 a 60 se suma una hora entera (1.0).
function minutosADecimo(min) {
  if (min <= 2) return 0.0;
  if (min <= 8) return 0.1;
  if (min <= 14) return 0.2;
  if (min <= 20) return 0.3;
  if (min <= 26) return 0.4;
  if (min <= 33) return 0.5;
  if (min <= 39) return 0.6;
  if (min <= 45) return 0.7;
  if (min <= 51) return 0.8;
  if (min <= 57) return 0.9;
  return 1.0; // 58 a 60 → añade hora
}

// Total de minutos → horas.décimos usando el cuadro centésimal (horas enteras
// tal cual, y los minutos sueltos convertidos por tramo).
function minutosAHoras(minutos) {
  const m = Math.max(0, Math.round(minutos));
  const horas = Math.floor(m / 60);
  return round2(horas + minutosADecimo(m % 60));
}

// Tiempo de vuelo entre dos horarios HH:MM, contemplando vuelos que cruzan
// medianoche. Devuelve horas.décimos según el cuadro centésimal.
function horasEntre(horaSalida, horaLlegada) {
  if (!horaSalida || !horaLlegada) return 0;
  const [hs, ms] = horaSalida.split(':').map(Number);
  const [hl, ml] = horaLlegada.split(':').map(Number);
  let minutos = (hl * 60 + ml) - (hs * 60 + ms);
  if (minutos < 0) minutos += 24 * 60; // cruzó medianoche
  return minutosAHoras(minutos);
}

window.Calc = {
  CAMPOS_TIEMPO, CAMPOS_DISCRIMINACION,
  n, round2, calcularTotales, calcularCosto, costoRegistrado, parseFechaLocal,
  repartirModoRapido, horasEntre, minutosADecimo, minutosAHoras,
};
