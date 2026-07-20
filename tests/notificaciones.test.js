const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

// El sandbox de vm.createContext no trae atob (es global de Node/browser,
// no del motor V8 puro) — lo inyectamos a mano, igual que loadApp.js hace
// con otras globales que los scripts de la app dan por sentadas.
function cargarNotificaciones() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, '..', 'js/notificaciones.js'), 'utf8');
  vm.runInContext(code, sandbox);
  return sandbox;
}

test('urlBase64ToUint8Array: convierte una clave VAPID base64url a los mismos bytes que Buffer', () => {
  const sandbox = cargarNotificaciones();
  // Clave de ejemplo con '-' y '_' (los caracteres que distinguen base64url
  // del base64 normal) y longitud que necesita padding.
  const original = 'BEl62iUYgUivxIkv69yViEuiBIa40HI0DLLuxazjqAKoTWNq2VuUAhAZ_ByEQU-vBrsjRxbIAcMGWAn2VBZQjTk';
  const resultado = sandbox.urlBase64ToUint8Array(original);

  const base64Normal = original.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64Normal.length % 4)) % 4);
  const esperado = new Uint8Array(Buffer.from(base64Normal + padding, 'base64'));

  assert.equal(resultado.length, esperado.length);
  assert.equal(JSON.stringify(Array.from(resultado)), JSON.stringify(Array.from(esperado)));
});

test('urlBase64ToUint8Array: una clave sin caracteres especiales también funciona', () => {
  const sandbox = cargarNotificaciones();
  const resultado = sandbox.urlBase64ToUint8Array('QUJD');
  assert.equal(JSON.stringify(Array.from(resultado)), JSON.stringify([65, 66, 67]));
});
