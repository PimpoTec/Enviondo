// ============================================================================
// ROUTER — SPA simple con hash routing (#dashboard, #nuevo-vuelo, etc.)
// ============================================================================

const RUTAS = [
  { id: 'dashboard', label: 'Inicio', icon: 'home', render: () => ViewDashboard.render() },
  { id: 'nuevo-vuelo', label: 'Nuevo vuelo', icon: 'plusCircle', render: (p) => ViewNuevoVuelo.render(p) },
  { id: 'bitacora', label: 'Bitácora', icon: 'list', render: (p) => ViewBitacora.render(p) },
  { id: 'aeronaves', label: 'Aeronaves', icon: 'plane', render: () => ViewAeronaves.render() },
  { id: 'totales', label: 'Totales', icon: 'barChart', render: () => ViewTotales.render() },
  { id: 'costos', label: 'Costos', icon: 'dollar', render: () => ViewCostos.render() },
  { id: 'exportar', label: 'Exportar', icon: 'download', render: () => ViewExportar.render() },
  { id: 'organizaciones', label: 'Organizaciones', icon: 'users', render: () => ViewOrganizaciones.render() },
  { id: 'escuela', label: 'Escuela', icon: 'plane', render: (p) => ViewEscuela.render(p) },
  { id: 'perfil', label: 'Perfil', icon: 'award', render: (p) => ViewPerfil.render(p) },
];

// Solo estas 4 tienen ícono propio en la barra inferior en el modo "piloto"
// — Costos y Exportar se sacaron a propósito: viven únicamente dentro de
// Perfil (más "íntimo", no un destino de primer nivel). Nuevo vuelo se
// llega desde botones dentro de las pantallas; Perfil, desde el ícono del
// header.
const RUTAS_NAV_PILOTO = ['dashboard', 'bitacora', 'aeronaves', 'totales'];

// La barra de abajo cambia de significado según dónde estás: un piloto
// viendo su propio libro de vuelo necesita Inicio/Bitácora/Aeronaves/
// Totales; el mismo piloto adentro de "su" escuela (como owner/admin
// gestionándola, o como miembro reservando turnos) no tiene ningún uso
// para esos 4 — ahí la barra pasa a ser la de la organización, con un
// botón para volver a "modo piloto". Se decide mirando el hash actual, no
// guardando un estado aparte, así que refrescar la página cae siempre del
// lado correcto.
function estaEnModoEscuela(rutaId, params) {
  return rutaId === 'escuela' && params.get('org');
}

function navEscuela(params) {
  const org = params.get('org');
  const tipo = params.get('tipo') || 'escuela';
  const base = `#escuela?org=${org}&tipo=${tipo}`;
  return [
    { id: 'escuela-dashboard', label: 'Escuela', icon: 'plane', hash: `${base}&vista=dashboard` },
    tipo === 'empresa'
      ? { id: 'escuela-despacho', label: 'Despacho', icon: 'calendar', hash: `${base}&vista=despacho` }
      : { id: 'escuela-turnos', label: 'Turnos', icon: 'calendar', hash: `${base}&vista=turnos` },
    { id: 'escuela-flota', label: 'Flota', icon: 'plane', hash: `${base}&vista=flota` },
    { id: 'escuela-piloto', label: 'Piloto', icon: 'home', hash: '#dashboard' },
  ];
}

// Solo se llama en modo piloto (en modo escuela ya tenemos org/tipo en la
// URL, no hace falta ir a la red para armar la barra) — así que el costo
// de esta consulta de más se paga solo cuando hace falta.
async function tieneOrganizacionesActivas() {
  try {
    const membresias = await Repo.listarMisOrganizaciones();
    return membresias.some((m) => m.estado === 'activo' && m.organizaciones?.estado === 'activa');
  } catch { return false; }
}

async function construirNav(rutaId, params) {
  const nav = document.getElementById('bottom-nav');
  nav.setAttribute('role', 'tablist');

  let items;
  if (estaEnModoEscuela(rutaId, params)) {
    items = navEscuela(params);
  } else {
    items = RUTAS_NAV_PILOTO.map((id) => {
      const r = RUTAS.find((x) => x.id === id);
      return { id: r.id, label: r.label, icon: r.icon, hash: '#' + r.id };
    });
    if (await tieneOrganizacionesActivas()) {
      items = [...items, { id: 'escuela', label: 'Escuela', icon: 'plane', hash: '#escuela' }];
    }
  }

  nav.innerHTML = '';
  for (const item of items) {
    const b = document.createElement('button');
    b.dataset.ruta = item.id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', item.label);
    b.innerHTML = `<span class="ic">${Icons[item.icon](20)}</span><span class="lbl">${item.label}</span>`;
    b.onclick = () => { window.location.hash = item.hash; };
    nav.appendChild(b);
  }
}

async function navegar() {
  const hash = (window.location.hash || '#dashboard').slice(1);
  const [rutaId, queryStr] = hash.split('?');
  const params = new URLSearchParams(queryStr || '');
  const ruta = RUTAS.find((r) => r.id === rutaId) || RUTAS[0];

  await construirNav(ruta.id, params);
  document.querySelectorAll('#bottom-nav button[data-ruta]').forEach((b) => {
    const activa = b.dataset.ruta === ruta.id || (ruta.id === 'escuela' && b.dataset.ruta.startsWith('escuela-') && b.dataset.ruta === `escuela-${params.get('vista') || 'dashboard'}`);
    b.classList.toggle('active', activa);
    b.setAttribute('aria-selected', activa ? 'true' : 'false');
  });

  const main = document.getElementById('main-content');
  // El esqueleto solo se muestra si la pantalla tarda más de un instante —
  // si la navegación es casi inmediata, no hay parpadeo de "cargando".
  const cancelarSkeleton = UI.skeletonDiferido(main);
  try {
    await ruta.render(params);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="card"><p>${Icons.tag('alertTriangle', 'Ocurrió un error cargando esta pantalla.')}</p><p class="muted">${err.message || err}</p></div>`;
    // Este catch ya maneja el error (la pantalla no queda rota), así que
    // nunca llega a ser un "unhandled error" que agarre window.onerror —
    // se reporta acá a mano para que quede el mismo registro.
    if (window.ErrorLog) ErrorLog.registrar(`Error renderizando #${ruta.id}: ${err.message || err}`, err.stack);
  } finally {
    cancelarSkeleton();
  }
  actualizarBadgePerfil();
}

// Punto rojo en el ícono de Perfil del header cuando hay un vencimiento
// vencido (CMA, habilitación, IFR, repaso de vuelo) — antes esto solo se
// veía entrando 2 clics adentro de Perfil → Alertas, así que un piloto
// podía no enterarse. Se recalcula en cada navegación (usa el cache de
// vencimientos, así que no pega a la red en cada pantalla); si falla (sin
// sesión todavía, sin conexión) no fuerza el punto, total se va a
// recalcular solo en la próxima navegación.
async function actualizarBadgePerfil() {
  const btn = document.getElementById('btn-perfil');
  if (!btn) return;
  try {
    const vencimientos = await Repo.listarVencimientos();
    const hayVencido = typeof estadoVencimiento === 'function'
      && vencimientos.some((v) => estadoVencimiento(v).estado === 'danger');
    btn.classList.toggle('con-badge', hayVencido);
  } catch { /* sin sesión/señal todavía: se recalcula en la próxima navegación */ }
}

window.Router = {
  construirNav: () => { const hash = (window.location.hash || '#dashboard').slice(1); const [id, q] = hash.split('?'); return construirNav(id, new URLSearchParams(q || '')); },
  navegar,
  irA: (id) => { window.location.hash = '#' + id; },
};
window.addEventListener('hashchange', navegar);
