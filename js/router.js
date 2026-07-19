// ============================================================================
// ROUTER — SPA simple con hash routing (#dashboard, #nuevo-vuelo, etc.)
// ============================================================================

const RUTAS = [
  { id: 'dashboard', label: 'Inicio', icon: 'home', render: () => ViewDashboard.render() },
  { id: 'nuevo-vuelo', label: 'Nuevo vuelo', icon: 'plusCircle', render: (p) => ViewNuevoVuelo.render(p) },
  { id: 'bitacora', label: 'Bitácora', icon: 'list', render: () => ViewBitacora.render() },
  { id: 'aeronaves', label: 'Aeronaves', icon: 'plane', render: () => ViewAeronaves.render() },
  { id: 'totales', label: 'Totales', icon: 'barChart', render: () => ViewTotales.render() },
  { id: 'costos', label: 'Costos', icon: 'dollar', render: () => ViewCostos.render() },
  { id: 'perfil', label: 'Perfil', icon: 'award', render: () => ViewPerfil.render() },
  { id: 'exportar', label: 'Exportar', icon: 'download', render: () => ViewExportar.render() },
];

function construirNav() {
  const drawer = document.getElementById('drawer-menu');
  drawer.innerHTML = `<div class="drawer-titulo">${Icons.plane(18)} Libro de Vuelo</div>`;
  for (const r of RUTAS) {
    const b = document.createElement('button');
    b.dataset.ruta = r.id;
    b.innerHTML = `<span class="ic">${Icons[r.icon](18)}</span><span>${r.label}</span>`;
    b.onclick = () => { window.location.hash = '#' + r.id; cerrarMenu(); };
    drawer.appendChild(b);
  }

  document.getElementById('btn-menu').onclick = abrirMenu;
  document.getElementById('drawer-overlay').onclick = cerrarMenu;
}

function abrirMenu() {
  document.getElementById('drawer-menu').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('open');
}
function cerrarMenu() {
  document.getElementById('drawer-menu').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
}

async function navegar() {
  const hash = (window.location.hash || '#dashboard').slice(1);
  const [rutaId, queryStr] = hash.split('?');
  const params = new URLSearchParams(queryStr || '');
  const ruta = RUTAS.find((r) => r.id === rutaId) || RUTAS[0];

  document.querySelectorAll('#drawer-menu button[data-ruta]').forEach((b) => {
    b.classList.toggle('active', b.dataset.ruta === ruta.id);
  });

  const main = document.getElementById('main-content');
  main.innerHTML = '<p class="muted">Cargando…</p>';
  try {
    await ruta.render(params);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="card"><p>${Icons.tag('alertTriangle', 'Ocurrió un error cargando esta pantalla.')}</p><p class="muted">${err.message || err}</p></div>`;
  }
}

window.Router = { construirNav, navegar, irA: (id) => { window.location.hash = '#' + id; } };
window.addEventListener('hashchange', navegar);
