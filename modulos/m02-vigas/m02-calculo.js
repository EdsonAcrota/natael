/*
 * NATAEL Vigas (M02) — Motor de cálculo
 * Diseño y verificación por flexión de vigas rectangulares de concreto armado,
 * simple y doblemente reforzadas, según la Norma Técnica E.060 Concreto Armado
 * (D.S. N.° 010-2009-VIVIENDA).
 * Autor: Edson Ever Quispe Acrota
 *
 * El cálculo se realiza en el sistema de unidades que elige el usuario:
 *   SI  → longitudes en mm, esfuerzos en MPa, fuerzas en N, momentos en N·mm
 *   MKS → longitudes en cm, esfuerzos en kgf/cm², fuerzas en kgf, momentos en kgf·cm
 * Los momentos de entrada y salida para el usuario están en kN·m o tf·m.
 * Los coeficientes que dependen del sistema están en NATAEL.sistemas (núcleo).
 *
 * Referencias de cada ecuación: documento "NATAEL Vigas (M02) — Marco teórico y
 * modo de cálculo" y los comentarios de cada función.
 */
(function (raiz) {
  'use strict';

  var N = raiz.NATAEL || (typeof require !== 'undefined' ? require('../../nucleo/natael-nucleo.js') : null);
  if (!N) throw new Error('NATAEL: falta cargar nucleo/natael-nucleo.js');

  var ECU = 0.003;                  // E.060 10.2.3
  var PHI_FLEXION = 0.90;           // E.060 9.3.2.1

  function sistema(E) { return N.sistemas[(E && E.unidades) || 'SI']; }

  /* ==================================================================
   * 1. Límites de cuantía de la sección
   * ================================================================== */

  /** E.060 10.3.2 (falla balanceada), 10.3.4 (acero máximo), 10.5 (acero mínimo). */
  function limites(b, h, d, fc, fy, S) {
    S = S || N.sistemas.SI;
    var b1 = S.beta1(fc);
    var k = S.EsEcu;                                // Es·εcu = 600 MPa | 6000 kgf/cm²
    var cb = k / (k + fy) * d;
    var ab = b1 * cb;
    var Asb = 0.85 * fc * b * ab / fy;
    var Asmax = 0.75 * Asb;
    var amax = Asmax * fy / (0.85 * fc * b);
    var Mnmax = Asmax * fy * (d - amax / 2);
    var fr = S.cfr * Math.sqrt(fc);
    var Ig = b * Math.pow(h, 3) / 12;
    var yt = h / 2;
    var Mcr = fr * Ig / yt;
    var Asmin_eq = S.cAsmin * Math.sqrt(fc) / fy * b * d;
    var s12 = aceroSimple(1.2 * Mcr, b, d, fc, fy);
    var Asmin = Math.max(Asmin_eq, s12 ? s12.As : Infinity);
    return {
      beta1: b1, cb: cb, ab: ab, Asb: Asb, rhob: Asb / (b * d),
      Asmax: Asmax, amax: amax, cmax: amax / b1,
      Mnmax: Mnmax, phiMnmax: PHI_FLEXION * Mnmax,
      fr: fr, Ig: Ig, yt: yt, Mcr: Mcr,
      Asmin_eq: Asmin_eq, As_12Mcr: s12 ? s12.As : null, Asmin: Asmin
    };
  }

  /** Acero de una sección simplemente reforzada para Mu: φ As fy (d − a/2) = Mu. */
  function aceroSimple(Mu, b, d, fc, fy) {
    var rad = d * d - 2 * Mu / (PHI_FLEXION * 0.85 * fc * b);
    if (rad < 0) return null;
    var a = d - Math.sqrt(rad);
    return { a: a, As: 0.85 * fc * b * a / fy };
  }

  /* ==================================================================
   * 2. Acero requerido (sin redondear a barras)
   * ================================================================== */
  function aceroRequerido(Mu, b, h, d, dp, fc, fy, S) {
    S = S || N.sistemas.SI;
    var L = limites(b, h, d, fc, fy, S);
    var r = { limites: L, d: d, dp: dp, Mu: Mu };
    if (Mu <= L.phiMnmax) {
      var s = aceroSimple(Mu, b, d, fc, fy);
      r.tipo = 'simple';
      r.a = s.a; r.c = s.a / L.beta1;
      r.As_calc = s.As; r.Asp_calc = 0;
      r.eps_t = ECU * (d - r.c) / r.c;
      r.Ku = Mu / (b * d * d);
      return r;
    }
    var As1 = L.Asmax, a1 = L.amax, c1 = a1 / L.beta1;
    var Mn1 = L.Mnmax;
    var Mn2 = Mu / PHI_FLEXION - Mn1;
    var eps_p = ECU * (c1 - dp) / c1;
    r.tipo = 'doble';
    r.As1 = As1; r.a = a1; r.c = c1; r.Mn1 = Mn1; r.Mn2 = Mn2; r.eps_p = eps_p;
    if (eps_p <= 0) {
      r.error = 'Con el eje neutro de la sección 1 (c = ' + N.fmt.num(c1, S.dL) + ' ' + S.L +
        '), el acero superior quedaría en tracción. Aumente el peralte de la viga.';
      return r;
    }
    var fsp = Math.min(fy, S.Es * eps_p);
    var Asp = Mn2 / (fsp * (d - dp));
    var As2 = Asp * fsp / fy;
    r.fsp = fsp; r.Asp_calc = Asp; r.As2 = As2; r.As_calc = As1 + As2;
    r.eps_t = ECU * (d - c1) / c1;
    r.fluye_p = eps_p >= fy / S.Es;
    return r;
  }

  /* ==================================================================
   * 3. Geometría del armado
   * ================================================================== */
  function maxPorCapa(b, rec, de, db, S) {
    var s = Math.max(db, S.sMin);
    var libre = b - 2 * rec - 2 * de;
    return Math.max(0, Math.floor((libre + s) / (db + s) + 1e-9));
  }
  function espaciamientoLibre(b, rec, de, n, db) {
    if (n < 2) return Infinity;
    return (b - 2 * rec - 2 * de - n * db) / (n - 1);
  }
  /** n barras de un diámetro en una o dos capas (E.060 7.6.1 y 7.6.2). */
  function armarTraccion(n, bar, b, h, rec, de, S) {
    var nmax = maxPorCapa(b, rec, de, bar.db, S);
    var y1 = h - rec - de - bar.db / 2;
    if (nmax < 2) return { error: 'No caben dos barras de ' + bar.nombre + ' en el ancho b = ' + N.fmt.num(b, S.id === 'SI' ? 0 : 1) + ' ' + S.L + '.' };
    var capas;
    if (n <= nmax) capas = [{ n: n, barra: bar, y: y1 }];
    else {
      var n2 = n - nmax;
      if (n2 > nmax) return { error: n + ' barras de ' + bar.nombre + ' no caben en dos capas (máximo ' + nmax + ' por capa). Aumente el ancho o use un diámetro mayor.' };
      var y2 = y1 - bar.db - Math.max(S.sMin, bar.db);
      capas = [{ n: nmax, barra: bar, y: y1 }, { n: n2, barra: bar, y: y2 }];
    }
    return completarCapas(capas, nmax);
  }
  function completarCapas(capas, nmax) {
    var As = 0, mom = 0;
    capas.forEach(function (c) { c.A = c.n * c.barra.A; As += c.A; mom += c.A * c.y; });
    return { capas: capas, As: As, d: mom / As, dt: Math.max.apply(null, capas.map(function (c) { return c.y; })), nmax: nmax };
  }

  /* ==================================================================
   * 4. Análisis por compatibilidad de deformaciones
   * ================================================================== */
  /**
   * Resistencia nominal de una sección rectangular con varias capas de acero
   * (E.060 10.2). aceros: [{y, A, rol}] con y medido desde la fibra comprimida.
   * Se descuenta el concreto desplazado por las barras comprimidas.
   */
  function analizar(b, h, fc, fy, aceros, S) {
    S = S || N.sistemas.SI;
    var b1 = S.beta1(fc), Es = S.Es;
    function estado(c) {
      var a = Math.min(b1 * c, h);
      var Cc = 0.85 * fc * b * a;
      var suma = Cc, filas = [];
      aceros.forEach(function (s) {
        var eps = ECU * (c - s.y) / c;
        var f = Math.max(-fy, Math.min(fy, Es * eps));
        var F = s.A * f;
        if (eps > 0 && s.y < a) F -= s.A * 0.85 * fc;
        suma += F;
        filas.push({ y: s.y, A: s.A, rol: s.rol, eps: eps, f: f, F: F });
      });
      return { c: c, a: a, Cc: Cc, suma: suma, aceros: filas };
    }
    var lo = 1e-9 * h, hi = 5 * h;
    for (var i = 0; i < 200; i++) {
      var m = (lo + hi) / 2;
      if (estado(m).suma > 0) hi = m; else lo = m;
    }
    var e = estado((lo + hi) / 2);
    var M = e.Cc * e.a / 2;
    e.aceros.forEach(function (s) { M += s.F * s.y; });
    e.Mn = -M;
    var trac = e.aceros.filter(function (s) { return s.rol === 'T'; });
    e.dt = Math.max.apply(null, trac.map(function (s) { return s.y; }));
    e.eps_t = ECU * (e.dt - e.c) / e.c;
    return e;
  }

  /* ==================================================================
   * 5. Cálculo completo del módulo
   * ================================================================== */
  function validar(E, S) {
    var err = [];
    function pos(v, nombre) { if (!(isFinite(v) && v > 0)) err.push('Ingrese un valor positivo para ' + nombre + '.'); }
    pos(E.b, 'el ancho b'); pos(E.h, 'el peralte h'); pos(E.fc, "f'c"); pos(E.fy, 'fy');
    if (E.modo !== 'verificacion') pos(E.Mu, 'el momento Mu');
    if (isFinite(E.fc) && E.fc < S.fcMin) err.push("f'c debe ser al menos " + S.fcMin + ' ' + S.esf + ' (E.060, 9.4.1).');
    if (isFinite(E.fc) && E.fc > S.fcMax) err.push("f'c mayor que " + S.fcMax + ' ' + S.esf + ' está fuera del alcance del programa.');
    if (isFinite(E.fy) && (E.fy < S.fyMin || E.fy > S.fyMax)) err.push('fy debe estar entre ' + S.fyMin + ' y ' + S.fyMax + ' ' + S.esf + '.');
    if (!(E.rec >= S.recMin)) err.push('El recubrimiento libre debe ser al menos ' + S.recMin + ' ' + S.L + ' (E.060, 7.7).');
    if (isFinite(E.b) && isFinite(E.h) && E.h < E.b / 4) err.push('El peralte es muy pequeño respecto del ancho: el elemento parece una losa, no una viga.');
    if (E.ln && isFinite(E.ln) && E.ln <= 4 * E.h) err.push('La luz libre es menor o igual que 4h: es una viga de gran peralte (E.060, 10.7), fuera del alcance de este programa.');
    if (E.nT != null && !(E.nT >= 2)) err.push('Coloque al menos 2 barras inferiores.');
    if (E.nC != null && !(E.nC >= 0)) err.push('El número de barras superiores no puede ser negativo.');
    return err;
  }

  /**
   * Punto de entrada.
   * E = { unidades:'SI'|'MKS', modo:'diseno'|'verificacion', b, h, rec, estribo, fc, fy,
   *       Mu, Ms (opcional), ln (opcional)   [longitudes en mm|cm; esfuerzos en MPa|kgf/cm²; momentos en kN·m|tf·m]
   *       barraT, barraC, nT (opcional: n.º de barras inferiores elegido por el usuario),
   *       nC (opcional: n.º de barras superiores), sismo:'ninguno'|'21.4'|'21.5',
   *       // solo verificación:
   *       capa1:{n,id}, capa2:{n,id}|null, comp:{n,id}|null }
   */
  function calcular(E) {
    var S = sistema(E);
    var R = { entrada: E, S: S, errores: [], avisos: [], verificaciones: [] };
    R.errores = validar(E, S);
    if (R.errores.length) return R;

    var b = E.b, h = E.h, rec = E.rec, fc = E.fc, fy = E.fy;
    var est = N.barraEn(E.estribo, S), de = est.db;
    var Mu = (E.Mu || 0) * S.momInt;
    var sismo = E.sismo || 'ninguno';
    R.material = { beta1: S.beta1(fc), Ec: S.cEc * Math.sqrt(fc), fr: S.cfr * Math.sqrt(fc), ey: fy / S.Es, Es: S.Es };
    R.estribo = est;

    var armT, comp = null, dis = null;
    var usuarioT = E.modo !== 'verificacion' && E.nT != null;
    var usuarioC = E.modo !== 'verificacion' && E.nC != null;

    if (E.modo === 'verificacion') {
      var c1 = E.capa1, c2 = E.capa2;
      if (!c1 || !(c1.n >= 1)) { R.errores.push('Indique las barras de la capa inferior.'); return R; }
      var bar1 = N.barraEn(c1.id, S);
      var y1 = h - rec - de - bar1.db / 2;
      var capas = [{ n: c1.n, barra: bar1, y: y1 }];
      if (c2 && c2.n >= 1) {
        var bar2 = N.barraEn(c2.id, S);
        capas.push({ n: c2.n, barra: bar2, y: y1 - bar1.db / 2 - Math.max(S.sMin, bar1.db) - bar2.db / 2 });
      }
      armT = completarCapas(capas, maxPorCapa(b, rec, de, bar1.db, S));
      if (E.comp && E.comp.n >= 1) {
        var bc = N.barraEn(E.comp.id, S);
        comp = { n: E.comp.n, barra: bc, y: rec + de + bc.db / 2, A: E.comp.n * bc.A };
      }
      if (Mu > 0) dis = aceroRequerido(Mu, b, h, armT.d, comp ? comp.y : rec + de + 8 * S.desdeMm, fc, fy, S);
    } else {
      var bT = N.barraEn(E.barraT, S), bC = N.barraEn(E.barraC, S);
      var dp = rec + de + bC.db / 2;
      var d = h - rec - de - bT.db / 2;
      var historial = [];
      if (usuarioT) {
        // El usuario fija la cantidad de barras inferiores
        armT = armarTraccion(E.nT, bT, b, h, rec, de, S);
        if (armT.error) { R.errores.push(armT.error); return R; }
        dis = aceroRequerido(Mu, b, h, armT.d, dp, fc, fy, S);
        if (dis.error) { R.errores.push(dis.error); return R; }
        historial.push({ d: armT.d, As_req: acero_minimo(dis, sismo), n: E.nT, capas: armT.capas.length });
      } else {
        for (var it = 0; it < 8; it++) {
          dis = aceroRequerido(Mu, b, h, d, dp, fc, fy, S);
          if (dis.error) { R.errores.push(dis.error); return R; }
          var As_req = acero_minimo(dis, sismo);
          var nT = Math.max(2, Math.ceil(As_req / bT.A - 1e-9));
          armT = armarTraccion(nT, bT, b, h, rec, de, S);
          if (armT.error) { R.errores.push(armT.error); return R; }
          historial.push({ d: d, As_req: As_req, n: nT, capas: armT.capas.length });
          if (Math.abs(armT.d - d) < 0.5 * S.desdeMm) break;
          d = armT.d;
        }
      }
      dis.historial = historial;
      dis.As_req = acero_minimo(dis, sismo);

      // Acero superior
      var nCmax = maxPorCapa(b, rec, de, bC.db, S);
      var nC;
      if (usuarioC) nC = E.nC;
      else {
        nC = 2;
        if (dis.tipo === 'doble') nC = Math.max(2, Math.ceil(dis.Asp_calc / bC.A - 1e-9));
        if (sismo !== 'ninguno') nC = Math.max(nC, Math.ceil(dis.limites.Asmin / bC.A - 1e-9));
      }
      var cambioC = false;
      // Ajuste automático (solo en lo que el usuario no fijó): al redondear As puede
      // excederse el acero máximo (E.060 10.3.4) → se aumenta A's; si φMn < Mu → se aumenta As.
      for (var k = 0; k < 40; k++) {
        comp = nC > 0 ? { n: nC, barra: bC, y: dp, A: nC * bC.A } : null;
        var an = analizar(b, h, fc, fy, listaAceros(armT, comp), S);
        var Lk = limites(b, h, armT.d, fc, fy, S);
        var fspk = comp ? Math.max(0, an.aceros[an.aceros.length - 1].f) : 0;
        var AsmaxK = Lk.Asmax + (comp ? comp.A * fspk / fy : 0);
        if (!usuarioC && armT.As > AsmaxK + 1e-9) {
          if (nC < nCmax) { nC++; continue; }
          // No caben más barras superiores de ese diámetro: se pasa al diámetro siguiente
          var sig = siguienteBarra(bC.id);
          if (sig) {
            bC = N.barraEn(sig, S); dp = rec + de + bC.db / 2;
            nCmax = maxPorCapa(b, rec, de, bC.db, S); nC = 2;
            cambioC = true; continue;
          }
        }
        if (!usuarioT && PHI_FLEXION * an.Mn < Mu - 1e-6) {
          var ntot = armT.capas.reduce(function (s, c) { return s + c.n; }, 0);
          var arm2 = armarTraccion(ntot + 1, bT, b, h, rec, de, S);
          if (arm2.error) break;
          armT = arm2; continue;
        }
        break;
      }
      if (cambioC) R.avisos.push('Para no exceder el acero máximo (E.060, 10.3.4) el programa cambió las barras superiores a ' + bC.nombre + '.');
      if (comp && comp.n > nCmax) R.avisos.push('Las ' + comp.n + ' barras superiores no caben en una capa (máximo ' + nCmax + ').');
      if (usuarioT) R.avisos.push('Cantidad de barras inferiores fijada por el usuario: ' + E.nT + '.');
      if (usuarioC) R.avisos.push('Cantidad de barras superiores fijada por el usuario: ' + E.nC + '.');
    }

    // ---------------- Análisis del armado final ----------------
    var aceros = listaAceros(armT, comp);
    var A = analizar(b, h, fc, fy, aceros, S);
    var L = limites(b, h, armT.d, fc, fy, S);
    var fsp = comp ? A.aceros[A.aceros.length - 1].f : 0;
    var eps_p = comp ? A.aceros[A.aceros.length - 1].eps : null;
    var Asmax = L.Asmax + (comp ? comp.A * Math.max(0, fsp) / fy : 0);
    var As = armT.As, Asp = comp ? comp.A : 0;
    var phiMn = PHI_FLEXION * A.Mn;

    R.limites = L;
    R.diseno = dis;
    R.armado = { capas: armT.capas, As: As, d: armT.d, dt: armT.dt, nmax: armT.nmax, comp: comp, Asp: Asp, dp: comp ? comp.y : null,
      usuarioT: usuarioT, usuarioC: usuarioC };
    R.analisis = { c: A.c, a: A.a, Cc: A.Cc, Mn: A.Mn, phiMn: phiMn, eps_t: A.eps_t, dt: A.dt, aceros: A.aceros, fsp: fsp, eps_p: eps_p, Asmax: Asmax, phi: PHI_FLEXION };

    // ---------------- Verificaciones E.060 ----------------
    var V = R.verificaciones;
    function ver(id, texto, valor, limite, cumple, ref, tipo, unidad) {
      V.push({ id: id, texto: texto, valor: valor, limite: limite, cumple: cumple, ref: ref, tipo: tipo || 'obligatoria', unidad: unidad });
    }
    if (Mu > 0) ver('resistencia', 'Resistencia a flexión: φMn ≥ Mu', phiMn / S.momInt, Mu / S.momInt, phiMn >= Mu - 1e-6, 'E.060, 9.1.1 y 9.3.2.1', null, 'M');
    ver('acero_max', 'Acero máximo: As ≤ 0,75 Asb' + (comp ? " + A's·f's/fy" : ''), As, Asmax, As <= Asmax + 1e-9, 'E.060, 10.3.4', null, 'A');
    ver('eps_t', 'Deformación neta del acero extremo εt ≥ 0,004 (alternativa)', A.eps_t, 0.004, A.eps_t >= 0.004, 'E.060, 10.3.5', 'informativa', 'eps');
    var exento = sismo === 'ninguno' && dis && As >= 4 / 3 * dis.As_calc - 1e-9;
    ver('acero_min', 'Acero mínimo: As ≥ As,mín' + (exento && As < L.Asmin ? ' (exento: As ≥ 4/3 del requerido, 10.5.3)' : ''), As, L.Asmin, As >= L.Asmin - 1e-9 || exento, 'E.060, 10.5.1 a 10.5.3', null, 'A');
    ver('mcr', 'φMn ≥ 1,2 Mcr', phiMn / S.momInt, 1.2 * L.Mcr / S.momInt, phiMn >= 1.2 * L.Mcr - 1e-6 || exento, 'E.060, 10.5.1', null, 'M');
    armT.capas.forEach(function (c, i) {
      var s = espaciamientoLibre(b, rec, de, c.n, c.barra.db), smin = Math.max(c.barra.db, S.sMin);
      ver('esp_' + i, 'Distancia libre entre barras, capa ' + (i + 1), s, smin, s >= smin - 1e-9, 'E.060, 7.6.1', null, 'L');
    });
    if (comp) {
      var sc = espaciamientoLibre(b, rec, de, comp.n, comp.barra.db), scm = Math.max(comp.barra.db, S.sMin);
      ver('esp_c', 'Distancia libre entre barras superiores', sc, scm, sc >= scm - 1e-9, 'E.060, 7.6.1', null, 'L');
      ver('fluye_c', 'El acero superior fluye (informativo)', eps_p, R.material.ey, eps_p >= R.material.ey, 'E.060, 10.2.4', 'informativa', 'eps');
    }
    if (E.Ms && E.Ms > 0) {
      var Ms = E.Ms * S.momInt;
      var bmayor = armT.capas.reduce(function (m, c) { return c.barra.A > m.A ? c.barra : m; }, armT.capas[0].barra);
      var fs_s = Ms / (0.9 * armT.d * As);
      var dc = rec + de + armT.capas[0].barra.db / 2;
      var ys = h - armT.d;
      var nEq = As / bmayor.A;
      var Act = 2 * ys * b / nEq;
      var Z = fs_s * Math.cbrt(dc * Act) / S.Zdiv;
      R.fisuracion = { Ms: Ms, fs: fs_s, dc: dc, ys: ys, nEq: nEq, Act: Act, Z: Z };
      ver('fisuracion', 'Control de fisuración: Z ≤ ' + N.fmt.num(S.Zlim, 0) + ' ' + S.Z, Z, S.Zlim, Z <= S.Zlim, 'E.060, 9.9.3', null, 'Z');
    }
    var rev = analizar(b, h, fc, fy, invertir(aceros, h), S);
    R.reverso = { Mn: rev.Mn, relacion: rev.Mn / A.Mn };
    if (sismo !== 'ninguno') {
      var nInf = armT.capas[0].n, nSup = comp ? comp.n : 0;
      var refB = sismo === '21.4' ? 'E.060, 21.4.4.1' : 'E.060, 21.5.2.1';
      ver('sis_barras', 'Al menos 2 barras continuas en cada cara', Math.min(nInf, nSup), 2, nInf >= 2 && nSup >= 2, refB, null, 'n');
      ver('sis_asmin_sup', 'Acero superior ≥ As,mín (sin la excepción de 10.5.3)', Asp, L.Asmin, Asp >= L.Asmin - 1e-9, refB, null, 'A');
      var frac = sismo === '21.4' ? 1 / 3 : 1 / 2;
      ver('sis_momento', 'En la cara de un nudo: Mn opuesto ≥ ' + (sismo === '21.4' ? '1/3' : '1/2') + ' Mn', R.reverso.relacion, frac, R.reverso.relacion >= frac - 1e-9,
        sismo === '21.4' ? 'E.060, 21.4.4.3' : 'E.060, 21.5.2.2', 'condicional', 'r');
      if (sismo === '21.5') {
        var rho = As / (b * armT.d);
        ver('sis_rho', 'Cuantía en tracción ρ ≤ 0,025', rho, 0.025, rho <= 0.025, 'E.060, 21.5.2.1', null, 'r4');
        var bmin = Math.max(S.bSis, 0.25 * h);
        ver('sis_ancho', 'Ancho bw ≥ ' + N.fmt.num(S.bSis, 0) + ' ' + S.L + ' y ≥ 0,25 h', b, bmin, b >= bmin - 1e-9, 'E.060, 21.5.1.3', null, 'L');
        if (E.ln) ver('sis_luz', 'Luz libre ℓn ≥ 4h', E.ln, 4 * h, E.ln >= 4 * h, 'E.060, 21.5.1.2', null, 'L');
      }
    }

    // ---------------- Contraste ACI 318-25 (informativo) ----------------
    var ety = fy / S.Es;
    var phiAci = A.eps_t >= ety + 0.003 ? 0.90 : (A.eps_t <= ety ? 0.65 : 0.65 + 0.25 * (A.eps_t - ety) / 0.003);
    var rhoMinAci = Math.max(S.aci1 * Math.sqrt(fc), S.aci2) / fy;
    R.aci = { phi: phiAci, phiMn: phiAci * A.Mn, controlada_traccion: A.eps_t >= ety + 0.003,
      eps_lim: ety + 0.003, Asmin: rhoMinAci * b * armT.d, cumple_min: As >= rhoMinAci * b * armT.d - 1e-9 };

    R.ok = V.filter(function (v) { return v.tipo === 'obligatoria'; }).every(function (v) { return v.cumple; });
    return R;
  }

  /** Acero a colocar según el mínimo (E.060 10.5.1–10.5.3; sin excepción en vigas sísmicas). */
  function acero_minimo(dis, sismo) {
    var As = dis.As_calc, Amin = dis.limites.Asmin;
    if (As >= Amin) return As;
    if (sismo !== 'ninguno') return Amin;
    return Math.min(Amin, 4 / 3 * As);
  }
  function siguienteBarra(id) {
    var ids = ['1/2', '5/8', '3/4', '1', '1 3/8'];
    var i = ids.indexOf(id);
    return i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
  }
  function listaAceros(armT, comp) {
    var l = armT.capas.map(function (c) { return { y: c.y, A: c.A, rol: 'T' }; });
    if (comp) l.push({ y: comp.y, A: comp.A, rol: 'C' });
    return l;
  }
  function invertir(aceros, h) {
    return aceros.map(function (s) { return { y: h - s.y, A: s.A, rol: s.rol === 'T' ? 'C' : 'T' }; });
  }

  var api = {
    PHI: PHI_FLEXION,
    calcular: calcular,
    limites: limites,
    aceroSimple: aceroSimple,
    aceroRequerido: aceroRequerido,
    analizar: analizar,
    maxPorCapa: maxPorCapa
  };
  N.m02 = Object.assign(N.m02 || {}, api);
  raiz.NATAEL = N;
  if (typeof module !== 'undefined' && module.exports) module.exports = N.m02;
})(typeof window !== 'undefined' ? window : globalThis);
