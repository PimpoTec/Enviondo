// ============================================================================
// AUTOCOMPLETE — sugerencias de aeródromo mientras el piloto tipea en un
// campo OACI. Local, sin red: filtra window.AERODROMOS por código o nombre.
// ============================================================================

const Autocomplete = {
  attachAerodromo(input) {
    if (!input || input.dataset.autocompleteAttached) return;
    input.dataset.autocompleteAttached = '1';
    input.setAttribute('autocomplete', 'off');

    const wrap = input.parentElement;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

    const lista = document.createElement('div');
    lista.className = 'autocomplete-list';
    lista.style.display = 'none';
    wrap.appendChild(lista);

    const cerrar = () => { lista.style.display = 'none'; lista.innerHTML = ''; };

    input.addEventListener('input', () => {
      const q = input.value.trim().toUpperCase();
      if (q.length < 1) { cerrar(); return; }
      const matches = (window.AERODROMOS || []).filter((a) =>
        a.code.startsWith(q) || a.nombre.toUpperCase().includes(q) || a.ciudad.toUpperCase().includes(q)
      ).slice(0, 8);
      if (!matches.length) { cerrar(); return; }
      lista.innerHTML = matches.map((a) => `
        <div class="autocomplete-item" data-code="${a.code}">
          <span class="mono">${a.code}</span>
          <span class="autocomplete-detalle">${a.nombre}${a.ciudad ? ' — ' + a.ciudad : ''}${a.provincia ? ' (' + a.provincia + ')' : ''}</span>
        </div>`).join('');
      lista.style.display = 'block';
    });

    lista.addEventListener('mousedown', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      e.preventDefault();
      input.value = item.dataset.code;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      cerrar();
    });

    input.addEventListener('blur', () => setTimeout(cerrar, 150));
  },
};

window.Autocomplete = Autocomplete;
