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

// Claves de requisito que la app efectivamente sabe calcular con tus
// vuelos (ver valorRequisito más abajo). Si el admin agrega un requisito
// con otra clave, va a quedar guardado pero el progreso va a mostrar 0 —
// no hay una fórmula para inventarlo. Viven acá (no en perfil.js, que las
// usaba antes) porque js/views/totales.js también las necesita y se carga
// ANTES que perfil.js en index.html — declararlas en perfil.js funcionaba
// de pura casualidad de timing (nada las usa hasta que el usuario navega a
// una pantalla, mucho después de que todos los <script> ya cargaron), pero
// quedaba como una dependencia implícita frágil entre dos vistas. db.js se
// carga antes que cualquier vista, así que es un lugar seguro de verdad.
const CLAVES_REQUISITO_DISPONIBLES = ['total', 'pic', 'travesia_pic', 'nocturnas', 'instrumentos', 'instrumentos_sim', 'aterrizajes_noche', 'remolques'];
const LABELS_REQUISITO = {
  total: 'Total', pic: 'Piloto al mando (PIC)', travesia_pic: 'Travesía como PIC',
  nocturnas: 'Nocturnas', instrumentos: 'Instrumentos (real + capota)',
  instrumentos_sim: 'Instrumentos en simulador (FSTD)',
  aterrizajes_noche: 'Aterrizajes nocturnos', remolques: 'Remolques',
};

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
    const [aeronaves, vuelos] = await Promise.all([
      Cache.conCache('aeronaves', async () => {
        const { data, error } = await window.db.from('aeronaves').select('*');
        if (error) throw error;
        return data;
      }),
      // Si esto falla (ej. sin red y todavía sin cache de vuelos), no tiene
      // que tirar abajo la pantalla de aeronaves entera — se degrada al
      // orden preferida/alfabético nomás (ver ordenarAeronavesPorUso).
      this.listarVuelos().catch(() => []),
    ]);
    return ordenarAeronavesPorUso(aeronaves, vuelos);
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

  // ---- Flota de organización (Fase 2 B2B — ver sql/agregar_flota_org.sql).
  // Misma tabla `aeronaves` que la flota personal, pero con org_id en vez
  // de user_id (propiedad dual) — nunca se mezclan en el mismo listado, y
  // esta flota no pasa por el cache de "mis" aeronaves (Cache.conCache),
  // porque no es del usuario sino de la organización. ----
  async listarFlotaOrg(orgId) {
    const { data, error } = await window.db.from('aeronaves').select('*').eq('org_id', orgId).order('matricula');
    if (error) throw error;
    return data;
  },
  async guardarAeronaveOrg(orgId, aeronave) {
    if (aeronave.id) {
      const { error } = await window.db.from('aeronaves').update(aeronave).eq('id', aeronave.id);
      if (error) throw error;
    } else {
      const { error } = await window.db.from('aeronaves').insert({ ...aeronave, org_id: orgId, user_id: null });
      if (error) throw error;
    }
  },
  async borrarAeronaveOrg(id) {
    const { error } = await window.db.from('aeronaves').delete().eq('id', id);
    if (error) throw error;
  },

  // Sube la foto a Storage (bucket público "aeronaves-fotos", carpeta
  // propia = user_id — ver sql/agregar_foto_aeronave.sql) y guarda la URL
  // pública en la ficha. Nombre de archivo único por subida (no se
  // reemplaza el objeto anterior en Storage, así no hay que llevar la
  // cuenta de la extensión del archivo previo) — pero si ya había una
  // foto, se borra del Storage después de confirmar la nueva, para que
  // no se acumulen archivos huérfanos cada vez que alguien cambia de
  // foto (con un solo usuario el costo es despreciable, pero con muchos
  // pilotos usando la misma app suma).
  async subirFotoAeronave(aeronaveId, file) {
    const user = await usuarioActual();
    const { data: actual } = await window.db.from('aeronaves').select('foto_url').eq('id', aeronaveId).maybeSingle();
    const fotoVieja = actual?.foto_url || null;

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${user.id}/${aeronaveId}-${Date.now()}.${ext}`;
    const { error: errorSubida } = await window.db.storage.from('aeronaves-fotos').upload(path, file);
    if (errorSubida) throw errorSubida;
    const { data } = window.db.storage.from('aeronaves-fotos').getPublicUrl(path);
    const { error } = await window.db.from('aeronaves').update({ foto_url: data.publicUrl }).eq('id', aeronaveId);
    if (error) throw error;
    if (fotoVieja) await _borrarFotoStorage(fotoVieja);
    Cache.invalidar('aeronaves');
    return data.publicUrl;
  },
  async quitarFotoAeronave(aeronaveId) {
    const { data: actual } = await window.db.from('aeronaves').select('foto_url').eq('id', aeronaveId).maybeSingle();
    const { error } = await window.db.from('aeronaves').update({ foto_url: null }).eq('id', aeronaveId);
    if (error) throw error;
    if (actual?.foto_url) await _borrarFotoStorage(actual.foto_url);
    Cache.invalidar('aeronaves');
  },
  // Encuadre vertical de la miniatura (0-100, 50=centro) — para corregir un
  // recorte automático que dejó afuera la parte importante de la foto, sin
  // tener que volver a subirla. Ver sql/agregar_posicion_foto_aeronave.sql.
  async actualizarPosicionFoto(aeronaveId, posicion) {
    const { error } = await window.db.from('aeronaves').update({ foto_posicion: Math.max(0, Math.min(100, Math.round(posicion))) }).eq('id', aeronaveId);
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
    // Devuelve el id: lo necesita el flujo de "¿Deseás crear notificaciones?"
    // para poder abrir el editor de recordatorios apuntando al vuelo recién creado.
    const { data, error } = await window.db.from('vuelos_programados').insert({ ...v, user_id: user.id }).select('id').single();
    if (error) throw error;
    Cache.invalidar('vuelos_programados');
    return data.id;
  },
  async actualizarVueloProgramado(id, cambios) {
    const { error } = await window.db.from('vuelos_programados').update(cambios).eq('id', id);
    if (error) throw error;
    Cache.invalidar('vuelos_programados');
  },
  async borrarVueloProgramado(id) {
    const { error } = await window.db.from('vuelos_programados').delete().eq('id', id);
    if (error) throw error;
    // Los recordatorios no tienen FK dura a este evento (evento_id es
    // polimórfico) — la limpieza al borrar el evento la hace la app.
    await window.db.from('recordatorios').delete().eq('evento_tipo', 'vuelo_programado').eq('evento_id', id);
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

  // ---- Licencias/requisitos: tabla GLOBAL (licencias_requisitos), la
  // misma RAAC vigente para todos los pilotos — cualquiera la puede leer;
  // solo la cuenta admin (ver js/config.js ADMIN_EMAIL) la puede editar,
  // eso lo hace cumplir Supabase con RLS, no esta capa de JS. Un piloto
  // cuya escuela/CIAC le pida otra cosa para un requisito puntual puede
  // guardar su PROPIO valor (licencias_requisitos_personal, por user_id)
  // sin tocar el de nadie más — ver _mezclarConfigPersonal. ----
  async esAdminApp() {
    const user = await usuarioActual();
    return !!user?.email && user.email.toLowerCase() === window.ADMIN_EMAIL.toLowerCase();
  },

  // ---- Registro de errores (ver js/errorLog.js): solo la cuenta admin
  // puede leerlos/borrarlos, RLS lo hace cumplir del lado del servidor. ----
  async listarErroresRecientes() {
    const { data, error } = await window.db.from('error_logs')
      .select('*').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data;
  },
  async borrarTodosLosErrores() {
    // Sin filtro no borra nada por seguridad en Supabase (necesita un
    // `.eq`/`.gt`/etc.) — created_at siempre está seteado, así que este
    // filtro trivial cubre "todas las filas" sin excluir ninguna.
    const { error } = await window.db.from('error_logs').delete().not('id', 'is', null);
    if (error) throw error;
  },
  async listarConfigLicencia(cursoId) {
    const [globales, personales] = await Promise.all([
      Cache.conCache('config_licencia_' + cursoId, async () => {
        const { data, error } = await window.db.from('licencias_requisitos')
          .select('*').eq('curso_id', cursoId).order('orden');
        if (error) throw error;
        return data;
      }),
      Cache.conCache('config_licencia_personal_' + cursoId, async () => {
        const { data, error } = await window.db.from('licencias_requisitos_personal')
          .select('*').eq('curso_id', cursoId);
        if (error) throw error;
        return data;
      }),
    ]);
    return _mezclarConfigPersonal(globales, personales);
  },
  // Todos los requisitos de todos los cursos juntos (panel de admin y backup)
  // — a propósito el valor GLOBAL sin mezclar con personalizaciones de
  // nadie: el admin tiene que ver y editar la fuente de verdad tal cual es.
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

  // Guarda (o reemplaza) TU propio mínimo para un requisito puntual — no
  // toca el valor de referencia global, ni el de ningún otro usuario.
  // Cualquier piloto puede hacer esto, no hace falta ser admin.
  async personalizarConfigLicencia(cursoId, nombreRequisito, minimoHoras) {
    const user = await usuarioActual();
    const { error } = await window.db.from('licencias_requisitos_personal').upsert(
      { user_id: user.id, curso_id: cursoId, nombre_requisito: nombreRequisito, minimo_horas: minimoHoras, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,curso_id,nombre_requisito' },
    );
    if (error) throw error;
    Cache.invalidar('config_licencia_personal_' + cursoId);
  },
  // Vuelve a usar el valor de referencia global para ese requisito (borra
  // tu personalización puntual).
  async quitarPersonalizacionConfigLicencia(cursoId, nombreRequisito) {
    const user = await usuarioActual();
    const { error } = await window.db.from('licencias_requisitos_personal')
      .delete().eq('user_id', user.id).eq('curso_id', cursoId).eq('nombre_requisito', nombreRequisito);
    if (error) throw error;
    Cache.invalidar('config_licencia_personal_' + cursoId);
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
    let id = v.id;
    if (v.id) {
      const { error } = await window.db.from('vencimientos').update(v).eq('id', v.id);
      if (error) throw error;
    } else {
      // Devuelve el id: lo necesita el flujo de "¿Deseás crear notificaciones?"
      // para abrir el editor de recordatorios apuntando al vencimiento recién creado.
      const { data, error } = await window.db.from('vencimientos').insert({ ...v, user_id: user.id }).select('id').single();
      if (error) throw error;
      id = data.id;
    }
    Cache.invalidar('vencimientos');
    return id;
  },
  async borrarVencimiento(id) {
    await window.db.from('recordatorios').delete().eq('evento_tipo', 'vencimiento').eq('evento_id', id);
    const { error } = await window.db.from('vencimientos').delete().eq('id', id);
    if (error) throw error;
    Cache.invalidar('vencimientos');
  },
  // Vencimientos de OTRO usuario (para que owner/admin vean el CMA/
  // habilitación de sus instructores) — sin cache, porque el cache de
  // 'vencimientos' es para los propios del usuario logueado, no para los
  // de un tercero. RLS es quien de verdad decide si esta consulta trae
  // algo o vuelve vacía (ver sql/agregar_instructores.sql).
  async listarVencimientosDeUsuario(userId) {
    const { data, error } = await window.db.from('vencimientos').select('*').eq('user_id', userId).order('fecha_vencimiento');
    if (error) throw error;
    return data;
  },

  // ---- Instructores (Fase 3 B2B — ver sql/agregar_instructores.sql).
  // Un instructor primero tiene que ser miembro de la organización con
  // rol 'instructor' (ver invitarMiembro) — acá solo se agregan sus datos
  // propios de instructor (nro de licencia, activo/inactivo). ----
  async listarInstructores(orgId) {
    const { data, error } = await window.db.from('instructores').select('*').eq('org_id', orgId).order('created_at');
    if (error) throw error;
    return data;
  },
  async agregarInstructor(orgId, userId, nroLicencia) {
    const { error } = await window.db.from('instructores').insert({ org_id: orgId, user_id: userId, nro_licencia: nroLicencia || null });
    if (error) throw error;
  },
  async actualizarInstructor(id, cambios) {
    const { error } = await window.db.from('instructores').update(cambios).eq('id', id);
    if (error) throw error;
  },
  async quitarInstructor(id) {
    const { error } = await window.db.from('instructores').delete().eq('id', id);
    if (error) throw error;
  },

  // ---- Turnos (Fase 4 B2B — ver sql/agregar_turnos.sql). Todas las
  // escrituras pasan por rpc: quién puede reservar/confirmar/rechazar/
  // cancelar, y con qué estado inicial, es una regla de negocio que vive
  // una sola vez en el server (además, el server es quien de verdad
  // impide el doble booking vía constraint de exclusión — no esta capa). ----
  async listarTurnosOrg(orgId) {
    const { data, error } = await window.db.from('turnos').select('*').eq('org_id', orgId).order('inicio');
    if (error) throw error;
    return data;
  },
  async crearTurno(orgId, aeronaveId, inicio, fin, instructorId) {
    const { data, error } = await window.db.rpc('crear_turno', {
      p_org_id: orgId, p_aeronave_id: aeronaveId, p_inicio: inicio, p_fin: fin, p_instructor_id: instructorId || null,
    });
    if (error) throw error;
    return data;
  },
  async confirmarTurno(turnoId) {
    const { error } = await window.db.rpc('confirmar_turno', { p_turno_id: turnoId });
    if (error) throw error;
  },
  async rechazarTurno(turnoId) {
    const { error } = await window.db.rpc('rechazar_turno', { p_turno_id: turnoId });
    if (error) throw error;
  },
  async cancelarTurno(turnoId) {
    const { error } = await window.db.rpc('cancelar_turno', { p_turno_id: turnoId });
    if (error) throw error;
  },

  // ---- Despacho / vuelos asignados (Fase 1 B2B, empresas — ver
  // sql/agregar_vuelos_asignados.sql). Sin autogestión del piloto: solo
  // owner/admin asignan, vía rpc (mismo motivo que turnos: la regla de
  // permisos y el anti doble-booking viven en el server, no acá). ----
  async listarVuelosAsignadosOrg(orgId) {
    const { data, error } = await window.db.from('vuelos_asignados').select('*').eq('org_id', orgId).order('inicio');
    if (error) throw error;
    return data;
  },
  async asignarVuelo(orgId, aeronaveId, pilotoUserId, tramo, inicio, fin) {
    const { data, error } = await window.db.rpc('asignar_vuelo', {
      p_org_id: orgId, p_aeronave_id: aeronaveId, p_piloto_user_id: pilotoUserId, p_tramo: tramo, p_inicio: inicio, p_fin: fin,
    });
    if (error) throw error;
    return data;
  },
  async actualizarEstadoVueloAsignado(vueloId, estado) {
    const { error } = await window.db.rpc('actualizar_estado_vuelo_asignado', { p_vuelo_id: vueloId, p_estado: estado });
    if (error) throw error;
  },
  async cancelarVueloAsignado(vueloId) {
    await this.actualizarEstadoVueloAsignado(vueloId, 'cancelado');
  },

  // ---- Disponibilidad de turnos (ver sql/agregar_disponibilidad_turnos.sql)
  // — días/horario/duración de bloque que el owner/admin configura para
  // que la grilla de Turnos sepa qué horarios ofrecer. ----
  async obtenerDisponibilidadTurnos(orgId) {
    const { data, error } = await window.db.from('disponibilidad_turnos').select('*').eq('org_id', orgId).maybeSingle();
    if (error) throw error;
    return data;
  },
  async guardarDisponibilidadTurnos(orgId, diasSemana, horaInicio, horaFin, duracionMinutos) {
    const { error } = await window.db.rpc('guardar_disponibilidad_turnos', {
      p_org_id: orgId, p_dias_semana: diasSemana, p_hora_inicio: horaInicio, p_hora_fin: horaFin, p_duracion_bloque_minutos: duracionMinutos,
    });
    if (error) throw error;
  },
  // Devuelve { [user_id]: nombre_completo } para los ids pedidos que
  // además comparten la organización con quien llama (ver
  // sql/agregar_nombres_pilotos_org.sql) — un id que no tiene nombre
  // cargado o no comparte la org simplemente no aparece en el resultado.
  async obtenerNombresPilotosOrg(orgId, userIds) {
    if (!userIds.length) return {};
    const { data, error } = await window.db.rpc('nombres_pilotos_org', { p_org_id: orgId, p_user_ids: userIds });
    if (error) throw error;
    return Object.fromEntries(data.filter((f) => f.nombre_completo).map((f) => [f.user_id, f.nombre_completo]));
  },

  // ---- Panel admin de organizaciones (ver
  // sql/agregar_aprobacion_organizaciones.sql) — solo la cuenta admin de
  // la app (esAdminApp()) puede ver todas y cambiarles el estado. ----
  async listarOrganizacionesAdmin() {
    const { data, error } = await window.db.from('organizaciones').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async aprobarOrganizacion(orgId) {
    const { error } = await window.db.rpc('aprobar_organizacion', { p_org_id: orgId });
    if (error) throw error;
  },
  async rechazarOrganizacion(orgId) {
    const { error } = await window.db.rpc('rechazar_organizacion', { p_org_id: orgId });
    if (error) throw error;
  },
  async suspenderOrganizacion(orgId) {
    const { error } = await window.db.rpc('suspender_organizacion', { p_org_id: orgId });
    if (error) throw error;
  },
  async reactivarOrganizacion(orgId) {
    const { error } = await window.db.rpc('reactivar_organizacion', { p_org_id: orgId });
    if (error) throw error;
  },

  // ---- Notificaciones push (ver js/notificaciones.js para el flujo de
  // permiso/suscripción y supabase/functions/notificaciones-push para el
  // envío real) ----
  async guardarSuscripcionPush(sub) {
    const user = await usuarioActual();
    // La clave de conflicto es el ENDPOINT, no el user_id: un mismo usuario
    // puede tener el celu y la notebook suscriptos a la vez sin que uno pise
    // la suscripción del otro.
    const { error } = await window.db.from('push_subscriptions')
      .upsert({ user_id: user.id, endpoint: sub.endpoint, subscription: sub }, { onConflict: 'endpoint' });
    if (error) throw error;
  },
  async borrarSuscripcionPush(endpoint) {
    const { error } = await window.db.from('push_subscriptions').delete().eq('endpoint', endpoint);
    if (error) throw error;
  },
  async getNotifConfig() {
    return Cache.conCache('notif_config', async () => {
      const user = await usuarioActual();
      const { data, error } = await window.db.from('notif_config').select('*').eq('user_id', user.id).maybeSingle();
      if (error) { console.warn('getNotifConfig:', error.message); return {}; }
      return data || {};
    });
  },
  async setNotifConfig(cfg) {
    const user = await usuarioActual();
    const { error } = await window.db.from('notif_config')
      .upsert({ user_id: user.id, ...cfg, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw error;
    Cache.invalidar('notif_config');
  },

  // ---- Recordatorios personalizados (uno o varios por evento — ver
  // js/recordatorios.js para el modal que los edita) ----
  async listarRecordatorios(eventoTipo, eventoId) {
    const { data, error } = await window.db.from('recordatorios')
      .select('*').eq('evento_tipo', eventoTipo).eq('evento_id', eventoId).order('created_at');
    if (error) throw error;
    return data;
  },
  // Todos los recordatorios de todos los eventos, para la lista centralizada
  // de Perfil → Notificaciones. evento_id es polimórfico (no hay join de
  // Postgres posible entre dos tablas distintas según el tipo), así que acá
  // solo se traen los recordatorios — describirlos con datos del evento
  // (fecha, aeronave, tipo de vencimiento) lo arma quien llama esto.
  async listarRecordatoriosTodos() {
    const { data, error } = await window.db.from('recordatorios').select('*').order('created_at');
    if (error) throw error;
    return data;
  },
  async crearRecordatorio(r) {
    const user = await usuarioActual();
    const { error } = await window.db.from('recordatorios').insert({ ...r, user_id: user.id });
    if (error) throw error;
  },
  async borrarRecordatorio(id) {
    const { error } = await window.db.from('recordatorios').delete().eq('id', id);
    if (error) throw error;
  },

  // ---- Organizaciones (Fase 0 B2B — ver sql/agregar_organizaciones.sql) ----
  // Todas las escrituras pasan por funciones de Postgres (rpc), no por
  // insert/update directo: la validación de "quién puede hacer qué" vive
  // una sola vez en el server (RLS + security definer), no duplicada acá.
  async listarMisOrganizaciones() {
    // El filtro por user_id es imprescindible acá y NO es redundante con
    // RLS: la política de organizacion_miembros también deja ver, a
    // owner/admin, las filas de SUS invitados (para poder gestionarlos
    // desde "Miembros") — sin este filtro, esas filas ajenas se colaban acá
    // y aparecían como si fueran invitaciones propias del owner.
    const user = await usuarioActual();
    const { data, error } = await window.db.from('organizacion_miembros')
      .select('id, org_id, rol, estado, organizaciones(id, tipo, nombre, plan, estado)')
      .eq('user_id', user.id)
      .order('created_at');
    if (error) throw error;
    return data;
  },
  // Solo la cuenta admin de la app puede crear organizaciones (ver
  // sql/restringir_creacion_organizaciones.sql) — pasa por la Edge
  // Function porque, si el email del owner todavía no tiene cuenta, hace
  // falta mandarle una invitación real (service_role, no puede vivir acá).
  async crearOrganizacionAdmin(nombre, tipo, ownerEmail) {
    const { data, error } = await window.db.functions.invoke('crear-organizacion', {
      body: { nombre, tipo, owner_email: ownerEmail, redirect_to: window.location.origin + window.location.pathname },
    });
    if (error) throw new Error(await mensajeDeErrorFuncion(error));
    if (data?.error) throw new Error(data.error);
    return data?.org_id;
  },
  async listarMiembros(orgId) {
    const { data, error } = await window.db.from('organizacion_miembros')
      .select('id, user_id, rol, estado, created_at').eq('org_id', orgId).order('created_at');
    if (error) throw error;
    return data;
  },
  async invitarMiembro(orgId, email, rol) {
    const { data, error } = await window.db.rpc('invitar_miembro', { p_org_id: orgId, p_email: email, p_rol: rol });
    if (error) throw error;
    return data;
  },
  async aceptarInvitacion(orgId) {
    const { error } = await window.db.rpc('aceptar_invitacion', { p_org_id: orgId });
    if (error) throw error;
  },
  async rechazarInvitacion(orgId) {
    const { error } = await window.db.rpc('rechazar_invitacion', { p_org_id: orgId });
    if (error) throw error;
  },
  async salirDeOrganizacion(orgId) {
    const { error } = await window.db.rpc('salir_organizacion', { p_org_id: orgId });
    if (error) throw error;
  },
  async quitarMiembro(orgId, userId) {
    const { error } = await window.db.rpc('quitar_miembro', { p_org_id: orgId, p_user_id: userId });
    if (error) throw error;
  },
};

// Borra del bucket "aeronaves-fotos" el archivo detrás de una URL pública
// (ver subirFotoAeronave/quitarFotoAeronave) — best-effort: si la URL no
// matchea el patrón esperado o el borrado falla (permisos, ya no existe),
// no tira error ni bloquea nada — la ficha ya quedó actualizada, que es lo
// que el usuario ve; en el peor caso queda un archivo huérfano más, el
// mismo estado de siempre antes de este cleanup.
async function _borrarFotoStorage(fotoUrl) {
  try {
    const marcador = '/aeronaves-fotos/';
    const idx = fotoUrl.indexOf(marcador);
    if (idx === -1) return;
    const path = decodeURIComponent(fotoUrl.slice(idx + marcador.length));
    await window.db.storage.from('aeronaves-fotos').remove([path]);
  } catch { /* best-effort, no bloquea nada */ }
}

// Combina los mínimos de referencia (globales, RAAC) con las
// personalizaciones puntuales de ESTE usuario para un curso: donde no
// personalizó nada, se ve el valor global tal cual; donde sí, se reemplaza
// el minimo_horas por el suyo (se marca `personalizado: true` para que la
// UI lo distinga). Pura (sin red), para poder testearla — ver tests/db.test.js.
function _mezclarConfigPersonal(globales, personales) {
  const porRequisito = {};
  for (const p of personales) porRequisito[p.nombre_requisito] = p;
  return globales.map((g) => {
    const personal = porRequisito[g.nombre_requisito];
    if (!personal) return { ...g, personalizado: false };
    return { ...g, minimo_horas: personal.minimo_horas, personalizado: true };
  });
}

// Orden de la flota: preferidas primero y, dentro de cada grupo (preferida
// o no), la que se voló más reciente arriba — así en un selector (Nuevo
// vuelo, Programar vuelo) lo que realmente usás está a mano arriba, en vez
// de una lista alfabética con aviones que ya no volás mezclados en el medio.
// Pura (sin red), para poder testearla — ver tests/db.test.js.
function ordenarAeronavesPorUso(aeronaves, vuelos) {
  const ultimoVuelo = {};
  for (const v of vuelos) {
    if (!v.aeronave_id) continue;
    if (!ultimoVuelo[v.aeronave_id] || v.fecha > ultimoVuelo[v.aeronave_id]) ultimoVuelo[v.aeronave_id] = v.fecha;
  }
  return [...aeronaves].sort((a, b) => {
    if (!!a.es_habitual !== !!b.es_habitual) return a.es_habitual ? -1 : 1;
    const fa = ultimoVuelo[a.id] || '', fb = ultimoVuelo[b.id] || '';
    if (fa !== fb) return fa > fb ? -1 : 1;
    return a.matricula.localeCompare(b.matricula);
  });
}

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

// Cuando "Habilitación de Vuelo Nocturno" (HAB_NOC) está activa junto a otro
// curso que también pide horas nocturnas (ej. PCA pide 5), las horas
// nocturnas voladas van primero a completar la habilitación (sus 3 hs) —
// recién las que sobran después de eso cuentan para el otro curso. No es
// que las mismas horas cuenten dos veces para dos requisitos distintos.
// La usan Dashboard y Totales.
function valorNocturnasAjustado(cursoId, agg, configsPorCurso) {
  const habNoc = configsPorCurso.find((c) => c.cursoId === 'HAB_NOC');
  if (!habNoc) return agg.total_noche;
  const reqHabNoc = habNoc.config.find((r) => r.nombre_requisito === 'nocturnas');
  const minimoHabNoc = Calc.n(reqHabNoc?.minimo_horas);
  if (cursoId === 'HAB_NOC') return Math.min(agg.total_noche, minimoHabNoc);
  return Math.max(0, Calc.round2(agg.total_noche - minimoHabNoc));
}

// ---- Organizaciones: labels y chequeos de rol puros (sin red), para que
// la vista y los tests no dupliquen esta lista. ----
const LABELS_ROL_ORGANIZACION = {
  owner: 'Dueño/a',
  admin: 'Administrador/a',
  instructor: 'Instructor/a',
  piloto_vinculado: 'Piloto vinculado',
};
const LABELS_TIPO_ORGANIZACION = { escuela: 'Escuela de vuelo', empresa: 'Empresa de vuelos privados' };

function esOwnerOAdmin(rol) {
  return rol === 'owner' || rol === 'admin';
}

const LABELS_ESTADO_TURNO = {
  pendiente_autorizacion: 'Pendiente de autorización',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
};

const LABELS_ESTADO_VUELO_ASIGNADO = {
  programado: 'Programado',
  en_curso: 'En curso',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const LABELS_ESTADO_ORGANIZACION = {
  pendiente_aprobacion: 'Pendiente de aprobación',
  activa: 'Activa',
  suspendida: 'Suspendida',
  rechazada: 'Rechazada',
};

window.LABELS_ROL_ORGANIZACION = LABELS_ROL_ORGANIZACION;
window.LABELS_TIPO_ORGANIZACION = LABELS_TIPO_ORGANIZACION;
window.LABELS_ESTADO_TURNO = LABELS_ESTADO_TURNO;
window.LABELS_ESTADO_VUELO_ASIGNADO = LABELS_ESTADO_VUELO_ASIGNADO;
window.LABELS_ESTADO_ORGANIZACION = LABELS_ESTADO_ORGANIZACION;
window.esOwnerOAdmin = esOwnerOAdmin;
window.CURSOS = CURSOS;
window.CLAVES_REQUISITO_DISPONIBLES = CLAVES_REQUISITO_DISPONIBLES;
window.LABELS_REQUISITO = LABELS_REQUISITO;
window.Repo = Repo;
window.agregarVuelos = agregarVuelos;
window.valorRequisito = valorRequisito;
window.valorNocturnasAjustado = valorNocturnasAjustado;
window.ordenarAeronavesPorUso = ordenarAeronavesPorUso;
window._mezclarConfigPersonal = _mezclarConfigPersonal;
window._borrarFotoStorage = _borrarFotoStorage;
