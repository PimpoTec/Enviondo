// ============================================================================
// Carga scripts de la app (pensados para <script> plano en el navegador,
// que asignan a `window.X`) dentro de un sandbox de Node, para poder
// testear su lógica sin levantar un browser. Cada test arma su propio
// sandbox con solo los scripts que necesita, en orden de dependencia.
// ============================================================================
const fs = require('node:fs');
const vm = require('node:vm');

function loadApp(paths) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.console = console;
  vm.createContext(sandbox);
  for (const p of paths) {
    const code = fs.readFileSync(p, 'utf8');
    vm.runInContext(code, sandbox, { filename: p });
  }
  return sandbox;
}

module.exports = { loadApp };
