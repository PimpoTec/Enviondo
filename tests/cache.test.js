const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

// loadApp.js no provee localStorage (no existe en un sandbox de Node) — para
// probar el cache real (no solo la rama "sin cache") armamos un localStorage
// falso mínimo y lo inyectamos antes de correr js/cache.js.
function loadConLocalStorage() {
  const sandbox = {};
  sandbox.window = sandbox;
  // El "store" ES el objeto expuesto como localStorage: los datos quedan como
  // propiedades enumerables (para que Object.keys(localStorage) los vea, tal
  // como en invalidarTodo()) y los métodos, no enumerables, para que no
  // aparezcan mezclados como si fueran claves guardadas.
  const ls = {};
  const metodo = (fn) => ({ value: fn, enumerable: false, configurable: true });
  Object.defineProperties(ls, {
    getItem: metodo((k) => (Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null)),
    setItem: metodo((k, v) => { ls[k] = String(v); }),
    removeItem: metodo((k) => { delete ls[k]; }),
  });
  sandbox.localStorage = ls;
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, '..', 'js/cache.js'), 'utf8');
  vm.runInContext(code, sandbox);
  return sandbox;
}

// Nota: los valores que pasan por JSON.parse dentro del sandbox de vm quedan
// en su propio "realm" — assert.deepEqual (estricto) los rechaza aunque el
// contenido sea idéntico, por no compartir el mismo Array/Object global.
// Comparar por JSON.stringify evita ese falso negativo.
test('conCache: sin nada guardado, espera fetchFn y lo cachea', async () => {
  const { Cache } = loadConLocalStorage();
  let llamadas = 0;
  const fetchFn = async () => { llamadas++; return ['a', 'b']; };
  const r1 = await Cache.conCache('x', fetchFn);
  assert.equal(JSON.stringify(r1), JSON.stringify(['a', 'b']));
  assert.equal(llamadas, 1);
  assert.equal(JSON.stringify(Cache.leer('x')), JSON.stringify(['a', 'b']));
});

test('conCache: con algo cacheado, devuelve eso al instante (no espera fetchFn)', async () => {
  const { Cache } = loadConLocalStorage();
  Cache.escribir('y', { viejo: true });
  let resuelto = false;
  const fetchFn = () => new Promise((r) => setTimeout(() => { resuelto = true; r({ viejo: false }); }, 50));
  const resultado = await Cache.conCache('y', fetchFn);
  assert.equal(JSON.stringify(resultado), JSON.stringify({ viejo: true })); // el valor cacheado, no el fresco
  assert.equal(resuelto, false); // fetchFn todavía no terminó cuando conCache ya resolvió
});

test('invalidar: saca una clave puntual sin tocar las demás', () => {
  const { Cache } = loadConLocalStorage();
  Cache.escribir('a', 1);
  Cache.escribir('b', 2);
  Cache.invalidar('a');
  assert.equal(Cache.leer('a'), null);
  assert.equal(Cache.leer('b'), 2);
});

test('invalidarTodo: borra todo lo cacheado por la app', () => {
  const { Cache } = loadConLocalStorage();
  Cache.escribir('a', 1);
  Cache.escribir('b', 2);
  Cache.invalidarTodo();
  assert.equal(Cache.leer('a'), null);
  assert.equal(Cache.leer('b'), null);
});
