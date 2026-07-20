// ============================================================================
// DÓLAR BLUE — cotización de venta, para convertir a pesos el costo de los
// vuelos cuya aeronave cobra la hora en dólares.
//
// Se consulta un servicio público (sin API key). Guardamos siempre la última
// cotización buena en localStorage: así, si al momento de guardar un vuelo no
// hay señal o el servicio está caído, se usa la última conocida (mejor eso que
// no poder congelar el costo). `obtenerVentaBlue()` devuelve { venta, ts,
// enVivo } — enVivo=false significa que salió del cache, no de la red.
//
// Si algún día el servicio empieza a bloquear por CORS, se resuelve igual que
// el METAR: una Edge Function propia que haga de proxy (ver supabase/functions).
// ============================================================================

const Dolar = (() => {
  const KEY = 'dolar_blue_venta';
  const FUENTES = [
    { url: 'https://dolarapi.com/v1/dolares/blue', pick: (d) => d.venta },
    { url: 'https://api.bluelytics.com.ar/v2/latest', pick: (d) => d.blue && d.blue.value_sell },
  ];

  function cacheada() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  }

  function _guardar(v) {
    const reg = { venta: v, ts: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(reg)); } catch { /* storage lleno/denegado */ }
    return { ...reg, enVivo: true };
  }

  async function obtenerVentaBlue() {
    // 1) APIs públicas directas (rápidas, normalmente con CORS OK).
    for (const f of FUENTES) {
      try {
        const r = await fetch(f.url);
        if (!r.ok) continue;
        const d = await r.json();
        const v = Number(f.pick(d));
        if (Number.isFinite(v) && v > 0) return _guardar(v);
      } catch { /* probamos la siguiente fuente */ }
    }
    // 2) Red de contención: Edge Function propia (por si bloquean CORS).
    try {
      const slug = window.COTIZACION_FN_SLUG;
      if (slug && window.SUPABASE_CONFIG?.url) {
        const r = await fetch(`${window.SUPABASE_CONFIG.url}/functions/v1/${slug}`);
        if (r.ok) {
          const d = await r.json();
          const v = Number(d?.venta);
          if (Number.isFinite(v) && v > 0) return _guardar(v);
        }
      }
    } catch { /* seguimos al cache */ }
    // 3) Última conocida, guardada de una consulta previa.
    const c = cacheada();
    return c ? { ...c, enVivo: false } : null;
  }

  return { obtenerVentaBlue, cacheada };
})();

window.Dolar = Dolar;
