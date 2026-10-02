/*
 * NATAEL Vigas (M02) — Plano de la sección transversal
 * Genera el dibujo de la sección armada como una lista de primitivas (líneas,
 * arcos, círculos y textos) en coordenadas reales, y lo entrega en tres formatos:
 *   - SVG   para la pantalla y la memoria impresa,
 *   - DXF   (AutoCAD R12, ASCII) para abrir en cualquier programa CAD,
 *   - TikZ  para la memoria en LaTeX.
 * El dibujo es el mismo en los tres: contorno, estribo con ganchos a 135°,
 * barras a su diámetro real, cotas en metros y rótulos de armado.
 * Autor: Edson Ever Quispe Acrota
 *
 * Coordenadas: origen en la esquina inferior izquierda de la sección, x hacia
 * la derecha, y hacia arriba, en las unidades del sistema elegido (cm o mm).
 */
(function (raiz) {
  'use strict';
  var N = raiz.NATAEL;

  /** Capas del plano: nombre, color de AutoCAD (índice ACI) y uso. */
  var CAPAS = [
    { id: 'CONCRETO', color: 4, uso: 'Contorno de la sección' },
    { id: 'ACERO',    color: 1, uso: 'Barras longitudinales' },
    { id: 'ESTRIBO',  color: 2, uso: 'Estribo y ganchos' },
    { id: 'COTAS',    color: 8, uso: 'Cotas y líneas guía' },
    { id: 'TEXTOS',   color: 3, uso: 'Rótulos de armado y notas' },
    { id: 'ROTULO',   color: 7, uso: 'Título y escala' },
    { id: 'ACHURADO', color: 9, uso: 'Símbolo de concreto' }
  ];

  /* ==================================================================
   * 1. Primitivas del dibujo
   * ================================================================== */
  /**
   * opciones: { escala: 10, elemento: 'V-101', ejeNeutro: false, cuadro: true }
   * Devuelve { prims: [...], caja: {x0,y0,x1,y1}, ht }.
   */
  function plano(R, opciones) {
    var o = opciones || {};
    var esc = o.escala || 10;
    var E = R.entrada, S = R.S, Ar = R.armado;
    var b = E.b, h = E.h, rec = E.rec, de = R.estribo.db;
    var pm = esc * S.desdeMm;              // unidades del modelo por milímetro de papel
    var ht = 2.5 * pm;                     // altura de texto: 2,5 mm en el papel
    var htT = 3.5 * pm;                    // título: 3,5 mm
    var P = [];
    var linea = function (x1, y1, x2, y2, capa) { P.push({ t: 'linea', x1: x1, y1: y1, x2: x2, y2: y2, capa: capa }); };
    var arco = function (cx, cy, r, a1, a2, capa) { P.push({ t: 'arco', cx: cx, cy: cy, r: r, a1: a1, a2: a2, capa: capa }); };
    var disco = function (cx, cy, r, capa) { P.push({ t: 'disco', cx: cx, cy: cy, r: r, capa: capa }); };
    var texto = function (x, y, s, capa, alin, alto) { P.push({ t: 'texto', x: x, y: y, s: s, capa: capa, alin: alin || 'i', h: alto || ht }); };
    function rectRedondeado(x0, y0, x1, y1, r, capa) {
      linea(x0 + r, y0, x1 - r, y0, capa); linea(x1, y0 + r, x1, y1 - r, capa);
      linea(x1 - r, y1, x0 + r, y1, capa); linea(x0, y1 - r, x0, y0 + r, capa);
      arco(x1 - r, y1 - r, r, 0, 90, capa); arco(x0 + r, y1 - r, r, 90, 180, capa);
      arco(x0 + r, y0 + r, r, 180, 270, capa); arco(x1 - r, y0 + r, r, 270, 360, capa);
    }

    // --- Contorno de concreto
    linea(0, 0, b, 0, 'CONCRETO'); linea(b, 0, b, h, 'CONCRETO');
    linea(b, h, 0, h, 'CONCRETO'); linea(0, h, 0, 0, 'CONCRETO');

    // --- Estribo: dos líneas (cara exterior e interior de la barra) con esquinas dobladas
    var dbInf = Ar.capas[0].barra.db, dbSup = Ar.comp ? Ar.comp.barra.db : de;
    var ri = Math.max(dbInf, dbSup) / 2;   // radio interior del doblez, ajustado a la barra de esquina
    rectRedondeado(rec, rec, b - rec, h - rec, ri + de, 'ESTRIBO');
    rectRedondeado(rec + de, rec + de, b - rec - de, h - rec - de, ri, 'ESTRIBO');

    // --- Ganchos a 135° en la esquina superior derecha, a cada lado de la barra de esquina
    var cx = b - rec - de - dbSup / 2, cy = h - rec - de - dbSup / 2;
    var Lg = Math.max(8 * de, 75 * S.desdeMm);     // extensión del gancho sísmico (E.060, 21.1)
    Lg = Math.min(Lg, 0.45 * Math.min(b, h));
    var k = Math.SQRT1_2, dx = -k, dy = -k;        // dirección del gancho: hacia el interior
    [1, -1].forEach(function (lado) {
      var nx = lado * k, ny = -lado * k;           // normal a la dirección
      var e0 = dbSup / 2, e1 = dbSup / 2 + de;     // cara interior y exterior de la barra del estribo
      var ax = cx + nx * e0, ay = cy + ny * e0, bx = cx + nx * e1, by = cy + ny * e1;
      linea(ax, ay, ax + dx * Lg, ay + dy * Lg, 'ESTRIBO');
      linea(bx, by, bx + dx * Lg, by + dy * Lg, 'ESTRIBO');
      linea(ax + dx * Lg, ay + dy * Lg, bx + dx * Lg, by + dy * Lg, 'ESTRIBO');
    });

    // --- Barras longitudinales a su diámetro real
    var barras = [];
    function fila(nb, db, yTop, sobre) {
      var y = h - yTop, xa = rec + de + db / 2, xb = b - rec - de - db / 2, xs = [];
      if (sobre && nb < sobre.length) {
        // segunda capa: cada barra va exactamente sobre una de la capa inferior (E.060, 7.6.2),
        // empezando por los extremos
        var n1 = sobre.length, orden = [];
        if (nb === 1) orden = [Math.floor((n1 - 1) / 2)];
        else for (var q = 0; orden.length < nb; q++) { orden.push(q); if (orden.length < nb) orden.push(n1 - 1 - q); }
        xs = orden.map(function (i) { return sobre[i]; }).sort(function (u, v) { return u - v; });
      } else {
        for (var i = 0; i < nb; i++) xs.push(nb === 1 ? (xa + xb) / 2 : xa + (xb - xa) * i / (nb - 1));
      }
      xs.forEach(function (x) { disco(x, y, db / 2, 'ACERO'); barras.push({ x: x, y: y, r: db / 2 }); });
      return { y: y, xs: xs, xUlt: xs[xs.length - 1], r: db / 2 };
    }
    var rotulos = [], xsInf = null;
    Ar.capas.forEach(function (c, i) {
      var f = fila(c.n, c.barra.db, c.y, i > 0 ? xsInf : null);
      if (i === 0) xsInf = f.xs;
      rotulos.push({ f: f, s: c.n + ' Ø' + c.barra.nombre });
    });
    if (Ar.comp) { var fc = fila(Ar.comp.n, Ar.comp.barra.db, Ar.comp.y); rotulos.push({ f: fc, s: Ar.comp.n + ' Ø' + Ar.comp.barra.nombre }); }

    // --- Símbolo de concreto: trazos cortos a 45° dentro del núcleo, lejos de las barras y del gancho
    [[0.28, 0.20], [0.62, 0.30], [0.36, 0.44], [0.66, 0.56], [0.30, 0.68], [0.52, 0.80]].forEach(function (f) {
      var px = f[0] * b, py = f[1] * h;
      var cerca = barras.some(function (q) { return Math.hypot(q.x - px, q.y - py) < q.r + 1.6 * ht; });
      var enGancho = px > cx - Lg * k - ht && py > cy - Lg * k - ht;
      if (cerca || enGancho || px < rec + de + ht || px > b - rec - de - ht) return;
      [[0, 1.3], [0.45, 0.9], [0.9, 0.5]].forEach(function (t) {
        var ox = px + t[0] * ht * k, oy = py - t[0] * ht * k, L = t[1] * ht / 2;
        linea(ox - L * k, oy - L * k, ox + L * k, oy + L * k, 'ACHURADO');
      });
    });

    // --- Cotas en metros, con marcas inclinadas
    var m = function (v) { return (v / (1000 * S.desdeMm)).toFixed(2); };
    var sep = 3 * ht, ext = 0.8 * ht, tk = 0.6 * ht;
    function marca(x, y) { linea(x - tk, y - tk, x + tk, y + tk, 'COTAS'); }
    // ancho b, arriba
    var yb = h + sep;
    linea(-ext, yb, b + ext, yb, 'COTAS');
    linea(0, h + ext, 0, yb + ext, 'COTAS'); linea(b, h + ext, b, yb + ext, 'COTAS');
    marca(0, yb); marca(b, yb);
    texto(b / 2, yb + 0.45 * ht, m(b), 'COTAS', 'c');
    // peralte h, a la izquierda
    var xh = -sep;
    linea(xh, -ext, xh, h + ext, 'COTAS');
    linea(-ext, 0, xh - ext, 0, 'COTAS'); linea(-ext, h, xh - ext, h, 'COTAS');
    marca(xh, 0); marca(xh, h);
    texto(xh - 0.7 * ht, h / 2 - 0.5 * ht, m(h), 'COTAS', 'd');

    // --- Rótulos de armado con línea guía a la derecha
    rotulos.sort(function (a, c) { return a.f.y - c.f.y; });
    var prev = -Infinity;
    rotulos.forEach(function (q) {
      var yl = Math.max(q.f.y, prev + 1.7 * ht); prev = yl;
      var x0 = q.f.xUlt + q.f.r, xq = b + 1.2 * ht, xf = b + 3.0 * ht;
      linea(x0, q.f.y, xq, yl, 'COTAS'); linea(xq, yl, xf, yl, 'COTAS');
      texto(xf + 0.4 * ht, yl - 0.4 * ht, q.s, 'TEXTOS', 'i');
    });

    // --- Nota del estribo, título y cuadro de datos
    var notaEst = 'Ø' + R.estribo.nombre + ' (ver diseño por corte)';
    var yn = -3.2 * ht, xs = b / 2 - (1.9 * 0.9 * ht + 0.62 * ht * notaEst.length) / 2;
    // símbolo de estribo (paralelogramo pequeño)
    var a = 0.9 * ht;
    linea(xs, yn, xs + a, yn, 'TEXTOS'); linea(xs + a, yn, xs + a + 0.35 * a, yn + a, 'TEXTOS');
    linea(xs + a + 0.35 * a, yn + a, xs + 0.35 * a, yn + a, 'TEXTOS'); linea(xs + 0.35 * a, yn + a, xs, yn, 'TEXTOS');
    texto(xs + 1.9 * a, yn, notaEst, 'TEXTOS', 'i');

    var yt = yn - 3.2 * htT;
    var titulo = 'SECCIÓN ' + String(o.elemento || '').toUpperCase();
    texto(b / 2, yt, titulo.trim(), 'ROTULO', 'c', htT);
    var semi = 0.33 * htT * titulo.trim().length;
    linea(b / 2 - semi, yt - 0.45 * htT, b / 2 + semi, yt - 0.45 * htT, 'ROTULO');
    texto(b / 2, yt - 1.9 * ht, 'ESC. 1:' + esc, 'ROTULO', 'c');
    if (o.cuadro !== false) {
      var d = S.id === 'MKS' ? 0 : 1;
      texto(b / 2, yt - 3.8 * ht, "f'c = " + (+E.fc.toFixed(d)) + ' ' + S.esf + '   fy = ' + (+E.fy.toFixed(d)) + ' ' + S.esf, 'TEXTOS', 'c');
      texto(b / 2, yt - 5.4 * ht, 'Recubrimiento libre = ' + (rec / (1000 * S.desdeMm)).toFixed(2) + ' m', 'TEXTOS', 'c');
    }

    // --- Eje neutro (solo en pantalla; no va en el plano)
    if (o.ejeNeutro && R.analisis) {
      P.push({ t: 'eje', y: h - R.analisis.c, x1: -1.2 * ht, x2: b + 1.0 * ht, s: 'E.N.  c = ' + N.fmt.num(R.analisis.c, S.dL) + ' ' + S.L, h: ht,
        abajo: R.analisis.c < 0.25 * h });
    }

    return { prims: P, caja: caja(P), ht: ht, escala: esc };
  }

  /** Ancho aproximado de un texto (para calcular el marco del dibujo). */
  function anchoTexto(p) { return 0.62 * p.h * String(p.s).length; }
  function caja(P) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    function inc(x, y) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    P.forEach(function (p) {
      if (p.t === 'linea') { inc(p.x1, p.y1); inc(p.x2, p.y2); }
      else if (p.t === 'arco' || p.t === 'disco') { inc(p.cx - p.r, p.cy - p.r); inc(p.cx + p.r, p.cy + p.r); }
      else if (p.t === 'texto') {
        var w = anchoTexto(p), xi = p.alin === 'c' ? p.x - w / 2 : (p.alin === 'd' ? p.x - w : p.x);
        inc(xi, p.y - 0.3 * p.h); inc(xi + w, p.y + 1.1 * p.h);
      } else if (p.t === 'eje') { inc(p.x1, p.y); inc(p.x2, p.y + 1.4 * p.h); }
    });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  /* ==================================================================
   * 2. SVG (pantalla y memoria impresa)
   * ================================================================== */
  function escXML(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function planoSVG(R, opciones) {
    var D = plano(R, opciones), c = D.caja, mg = 0.6 * D.ht;
    var W = c.x1 - c.x0 + 2 * mg, H = c.y1 - c.y0 + 2 * mg;
    var X = function (x) { return (x - c.x0 + mg).toFixed(2); };
    var Y = function (y) { return (c.y1 - y + mg).toFixed(2); };
    var s = ['<svg class="plano-svg" viewBox="0 0 ' + W.toFixed(2) + ' ' + H.toFixed(2) + '" role="img" aria-label="Sección transversal de la viga con su armado, a escala">'];
    D.prims.forEach(function (p) {
      if (p.t === 'linea') s.push('<line class="pl-' + p.capa + '" x1="' + X(p.x1) + '" y1="' + Y(p.y1) + '" x2="' + X(p.x2) + '" y2="' + Y(p.y2) + '"/>');
      else if (p.t === 'arco') {
        var r1 = p.a1 * Math.PI / 180, r2 = p.a2 * Math.PI / 180;
        s.push('<path class="pl-' + p.capa + '" fill="none" d="M ' + X(p.cx + p.r * Math.cos(r1)) + ' ' + Y(p.cy + p.r * Math.sin(r1)) +
          ' A ' + p.r.toFixed(2) + ' ' + p.r.toFixed(2) + ' 0 ' + ((p.a2 - p.a1) > 180 ? 1 : 0) + ' 0 ' + X(p.cx + p.r * Math.cos(r2)) + ' ' + Y(p.cy + p.r * Math.sin(r2)) + '"/>');
      }
      else if (p.t === 'disco') s.push('<circle class="pl-' + p.capa + '-relleno" cx="' + X(p.cx) + '" cy="' + Y(p.cy) + '" r="' + p.r.toFixed(2) + '"/>');
      else if (p.t === 'texto') s.push('<text class="pl-texto pl-t-' + p.capa + '" x="' + X(p.x) + '" y="' + Y(p.y) + '" font-size="' + p.h.toFixed(2) + '" text-anchor="' + (p.alin === 'c' ? 'middle' : (p.alin === 'd' ? 'end' : 'start')) + '">' + escXML(p.s) + '</text>');
      else if (p.t === 'eje') {
        s.push('<line class="pl-eje" x1="' + X(p.x1) + '" y1="' + Y(p.y) + '" x2="' + X(p.x2) + '" y2="' + Y(p.y) + '" stroke-width="' + (0.2 * p.h).toFixed(2) + '" stroke-dasharray="' + (0.7 * p.h).toFixed(2) + ' ' + (0.4 * p.h).toFixed(2) + '"/>');
        s.push('<text class="pl-eje-t" x="' + X((p.x1 + p.x2) / 2) + '" y="' + Y(p.abajo ? p.y - 1.25 * p.h : p.y + 0.35 * p.h) + '" font-size="' + (0.95 * p.h).toFixed(2) + '" text-anchor="middle" stroke-width="' + (0.3 * p.h).toFixed(2) + '">' + escXML(p.s) + '</text>');
      }
    });
    s.push('</svg>');
    // el grosor de línea se fija por capa en la hoja de estilos, en unidades del dibujo
    return s.join('').replace('<svg class="plano-svg"', '<svg class="plano-svg" style="--pl-fino:' + (0.07 * D.ht).toFixed(3) + 'px;--pl-grueso:' + (0.16 * D.ht).toFixed(3) + 'px"');
  }

  /* ==================================================================
   * 3. DXF (AutoCAD R12, ASCII)
   * ================================================================== */
  /** Texto para DXF: Ø → %%c y demás caracteres no ASCII como \U+XXXX. */
  function textoDXF(s) {
    return String(s).replace(/Ø/g, '%%c').replace(/[^\x20-\x7E]/g, function (ch) {
      return '\\U+' + ('0000' + ch.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
    });
  }
  function planoDXF(R, opciones) {
    var o = Object.assign({ escala: 10, ejeNeutro: false }, opciones || {}, { ejeNeutro: false });
    var D = plano(R, o);
    var L = [];
    var g = function (cod, val) { L.push(String(cod)); L.push(String(val)); };
    var f = function (x) { return (Math.round(x * 1e6) / 1e6).toString(); };
    // --- Encabezado
    g(0, 'SECTION'); g(2, 'HEADER');
    g(9, '$ACADVER'); g(1, 'AC1009');
    g(9, '$INSBASE'); g(10, 0); g(20, 0); g(30, 0);
    g(9, '$EXTMIN'); g(10, f(D.caja.x0)); g(20, f(D.caja.y0)); g(30, 0);
    g(9, '$EXTMAX'); g(10, f(D.caja.x1)); g(20, f(D.caja.y1)); g(30, 0);
    g(9, '$LTSCALE'); g(40, f(D.escala));
    g(0, 'ENDSEC');
    // --- Tablas: tipo de línea, capas y estilo de texto
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, 1);
    g(0, 'LTYPE'); g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
    g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, CAPAS.length + 1);
    g(0, 'LAYER'); g(2, '0'); g(70, 0); g(62, 7); g(6, 'CONTINUOUS');
    CAPAS.forEach(function (c) { g(0, 'LAYER'); g(2, c.id); g(70, 0); g(62, c.color); g(6, 'CONTINUOUS'); });
    g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1);
    g(0, 'STYLE'); g(2, 'NATAEL'); g(70, 0); g(40, 0); g(41, 0.85); g(50, 0); g(71, 0); g(42, f(D.ht)); g(3, 'romans.shx'); g(4, '');
    g(0, 'ENDTAB');
    g(0, 'ENDSEC');
    // --- Entidades
    g(0, 'SECTION'); g(2, 'ENTITIES');
    D.prims.forEach(function (p) {
      if (p.t === 'linea') { g(0, 'LINE'); g(8, p.capa); g(10, f(p.x1)); g(20, f(p.y1)); g(30, 0); g(11, f(p.x2)); g(21, f(p.y2)); g(31, 0); }
      else if (p.t === 'arco') { g(0, 'ARC'); g(8, p.capa); g(10, f(p.cx)); g(20, f(p.cy)); g(30, 0); g(40, f(p.r)); g(50, f(p.a1)); g(51, f(p.a2 % 360)); }
      else if (p.t === 'disco') {
        // disco relleno: polilínea cerrada de dos arcos con ancho igual al radio ("donut")
        g(0, 'POLYLINE'); g(8, p.capa); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1); g(40, f(p.r)); g(41, f(p.r));
        g(0, 'VERTEX'); g(8, p.capa); g(10, f(p.cx - p.r / 2)); g(20, f(p.cy)); g(30, 0); g(42, 1);
        g(0, 'VERTEX'); g(8, p.capa); g(10, f(p.cx + p.r / 2)); g(20, f(p.cy)); g(30, 0); g(42, 1);
        g(0, 'SEQEND'); g(8, p.capa);
        g(0, 'CIRCLE'); g(8, p.capa); g(10, f(p.cx)); g(20, f(p.cy)); g(30, 0); g(40, f(p.r));
      }
      else if (p.t === 'texto') {
        g(0, 'TEXT'); g(8, p.capa); g(10, f(p.x)); g(20, f(p.y)); g(30, 0); g(40, f(p.h)); g(1, textoDXF(p.s)); g(7, 'NATAEL');
        if (p.alin !== 'i') { g(72, p.alin === 'c' ? 1 : 2); g(11, f(p.x)); g(21, f(p.y)); g(31, 0); }
      }
    });
    g(0, 'ENDSEC'); g(0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ==================================================================
   * 4. TikZ (memoria en LaTeX)
   * ================================================================== */
  function planoTikZ(R, opciones) {
    var o = Object.assign({ escala: 10, cuadro: false }, opciones || {}, { ejeNeutro: false });
    var D = plano(R, o);
    var k = 0.1 / (D.ht / 2.5);            // 1 mm de papel = 0,1 cm de TikZ → dibujo a la escala indicada
    var f = function (v) { return (v * k).toFixed(3); };
    var estilo = { CONCRETO: 'line width=0.7pt', ESTRIBO: 'line width=0.35pt', COTAS: 'line width=0.25pt,black!70', TEXTOS: 'line width=0.25pt', ROTULO: 'line width=0.4pt', ACHURADO: 'line width=0.2pt,black!45' };
    var esc = function (s) { return String(s).replace(/([&%#_{}])/g, '\\$1').replace(/Ø/g, '{\\O}'); };
    var t = ['\\begin{tikzpicture}[x=1cm,y=1cm,line cap=round]'];
    D.prims.forEach(function (p) {
      if (p.t === 'linea') t.push('\\draw[' + estilo[p.capa] + '] (' + f(p.x1) + ',' + f(p.y1) + ') -- (' + f(p.x2) + ',' + f(p.y2) + ');');
      else if (p.t === 'arco') t.push('\\draw[' + estilo[p.capa] + '] (' + f(p.cx + p.r * Math.cos(p.a1 * Math.PI / 180)) + ',' + f(p.cy + p.r * Math.sin(p.a1 * Math.PI / 180)) + ') arc (' + p.a1 + ':' + p.a2 + ':' + f(p.r) + ');');
      else if (p.t === 'disco') t.push('\\fill (' + f(p.cx) + ',' + f(p.cy) + ') circle (' + f(p.r) + ');');
      else if (p.t === 'texto') {
        var anc = p.alin === 'c' ? 'base' : (p.alin === 'd' ? 'base east' : 'base west');
        t.push('\\node[anchor=' + anc + ',inner sep=0pt,font=' + (p.capa === 'ROTULO' && p.h > D.ht ? '\\small\\bfseries' : '\\footnotesize') + '] at (' + f(p.x) + ',' + f(p.y) + ') {' + esc(p.s) + '};');
      }
    });
    t.push('\\end{tikzpicture}');
    return t.join('\n');
  }

  N.m02 = N.m02 || {};
  N.m02.CAPAS = CAPAS;
  N.m02.plano = plano;
  N.m02.planoSVG = planoSVG;
  N.m02.planoDXF = planoDXF;
  N.m02.planoTikZ = planoTikZ;
  raiz.NATAEL = N;
})(typeof window !== 'undefined' ? window : globalThis);
