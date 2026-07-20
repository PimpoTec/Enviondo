// ============================================================================
// UI — avisos (toasts) y confirmaciones propias, para no depender de los
// alert()/confirm() nativos del navegador (feos, bloqueantes y fuera de la
// identidad visual de la app).
//
// - UI.toast(mensaje, tipo)  → aviso efímero (tipo: 'ok'|'error'|'warn'|'info').
// - UI.confirmar(mensaje, opts) → Promise<boolean>; resuelve true/false según
//   lo que elija el usuario en un diálogo modal propio.
// ============================================================================

const UI = (() => {
  let cont = null;
  function _cont() {
    if (!cont) {
      cont = document.createElement('div');
      cont.className = 'toast-cont';
      document.body.appendChild(cont);
    }
    return cont;
  }

  const ICONO = { ok: 'checkCircle', error: 'xCircle', warn: 'alertTriangle', info: 'checkCircle' };

  function toast(mensaje, tipo = 'info', ms = 3800) {
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.innerHTML = `${Icons[ICONO[tipo] || 'checkCircle'](16)}<span>${mensaje}</span>`;
    _cont().appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    const cerrar = () => { el.classList.remove('visible'); setTimeout(() => el.remove(), 200); };
    const t = setTimeout(cerrar, ms);
    el.onclick = () => { clearTimeout(t); cerrar(); };
    return el;
  }

  function confirmar(mensaje, opciones = {}) {
    const { ok = 'Aceptar', cancel = 'Cancelar', peligro = false } = opciones;
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true">
          <p class="modal-msg">${mensaje}</p>
          <div class="modal-acciones">
            <button class="btn secondary" data-r="0">${cancel}</button>
            <button class="btn ${peligro ? 'danger' : ''}" data-r="1">${ok}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));

      const cerrar = (val) => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 180);
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      overlay.querySelector('[data-r="1"]').onclick = () => cerrar(true);
      overlay.querySelector('[data-r="0"]').onclick = () => cerrar(false);
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cerrar(false); });
      const onKey = (e) => {
        if (e.key === 'Escape') cerrar(false);
        else if (e.key === 'Enter') cerrar(true);
      };
      document.addEventListener('keydown', onKey);
      overlay.querySelector('[data-r="1"]').focus();
    });
  }

  return { toast, confirmar };
})();

window.UI = UI;
