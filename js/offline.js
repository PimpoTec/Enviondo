// ============================================================================
// COLA OFFLINE — permite cargar un vuelo sin señal y sincronizarlo después.
// Usa IndexedDB (vía un wrapper mínimo, sin librerías) para guardar vuelos
// pendientes de subir. Cuando vuelve la conexión, `sincronizarPendientes()`
// los manda a Supabase uno por uno.
// ============================================================================

const DB_NAME = 'libro_vuelo_offline';
const STORE = 'vuelos_pendientes';

function abrirIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(STORE)) {
        idb.createObjectStore(STORE, { keyPath: 'localId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function guardarVueloPendiente(vuelo) {
  const idb = await abrirIDB();
  const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ localId, vuelo, creado: Date.now() });
    tx.oncomplete = () => resolve(localId);
    tx.onerror = () => reject(tx.error);
  });
}

async function listarVuelosPendientes() {
  const idb = await abrirIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function borrarVuelosPendiente(localId) {
  const idb = await abrirIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function sincronizarPendientes() {
  if (!navigator.onLine) return { subidos: 0, error: 'sin conexión' };
  const pendientes = await listarVuelosPendientes();
  let subidos = 0;
  for (const p of pendientes) {
    const { error } = await window.db.from('vuelos').insert(p.vuelo);
    if (!error) {
      await borrarVuelosPendiente(p.localId);
      subidos++;
    }
  }
  // Los vuelos recién subidos no estaban en el cache local de "todos los
  // vuelos" — sin esto, la próxima pantalla mostraría la lista vieja.
  if (subidos > 0) window.Cache?.invalidar('vuelos_todos');
  return { subidos, total: pendientes.length };
}

window.Offline = {
  guardarVueloPendiente, listarVuelosPendientes, borrarVuelosPendiente, sincronizarPendientes,
};

window.addEventListener('online', async () => {
  const r = await sincronizarPendientes();
  if (r.subidos > 0) {
    document.dispatchEvent(new CustomEvent('vuelos-sincronizados', { detail: r }));
  }
});
