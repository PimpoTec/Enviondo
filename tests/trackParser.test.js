const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadApp } = require('./_helpers/loadApp');

const ROOT = path.join(__dirname, '..');
const { window } = loadApp([path.join(ROOT, 'js/trackParser.js')]);
const { parsearTrackCsv, parsearTrackKml, parsearArchivoTrack, limitarPuntosTrack } = window.TrackParser;

// Los arrays que salen del sandbox de loadApp son de otro "realm" — deepEqual
// los compara por estructura pero falla la referencia; comparamos como JSON.
function assertPuntos(actual, esperado) {
  assert.equal(JSON.stringify(actual), JSON.stringify(esperado));
}

test('parsearTrackCsv: extrae lat/lon de la columna Position (formato FlightRadar24)', () => {
  const csv = [
    'Timestamp,UTC,Callsign,Position,Altitude,Speed,Direction',
    '1622547600,"2021-06-01T12:00:00Z","LV1234","-34.5093,-58.5228",3500,120,270',
    '1622547660,"2021-06-01T12:01:00Z","LV1234","-34.52,-58.53",3600,125,270',
  ].join('\n');
  const puntos = parsearTrackCsv(csv);
  assert.equal(puntos.length, 2);
  assertPuntos(puntos, [[-34.5093, -58.5228], [-34.52, -58.53]]);
});

test('parsearTrackCsv: sin columna Position, devuelve vacío en vez de romper', () => {
  const csv = 'Timestamp,UTC,Callsign\n1,2,3';
  assertPuntos(parsearTrackCsv(csv), []);
});

test('parsearTrackCsv: ignora filas con Position vacía o inválida', () => {
  const csv = [
    'Timestamp,Position',
    '1,""',
    '2,"-34.5,-58.5"',
    '3,"no-es-numero,tampoco"',
  ].join('\n');
  const puntos = parsearTrackCsv(csv);
  assert.equal(puntos.length, 1);
  assertPuntos(puntos, [[-34.5, -58.5]]);
});

test('parsearTrackCsv: solo el header (sin filas de datos), devuelve vacío', () => {
  assertPuntos(parsearTrackCsv('Timestamp,Position'), []);
});

test('parsearTrackKml: extrae lat/lon de <coordinates> (orden lon,lat en el KML)', () => {
  const kml = `<?xml version="1.0"?>
    <kml><Document><Placemark><LineString><coordinates>
      -58.5228,-34.5093,0
      -58.53,-34.52,100
    </coordinates></LineString></Placemark></Document></kml>`;
  const puntos = parsearTrackKml(kml);
  assert.equal(puntos.length, 2);
  assertPuntos(puntos, [[-34.5093, -58.5228], [-34.52, -58.53]]);
});

test('parsearTrackKml: con varios <coordinates>, se queda con el bloque más largo (no los suma todos)', () => {
  // Caso real de FlightRadar24: el mismo recorrido puede venir dos veces en
  // Placemarks separados (ej. línea simple + "coloreada por altitud") —
  // sumar todos los bloques dibujaría el trayecto encimado con sí mismo
  // ("línea doble"). El bloque grande (el recorrido real, con muchos
  // puntos) tiene que ganarle al chico (una versión resumida/duplicada).
  const chico = '-58.5,-34.5,0 -58.6,-34.6,0';
  const grande = '-58.50,-34.50,0 -58.52,-34.52,0 -58.54,-34.54,0 -58.56,-34.56,0 -58.58,-34.58,0';
  const kml = `<coordinates>${chico}</coordinates><coordinates>${grande}</coordinates>`;
  const puntos = parsearTrackKml(kml);
  assert.equal(puntos.length, 5);
  assertPuntos(puntos, [[-34.50, -58.50], [-34.52, -58.52], [-34.54, -58.54], [-34.56, -58.56], [-34.58, -58.58]]);
});

test('parsearTrackKml: sin ningún <coordinates>, devuelve vacío', () => {
  assertPuntos(parsearTrackKml('<kml><Document></Document></kml>'), []);
});

test('parsearTrackKml: KML real de FlightRadar24 (folder "Route" de Placemarks <Point> + folder "Trail" de segmentos <LineString> de 2 puntos) usa el Route y no lo duplica con el Trail', () => {
  const puntosRuta = [
    ['-58.580868', '-34.450367'],
    ['-58.582912', '-34.454681'],
    ['-58.583542', '-34.454956'],
    ['-58.592667', '-34.456100'],
  ];
  const route = puntosRuta
    .map(([lon, lat]) => `<Placemark><TimeStamp><when>2026-07-25T00:44:45+00:00</when></TimeStamp><Point><altitudeMode>absolute</altitudeMode><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`)
    .join('');
  const trail = puntosRuta
    .slice(0, -1)
    .map(([lonA, latA], i) => {
      const [lonB, latB] = puntosRuta[i + 1];
      return `<Placemark><Style><LineStyle><color>ffffffff</color></LineStyle></Style><MultiGeometry><LineString><coordinates>${lonA},${latA},0 ${lonB},${latB},0</coordinates></LineString></MultiGeometry></Placemark>`;
    })
    .join('');
  const kml = `<?xml version="1.0"?><kml><Document><Folder><name>Route</name>${route}</Folder><Folder><name>Trail</name>${trail}</Folder></Document></kml>`;
  const puntos = parsearTrackKml(kml);
  assert.equal(puntos.length, 4);
  assertPuntos(puntos, [
    [-34.450367, -58.580868],
    [-34.454681, -58.582912],
    [-34.454956, -58.583542],
    [-34.456100, -58.592667],
  ]);
});

test('parsearArchivoTrack: despacha a CSV o KML según la extensión', () => {
  assert.equal(parsearArchivoTrack('vuelo.csv', 'Timestamp,Position\n1,"-34.5,-58.5"').length, 1);
  assert.equal(parsearArchivoTrack('vuelo.kml', '<coordinates>-58.5,-34.5,0</coordinates>').length, 1);
});

test('parsearArchivoTrack: .kmz (no soportado) tira un error claro, no rompe silenciosamente', () => {
  assert.throws(() => parsearArchivoTrack('vuelo.kmz', ''), /no soportado/i);
});

test('limitarPuntosTrack: no toca listas cortas', () => {
  const puntos = [[1, 1], [2, 2]];
  assert.equal(limitarPuntosTrack(puntos, 500), puntos);
});

test('limitarPuntosTrack: muestrea parejo listas largas hasta el máximo', () => {
  const puntos = Array.from({ length: 2000 }, (_, i) => [i, i]);
  const limitado = limitarPuntosTrack(puntos, 500);
  assert.equal(limitado.length, 500);
  // El primer y último punto originales tienen que seguir representados
  // (aprox.) — el muestreo no debería arrancar tarde ni cortar antes de tiempo.
  assert.equal(limitado[0][0], 0);
  assert.ok(limitado[499][0] >= 1996);
});
