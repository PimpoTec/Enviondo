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

// Solo estas 4 tienen ícono propio en la barra inferior — el resto
// (nuevo vuelo, costos, exportar) se llega desde botones dentro de las
// pantallas, y Perfil se llega desde el ícono del header.
const RUTAS_NAV_INFERIOR = ['dashboard', 'bitacora', 'aeronaves', 'totales'];

function construirNav() {
  const nav = document.getElementById('bottom-nav');
  nav.innerHTML = '';
  for (const id of RUTAS_NAV_INFERIOR) {
    const r = RUTAS.find((x) => x.id === id);
    const b = document.createElement('button');
    b.dataset.ruta = r.id;
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
