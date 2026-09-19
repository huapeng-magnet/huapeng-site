/*!
 * HP Magnet Calculator — UI mount layer
 * Renders into any container. Exposes HPMagnetCalcUI.mount().
 * v1.2.1 · 2026-09-19
 */
(function (global) {
  'use strict';

  var LANG = {
    en: {
      calculators: { surfaceField: 'Surface field', moment: 'Magnetic moment', pullForce: 'Pull force' },
      shapes: { block: 'Block', disc: 'Disc', ring: 'Ring' },
      material: 'Material', grade: 'Grade',
      dims: { L: 'Length L (mm)', W: 'Width W (mm)', D: 'Diameter D (mm)', d: 'Bore d (mm)', T: 'Thickness T (mm)' },
      calc: 'Calculate', reset: 'Reset',
      results: {
        surfaceField: 'Surface flux density', moment: 'Magnetic moment', pullForce: 'Estimated pull force'
      },
      extra: { flux: 'Flux', weight: 'Weight', area: 'Pole area', volume: 'Volume' },
      units: {
        gauss: 'Gauss', tesla: 'T', am2: 'A·m²', gaussCm3: 'G·cm³', newton: 'N', kgf: 'kgf', lbf: 'lbf',
        mwb: 'mWb', gram: 'g', mm2: 'mm²', mm3: 'mm³'
      },
      note: 'Theoretical estimate at zero gap. Real pull depends on steel grade, thickness, surface finish and coating — verify by test.'
    },
    de: {
      calculators: { surfaceField: 'Oberflächenfeld', moment: 'Magnetisches Moment', pullForce: 'Haftkraft' },
      shapes: { block: 'Block', disc: 'Scheibe', ring: 'Ring' },
      material: 'Material', grade: 'Sorte',
      dims: { L: 'Länge L (mm)', W: 'Breite W (mm)', D: 'Durchmesser D (mm)', d: 'Bohrung d (mm)', T: 'Dicke T (mm)' },
      calc: 'Berechnen', reset: 'Zurücksetzen',
      results: {
        surfaceField: 'Oberflächenflussdichte', moment: 'Magnetisches Moment', pullForce: 'Geschätzte Haftkraft'
      },
      extra: { flux: 'Fluss', weight: 'Gewicht', area: 'Polfläche', volume: 'Volumen' },
      units: {
        gauss: 'Gauss', tesla: 'T', am2: 'A·m²', gaussCm3: 'G·cm³', newton: 'N', kgf: 'kgf', lbf: 'lbf',
        mwb: 'mWb', gram: 'g', mm2: 'mm²', mm3: 'mm³'
      },
      note: 'Theoretischer Näherungswert bei Spaltweite null. Die tatsächliche Haftkraft hängt von Stahlsorte, Dicke, Oberflächenbeschaffenheit und Beschichtung ab — bitte durch Test verifizieren.'
    },
    es: {
      calculators: { surfaceField: 'Campo superficial', moment: 'Momento magnético', pullForce: 'Fuerza de atracción' },
      shapes: { block: 'Bloque', disc: 'Disco', ring: 'Anillo' },
      material: 'Material', grade: 'Grado',
      dims: { L: 'Longitud L (mm)', W: 'Ancho W (mm)', D: 'Diámetro D (mm)', d: 'Agujero d (mm)', T: 'Espesor T (mm)' },
      calc: 'Calcular', reset: 'Restablecer',
      results: {
        surfaceField: 'Densidad de flujo superficial', moment: 'Momento magnético', pullForce: 'Fuerza de atracción estimada'
      },
      extra: { flux: 'Flujo', weight: 'Peso', area: 'Área polar', volume: 'Volumen' },
      units: {
        gauss: 'Gauss', tesla: 'T', am2: 'A·m²', gaussCm3: 'G·cm³', newton: 'N', kgf: 'kgf', lbf: 'lbf',
        mwb: 'mWb', gram: 'g', mm2: 'mm²', mm3: 'mm³'
      },
      note: 'Estimación teórica con entrehierro nulo. La fuerza real depende del tipo de acero, el espesor, el acabado superficial y el recubrimiento; verifíquela mediante ensayo.'
    }
  };

  var DIMS = {
    block: ['L', 'W', 'T'],
    disc: ['D', 'T'],
    ring: ['D', 'd', 'T']
  };

  var DEFAULTS = { block: { L: 20, W: 10, T: 5 }, disc: { D: 20, T: 5 }, ring: { D: 20, d: 10, T: 5 } };

  /* An unknown shape must never take the whole widget down. Arc segments, for
     instance, have no closed-form solution, so a host page that passes 'arc'
     gets the disc model rather than a TypeError. */
  function dimsFor(shape) { return DIMS[shape] || DIMS.disc; }
  function defaultsFor(shape) { return DEFAULTS[shape] || DEFAULTS.disc; }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function fmt(v, digits) {
    if (!isFinite(v)) return '—';
    if (Math.abs(v) >= 1000) return v.toFixed(0);
    return v.toFixed(digits == null ? 2 : digits);
  }

  function mount(target, opts) {
    opts = opts || {};
    var host = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!host) throw new Error('HPMagnetCalcUI: mount target not found');
    var calc = opts.engine || global.HPMagnetCalc;
    if (!calc) throw new Error('HPMagnetCalcUI: engine not loaded');
    var T = LANG[opts.lang] || LANG.en;

    var state = {
      calculator: opts.calculator || 'pullForce',
      shape: opts.shape || 'disc',
      material: opts.material || 'ndfeb',
      grade: opts.grade || 'N42',
      dims: {}
    };

    var cfg = calc.getConfig() || {};
    var gradesFor = function (m) {
      var g = (cfg.grades && cfg.grades[m]) || {};
      return Object.keys(g);
    };

    host.classList.add('hpmc');
    if (opts.theme === 'light') host.classList.add('hpmc--light');
    host.innerHTML = '';

    var calcRow = el('div', 'hpmc__row hpmc__row--tabs');
    var shapeRow = el('div', 'hpmc__row hpmc__row--tabs');
    var form = el('div', 'hpmc__form');
    var out = el('div', 'hpmc__out');

    host.appendChild(calcRow);
    host.appendChild(shapeRow);
    host.appendChild(form);
    var btnRow = el('div', 'hpmc__row');
    var btn = el('button', 'hpmc__btn', T.calc);
    btn.type = 'button';
    btnRow.appendChild(btn);
    host.appendChild(btnRow);
    host.appendChild(out);
    host.appendChild(el('p', 'hpmc__note', T.note));

    function tab(active, label, onClick) {
      var b = el('button', 'hpmc__tab' + (active ? ' is-active' : ''), label);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    }

    function renderCalcRow() {
      calcRow.innerHTML = '';
      Object.keys(T.calculators).forEach(function (k) {
        calcRow.appendChild(tab(state.calculator === k, T.calculators[k], function () {
          state.calculator = k; renderAll();
        }));
      });
    }

    function renderShapeRow() {
      shapeRow.innerHTML = '';
      Object.keys(T.shapes).forEach(function (k) {
        shapeRow.appendChild(tab(state.shape === k, T.shapes[k], function () {
          state.shape = k; state.dims = {}; renderAll();
        }));
      });
    }

    function renderForm() {
      form.innerHTML = '';

      var matWrap = el('label', 'hpmc__field');
      matWrap.appendChild(el('span', 'hpmc__label', T.material));
      var selM = el('select', 'hpmc__input');
      Object.keys(cfg.materials || { ndfeb: 1 }).forEach(function (m) {
        var o = el('option', null, (cfg.materials && cfg.materials[m] && cfg.materials[m].name) || m);
        o.value = m;
        if (m === state.material) o.selected = true;
        selM.appendChild(o);
      });
      selM.addEventListener('change', function () {
        state.material = selM.value;
        state.grade = gradesFor(state.material)[0];
        renderAll();
      });
      matWrap.appendChild(selM);
      form.appendChild(matWrap);

      var grWrap = el('label', 'hpmc__field');
      grWrap.appendChild(el('span', 'hpmc__label', T.grade));
      var selG = el('select', 'hpmc__input');
      gradesFor(state.material).forEach(function (g) {
        var o = el('option', null, g);
        o.value = g;
        if (g === state.grade) o.selected = true;
        selG.appendChild(o);
      });
      selG.addEventListener('change', function () { state.grade = selG.value; });
      grWrap.appendChild(selG);
      form.appendChild(grWrap);

      dimsFor(state.shape).forEach(function (key) {
        var w = el('label', 'hpmc__field');
        w.appendChild(el('span', 'hpmc__label', T.dims[key]));
        var i = el('input', 'hpmc__input');
        i.type = 'number';
        i.step = '0.1';
        i.min = '0';
        i.value = state.dims[key] != null ? state.dims[key] : defaultsFor(state.shape)[key];
        i.addEventListener('input', function () { state.dims[key] = parseFloat(i.value); });
        w.appendChild(i);
        form.appendChild(w);
      });
    }

    function readDims() {
      var d = {};
      dimsFor(state.shape).forEach(function (k) {
        var v = state.dims[k];
        d[k] = (v == null || isNaN(v)) ? defaultsFor(state.shape)[k] : v;
      });
      return d;
    }

    function renderResult() {
      var d = readDims();
      var r;
      try {
        r = calc.run(state.calculator, state.material, state.grade, state.shape, d);
      } catch (e) {
        out.innerHTML = '<div class="hpmc__err">' + e.message + '</div>';
        return;
      }
      var u = T.units;
      var primary, secondary;
      if (state.calculator === 'surfaceField') {
        primary = fmt(r.gauss, 0) + ' ' + u.gauss;
        secondary = fmt(r.tesla, 4) + ' ' + u.tesla;
      } else if (state.calculator === 'moment') {
        primary = fmt(r.am2, 4) + ' ' + u.am2;
        secondary = fmt(r.gaussCm3, 1) + ' ' + u.gaussCm3;
      } else {
        primary = fmt(r.kgf, 2) + ' ' + u.kgf;
        secondary = fmt(r.newton, 2) + ' ' + u.newton + ' · ' + fmt(r.lbf, 2) + ' ' + u.lbf;
      }
      out.innerHTML = '<div class="hpmc__outlabel">' + T.results[state.calculator] + '</div>' +
        '<div class="hpmc__big">' + primary + '</div>' +
        '<div class="hpmc__sub">' + secondary + '</div>' +
        '<div class="hpmc__extras">' +
          '<span>' + T.extra.flux + ' <b>' + fmt(r.fluxMw, 4) + '</b> ' + u.mwb + '</span>' +
          '<span>' + T.extra.weight + ' <b>' + fmt(r.weightG, 2) + '</b> ' + u.gram + '</span>' +
          '<span>' + T.extra.area + ' <b>' + fmt(r.areaMm2, 1) + '</b> ' + u.mm2 + '</span>' +
          '<span>' + T.extra.volume + ' <b>' + fmt(r.volumeMm3, 1) + '</b> ' + u.mm3 + '</span>' +
        '</div>';
      return r;
    }

    function renderAll() {
      renderCalcRow();
      renderShapeRow();
      renderForm();
      renderResult();
    }

    btn.addEventListener('click', function () {
      var r = renderResult();
      if (typeof opts.onResult === 'function' && r) opts.onResult(r);
    });

    renderAll();

    return {
      state: state,
      recalc: renderResult,
      set: function (patch) {
        Object.keys(patch || {}).forEach(function (k) { state[k] = patch[k]; });
        renderAll();
      },
      element: host
    };
  }

  var UI = { version: '1.2.1', mount: mount, lang: LANG };
  global.HPMagnetCalcUI = UI;
  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
})(typeof window !== 'undefined' ? window : globalThis);
