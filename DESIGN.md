# DESIGN.md

Identidad visual: "Avionics Professional" — instrumental de cabina, serio y
técnico, sin emojis. Referencia completa de tokens en `css/styles.css`
(`:root`); este documento es el resumen para calibrar futuros cambios.

## Tema

Oscuro por defecto (`:root`), claro como alternativa vía
`[data-theme="light"]` o `prefers-color-scheme: light` cuando no hay elección
explícita guardada.

## Colores

- `--brand` / `--brand-strong`: naranja cálido — único acento cromático fuerte
  de la app (CTA, progreso, estado activo). No sumar azul/verde/rojo como
  color "de marca" adicional.
- `--ok` / `--warn` / `--danger`: estados semánticos, discretos, nunca compiten
  visualmente con el naranja.
- `--bg` / `--bg-elevated` / `--bg-subtle` / `--bg-elevated-2`: 4 niveles de
  profundidad de fondo (base, superficie de card, superficie hundida,
  superficie elevada/modal).
- `--text` / `--text-muted`: texto primario/secundario. Contraste AA mínimo
  sobre `--bg` y `--bg-elevated`.

## Tipografía

- `--font` (Inter): UI, labels, cuerpo. Pesos 400/500/600/700.
- `--font-mono` (JetBrains Mono): cualquier dato numérico (horas, fechas,
  montos, tablas) — siempre con `font-variant-numeric: tabular-nums`.

## Iconografía

Set propio de SVG de línea en `js/icons.js` (objeto `Icons`, estilo
Feather/Lucide: trazo 1.75, `stroke-linecap/linejoin round`). Nunca
reintroducir emoji como ícono ni como bullet. Si falta un ícono, agregar una
entrada nueva a `Icons` en vez de usar texto/emoji de reemplazo.

## Forma

`--radius` (10px) en cards, `--radius-sm` (6px) en botones/inputs/chips.
Evitar `border-radius: 999px` (píldora) salvo casos puntuales ya existentes
antes del rediseño; preferir rectángulos con esquina suave.

## Elevación

`--shadow`: sombra nítida (blur bajo, inset sutil de borde superior), no el
blur difuso genérico de dashboards SaaS. Mantener ese criterio en componentes
nuevos.

## Componentes clave

- `.card`: contenedor base, borde 1px + `--shadow`.
- `.doc-card`: card de vencimiento/dato, sin borde de acento lateral.
- `.badge`: estado (ok/warn/danger), ícono + texto, radio `--radius-sm`.
- Tabla densa (`.table-wrap table`): headers en mayúsculas, columnas
  numéricas en `--font-mono` alineadas a la derecha (`.num`).
