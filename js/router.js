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
  { id: 'perfil', label: 'Perfil', icon: 'award', render: (p) => ViewPerfil.render(p) },
];

// Solo estas 4 tienen ícono propio en la barra inferior — Costos y Exportar
// se sacaron a propósito: viven únicamente dentro de Perfil (más "íntimo",
// no un destino de primer nivel). Nuevo vuelo se llega desde botones dentro
// de las pantallas; Perfil, desde el ícono del header.
const RUTAS_NAV_INFERIOR = ['dashboard', 'bitacora', 'aeronaves', 'totales'];

function construirNav() {
  const nav = document.getElementById('bottom-nav');
  nav.setAttribute('role', 'tablist');
  nav.innerHTML = '';
  for (const id of RUTAS_NAV_INFERIOR) {
    const r = RUTAS.find((x) => x.id === id);
    const b = document.createElement('button');
    b.dataset.ruta = r.id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', r.label);
    b.innerHTML = `<span class="ic">${Icons[r.icon](20)}</span><span class="lbl">${r.label}</span>`;
    b.onclick = () => { window.location.hash = '#' + r.id; };
    nav.appendChild(b);
  }
}

async function navegar() {
  const hash = (window.location.hash || '#dashboard').slice(1);
  const [rutaId, queryStr] = hash.split('?');
  const params = new URLSearchParams(queryStr || '');
  const ruta = RUTAS.find((r) => r.id === rutaId) || RUTAS[0];

  document.querySelectorAll('#bottom-nav button[data-ruta]').forEach((b) => {
    const activa = b.dataset.ruta === ruta.id;
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
  } finally {
    cancelarSkeleton();
  }
}

window.Router = { construirNav, navegar, irA: (id) => { window.location.hash = '#' + id; } };
window.addEventListener('hashchange', navegar);
