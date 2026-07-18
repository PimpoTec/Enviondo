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
// El usuario nunca carga plata a mano.
function calcularCosto(vuelo, aeronave) {
  if (!aeronave) return 0;
  const { total_dia, total_noche } = calcularTotales(vuelo);
  return round2(
    total_dia * n(aeronave.tarifa_hora_diurna) +
    total_noche * n(aeronave.tarifa_hora_nocturna)
  );
}

function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
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

// Diferencia en horas.décimos entre dos horarios HH:MM, contemplando
// vuelos que cruzan medianoche.
function horasEntre(horaSalida, horaLlegada) {
  if (!horaSalida || !horaLlegada) return 0;
  const [hs, ms] = horaSalida.split(':').map(Number);
  const [hl, ml] = horaLlegada.split(':').map(Number);
  let minutos = (hl * 60 + ml) - (hs * 60 + ms);
  if (minutos < 0) minutos += 24 * 60; // cruzó medianoche
  return round2(minutos / 60);
}

window.Calc = {
  CAMPOS_TIEMPO, CAMPOS_DISCRIMINACION,
  n, round2, calcularTotales, calcularCosto, repartirModoRapido, horasEntre,
};
