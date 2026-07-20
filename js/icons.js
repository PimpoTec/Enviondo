// ============================================================================
// ICONS — set de íconos SVG de línea (estilo Feather), reemplaza los emojis.
// Uso: Icons.home(18) devuelve el string de un <svg> listo para innerHTML.
// ============================================================================

const Icons = (() => {
  function svg(paths, size = 18) {
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  }
  return {
    plane: (s) => svg('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7Z"/>', s),
    home: (s) => svg('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>', s),
    plusCircle: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', s),
    list: (s) => svg('<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>', s),
    barChart: (s) => svg('<path d="M18 20V10M12 20V4M6 20v-6"/>', s),
    dollar: (s) => svg('<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', s),
    award: (s) => svg('<circle cx="12" cy="8" r="6"/><path d="M8.7 13.8 7 22l5-3 5 3-1.7-8.2"/>', s),
    download: (s) => svg('<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>', s),
    menu: (s) => svg('<path d="M4 6h16M4 12h16M4 18h16"/>', s),
    moon: (s) => svg('<path d="M20 12.5A8.5 8.5 0 1 1 11.5 4a7 7 0 0 0 8.5 8.5Z"/>', s),
    sun: (s) => svg('<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/>', s),
    logOut: (s) => svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>', s),
    checkCircle: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/>', s),
    alertTriangle: (s) => svg('<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>', s),
    xCircle: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>', s),
    edit: (s) => svg('<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>', s),
    trash: (s) => svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>', s),
    save: (s) => svg('<path d="M5 4h11l3 3v13H5V4Z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/>', s),
    wifiOff: (s) => svg('<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 4-2.5"/><path d="M13.5 8.2A15 15 0 0 1 20 10.5"/><circle cx="12" cy="20" r="1"/>', s),
    clock: (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>', s),
    shieldCheck: (s) => svg('<path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5Z"/><path d="M9 12l2 2 4-4"/>', s),
    chevronRight: (s) => svg('<path d="M9 18l6-6-6-6"/>', s),
    calendar: (s) => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>', s),
    idCard: (s) => svg('<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="12" r="2"/><path d="M6 16.5c.5-1.5 1.8-2.5 2.5-2.5s2 1 2.5 2.5"/><path d="M14 10h5M14 14h5"/>', s),
    medical: (s) => svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M12 11v6M9 14h6"/>', s),
    print: (s) => svg('<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="1"/><path d="M6 17v4h12v-4"/>', s),
    archive: (s) => svg('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>', s),
    monitor: (s) => svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', s),
    wrench: (s) => svg('<path d="M14.7 6.3a4 4 0 0 0-5.6 4.6L3 17l4 4 6.1-6.1a4 4 0 0 0 4.6-5.6l-2.7 2.7-2-2Z"/>', s),
    shield: (s) => svg('<path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5Z"/>', s),
    lock: (s) => svg('<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', s),
    person: (s) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>', s),
    star: (s) => svg('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.8 6.8 19.7l1-5.9-4.3-4.1 5.9-.8Z"/>', s),
    search: (s) => svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', s),
    landing: (s) => svg('<path d="M3 21h18"/><path d="M4 17 20 9"/><path d="M9 12.5 6 17"/><path d="M15 5.5 12 10"/>', s),
    bell: (s) => svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', s),
    bellOff: (s) => svg('<path d="M2 2l20 20"/><path d="M8.7 3.7A6 6 0 0 1 18 8c0 3.5 1 5.8 1.9 7.2"/><path d="M6.3 6.3C6.1 6.9 6 7.6 6 8c0 7-3 9-3 9h13"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', s),
    tag(name, text) {
      return `<span style="display:inline-flex;align-items:center;gap:6px">${this[name](14)}<span>${text}</span></span>`;
    },
  };
})();

window.Icons = Icons;
