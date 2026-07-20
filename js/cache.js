// ============================================================================
// CACHE LOCAL — para datos que solo cambian cuando VOS los editás desde la
// propia app (vuelos, aeronaves/tarifas, vencimientos, vuelos programados,
// datos de perfil): no desaparecen ni cambian solos. Se guardan en
// localStorage y, al pedirlos de nuevo, se devuelven al instante desde acá
// (sin esperar la red) mientras se refrescan calladamente en el fondo
// (stale-while-revalidate). Cuando vos guardás/borrás algo con los propios
// botones de editar/borrar de la app, esa entrada se invalida — el próximo
// pedido trae la versión real de Supabase, no una vieja.
// ============================================================================

const Cache = (() => {
  const PREFIJO = 'cache_v1_';

  function leer(key) {
    try {
      const raw = localStorage.getItem(PREFIJO + key);
      return raw === null ? null : JSON.parse(raw);
    } catch { return null; }
  }
  function escribir(key, valor) {
    try { localStorage.setItem(PREFIJO + key, JSON.stringify(valor)); } catch { /* storage lleno/denegado: sin cache, no rompe nada */ }
  }
  function invalidar(...keys) {
    try { keys.forEach((k) => localStorage.removeItem(PREFIJO + k)); } catch { /* noop */ }
  }
  // Se usa al cerrar sesión: si otra cuenta entra en el mismo dispositivo, no
  // tiene que ver ni por un instante datos de la cuenta anterior.
  function invalidarTodo() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(PREFIJO)).forEach((k) => localStorage.removeItem(k));
    } catch { /* noop */ }
  }

  // Si hay algo en cache, lo devuelve YA (sin esperar red) y dispara
  // `fetchFn` en el fondo para refrescar el cache de cara a la próxima vez.
  // Si no hay nada todavía (primera vez), espera la red esta vez nomás.
  async function conCache(key, fetchFn) {
    const cacheado = leer(key);
    if (cacheado !== null) {
      fetchFn().then((fresco) => escribir(key, fresco)).catch(() => { /* se reintenta en el próximo pedido */ });
      return cacheado;
    }
    const fresco = await fetchFn();
    escribir(key, fresco);
    return fresco;
  }

  return { conCache, invalidar, invalidarTodo, leer, escribir };
})();

window.Cache = Cache;
