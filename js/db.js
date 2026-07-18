// ============================================================================
// CAPA DE DATOS — wrappers finos sobre Supabase para cada tabla.
// ============================================================================

const REQUISITOS_DEFAULT = [
  { nombre_requisito: 'total', label: 'Total', minimo_horas: 200, orden: 1 },
  { nombre_requisito: 'pic', label: 'Piloto al mando (PIC)', minimo_horas: 100, orden: 2 },
  { nombre_requisito: 'travesia_pic', label: 'Travesía como PIC', minimo_horas: 20, orden: 3 },
  { nombre_requisito: 'nocturnas', label: 'Nocturnas', minimo_horas: 10, orden: 4 },
  { nombre_requisito: 'instrumentos', label: 'Instrumentos (real + capota)', minimo_horas: 10, orden: 5 },
  { nombre_requisito: 'aterrizajes_noche', label: 'Aterrizajes nocturnos (unidades)', minimo_horas: 5, orden: 6 },
];

async function usuarioActual() {
  const { data } = await window.db.auth.getUser();
  return data.user;
}

const Repo = {
  // ---- Aeronaves ----
  async listarAeronaves() {
    const { data, error } = await window.db.from('aeronaves').select('*').order('es_habitual', { ascending: false }).order('matricula');
    if (error) throw error;
    return data;
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
  },
  async borrarAeronave(id) {
    const { error } = await window.db.from('aeronaves').delete().eq('id', id);
    if (error) throw error;
  },

  // ---- Vuelos ----
  async listarVuelos(filtros = {}) {
    let q = window.db.from('vuelos').select('*, aeronaves(matricula, marca_modelo, tarifa_hora_diurna, tarifa_hora_nocturna, moneda)').order('fecha', { ascending: false });
    if (filtros.desde) q = q.gte('fecha', filtros.desde);
    if (filtros.hasta) q = q.lte('fecha', filtros.hasta);
    if (filtros.aeronave_id) q = q.eq('aeronave_id', filtros.aeronave_id);
    if (filtros.finalidad_vuelo) q = q.eq('finalidad_vuelo', filtros.finalidad_vuelo);
    const { data, error } = await q;
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
    return { offline: false };
  },
  async actualizarVuelo(id, cambios) {
    const { error } = await window.db.from('vuelos').update(cambios).eq('id', id);
    if (error) throw error;
  },
  async borrarVuelo(id) {
    const { error } = await window.db.from('vuelos').delete().eq('id', id);
    if (error) throw error;
  },

  // ---- Config licencia ----
  async listarConfigLicencia() {
    const { data, error } = await window.db.from('config_licencia').select('*').order('orden');
    if (error) throw error;
    if (!data || data.length === 0) {
      await this.sembrarConfigLicenciaDefault();
      const { data: d2, error: e2 } = await window.db.from('config_licencia').select('*').order('orden');
      if (e2) throw e2;
      return d2;
    }
    return data;
  },
  async sembrarConfigLicenciaDefault() {
    const user = await usuarioActual();
    const rows = REQUISITOS_DEFAULT.map((r) => ({
      user_id: user.id,
      licencia_objetivo: 'CPL Avión',
      nombre_requisito: r.nombre_requisito,
      minimo_horas: r.minimo_horas,
      orden: r.orden,
    }));
    const { error } = await window.db.from('config_licencia').insert(rows);
    if (error) throw error;
  },
  async guardarConfigLicencia(row) {
    const { error } = await window.db.from('config_licencia').update({ minimo_horas: row.minimo_horas }).eq('id', row.id);
    if (error) throw error;
  },

  // ---- Vencimientos ----
  async listarVencimientos() {
    const { data, error } = await window.db.from('vencimientos').select('*').order('fecha_vencimiento');
    if (error) throw error;
    return data;
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
  },
  async borrarVencimiento(id) {
    const { error } = await window.db.from('vencimientos').delete().eq('id', id);
    if (error) throw error;
  },
};

// ---- Agregados usados en varias vistas (dashboard, totales, costos) ----
function agregarVuelos(vuelos) {
  const acc = {
    tiempo_total: 0, total_dia: 0, total_noche: 0, total_pic: 0, total_copiloto: 0, total_travesia: 0,
    travesia_pic: 0,
    aterrizajes_dia: 0, aterrizajes_noche: 0,
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
    for (const c of Calc.CAMPOS_DISCRIMINACION) acc[c] += Calc.n(v[c]);
    acc.costo_total += Calc.calcularCosto(v, v.aeronaves);
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
    case 'aterrizajes_noche': return agg.aterrizajes_noche;
    default: return 0;
  }
}

window.Repo = Repo;
window.agregarVuelos = agregarVuelos;
window.valorRequisito = valorRequisito;
