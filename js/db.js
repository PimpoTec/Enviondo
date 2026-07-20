// ============================================================================
// CAPA DE DATOS — wrappers finos sobre Supabase para cada tabla.
// ============================================================================

// Cursos/carreras soportados. "id" es el valor corto que se guarda en
// perfil_piloto.curso_activo y en licencias_requisitos.curso_id. Los
// mínimos de cada uno viven en la base (tabla global licencias_requisitos,
// sembrada en sql/schema.sql con los valores de la RAAC Parte 61 Ed. VI).
const CURSOS = [
  { id: 'APPL', label: 'APPL — Piloto de Planeador (en curso)' },
  { id: 'PPA', label: 'PPA — Piloto Privado de Avión (APPA mientras estás en curso)' },
  { id: 'PCA', label: 'PCA — Piloto Comercial de Avión' },
  { id: 'PCA_HVI', label: 'PCA + HVI — Piloto Comercial con Habilitación de Vuelo por Instrumentos' },
  { id: 'TLA', label: 'TLA — Piloto de Transporte de Línea Aérea' },
  { id: 'HAB_NOC', label: 'Habilitación de Vuelo Nocturno (RAAC vigente)' },
];

// getSession() lee la sesión guardada localmente (rápido, sin red); getUser()
// SIEMPRE hace un viaje de ida y vuelta al servidor de Supabase para
// revalidarla — apropiado si necesitás verificar la sesión con el servidor,
// pero acá solo usamos el id para escribir filas propias, y la seguridad real
// la impone RLS del lado del servidor de todas formas (no esta función). Este
// cambio le saca un round-trip de red a cada "guardar" de la app.
async function usuarioActual() {
  const { data } = await window.db.auth.getSession();
  return data.session?.user;
}

const Repo = {
  // ---- Aeronaves ----
  // Solo cambian cuando vos guardás/borrás una ficha con los propios botones
  // de la app — se cachean localmente (ver js/cache.js) para que abrir la
  // pantalla no espere la red si ya las tenés.
  async listarAeronaves() {
    return Cache.conCache('aeronaves', async () => {
      const { data, error } = await window.db.from('aeronaves').select('*').order('es_habitual', { ascending: false }).order('matricula');
      if (error) throw error;
      return data;
    });
  },
  async guardarAeronave(aeronave) {
    const user = await usuarioActual();
    if (aeronave.id) {
      const { error } = await window.db.from('aeronaves').update(aeronave).eq('id', aeronave.id);
      if (error) throw error;
    } else {
      const { error } = await window.db.from('aeronaves').insert({ ...aeronave, user_id: user.id });
      if (error) throw error;
    }
    Cache.invalidar('aeronaves');
  },
  async borrarAeronave(id) {
    const { error } = await window.db.from('aeronaves').delete().eq('id', id);
    if (error) throw error;
    Cache.invalidar('aeronaves');
  },

  // ---- Vuelos ----
  // "Borrar" es soft-delete (deleted_at) — el vuelo sale de la bitácora,
  // totales y progreso, pero se puede restaurar desde la Papelera (Perfil)
  // hasta que se vacíe a mano. Un libro de vuelo es un registro con peso
  // legal hacia la licencia; un borrado accidental sin vuelta atrás es
  // demasiado costoso como para no tener red de seguridad.
  // Solo cachea el pedido "todos los vuelos, sin filtro" (el que usan
  // Dashboard/Bitácora inicial/Totales/Costos/Perfil) — los pedidos con
  // filtros (Bitácora filtrada, Exportar) son variados y menos frecuentes,
  // así que van directo a la red.
  async listarVuelos(filtros = {}) {
    const sinFiltros = !filtros.desde && !filtros.hasta && !filtros.aeronave_id && !filtros.finalidad_vuelo;
    const fetchFn = async () => {
      let q = window.db.from('vuelos').select('*, aeronaves(matricula, marca_modelo, potencia, clase, tarifa_hora_diurna, tarifa_hora_nocturna, moneda)')
        .is('deleted_at', null).order('fecha', { ascending: false });
      if (filtros.desde) q = q.gte('fecha', filtros.desde);
      if (filtros.hasta) q = q.lte('fecha', filtros.hasta);
      if (filtros.aeronave_id) q = q.eq('aeronave_id', filtros.aeronave_id);
      if (filtros.finalidad_vuelo) q = q.eq('finalidad_vuelo', filtros.finalidad_vuelo);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    };
    return sinFiltros ? Cache.conCache('vuelos_todos', fetchFn) : fetchFn();
  },
  async obtenerVuelo(id) {
    // Siempre fresco: es la pantalla de edición, tiene que mostrar el dato real.
    const { data, error } = await window.db.from('vuelos').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async crearVuelo(vuelo) {
    const user = await usuarioActual();
    const payload = { ...vuelo, user_id: user.id };
    if (!navigator.onLine) {
      await window.Offline.guardarVueloPendiente(payload);
      return { offline: true };
    }
    const { error } = await window.db.from('vuelos').insert(payload);
    if (error) {
      // Si falla por red, lo mandamos a la cola offline como red de contención.
      await window.Offline.guardarVueloPendiente(payload);
      return { offline: true, error };
    }
    Cache.invalidar('vuelos_todos');
    return { offline: false };
  },
  async actualizarVuelo(id, cambios) {
    const { error } = await window.db.from('vuelos').update(cambios).eq('id', id);
    if (error) throw error;
    Cache.invalidar('vuelos_todos');
  },
  async borrarVuelo(id) {
    const { error } = await window.db.from('vuelos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    Cache.invalidar('vuelos_todos', 'vuelos_papelera');
  },
  async listarVuelosBorrados() {
    return Cache.conCache('vuelos_papelera', async () => {
      const { data, error } = await window.db.from('vuelos')
        .select('*, aeronaves(matricula, marca_modelo)')
        .not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
      if (error) throw error;
      return data;
    });
  },
  async restaurarVuelo(id) {
    const { error } = await window.db.from('vuelos').update({ deleted_at: null }).eq('id', id);
    if (error) throw error;
    Cache.invalidar('vuelos_todos', 'vuelos_papelera');
  },
  async borrarVueloPermanente(id) {
    const { error } = await window.db.from('vuelos').delete().eq('id', id);
    if (error) throw error;
    Cache.invalidar('vuelos_papelera');
  },

  // ---- Vuelos programados (agenda de próximos vuelos) ----
  async listarVuelosProgramados() {
    return Cache.conCache('vuelos_programados', async () => {
      const { data, error } = await window.db.from('vuelos_programados')
        .select('*, aeronaves(matricula, marca_modelo)')
        .gte('fecha', new Date().toISOString().slice(0, 10))
        .order('fecha', { ascending: true });
      if (error) throw error;
      return data;
    });
  },
  async crearVueloProgramado(v) {
    const user = await usuarioActual();
    const { error } = await window.db.from('vuelos_programados').insert({ ...v, user_id: user.id });
    if (error) throw error;
    Cache.invalidar('vuelos_programados');
  },
  async borrarVueloProgramado(id) {
    const { error } = await window.db.from('vuelos_programados').delete().eq('id', id);
    if (error) throw error;
    Cache.invalidar('vuelos_programados');
  },

  // ---- Perfil del piloto (cursos activos — puede ser más de uno a la vez,
  // ej. PCA + Habilitación de Vuelo Nocturno en paralelo) ----
  async getCursosActivos() {
    return Cache.conCache('cursos_activos', async () => {
      const user = await usuarioActual();
      const { data, error } = await window.db.from('perfil_piloto').select('cursos_activos, curso_activo').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data) {
        const { error: e2 } = await window.db.from('perfil_piloto').insert({ user_id: user.id, curso_activo: 'PPA', cursos_activos: ['PPA'] });
        if (e2) throw e2;
        return ['PPA'];
      }
      if (data.cursos_activos && data.cursos_activos.length) return data.cursos_activos;
      return data.curso_activo ? [data.curso_activo] : ['PPA'];
    });
  },
  async setCursosActivos(cursoIds) {
    const user = await usuarioActual();
    const { error } = await window.db.from('perfil_piloto')
      .upsert({ user_id: user.id, cursos_activos: cursoIds, curso_activo: cursoIds[0] || 'PPA', updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    Cache.invalidar('cursos_activos');
  },
  // Reparto elegido por el piloto entre instrumentos reales y en simulador
  // (FSTD) para el curso PCA_HVI — la RAAC permite hasta 20 hs en
  // simulador de las 40 totales, pero la decisión de cuánto usar es de
  // cada piloto, no un mínimo fijo igual para todos.
  async getHviSimHoras() {
    return Cache.conCache('hvi_sim_horas', async () => {
      const user = await usuarioActual();
      const { data, error } = await window.db.from('perfil_piloto').select('hvi_sim_horas').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      return data?.hvi_sim_horas ?? null;
    });
  },
  async setHviSimHoras(horas) {
    const user = await usuarioActual();
    const { error } = await window.db.from('perfil_piloto')
      .upsert({ user_id: user.id, hvi_sim_horas: horas, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    Cache.invalidar('hvi_sim_horas');
  },

  // ---- Datos del piloto (cabecera de la Hoja de Libro de Vuelo ANAC) ----
  async getDatosPiloto() {
    return Cache.conCache('datos_piloto', async () => {
      const user = await usuarioActual();
      // Tolerante: si todavía no se corrió sql/agregar_datos_piloto.sql, las
      // columnas no existen y devolvemos {} en vez de romper el Perfil.
      const { data, error } = await window.db.from('perfil_piloto')
        .select('nombre_completo, licencia, licencia_numero, legajo').eq('user_id', user.id).maybeSingle();
      if (error) { console.warn('getDatosPiloto:', error.message); return {}; }
      return data || {};
    });
  },
  async setDatosPiloto(datos) {
    const user = await usuarioActual();
    const { error } = await window.db.from('perfil_piloto')
      .upsert({ user_id: user.id, ...datos, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    Cache.invalidar('datos_piloto');
  },

  // ---- Licencias/requisitos: tabla GLOBAL, compartida por todos los
  // usuarios. Cualquiera la puede leer; solo la cuenta admin (ver
  // js/config.js ADMIN_EMAIL) la puede editar — eso lo hace cumplir
  // Supabase con RLS, no esta capa de JS. ----
  async esAdminApp() {
    const user = await usuarioActual();
    return !!user?.email && user.email.toLowerCase() === window.ADMIN_EMAIL.toLowerCase();
  },
  async listarConfigLicencia(cursoId) {
    return Cache.conCache('config_licencia_' + cursoId, async () => {
      const { data, error } = await window.db.from('licencias_requisitos')
        .select('*').eq('curso_id', cursoId).order('orden');
      if (error) throw error;
      return data;
    });
  },
  // Todos los requisitos de todos los cursos juntos (panel de admin y backup).
  async listarConfigLicenciaTodos() {
    return Cache.conCache('config_licencia_todos', async () => {
      const { data, error } = await window.db.from('licencias_requisitos').select('*').order('curso_id').order('orden');
      if (error) throw error;
      return data;
    });
  },
  async guardarConfigLicencia(row) {
    const { error } = await window.db.from('licencias_requisitos').update({ minimo_horas: row.minimo_horas, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) throw error;
    _invalidarConfigLicencia();
  },
  // Solo la cuenta admin: agregar un requisito nuevo a un curso (ej. HVI)
  // o borrar uno existente. Si no sos admin, Supabase rechaza el pedido.
  async agregarConfigLicencia(cursoId, nombreRequisito, minimoHoras) {
    const { data: existentes } = await window.db.from('licencias_requisitos')
      .select('orden').eq('curso_id', cursoId).order('orden', { ascending: false }).limit(1);
    const siguienteOrden = (existentes?.[0]?.orden || 0) + 1;
    const { error } = await window.db.from('licencias_requisitos').insert({
      curso_id: cursoId, nombre_requisito: nombreRequisito, minimo_horas: minimoHoras, orden: siguienteOrden,
    });
    if (error) throw error;
    _invalidarConfigLicencia();
  },
  async borrarConfigLicencia(id) {
    const { error } = await window.db.from('licencias_requisitos').delete().eq('id', id);
    if (error) throw error;
    _invalidarConfigLicencia();
  },

  // ---- Vencimientos ----
  async listarVencimientos() {
    return Cache.conCache('vencimientos', async () => {
      const { data, error } = await window.db.from('vencimientos').select('*').order('fecha_vencimiento');
      if (error) throw error;
      return data;
    });
  },
  async guardarVencimiento(v) {
    const user = await usuarioActual();
    if (v.id) {
      const { error } = await window.db.from('vencimientos').update(v).eq('id', v.id);
      if (error) throw error;
    } else {
      const { error } = await window.db.from('vencimientos').insert({ ...v, user_id: user.id });
      if (error) throw error;
    }
    Cache.invalidar('vencimientos');
  },
  async borrarVencimiento(id) {
    const { error } = await window.db.from('vencimientos').delete().eq('id', id);
    if (error) throw error;
    Cache.invalidar('vencimientos');
  },
};

// Los mínimos de licencia son una tabla GLOBAL (compartida por todos los
// usuarios) — al editarla no sabemos de antemano en qué curso cae cada fila,
// así que se invalida el cache de "todos" y el de cada curso individual.
function _invalidarConfigLicencia() {
  Cache.invalidar('config_licencia_todos', ...CURSOS.map((c) => 'config_licencia_' + c.id));
}

// ---- Agregados usados en varias vistas (dashboard, totales, costos) ----
function agregarVuelos(vuelos) {
  const acc = {
    tiempo_total: 0, total_dia: 0, total_noche: 0, total_pic: 0, total_copiloto: 0, total_travesia: 0,
    travesia_pic: 0,
    aterrizajes_dia: 0, aterrizajes_noche: 0, remolques: 0,
    instruccion_vuelo: 0, multimotor: 0, reactor: 0, turbohelice: 0, aeroaplicador: 0,
    instrumentos_real: 0, instrumentos_capota: 0, adiestrador_simulador: 0,
    costo_total: 0,
  };
  for (const v of vuelos) {
    acc.tiempo_total += Calc.n(v.tiempo_total);
    acc.total_dia += Calc.n(v.total_dia);
    acc.total_noche += Calc.n(v.total_noche);
    acc.total_pic += Calc.n(v.total_pic);
    acc.total_copiloto += Calc.n(v.total_copiloto);
    acc.total_travesia += Calc.n(v.total_travesia);
    acc.travesia_pic += Calc.n(v.trav_dia_piloto) + Calc.n(v.trav_noche_piloto);
    acc.aterrizajes_dia += Calc.n(v.aterrizajes_dia);
    acc.aterrizajes_noche += Calc.n(v.aterrizajes_noche);
    acc.remolques += Calc.n(v.remolques);
    for (const c of Calc.CAMPOS_DISCRIMINACION) acc[c] += Calc.n(v[c]);
    acc.costo_total += Calc.costoRegistrado(v, v.aeronaves).monto;
  }
  for (const k of Object.keys(acc)) if (k !== 'costo_total') acc[k] = Calc.round2(acc[k]);
  acc.costo_total = Calc.round2(acc.costo_total);
  return acc;
}

function valorRequisito(nombre, agg) {
  switch (nombre) {
    case 'total': return agg.tiempo_total;
    case 'pic': return agg.total_pic;
    case 'travesia_pic': return agg.travesia_pic;
    case 'nocturnas': return agg.total_noche;
    case 'instrumentos': return Calc.round2(agg.instrumentos_real + agg.instrumentos_capota);
    case 'instrumentos_sim': return agg.adiestrador_simulador;
    case 'aterrizajes_noche': return agg.aterrizajes_noche;
    case 'remolques': return agg.remolques;
    default: return 0;
  }
}

window.CURSOS = CURSOS;
window.Repo = Repo;
window.agregarVuelos = agregarVuelos;
window.valorRequisito = valorRequisito;
