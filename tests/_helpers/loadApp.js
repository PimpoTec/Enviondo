// ============================================================================
// Carga scripts de la app (pensados para <script> plano en el navegador,
// que asignan a `window.X`) dentro de un sandbox de Node, para poder
// testear su lógica sin levantar un browser. Cada test arma su propio
// sandbox con solo los scripts que necesita, en orden de dependencia.
// ============================================================================
const fs = require('node:fs');
const vm = require('node:vm');

// Storage en memoria — suficiente para probar código que usa localStorage
// (caches, registros) sin levantar un browser de verdad.
class MemoryStorage {
  constructor() { this._m = new Map(); }
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }
  setItem(k, v) { this._m.set(k, String(v)); }
  removeItem(k) { this._m.delete(k); }
  clear() { this._m.clear(); }
}

function loadApp(paths) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.console = console;
  sandbox.URL = URL;
  sandbox.URLSearchParams = URLSearchParams;
  sandbox.localStorage = new MemoryStorage();
  vm.createContext(sandbox);
  for (const p of paths) {
    const code = fs.readFileSync(p, 'utf8');
    vm.runInContext(code, sandbox, { filename: p });
  }
  return sandbox;
}

module.exports = { loadApp };
