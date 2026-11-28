---
name: SGCUB
description: Sistema de gestión integral del Club Universitario de Berisso — secretaría, ventanilla y registro del club en una sola pantalla.
colors:
  primary: "#006493"
  primary-container: "#38b6ff"
  primary-fixed: "#cae6ff"
  on-primary: "#ffffff"
  secondary: "#006398"
  tertiary: "#565e74"
  error: "#ba1a1a"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  success-soft: "oklch(97.9% 0.021 166.113)"
  success-ink: "oklch(50.8% 0.118 165.612)"
  warning-soft: "oklch(98.7% 0.022 95.277)"
  warning-ink: "oklch(55.5% 0.163 48.998)"
  background: "#f8f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#eff4ff"
  surface-container: "#e5eeff"
  surface-container-high: "#dce9ff"
  on-surface: "#0b1c30"
  on-surface-variant: "#3e4850"
  outline: "#6e7882"
  outline-variant: "#bec8d2"
  chart-income: "#059669"
  chart-1: "#2a78d6"
  chart-2: "#eb6834"
  chart-3: "#1baf7a"
  chart-4: "#eda100"
  chart-5: "#e87ba4"
  chart-6: "#008300"
  dark-background: "#121417"
  dark-surface-container-lowest: "#181b20"
  dark-surface-container-low: "#1f2329"
  dark-surface-container: "#262b33"
  dark-on-surface: "#e5e7eb"
  dark-on-surface-variant: "#9ca3af"
  dark-outline-variant: "#343a44"
  dark-primary: "#3578b8"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "40px"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "32px"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  body-compact:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0.05em"
  figure:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "1.25"
    fontFeature: "tnum"
rounded:
  DEFAULT: "2px"
  lg: "4px"
  md: "6px"
  xl: "8px"
  full: "12px"
spacing:
  space-xs: "4px"
  space-sm: "8px"
  space-md: "16px"
  space-lg: "24px"
  gutter: "24px"
  space-xl: "32px"
  margin: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-container-low}"
  button-text:
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  input-search:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.DEFAULT}"
    height: "40px"
    padding: "0 16px 0 44px"
  input-search-focus:
    backgroundColor: "{colors.surface-container-lowest}"
  panel:
    backgroundColor: "{colors.surface-container-lowest}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  badge-info:
    backgroundColor: "{colors.primary-fixed}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "2px 6px"
  badge-ok:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.full}"
    padding: "2px 6px"
  badge-alerta:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning-ink}"
    rounded: "{rounded.full}"
    padding: "2px 6px"
  badge-error:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    rounded: "{rounded.full}"
    padding: "2px 6px"
  nav-item:
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.title}"
    rounded: "{rounded.DEFAULT}"
    padding: "8px 8px"
  nav-item-active:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.primary}"
---

# Design System: SGCUB

## Overview

**Creative North Star: "La Secretaría del Club"**

Es la secretaría de un club de barrio que funciona bien. A la vez es **ventanilla**: un pago se registra en segundos y desde cualquier pantalla. También es **libro de actas**: cada dato queda asentado, prolijo y fácil de encontrar. Y es una **oficina ordenada**: la información necesaria se ve sin buscarla y nada distrae del trámite. Las tres facetas pesan lo mismo, y una pantalla nueva tiene que cumplir con las tres.

La interfaz es **amable y cercana**. La usan personas de todas las edades, algunas con poca práctica con la computadora, así que nunca intimida. El fondo es claro y levemente frío. El Azul Berisso es el único acento. Las superficies son casi planas y se separan por tono y por bordes suaves, no por sombras. La amabilidad no viene de la decoración sino del tamaño, el aire y la claridad: textos legibles, botones fáciles de acertar y estados que se entienden de un vistazo.

La identidad del club está siempre presente a través del escudo en el encabezado, los comprobantes y las comunicaciones. La interfaz no compite con él.

**Key Characteristics:**
- Un solo acento cromático (Azul Berisso) sobre neutros claros con tinte azulado.
- Superficies casi planas: tono y borde primero, sombra solo para lo que flota.
- Inter en toda la interfaz, cuerpo en 16px y cifras tabulares en montos y KPIs.
- Navegación lateral fija con secciones plegables y encabezado fijo con el escudo.
- Estados (al día, alerta, deuda) siempre con color y texto, nunca solo con color.
- Modo claro por defecto y modo oscuro completo (gris neutro con azul sobrio).

## Colors

Es una paleta Material 3 de tinte azulado: neutros claros que tiran al cielo, un azul profundo que guía y tonos semánticos suaves para los estados.

### Primary
- **Azul Berisso** (`primary`): el color del club en la interfaz. Se usa en los botones principales, el ítem activo del menú, los enlaces, la pestaña activa, el foco y los íconos de sección activa. Es lo que se toca para avanzar.
- **Celeste Berisso** (`primary-container`): la versión luminosa. Se usa en anillos de foco de los campos y en acentos de fondo muy diluidos. No se usa nunca para texto.
- **Bruma Berisso** (`primary-fixed`): el fondo de los badges informativos y de las categorías principales, al 30% de opacidad.

### Secondary
- **Azul Secretaría** (`secondary`): casi gemelo del primario. Queda para acentos secundarios puntuales.

### Tertiary
- **Pizarra** (`tertiary`): un gris azulado para elementos de apoyo neutros.

### Neutral
- **Papel Celeste** (`background`): el fondo general de la aplicación.
- **Blanco Planilla** (`surface-container-lowest`): paneles, tablas, sidebar, header y modales. Es la "hoja" donde se trabaja.
- **Celeste Lavado** (`surface-container-low`): el fondo de los campos de búsqueda, el hover de filas y del menú, y los contenedores secundarios.
- **Celeste Ficha** (`surface-container`): el fondo del ítem activo del menú y los contenedores destacados.
- **Celeste Sello** (`surface-container-high`): badges neutros y avatares.
- **Tinta Actas** (`on-surface`): el texto principal.
- **Tinta Gris** (`on-surface-variant`): texto secundario, etiquetas, breadcrumbs e ítems inactivos del menú.
- **Línea Guía** (`outline`): íconos de apoyo y placeholders.
- **Línea Suave** (`outline-variant`): bordes y divisores, casi siempre al 30–40% de opacidad.

### Semánticos
- **Al día** (`success-soft` / `success-ink`): pagos registrados y estados correctos. Son el emerald de Tailwind.
- **Alerta** (`warning-soft` / `warning-ink`): vencimientos próximos y documentación por vencer. Son el amber de Tailwind.
- **Deuda** (`error`, `error-container`, `on-error-container`): saldo negativo, cuotas vencidas, errores y acciones destructivas.
- **Gráficos** (`chart-1` … `chart-6`, `chart-income`): una serie categórica para donuts y barras. `chart-income` se reserva para ingresos.

### Modo oscuro
Gris oscuro neutro (`dark-background`, `dark-surface-*`) con un azul sobrio (`dark-primary`). El cambio se hace con la clase `html.dark`, que redefine todas las variables `--color-*` y además remapea las paletas auxiliares de Tailwind (slate, emerald, amber, red, sky, pink) para que los badges y las alertas se mantengan legibles.

### Named Rules
**The One Blue Rule.** El Azul Berisso es el único acento. Si algo necesita llamar la atención y no es una acción ni un estado activo, se resuelve con jerarquía tipográfica, no con otro color.

**The Estado Con Palabras Rule.** Al día, alerta y deuda siempre llevan texto o ícono además del color. Un usuario tiene que poder leer el estado de un socio aunque no distinga el verde del ámbar.

## Typography

**Display Font:** Inter (con system-ui, sans-serif)
**Body Font:** Inter (con system-ui, sans-serif)
**Iconos:** Material Symbols Outlined

**Character:** una sola familia neutra y muy legible, que no llama la atención y se lee bien a cualquier edad. La jerarquía se arma con peso y tamaño, no con cambios de familia.

### Hierarchy
- **Display** (700, 32px, 40px): números protagonistas en tableros. Se usa poco.
- **Headline** (700, 24px, 32px, tracking ajustado): el título de cada página en el `PageHeader`.
- **Title** (600, 16px, 24px): títulos de panel, botones principales e ítems del menú.
- **Body** (400, 16px, 24px): el texto base de la aplicación, incluidos los ítems del menú y las pestañas.
- **Body compact** (400, 14px, 20px): celdas de tablas densas, campos de búsqueda y botones secundarios.
- **Label** (600, 14px, mayúsculas, tracking 0.05em): rótulos de KPIs y encabezados de grupo.
- **Figure** (700, 24px, cifras tabulares): montos, saldos y contadores, siempre con `tabular-nums` para que las columnas alineen.

### Named Rules
**The Dieciséis Rule.** El texto que se lee para trabajar arranca en 16px. Los tamaños de 11–13px (`label-sm`, `body-sm`, `text-xs`) quedan para metadatos y badges, nunca para información que el usuario necesita para decidir.

**The Cifra Alineada Rule.** Todo monto o conteo usa cifras tabulares.

## Layout

Es una aplicación de escritorio con un **encabezado fijo** de 70px (escudo + "C.U.B." a la izquierda, búsqueda y menú de usuario a la derecha) y un **sidebar fijo** de 260px que se contrae a 72px (solo íconos) con una transición de 220ms. El contenido se ubica en `main`, con 70px de margen superior y 2.5rem laterales, sobre el fondo `background`.

- **Navegación:** secciones plegables (`<details>`) para Personas, Finanzas, Comunicaciones y Administración, con sub-ítems indentados y una guía vertical a la izquierda.
- **Encabezado de página:** breadcrumb arriba, título a la izquierda y acciones a la derecha en la misma fila.
- **Contenido:** paneles blancos apilados con un gap de 24px (`gutter`). Las tablas van "a sangre" dentro del panel.
- **KPIs:** grillas de 2–4 columnas separadas por divisores verticales, no por tarjetas.
- **Espaciado:** escala de 4 / 8 / 16 / 24 / 32px.
- **Responsive:** se diseña para la PC de la secretaría; el celular es secundario y sirve sobre todo para consultar. Por debajo de 700px el sidebar deja de empujar el contenido y el `main` pierde el padding lateral. Por debajo de 640px (`max-sm`) las tablas ocultan las columnas secundarias para no desplazarse hacia los costados, los modales ocupan la pantalla completa y el pago de cuotas usa un formulario por pasos con una barra fija abajo (`PagoFormMobile`).

## Elevation & Depth

El sistema es **casi plano**. La profundidad se comunica por tono (blanco sobre papel celeste) y por bordes suaves (`outline-variant` al 30%). La sombra en reposo es apenas una marca de borde. Las sombras marcadas existen solo para lo que flota sobre la página.

### Shadow Vocabulary
- **Reposo** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`, `shadow-sm`): paneles, botones principales y campos destacados.
- **Flotante** (`shadow-md` / `shadow-lg`): menús desplegables y popovers.
- **Modal** (`shadow-xl` / `shadow-2xl`): modales y diálogos de confirmación.
- **Barra inferior** (`box-shadow: 0 -6px 16px rgba(15,23,42,0.08)`): barras de acción fijas al pie.

### Named Rules
**The Flota o No Rule.** Si un elemento no está por encima del contenido (modal, menú, toast), no lleva más que `shadow-sm`. Para agrupar se usan tono y borde, no sombra.

## Shapes

Las esquinas son apenas suavizadas y consistentes. La escala está configurada en [tailwind.config.js](Frontend/SGCUB/tailwind.config.js) y tiene una particularidad: `lg` es *menor* que `md`.

- **Casi recto** (`rounded` = 2px): campos de búsqueda, ítems del menú y botones de ícono.
- **Suave** (`rounded-lg` = 4px): paneles, botones principales y secundarios, y modales. Es el radio por defecto del sistema.
- **Medio** (`rounded-md` = 6px): botones de texto y algunos botones compactos.
- **Redondeado** (`rounded-xl` = 8px): pies de panel y contenedores destacados.
- **Pastilla** (`rounded-full` = **12px**, no infinito): badges y puntos de estado. En elementos de 32px o más (por ejemplo, el avatar del header) da un cuadrado redondeado, no un círculo. Para un círculo real hay que usar un valor explícito (`rounded-[50%]`).

Los bordes son de 1px en `outline-variant` con opacidad reducida (30–40%). Los acentos de estado activo usan una barra izquierda de 2px en Azul Berisso (sidebar) o un subrayado de 2px (pestañas).

## Components

### Buttons
Son claros y generosos: se entiende qué hacen y son fáciles de acertar.
- **Shape:** esquina suave (4px).
- **Primary:** Azul Berisso con texto blanco, 40px de alto, 16px de padding horizontal, semibold de 16px, `shadow-sm` y un ícono opcional a la izquierda.
- **Hover / Focus:** al pasar el mouse el fondo baja al 90% de opacidad. El foco visible es un anillo de 2px en Azul Berisso al 60%. Deshabilitado queda al 50% de opacidad y sin hover.
- **Secondary:** fondo blanco, borde `outline-variant` al 40% y texto `on-surface`. El hover lleva el fondo a `surface-container-low`.
- **Text:** solo texto en Azul Berisso, semibold, con un hover de fondo primario al 5%. Se usa para acciones dentro de paneles ("Ver todo", "Editar").

### Badges de estado
- **Style:** pastilla compacta (12px de radio, 2px × 6px de padding) con texto semibold de 12px, un punto de color de 6px y un ícono opcional.
- **Tonos:** `info` (bruma + azul), `ok` (verde suave), `alerta` (ámbar suave), `error` (contenedor de error) y `neutro` (celeste sello + tinta gris).

### Cards / Containers (Panel)
- **Corner Style:** suave (4px).
- **Background:** Blanco Planilla.
- **Shadow Strategy:** `shadow-sm` en reposo (ver Elevation).
- **Border:** 1px `outline-variant` al 30%.
- **Internal Padding:** 16px vertical y 16–20px horizontal. El encabezado del panel lleva un divisor inferior.

### Inputs / Fields
- **Búsqueda:** 40px de alto, fondo Celeste Lavado, borde `outline-variant` al 40%, radio de 2px y lupa a la izquierda.
- **Focus:** el borde pasa a Azul Berisso y el fondo a blanco. En los formularios de autenticación el foco es un anillo de 2px en Celeste Berisso.
- **Formularios:** los campos de Mantine 6 (TextInput, Select, DatePicker) conviven con inputs nativos estilizados con Tailwind.

### Navigation (Sidebar)
- **Style:** sobre Blanco Planilla, con ítems en 16px de `on-surface-variant` e íconos Material de 20px.
- **Hover:** fondo Celeste Lavado y texto `on-surface`.
- **Active:** fondo Celeste Ficha, texto e ícono en Azul Berisso, bold y barra izquierda de 2px. La sección que contiene la ruta activa se abre sola y se tiñe de azul.
- **Collapsed:** 72px, solo íconos.
- **Badges:** las secciones pueden mostrar contadores de alertas (por ejemplo, documentación por vencer) con `StatusBadge`.

### Tabs (subrayado)
Pestañas de texto en 16px separadas 24px, sobre un divisor inferior. La activa va en Azul Berisso semibold con un subrayado de 2px. Pueden mostrar un conteo entre paréntesis.

### KPI
Un rótulo en mayúsculas (Label) sobre una cifra grande (Figure) y un pie opcional en 14px. Las columnas se separan con divisores verticales, sin tarjetas por cifra.

### Registrar pago (signature)
El registro de pagos está montado a nivel de layout (`RegisterPaymentProvider`), así que se puede abrir desde cualquier pantalla. Es la ventanilla siempre a mano: cualquier pantalla nueva que muestre a un socio o una deuda tiene que poder disparar el registro sin navegar.

## Do's and Don'ts

### Do:
- **Do** usar Azul Berisso solo para acciones, estados activos y foco.
- **Do** separar superficies con tono (blanco sobre `background`) y bordes `outline-variant` al 30–40%.
- **Do** usar 16px como tamaño base del texto de trabajo y botones principales de 40px de alto.
- **Do** acompañar cada color de estado con texto o ícono (`StatusBadge`).
- **Do** mostrar montos y conteos con `tabular-nums`.
- **Do** reutilizar `PANEL_CLASS`, `TEXT_BUTTON_CLASS`, `PageHeader`, `KpiGrid`, `UnderlineTabs` y `StatusBadge` antes de crear variantes nuevas.
- **Do** verificar cada pantalla en modo claro y oscuro, usando los tokens `--color-*` y nunca hex sueltos.
- **Do** mantener visible el escudo del club en el encabezado, los comprobantes y las comunicaciones.

### Don't:
- **Don't** introducir un segundo color de acento ni gradientes decorativos.
- **Don't** usar sombras marcadas (`shadow-md` o más) en elementos que no flotan.
- **Don't** usar texto de 11–13px para información que el usuario necesita para decidir.
- **Don't** asumir que `rounded-full` da un círculo: vale 12px.
- **Don't** usar `bg-white` o colores Tailwind crudos sin chequear el modo oscuro. Hoy funcionan solo por los remapeos de `html.dark`.
- **Don't** obligar a navegar a otra página para registrar un pago.
