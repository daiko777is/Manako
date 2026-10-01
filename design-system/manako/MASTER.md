# Manakō — Design System MASTER

> Source of Truth global (patrón Master + Overrides de la skill `ui-ux-pro-max`).
> Generado y **verificado** contra el dataset de la skill (2026-09). Las
> decisiones que se desvían de la salida automática están marcadas con
> ⚖️ *deviation* y su justificación. Overrides por página: `pages/`.

## 1. Identidad

- **Producto**: plataforma de cursos en video para profesionales tech (B2C + marketplace de instructores).
- **Estilo** (match verificado del dataset): **Minimalism & Swiss Style** — clean, spacious, functional, grid-based, high contrast. Coste de rendimiento: bajo. Riesgo de accesibilidad: bajo.
- **Personalidad**: sobria, precisa, "herramienta profesional". La decoración nunca compite con el contenido (el contenido ES el producto: portadas de cursos y video).

## 2. Color

Paleta de marca (match verificado del dataset: Primary `#4F46E5` — idéntico al brand existente):

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#4F46E5` (indigo-600) | CTA, enlaces, estado activo, foco |
| primary-hover | `#4338CA` (indigo-700) | hover de CTA |
| primary-tint | `#EEF2FF` (indigo-50) | fondos de selección suave, icon tiles |
| secondary | `#818CF8` (indigo-400) | acentos secundarios (rings sobre oscuro) |
| ink | `#0F172A` (slate-900) | texto principal, botones sólidos oscuros |
| muted | `#64748B` (slate-500) | texto secundario — **mínimo** para texto (4.6:1 sobre blanco) |
| faint | `#94A3b8` (slate-400) | **solo decorativo** (iconos, divisores) — nunca texto en fondo claro ⚖️ |
| bg | `#F8FAFC` (slate-50) | fondo de página |
| surface | `#FFFFFF` | tarjetas, formularios |
| border | `#E2E8F0` (slate-200) | hairlines |
| success / warning / danger | `#059669` / `#D97706` / `#E11D48` | estados semánticos |

- ⚖️ *Deviation*: el dataset sugiere Accent CTA naranja `#EA580C`. **Rechazado**: un segundo acento cromático compite con el indigo en un sistema minimalista; los estados ya cubren semántica (emerald/amber/rose).
- ⚖️ *Deviation*: Background sugerido `#EEF2FF` (indigo-50). **Rechazado** para la página: Swiss style pide fondo casi neutro; indigo-50 queda reservado como tinte de selección/activo.
- Regla de oro: **el color nunca es la única señal** (icono + texto acompañan a badges de estado).
- Degradados: prohibidos como decoración. Única excepción histórica: ninguna en v2 (el progreso se pinta en sólido).

## 3. Tipografía

- **Pairing** (match verificado #1 dominio `typography`, "Tech Startup"): **Space Grotesk** (headings, 500–700) + **DM Sans** (body, 400–700).
- ⚖️ *Deviation*: `--design-system` devolvió Baloo 2/Comic Neue (perfil infantil). **Rechazado** por audiencia (profesionales tech adultos).
- Escala: 11.5px (labels uppercase) · 12–13.5px (meta/secundario) · 15px (base UI) · 17.5px (lead) · 24–32px (sección) · 40–56px (hero). Nunca <12px para texto real.
- Números: `font-variant-numeric: tabular-nums` (`.tnum`) en KPIs, tablas, precios, tiempos.
- Line-height: 1.05 (display) → 1.65 (párrafos largos). Longitud de línea ≤ 75ch.

## 4. Espaciado y densidad

- Escala 4px: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96.
- **Densidad por superficie** (override `pages/dashboards.md`): marketing = spacious (secciones 64–96px); app/dashboards = standard-compact (padding de tarjeta 16–20px, filas de tabla 12px).
- Container máx: 1120px (1280 en /aprender con sidebar).

## 5. Profundidad y bordes

- Bordes hairline `1px slate-200`; la jerarquía se logra por **valor** (texto ink vs muted) antes que por sombras.
- Sombras de dos partes (contacto + ambiente):
  - `--shadow-xs: 0 1px 2px rgb(15 23 42/.05)` — botones
  - `--shadow-md: 0 2px 4px rgb(15 23 42/.04), 0 12px 28px -8px rgb(15 23 42/.14)` — hover de tarjeta, menús
- Radios: 6px (controles pequeños) · 8px (botones/inputs) · 12px (cards) · 9999px (badges/chips).
- Luz única desde arriba: nunca `shadow-glow` ni sombras coloreadas.

## 6. Movimiento

- Solo **funcional**: feedback (hover/active 150ms), aparición de contenido (reveal 400–500ms, ease-out, translateY ≤ 14px), estado de carga (skeleton shimmer, spinner).
- Duraciones: 150ms interacciones · 300–500ms transiciones de contenido · nunca > 700ms.
- `prefers-reduced-motion` anula todo (media query global).
- Prohibido: blobs, marquees decorativos, parallax, animaciones de ancho/alto (usar transform/opacity).

## 7. Estados obligatorios (hidden UI)

Toda superficie async tiene **loading (skeleton con espacio reservado → CLS≈0), empty (con acción de salida) y error (con retry)**. Botones icon-only llevan `aria-label`. Foco visible `:focus-visible` 2px indigo. Touch targets ≥ 36px (WCAG 2.5.8 AA supera 24px; objetivo interno 36–44) con separación ≥ 8px.

## 8. Componentes canónicos

`.btn-primary` (sólido indigo) · `.btn-secondary` (blanco + hairline) · `.btn-ghost` · `.btn-sm/-lg` · `.card` / `.card-hover` · `.input` (focus ring 3px indigo/20) · `.label` + error de campo inline con `aria-describedby` · `.chip` / `.chip-active` (activo = slate-900 sólido) · `.badge-*` (tinte + ring interior) · `.eyebrow` / `.eyebrow-muted` (texto, no píldora) · `.nav-link` + `.nav-active` (acento lateral 2px) · `.skeleton` · `.reveal` · `.tnum` · `app-icon` (SVG Heroicons 24-outline, stroke 1.8 — **cero emojis como iconos**) · `app-progress-ring` / `app-progress-bar` (sólido indigo) · `app-stats-counter`.

## 9. Anti-patrones vetados (lecciones de la v1 "slop")

Gradientes decorativos · glassmorphism generalizado · blobs/mesh de fondo · glow shadows · texto con gradiente · emoji como iconos · estadísticas inventadas · testimonios ficticios · eyebrow-pills repetitivos · marquee · radios > 16px en componentes · gris-sobre-gris (texto slate-400 sobre blanco).

## 10. Procedencia

Dirección validada con: `search.py "professional developer education course platform trustworthy calm" --design-system --variance 3 --motion 3 --density 5` (→ Minimalism & Swiss Style + paleta indigo) y queries de dominio `ux` (forms/touch/tables), `typography` (pairing Tech Startup), `landing`. Principios de craft: skill `ui-craft` (Refactoring UI). Este MASTER se escribió a mano a partir de resultados **verificados** (el output crudo sugería tipografía infantil y acento naranja — ver deviations).
