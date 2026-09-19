/*!
 * HP Magnet Calculator — core engine
 * Pure computation, no DOM dependency. Safe to require from any page.
 * v1.1.1 · 2026-09-19
 */
(function (global) {
  'use strict';

  var MU0 = 4 * Math.PI * 1e-7;

  var FALLBACK = {
    materials: {
      ndfeb: { name: 'Sintered NdFeB', density: 7.5 },
      smco: { name: 'Sintered SmCo', density: 8.4 }
    },
    grades: {
      ndfeb: {
        N35: { Br: 1.17 }, N38: { Br: 1.22 }, N40: { Br: 1.26 }, N42: { Br: 1.29 },
        N45: { Br: 1.33 }, N48: { Br: 1.37 }, N50: { Br: 1.42 }, N52: { Br: 1.45 }
      },
      smco: {
        SmCo24: { Br: 1.05 }, SmCo26: { Br: 1.07 }, SmCo28: { Br: 1.10 }
      }
    },
    correction: { surfaceField: 1.0 },
    units: { newtonPerKgf: 9.80665, newtonPerLbf: 4.44822, gaussPerTesla: 10000 }
  };

  var CONFIG = FALLBACK;

  function setConfig(cfg) {
    if (cfg && typeof cfg === 'object') CONFIG = cfg;
    return CONFIG;
  }

  function getConfig() { return CONFIG; }

  function unit(key) {
    var u = CONFIG.units || FALLBACK.units;
    return u[key];
  }

  function correction() {
    var c = CONFIG.correction && CONFIG.correction.surfaceField;
    return (typeof c === 'number') ? c : FALLBACK.correction.surfaceField;
  }

  function remanence(material, grade) {
    var m = (CONFIG.grades && CONFIG.grades[material]) || FALLBACK.grades.ndfeb;
    var g = m[grade];
    if (!g) throw new Error('Unknown grade: ' + grade);
    return g.Br;
  }

  /* ---------- geometry: areas and volumes in SI ---------- */

  function assertPositive(name, v) {
    if (typeof v !== 'number' || !isFinite(v) || v <= 0) {
      throw new Error(name + ' must be a positive number');
    }
  }

  function assertRing(ro, ri) {
    if (typeof ri !== 'number' || !isFinite(ri) || ri < 0) {
      throw new Error('Bore d must be zero or a positive number');
    }
    if (ri >= ro) {
      throw new Error('Bore d must be smaller than outer diameter D');
    }
  }

  function areaM2(shape, d) {
    if (shape === 'block') {
      assertPositive('Length L', d.L);
      assertPositive('Width W', d.W);
      return (d.L * d.W) * 1e-6;
    }
    if (shape === 'disc') {
      assertPositive('Diameter D', d.D);
      return Math.PI * (d.D / 2) * (d.D / 2) * 1e-6;
    }
    if (shape === 'ring') {
      assertPositive('Outer diameter D', d.D);
      var ro = d.D / 2, ri = d.d / 2;
      assertRing(ro, ri);
      return Math.PI * (ro * ro - ri * ri) * 1e-6;
    }
    throw new Error('Unknown shape: ' + shape);
  }

  function volumeM3(shape, d) {
    assertPositive('Thickness T', d.T);
    if (shape === 'block') {
      assertPositive('Length L', d.L);
      assertPositive('Width W', d.W);
      return (d.L * d.W * d.T) * 1e-9;
    }
    if (shape === 'disc') {
      assertPositive('Diameter D', d.D);
      return Math.PI * (d.D / 2) * (d.D / 2) * d.T * 1e-9;
    }
    if (shape === 'ring') {
      assertPositive('Outer diameter D', d.D);
      var ro = d.D / 2, ri = d.d / 2;
      assertRing(ro, ri);
      return Math.PI * (ro * ro - ri * ri) * d.T * 1e-9;
    }
    throw new Error('Unknown shape: ' + shape);
  }

  /* ---------- surface field (Gauss, on-axis at pole face) ---------- */

  function discFieldGauss(D, T, Br) {
    var R = D / 2;
    return (Br / 2) * (T / Math.sqrt(R * R + T * T)) * 1e4;
  }

  function blockFieldGauss(L, W, T, Br) {
    // Strict on-axis solution at the pole face (magnetic-charge / solid-angle model):
    //   B = (Br/2) * [ 1 - (2/pi)*atan( LW / (2T*sqrt(4T^2+L^2+W^2)) ) ]
    // Limits checked: T->0 => 0 (thin plate cannot hold field), T->inf => Br/2 (long prism).
    var a = (L * W) / (2 * T * Math.sqrt(4 * T * T + L * L + W * W));
    return (Br / 2) * (1 - (2 / Math.PI) * Math.atan(a)) * 1e4;
  }

  function surfaceFieldGauss(shape, d, Br, applyCorrection) {
    assertPositive('Thickness T', d.T);
    var B;
    if (shape === 'block') {
      assertPositive('Length L', d.L);
      assertPositive('Width W', d.W);
      B = blockFieldGauss(d.L, d.W, d.T, Br);
    } else if (shape === 'disc') {
      assertPositive('Diameter D', d.D);
      B = discFieldGauss(d.D, d.T, Br);
    } else if (shape === 'ring') {
      assertPositive('Outer diameter D', d.D);
      var ro = d.D / 2, ri = d.d / 2;
      assertRing(ro, ri);
      var Ao = Math.PI * (d.D / 2) * (d.D / 2);
      var Ai = Math.PI * (d.d / 2) * (d.d / 2);
      B = discFieldGauss(d.D, d.T, Br) * ((Ao - Ai) / Ao);
    } else {
      throw new Error('Unknown shape: ' + shape);
    }
    if (applyCorrection === false) return B;
    return B * correction();
  }

  /* ---------- magnetic moment (A·m^2) ---------- */

  function momentAm2(shape, d, Br) {
    var M = Br / MU0;
    return M * volumeM3(shape, d);
  }

  /* ---------- material helpers ---------- */

  function density(material) {
    var m = (CONFIG.materials && CONFIG.materials[material]) || FALLBACK.materials.ndfeb;
    return (typeof m.density === 'number') ? m.density : 7.5; // g/cm^3
  }

  function materialName(material) {
    var m = (CONFIG.materials && CONFIG.materials[material]) || FALLBACK.materials.ndfeb;
    return m.name || material;
  }

  /* ---------- flux through the pole face (milliWeber) ---------- */

  function fluxMilliWeber(shape, d, Bg) {
    var BT = Bg / 1e4;
    return BT * areaM2(shape, d) * 1000; // Wb -> mWb
  }

  /* ---------- weight (gram) ---------- */

  function weightGram(shape, d, material) {
    var volCm3 = volumeM3(shape, d) * 1e6;
    return volCm3 * density(material);
  }

  /* ---------- pull force (Newton, Maxwell stress + image method) ---------- */

  function pullForceNewton(shape, d, Br) {
    var Bg = surfaceFieldGauss(shape, d, Br);
    var BT = Bg / 1e4;
    return 2 * BT * BT * areaM2(shape, d) / MU0;
  }

  /* ---------- unit conversion ---------- */

  function toKgf(n) { return n / unit('newtonPerKgf'); }
  function toLbf(n) { return n / unit('newtonPerLbf'); }
  function toGaussFromTesla(t) { return t * unit('gaussPerTesla'); }
  function toGaussCm3FromAm2(a) { return a * 1000; }

  /* ---------- one-shot convenience: run any calculator ---------- */

  function run(kind, material, grade, shape, dims) {
    var Br = remanence(material, grade);
    var Bg = surfaceFieldGauss(shape, dims, Br);
    var out = {
      kind: kind, material: material, grade: grade, shape: shape, Br: Br,
      gauss: Bg,
      tesla: Bg / 1e4,
      areaMm2: areaM2(shape, dims) * 1e6,
      volumeMm3: volumeM3(shape, dims) * 1e9,
      fluxMw: fluxMilliWeber(shape, dims, Bg),
      weightG: weightGram(shape, dims, material)
    };
    if (kind === 'surfaceField') {
      /* gauss / tesla already populated above */
    } else if (kind === 'moment') {
      out.am2 = momentAm2(shape, dims, Br);
      out.gaussCm3 = toGaussCm3FromAm2(out.am2);
    } else if (kind === 'pullForce') {
      out.newton = pullForceNewton(shape, dims, Br);
      out.kgf = toKgf(out.newton);
      out.lbf = toLbf(out.newton);
    } else {
      throw new Error('Unknown calculator: ' + kind);
    }
    return out;
  }

  var API = {
    version: '1.1.1',
    MU0: MU0,
    setConfig: setConfig,
    getConfig: getConfig,
    remanence: remanence,
    density: density,
    materialName: materialName,
    areaM2: areaM2,
    volumeM3: volumeM3,
    surfaceFieldGauss: surfaceFieldGauss,
    fluxMilliWeber: fluxMilliWeber,
    weightGram: weightGram,
    momentAm2: momentAm2,
    pullForceNewton: pullForceNewton,
    toKgf: toKgf,
    toLbf: toLbf,
    toGaussFromTesla: toGaussFromTesla,
    toGaussCm3FromAm2: toGaussCm3FromAm2,
    run: run
  };

  global.HPMagnetCalc = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
