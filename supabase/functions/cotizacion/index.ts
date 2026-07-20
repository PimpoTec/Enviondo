// ============================================================================
// EDGE FUNCTION: cotizacion — proxy al dólar blue (venta), para congelar en
// pesos el costo de los vuelos de aeronaves que cobran en dólares.
//
// El frontend (js/dolar.js) primero intenta las APIs públicas directo
// (dolarapi.com, bluelytics) — que normalmente mandan headers CORS. Esta
// función es la red de contención por si algún día dejan de mandarlos: corre
// server-side (sin CORS) y le agrega los headers que el navegador necesita.
//
// Uso: GET https://<project-ref>.supabase.co/functions/v1/cotizacion
//      → { "venta": 1234.5, "fuente": "dolarapi" }
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUENTES = [
  { nombre: 'dolarapi', url: 'https://dolarapi.com/v1/dolares/blue', pick: (d: any) => d?.venta },
  { nombre: 'bluelytics', url: 'https://api.bluelytics.com.ar/v2/latest', pick: (d: any) => d?.blue?.value_sell },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  for (const f of FUENTES) {
    try {
      const resp = await fetch(f.url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const venta = Number(f.pick(data));
      if (Number.isFinite(venta) && venta > 0) {
        return new Response(JSON.stringify({ venta, fuente: f.nombre }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
        });
      }
    } catch { /* probamos la siguiente fuente */ }
  }

  return new Response(JSON.stringify({ error: 'No se pudo obtener la cotización.' }), {
    status: 502,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
