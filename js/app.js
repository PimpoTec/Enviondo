// ============================================================================
// BOOTSTRAP DE LA APP
// ============================================================================

function aplicarTemaGuardado() {
  const t = localStorage.getItem('tema');
  if (t) document.documentElement.setAttribute('data-theme', t);
  document.getElementById('btn-theme').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
}

function toggleTema() {
  const actual = document.documentElement.getAttribute('data-theme')
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const nuevo = actual === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nuevo);
  localStorage.setItem('tema', nuevo);
  document.getElementById('btn-theme').textContent = nuevo === 'dark' ? '☀️' : '🌙';
}

function actualizarBannerOffline() {
  document.getElementById('offline-banner').style.display = navigator.onLine ? 'none' : 'block';
}

async function mostrarLogin() {
  document.getElementById('vista-login').style.display = 'flex';
  document.getElementById('vista-app').style.display = 'none';

  document.getElementById('btn-enviar-link').onclick = async () => {
    const email = document.getElementById('login-email').value.trim();
    const msg = document.getElementById('login-msg');
    if (!email) { msg.textContent = 'Ingresá un email válido.'; return; }
    msg.textContent = 'Enviando…';
    const { error } = await Auth.enviarMagicLink(email);
    msg.textContent = error ? `Error: ${error.message}` : '✅ Revisá tu correo y hacé click en el link para entrar.';
  };
}

async function mostrarApp() {
  document.getElementById('vista-login').style.display = 'none';
  document.getElementById('vista-app').style.display = 'block';

  document.getElementById('btn-logout').onclick = () => Auth.cerrarSesion();
  document.getElementById('btn-theme').onclick = toggleTema;

  Router.construirNav();
  await Router.navegar();
}

async function init() {
  aplicarTemaGuardado();
  actualizarBannerOffline();
  window.addEventListener('online', actualizarBannerOffline);
  window.addEventListener('offline', actualizarBannerOffline);
  document.addEventListener('vuelos-sincronizados', (e) => {
    if (window.location.hash.includes('bitacora') || window.location.hash.includes('dashboard') || window.location.hash === '' || window.location.hash === '#') {
      Router.navegar();
    }
  });

  const sesion = await Auth.getSesion();
  if (sesion) {
    await mostrarApp();
  } else {
    await mostrarLogin();
  }

  window.db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await mostrarApp();
    } else if (event === 'SIGNED_OUT') {
      await mostrarLogin();
    }
  });

  if (navigator.serviceWorker) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
