/* ===========================================================
   Huapeng Magnetics — shared pricing engine (V5 three-tier)
   -----------------------------------------------------------
   PRICE LADDER (agreed with sales, Sep 2026):

     [1] EXW (China)  = published list rate × mass(kg) ÷ FX
                         × grade × coating × qty    ← shown to customers

     [2] FOB (Ningbo) ≈ EXW + export charges      ← shown to customers
                      export charges are billed PER SHIPMENT, not per kg:
                      RMB 1,500 covers customs declaration + Ningbo port
                      charges + Cixi→Ningbo trucking, however heavy the
                      shipment is. Per-piece share = 1500 ÷ qty ÷ FX.
                      FOB is quoted from FOB_MIN_QTY pcs up only — below
                      that the per-piece share dwarfs the magnet itself
                      (at 1,000 pcs it is ~USD 0.22/pc), so those tiers
                      show EXW only.

   Exchange rate loaded live from exchangerate-api.com.
   QUOTED PRICES FLOAT: final price is fixed at the USD/CNY market
   rate on the date the deposit is received.
   =========================================================== */
(function () {
  "use strict";

  /* ---------- Pricing constants ----------
     EXW_CNY_PER_KG is the published EXW list rate: RMB per kg of sintered
     NdFeB at grade N35 / nickel coating / entry quantity tier, before the
     USD conversion. Everything that used to be itemised on its own —
     material, conversion, freight, tax and margin — sits inside this single
     figure, so no cost breakdown can be read off this file.

     It is the only knob: move this number to move prices. */
  var EXW_CNY_PER_KG = 593.9505;
  var DENSITY_G_CM3 = 7.5;    // sintered NdFeB density
  var DEFAULT_EXCHANGE = 6.71; // USD/CNY fallback (updated Sep 2026)
  var RATE_API = "https://api.exchangerate-api.com/v4/latest/USD";

  /* ---------- FOB uplift: billed PER SHIPMENT (revised 19 Sep 2026) ----------
     One shipment = customs declaration + Ningbo port charges (THC / docs /
     handling) + Cixi→Ningbo trucking ≈ RMB 1,500 total, no matter how heavy.
     Sources: Ningbo port tariff sheet (Zhejiang Single Window), Cixi→Ningbo
     container trucking rate sheet, and the FOB cost breakdown held in the
     company knowledge base (port charges ≈ 900–1,000 CNY/shipment + trucking).
     → If the forwarder's invoice differs, this ONE constant is the knob. */
  var FOB_FIXED_FEE_CNY = 1500;

  /* Below this quantity we publish EXW only. At 1,000 pcs the RMB 1,500
     shipment fee works out to ~USD 0.22/pc — more than the magnet itself —
     so an FOB figure there would mislead rather than inform. */
  var FOB_MIN_QTY = 50000;

  var currentExchange = DEFAULT_EXCHANGE;

  /* Quantity discount tiers (revised 19 Sep 2026).
     The old uniform 5% ladder (-5/-10/-15%) is withdrawn: the trading
     company margin is now capped at 10%, so deep volume rebates can no
     longer be given away on the spot. Discounts are deliberately shallow
     and must stay inside the 10% envelope.

       1K   → no discount  (ships by UPS/DHL express, freight collect)
       50K  → -2%
       100K → -4%
       500K → -5% */
  var QTY_FACTORS = {
    1000: 1.00,
    50000: 0.98,
    100000: 0.96,
    500000: 0.95
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
   * EXW China unit price in USD — the figure customers are shown.
   * Returns null for shapes that cannot be auto-priced (arc / custom / assembly).
   */
  function estimatedUnitPrice(shape, dims, grade, coating, qty) {
    if (shape === "arc" || shape === "assembly" || shape === "custom") return null;

    var item = { shape: shape, d: dims.d, l: dims.l, w: dims.w, h: dims.h, hole: dims.hole };
    var m = massKg(item);
    if (!m || m <= 0) return null;

    var baseUsd = EXW_CNY_PER_KG * m / currentExchange;
    var gradeFactor = GRADE_FACTORS[grade] || 1;
    var coatFactor = COATING_FACTORS[coating || "nickel"] || 1;
    var qtyFactor = QTY_FACTORS[qty] || 1;

    return Math.max(baseUsd * gradeFactor * coatFactor * qtyFactor, 0.001);
  }

  function estimatedPrice10k(shape, dims, coating) {
    return estimatedUnitPrice(shape, dims, "N35", coating || "nickel", 10000);
  }

  /* ---------- Price ladder helpers ----------
     EXW / FOB → customer-facing. */

  /* Per-piece share of the per-shipment export fee (RMB → USD). */
  function exportFeeUsd(qty) {
    if (!qty || qty <= 0) return 0;
    return FOB_FIXED_FEE_CNY / qty / currentExchange;
  }

  /* Whole-shipment export fee in CNY — for order-level totals and notes. */
  function exportFeeCnyTotal() { return FOB_FIXED_FEE_CNY; }

  /* Is FOB quoted at this quantity? */
  function isFobQuoted(qty) { return !!qty && qty >= FOB_MIN_QTY; }

  /* EXW China unit price — the customer-facing figure. */
  function exwUnitPrice(shape, dims, grade, coating, qty) {
    return estimatedUnitPrice(shape, dims, grade, coating, qty);
  }

  /* FOB Ningbo: EXW + per-piece share of the shipment fee.
     Returns null below FOB_MIN_QTY — callers must fall back to EXW. */
  function fobUnitPrice(shape, dims, grade, coating, qty) {
    if (!isFobQuoted(qty)) return null;
    var exw = exwUnitPrice(shape, dims, grade, coating, qty);
    if (exw === null) return null;
    return exw + exportFeeUsd(qty);
  }

  /* Full ladder for one spec — handy for cards and tables.
     Carries EXW and FOB only; the internal cost layer is never returned. */
  function priceLadder(shape, dims, grade, coating, qty) {
    var exw = estimatedUnitPrice(shape, dims, grade, coating, qty);
    if (exw === null) return null;
    var quoted = isFobQuoted(qty);
    return {
      exw: exw,
      fob: quoted ? exw + exportFeeUsd(qty) : null,
      fobQuoted: quoted,
      exportFeeShare: exportFeeUsd(qty),
      shipmentFeeCny: FOB_FIXED_FEE_CNY
    };
  }

  function rateInfo() {
    return {
      rate: currentExchange,
      isLive: currentExchange !== DEFAULT_EXCHANGE,
      fallback: DEFAULT_EXCHANGE,
      updatedAt: window._rateLastUpdated || null
    };
  }

  function loadExchangeRate() {
    return fetch(RATE_API)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.rates && data.rates.CNY) {
          currentExchange = parseFloat(data.rates.CNY);
          window._rateLastUpdated = new Date().toISOString();
        } else {
          throw new Error("No CNY rate");
        }
      })
      .catch(function (e) {
        console.warn("Exchange rate API failed, using fallback:", e.message);
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
    DENSITY_G_CM3: DENSITY_G_CM3,
    DEFAULT_EXCHANGE: DEFAULT_EXCHANGE,
    FOB_FIXED_FEE_CNY: FOB_FIXED_FEE_CNY,
    FOB_MIN_QTY: FOB_MIN_QTY,
    currentExchange: function () { return currentExchange; },
    rateInfo: rateInfo,
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
    exportFeeUsd: exportFeeUsd,
    exportFeeCnyTotal: exportFeeCnyTotal,
    isFobQuoted: isFobQuoted,
    exwUnitPrice: exwUnitPrice,
    fobUnitPrice: fobUnitPrice,
    priceLadder: priceLadder,
    specString: specString,
    coatingLabel: coatingLabel
  };
})();
