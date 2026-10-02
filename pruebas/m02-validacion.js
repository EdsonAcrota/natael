/*
 * NATAEL Vigas (M02) — Casos de validación contra ejemplos resueltos
 * Ejecutar con:  node pruebas/m02-validacion.js
 *
 * Los libros usan kgf/cm² y, en algunos casos, Es = 2,0 o 2,1 × 10^6 kgf/cm²;
 * el programa usa la E.060 vigente (SI, Es = 200 000 MPa). Por eso se admite
 * una tolerancia de hasta 3 % en el acero en compresión, cuyo valor depende de
 * redondeos intermedios de cada autor.
 */
'use strict';
var N = require('../nucleo/natael-nucleo.js');
var M = require('../modulos/m02-vigas/m02-calculo.js');
var U = N.unidades;

var kg = U.kgfcm2_a_MPa;          // kgf/cm² → MPa
var tfm = function (x) { return U.tfm_a_kNm(x) * 1e6; };   // tf·m → N·mm
var kgm = function (x) { return x * U.G * 1000; };          // kgf·m → N·mm

var total = 0, fallas = 0;
function comparar(caso, magnitud, calculado, esperado, tolPct) {
  total++;
  var dif = (calculado - esperado) / esperado * 100;
  var ok = Math.abs(dif) <= tolPct;
  if (!ok) fallas++;
  console.log((ok ? '  OK   ' : '  FALLA') + '  ' + caso.padEnd(44) + magnitud.padEnd(12) +
    'libro ' + esperado.toFixed(2).padStart(9) + '   M02 ' + calculado.toFixed(2).padStart(9) +
    '   dif ' + (dif >= 0 ? '+' : '') + dif.toFixed(2) + ' %  (tol ' + tolPct + ' %)');
}

console.log('\nNATAEL Vigas (M02) — validación\n');

/* ---------- Diseño, sección simplemente reforzada ---------- */
console.log('Diseño, sección simplemente reforzada');
var r;
r = M.aceroRequerido(tfm(30), 300, 600, 540, 60, kg(210), kg(4200));
comparar('Blanco (1994), pp. 144-145', 'As (cm²)', r.As_calc / 100, 16.68, 1.5);

r = M.aceroRequerido(tfm(20), 300, 600, 550, 60, kg(210), kg(4200));
comparar('Ottazzi (2015), ej. 10-3, pp. 177-178', 'As (cm²)', r.As_calc / 100, 10.4, 1.5);
comparar('Ottazzi (2015), ej. 10-3, pp. 177-178', 'a (cm)', r.a / 10, 8.15, 1.5);

r = M.aceroRequerido(250e6, 300, 600, 540, 60, 21, 420);
comparar('Marco teórico M02, ejemplo 1', 'As (mm²)', r.As_calc, 1358.9, 0.1);

/* ---------- Análisis de secciones dadas ---------- */
console.log('\nAnálisis de una sección armada');
[[175, 169.4, 27645], [210, 141.2, 28340], [280, 105.9, 29205], [350, 90.0, 29725]].forEach(function (f) {
  var a = M.analizar(300, 600, kg(f[0]), kg(4200), [{ y: 550, A: 1530, rol: 'T' }]);
  comparar("Ottazzi (2015), ej. 10-5, p. 181, f'c=" + f[0], 'c (mm)', a.c, f[1], 1.0);
  comparar("Ottazzi (2015), ej. 10-5, p. 181, f'c=" + f[0], 'φMn (kN·m)', 0.9 * a.Mn / 1e6, kgm(f[2]) / 1e6, 1.0);
});
var mc = M.analizar(500, 800, 28, 420, [{ y: 680, A: 4914, rol: 'T' }]);
comparar('McCormac y Brown (2011), ej. 4.7, p. 101', 'a (mm)', mc.a, 173, 1.0);
comparar('McCormac y Brown (2011), ej. 4.7, p. 101', 'c (mm)', mc.c, 204, 1.0);
comparar('McCormac y Brown (2011), ej. 4.7, p. 101', 'εt (x1000)', mc.eps_t * 1000, 7.0, 2.0);

/* ---------- Diseño, sección doblemente reforzada ---------- */
console.log('\nDiseño, sección doblemente reforzada');
r = M.aceroRequerido(tfm(50), 300, 600, 510, 60, kg(210), kg(4200));
comparar('Blanco (1994), pp. 157-159', 'As (cm²)', r.As_calc / 100, 31.48, 1.0);
comparar('Blanco (1994), pp. 157-159', "A's (cm²)", r.Asp_calc / 100, 6.70, 3.0);

r = M.aceroRequerido(tfm(80), 350, 700, 610, 60, kg(210), kg(4200));
comparar('Ottazzi (2015), ej. 12-1, pp. 268-269', 'As (cm²)', r.As_calc / 100, 41.84, 1.0);
comparar('Ottazzi (2015), ej. 12-1, pp. 268-269', "A's (cm²)", r.Asp_calc / 100, 7.84, 3.0);

r = M.aceroRequerido(500e6, 300, 600, 520, 60, 21, 420);
comparar('Marco teórico M02, ejemplo 2', 'As (mm²)', r.As_calc, 3078.2, 0.1);
comparar('Marco teórico M02, ejemplo 2', "A's (mm²)", r.Asp_calc, 592.0, 0.1);

/* ---------- Cálculo nativo en MKS (kgf/cm², cm; Es = 2×10⁶ kgf/cm²) ---------- */
console.log('\nCálculo nativo en MKS (como en los libros)');
var MKS = N.sistemas.MKS;
r = M.aceroRequerido(30e5, 30, 60, 54, 6, 210, 4200, MKS);
comparar('Blanco (1994), pp. 144-145 [MKS]', 'As (cm²)', r.As_calc, 16.68, 1.0);
r = M.aceroRequerido(20e5, 30, 60, 55, 6, 210, 4200, MKS);
comparar('Ottazzi (2015), ej. 10-3 [MKS]', 'As (cm²)', r.As_calc, 10.4, 1.0);
[[175, 16.94, 27645], [210, 14.12, 28340], [280, 10.59, 29205], [350, 9.00, 29725]].forEach(function (f) {
  var a = M.analizar(30, 60, f[0], 4200, [{ y: 55, A: 15.3, rol: 'T' }], MKS);
  comparar("Ottazzi (2015), ej. 10-5, f'c=" + f[0] + ' [MKS]', 'c (cm)', a.c, f[1], 0.5);
  comparar("Ottazzi (2015), ej. 10-5, f'c=" + f[0] + ' [MKS]', 'φMn (kgf·m)', 0.9 * a.Mn / 100, f[2], 0.5);
});
r = M.aceroRequerido(50e5, 30, 60, 51, 6, 210, 4200, MKS);
comparar('Blanco (1994), pp. 157-159 [MKS]', 'As (cm²)', r.As_calc, 31.48, 1.0);
// Blanco usa Es = 2,1×10⁶ kgf/cm² (ρmáx = 0,0162); con Es = 2,0×10⁶ el acero máximo es algo menor
// y el momento remanente mayor, por eso A's resulta ~3,6 % mayor.
comparar('Blanco (1994), pp. 157-159 [MKS]', "A's (cm²)", r.Asp_calc, 6.70, 4.0);
r = M.aceroRequerido(80e5, 35, 70, 61, 6, 210, 4200, MKS);
comparar('Ottazzi (2015), ej. 12-1 [MKS]', 'As (cm²)', r.As_calc, 41.84, 1.0);
comparar('Ottazzi (2015), ej. 12-1 [MKS]', "A's (cm²)", r.Asp_calc, 7.84, 3.0);

/* ---------- Programa completo ---------- */
console.log('\nPrograma completo (diseño con selección de barras)');
var R = M.calcular({ modo: 'diseno', b: 300, h: 600, rec: 40, estribo: '3/8', fc: 21, fy: 420, Mu: 250, barraT: '3/4', barraC: '5/8', sismo: 'ninguno' });
total++; var okA = R.ok && R.armado.capas.length === 1 && R.armado.capas[0].n === 5;
if (!okA) fallas++;
console.log((okA ? '  OK   ' : '  FALLA') + '  Ejemplo 1: 5 barras de 3/4" en una capa, cumple todo   φMn = ' + (R.analisis.phiMn / 1e6).toFixed(1) + ' kN·m');

R = M.calcular({ modo: 'diseno', b: 300, h: 600, rec: 40, estribo: '3/8', fc: 21, fy: 420, Mu: 500, barraT: '1', barraC: '3/4', sismo: 'ninguno' });
total++; var okB = R.ok && R.diseno.tipo === 'doble' && R.analisis.phiMn >= 500e6;
if (!okB) fallas++;
console.log((okB ? '  OK   ' : '  FALLA') + '  Ejemplo 2: doble refuerzo, ' + R.armado.capas.map(function (c) { return c.n + ' de ' + c.barra.nombre; }).join(' + ') +
  ', A\'s = ' + R.armado.comp.n + ' de ' + R.armado.comp.barra.nombre + ', φMn = ' + (R.analisis.phiMn / 1e6).toFixed(1) + ' kN·m');

R = M.calcular({ modo: 'diseno', b: 300, h: 600, rec: 40, estribo: '3/8', fc: 21, fy: 420, Mu: 20, barraT: '5/8', barraC: '5/8', sismo: 'ninguno' });
total++; var okC = R.ok;
if (!okC) fallas++;
console.log((okC ? '  OK   ' : '  FALLA') + '  Momento pequeño: rige el acero mínimo o la excepción de 4/3   As = ' + R.armado.As + ' mm²');

R = M.calcular({ modo: 'diseno', b: 150, h: 600, rec: 40, estribo: '3/8', fc: 21, fy: 420, Mu: 250, barraT: '1', barraC: '5/8', sismo: 'ninguno' });
total++; var okD = R.errores.length > 0;
if (!okD) fallas++;
console.log((okD ? '  OK   ' : '  FALLA') + '  Ancho insuficiente: el programa rechaza el caso   "' + (R.errores[0] || '') + '"');

R = M.calcular({ unidades: 'MKS', modo: 'diseno', b: 30, h: 60, rec: 4, estribo: '3/8', fc: 210, fy: 4200, Mu: 25, barraT: '3/4', barraC: '5/8', sismo: 'ninguno' });
total++; var okE = R.ok && R.S.id === 'MKS';
if (!okE) fallas++;
console.log((okE ? '  OK   ' : '  FALLA') + '  MKS: b=30, h=60, Mu=25 tf·m → ' + R.armado.capas.map(function (c) { return c.n + ' Ø ' + c.barra.nombre; }).join(' + ') + ' (' + R.armado.As.toFixed(2) + ' cm²), φMn = ' + (R.analisis.phiMn / 1e5).toFixed(2) + ' tf·m');

R = M.calcular({ unidades: 'MKS', modo: 'diseno', b: 30, h: 60, rec: 4, estribo: '3/8', fc: 210, fy: 4200, Mu: 25, barraT: '3/4', barraC: '5/8', nT: 4, nC: 3, sismo: 'ninguno' });
total++; var okF = R.armado.capas[0].n === 4 && R.armado.comp.n === 3 && !R.ok;
if (!okF) fallas++;
console.log((okF ? '  OK   ' : '  FALLA') + '  Cantidad fijada por el usuario (4 Ø 3/4" + 3 Ø 5/8"): se respeta y se reporta que no cumple   φMn = ' + (R.analisis.phiMn / 1e5).toFixed(2) + ' tf·m');

/* ---------- Plano de la sección en DXF ---------- */
require('../modulos/m02-vigas/m02-plano.js');
R = N.m02.calcular({ unidades: 'MKS', modo: 'diseno', b: 30, h: 60, rec: 4, estribo: '3/8', fc: 210, fy: 4200, Mu: 50, barraT: '1', barraC: '3/4', sismo: 'ninguno' });
var dxf = N.m02.planoDXF(R, { elemento: 'V-102' });
var nBarras = R.armado.capas.reduce(function (s, c) { return s + c.n; }, 0) + R.armado.comp.n;
total++; var okG = /^0\r\nSECTION/.test(dxf) && /EOF\r\n$/.test(dxf) && (dxf.match(/\r\nPOLYLINE\r\n/g) || []).length === nBarras &&
  N.m02.CAPAS.every(function (c) { return dxf.indexOf('\r\n' + c.id + '\r\n') > 0; }) && dxf.indexOf('E.N.') < 0 && !/[^\x00-\x7F]/.test(dxf);
if (!okG) fallas++;
console.log((okG ? '  OK   ' : '  FALLA') + '  Plano DXF: ' + nBarras + ' barras, ' + N.m02.CAPAS.length + ' capas, solo ASCII, sin eje neutro (' + dxf.length + ' bytes)');

console.log('\n' + (total - fallas) + ' de ' + total + ' comprobaciones dentro de tolerancia.\n');
process.exit(fallas ? 1 : 0);
