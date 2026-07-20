// ============================================================================
// BOOTSTRAP DE LA APP
// ============================================================================

function aplicarTemaGuardado() {
  const t = localStorage.getItem('tema');
  if (t) document.documentElement.setAttribute('data-theme', t);
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
}

async function mostrarApp() {
  document.getElementById('vista-login').style.display = 'none';
  document.getElementById('vista-app').style.display = 'block';

  document.getElementById('btn-perfil').onclick = () => Router.irA('perfil');

  Router.construirNav();
  await Router.navegar();
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

  // Si venís del link de "olvidé mi contraseña", Supabase te deja logueado
  // pero hay que elegir contraseña nueva antes de entrar a la app.
  const esRecuperacion = window.location.hash.includes('type=recovery');

  const sesion = await Auth.getSesion();
  if (sesion && !esRecuperacion) {
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
