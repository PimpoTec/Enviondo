// ============================================================================
// ROUTER — SPA simple con hash routing (#dashboard, #nuevo-vuelo, etc.)
// ============================================================================

const RUTAS = [
  { id: 'dashboard', label: 'Inicio', icon: 'home', render: () => ViewDashboard.render() },
  { id: 'nuevo-vuelo', label: 'Nuevo vuelo', icon: 'plusCircle', render: (p) => ViewNuevoVuelo.render(p) },
  { id: 'bitacora', label: 'Bitácora', icon: 'list', render: () => ViewBitacora.render() },
  { id: 'aeronaves', label: 'Aeronaves', icon: 'plane', render: () => ViewAeronaves.render() },
  { id: 'totales', label: 'Totales', icon: 'barChart', render: () => ViewTotales.render() },
  { id: 'exportar', label: 'Costos', icon: 'dollar', render: () => ViewExportar.render() },
  { id: 'perfil', label: 'Perfil', icon: 'award', render: () => ViewPerfil.render() },
  // 'costos' quedó sin ruta propia: su contenido vive ahora en Exportar
  // (que reusa las funciones de desglose de js/views/costos.js).
];

// Íconos propios en la barra inferior. Exportar (rotulado "Costos" porque ahí
// vive el resumen de gastos + la exportación) se sumó para no dejarlo escondido
// dentro de Perfil. Nuevo vuelo se llega desde botones; Perfil, desde el header.
const RUTAS_NAV_INFERIOR = ['dashboard', 'bitacora', 'aeronaves', 'totales', 'exportar'];

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
  main.innerHTML = `<div class="card" aria-busy="true">
    <div class="skeleton skeleton-line" style="width:45%"></div>
    <div class="skeleton skeleton-line" style="width:70%"></div>
    <div class="skeleton skeleton-block"></div>
  </div>`;
  try {
    await ruta.render(params);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="card"><p>${Icons.tag('alertTriangle', 'Ocurrió un error cargando esta pantalla.')}</p><p class="muted">${err.message || err}</p></div>`;
  }
}

window.Router = { construirNav, navegar, irA: (id) => { window.location.hash = '#' + id; } };
window.addEventListener('hashchange', navegar);
