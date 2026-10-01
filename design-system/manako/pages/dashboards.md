# Override: Dashboards (instructor / admin / student)

> Override de densidad y datos para superficies de gestión. Precedencia sobre
> `../MASTER.md` en estas páginas.

## Densidad

- Padding de tarjeta: 16–20px (vs 24–32 en marketing).
- Filas de tabla: py 12px; separadores `divide-y slate-100`.
- KPIs: label 11px uppercase muted + valor 24–30px `tabular-nums` semibold. El número es el elemento ruidoso; el label, callado (jerarquía por peso/color, no por tamaño).

## Tablas

- Numéricos **derecha** + `.tnum` (importes, conteos, fechas relativas).
- Valores enumerados (status/rol) → chip/badge con icono o texto, nunca color solo.
- Texto largo → `truncate` con `title` completo.
- Hover de fila: `hover:bg-slate-50`; acciones destructivas piden confirmación explícita.
- Responsive: scroll horizontal en el contenedor (`overflow-x-auto`), nunca tablas que rompan el layout.

## Feedback

- Toda acción de escritura → toast breve de éxito/error (nada de éxito silencioso).
- Estados async completos: skeleton de tarjetas/tiles, empty con CTA, error con retry.
