// ============================================================================
// TRACK PARSER — lee el archivo de recorrido real (CSV o KML) que se puede
// descargar de FlightRadar24 para un vuelo con transponder ADS-B, y lo
// convierte en una lista de puntos [lat, lon] para guardar en el vuelo y
// dibujar en un mapa. Puro (sin red, sin DOM más que DOMParser para KML) —
// ver tests/trackParser.test.js.
// ============================================================================

// Tope de puntos guardados — un track de FlightRadar24 puede traer miles de
// posiciones (una cada 1-5 segundos); guardar todas no aporta nada al mapa
// (a la escala en que se ve un vuelo entero, no se nota la diferencia) y
// infla el tamaño de la fila. Se muestrea parejo en vez de cortar el final.
const TRACK_MAX_PUNTOS = 500;

function limitarPuntosTrack(puntos, max = TRACK_MAX_PUNTOS) {
  if (puntos.length <= max) return puntos;
  const paso = puntos.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(puntos[Math.floor(i * paso)]);
  return out;
}

// CSV de FlightRadar24: columnas típicas Timestamp,UTC,Callsign,Position,
// Altitude,Speed,Direction — "Position" es un solo campo entre comillas con
// "lat,lon" adentro (una coma dentro de un campo citado), por eso no alcanza
// con split(',') línea por línea.
function _parsearLineaCsv(linea) {
  const campos = [];
  let actual = '';
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') { entreComillas = !entreComillas; continue; }
    if (c === ',' && !entreComillas) { campos.push(actual); actual = ''; continue; }
    actual += c;
  }
  campos.push(actual);
  return campos;
}

function parsearTrackCsv(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return [];
  const header = _parsearLineaCsv(lineas[0]).map((h) => h.trim().toLowerCase());
  const idxPos = header.indexOf('position');
  if (idxPos === -1) return [];

  const puntos = [];
  for (let i = 1; i < lineas.length; i++) {
    const fila = _parsearLineaCsv(lineas[i]);
    const pos = fila[idxPos];
    if (!pos) continue;
    const [lat, lon] = pos.split(',').map((n) => parseFloat(n.trim()));
    if (Number.isFinite(lat) && Number.isFinite(lon)) puntos.push([lat, lon]);
  }
  return limitarPuntosTrack(puntos);
}

// KML: las coordenadas de un <LineString> van en un solo <coordinates>
// como "lon,lat,alt lon,lat,alt ..." (¡en ese orden — longitud primero!),
// separadas por espacios o saltos de línea. Con una regex alcanza (no hace
// falta un parser XML completo para este único tag).
//
// Un KML de FlightRadar24 puede traer el mismo recorrido dos veces en
// <Placemark> separados (ej. una capa de línea simple + otra "coloreada
// por altitud", pensadas para togglear en Google Earth, no para sumar) —
// concatenar todos los bloques de <coordinates> tal cual aparecen dibuja
// el trayecto encimado con el mismo dos veces, con el típico efecto de
// "línea doble" zigzagueando. Nos quedamos solo con el bloque más largo
// (el que mejor representa el recorrido completo) en vez de sumarlos todos.
function parsearTrackKml(texto) {
  const bloques = [];
  const regex = /<coordinates>([\s\S]*?)<\/coordinates>/gi;
  let m;
  while ((m = regex.exec(texto))) {
    const puntos = [];
    const tripletas = m[1].trim().split(/\s+/);
    for (const t of tripletas) {
      const [lon, lat] = t.split(',').map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon)) puntos.push([lat, lon]);
    }
    if (puntos.length) bloques.push(puntos);
  }
  if (!bloques.length) return [];
  bloques.sort((a, b) => b.length - a.length);
  return limitarPuntosTrack(bloques[0]);
}

// Despacha según la extensión del archivo — .kmz (KML comprimido) no está
// soportado (haría falta descomprimir un zip, fuera de alcance por ahora).
function parsearArchivoTrack(nombreArchivo, texto) {
  const ext = (nombreArchivo.split('.').pop() || '').toLowerCase();
  if (ext === 'csv') return parsearTrackCsv(texto);
  if (ext === 'kml') return parsearTrackKml(texto);
  throw new Error('Formato no soportado — subí un .csv o .kml de FlightRadar24 (los .kmz no están soportados).');
}

window.TrackParser = { parsearTrackCsv, parsearTrackKml, parsearArchivoTrack, limitarPuntosTrack, TRACK_MAX_PUNTOS };
