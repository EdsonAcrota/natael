/*
 * NATAEL Vigas (M02) — Memoria de cálculo
 * A partir del resultado de NATAEL.m02.calcular() arma la memoria de cálculo
 * como una lista de bloques (títulos, párrafos, ecuaciones, tablas, figura) y
 * la entrega en dos formatos:
 *   - HTML con LaTeX para MathJax (pantalla e impresión a PDF), y
 *   - documento LaTeX completo (.tex) para compilar con pdfLaTeX.
 * Todas las cantidades se muestran en el sistema de unidades elegido (SI o MKS).
 * Autor: Edson Ever Quispe Acrota
 */
(function (raiz) {
  'use strict';
  var N = raiz.NATAEL;
  var T = function (x, d) { return N.fmt.tex(x, d === undefined ? 2 : d); };
  var n = function (x, d) { return N.fmt.num(x, d === undefined ? 2 : d); };

  var SISMO = {
    'ninguno': 'No forma parte del sistema sismorresistente',
    '21.4': 'Sistema de muros estructurales o dual tipo I (E.060, 21.4)',
    '21.5': 'Pórticos o dual tipo II (E.060, 21.5)'
  };

  function barrasTexto(capas) {
    var mismo = capas.every(function (c) { return c.barra.id === capas[0].barra.id; });
    if (capas.length > 1 && mismo) {
      var tot = capas.reduce(function (s, c) { return s + c.n; }, 0);
      return tot + ' Ø ' + capas[0].barra.nombre + ' (' + capas.map(function (c) { return c.n; }).join(' + ') + ')';
    }
    return capas.map(function (c) { return c.n + ' Ø ' + c.barra.nombre; }).join(' + ');
  }
  /** Dato ingresado por el usuario: sin ceros decimales innecesarios. */
  function dato(x) {
    var r = Math.round(x * 100) / 100;
    var entero = Math.abs(r - Math.round(r)) < 1e-9, unDec = Math.abs(r * 10 - Math.round(r * 10)) < 1e-9;
    return n(r, entero ? 0 : (unDec ? 1 : 2));
  }

  /* ==================================================================
   * Mini-marcado de texto: $…$ = matemática, **…** = negrita
   * ================================================================== */
  function escHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function escTeX(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([&%#_{}])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }
  function trozos(s) {                       // separa texto y matemática
    var out = [], re = /\$([^$]+)\$/g, i = 0, m;
    s = String(s == null ? '' : s);
    while ((m = re.exec(s))) {
      if (m.index > i) out.push({ t: s.slice(i, m.index) });
      out.push({ m: m[1] });
      i = re.lastIndex;
    }
    if (i < s.length) out.push({ t: s.slice(i) });
    return out;
  }
  function aHTML(s) {
    return trozos(s).map(function (p) {
      if (p.m !== undefined) return '\\(' + p.m + '\\)';
      return escHTML(p.t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }).join('');
  }
  function aTeX(s) {
    return trozos(s).map(function (p) {
      if (p.m !== undefined) return '$' + p.m + '$';
      return escTeX(p.t).replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}');
    }).join('');
  }

  /* ==================================================================
   * Unidades de presentación
   * ================================================================== */
  function fmtU(S) {
    return {
      L: function (x) { return n(x, S.dL) + ' ' + S.L; },
      A: function (x) { return n(x, S.dA) + ' ' + S.A; },
      M: function (xInt) { return n(xInt / S.momInt, 2) + ' ' + S.M; },
      tL: function (x) { return T(x, S.dL) + '\\ ' + S.texL; },
      tA: function (x) { return T(x, S.dA) + '\\ ' + S.texA; },
      tM: function (xInt) { return T(xInt / S.momInt, 2) + '\\ ' + S.texM; },
      tE: function (x, d) { return T(x, d === undefined ? S.dEsf : d) + '\\ ' + S.texEsf; },
      l: function (x) { return T(x, S.dL); },       // solo número
      a: function (x) { return T(x, S.dA); },
      e: function (x, d) { return T(x, d === undefined ? S.dEsf : d); }
    };
  }

  /* ==================================================================
   * Contenido de la memoria (bloques independientes del formato)
   * ================================================================== */
  function bloques(R, P) {
    P = P || {};
    var E = R.entrada, S = R.S, L = R.limites, D = R.diseno, A = R.analisis, Ar = R.armado, MT = R.material;
    var U = fmtU(S), est = R.estribo;
    var B = [];
    var h2 = function (t) { B.push({ k: 'h2', t: t }); };
    var p = function (t) { B.push({ k: 'p', t: t }); };
    var nota = function (t) { B.push({ k: 'nota', t: t }); };
    var eq = function (tex, ref) { B.push({ k: 'eq', tex: tex, ref: ref }); };
    var tabla = function (filas, cab, num) { B.push({ k: 'tabla', filas: filas, cab: cab, num: num }); };
    var mom = function (x) { return T(x / S.momInt, 2); };
    var p10 = '\\times 10^{' + S.momExp + '}';

    // 1. Datos
    h2('Datos de entrada');
    tabla([
      ['Ancho de la sección', '$b$', dato(E.b) + ' ' + S.L],
      ['Peralte total', '$h$', dato(E.h) + ' ' + S.L],
      ['Recubrimiento libre al estribo', '$r$', dato(E.rec) + ' ' + S.L],
      ['Estribo', '$d_e$', est.nombre + ' (' + U.L(est.db) + ')'],
      ['Resistencia del concreto', "$f'_c$", n(E.fc, S.dEsf) + ' ' + S.esf],
      ['Fluencia del acero', '$f_y$', n(E.fy, S.dEsf) + ' ' + S.esf]
    ].concat(E.Mu ? [['Momento amplificado', '$M_u$', n(E.Mu, 2) + ' ' + S.M]] : [])
     .concat(E.Ms ? [['Momento de servicio', '$M_s$', n(E.Ms, 2) + ' ' + S.M]] : [])
     .concat(E.ln ? [['Luz libre', '$\\ell_n$', dato(E.ln) + ' ' + S.L]] : [])
     .concat([['Condición sísmica', '', SISMO[E.sismo || 'ninguno']],
              ['Tipo de cálculo', '', E.modo === 'verificacion' ? 'Verificación de un armado dado' : 'Diseño del refuerzo']]));
    if (S.id === 'MKS') nota('Cálculo en el sistema MKS (kgf, cm). La E.060 está redactada en unidades SI; se usan sus expresiones equivalentes en kgf/cm²: $E_c = 15\\,000\\sqrt{f\'_c}$, $f_r = 2\\sqrt{f\'_c}$, $A_{s,\\min} = 0{,}7\\sqrt{f\'_c}\\,bd/f_y$ y $E_s = 2\\times 10^6$ kgf/cm² (Ottazzi, 2015; Blanco, 1994).');

    // 2. Materiales
    h2('Parámetros de los materiales');
    eq('\\beta_1 = ' + S.beta1Tex(E.fc, MT.beta1, T), 'E.060, 10.2.7.3');
    eq('E_c = ' + T(S.cEc, 0) + "\\sqrt{f'_c} = " + T(S.cEc, 0) + '\\sqrt{' + U.e(E.fc) + '} = ' + U.tE(MT.Ec, 0), 'E.060, 8.5.2');
    eq('f_r = ' + T(S.cfr, 2) + "\\sqrt{f'_c} = " + U.tE(MT.fr, 2), 'E.060, 9.6.2.3');
    eq('\\varepsilon_y = \\frac{f_y}{E_s} = \\frac{' + U.e(E.fy) + '}{' + T(S.Es, 0) + '} = ' + T(MT.ey, 5) + ', \\qquad \\varepsilon_{cu} = 0{,}003', 'E.060, 8.5.5 y 10.2.3');

    // 3. Peralte efectivo
    h2('Peralte efectivo');
    var c0 = Ar.capas[0];
    eq('y_1 = h - r - d_e - \\frac{d_b}{2} = ' + U.l(E.h) + ' - ' + U.l(E.rec) + ' - ' + U.l(est.db) + ' - \\frac{' + U.l(c0.barra.db) + '}{2} = ' + U.tL(c0.y), 'Ottazzi (2015), sec. 6.10');
    if (Ar.capas.length > 1) {
      var c1 = Ar.capas[1];
      p('Las barras no caben en una capa (máximo ' + Ar.nmax + ' barras de ' + c0.barra.nombre + ' por capa, E.060, 7.6.1). Se usa una segunda capa con separación libre de ' + U.L(Math.max(S.sMin, c0.barra.db)) + ' (E.060, 7.6.2).');
      eq('y_2 = ' + U.tL(c1.y) + ', \\qquad d = \\frac{A_1 y_1 + A_2 y_2}{A_1 + A_2} = \\frac{' + U.a(c0.A) + '\\cdot ' + U.l(c0.y) + ' + ' + U.a(c1.A) + '\\cdot ' + U.l(c1.y) + '}{' + U.a(c0.A + c1.A) + '} = ' + U.tL(Ar.d));
    } else {
      eq('d = y_1 = ' + U.tL(Ar.d));
    }
    if (Ar.comp) eq("d' = r + d_e + \\frac{d'_b}{2} = " + U.tL(Ar.comp.y));

    // 4. Límites
    h2('Límites de la sección');
    p('Falla balanceada: el acero alcanza $\\varepsilon_y$ cuando el concreto llega a $\\varepsilon_{cu} = 0{,}003$ (E.060, 10.3.2).');
    eq('c_b = \\frac{' + T(S.EsEcu, 0) + '}{' + T(S.EsEcu, 0) + ' + f_y}\\,d = \\frac{' + T(S.EsEcu, 0) + '}{' + T(S.EsEcu, 0) + ' + ' + U.e(E.fy) + '}\\cdot ' + U.l(Ar.d) + ' = ' + U.tL(L.cb), 'E.060, 10.3.2');
    eq("A_{sb} = \\frac{0{,}85\\,f'_c\\,b\\,\\beta_1 c_b}{f_y} = \\frac{0{,}85\\cdot " + U.e(E.fc) + '\\cdot ' + U.l(E.b) + '\\cdot ' + T(L.beta1, 3) + '\\cdot ' + U.l(L.cb) + '}{' + U.e(E.fy) + '} = ' + U.tA(L.Asb) + ' \\quad (\\rho_b = ' + T(L.rhob, 4) + ')');
    eq('A_{s,\\max} = 0{,}75\\,A_{sb} = ' + U.tA(L.Asmax) + ', \\qquad a_{\\max} = ' + U.tL(L.amax), 'E.060, 10.3.4');
    eq('\\phi M_{n,\\max} = 0{,}9\\,A_{s,\\max} f_y\\left(d - \\frac{a_{\\max}}{2}\\right) = ' + U.tM(L.phiMnmax));
    var IgTex = S.id === 'SI' ? T(L.Ig / 1e6, 1) + '\\times 10^{6}' : T(L.Ig, 0);
    eq('M_{cr} = \\frac{f_r I_g}{y_t} = \\frac{' + T(L.fr, 2) + '\\cdot ' + IgTex + '}{' + U.l(L.yt) + '} = ' + U.tM(L.Mcr), 'E.060, 10.5.1');
    eq('A_{s,\\min} = \\frac{' + T(S.cAsmin, 2) + "\\sqrt{f'_c}}{f_y}\\,b\\,d = " + U.tA(L.Asmin_eq) + ', \\qquad A_s \\text{ para } \\phi M_n = 1{,}2\\,M_{cr}: ' + U.tA(L.As_12Mcr), 'E.060, 10.5.1 y 10.5.2');
    eq('A_{s,\\min} = ' + U.tA(L.Asmin));

    // 5. Diseño
    if (D && E.Mu) {
      h2(E.modo === 'verificacion' ? 'Acero requerido (referencial)' : 'Diseño del acero');
      if (D.tipo === 'simple') {
        p('Como $M_u = ' + T(E.Mu, 2) + ' \\le \\phi M_{n,\\max} = ' + U.tM(L.phiMnmax) + '$, la sección es **simplemente reforzada**.');
        eq("\\begin{aligned} a &= d - \\sqrt{d^2 - \\frac{2\\,M_u}{\\phi\\,0{,}85\\,f'_c\\,b}} \\\\ &= " + U.l(D.d) + ' - \\sqrt{' + U.l(D.d) + '^2 - \\frac{2\\cdot ' + T(E.Mu, 2) + p10 + '}{0{,}9\\cdot 0{,}85\\cdot ' + U.e(E.fc) + '\\cdot ' + U.l(E.b) + '}} = ' + U.tL(D.a) + '\\end{aligned}', 'E.060, 9.1.1 y 10.2');
        eq("A_s = \\frac{0{,}85\\,f'_c\\,b\\,a}{f_y} = " + U.tA(D.As_calc) + ', \\qquad K_u = \\frac{M_u}{b\\,d^2} = ' + U.tE(D.Ku, 2));
      } else {
        p('Como $M_u = ' + T(E.Mu, 2) + ' > \\phi M_{n,\\max} = ' + U.tM(L.phiMnmax) + '$, se requiere **acero en compresión**. Se usa el modelo por superposición (Ottazzi, 2015, sec. 12.7).');
        eq('A_{s1} = 0{,}75\\,A_{sb} = ' + U.tA(D.As1) + ', \\quad c_1 = \\frac{a_{\\max}}{\\beta_1} = ' + U.tL(D.c) + ', \\quad M_{n1} = ' + U.tM(D.Mn1), 'E.060, 10.3.4');
        eq('M_{n2} = \\frac{M_u}{\\phi} - M_{n1} = \\frac{' + T(E.Mu, 2) + '}{0{,}9} - ' + mom(D.Mn1) + ' = ' + U.tM(D.Mn2));
        eq("\\varepsilon'_s = 0{,}003\\,\\frac{c_1 - d'}{c_1} = 0{,}003\\,\\frac{" + U.l(D.c) + ' - ' + U.l(D.dp) + '}{' + U.l(D.c) + '} = ' + T(D.eps_p, 5) + (D.fluye_p ? ' \\ge ' : ' < ') + "\\varepsilon_y \\;\\Rightarrow\\; f'_s = " + U.tE(D.fsp), 'E.060, 10.2.2 y 10.2.4');
        eq("A'_s = \\frac{M_{n2}}{f'_s\\,(d - d')} = \\frac{" + mom(D.Mn2) + p10 + '}{' + U.e(D.fsp) + '\\,(' + U.l(D.d) + ' - ' + U.l(D.dp) + ')} = ' + U.tA(D.Asp_calc));
        eq("A_{s2} = A'_s\\,\\frac{f'_s}{f_y} = " + U.tA(D.As2) + ', \\qquad A_s = A_{s1} + A_{s2} = ' + U.tA(D.As_calc));
      }
      if (E.modo !== 'verificacion') {
        if (D.As_calc < L.Asmin) {
          p(E.sismo !== 'ninguno'
            ? 'El acero calculado es menor que el mínimo. En vigas sismorresistentes no se aplica la excepción de 10.5.3; el acero requerido es $A_{s,\\min} = ' + U.tA(L.Asmin) + '$ (E.060, 21.4.4.1 y 21.5.2.1).'
            : 'El acero calculado es menor que el mínimo. Se requiere el menor de $A_{s,\\min}$ y $\\tfrac43 A_s$ (E.060, 10.5.3): $A_s = ' + U.tA(D.As_req) + '$.');
        }
        if (D.historial && D.historial.length > 1) p('El cálculo se repitió ' + D.historial.length + ' veces hasta que el peralte efectivo supuesto coincidió con el del armado elegido.');
      }
    }

    // 6. Armado
    h2('Armado adoptado');
    var origen = (Ar.usuarioT || Ar.usuarioC) ? 'Cantidad de barras elegida por el proyectista' + (Ar.usuarioT && Ar.usuarioC ? '' : (Ar.usuarioT ? ' (inferiores)' : ' (superiores)')) + '.' : 'Cantidad de barras calculada por el programa.';
    B.push({ k: 'armado', filas: [
      ['Acero inferior', '$A_s$', barrasTexto(Ar.capas) + ' = ' + U.A(Ar.As)],
      ['Acero superior', "$A'_s$", Ar.comp ? Ar.comp.n + ' Ø ' + Ar.comp.barra.nombre + ' = ' + U.A(Ar.Asp) : 'Sin acero superior'],
      ['Peralte efectivo', '$d$', U.L(Ar.d)],
      ['Cuantía', '$\\rho = A_s/bd$', n(Ar.As / (E.b * Ar.d), 4)]
    ], nota: origen });

    // 7. Verificación
    h2('Verificación por compatibilidad de deformaciones');
    p('Con las barras colocadas se busca la profundidad del eje neutro $c$ que equilibra las fuerzas internas, con $\\varepsilon_{cu} = 0{,}003$, acero elastoplástico y bloque de $0{,}85\\,f\'_c$ con profundidad $a = \\beta_1 c$ (E.060, 10.2). Se descuenta el concreto desplazado por las barras comprimidas.');
    eq("0{,}85\\,f'_c\\,b\\,a + \\sum A_i\\,f_i = 0 \\;\\Rightarrow\\; c = " + U.tL(A.c) + ', \\quad a = ' + U.tL(A.a) + ', \\quad C_c = ' + T(A.Cc / S.fuerzaDiv, 2) + '\\ ' + S.texF);
    var nT = A.aceros.filter(function (t) { return t.rol === 'T'; }).length, iT = 0;
    tabla(A.aceros.map(function (s) {
      var nombre = s.rol === 'C' ? "$A'_s$" : (nT > 1 ? '$A_{s' + (++iT) + '}$' : '$A_s$');
      return [nombre, n(s.y, S.dL), n(s.A, S.dA), n(s.eps * 1000, 3), n(s.f, S.dEsf), n(s.F / S.fuerzaDiv, 2)];
    }), ['Acero', 'y (' + S.L + ')', 'A (' + S.A + ')', 'ε (‰)', 'f (' + S.esf + ')', 'F (' + S.F + ')'], true);
    nota('Signo: compresión positiva, tracción negativa. $y$ se mide desde la fibra más comprimida.');
    eq('M_n = -\\Bigl(C_c\\,\\frac{a}{2} + \\sum F_i\\,y_i\\Bigr) = ' + U.tM(A.Mn) + ', \\qquad \\phi M_n = 0{,}9\\cdot ' + mom(A.Mn) + ' = ' + U.tM(A.phiMn), 'E.060, 9.3.2.1');
    nota('Momentos respecto de la fibra superior. Como la suma de fuerzas es nula, el resultado no depende del punto elegido.');
    eq('\\varepsilon_t = 0{,}003\\,\\frac{d_t - c}{c} = 0{,}003\\,\\frac{' + U.l(A.dt) + ' - ' + U.l(A.c) + '}{' + U.l(A.c) + '} = ' + T(A.eps_t, 5), 'E.060, 10.3.5');
    if (Ar.comp) eq("A_{s,\\max} = 0{,}75\\,A_{sb} + A'_s\\,\\frac{f'_s}{f_y} = " + U.a(L.Asmax) + ' + ' + U.a(Ar.Asp) + '\\cdot\\frac{' + U.e(Math.max(0, A.fsp)) + '}{' + U.e(E.fy) + '} = ' + U.tA(A.Asmax), 'E.060, 10.3.4');
    if (R.fisuracion) {
      var F = R.fisuracion;
      p('Control de la fisuración con el momento de servicio (E.060, 9.9.3):');
      eq('f_s = \\frac{M_s}{0{,}9\\,d\\,A_s} = ' + U.tE(F.fs, 1) + ', \\quad A_{ct} = \\frac{2\\,y_s\\,b}{n} = ' + U.tA(F.Act) + ', \\quad Z = f_s\\sqrt[3]{d_c A_{ct}} = ' + T(F.Z, S.id === 'SI' ? 2 : 0) + '\\ \\text{' + S.Z + '}', 'E.060, 9.9.3');
    }

    // 8. Verificaciones
    h2('Resumen de verificaciones');
    B.push({ k: 'verif', filas: R.verificaciones.map(function (v) {
      return { texto: v.texto, valor: valorVer(v, 'valor', S), limite: valorVer(v, 'limite', S), ref: v.ref, cumple: v.cumple, tipo: v.tipo };
    }) });
    B.push({ k: 'veredicto', ok: R.ok, t: R.ok
      ? 'La sección cumple todas las verificaciones obligatorias de la E.060 incluidas en este programa.'
      : 'La sección no cumple al menos una verificación obligatoria. Revise el armado o las dimensiones.' });

    // 9. ACI
    h2('Contraste con el ACI 318-25 (informativo)');
    p('El ACI 318-25 usa otras combinaciones de carga ($1{,}2D + 1{,}6L$), por lo que $M_u$ no es directamente comparable. Con el mismo $M_n$:');
    var AC = R.aci;
    tabla([
      ['Sección controlada por tracción', '$\\varepsilon_t \\ge \\varepsilon_{ty} + 0{,}003 = ' + T(AC.eps_lim, 4) + '$', AC.controlada_traccion ? 'Sí' : 'No (el ACI 9.3.3.1 lo exige en vigas)'],
      ['Factor de reducción', '$\\phi$', n(AC.phi, 3) + ' (tabla 21.2.2)'],
      ['Resistencia de diseño', '$\\phi M_n$', U.M(AC.phiMn)],
      ['Acero mínimo', '$\\max(' + T(S.aci1, 2) + "\\sqrt{f'_c},\\ " + T(S.aci2, S.aci2 < 10 ? 1 : 0) + ')\\,bd/f_y$', U.A(AC.Asmin) + (AC.cumple_min ? ', cumple' : ', no cumple')]
    ]);

    // 10. Referencias
    h2('Referencias');
    B.push({ k: 'refs', items: [
      'Ministerio de Vivienda, Construcción y Saneamiento. (2009). *Norma Técnica E.060 Concreto Armado*. Reglamento Nacional de Edificaciones, aprobada por Decreto Supremo N.° 010-2009-VIVIENDA (8 de mayo de 2009).',
      'American Concrete Institute. (2025). *Building code for structural concrete: Code requirements and commentary (ACI CODE-318-25), SI units*. ACI.',
      'Ottazzi Pasino, G. (2015). *Apuntes del curso Concreto Armado I* (15.ª ed.). Pontificia Universidad Católica del Perú.',
      'Harmsen, T. E. (2002). *Diseño de estructuras de concreto armado* (3.ª ed.). Fondo Editorial PUCP.',
      'Blanco Blasco, A. (1994). *Estructuración y diseño de edificaciones de concreto armado*. Colegio de Ingenieros del Perú.'
    ] });
    B.push({ k: 'pie', t: 'Memoria generada por NATAEL Vigas v' + N.version + '. El proyectista es responsable de verificar los datos de entrada y la aplicabilidad de los resultados.' });
    return B;
  }

  function valorVer(v, k, S) {
    var x = v[k];
    switch (v.unidad) {
      case 'M': return n(x, 2) + ' ' + S.M;
      case 'A': return n(x, S.dA) + ' ' + S.A;
      case 'L': return n(x, S.dL) + ' ' + S.L;
      case 'eps': return n(x, 5);
      case 'Z': return n(x, S.id === 'SI' ? 2 : 0) + ' ' + S.Z;
      case 'r': return n(x, 2);
      case 'r4': return n(x, 4);
      case 'n': return n(x, 0);
      default: return n(x, 2);
    }
  }
  function estadoTexto(ok, tipo) {
    if (tipo === 'informativa') return ok ? 'Sí' : 'No';
    if (tipo === 'condicional') return ok ? 'Cumple' : 'Revisar';
    return ok ? 'Cumple' : 'No cumple';
  }

  /* ==================================================================
   * Salida HTML
   * ================================================================== */
  function memoria(R, P) {
    P = P || {};
    var h = [];
    h.push('<header class="mc-cab">' +
      '<div class="mc-cab-marca"><span class="mc-logo">NATAEL</span><span class="mc-cab-mod">Vigas · M02</span></div>' +
      '<h1 class="mc-h1">Memoria de cálculo: diseño a flexión de viga rectangular</h1>' +
      '<dl class="mc-cab-datos">' +
      '<div><dt>Proyecto</dt><dd>' + escHTML(P.proyecto || '—') + '</dd></div>' +
      '<div><dt>Elemento</dt><dd>' + escHTML(P.elemento || '—') + '</dd></div>' +
      '<div><dt>Proyectista</dt><dd>' + escHTML(P.proyectista || '—') + '</dd></div>' +
      '<div><dt>Fecha</dt><dd>' + escHTML(P.fecha || '') + '</dd></div>' +
      '</dl>' +
      '<p class="mc-cab-norma">Norma de diseño: E.060 Concreto Armado (D.S. N.° 010-2009-VIVIENDA). Contraste informativo: ACI CODE-318-25. ' +
      'Unidades: ' + (R.S ? (R.S.id === 'MKS' ? 'MKS (kgf, cm, tf·m)' : 'SI (N, mm, kN·m)') : '') + '. Programa NATAEL Vigas v' + N.version + ', autor Edson Ever Quispe Acrota.</p>' +
      '</header>');
    if (R.errores && R.errores.length) {
      h.push('<div class="mc-error"><strong>No se puede calcular.</strong><ul>' + R.errores.map(function (e) { return '<li>' + escHTML(e) + '</li>'; }).join('') + '</ul></div>');
      return h.join('');
    }
    var sec = 0;
    bloques(R, P).forEach(function (b) {
      switch (b.k) {
        case 'h2': sec++; h.push('<h2 class="mc-h2"><span class="mc-num">' + sec + '</span>' + escHTML(b.t) + '</h2>'); break;
        case 'p': h.push('<p>' + aHTML(b.t) + '</p>'); break;
        case 'nota': h.push('<p class="mc-nota">' + aHTML(b.t) + '</p>'); break;
        case 'eq': h.push('<div class="mc-eq"><div class="mc-eq-f">\\[' + b.tex + '\\]</div>' + (b.ref ? '<div class="mc-eq-ref">' + escHTML(b.ref) + '</div>' : '') + '</div>'); break;
        case 'tabla': h.push(tablaHTML(b)); break;
        case 'armado':
          h.push('<div class="mc-armado">' + N.m02.planoSVG(R, { elemento: P.elemento, cuadro: false }) + '<div>' + tablaHTML({ filas: b.filas }) + '<p class="mc-nota">' + escHTML(b.nota) + '</p></div></div>');
          break;
        case 'verif':
          h.push('<table class="mc-tabla mc-verif"><thead><tr><th>Verificación</th><th>Valor</th><th>Límite</th><th>Artículo</th><th>Estado</th></tr></thead><tbody>' +
            b.filas.map(function (v) {
              var cls = v.tipo === 'informativa' ? 'chip-info' : (v.cumple ? 'chip-ok' : (v.tipo === 'condicional' ? 'chip-warn' : 'chip-no'));
              return '<tr><td>' + escHTML(v.texto) + '</td><td class="num">' + escHTML(v.valor) + '</td><td class="num">' + escHTML(v.limite) + '</td><td>' + escHTML(v.ref) + '</td><td><span class="chip ' + cls + '">' + estadoTexto(v.cumple, v.tipo) + '</span></td></tr>';
            }).join('') + '</tbody></table>');
          break;
        case 'veredicto': h.push('<p class="mc-veredicto ' + (b.ok ? 'ok' : 'no') + '">' + escHTML(b.t) + '</p>'); break;
        case 'refs': h.push('<ul class="mc-ref">' + b.items.map(function (r) { return '<li>' + escHTML(r).replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</li>'; }).join('') + '</ul>'); break;
        case 'pie': h.push('<p class="mc-pie">' + escHTML(b.t) + '</p>'); break;
      }
    });
    return h.join('');
  }
  function tablaHTML(b) {
    var cab = b.cab ? '<thead><tr>' + b.cab.map(function (c) { return '<th>' + escHTML(c) + '</th>'; }).join('') + '</tr></thead>' : '';
    var filas = b.filas.map(function (f) {
      if (b.num) return '<tr>' + f.map(function (c, i) { return i === 0 ? '<td>' + aHTML(c) + '</td>' : '<td class="num">' + aHTML(c) + '</td>'; }).join('') + '</tr>';
      return '<tr><th scope="row">' + aHTML(f[0]) + '</th><td class="sim">' + aHTML(f[1]) + '</td><td>' + aHTML(f[2]) + '</td></tr>';
    }).join('');
    return '<table class="mc-tabla' + (b.num ? ' mc-tabla-num' : '') + '">' + cab + '<tbody>' + filas + '</tbody></table>';
  }

  /* ==================================================================
   * Salida LaTeX (documento completo, compila con pdfLaTeX)
   * ================================================================== */
  function memoriaTeX(R, P) {
    P = P || {};
    var o = [];
    o.push('% Memoria de cálculo generada por NATAEL Vigas v' + N.version + ' (autor: Edson Ever Quispe Acrota)');
    o.push('% Compilar con pdfLaTeX (dos pasadas no son necesarias).');
    o.push('\\documentclass[10.5pt,a4paper]{article}'.replace('10.5pt', '11pt'));
    o.push('\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage{textcomp}');
    o.push('\\usepackage[spanish,es-noshorthands,es-nodecimaldot]{babel}');
    o.push('\\usepackage[a4paper,margin=2.2cm]{geometry}\n\\usepackage{amsmath,amssymb}\n\\usepackage{booktabs,tabularx,array}\n\\usepackage{tikz}\n\\usepackage[dvipsnames]{xcolor}\n\\usepackage{newunicodechar}\n\\usepackage{fancyhdr}');
    o.push(['φ:\\ensuremath{\\phi}', '≥:\\ensuremath{\\ge}', '≤:\\ensuremath{\\le}', 'ε:\\ensuremath{\\varepsilon}', 'β:\\ensuremath{\\beta}',
      'ρ:\\ensuremath{\\rho}', '\u2009:\\,', 'ℓ:\\ensuremath{\\ell}', '′:\\ensuremath{^{\\prime}}', '≈:\\ensuremath{\\approx}', '‰:\\textperthousand{}', '·:\\ensuremath{\\cdot}', '²:\\textsuperscript{2}']
      .map(function (s) { var i = s.indexOf(':'); return '\\newunicodechar{' + s.slice(0, i) + '}{' + s.slice(i + 1) + '}'; }).join('\n'));
    o.push('\\setlength{\\parindent}{0pt}\\setlength{\\parskip}{0.5em}\\renewcommand{\\arraystretch}{1.25}');
    o.push('\\pagestyle{fancy}\\fancyhf{}\\fancyhead[L]{\\small NATAEL Vigas (M02) --- Memoria de cálculo}\\fancyhead[R]{\\small ' + escTeX(P.elemento || '') + '}\\fancyfoot[C]{\\small\\thepage}');
    o.push('\\newcolumntype{L}{>{\\raggedright\\arraybackslash}X}');
    o.push('\\begin{document}');
    o.push('{\\large\\bfseries NATAEL} \\quad {\\small Vigas · M02}\\par\\vspace{4pt}');
    o.push('{\\Large\\bfseries Memoria de cálculo: diseño a flexión de viga rectangular}\\par\\vspace{8pt}');
    o.push('\\begin{tabularx}{\\textwidth}{@{}lL@{}}\n\\toprule\nProyecto & ' + escTeX(P.proyecto || '—') + ' \\\\\nElemento & ' + escTeX(P.elemento || '—') + ' \\\\\nProyectista & ' + escTeX(P.proyectista || '—') + ' \\\\\nFecha & ' + escTeX(P.fecha || '') + ' \\\\\n\\bottomrule\n\\end{tabularx}\\par');
    o.push('{\\small Norma de diseño: E.060 Concreto Armado (D.S. N.° 010-2009-VIVIENDA). Contraste informativo: ACI CODE-318-25. Unidades: ' + (R.S.id === 'MKS' ? 'MKS (kgf, cm, tf·m)' : 'SI (N, mm, kN·m)') + '. Programa NATAEL Vigas v' + N.version + ', autor Edson Ever Quispe Acrota.}');
    if (R.errores && R.errores.length) {
      o.push('\\section*{No se puede calcular}\\begin{itemize}' + R.errores.map(function (e) { return '\\item ' + escTeX(e); }).join('\n') + '\\end{itemize}\\end{document}');
      return o.join('\n');
    }
    bloques(R, P).forEach(function (b) {
      switch (b.k) {
        case 'h2': o.push('\\section{' + escTeX(b.t) + '}'); break;
        case 'p': o.push(aTeX(b.t) + '\n'); break;
        case 'nota': o.push('{\\small ' + aTeX(b.t) + '}\n'); break;
        case 'eq': o.push('\\begin{equation*}\n' + b.tex + (b.ref ? '\n\\tag*{\\footnotesize\\ttfamily ' + escTeX(b.ref) + '}' : '') + '\n\\end{equation*}'); break;
        case 'tabla': o.push(tablaTeX(b)); break;
        case 'armado':
          o.push('\\begin{center}\n' + N.m02.planoTikZ(R, { elemento: P.elemento }) + '\n\\end{center}');
          o.push(tablaTeX({ filas: b.filas }) + '\n{\\small ' + escTeX(b.nota) + '}\n');
          break;
        case 'verif':
          o.push('{\\small\\begin{tabularx}{\\textwidth}{@{}L r r l l@{}}\n\\toprule\nVerificación & Valor & Límite & Artículo & Estado \\\\\n\\midrule\n' +
            b.filas.map(function (v) { return escTeX(v.texto) + ' & ' + escTeX(v.valor) + ' & ' + escTeX(v.limite) + ' & ' + escTeX(v.ref) + ' & ' + (v.cumple || v.tipo === 'informativa' ? '' : '\\bfseries ') + estadoTexto(v.cumple, v.tipo) + ' \\\\'; }).join('\n') +
            '\n\\bottomrule\n\\end{tabularx}}');
          break;
        case 'veredicto': o.push('\\medskip\\fbox{\\parbox{\\dimexpr\\textwidth-2\\fboxsep-2\\fboxrule}{\\bfseries ' + escTeX(b.t) + '}}\n'); break;
        case 'refs': o.push('\\begin{itemize}\\small\n' + b.items.map(function (r) { return '\\item ' + escTeX(r).replace(/\*([^*]+)\*/g, '\\emph{$1}'); }).join('\n') + '\n\\end{itemize}'); break;
        case 'pie': o.push('\\vfill{\\footnotesize ' + escTeX(b.t) + '}'); break;
      }
    });
    o.push('\\end{document}');
    return o.join('\n');
  }
  function tablaTeX(b) {
    if (b.num) {
      var cols = '@{}l' + new Array(b.cab.length).join('r') + '@{}';
      return '\\begin{center}\\small\\begin{tabular}{' + cols + '}\n\\toprule\n' + b.cab.map(aTeX).join(' & ') + ' \\\\\n\\midrule\n' +
        b.filas.map(function (f) { return f.map(aTeX).join(' & ') + ' \\\\'; }).join('\n') + '\n\\bottomrule\n\\end{tabular}\\end{center}';
    }
    return '\\begin{tabularx}{\\textwidth}{@{}p{0.30\\textwidth} p{0.27\\textwidth} L@{}}\n\\toprule\n' +
      (b.cab ? b.cab.map(aTeX).join(' & ') + ' \\\\\n\\midrule\n' : '') +
      b.filas.map(function (f) { return f.map(aTeX).join(' & ') + ' \\\\'; }).join('\n') + '\n\\bottomrule\n\\end{tabularx}\n';
  }

  N.m02 = N.m02 || {};
  N.m02.memoria = memoria;
  N.m02.memoriaTeX = memoriaTeX;
  N.m02.barrasTexto = barrasTexto;
  raiz.NATAEL = N;
})(typeof window !== 'undefined' ? window : globalThis);
