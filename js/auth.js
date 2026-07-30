// ============================================================================
// AUTENTICACIÓN — email + contraseña, vía Supabase Auth.
// ============================================================================

async function getSesion() {
  const { data } = await window.db.auth.getSession();
  return data.session;
}

async function iniciarSesion(email, password) {
  return window.db.auth.signInWithPassword({ email, password });
}

async function registrarse(email, password) {
  const redirectTo = window.location.origin + window.location.pathname;
  return window.db.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
}

async function enviarResetPassword(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  return window.db.auth.resetPasswordForEmail(email, { redirectTo });
}

async function actualizarPassword(nuevaPassword) {
  return window.db.auth.updateUser({ password: nuevaPassword });
}

async function cerrarSesion() {
  // Si hay vuelos cargados sin conexión y todavía no se subieron, se intenta
  // ahora (con la sesión todavía activa) para no perderlos.
  await window.Offline?.sincronizarPendientes().catch(() => { /* noop */ });
  await window.db.auth.signOut();
  // Si otra cuenta entra en el mismo dispositivo después, no tiene que ver
  // ni por un instante datos cacheados de esta sesión, ni terminar subiendo
  // bajo esa cuenta un vuelo pendiente que no llegó a sincronizarse.
  window.Cache?.invalidarTodo();
  await window.Offline?.borrarTodosPendientes().catch(() => { /* noop */ });
  window.location.reload();
}

// Borra la cuenta y TODOS sus datos (aeronaves, vuelos, fotos, etc. — ver
// supabase/functions/borrar-cuenta) y cierra la sesión local. Tira si la
// función no está desplegada o si algo falla del lado del servidor — el
// caller es responsable de mostrar el error, acá no se hace nada más.
async function borrarCuenta() {
  const { data, error } = await window.db.functions.invoke(window.BORRAR_CUENTA_FN_SLUG, { body: {} });
  if (error) throw new Error(await window.mensajeDeErrorFuncion(error));
  if (data?.error) throw new Error(data.error);
  await window.db.auth.signOut();
  window.Cache?.invalidarTodo();
  await window.Offline?.borrarTodosPendientes().catch(() => { /* noop */ });
  window.location.reload();
}

window.Auth = { getSesion, iniciarSesion, registrarse, enviarResetPassword, actualizarPassword, cerrarSesion, borrarCuenta };
