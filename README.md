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

## 8) Qué falta / mejoras futuras

- PDF pixel-perfect a la hoja física de 35,5 × 16,5 cm (hoy exporta un PDF
  tabular vía impresión del navegador, con el mismo orden de columnas, pero
  no calca las medidas exactas del formulario papel).
- Mapa geográfico real de rutas (hoy se muestra un ranking de rutas más
  voladas; falta geocodificar los códigos OACI a lat/lon para el mapa).
- Edición inline completa en la Bitácora (hoy se edita reabriendo el vuelo).
