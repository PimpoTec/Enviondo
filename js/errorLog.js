// ============================================================================
// REGISTRO DE ERRORES — monitoreo básico, propio, sin ningún servicio de
// terceros (Sentry y similares necesitan cuenta/API key que no está
// configurada). Agarra errores no manejados (window.onerror, promesas
// rechazadas sin catch) y los guarda en la tabla error_logs — solo la
// cuenta admin los puede leer después (Perfil → Preferencias → Admin).
//
// A propósito NO se rompe ni interrumpe nada si el guardado falla: sin
// sesión todavía (ej. el error pasó antes de loguearse), sin la tabla
// creada (falta correr sql/agregar_registro_errores.sql), o sin señal, el
// intento de reportar simplemente no hace nada más. Esto es un reporte
// "best effort" para VOS, nunca un requisito para que la app funcione.
// ============================================================================

const ERROR_LOG_MAX_POR_SESION = 20; // corta si algo entra en loop de errores
let _erroresReportados = 0;

async function registrarError(mensaje, detalle) {
  if (_erroresReportados >= ERROR_LOG_MAX_POR_SESION) return;
  _erroresReportados++;
  try {
    if (!window.db) return; // el SDK de Supabase ni cargó — nada que hacer
    const { data } = await window.db.auth.getSession();
    const user = data?.session?.user;
    if (!user) return; // sin sesión, la política RLS lo rechazaría igual
    await window.db.from('error_logs').insert({
      user_id: user.id,
      mensaje: String(mensaje || '(sin mensaje)').slice(0, 2000),
      detalle: detalle ? String(detalle).slice(0, 4000) : null,
      url: location.href,
      user_agent: navigator.userAgent,
    });
  } catch { /* no hay vuelta — si esto falla, no puede romper nada más */ }
}

window.addEventListener('error', (e) => {
  registrarError(e.message, e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const razon = e.reason;
  registrarError(razon?.message || String(razon), razon?.stack);
});

window.ErrorLog = { registrar: registrarError };
