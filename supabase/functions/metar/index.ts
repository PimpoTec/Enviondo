// ============================================================================
// EDGE FUNCTION: metar — proxy propio a aviationweather.gov (NOAA). Sirve
// METAR (clima actual) y TAF (pronóstico del aeródromo).
//
// aviationweather.gov no manda headers CORS, así que el navegador no puede
// pedirle directo (bloqueado por CORS). Esta función corre server-side (sin
// CORS, porque no es un pedido de navegador) y le agrega los headers CORS
// que el frontend necesita. Reemplaza el proxy público de terceros
// (allorigins.win) que se usaba antes — este queda bajo control propio.
//
// OJO: el slug real de esta función quedó "smooth-processor" (Supabase lo
// fija al crearla, no lo cambia el campo "Name" del dashboard después) —
// ver el comentario en cargarMetar() de js/views/dashboard.js.
//
// Uso: GET https://<project-ref>.supabase.co/functions/v1/<slug>?icao=SAEZ
//      GET https://<project-ref>.supabase.co/functions/v1/<slug>?icao=SAEZ&tipo=taf
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
  const tipo = url.searchParams.get('tipo') === 'taf' ? 'taf' : 'metar';

  if (!/^[A-Z0-9]{4}$/.test(icao)) {
    return new Response('Código ICAO inválido.', {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const resp = await fetch(`https://aviationweather.gov/api/data/${tipo}?ids=${icao}&format=raw`);
    const texto = await resp.text();
    return new Response(texto, {
      status: resp.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    return new Response(`No se pudo consultar el ${tipo.toUpperCase()}: ` + String(err), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
});
