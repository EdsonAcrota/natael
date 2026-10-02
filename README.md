# NATAEL

Suite web de diseño de elementos de concreto armado según el Reglamento Nacional de
Edificaciones del Perú (E.020, E.030, E.050, E.060), con referencia al ACI 318-25.
Cada módulo es un programa independiente que calcula, verifica y genera una memoria de
cálculo paso a paso, con las fórmulas, los valores y el artículo de la norma de cada
verificación.

**Autor:** Edson Ever Quispe Acrota
**Versión:** 1.0.0 (octubre de 2026)

## Cómo usarlo

**En línea:** https://edsonacrota.github.io/natael/

También puede descargarse y usarse sin conexión: no requiere instalación ni servidor. Abra `index.html` (portada) o directamente
`modulos/m02-vigas/index.html` en un navegador moderno (Chrome, Edge, Firefox).
Todo el cálculo se hace en el navegador, en el sistema de unidades que elija el usuario
(MKS por defecto: cm, kgf/cm², tf·m; o SI: mm, MPa, kN·m). La memoria de cálculo se escribe en
ese mismo sistema. Para guardarla en PDF use **Imprimir memoria** y elija "Guardar como PDF";
para obtener un PDF nativo de LaTeX use **Descargar LaTeX (.tex)** y compílelo con pdfLaTeX
(o en Overleaf). **Descargar plano (DXF)** entrega la sección armada a escala 1:10, con capas,
para abrirla en AutoCAD u otro programa CAD y guardarla como DWG.

Las fórmulas se muestran con MathJax, incluido en `nucleo/vendor/mathjax` (funciona sin
conexión). Las fuentes tipográficas se cargan de Google Fonts cuando hay conexión; sin
conexión se usan las del sistema.

## Estructura

```
natael/
├── index.html                  Portada de la suite
├── nucleo/                     Núcleo común de todos los módulos
│   ├── natael-nucleo.js        Materiales (E.060), catálogo de barras, unidades, formato
│   ├── natael.css              Estilos de pantalla y de impresión de la memoria
│   └── vendor/mathjax/         MathJax 3.2.2 (Apache 2.0)
├── modulos/
│   └── m02-vigas/              NATAEL Vigas (M02)
│       ├── index.html          Interfaz
│       ├── m02-calculo.js      Motor de cálculo (diseño, análisis, verificaciones)
│       ├── m02-plano.js        Plano de la sección: SVG, DXF (AutoCAD R12) y TikZ
│       ├── m02-memoria.js      Memoria de cálculo (HTML y LaTeX)
│       └── m02-interfaz.js     Lectura del formulario y presentación de resultados
└── pruebas/
    └── m02-validacion.js       Casos de validación contra libros (node pruebas/m02-validacion.js)
```

## Módulos

| Código | Programa | Estado |
|---|---|---|
| M02 | NATAEL Vigas: flexión en vigas rectangulares simple y doblemente reforzadas | v1.0 |
| M01, M03 a M10 | Predimensionamiento, corte, columnas, zapatas, losas, placas, muros | En desarrollo |

## Validación de NATAEL Vigas

`node pruebas/m02-validacion.js` compara el programa con 42 resultados de ejemplos
resueltos de Blanco (1994), Ottazzi (2015) y McCormac y Brown (2011), además de los
ejemplos de la memoria descriptiva. Las diferencias son menores que 4 % y se explican por
redondeos de los autores y por el módulo de elasticidad del acero usado en cada texto.

## Derechos

© 2026 Edson Ever Quispe Acrota. Todos los derechos reservados, salvo las bibliotecas de
terceros incluidas en `nucleo/vendor`, que conservan sus propias licencias.
