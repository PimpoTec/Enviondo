// ============================================================================
// NOTIFICACIONES PUSH — Web Push nativo (VAPID) + Supabase, sin servicios de
// terceros. El envío real lo hace supabase/functions/notificaciones-push
// (server-side); acá solo vive lo que corre en el navegador: pedir permiso,
// suscribirse, y guardar/borrar esa suscripción en Supabase.
//
// Requiere HTTPS (localhost es la única excepción) y, en iOS, que la PWA
// esté instalada en la pantalla de inicio — Safari no entrega push a una
// pestaña común, eso no es un bug de acá.
// ============================================================================

// La public key de VAPID viaja en base64url (no el base64 normal de toda la
// vida), y pushManager.subscribe() necesita un Uint8Array, no un string —
// pasarle el string tal cual falla en silencio o tira InvalidAccessError.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

const Notificaciones = {
  soportado() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },
  // 'default' (todavía no se preguntó) | 'granted' | 'denied' | 'unsupported'
  permiso() {
    return this.soportado() ? Notification.permission : 'unsupported';
  },
  async suscripcionActual() {
    if (!this.soportado()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  },
  // Se llama SIEMPRE desde el click de un botón (nunca al cargar la página
  // en frío) — pedir permiso sin un gesto del usuario hace que el navegador
  // lo bloquee o lo ignore directamente.
  async activar() {
    if (!this.soportado()) throw new Error('Este navegador no soporta notificaciones push (en iPhone: instalá la app en la pantalla de inicio primero).');
    if (!window.VAPID_PUBLIC_KEY) throw new Error('Falta configurar VAPID_PUBLIC_KEY en js/config.js.');
    const reg = await navigator.serviceWorker.ready;
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') throw new Error('No diste permiso para las notificaciones.');
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.VAPID_PUBLIC_KEY),
      });
    }
    await Repo.guardarSuscripcionPush(sub.toJSON());
    return sub;
  },
  async desactivar() {
    const sub = await this.suscripcionActual();
    if (!sub) return;
    await Repo.borrarSuscripcionPush(sub.endpoint);
    await sub.unsubscribe();
  },
  // Modo de prueba separado del envío real desde el día uno: sin poder
  // disparar un push a mano, debuggear esto a fuerza de esperar al cron es
  // desesperantemente lento.
  async enviarPrueba() {
    const { data, error } = await window.db.functions.invoke(window.PUSH_FN_SLUG, { body: { modo: 'test' } });
    if (error) throw new Error(await mensajeDeErrorFuncion(error));
    if (data?.error) throw new Error(data.error);
    return data;
  },
};

// supabase-js, ante un status no-2xx de una Edge Function, tira un error
// genérico ("Edge Function returned a non-2xx status code") que no dice
// nada del motivo real — el motivo de verdad viaja en el body de la
// respuesta (`error.context`, un Response), así que hay que leerlo aparte.
async function mensajeDeErrorFuncion(error) {
  try {
    const resp = error?.context;
    if (resp && typeof resp.json === 'function') {
      const body = await resp.clone().json();
      if (body?.error) return body.error;
    }
  } catch { /* nos quedamos con el mensaje genérico de abajo */ }
  return error?.message || 'Error desconocido al llamar a la función.';
}

window.Notificaciones = Notificaciones;
window.urlBase64ToUint8Array = urlBase64ToUint8Array;
window.mensajeDeErrorFuncion = mensajeDeErrorFuncion;
