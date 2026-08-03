# Propuesta Estratégica: Expansión B2B (Escuelas de Vuelo y Empresas de Vuelos Privados)

**Documento tipo licitación — Plan de Producto y Arquitectura**
Fecha: 2026-08-03

---

## 0. Resumen ejecutivo

Hoy la app es una **herramienta B2C de un solo piloto**: cada fila de cada
tabla (`aeronaves`, `vuelos`, `perfil_piloto`, `vencimientos`,
`vuelos_programados`, ...) cuelga de un único `user_id` protegido por Row
Level Security (RLS) en Supabase/Postgres. No existe ningún concepto de
"organización" ni de "esta aeronave la ven/gestionan varias personas".

La propuesta agrega una **capa de organizaciones (multi-tenant)** por
encima del modelo actual, sin tocar el modelo de piloto individual que ya
funciona. Un piloto que hoy usa la app solo, la sigue usando exactamente
igual el día después del release. Las organizaciones (escuela o empresa)
son una capa opcional que un piloto puede vincular a su perfil.

Es una decisión deliberada de alcance: **no se migra el modelo de datos
del piloto individual a "todo pertenece a una organización"**. En cambio,
se introduce **propiedad dual**: una aeronave o un vuelo puede pertenecer a
un usuario (como hoy) o a una organización, y el piloto individual nunca
se entera de que esa segunda opción existe si no la usa.

---

## 1. Plan de integración

### 1.1 Principio rector: aditivo, no destructivo

Todo lo nuevo se agrega como:
- Tablas nuevas (`organizaciones`, `organizacion_miembros`, `flota_org`,
  `turnos`, `vuelos_asignados`, etc.), nunca alterando el `create table`
  de `aeronaves`/`vuelos` existentes salvo por columnas *nullable* nuevas
  (ej. `org_id uuid null references organizaciones(id)`).
- Vistas y RLS nuevas que **conviven** con las políticas actuales: si
  `org_id is null`, se aplica la regla de hoy (dueño = `user_id`); si
  `org_id` no es null, se aplica la regla de organización.
- Rutas nuevas del router (`#/escuela/...`, `#/empresa/...`) y vistas
  nuevas en `js/views/`, sin tocar las vistas actuales de piloto
  (`dashboard`, `nuevoVuelo`, `bitacora`, `perfil`, `aeronaves`).
- Un flag de rol en el perfil (`perfil_piloto.rol_activo` o resuelto vía
  membresías) que determina qué layout de navegación se muestra, no una
  app distinta.

Esto respeta el patrón que ya usa el repo para features grandes: cada
mejora nueva vive en su propio `sql/agregar_*.sql` idempotente que se
puede correr sin romper lo que ya existe (ver `sql/agregar_multi_curso.sql`,
`agregar_simuladores.sql`, etc.) — el mismo criterio aplica para
`agregar_organizaciones.sql`, `agregar_flota_org.sql`, `agregar_turnos.sql`.

### 1.2 Arquitectura multi-tenant: modelo elegido

**Multi-tenancy por fila (RLS-based), no por schema ni por base de datos
separada.** Con Postgres + Supabase esto es lo más simple de operar y lo
que ya usa el proyecto (cero infraestructura nueva, mismo proyecto
Supabase). Se agregan estas piezas:

```
organizaciones
  id, tipo ('escuela' | 'empresa'), nombre, cuit, plan, created_at

organizacion_miembros
  id, org_id, user_id, rol ('owner' | 'admin' | 'instructor' | 'piloto_vinculado'),
  estado ('activo' | 'invitado' | 'suspendido'), created_at

aeronaves          -- se agrega columna org_id (nullable, default null)
vuelos             -- se agrega columna org_id (nullable, default null)

flota_tarifas_org  -- tarifas por hora por aeronave de la organización
                     (separado de aeronaves.tarifa_hora_* para permitir
                     tarifa "lista" vs. tarifa negociada por piloto/convenio)

instructores
  id, org_id, user_id, nro_licencia, vencimientos jsonb / FK a vencimientos,
  activo

turnos (reservas)
  id, org_id, aeronave_id, instructor_id null, piloto_user_id null,
  estado ('disponible' | 'reservado' | 'pendiente_autorizacion' |
          'confirmado' | 'cancelado'),
  inicio, fin, creado_por, autorizado_por null

vuelos_asignados (despacho, para empresas)
  id, org_id, aeronave_id, piloto_user_id, tramo, fecha_hora,
  estado ('programado' | 'en_curso' | 'completado' | 'cancelado'),
  asignado_por
```

**Roles y permisos** (tabla `organizacion_miembros.rol`, resuelto en RLS
con una función `is_member_of(org_id, rol_minimo)` tipo `SECURITY
DEFINER`, igual patrón que ya usa `agregar_modo_admin.sql` para el rol
admin global):

| Rol | Escuela | Empresa |
|---|---|---|
| `owner` | Control total: flota, staff, turnos, tarifas, alta/baja de pilotos vinculados | Control total: flota, pilotos, despacho |
| `admin` | Delegado del owner (mismo alcance, sin poder borrar la organización) | Idem |
| `instructor` | Ve/gestiona su propia agenda de turnos asignados | — |
| `piloto_vinculado` | Autogestiona turnos de la flota vinculada | Ve su agenda asignada (no autogestiona) |
| *(sin vincular)* | Solo lectura de disponibilidad + botón "solicitar autorización" | No aplica (empresa no tiene flujo abierto) |

Esto responde directamente al requerimiento diferencial pilar del pedido:
**piloto vinculado a escuela = autogestión de turnos; piloto externo =
disponibilidad de solo lectura + autorización manual.** La tabla `turnos`
modela esto con el estado `pendiente_autorizacion`: un piloto no vinculado
que pide un turno crea una fila en ese estado, visible al owner/admin, que
la aprueba (pasa a `confirmado`) o rechaza. Un piloto vinculado con
`rol='piloto_vinculado'` puede crear turnos que van directo a
`confirmado` (o `reservado`, según reglas de la escuela — configurable
por org, ej. "requiere aprobación igual para aeronaves complejas").

Para empresas de vuelo privado, el módulo de turnos abiertos **no se
expone en la UI**: el owner/dispatcher trabaja directo sobre
`vuelos_asignados`, asignando aeronave + piloto + tramo. No hay
"solicitar turno" del lado del piloto — solo ve su agenda.

### 1.3 Identidad y vínculo piloto↔organización

- El perfil de piloto (`perfil_piloto`, ya existente) no cambia de dueño;
  sigue siendo el piloto quien controla su cuenta y su libro de vuelo
  personal.
- El "vínculo oficial" pedido se modela como una invitación: el
  owner/admin de la escuela genera un código o busca por email; el
  piloto acepta desde su propio perfil (`Perfil → Organizaciones`). Esto
  crea la fila en `organizacion_miembros`. Nunca se otorga acceso de
  escritura sobre datos del piloto sin ese consentimiento explícito
  (relevante también para Ley 25.326, ya referenciada en el README /
  `privacidad.html` existentes).
- Los vuelos volados en la escuela pueden, opcionalmente, "reflejarse" en
  el libro personal del piloto (mismo total de horas ANAC) sin duplicar
  carga manual: al completarse un `vuelos_asignados`/turno confirmado, se
  ofrece un botón "cargar este vuelo a mi libro" que pre-completa el
  formulario de `nuevoVuelo` ya existente. Se mantiene la regla actual de
  que el libro de vuelo es responsabilidad y declaración del piloto (no
  se auto-inserta sin su acción).

### 1.4 Fases de integración técnica (paso a paso)

1. **Fundacional — capa de organizaciones**: tablas `organizaciones`,
   `organizacion_miembros`, funciones RLS de rol, UI de "crear
   organización" / "unirme a organización", selector de contexto
   (piloto personal vs. organización X) en el header.
2. **Flota de organización**: `flota_org`/columna `org_id` en
   `aeronaves`, ficha técnica extendida (horas de célula/motor,
   vencimientos de la aeronave — inspección anual, etc.), tarifas por
   hora editables por el owner.
3. **Staff — instructores**: tabla `instructores`, control de
   vencimientos (reutiliza el motor de `vencimientos` + notificaciones
   push que ya existe, aplicado a instructor en vez de a piloto).
4. **Turnos (escuela)**: tabla `turnos`, calendario de disponibilidad por
   aeronave, flujo de autogestión (vinculado) vs. autorización (externo),
   notificaciones (reutiliza `notificaciones-push` existente: "tu turno
   fue confirmado", "nueva solicitud de turno pendiente").
5. **Despacho (empresa)**: tabla `vuelos_asignados`, vista de
   "programación semanal" tipo Gantt/agenda por aeronave, asignación
   directa piloto+vuelo.
6. **Gestión de pilotos (ambos)**: listado, estado del vínculo, historial
   de horas voladas en la organización (agregación de vuelos con ese
   `org_id`), export.
7. **Facturación/pagos (fase posterior, fuera del alcance inmediato)**:
   la tarifa por hora ya queda modelada desde la fase 2 para habilitar
   esto sin rediseño de esquema — se deja para una fase de "Pagos" con
   Mercado Pago/Stripe una vez validado el resto.

### 1.5 Qué NO cambia para el piloto individual actual

- Rutas, vistas, RLS y tablas actuales de piloto: intactas.
- Onboarding actual (crear cuenta, cargar aeronave propia, cargar
  vuelos): idéntico.
- La app sigue funcionando 100% sin organizaciones si el piloto nunca
  crea ni se une a una.

---

## 2. Recursos necesarios

### 2.1 Perfiles profesionales

| Rol | Dedicación estimada | Foco |
|---|---|---|
| **Product Manager / Product Owner** (vos, con apoyo) | Full-time durante todo el proyecto | Priorización, validación con escuelas/empresas piloto, backlog |
| **Backend / Database (Postgres + Supabase)** | 1 senior full-time | Esquema multi-tenant, RLS, funciones `SECURITY DEFINER`, Edge Functions (notificaciones, invitaciones, futura facturación) |
| **Frontend (vanilla JS, mismo stack)** | 1 senior + 1 semi-senior | Vistas nuevas (`js/views/escuela/*`, `js/views/empresa/*`), calendario de turnos, dashboard admin. Se mantiene el criterio actual de "sin framework" salvo que el calendario de turnos justifique sumar una librería puntual (ver 2.3) |
| **UX/UI** | 1, part-time (fuerte en fases de diseño, liviano en implementación) | Flujos de reserva, calendario, dashboard admin — requiere pensar bien la usabilidad para "dueño de escuela no técnico" |
| **QA** | 1, part-time creciendo a full-time en fases de turnos/despacho (lógica de concurrencia y permisos es la parte más frágil) | Casos de permisos por rol, condiciones de carrera en reservas (dos pilotos pidiendo el mismo turno), RLS |
| **DevOps/Infra** | Parcial (Backend puede cubrirlo) | Supabase (branching/staging), Vercel, monitoreo de Edge Functions |
| **Legal/Compliance** (consultoría puntual, no headcount fijo) | Puntual | Términos de servicio B2B, tratamiento de datos de terceros (pilotos externos), Ley 25.326 aplicada a organizaciones |

Equipo mínimo viable: **1 Backend + 1-2 Frontend + 1 QA part-time + vos
como PM/UX**. Con ese equipo el cronograma de la sección 3 es realista.

### 2.2 Infraestructura

- **Supabase**: se mantiene el mismo proyecto o se pasa a un plan
  superior (Pro) por volumen de filas/Edge Function invocations —
  esperable con más organizaciones activas. Costo incremental, no
  arquitectura nueva.
- **Supabase branching** (o un segundo proyecto de staging) para probar
  migraciones de RLS antes de aplicarlas a producción — crítico acá
  porque los bugs de RLS multi-tenant son el riesgo más caro (fuga de
  datos entre organizaciones).
- **Vercel**: sin cambios, sigue siendo estático.
- **Notificaciones push**: ya existe la infraestructura VAPID/Edge
  Function; se reutiliza para turnos y despacho, no se agrega proveedor
  nuevo.
- **Nuevo (opcional, fase de facturación futura)**: gateway de pagos
  (Mercado Pago para Argentina, dado el contexto ANAC/RAAC del resto de
  la app) — explícitamente fuera del alcance del MVP de este documento.

### 2.3 Decisión técnica a validar: librería de calendario

El sistema de turnos (escuela) y de despacho (empresa) es sustancialmente
más complejo en UI que el resto de la app (vistas de calendario,
drag-and-drop, vista por aeronave/instructor). Se recomienda evaluar una
librería liviana sin build step pesado (ej. FullCalendar en su build
standalone) en vez de reimplementar un calendario a mano — es la única
excepción propuesta al criterio "cero dependencias" del proyecto, acotada
a esas dos vistas.

---

## 3. Cronograma estimado (roadmap por fases)

Estimación con el equipo mínimo de 2.1. En semanas corridas de desarrollo,
sin contar validación comercial con escuelas/empresas piloto (se
recomienda correr esa validación en paralelo a la Fase 0/MVP, no antes).

### Fase 0 — Fundacional multi-tenant (3-4 semanas)
- Esquema `organizaciones` + `organizacion_miembros` + RLS por rol.
- UI: crear organización, invitar/vincular piloto, selector de contexto.
- Sin funcionalidad de negocio todavía — es la base sobre la que corren
  las fases siguientes.

### MVP — Escuela de Vuelo (6-8 semanas)
- Gestión de flota de organización + tarifas.
- Gestión de pilotos vinculados (listado, estado, historial de horas).
- Gestión de instructores + vencimientos (reutilizando motor existente).
- Sistema de turnos completo: calendario, autogestión vinculados,
  autorización externos, notificaciones.
- **Entregable de MVP**: una escuela piloto real puede operar el 100% de
  su día a día de reservas dentro de la app.

### Fase 1 — Empresa de Vuelos Privados (4-5 semanas)
- Reutiliza ~70% de lo construido en el MVP (flota, pilotos, staff).
- Módulo de despacho/scheduling (`vuelos_asignados`), vista de agenda
  corporativa, asignación directa.
- Diferenciación de UI/flujo respecto a turnos abiertos de escuela
  (ocultar autogestión, exponer solo asignación).

### Fase 2 — Pulido, reportes y preparación de pagos (3-4 semanas)
- Reportes/exportables para el owner (horas voladas por piloto, uso de
  flota, ocupación).
- Refinamiento de permisos (delegados/admin secundarios).
- Modelado de tarifas listo para integrar cobro (sin implementar gateway
  todavía, salvo que el negocio lo priorice antes).
- Hardening de QA sobre RLS y concurrencia de turnos (carga
  real/stress simple).

### Fase 3 — Pagos y monetización (opcional, a definir con el negocio) (4-6 semanas)
- Integración de gateway de pago.
- Planes/suscripción por organización.

**Total estimado hasta Fase 2 (producto B2B funcional y vendible sin
cobro in-app): ~16-21 semanas (4-5 meses)** con el equipo mínimo de la
sección 2.1. Fase 3 es incremental y puede ir después del primer cliente
firmado.

---

## 4. Riesgos principales a mencionar en la propuesta

1. **RLS multi-tenant mal implementada = fuga de datos entre
   organizaciones.** Mitigación: staging con Supabase branching, suite de
   tests de QA específica por rol antes de cada release de esquema.
2. **Concurrencia en reservas de turnos** (dos pilotos pidiendo el mismo
   horario). Mitigación: constraint de exclusión a nivel Postgres
   (`EXCLUDE USING gist` sobre rango de tiempo + aeronave), no solo
   validación en el cliente.
3. **Adopción por parte de dueños de escuela no técnicos**: el
   dashboard admin necesita más inversión de UX que el resto de la app
   (que hoy es de un solo usuario avanzado). Justifica la dedicación
   part-time de UX en 2.1.
4. **Alcance de "empresa privada" puede crecer** (tripulación múltiple,
   mantenimiento, combustible) — se recomienda mantener Fase 1 acotada a
   lo pedido (flota + despacho directo) y tratar el resto como backlog
   post-MVP.
