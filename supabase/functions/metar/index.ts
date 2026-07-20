// ============================================================================
// EDGE FUNCTION: metar — proxy propio a aviationweather.gov (NOAA).
//
// aviationweather.gov no manda headers CORS, así que el navegador no puede
// pedirle directo (bloqueado por CORS). Esta función corre server-side (sin
// CORS, porque no es un pedido de navegador) y le agrega los headers CORS
// que el frontend necesita. Reemplaza el proxy público de terceros
// (allorigins.win) que se usaba antes — este queda bajo control propio.
//
// Deploy: supabase functions deploy metar --no-verify-jwt
// (--no-verify-jwt porque es una consulta pública de clima, sin datos de
// usuario — no hace falta pedir login para esto)
//
// Uso: GET https://<project-ref>.supabase.co/functions/v1/metar?icao=SAEZ
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const icao = (url.searchParams.get('icao') || '').trim().toUpperCase();

  if (!/^[A-Z0-9]{4}$/.test(icao)) {
    return new Response('Código ICAO inválido.', {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const resp = await fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`);
    const texto = await resp.text();
    return new Response(texto, {
      status: resp.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    return new Response('No se pudo consultar el METAR: ' + String(err), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
});
