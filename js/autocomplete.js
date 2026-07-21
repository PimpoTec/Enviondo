// ============================================================================
// AUTOCOMPLETE — sugerencias de aeródromo mientras el piloto tipea en un
// campo OACI. Local, sin red: filtra window.AERODROMOS por cualquiera de
// sus tres códigos (local, OACI o IATA) o por nombre/ciudad — muchos
// aeródromos argentinos tienen los tres (ej. Ezeiza: local EZE, OACI
// SAEZ, IATA EZE) y el piloto puede conocerlo por cualquiera. Elijas el
// que elijas, siempre se guarda el mismo código canónico ("code": OACI si
// tiene, si no el local) — así el mismo aeródromo no queda partido en dos
// según con qué código lo hayas tipeado esta vez.
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
        a.code.startsWith(q) || (a.local && a.local.startsWith(q)) || (a.icao && a.icao.startsWith(q)) || (a.iata && a.iata.startsWith(q))
        || a.nombre.toUpperCase().includes(q) || a.ciudad.toUpperCase().includes(q)
      ).slice(0, 8);
      if (!matches.length) { cerrar(); return; }
      lista.innerHTML = matches.map((a) => {
        // Si tiene otros códigos además del canónico, los mostramos aparte
        // — así confirmás que encontraste el aeródromo correcto aunque
        // hayas tipeado el local/IATA en vez del que termina guardándose.
        const otros = [a.local, a.icao, a.iata].filter((c) => c && c !== a.code);
        return `
        <div class="autocomplete-item" data-code="${a.code}">
          <span class="mono">${a.code}${otros.length ? ` <span class="muted">(${otros.join(' · ')})</span>` : ''}</span>
          <span class="autocomplete-detalle">${a.nombre}${a.ciudad ? ' — ' + a.ciudad : ''}${a.provincia ? ' (' + a.provincia + ')' : ''}</span>
        </div>`;
      }).join('');
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
