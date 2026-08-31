/* ===========================================================
   Huapeng Magnetics — shared pricing engine (V3 cost-based)
   Formula: effective cost (CNY/kg) × mass (kg) × 1.56 ÷ live exchange rate
   1.56 = 1.20 (shipping) × 1.30 (margin) × 1.09 (tax)
   Exchange rate loaded live from exchangerate-api.com
   =========================================================== */
(function () {
  "use strict";

  /* ---------- V3 constants ----------
     Effective N35 cost benchmark tuned to match the V3 report display prices.
     Base material 162.93 CNY/kg + machining/loss allowance ≈ 177.5 CNY/kg. */
  var COST_CNY_KG = 177.5 * 1.5 * 1.3;    // effective N35 cost benchmark (raised +50%, then +30%)
  var DENSITY_G_CM3 = 7.5;    // sintered NdFeB density
  var MARKUP = 1.56;          // shipping + margin + tax combined
  var DEFAULT_EXCHANGE = 7.2; // USD/CNY fallback
  var RATE_API = "https://api.exchangerate-api.com/v4/latest/USD";

  var currentExchange = DEFAULT_EXCHANGE;

  /* Quantity discount tiers (uniform 5% steps, no small-order surcharge):
     1K   → -5% discount
     50K  → -10% discount
     500K → -15% discount */
  var QTY_FACTORS = {
    1000: 0.95,
    50000: 0.90,
    500000: 0.85
  };

  var COATING_FACTORS = {
    nickel: 1.000,
    zinc: 0.995,
    epoxy: 1.050,
    gold: 1.200
  };

  var GRADE_FACTORS = {
    "N35": 1.00,
    "N38": 1.05,
    "N40": 1.12,
    "N42": 1.20,
    "N45": 1.30,
    "N48": 1.45,
    "N50": 1.60,
    "N52": 1.80
  };

  var GRADES = [
    { grade: "N35", br: "11.7–12.1", hcj: "≥12.0", bhmax: "33–36", temp: "80°C", use: "General-purpose holding, sensors, consumer electronics" },
    { grade: "N38", br: "12.2–12.6", hcj: "≥12.0", bhmax: "36–39", temp: "80°C", use: "Higher holding force, magnetic closures, DC motors" },
    { grade: "N40", br: "12.6–12.9", hcj: "≥12.0", bhmax: "38–41", temp: "80°C", use: "Motors, generators, high-performance assemblies" },
    { grade: "N42", br: "13.0–13.2", hcj: "≥12.0", bhmax: "40–43", temp: "80°C", use: "Industrial motors, magnetic separators, sensors" },
    { grade: "N45", br: "13.3–13.7", hcj: "≥12.0", bhmax: "43–46", temp: "80°C", use: "Premium motors, audio drivers, medical devices" },
    { grade: "N48", br: "13.8–14.2", hcj: "≥11.0", bhmax: "46–49", temp: "80°C", use: "High-end motors, aerospace, precision instruments" },
    { grade: "N50", br: "14.1–14.5", hcj: "≥11.0", bhmax: "48–51", temp: "80°C", use: "Maximum energy product for compact designs" },
    { grade: "N52", br: "14.4–14.8", hcj: "≥11.0", bhmax: "50–53", temp: "80°C", use: "Extreme performance, research, specialty motors" }
  ];

  /* ---------- Utilities ---------- */
  function fmt$(n) { return "$" + n.toFixed(3).replace(/\.?0+$/, ""); }
  function fmtNum(n) { return n.toLocaleString("en-US"); }

  function volume(item) {
    if (item.shape === "disc") return Math.PI * Math.pow(item.d / 2, 2) * item.h;
    if (item.shape === "block" || item.shape === "cube") return item.l * item.w * item.h;
    if (item.shape === "ring") return Math.PI * (Math.pow(item.d / 2, 2) - Math.pow(item.hole / 2, 2)) * item.h;
    return 0;
  }

  function massKg(item) {
    var vMm3 = volume(item);
    if (!vMm3 || vMm3 <= 0) return 0;
    var vCm3 = vMm3 / 1000;          // mm³ → cm³
    var grams = vCm3 * DENSITY_G_CM3;
    return grams / 1000;             // g → kg
  }

  /*
   * V3 cost-based unit price.
   * Returns null for shapes that cannot be auto-priced (arc / custom / assembly).
   */
  function estimatedUnitPrice(shape, dims, grade, coating, qty) {
    if (shape === "arc" || shape === "assembly" || shape === "custom") return null;

    var item = { shape: shape, d: dims.d, l: dims.l, w: dims.w, h: dims.h, hole: dims.hole };
    var m = massKg(item);
    if (!m || m <= 0) return null;

    var baseUsd = COST_CNY_KG * m * MARKUP / currentExchange;
    var gradeFactor = GRADE_FACTORS[grade] || 1;
    var coatFactor = COATING_FACTORS[coating || "nickel"] || 1;
    var qtyFactor = QTY_FACTORS[qty] || 1;

    return Math.max(baseUsd * gradeFactor * coatFactor * qtyFactor, 0.001);
  }

  function estimatedPrice10k(shape, dims, coating) {
    return estimatedUnitPrice(shape, dims, "N35", coating || "nickel", 10000);
  }

  function loadExchangeRate() {
    return fetch(RATE_API)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.rates && data.rates.CNY) {
          currentExchange = parseFloat(data.rates.CNY);
        } else {
          throw new Error("No CNY rate");
        }
      })
      .catch(function () {
        currentExchange = DEFAULT_EXCHANGE;
      });
  }

  function specString(shape, dims) {
    if (shape === "disc") return "D" + dims.d + " × " + dims.h + " mm";
    if (shape === "block" || shape === "cube") return dims.l + " × " + dims.w + " × " + dims.h + " mm";
    if (shape === "ring") return "D" + dims.d + " × " + dims.h + " mm, hole D" + dims.hole + " mm";
    if (shape === "arc") return dims.l + " × " + dims.w + " × " + dims.h + " mm, angle " + (dims.angle || "?") + "°";
    return "";
  }

  function coatingLabel(c) {
    return { nickel: "Ni-Cu-Ni", zinc: "Zinc", epoxy: "Epoxy", gold: "Gold" }[c] || c;
  }

  window.HPPricing = {
    COST_CNY_KG: COST_CNY_KG,
    DENSITY_G_CM3: DENSITY_G_CM3,
    MARKUP: MARKUP,
    DEFAULT_EXCHANGE: DEFAULT_EXCHANGE,
    currentExchange: function () { return currentExchange; },
    loadExchangeRate: loadExchangeRate,
    QTY_FACTORS: QTY_FACTORS,
    COATING_FACTORS: COATING_FACTORS,
    GRADE_FACTORS: GRADE_FACTORS,
    GRADES: GRADES,
    fmt$: fmt$,
    fmtNum: fmtNum,
    volume: volume,
    massKg: massKg,
    estimatedUnitPrice: estimatedUnitPrice,
    estimatedPrice10k: estimatedPrice10k,
    specString: specString,
    coatingLabel: coatingLabel
  };
})();
