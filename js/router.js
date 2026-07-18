// ============================================================================
// ROUTER — SPA simple con hash routing (#dashboard, #nuevo-vuelo, etc.)
// ============================================================================

const RUTAS = [
  { id: 'dashboard', label: 'Inicio', icon: '🏠', render: () => ViewDashboard.render() },
  { id: 'nuevo-vuelo', label: 'Nuevo vuelo', icon: '➕', render: (p) => ViewNuevoVuelo.render(p) },
  { id: 'bitacora', label: 'Bitácora', icon: '📒', render: () => ViewBitacora.render() },
  { id: 'aeronaves', label: 'Aeronaves', icon: '🛩️', render: () => ViewAeronaves.render() },
  { id: 'totales', label: 'Totales', icon: '📊', render: () => ViewTotales.render() },
  { id: 'costos', label: 'Costos', icon: '💰', render: () => ViewCostos.render() },
  { id: 'perfil', label: 'Perfil', icon: '🎓', render: () => ViewPerfil.render() },
  { id: 'exportar', label: 'Exportar', icon: '⬇️', render: () => ViewExportar.render() },
];

function construirNav() {
  const desktop = document.getElementById('tabs-desktop');
  const mobile = document.getElementById('tabs-mobile');
  desktop.innerHTML = '';
  mobile.innerHTML = '';
  for (const r of RUTAS) {
    const bd = document.createElement('button');
    bd.textContent = `${r.icon} ${r.label}`;
    bd.dataset.ruta = r.id;
    bd.onclick = () => { window.location.hash = '#' + r.id; };
    desktop.appendChild(bd);

    const bm = document.createElement('button');
    bm.dataset.ruta = r.id;
    bm.innerHTML = `<span class="ic">${r.icon}</span><span>${r.label}</span>`;
    bm.onclick = () => { window.location.hash = '#' + r.id; };
    mobile.appendChild(bm);
  }
}

async function navegar() {
  const hash = (window.location.hash || '#dashboard').slice(1);
  const [rutaId, queryStr] = hash.split('?');
  const params = new URLSearchParams(queryStr || '');
  const ruta = RUTAS.find((r) => r.id === rutaId) || RUTAS[0];

  document.querySelectorAll('nav.tabs button, nav.bottom-nav button').forEach((b) => {
    b.classList.toggle('active', b.dataset.ruta === ruta.id);
  });

  const main = document.getElementById('main-content');
  main.innerHTML = '<p class="muted">Cargando…</p>';
  try {
    await ruta.render(params);
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="card"><p>⚠️ Ocurrió un error cargando esta pantalla.</p><p class="muted">${err.message || err}</p></div>`;
  }
}

window.Router = { construirNav, navegar, irA: (id) => { window.location.hash = '#' + id; } };
window.addEventListener('hashchange', navegar);
