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
  await window.db.auth.signOut();
  window.location.reload();
}

window.Auth = { getSesion, iniciarSesion, registrarse, enviarResetPassword, actualizarPassword, cerrarSesion };
