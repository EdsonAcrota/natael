/*
 * NATAEL Vigas (M02) — Interfaz de usuario
 * Lee el formulario, llama al motor de cálculo en el sistema de unidades elegido
 * y muestra resultados, alternativas de armado y la memoria de cálculo
 * (pantalla, impresión a PDF, descarga en LaTeX y plano de la sección en DXF).
 * Autor: Edson Ever Quispe Acrota
 */
(function () {
  'use strict';
  var N = window.NATAEL, M = N.m02, U = N.unidades;
  var $ = function (id) { return document.getElementById(id); };
  var num = N.fmt.num;
  var VISTA_PREVIA = !!window.NATAEL_VISTA_PREVIA;

  /* ---------------- Unidades ---------------- */
  var DIM = { b: 'long', h: 'long', rec: 'long', ln: 'long', fc: 'esf', fy: 'esf', Mu: 'mom', Ms: 'mom' };
  var ROT = { SI: { long: 'mm', esf: 'MPa', mom: 'kN·m' }, MKS: { long: 'cm', esf: 'kgf/cm²', mom: 'tf·m' } };
  var sistema = 'MKS';
  function S() { return N.sistemas[sistema]; }

  /** Convierte un valor de un campo entre sistemas (solo al cambiar de unidades). */
  function convertir(campo, v, de, a) {
    if (!isFinite(v) || de === a) return v;
    var d = DIM[campo];
    if (d === 'long') return a === 'SI' ? v * 10 : v / 10;
    if (d === 'esf') return a === 'SI' ? U.kgfcm2_a_MPa(v) : U.MPa_a_kgfcm2(v);
    if (d === 'mom') return a === 'SI' ? U.tfm_a_kNm(v) : U.kNm_a_tfm(v);
    return v;
  }
  function redondeo(campo, v, a) {
    var d = DIM[campo];
    if (d === 'esf') return a === 'MKS' ? Math.round(v) : Math.round(v * 10) / 10;
    if (d === 'long') return a === 'MKS' ? Math.round(v * 10) / 10 : Math.round(v);
    return Math.round(v * 100) / 100;
  }
  function actualizarRotulos() {
    document.querySelectorAll('[data-dim]').forEach(function (el) { el.textContent = ROT[sistema][el.getAttribute('data-dim')]; });
  }
  function cambiarSistema(nuevo) {
    if (nuevo === sistema) return;
    Object.keys(DIM).forEach(function (k) {
      var v = parseFloat($(k).value);
      if (isFinite(v)) $(k).value = redondeo(k, convertir(k, v, sistema, nuevo), nuevo);
    });
    sistema = nuevo;
    actualizarRotulos();
    calcular();
  }
  var area = function (v) { return num(v, S().dA) + ' ' + S().A; };
  var long = function (v) { return num(v, S().dL) + ' ' + S().L; };
  var momento = function (vInt) { return num(vInt / S().momInt, 2) + ' ' + S().M; };
  function conUnidad(txt) { return txt.replace(/ ([^ ]+)$/, '<small>$1</small>'); }

  /* ---------------- Barras en los selectores ---------------- */
  function llenarBarras() {
    var principales = N.barras.filter(function (b) { return b.db >= 12; });
    var estribos = N.barras.filter(function (b) { return b.db <= 12.7; });
    ['barraT', 'barraC', 'c1id', 'c2id', 'ccid'].forEach(function (id) {
      $(id).innerHTML = principales.map(function (b) { return '<option value="' + b.id + '">' + b.nombre + '</option>'; }).join('');
    });
    $('estribo').innerHTML = estribos.map(function (b) { return '<option value="' + b.id + '">' + b.nombre + '</option>'; }).join('');
  }

  /* ---------------- Lectura del formulario ---------------- */
  function valor(id) { return parseFloat(String($(id).value).replace(',', '.')); }
  function entero(id) { var v = parseInt($(id).value, 10); return isFinite(v) ? v : null; }
  function leer() {
    var modo = document.querySelector('input[name="modo"]:checked').value;
    var E = {
      unidades: sistema, modo: modo,
      b: valor('b'), h: valor('h'), rec: valor('rec'), estribo: $('estribo').value,
      fc: valor('fc'), fy: valor('fy'), Mu: valor('Mu'),
      Ms: isFinite(valor('Ms')) ? valor('Ms') : null,
      ln: isFinite(valor('ln')) ? valor('ln') : null,
      barraT: $('barraT').value, barraC: $('barraC').value, sismo: $('sismo').value,
      nT: entero('nT'), nC: entero('nC')
    };
    if (!isFinite(E.Mu)) E.Mu = modo === 'verificacion' ? 0 : NaN;
    if (modo === 'verificacion') {
      E.capa1 = { n: entero('c1n') || 0, id: $('c1id').value };
      E.capa2 = { n: entero('c2n') || 0, id: $('c2id').value };
      E.comp = { n: entero('ccn') || 0, id: $('ccid').value };
    }
    return E;
  }
  function proyecto() {
    return { proyecto: $('proyecto').value, elemento: $('elemento').value, proyectista: $('proyectista').value, fecha: $('fecha').value };
  }

  /* ---------------- Resultados ---------------- */
  var ultimo = null;
  function tipoViga(R) {
    if (!R.diseno) return { clase: 'tipo-verif', texto: 'Verificación de armado' };
    return R.diseno.tipo === 'doble'
      ? { clase: 'tipo-doble', texto: 'Viga doblemente reforzada' }
      : { clase: 'tipo-simple', texto: 'Viga simplemente reforzada' };
  }
  function pintar(R) {
    ultimo = R;
    var E = R.entrada, err = $('errores');
    if (R.errores.length) {
      err.hidden = false;
      err.innerHTML = '<strong>Revise los datos.</strong><ul>' + R.errores.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>';
      $('zona-resultados').hidden = true;
      $('tipo-actual').textContent = '';
      return;
    }
    err.hidden = true;
    $('zona-resultados').hidden = false;
    var A = R.analisis, Ar = R.armado, D = R.diseno;

    var av = $('avisos');
    av.hidden = !R.avisos.length;
    av.innerHTML = R.avisos.map(function (a) { return '<p>' + a + '</p>'; }).join('');

    // Tipo de viga: visible en el formulario y en el veredicto
    var tv = tipoViga(R);
    if (E.modo === 'verificacion') tv = { clase: 'tipo-verif', texto: 'Verificación de armado' + (Ar.comp ? ' con acero superior' : '') };
    $('tipo-actual').innerHTML = 'Resultado: <span class="tipo-viga ' + tv.clase + '">' + tv.texto + '</span>';
    var vt = $('veredicto-tipo');
    vt.className = 'tipo-viga ' + tv.clase;
    vt.textContent = tv.texto;

    var v = $('veredicto');
    v.className = 'veredicto ' + (R.ok ? 'ok' : 'no');
    $('veredicto-estado').textContent = R.ok ? 'Cumple' : 'No cumple';
    $('veredicto-texto').textContent = M.barrasTexto(Ar.capas) + (Ar.capas.length > 1 ? ' en dos capas' : ' en una capa') +
      (Ar.comp ? ' · superiores ' + Ar.comp.n + ' Ø ' + Ar.comp.barra.nombre : '');

    // Métricas
    $('m-as').innerHTML = conUnidad(area(Ar.As));
    $('m-as-d').textContent = D && E.modo !== 'verificacion' ? (Ar.usuarioT ? 'elegido · requerido ' : 'requerido ') + area(D.As_req) : 'ρ = ' + num(Ar.As / (E.b * Ar.d), 4);
    $('m-asp').innerHTML = Ar.comp ? conUnidad(area(Ar.Asp)) : '—';
    $('m-asp-d').textContent = D && D.tipo === 'doble' ? 'requerido ' + area(D.Asp_calc) : (Ar.comp ? 'no requerido por cálculo' : 'sin acero superior');
    $('m-phimn').innerHTML = conUnidad(momento(A.phiMn));
    var ratio = E.Mu > 0 ? (E.Mu * S().momInt) / A.phiMn : 0;
    $('m-phimn-d').textContent = E.Mu > 0 ? 'Mu / φMn = ' + num(ratio, 2) : 'sin Mu';
    var med = $('m-medidor');
    med.className = 'medidor' + (ratio > 1 ? ' no' : '');
    med.firstElementChild.style.width = Math.min(100, ratio * 100).toFixed(0) + '%';
    $('m-et').textContent = num(A.eps_t, 4);
    $('m-et-d').textContent = A.eps_t >= 0.005 ? 'falla dúctil (> 0,005)' : (A.eps_t >= 0.004 ? 'dúctil (≥ 0,004)' : (A.eps_t >= R.material.ey ? 'acero en fluencia, ductilidad reducida' : 'acero sin fluir'));

    // Sección y verificaciones
    $('svg-seccion').innerHTML = M.planoSVG(R, { elemento: $('elemento').value, ejeNeutro: true, cuadro: false });
    $('armado-texto').innerHTML = M.barrasTexto(Ar.capas) + ' = ' + area(Ar.As) +
      (Ar.comp ? '<span>Superior: ' + Ar.comp.n + ' Ø ' + Ar.comp.barra.nombre + ' = ' + area(Ar.Asp) + '</span>' : '') +
      '<span>d = ' + long(Ar.d) + ' · eje neutro c = ' + long(A.c) + '</span>';
    $('lista-ver').innerHTML = R.verificaciones.map(function (x) {
      var chip = x.tipo === 'informativa' ? '<span class="chip chip-info">' + (x.cumple ? 'Sí' : 'No') + '</span>'
        : x.tipo === 'condicional' ? '<span class="chip ' + (x.cumple ? 'chip-ok' : 'chip-warn') + '">' + (x.cumple ? 'Cumple' : 'Revisar') + '</span>'
        : '<span class="chip ' + (x.cumple ? 'chip-ok' : 'chip-no') + '">' + (x.cumple ? 'Cumple' : 'No cumple') + '</span>';
      return '<li><span>' + x.texto + '</span>' + chip + '<span class="ref">' + x.ref + '</span></li>';
    }).join('');

    // Otras opciones de barras (solo diseño y cantidad automática)
    var op = $('opciones-panel');
    if (E.modo === 'verificacion') op.hidden = true;
    else {
      op.hidden = false;
      $('tabla-opciones').innerHTML = ['5/8', '3/4', '1', '1 3/8'].map(function (id) {
        var Ri = M.calcular(Object.assign({}, E, { barraT: id, nT: null }));
        var nombre = N.barra(id).nombre;
        if (Ri.errores.length) return '<tr><td>' + nombre + '</td><td colspan="5" class="tenue">' + Ri.errores[0] + '</td></tr>';
        var nb = Ri.armado.capas.reduce(function (s, c) { return s + c.n; }, 0);
        var exceso = (Ri.armado.As / Ri.diseno.As_req - 1) * 100;
        var actual = id === E.barraT && E.nT == null;
        return '<tr' + (actual ? ' class="actual"' : '') + '><td>' + nb + ' Ø ' + nombre + '</td><td class="num">' + Ri.armado.capas.length + '</td><td class="num">' + area(Ri.armado.As) + '</td><td class="num">' + (exceso >= 0 ? '+' : '') + num(exceso, 0) + ' %</td><td>' +
          (Ri.ok ? '<span class="chip chip-ok">Cumple</span>' : '<span class="chip chip-no">No cumple</span>') + '</td><td>' +
          (actual ? '<span class="tenue">en uso</span>' : '<button type="button" data-barra="' + id + '" data-n="' + nb + '">Usar</button>') + '</td></tr>';
      }).join('');
    }

    // Memoria
    var mem = $('memoria');
    if (window.MathJax && MathJax.typesetClear) MathJax.typesetClear([mem]);
    mem.innerHTML = M.memoria(R, proyecto());
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([mem]).catch(function () {});
  }

  var temporizador = null;
  function calcular() {
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { pintar(M.calcular(leer())); }, 200);
  }

  /* ---------------- Casos precargados ---------------- */
  var CASOS = {
    ej1: { v: { b: 30, h: 60, rec: 4, fc: 210, fy: 4200, Mu: 25, Ms: '', ln: '' }, s: { estribo: '3/8', barraT: '3/4', barraC: '5/8', sismo: 'ninguno' }, elemento: 'V-101, centro de luz' },
    ej2: { v: { b: 30, h: 60, rec: 4, fc: 210, fy: 4200, Mu: 50, Ms: '', ln: '' }, s: { estribo: '3/8', barraT: '1', barraC: '3/4', sismo: 'ninguno' }, elemento: 'V-102, apoyo' }
  };
  var casoActivo = null;
  function marcarCaso(k) {
    casoActivo = k;
    document.querySelectorAll('[data-ejemplo]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ejemplo') === k)); });
  }
  function cargarCaso(k) {
    var e = CASOS[k];
    document.querySelector('input[name="modo"][value="diseno"]').checked = true;
    $('verif-campos').hidden = true; $('diseno-campos').hidden = false;
    if (sistema !== 'MKS') { sistema = 'MKS'; $('unidades').value = 'MKS'; actualizarRotulos(); }
    Object.keys(e.v).forEach(function (id) { $(id).value = e.v[id]; });
    Object.keys(e.s).forEach(function (id) { $(id).value = e.s[id]; });
    $('nT').value = ''; $('nC').value = '';
    $('elemento').value = e.elemento;
    marcarCaso(k);
    calcular();
  }

  /* ---------------- Descarga de la memoria en LaTeX ---------------- */
  function descargar(contenido, prefijo, extension, tipo) {
    var blob = new Blob([contenido], { type: tipo });
    var a = document.createElement('a');
    var nombre = ($('elemento').value || 'viga').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'viga';
    a.href = URL.createObjectURL(blob);
    a.download = prefijo + '_NATAEL_Vigas_' + nombre + '.' + extension;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function descargarTeX() {
    if (!ultimo || ultimo.errores.length) return;
    descargar(M.memoriaTeX(ultimo, proyecto()), 'memoria', 'tex', 'application/x-tex;charset=utf-8');
  }
  /** Plano de la sección en DXF (AutoCAD R12), escala 1:10, sin eje neutro. */
  function descargarDXF() {
    if (!ultimo || ultimo.errores.length) return;
    descargar(M.planoDXF(ultimo, { elemento: $('elemento').value, escala: 10 }), 'plano', 'dxf', 'application/dxf');
  }

  /* ---------------- Inicio ---------------- */
  function iniciar() {
    llenarBarras();
    $('fecha').value = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    $('unidades').value = 'MKS';
    actualizarRotulos();
    cargarCaso('ej1');
    var f = $('formulario');
    f.addEventListener('input', function (e) {
      if (e.target.id === 'unidades') return;
      if (casoActivo && e.target.closest('.grupo') && !e.target.closest('[data-memoria]')) marcarCaso(null);
      calcular();
    });
    f.addEventListener('change', function (e) {
      if (e.target.id === 'unidades') { cambiarSistema(e.target.value); return; }
      if (e.target.name === 'modo') {
        var ver = e.target.value === 'verificacion';
        $('verif-campos').hidden = !ver; $('diseno-campos').hidden = ver;
        if (ver && ultimo && ultimo.armado) {
          var Ar = ultimo.armado;
          $('c1n').value = Ar.capas[0].n; $('c1id').value = Ar.capas[0].barra.id;
          $('c2n').value = Ar.capas[1] ? Ar.capas[1].n : 0; $('c2id').value = Ar.capas[1] ? Ar.capas[1].barra.id : Ar.capas[0].barra.id;
          $('ccn').value = Ar.comp ? Ar.comp.n : 0; $('ccid').value = Ar.comp ? Ar.comp.barra.id : '5/8';
        }
      }
      calcular();
    });
    f.addEventListener('submit', function (e) { e.preventDefault(); calcular(); });
    document.querySelectorAll('[data-ejemplo]').forEach(function (b) {
      b.addEventListener('click', function () { cargarCaso(b.getAttribute('data-ejemplo')); });
    });
    $('tabla-opciones').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-barra]');
      if (b) { $('barraT').value = b.getAttribute('data-barra'); $('nT').value = ''; marcarCaso(null); calcular(); }
    });
    document.querySelectorAll('.btn-imprimir').forEach(function (b) {
      if (VISTA_PREVIA) { b.hidden = true; return; }
      b.addEventListener('click', function () { window.print(); });
    });
    document.querySelectorAll('.btn-latex').forEach(function (b) {
      if (VISTA_PREVIA) { b.hidden = true; return; }
      b.addEventListener('click', descargarTeX);
    });
    document.querySelectorAll('.btn-dxf').forEach(function (b) {
      if (VISTA_PREVIA) { b.hidden = true; return; }
      b.addEventListener('click', descargarDXF);
    });
    if (VISTA_PREVIA) $('aviso-previa').hidden = false;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
