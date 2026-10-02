/*
 * NATAEL — Núcleo común de la suite
 * Materiales, catálogo de barras, unidades y formato numérico.
 * Autor: Edson Ever Quispe Acrota
 *
 * Sistemas de unidades: cada cálculo se hace en el sistema que elige el usuario,
 *   SI  (N, mm, MPa, N·mm), o
 *   MKS (kgf, cm, kgf/cm², kgf·cm),
 * con las expresiones de la E.060 escritas en su forma equivalente para cada
 * sistema (ver NATAEL.sistemas).
 * Norma base: E.060 Concreto Armado (D.S. N.° 010-2009-VIVIENDA).
 *
 * Este archivo funciona en el navegador (define window.NATAEL) y en Node
 * (module.exports), sin dependencias.
 */
(function (raiz) {
  'use strict';

  var NATAEL = raiz.NATAEL || {};
  NATAEL.version = '1.0.0';

  /* ------------------------------------------------------------------
   * Constantes de materiales (E.060)
   * ------------------------------------------------------------------ */
  var materiales = {
    ECU: 0.003,          // deformación última del concreto, E.060 10.2.3
    ES: 200000,          // módulo de elasticidad del acero (MPa), E.060 8.5.5
    FC_MIN: 17,          // f'c mínimo estructural (MPa), E.060 9.4.1

    /** Factor β1 del bloque equivalente, E.060 10.2.7.3 */
    beta1: function (fc) {
      if (fc <= 28) return 0.85;
      if (fc >= 56) return 0.65;
      return 0.85 - 0.20 * (fc - 28) / 28;
    },
    /** Módulo de elasticidad del concreto de peso normal (MPa), E.060 8.5.2 */
    Ec: function (fc) { return 4700 * Math.sqrt(fc); },
    /** Módulo de rotura (MPa), E.060 9.6.2.3 / 10.5.1 */
    fr: function (fc) { return 0.62 * Math.sqrt(fc); }
  };

  /* ------------------------------------------------------------------
   * Catálogo de barras de refuerzo corrugado usadas en el Perú
   * db: diámetro nominal (mm); A: área nominal (mm²)
   * ------------------------------------------------------------------ */
  var barras = [
    { id: '6mm',   nombre: '6 mm',     db: 6.0,  A: 28 },
    { id: '8mm',   nombre: '8 mm',     db: 8.0,  A: 50 },
    { id: '3/8',   nombre: '3/8"',     db: 9.5,  A: 71 },
    { id: '12mm',  nombre: '12 mm',    db: 12.0, A: 113 },
    { id: '1/2',   nombre: '1/2"',     db: 12.7, A: 129 },
    { id: '5/8',   nombre: '5/8"',     db: 15.9, A: 199 },
    { id: '3/4',   nombre: '3/4"',     db: 19.1, A: 284 },
    { id: '1',     nombre: '1"',       db: 25.4, A: 510 },
    { id: '1 3/8', nombre: '1 3/8"',   db: 35.8, A: 1006 }
  ];
  function barra(id) {
    for (var i = 0; i < barras.length; i++) if (barras[i].id === id) return barras[i];
    throw new Error('Barra no reconocida: ' + id);
  }


  /* ------------------------------------------------------------------
   * Sistemas de unidades y coeficientes equivalentes de la E.060
   * La E.060 (D.S. N.° 010-2009-VIVIENDA) está redactada en SI. En el sistema
   * MKS se usan las expresiones equivalentes de uso corriente en el Perú
   * (Ottazzi, 2015; Blanco, 1994; Harmsen, 2002):
   *   Ec = 4700√f'c (MPa)       ≈ 15 000√f'c (kgf/cm²)
   *   fr = 0,62√f'c (MPa)       ≈ 2,0√f'c   (kgf/cm²)
   *   As,mín = 0,22√f'c/fy·bd   ≈ 0,7√f'c/fy·bd
   *   Es = 200 000 MPa          ≈ 2 000 000 kgf/cm²  → Es·εcu = 600 | 6000
   * ------------------------------------------------------------------ */
  var sistemas = {
    SI: {
      id: 'SI', nombre: 'SI',
      L: 'mm', A: 'mm²', esf: 'MPa', F: 'kN', M: 'kN·m', Z: 'kN/mm',
      texL: '\\text{mm}', texA: '\\text{mm}^2', texEsf: '\\text{MPa}', texF: '\\text{kN}', texM: '\\text{kN·m}',
      desdeMm: 1, desdeMm2: 1,           // catálogo de barras (mm, mm²) → unidades del sistema
      momInt: 1e6, momExp: 6,            // kN·m → N·mm
      fuerzaDiv: 1000,                   // N → kN
      dL: 1, dA: 0, dEsf: 1,             // decimales para mostrar
      Es: 200000, EsEcu: 600, cEc: 4700, cfr: 0.62, cAsmin: 0.22,
      fcLim: 28, fcMin: 17, fcMax: 80, fyMin: 280, fyMax: 550, recMin: 20, sMin: 25, bSis: 250,
      Zlim: 26, Zdiv: 1000,              // E.060 9.9.3: Z ≤ 26 kN/mm (N/mm → kN/mm)
      aci1: 0.25, aci2: 1.4,
      beta1: function (fc) { if (fc <= 28) return 0.85; if (fc >= 56) return 0.65; return 0.85 - 0.20 * (fc - 28) / 28; },
      beta1Tex: function (fc, b1, T) {
        if (fc <= 28) return "0{,}85 \\quad (17 \\le f'_c \\le 28\\ \\text{MPa})";
        return "0{,}85 - 0{,}20\\,\\frac{f'_c - 28}{28} = " + T(b1, 3) + (fc >= 56 ? " \;\\to\; 0{,}65" : '');
      }
    },
    MKS: {
      id: 'MKS', nombre: 'MKS',
      L: 'cm', A: 'cm²', esf: 'kgf/cm²', F: 'tf', M: 'tf·m', Z: 'kgf/cm',
      texL: '\\text{cm}', texA: '\\text{cm}^2', texEsf: '\\text{kgf/cm}^2', texF: '\\text{tf}', texM: '\\text{tf·m}',
      desdeMm: 0.1, desdeMm2: 0.01,
      momInt: 1e5, momExp: 5,            // tf·m → kgf·cm
      fuerzaDiv: 1000,                   // kgf → tf
      dL: 2, dA: 2, dEsf: 0,
      Es: 2000000, EsEcu: 6000, cEc: 15000, cfr: 2.0, cAsmin: 0.7,
      fcLim: 280, fcMin: 175, fcMax: 800, fyMin: 2800, fyMax: 5600, recMin: 2, sMin: 2.5, bSis: 25,
      Zlim: 26500, Zdiv: 1,              // 26 kN/mm ≈ 26 500 kgf/cm
      aci1: 0.8, aci2: 14,
      beta1: function (fc) { if (fc <= 280) return 0.85; return Math.max(0.65, 0.85 - 0.05 * (fc - 280) / 70); },
      beta1Tex: function (fc, b1, T) {
        if (fc <= 280) return "0{,}85 \\quad (f'_c \\le 280\\ \\text{kgf/cm}^2)";
        return "0{,}85 - 0{,}05\\,\\frac{f'_c - 280}{70} = " + T(b1, 3) + (b1 <= 0.65 ? " \;\\to\; 0{,}65" : '');
      }
    }
  };
  /** Barra del catálogo expresada en las unidades del sistema. */
  function barraEn(id, S) {
    var b = barra(id);
    return { id: b.id, nombre: b.nombre, db: b.db * S.desdeMm, A: b.A * S.desdeMm2 };
  }

  /* ------------------------------------------------------------------
   * Conversión de unidades
   * ------------------------------------------------------------------ */
  var G = 9.80665;
  var unidades = {
    G: G,
    kgfcm2_a_MPa: function (x) { return x * G / 100; },     // 1 kgf/cm² = 0.0980665 MPa
    MPa_a_kgfcm2: function (x) { return x * 100 / G; },
    tfm_a_kNm: function (x) { return x * G; },              // 1 tf·m = 9.80665 kN·m
    kNm_a_tfm: function (x) { return x / G; },
    kNm_a_Nmm: function (x) { return x * 1e6; },
    Nmm_a_kNm: function (x) { return x / 1e6; },
    cm_a_mm: function (x) { return x * 10; },
    mm2_a_cm2: function (x) { return x / 100; }
  };

  /* ------------------------------------------------------------------
   * Formato numérico en español (coma decimal)
   * ------------------------------------------------------------------ */
  function num(x, dec) {
    if (x === null || x === undefined || !isFinite(x)) return '—';
    if (dec === undefined) dec = 2;
    var s = Number(x).toFixed(dec);
    var partes = s.split('.');
    var ent = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009'); // espacio fino de miles
    return partes.length > 1 ? ent + ',' + partes[1] : ent;
  }
  /** Igual que num() pero para LaTeX: coma sin espacio y miles con \, */
  function tex(x, dec) {
    return num(x, dec).replace(',', '{,}').replace(/\u2009/g, '\\,');
  }

  NATAEL.materiales = materiales;
  NATAEL.barras = barras;
  NATAEL.barra = barra;
  NATAEL.unidades = unidades;
  NATAEL.sistemas = sistemas;
  NATAEL.barraEn = barraEn;
  NATAEL.fmt = { num: num, tex: tex };

  raiz.NATAEL = NATAEL;
  if (typeof module !== 'undefined' && module.exports) module.exports = NATAEL;
})(typeof window !== 'undefined' ? window : globalThis);
