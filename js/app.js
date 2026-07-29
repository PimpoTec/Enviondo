// ============================================================================
// BOOTSTRAP DE LA APP
// ============================================================================

function aplicarTemaGuardado() {
  const t = localStorage.getItem('tema')
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
}

// El toggle de tema vive en Perfil (Preferencias), no en el header.
// setTema(tema) fija un valor explícito ('dark' | 'light'); temaActual()
// lee cuál está aplicado ahora (con el mismo fallback a preferencia del
// sistema que usaba el botón viejo).
function temaActual() {
  return document.documentElement.getAttribute('data-theme')
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function setTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem('tema', tema);
}

// Preferencia de huso horario al cargar vuelos — solo cambia la etiqueta
// de los casilleros de hora (ver labelHora), no hace conversión de horario:
// el piloto tipea la hora que corresponda según lo que eligió acá.
function obtenerPrefHorario() {
  return localStorage.getItem('horario_pref') || 'utc';
}
function guardarPrefHorario(valor) {
  localStorage.setItem('horario_pref', valor);
}
function labelHora(base) {
  return `${base} (${obtenerPrefHorario() === 'local' ? 'Hora local' : 'UTC'})`;
}

// Anima un número contando desde 0 hasta el valor final en vez de aparecer
// de golpe — sensación más "viva" en los números grandes (horas totales,
// KPIs de Totales). Respeta los decimales del valor final y, si el usuario
// pidió menos movimiento en el sistema, no anima nada (prefers-reduced-motion).
function animarNumero(el, valorFinal, { duracionMs = 700, sufijo = '' } = {}) {
  const numero = Number(valorFinal);
  if (!Number.isFinite(numero)) { el.textContent = valorFinal + sufijo; return; }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = numero + sufijo;
    return;
  }
  const decimales = (String(valorFinal).split('.')[1] || '').length;
  const t0 = performance.now();
  function paso(ahora) {
    const p = Math.min(1, (ahora - t0) / duracionMs);
    const suavizado = 1 - Math.pow(1 - p, 3); // ease-out cúbico
    el.textContent = (numero * suavizado).toFixed(decimales) + sufijo;
    if (p < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}
window.animarNumero = animarNumero;

// ---------- Cierre de sesión por inactividad ----------
// Dato personal (nombre, licencia, legajo) + vuelos en juego: no queremos
// que una sesión quede abierta para siempre en un dispositivo compartido.
// Se cierra sola después de 1 hora sin volver a entrar a la app — se
// controla al abrir la app y cada vez que la pestaña vuelve a primer plano
// (no hace falta que esté abierta y activa todo ese tiempo para que cuente
// como "uso"; alcanza con haber entrado dentro de la última hora).
const INACTIVIDAD_LIMITE_MS = 60 * 60 * 1000;
const ACTIVIDAD_KEY = 'ultima_actividad';

function registrarActividad() {
  try { localStorage.setItem(ACTIVIDAD_KEY, String(Date.now())); } catch { /* sin storage: no rompe nada */ }
}
function inactivoDemasiado() {
  try {
    const t = Number(localStorage.getItem(ACTIVIDAD_KEY));
    return Number.isFinite(t) && t > 0 && (Date.now() - t) > INACTIVIDAD_LIMITE_MS;
  } catch { return false; }
}

function actualizarBannerOffline() {
  document.getElementById('offline-banner').style.display = navigator.onLine ? 'none' : 'block';
}

function inicializarIconosEstaticos() {
  document.getElementById('offline-banner-icon').innerHTML = Icons.wifiOff(16);
  document.getElementById('login-icon').innerHTML = Icons.plane(18);
  document.getElementById('brand-icon').innerHTML = Icons.plane(20);
  document.getElementById('btn-perfil').innerHTML = Icons.person(18);
}

function mostrarPanelLogin(panel) {
  ['panel-login', 'panel-signup', 'panel-olvide', 'panel-nueva-clave'].forEach((id) => {
    document.getElementById(id).style.display = id === panel ? 'block' : 'none';
  });
  document.getElementById('login-msg').textContent = '';
  document.getElementById('tab-login').classList.toggle('active', panel === 'panel-login');
  document.getElementById('tab-signup').classList.toggle('active', panel === 'panel-signup');
}

async function mostrarLogin(panelInicial) {
  document.getElementById('vista-login').style.display = 'flex';
  document.getElementById('vista-app').style.display = 'none';
  mostrarPanelLogin(panelInicial || 'panel-login');

  const msg = document.getElementById('login-msg');

  document.getElementById('tab-login').onclick = () => mostrarPanelLogin('panel-login');
  document.getElementById('tab-signup').onclick = () => mostrarPanelLogin('panel-signup');
  document.getElementById('link-olvide').onclick = (e) => { e.preventDefault(); mostrarPanelLogin('panel-olvide'); };
  document.getElementById('link-volver-login').onclick = (e) => { e.preventDefault(); mostrarPanelLogin('panel-login'); };

  document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { msg.textContent = 'Completá email y contraseña.'; return; }
    msg.textContent = 'Entrando…';
    const { error } = await Auth.iniciarSesion(email, password);
    msg.textContent = error ? `Error: ${error.message}` : '';
  };

  document.getElementById('btn-signup').onclick = async () => {
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const password2 = document.getElementById('signup-password2').value;
    if (!email || !password) { msg.textContent = 'Completá email y contraseña.'; return; }
    if (password.length < 6) { msg.textContent = 'La contraseña tiene que tener al menos 6 caracteres.'; return; }
    if (password !== password2) { msg.textContent = 'Las contraseñas no coinciden.'; return; }
    msg.textContent = 'Creando cuenta…';
    const { data, error } = await Auth.registrarse(email, password);
    if (error) { msg.textContent = `Error: ${error.message}`; return; }
    msg.innerHTML = Icons.tag('checkCircle', data.session
      ? 'Cuenta creada.'
      : 'Cuenta creada. Revisá tu email para confirmarla y después iniciá sesión.');
  };

  document.getElementById('btn-olvide').onclick = async () => {
    const email = document.getElementById('olvide-email').value.trim();
    if (!email) { msg.textContent = 'Ingresá tu email.'; return; }
    msg.textContent = 'Enviando…';
    const { error } = await Auth.enviarResetPassword(email);
    msg.innerHTML = error ? `Error: ${error.message}` : Icons.tag('checkCircle', 'Revisá tu correo y hacé click en el link para elegir una contraseña nueva.');
  };

  document.getElementById('btn-nueva-clave').onclick = async () => {
    const nueva = document.getElementById('nueva-clave').value;
    if (!nueva || nueva.length < 6) { msg.textContent = 'La contraseña tiene que tener al menos 6 caracteres.'; return; }
    msg.textContent = 'Guardando…';
    const { error } = await Auth.actualizarPassword(nueva);
    if (error) { msg.textContent = `Error: ${error.message}`; return; }
    msg.innerHTML = Icons.tag('checkCircle', 'Contraseña actualizada. Ya podés usar la app.');
    setTimeout(() => mostrarApp(), 800);
  };

  // Enter envía el panel visible — los inputs no viven en un <form>, así que
  // el teclado "Go"/"Enter" (sobre todo en móvil) no dispararía nada sin esto.
  const submitConEnter = (inputIds, botonId) => {
    inputIds.forEach((id) => {
      document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById(botonId).click(); }
      });
    });
  };
  submitConEnter(['login-email', 'login-password'], 'btn-login');
  submitConEnter(['signup-email', 'signup-password', 'signup-password2'], 'btn-signup');
  submitConEnter(['olvide-email'], 'btn-olvide');
  submitConEnter(['nueva-clave'], 'btn-nueva-clave');
}

async function mostrarApp() {
  document.getElementById('vista-login').style.display = 'none';
  document.getElementById('vista-app').style.display = 'block';

  document.getElementById('btn-perfil').onclick = () => Router.irA('perfil');

  Router.construirNav();
  await Router.navegar();

  // Sincroniza vuelos que hayan quedado pendientes de una sesión offline
  // anterior. El listener de `online` en js/offline.js solo dispara con la
  // TRANSICIÓN sin señal → con señal mientras la pestaña ya está abierta —
  // si el piloto cargó un vuelo sin señal y cerró la app del todo, al
  // volver a abrirla ya conectado (ej. llegó a wifi de casa) ese evento
  // nunca se dispara, y el vuelo quedaba encolado en IndexedDB para
  // siempre sin que nada lo mostrara. Acá se intenta también al entrar.
  if (navigator.onLine && window.Offline) {
    Offline.sincronizarPendientes().then((r) => {
      if (r.subidos > 0) document.dispatchEvent(new CustomEvent('vuelos-sincronizados', { detail: r }));
    }).catch(() => {});
  }
}

async function init() {
  inicializarIconosEstaticos();
  aplicarTemaGuardado();
  actualizarBannerOffline();
  window.addEventListener('online', actualizarBannerOffline);
  window.addEventListener('offline', actualizarBannerOffline);
  document.addEventListener('vuelos-sincronizados', (e) => {
    if (window.location.hash.includes('bitacora') || window.location.hash.includes('dashboard') || window.location.hash === '' || window.location.hash === '#') {
      Router.navegar();
    }
  });

  // El SW se registra siempre, pase lo que pase con Supabase abajo — si no,
  // una falla de red al cargar (ver catch de abajo) también te deja sin el
  // shell offline cacheado para la próxima vez.
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Si venís del link de "olvidé mi contraseña", Supabase te deja logueado
  // pero hay que elegir contraseña nueva antes de entrar a la app.
  const esRecuperacion = window.location.hash.includes('type=recovery');

  // El SDK de Supabase (window.db, ver js/supabaseClient.js) viene de un CDN
  // bloqueante — si esa carga falla (sin señal, CDN caído, un bloqueador de
  // contenido) window.db queda undefined y CUALQUIER llamada de acá para
  // abajo tira una excepción. Sin este try/catch, esa excepción quedaba sin
  // capturar dentro de este init() async: la pantalla de login (que recién
  // se muestra más abajo) nunca llegaba a aparecer, y la app quedaba en una
  // pantalla en blanco para siempre, sin ningún aviso de qué pasó.
  try {
    const sesion = await Auth.getSesion();
    if (sesion && !esRecuperacion && inactivoDemasiado()) {
      await Auth.cerrarSesion(); // recarga sola y limpia el cache — no hace falta más acá
      return;
    }
    if (sesion && !esRecuperacion) {
      registrarActividad();
      await mostrarApp();
    } else if (esRecuperacion) {
      await mostrarLogin('panel-nueva-clave');
    } else {
      await mostrarLogin();
    }

    window.db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        await mostrarLogin('panel-nueva-clave');
      } else if (event === 'SIGNED_IN' && session && !esRecuperacion) {
        registrarActividad();
        await mostrarApp();
      } else if (event === 'SIGNED_OUT') {
        await mostrarLogin();
      }
    });

    // Al volver a la pestaña (después de tenerla en segundo plano o
    // minimizada) — dos cosas: si pasó más de una hora sin entrar, cerrar
    // sesión sola; si no, refrescar la pantalla actual, porque nada más en
    // toda la app vuelve a consultar datos solo por volver a mirar la
    // pestaña (esto también es lo que causaba ver datos viejos sin razón).
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return;
      const sesionActual = await Auth.getSesion();
      if (!sesionActual) return;
      if (inactivoDemasiado()) { await Auth.cerrarSesion(); return; }
      registrarActividad();
      if (document.getElementById('vista-app').style.display !== 'none') Router.navegar();
    });
    window.addEventListener('hashchange', registrarActividad);
  } catch (err) {
    console.error('Error inicializando la sesión:', err);
    await mostrarLogin();
    const msg = document.getElementById('login-msg');
    if (msg) msg.innerHTML = Icons.tag('alertTriangle', 'No se pudo conectar con el servidor — revisá tu conexión a internet y recargá la página.');
  }
}

init();
