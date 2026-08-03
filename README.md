# ✈️ Libro de Vuelo — ANAC 290/2012

Libro de vuelo personal para un solo piloto. Sigue el formato de la **Hoja de
Libro de Vuelo de Pilotos** (Resolución ANAC 290/2012), calcula automático
los totales/discriminaciones del libro, muestra el progreso hacia distintas
licencias/cursos (APPL, PPA, PCA, TLA — mínimos configurables y
**referenciales**) y lleva el costo de la carrera por hora volada como dato
secundario (lo primero que ves es tu total de horas).

**Esto NO reemplaza al Registro Electrónico de Horas de Vuelo oficial**
(declaración jurada vía Casillero Aeronáutico Digital). Es una herramienta
paralela para uso personal.

No hay build ni framework: es HTML + CSS + JS "de toda la vida", así que no
hace falta `npm install` para nada del frontend. Lo único que instalás es la
base de datos (Supabase) y el hosting (Vercel).

---

## 1) Cómo está armado (arquitectura, en criollo)

- **Frontend**: HTML/CSS/JS vanilla. Es una SPA (single page app) con router
  a mano por `#hash` (`js/router.js`) — cuando cambiás de pestaña, cambia el
  hash de la URL y se re-renderiza el contenido de `<main>`. No usamos React
  ni ningún framework: para una app de un solo usuario con 8 pantallas, un
  framework es peso muerto. Cada pantalla vive en `js/views/*.js` y expone un
  objeto `ViewX.render()`.
- **Backend**: no hay servidor propio. **Supabase** te da la base de datos
  (Postgres), el login (Auth) y una API REST/JS lista para pegarle directo
  desde el navegador. La seguridad no depende de "confiar" en el cliente:
  cada tabla tiene **Row Level Security (RLS)** activada, o sea que aunque
  alguien tenga tu `anon key` (que es pública a propósito), Postgres no le va
  a dejar leer ni escribir filas que no sean del usuario logueado.
- **Cálculo**: toda la lógica de "cómo se suman las horas" vive en un solo
  lugar, `js/calc.js`, y se usa tanto para la vista previa en el formulario
  como para los totales del dashboard. Así evitamos que el número que ves al
  cargar un vuelo no coincida con el que después ves en Totales.
- **Offline**: `js/offline.js` guarda los vuelos en IndexedDB si no hay señal,
  y los sincroniza solo cuando vuelve la conexión (evento `online` del
  navegador). El Service Worker (`sw.js`) aparte cachea el "shell" de la app
  (HTML/CSS/JS) para que abra sin internet.
- **Deploy**: Vercel sirve los archivos estáticos tal cual. No hay backend
  que levantar en Vercel — todo el trabajo de servidor lo hace Supabase.

---

## 2) Levantar Supabase (la base de datos)

1. Andá a [supabase.com](https://supabase.com), creá una cuenta gratis y
   un proyecto nuevo (elegí una región cercana, ej. `sa-east-1` São Paulo).
2. Una vez creado, andá a **SQL Editor** (ícono de la izquierda) → **New
   query**.
3. Abrí el archivo `sql/schema.sql` de este repo, copiá **todo** el
   contenido, pegalo en el editor y apretá **Run**. Esto crea las tablas
   (`aeronaves`, `vuelos`, `vuelos_programados`, `config_licencia`,
   `perfil_piloto`, `vencimientos`), los cálculos automáticos (columnas
   `generated always as`, que son las que hacen la suma de horas sola) y
   las políticas de RLS.
   - Si ya habías corrido una versión vieja del schema antes, no pasa nada:
     es seguro pegar el archivo entero de nuevo, el bloque de
     "ACTUALIZACIÓN" al final aplica los cambios sin romper lo que ya
     tenías cargado.
4. Andá a **Authentication → Providers** y confirmá que **Email** esté
   habilitado (viene así por defecto). La app usa email + contraseña: te
   registrás una vez desde la pantalla de "Crear cuenta" y después entrás
   con esas credenciales. También hay recuperación de contraseña por mail
   ("¿Olvidaste tu contraseña?").
   - Si querés evitar el paso de "confirmá tu email" al crear la cuenta
     (para una app de un solo usuario no suma mucho), podés desactivar
     **Confirm email** en **Authentication → Providers → Email**. Si lo
     dejás activado, después de crear la cuenta te va a llegar un mail de
     confirmación antes de poder iniciar sesión.
5. Andá a **Authentication → URL Configuration** y agregá la URL donde vas a
   tener la app corriendo (por ejemplo `https://tu-app.vercel.app` y también
   `http://localhost:3000` si la vas a probar local) en **Redirect URLs**.
6. Andá a **Project Settings → API** y copiá:
   - **Project URL**
   - **anon public key**

---

## 3) Conectar el frontend con Supabase

Abrí `js/config.js` y completá:

```js
window.SUPABASE_CONFIG = {
  url: 'https://TU-PROYECTO.supabase.co',
  anonKey: 'TU-ANON-KEY-PUBLICA',
};
```

Ojo: la `anon key` es pública a propósito (va a viajar al navegador de quien
sea), pero como activamos RLS en el paso anterior, nadie puede leer datos que
no sean suyos aunque tenga esa key.

---

## 4) Probarlo local

No hace falta Node ni build. Cualquier servidor estático sirve, por ejemplo:

```bash
# con Python (viene instalado en casi todos lados)
python3 -m http.server 3000

# o con Node, si lo tenés
npx serve -l 3000
```

Y abrís `http://localhost:3000`. La primera vez, andá a la pestaña **Crear
cuenta**, poné tu email y una contraseña; las siguientes veces entrás con
**Iniciar sesión**.

---

## 5) Deploy en Vercel

1. Subí este repo a GitHub (o el que ya tengas conectado).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → elegí el
   repo.
3. Como es un sitio estático sin build, en **Framework Preset** elegí
   **Other**, dejá el **Build Command** y **Output Directory** vacíos (Vercel
   sirve la raíz del repo tal cual).
4. Deploy. Cuando termine, agregá esa URL (`https://tu-app.vercel.app`) a las
   **Redirect URLs** de Supabase (paso 2.5) para que el login funcione ahí
   también.

Listo, ya está online. Como es PWA, desde el celular podés "Agregar a
pantalla de inicio" y se instala como app.

---

## 6) Primeros pasos dentro de la app

1. Entrá a **Aeronaves** y cargá al menos un avión, con sus tarifas por hora
   diurna/nocturna — de ahí sale el cálculo de costos, así que sin esto no
   podés cargar vuelos.
2. Entrá a **Perfil** y revisá los mínimos de horas para la CPL (vienen
   precargados con valores de referencia la primera vez que entrás — son
   editables, y **hay que confirmarlos contra la RAAC 61.129 vigente**, esto
   no es asesoramiento legal ni reemplaza la normativa oficial).
3. Cargá vuelos desde **Nuevo vuelo**, en modo rápido (por defecto) o
   detallado (botón arriba a la derecha del formulario) si necesitás tocar
   los 8 campos del libro a mano.
4. El **Dashboard** te va mostrando el progreso, los últimos vuelos, los
   vencimientos que cargues en Perfil y algunas estadísticas.

---

## 7) Reglas de cálculo (por si las tocás)

Los 8 campos de tiempo del formato ANAC son **excluyentes** — cada hora cae
en un solo campo. Por eso:

- `tiempo_total` = suma de los 8 campos.
- Las **discriminaciones** (multimotor, reactor, instrucción, instrumentos,
  etc.) están **incluidas** dentro de esos 8 campos y se muestran aparte solo
  como información — **no se suman al total** ni se duplican.
- El costo de cada vuelo sale de `horas de día × tarifa diurna del avión +
  horas de noche × tarifa nocturna del avión`. Nunca se carga plata a mano.

Toda esta lógica vive en `js/calc.js` (para el cliente) y se replica en las
columnas `generated always as` de `sql/schema.sql` (para que los totales que
ves siempre coincidan con lo que hay en la base, incluso si consultás la
tabla directo desde Supabase).

---

## 8) Notificaciones push (opcional)

Avisos de **Vencimientos** (CMA, habilitaciones, IFR, currency) y **Vuelos
programados** que llegan al celular/notebook aunque la app esté cerrada.
Es Web Push nativo (estándar del navegador, protocolo VAPID) + Supabase —
nada de terceros, nada de pagar por notificaciones. Sin este paso la
pestaña **Perfil → Notificaciones** sigue andando, pero avisa que falta
configurar el servidor en vez de romperse.

1. Generá el par de claves VAPID (necesitás Node instalado, es un comando
   de una sola vez, no hace falta para nada más del proyecto):
   ```bash
   npx web-push generate-vapid-keys
   ```
   Te da una `Public Key` y una `Private Key`.

2. Pegá la **Public Key** en `js/config.js`:
   ```js
   window.VAPID_PUBLIC_KEY = 'TU-PUBLIC-KEY-ACÁ';
   ```
   (Es pública a propósito, igual que la `anon key` — identifica a tu
   servidor ante el navegador, no autoriza nada por sí sola.)

3. Instalá la [CLI de Supabase](https://supabase.com/docs/guides/cli) si no
   la tenés, logueate (`supabase login`) y desplegá la función:
   ```bash
   supabase functions deploy notificaciones-push --project-ref TU-PROJECT-REF --no-verify-jwt
   ```
   (`--no-verify-jwt` porque la función valida la sesión ella misma —
   mismo criterio que las funciones `metar` y `cotizacion` que ya tenés.)

4. Cargale los secretos (la **Private Key** NUNCA va al frontend, solo acá):
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=TU-PUBLIC-KEY --project-ref TU-PROJECT-REF
   supabase secrets set VAPID_PRIVATE_KEY=TU-PRIVATE-KEY --project-ref TU-PROJECT-REF
   supabase secrets set VAPID_SUBJECT=mailto:tu-email@ejemplo.com --project-ref TU-PROJECT-REF
   supabase secrets set CRON_SECRET=elegí-algo-largo-y-random --project-ref TU-PROJECT-REF
   ```

5. Corré `sql/agregar_notificaciones_push.sql` en el **SQL Editor** de
   Supabase (o pegá el `schema.sql` completo de nuevo, ya lo incluye).

6. Para que los avisos se disparen SOLOS (sin este paso, solo funciona el
   botón "Enviar notificación de prueba"): descomentá y completá el bloque
   final de `sql/agregar_notificaciones_push.sql` (programa un cron cada 5
   minutos con `pg_cron` que llama a la función — así un recordatorio de
   fecha/hora puntual no espera casi una hora de más) y corré ese bloque
   también.

7. Entrá a **Perfil → Notificaciones** en la app, tocá **Activar
   notificaciones** (te va a pedir permiso del navegador) y probá con
   **Enviar notificación de prueba**.

Falencias típicas si algo no llega (ver comentarios en
`js/notificaciones.js` y `supabase/functions/notificaciones-push/index.ts`
para el detalle de cada una):
- En iPhone, Safari solo entrega push si la PWA está instalada en la
  pantalla de inicio — abrirla en el navegador no alcanza.
- Necesita HTTPS (localhost es la única excepción); en un servidor de
  desarrollo sin TLS el Service Worker ni se registra.
- Si pediste permiso y tocaste "Bloquear" sin querer, hay que reactivarlo
  a mano desde la configuración del sitio en el navegador — la app no
  puede volver a preguntar sola.
- **El botón de prueba anda pero los avisos automáticos no llegan nunca**:
  visto en producción, causa casi segura es que `pg_net` corta a los 5s
  por default y la función (cold start + `npm:` imports) tarda un poco
  más. Se confirma así — `cron.job_run_details` va a decir "succeeded"
  igual (solo indica que se lanzó el pedido), pero:
  ```sql
  select status_code, error_msg from net._http_response order by created desc limit 5;
  ```
  va a mostrar `status_code` null y `error_msg` con "Timeout of 5000 ms
  reached". Se arregla subiendo `timeout_milliseconds` a 30000 en el
  `cron.schedule` (ver el comentario en
  `sql/agregar_notificaciones_push.sql`, sección CRON).

### 8.1) Recordatorios personalizados (varios avisos por evento)

Además del aviso automático general de arriba, podés agregar uno o varios
recordatorios propios a un vuelo programado puntual o a un vencimiento
puntual (botón de campanita 🔔 en la tarjeta/fila, o al terminar de
crearlos te lo pregunta la app) — "3 días antes", "2 horas antes", una
fecha y hora específica, y cuantos quieras combinados. También soporta
vencimientos "rodantes" (currency: vencés si no volás cada N días — se
resetea solo cada vez que cargás un vuelo).

Si ya hiciste los pasos 1-7 de arriba, para esto falta nada más que:

1. Correr `sql/agregar_recordatorios_personalizados.sql` en el **SQL
   Editor** de Supabase (o pegar `schema.sql` completo de nuevo).
2. Redesplegar la función (cambió su código):
   ```bash
   supabase functions deploy notificaciones-push --project-ref TU-PROJECT-REF --no-verify-jwt
   ```

Los eventos que NO tengan ningún recordatorio propio siguen recibiendo el
aviso general de siempre (toggles + horas de anticipación de Perfil →
Notificaciones) — esto es aditivo, no rompe lo que ya tenías andando.

---

## 9) Foto de aeronave (opcional)

Cada ficha de Aeronaves/Simuladores puede tener una foto propia (se
muestra en la tarjeta de la grilla en vez del degradé + ícono genérico).
Se sube directo a Supabase Storage, sin ningún servicio de terceros.

1. Correr `sql/agregar_foto_aeronave.sql` en el **SQL Editor** de Supabase
   (o pegar `schema.sql` completo de nuevo). Crea la columna
   `aeronaves.foto_url` y el bucket público `aeronaves-fotos` con
   políticas para que cada usuario solo pueda subir/reemplazar/borrar sus
   propios archivos (carpeta = su `user_id`) — la lectura es pública
   (son solo fotos de aviones, sin dato sensible, y así se muestran con
   una URL directa sin pasar por el cliente autenticado).
2. Nada más — el botón para agregar/cambiar la foto ya aparece en cada
   ficha de Aeronaves. Sin correr este paso, la app sigue andando igual
   (el botón de foto no hace nada hasta que exista la columna).

También podés cargar la **base** (aeródromo donde está guardada la
aeronave, ej. "SADF", "MOR") — se muestra en la tarjeta de la grilla.
Solo hace falta correr `sql/agregar_base_aeronave.sql` (o `schema.sql`
de nuevo); sin ese paso, el campo queda vacío pero no rompe nada.

Si el recorte automático de la miniatura (foto ancha/vertical forzada a
una tira baja) te deja afuera la parte importante de la foto, hay un
control de "Ajustar encuadre" (un slider) en la propia ficha para
corregirlo sin volver a subirla. Necesita `sql/agregar_posicion_foto_aeronave.sql`
(o `schema.sql` de nuevo); sin correrlo, el control mueve la vista previa
pero no guarda el cambio (tira error al soltar el slider).

---

## 10) Track GPS real del vuelo (opcional)

Al cargar o editar un vuelo, se puede subir el archivo `.kml` que se
descarga de [FlightRadar24](https://www.flightradar24.com/) para un
vuelo puntual con transponder ADS-B ("Download" → KML en la página del
vuelo — el CSV que ofrece la misma página no siempre viene en un formato
parseable, así que por ahora solo se soporta KML). Se parsea del lado
del cliente (`js/trackParser.js`, sin subir el archivo a ningún lado ni
depender de un servicio externo) y se guardan los puntos `[lat, lon]`
del recorrido — se muestra como un mini mapa en la ficha del vuelo
(Bitácora → tocar el vuelo, con un botón para ampliarlo a pantalla
completa y hacer zoom), con el trazado real en vez de la línea recta
origen-destino. Es opcional y por vuelo — nada se calcula ni se agrega
si no subís nada.

1. Correr `sql/agregar_track_vuelo.sql` en el **SQL Editor** de Supabase
   (o pegar `schema.sql` completo de nuevo). Crea la columna
   `vuelos.ruta_track` (jsonb).
2. Nada más — el campo de archivo ya aparece en el formulario de Nuevo
   vuelo. Sin correr el SQL, subir un archivo tira error al guardar (la
   columna no existe); el resto del vuelo se puede seguir cargando igual.

Los `.kmz` (KML comprimido) no están soportados por ahora — hace falta
descomprimir un zip del lado del cliente, fuera de alcance de esta
primera versión. Un track muy largo (miles de posiciones, típico de un
vuelo de varias horas) se muestrea a un máximo de 500 puntos antes de
guardarlo — a la escala en que se ve un vuelo entero en el mapa no se
nota la diferencia, y evita inflar la fila.

---

## 11) Mínimos de licencia personalizados (opcional)

Los mínimos de horas de cada curso (Perfil → Datos Personales → "Mínimos
de tu licencia") vienen precargados con los valores de referencia de la
RAAC vigente — una tabla global, la misma para todos los pilotos, que solo
edita la cuenta admin (ver sección 6 más abajo) cuando cambia la
normativa. Si tu escuela/CIAC te exige otra cosa para algún requisito
puntual (ej. 250 hs totales en vez de las 200 de referencia para PCA),
podés guardar tu **propio** valor para ese requisito sin tocar el de
referencia ni el de ningún otro usuario — un ícono de "✕" al lado vuelve
a usar el valor de referencia cuando quieras.

1. Correr `sql/agregar_licencias_requisitos_personal.sql` en el **SQL
   Editor** de Supabase (o pegar `schema.sql` completo de nuevo). Crea la
   tabla `licencias_requisitos_personal` (una fila por usuario+requisito
   personalizado, con su propia RLS — cada quien solo ve/edita la suya).
2. Nada más — la sección ya aparece en Perfil → Datos Personales para
   cualquier curso activo que tenga mínimos de referencia cargados. Sin
   correr el SQL, el botón de guardar personalización tira error (la
   tabla no existe); el resto de la app sigue andando igual.

---

## 12) Registro de errores (opcional)

Monitoreo básico y propio, sin depender de ningún servicio de terceros
(Sentry y similares necesitan cuenta/API key que esta app no tiene
configurada). `js/errorLog.js` agarra solo los errores no manejados que
le pasan a CUALQUIER usuario (`window.onerror`, promesas rechazadas sin
catch, y las pantallas que fallan al renderizar) y guarda un registro
corto — mensaje, URL, cuándo — en una tabla nueva. Solo la cuenta admin
(ver sección 6) los puede leer, en Perfil → Preferencias → Admin.

1. Correr `sql/agregar_registro_errores.sql` en el **SQL Editor** de
   Supabase (o pegar `schema.sql` completo de nuevo). Crea la tabla
   `error_logs` con RLS: cualquier usuario logueado puede insertar (reportar
   sus propios errores), pero solo el admin puede leer o borrar.
2. Nada más — sin correr el SQL, el intento de guardar un error falla en
   silencio (no rompe nada, simplemente no queda registrado) y el panel de
   admin muestra un aviso de que falta correr la migración.

Es "best effort" a propósito: si guardar el error falla (sin sesión
todavía, sin señal, tabla sin crear), no reintenta ni interrumpe nada —
nunca puede ser la causa de un problema nuevo.

---

## 13) Borrar cuenta y política de privacidad

Si vas a abrir la app a más de un piloto, esto ya no es opcional (Ley
25.326 de Protección de Datos Personales) — `privacidad.html` explica qué
se guarda, para qué y por cuánto tiempo, y Perfil → Datos Personales →
Zona de peligro tiene el botón "Borrar mi cuenta" (borra la cuenta y todos
los datos del usuario, incluidas las fotos, de forma permanente).

1. Desplegá la función (usa la `service_role key`, que Supabase inyecta
   sola — no hace falta configurar nada más):
   ```bash
   supabase functions deploy borrar-cuenta --project-ref TU-PROJECT-REF --no-verify-jwt
   ```
   (`--no-verify-jwt` por el mismo motivo que `notificaciones-push`: la
   función valida la sesión ella misma leyendo el JWT del usuario.)
2. Nada más — el cascade de `sql/schema.sql` (`on delete cascade` en
   todas las tablas que referencian `auth.users`) borra automáticamente
   aeronaves, vuelos, vencimientos, perfil, config de licencia,
   notificaciones y recordatorios apenas se borra la cuenta; la función
   solo se encarga de las fotos en Storage (que no tienen foreign key) y
   de borrar la cuenta en sí. Sin desplegar la función, el botón muestra
   un error claro en vez de fallar en silencio.

---

## 14) Organizaciones (escuelas de vuelo y empresas — opcional, Fase 0 B2B)

Capa multi-tenant aditiva por encima del modelo de piloto individual: un
piloto que nunca crea ni se une a una organización no nota que esto existe.
Ver `PROPUESTA_B2B.md` (o el documento de propuesta del repo) para el plan
completo de fases; esto es solo la Fase 0 fundacional — organizaciones y
membresías con roles, sin flota de organización ni turnos todavía.

1. Correr `sql/agregar_organizaciones.sql` en el **SQL Editor** de Supabase.
   Crea las tablas `organizaciones` y `organizacion_miembros`, la función
   `is_member_of()` (para RLS de esta y futuras tablas de organización) y
   las funciones que hacen de única puerta de entrada para escribir:
   `crear_organizacion`, `invitar_miembro`, `aceptar_invitacion`,
   `rechazar_invitacion`, `salir_organizacion`, `quitar_miembro`.
2. Nada más — Perfil → Organizaciones ya queda disponible para cualquier
   piloto logueado. Ahí puede crear una organización (queda como `owner`),
   invitar a otro piloto **ya registrado en la app** por su email (owner/admin
   nomás), y cualquier piloto puede aceptar/rechazar sus propias invitaciones.
3. Sin correr el SQL, la pantalla de Organizaciones falla al pedir los
   datos — no rompe el resto de la app (bitácora, aeronaves, perfil de
   piloto siguen intactos), pero ese ítem del menú de Perfil no funciona.

Roles dentro de una organización: `owner` (control total), `admin` (mismo
alcance salvo borrar la organización), `instructor` y `piloto_vinculado`
(autogestión, sin permisos de gestión). Las fases siguientes (turnos con
autogestión/autorización, despacho para empresas) se agregan con su propio
`sql/agregar_*.sql` reutilizando `is_member_of()`.

**Flota de organización (Fase 2):** correr además `sql/agregar_flota_org.sql`
(depende del anterior). Reutiliza la misma tabla `aeronaves` de siempre —
una aeronave pertenece a un piloto (`user_id`, como hoy) O a una
organización (`org_id` nuevo), nunca a las dos cosas; las aeronaves
personales existentes no se tocan. El owner/admin arma y edita la flota
(matrícula, tarifas, horas de célula/motor, próxima inspección anual)
desde `Perfil → Organizaciones`; instructor/piloto_vinculado la ven pero
no la editan.

---

## 15) Qué falta / mejoras futuras

- Códigos ANAC reales para multimotor/reactor/turbohélice/aeroaplicador en
  `js/exportadorAnac.js` (`CLASE_ABREV`) — solo monomotor ('MONTT') está
  confirmado; el resto cae a una abreviación armada, no al código oficial.
