// ============================================================================
// AUTENTICACIÓN — usa Supabase Auth (magic link por email, sin contraseñas
// para simplificar; es una app de un solo piloto, no hace falta más).
// ============================================================================

async function getSesion() {
  const { data } = await window.db.auth.getSession();
  return data.session;
}

async function enviarMagicLink(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  return window.db.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
}

async function cerrarSesion() {
  await window.db.auth.signOut();
  window.location.reload();
}

window.Auth = { getSesion, enviarMagicLink, cerrarSesion };
