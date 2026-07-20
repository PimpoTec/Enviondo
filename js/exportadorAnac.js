// ============================================================================
// EXPORTADOR — Hoja de Libro de Vuelo de Pilotos, Res. ANAC 290/2012.
// Reproduce fielmente el formulario oficial (35,5×16,5 cm): grilla con bordes,
// encabezados combinados y 15 renglones por hoja. Al llenarse una hoja, pasa a
// la siguiente arrastrando los totales de cada columna ("totales a la página
// siguiente"). Un libro (archivo) por año — pero el TOTAL ACUMULADO nunca se
// resetea al cambiar de año (es un total de carrera, como en el libro de
// papel real): si exportás desde una fecha en adelante, o el año no es el
// primero que volaste, el arrastre arranca con las horas reales ya voladas
// antes, no en cero.
//
// Isomorfo: en el navegador usa window.ExcelJS (CDN); en Node se le pasa la
// librería por parámetro (para los tests/prototipos). No depende del DOM.
// ============================================================================

(function () {
  // Plantilla extraída del .xls oficial (coordenadas 0-indexadas del xls).
  // cells: [fila, col, texto] · merges: [rlo, rhi(excl), clo, chi(excl)]
  // widths: ancho de columna en caracteres.
  const SPEC = {"cells":[[1,3,"APELLIDO Y NOMBRE:"],[1,12,"LICENCIA:"],[1,20,"Nº"],[1,26,"LEGAJO Nº"],[3,1,"AÑO 20"],[3,3,"ITINERARIO"],[3,6,"FINALIDAD DEL VUELO"],[3,7,"AERONAVES UTILIZADAS"],[3,11,"TIEMPOS DE VUELO"],[3,19,"ATERRIZAJES"],[3,20,"DISCRIMINACION DE TIEMPOS DE VUELO"],[3,28,"ADIESTRADOR TERRESTRE / SIMULADOR"],[3,30,"CERTIFICACIONES"],[4,3,"HORA DE SALIDA UTC"],[4,4,"DESDE HASTA"],[4,5,"HORA DE LLEGADA UTC"],[4,7,"MARCA / MODELO"],[4,8,"MATRICULA"],[4,9,"POTENCIA"],[4,10,"CLASE"],[4,11,"SOBRE AERÓDROMO"],[4,15,"TRAVESIA"],[4,20,"INSTRUCT DE VUELO"],[4,21,"MULTI MOTOR"],[4,22,"REACTOR"],[4,23,"TURBO HELICE"],[4,24,"AERO APLICA- DOR"],[4,25,"VUELO POR INSTRUMENTOS"],[4,28,"INSTRUCTOR"],[4,29,"PILOTO EN INSTRUCCIÓN"],[6,25,"REAL"],[6,27,"CAPOTA"],[7,11,"DE DIA"],[7,13,"DE NOCHE"],[7,15,"DE DIA"],[7,17,"DE NOCHE"],[8,11,"PILOTO"],[8,12,"COPILOTO"],[8,13,"PILOTO"],[8,14,"COPILOTO"],[8,15,"PILOTO"],[8,16,"COPILOTO"],[8,17,"PILOTO"],[8,18,"COPILOTO"],[8,25,"PILOTO"],[8,26,"COPILOTO"],[9,1,"DIA"],[9,2,"MES"],[9,7,"TOTALES PAGINA ANTERIOR"],[9,32,"Total horas de vuelo de la pagina anterior"],[10,0,1],[11,0,2],[12,0,3],[13,0,4],[14,0,5],[15,0,6],[16,0,7],[17,0,8],[18,0,9],[19,0,10],[20,0,11],[21,0,12],[22,0,13],[23,0,14],[24,0,15],[24,32,"Total horas de vuelo de la pagina siguiente"],[25,1,"TOTALES A LA PAGINA SIGUIENTE"],[26,1,"HOJA DE LIBRO DE VUELO DE PILOTOS RESOLUCION ANAC 290/2012 del 15/05/2012 - MEDIDAS 35.5 cm X 16.5 cm"],[28,21,"Los totales de estas columnas no deben sumarse a los totales generales ya que estan comprendidos en la columna TIEMPOS DE VUELO"],[30,28,"FIRMA DEL TITULAR"]],"merges":[[1,2,3,5],[1,2,12,14],[1,2,26,28],[2,3,3,5],[2,3,12,14],[2,3,26,28],[3,4,3,6],[3,4,7,11],[3,4,11,19],[3,4,20,28],[3,4,28,30],[3,9,1,3],[3,9,19,20],[3,9,30,33],[3,10,6,7],[4,6,25,28],[4,7,11,15],[4,7,15,19],[4,9,7,8],[4,9,8,9],[4,9,9,10],[4,9,10,11],[4,9,20,21],[4,9,21,22],[4,9,22,23],[4,9,23,24],[4,9,24,25],[4,9,28,29],[4,9,29,30],[4,10,3,4],[4,10,4,5],[4,10,5,6],[6,8,25,27],[6,9,27,28],[7,8,11,13],[7,8,13,15],[7,8,15,17],[7,8,17,19],[9,10,7,10],[9,11,32,33],[11,12,30,33],[12,13,30,33],[13,14,30,33],[14,15,30,33],[15,16,30,33],[16,17,30,33],[17,18,30,33],[18,19,30,33],[19,20,30,33],[20,21,30,33],[21,22,30,33],[22,23,30,33],[23,24,30,33],[24,26,32,33],[25,26,1,8],[25,26,8,11],[26,27,1,11],[27,28,1,11],[28,31,21,27],[30,31,28,32]],"widths":{"0":2.86,"1":6,"2":6,"3":8.29,"4":19,"5":8.29,"6":7.29,"7":7.57,"8":9,"9":8,"10":7.71,"11":8.71,"12":8.71,"13":8.71,"14":8.71,"15":8.71,"16":8.71,"17":8.71,"18":8.71,"19":6.29,"20":7.71,"21":6,"22":7.71,"23":5.86,"24":6.29,"25":8.71,"26":8.71,"27":6.86,"28":10.86,"29":10.86,"30":18.43,"31":3.57,"32":10.86}};

  const FILAS_POR_HOJA = 15;
  // Filas del xls (0-indexadas) → +1 para ExcelJS.
  const XLS_TOT_ANT = 9;    // "TOTALES PAGINA ANTERIOR"
  const XLS_PRIMER_DATO = 10;
  const XLS_TOT_SIG = 25;   // "TOTALES A LA PAGINA SIGUIENTE"

  // Columnas numéricas que acumulan totales (0-indexadas).
  const COLS_TIEMPO = [11, 12, 13, 14, 15, 16, 17, 18];
  const COLS_ACUM = COLS_TIEMPO.concat([19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);

  // Códigos de clase de aeronave tal como los pide ANAC en la hoja (no es una
  // abreviación libre nuestra — es el código fijo que corresponde a cada
  // clase). Completar/corregir acá si hace falta otro código.
  const CLASE_ABREV = {
    monomotor: 'MONTT',
  };

  // Ruta (columna "DESDE HASTA", una sola casilla en el formulario oficial):
  // en un vuelo local el piloto anota el mismo aeródromo dos veces (DESDE y
  // HASTA), no una sola — por eso siempre van los dos valores, aunque sean
  // iguales. En travesía, separados por guion.
  function formatearRuta(desde, hasta) {
    const d = desde || '', h = hasta || '';
    return d === h ? `${d} ${h}` : `${d}-${h}`;
  }

  // Cómo se llena cada columna de datos (0-indexada) a partir de un vuelo.
  function valorCelda(col, v) {
    switch (col) {
      case 1: return Number(v.fecha.slice(8, 10));         // día
      case 2: return Number(v.fecha.slice(5, 7));          // mes
      case 3: return (v.hora_salida_utc || '').slice(0, 5);
      case 4: return formatearRuta(v.desde, v.hasta);
      case 5: return (v.hora_llegada_utc || '').slice(0, 5);
      case 6: return v.finalidad_vuelo || '';
      case 7: return v.aeronaves?.marca_modelo || '';
      case 8: return v.aeronaves?.matricula || '';
      case 9: return v.aeronaves?.potencia || '';
      case 10: {
        const clase = String(v.aeronaves?.clase || '').trim().toLowerCase();
        return clase ? (CLASE_ABREV[clase] || clase.toUpperCase().slice(0, 8)) : '';
      }
      case 11: return num(v.saero_dia_piloto);
      case 12: return num(v.saero_dia_copiloto);
      case 13: return num(v.saero_noche_piloto);
      case 14: return num(v.saero_noche_copiloto);
      case 15: return num(v.trav_dia_piloto);
      case 16: return num(v.trav_dia_copiloto);
      case 17: return num(v.trav_noche_piloto);
      case 18: return num(v.trav_noche_copiloto);
      case 19: return entero(Number(v.aterrizajes_dia || 0) + Number(v.aterrizajes_noche || 0));
      case 20: return num(v.instruccion_vuelo);
      case 21: return num(v.multimotor);
      case 22: return num(v.reactor);
      case 23: return num(v.turbohelice);
      case 24: return num(v.aeroaplicador);
      case 25: return num(v.instrumentos_real);
      case 27: return num(v.instrumentos_capota);
      case 29: return num(v.adiestrador_simulador);
      default: return '';
    }
  }

  function num(x) {
    const n = Number(x);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : '';
  }
  function entero(x) { return x > 0 ? x : ''; }

  function colLetra(c1) { // c1: columna 1-indexada → letra Excel
    let s = '';
    while (c1 > 0) { const m = (c1 - 1) % 26; s = String.fromCharCode(65 + m) + s; c1 = (c1 - m - 1) / 26; }
    return s;
  }

  const BORDE = { style: 'thin', color: { argb: 'FF000000' } };
  const BORDES = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };

  function tiempoTotalVuelo(v) {
    return COLS_TIEMPO.reduce((s, c) => s + (Number(valorCelda(c, v)) || 0), 0);
  }

  // Suma, por columna acumulable, el valor de una lista de vuelos.
  function sumarColumnas(vuelos, cols = COLS_ACUM) {
    const acc = {};
    for (const c of cols) acc[c] = 0;
    for (const v of vuelos) {
      for (const c of cols) {
        const n = Number(valorCelda(c, v));
        if (Number.isFinite(n)) acc[c] += n;
      }
    }
    for (const c of cols) acc[c] = Math.round(acc[c] * 100) / 100;
    return acc;
  }

  function construirHoja(wb, ExcelJS, { grupo, indice, datosPiloto, anio, carryPorColumna, grandPrev }) {
    const nombre = `Hoja ${indice + 1}`;
    const ws = wb.addWorksheet(nombre, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 } },
    });

    // Anchos de columna.
    Object.keys(SPEC.widths).forEach((c) => { ws.getColumn(Number(c) + 1).width = SPEC.widths[c]; });

    // Textos de la plantilla.
    for (const [r, c, texto] of SPEC.cells) {
      ws.getCell(r + 1, c + 1).value = texto;
    }
    // Datos de cabecera del piloto.
    if (datosPiloto) {
      ws.getCell(3, 4).value = datosPiloto.nombre_completo || '';
      ws.getCell(3, 13).value = datosPiloto.licencia || '';
      ws.getCell(2, 21).value = datosPiloto.licencia_numero || '';
      ws.getCell(3, 27).value = datosPiloto.legajo || '';
    }
    if (anio) ws.getCell(4, 2).value = 'AÑO ' + anio;

    // Combinaciones.
    for (const [rlo, rhi, clo, chi] of SPEC.merges) {
      ws.mergeCells(rlo + 1, clo + 1, rhi, chi);
    }

    // Renglones de vuelo (hasta 15).
    grupo.forEach((v, i) => {
      const fila = XLS_PRIMER_DATO + i + 1; // 1-indexado
      for (let c = 1; c <= 29; c++) {
        const val = valorCelda(c, v);
        if (val !== '' && val !== undefined) ws.getCell(fila, c + 1).value = val;
      }
    });

    const rTotAnt = XLS_TOT_ANT + 1;                 // fila 10
    const rDato1 = XLS_PRIMER_DATO + 1;              // fila 11
    const rDatoN = XLS_PRIMER_DATO + FILAS_POR_HOJA; // fila 25
    const rTotSig = XLS_TOT_SIG + 1;                 // fila 26

    for (const c of COLS_ACUM) {
      const L = colLetra(c + 1);
      if (indice > 0) {
        // Hoja siguiente dentro del mismo año: encadena por fórmula viva.
        ws.getCell(rTotAnt, c + 1).value = { formula: `'Hoja ${indice}'!${L}${rTotSig}` };
      } else if (carryPorColumna && carryPorColumna[c]) {
        // Primera hoja del archivo: arrastre real (historial previo o años
        // anteriores), como número clavado — no hay archivo previo al que
        // referenciar con fórmula.
        ws.getCell(rTotAnt, c + 1).value = carryPorColumna[c];
      }
      ws.getCell(rTotSig, c + 1).value = { formula: `${L}${rTotAnt}+SUM(${L}${rDato1}:${L}${rDatoN})` };
    }

    // Total de horas de vuelo (acumulado) en los recuadros de la derecha.
    const grandPag = grupo.reduce((s, v) => s + tiempoTotalVuelo(v), 0);
    const grandNext = Math.round((grandPrev + grandPag) * 100) / 100;
    ws.getCell(10, 33).value = `TOTAL HS. VUELO\nPÁG. ANTERIOR\n${Math.round(grandPrev * 100) / 100}`;
    ws.getCell(25, 33).value = `TOTAL HS. VUELO\nPÁG. SIGUIENTE\n${grandNext}`;

    estilar(ws);
    return { grandNext, sumaPagina: sumarColumnas(grupo) };
  }

  function estilar(ws) {
    for (let r = 1; r <= 31; r++) {
      const esCabecera = r >= 4 && r <= 9;
      const esTotales = r === 10 || r === 26;
      for (let c = 1; c <= 33; c++) {
        const cell = ws.getCell(r, c);
        cell.font = { name: 'Arial', size: esCabecera ? 6.5 : 8, bold: esCabecera || esTotales };
        if (r >= 4 && r <= 26) cell.border = BORDES;
        const textoLargo = r >= 11 && r <= 25 && (c === 5 || c === 8);
        cell.alignment = {
          vertical: 'middle',
          horizontal: textoLargo ? 'left' : 'center',
          // Wrap solo en la cabecera (títulos largos multi-línea). En los
          // renglones de datos NO: con columnas de 7-9 caracteres, wrappear
          // un valor corto en una fila baja lo corta y lo hace ilegible.
          wrapText: esCabecera,
        };
      }
    }
    [[2, 4], [3, 4], [2, 13], [3, 13], [2, 21], [3, 21], [2, 27], [3, 27]].forEach(([r, c]) => {
      ws.getCell(r, c).border = BORDES;
    });
    for (let r = 11; r <= 26; r++) {
      for (const c of COLS_ACUM) {
        if (c === 19) ws.getCell(r, c + 1).numFmt = '0';
        else ws.getCell(r, c + 1).numFmt = '0.0';
      }
    }
    // Recuadro "Total horas de vuelo" (col 33, filas 10 y 25): SÍ necesita
    // wrap (3 líneas cortas) — si no, el texto queda amontonado/cortado y es
    // justo lo que se veía mal. Fuente chica para que las 3 líneas entren.
    [10, 25].forEach((r) => {
      const cell = ws.getCell(r, 33);
      cell.font = { name: 'Arial', size: 7, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    ws.getRow(2).height = 16; ws.getRow(3).height = 16;
    for (let r = 4; r <= 9; r++) ws.getRow(r).height = 16;
    for (let r = 11; r <= 26; r++) ws.getRow(r).height = 15;
    ws.getRow(10).height = 42; ws.getRow(25).height = 34;
  }

  function enTrozos(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out.length ? out : [[]];
  }

  // Construye el workbook de un año. `carryInicial` = { porColumna, grandTotal }
  // con el arrastre real de todo lo volado ANTES del primer vuelo de este año
  // (historial previo + años anteriores, si los hay). Devuelve además el
  // estado final (para encadenar con el archivo del año siguiente).
  function construirLibroAnual(ExcelJS, { anio, vuelos, datosPiloto, carryInicial }) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Libro de Vuelo';
    const ordenados = [...vuelos].sort((a, b) =>
      a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.hora_salida_utc || '').localeCompare(b.hora_salida_utc || ''));
    const paginas = enTrozos(ordenados, FILAS_POR_HOJA);

    const carryPorColumna = Object.assign({}, carryInicial?.porColumna);
    let grandPrev = carryInicial?.grandTotal || 0;
    paginas.forEach((grupo, indice) => {
      const { grandNext, sumaPagina } = construirHoja(wb, ExcelJS, {
        grupo, indice, datosPiloto, anio,
        carryPorColumna: indice === 0 ? carryPorColumna : null,
        grandPrev,
      });
      grandPrev = grandNext;
      for (const c of COLS_ACUM) carryPorColumna[c] = Math.round(((carryPorColumna[c] || 0) + (sumaPagina[c] || 0)) * 100) / 100;
    });

    return { workbook: wb, estadoFinal: { porColumna: carryPorColumna, grandTotal: grandPrev } };
  }

  // Agrupa vuelos por año (de la fecha) → { anio: [vuelos] }.
  function agruparPorAnio(vuelos) {
    const map = {};
    for (const v of vuelos) {
      const anio = v.fecha.slice(0, 4);
      (map[anio] = map[anio] || []).push(v);
    }
    return map;
  }

  const ExportadorAnac = {
    construirLibroAnual, agruparPorAnio, sumarColumnas, formatearRuta,
    valorCelda, colLetra, CLASE_ABREV, COLS_ACUM, FILAS_POR_HOJA, SPEC,
  };

  if (typeof window !== 'undefined') window.ExportadorAnac = ExportadorAnac;
  if (typeof module !== 'undefined' && module.exports) module.exports = ExportadorAnac;
})();
