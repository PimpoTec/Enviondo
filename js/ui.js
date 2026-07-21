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

  // Como confirmar(), pero con N botones en vez de solo Aceptar/Cancelar —
  // para cuando hay más de dos caminos posibles (ej. "usar tarifa actual" /
  // "cargar un valor especial"). `botones`: [{label, valor}, ...]. Devuelve
  // el `valor` del botón elegido, o null si se cierra sin elegir (Escape,
  // click afuera).
  function elegir(mensaje, botones) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true">
          <p class="modal-msg">${mensaje}</p>
          <div class="modal-acciones modal-acciones-col">
            ${botones.map((b, i) => `<button class="btn ${i === 0 ? '' : 'secondary'}" data-i="${i}">${b.label}</button>`).join('')}
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
      overlay.querySelectorAll('[data-i]').forEach((btn) => {
        btn.onclick = () => cerrar(botones[Number(btn.dataset.i)].valor);
      });
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cerrar(null); });
      const onKey = (e) => { if (e.key === 'Escape') cerrar(null); };
      document.addEventListener('keydown', onKey);
      overlay.querySelector('[data-i]').focus();
    });
  }

  // Pide un valor numérico (ej. un monto en ARS) con un input propio en vez
  // del prompt() nativo del navegador. Devuelve el número, o null si se
  // cancela o queda vacío.
  function prompt(mensaje, opciones = {}) {
    const { placeholder = '', ok = 'Continuar', cancel = 'Cancelar' } = opciones;
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true">
          <p class="modal-msg">${mensaje}</p>
          <input type="number" step="0.01" min="0" class="modal-input" placeholder="${placeholder}" />
          <div class="modal-acciones">
            <button class="btn secondary" data-r="0">${cancel}</button>
            <button class="btn" data-r="1">${ok}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));
      const input = overlay.querySelector('.modal-input');

      const cerrar = (val) => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 180);
        document.removeEventListener('keydown', onKey);
        resolve(val);
      };
      const aceptar = () => {
        const n = Number(input.value);
        cerrar(input.value !== '' && Number.isFinite(n) && n >= 0 ? n : null);
      };
      overlay.querySelector('[data-r="1"]').onclick = aceptar;
      overlay.querySelector('[data-r="0"]').onclick = () => cerrar(null);
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cerrar(null); });
      const onKey = (e) => {
        if (e.key === 'Escape') cerrar(null);
        else if (e.key === 'Enter') aceptar();
      };
      document.addEventListener('keydown', onKey);
      input.focus();
    });
  }

  // Skeleton de carga que solo aparece si el trabajo tarda más de `delayMs`
  // — para transiciones instantáneas no hay parpadeo de "cargando", y para
  // las que sí tardan, el esqueleto aparece rápido para dar feedback real de
  // que algo está pasando. Devuelve una función para cancelarlo cuando el
  // trabajo termina (si nunca llegó a mostrarse, no hace nada).
  function skeletonDiferido(el, delayMs = 150) {
    const t = setTimeout(() => {
      el.innerHTML = `<div class="card" aria-busy="true">
        <div class="skeleton skeleton-line" style="width:45%"></div>
        <div class="skeleton skeleton-line" style="width:70%"></div>
        <div class="skeleton skeleton-block"></div>
      </div>`;
    }, delayMs);
    return () => clearTimeout(t);
  }

  return { toast, confirmar, elegir, prompt, skeletonDiferido };
})();

window.UI = UI;
