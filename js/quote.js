/* ===========================================================
   Huapeng Magnetics — Quotation page
   =========================================================== */
(function () {
  "use strict";

  var DEFAULT_RATE = 7.2;
  var rate = DEFAULT_RATE;
  var RATE_API = "https://api.exchangerate-api.com/v4/latest/USD";
  var FORMS_ENDPOINT = "https://huapeng-magnet.com";
  var lastQuote = null;

  /* ---------- Base N35 nickel-coated prices (from price list) ---------- */
  var BASE_PRICES = [
    { spec: "D5 × 1 mm", shape: "disc", d: 5, l: null, w: null, h: 1, hole: null, price10k: 0.021 },
    { spec: "D8 × 2 mm", shape: "disc", d: 8, l: null, w: null, h: 2, hole: null, price10k: 0.055 },
    { spec: "D10 × 2 mm", shape: "disc", d: 10, l: null, w: null, h: 2, hole: null, price10k: 0.084 },
    { spec: "D12 × 3 mm", shape: "disc", d: 12, l: null, w: null, h: 3, hole: null, price10k: 0.173 },
    { spec: "D15 × 3 mm", shape: "disc", d: 15, l: null, w: null, h: 3, hole: null, price10k: 0.277 },
    { spec: "D20 × 5 mm", shape: "disc", d: 20, l: null, w: null, h: 5, hole: null, price10k: 0.818 },
    { spec: "10 × 5 × 2 mm", shape: "block", d: null, l: 10, w: 5, h: 2, hole: null, price10k: 0.055 },
    { spec: "20 × 10 × 3 mm", shape: "block", d: null, l: 20, w: 10, h: 3, hole: null, price10k: 0.299 },
    { spec: "20 × 10 × 5 mm", shape: "block", d: null, l: 20, w: 10, h: 5, hole: null, price10k: 0.479 },
    { spec: "D20 × 5 mm ring D8", shape: "ring", d: 20, l: null, w: null, h: 5, hole: 8, price10k: 0.746 }
  ];

  /* Quantity discount tiers (3 tiers only):
     1K   → +20% surcharge (small order premium)
     50K  → -5% discount
     500K → -15% discount */
  var QTY_FACTORS = {
    1000: 1.20,
    50000: 0.95,
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

  /* V3 cost-based constants */
  var COST_CNY_KG = 177.5 * 1.5;    // effective N35 cost benchmark (prices raised +50%)
  var DENSITY_G_CM3 = 7.5;    // sintered NdFeB density
  var MARKUP = 1.56;          // 1.20 shipping × 1.30 margin × 1.09 tax
  var EXCHANGE = 7.2;         // USD/CNY

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
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function volume(item) {
    if (item.shape === "disc") return Math.PI * Math.pow(item.d / 2, 2) * item.h;
    if (item.shape === "block") return item.l * item.w * item.h;
    if (item.shape === "ring") return Math.PI * (Math.pow(item.d / 2, 2) - Math.pow(item.hole / 2, 2)) * item.h;
    return 0;
  }

  function massKg(item) {
    var vMm3 = volume(item);
    if (!vMm3 || vMm3 <= 0) return 0;
    var vCm3 = vMm3 / 1000;
    return vCm3 * DENSITY_G_CM3 / 1000;
  }

  function estimatedUnitPrice(shape, dims, grade, coating, qty) {
    if (shape === "arc" || shape === "custom") return null;

    var item;
    if (shape === "disc") item = { shape: "disc", d: dims.d, h: dims.h };
    else if (shape === "block") item = { shape: "block", l: dims.l, w: dims.w, h: dims.h };
    else if (shape === "ring") item = { shape: "ring", d: dims.d, h: dims.h, hole: dims.hole };
    else return null;

    var m = massKg(item);
    if (!m || m <= 0) return null;

    var baseUsd = COST_CNY_KG * m * MARKUP / rate;
    var gradeFactor = GRADE_FACTORS[grade] || 1;
    var coatFactor = COATING_FACTORS[coating || "nickel"] || 1;
    var qtyFactor = QTY_FACTORS[qty] || 1;

    return Math.max(baseUsd * gradeFactor * coatFactor * qtyFactor, 0.001);
  }

  function estimatedPrice10k(shape, dims, coating) {
    return estimatedUnitPrice(shape, dims, "N35", coating || "nickel", 10000);
  }

  /* ---------- Exchange rate ---------- */
  function loadRate() {
    var elValue = document.getElementById("rateValue");
    var elSource = document.getElementById("rateSource");

    fetch(RATE_API)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.rates && data.rates.CNY) {
          rate = parseFloat(data.rates.CNY);
          if (elValue) elValue.textContent = rate.toFixed(4);
          if (elSource) elSource.textContent = "Live market rate · updated " + new Date(data.time_last_updated * 1000).toLocaleString("en-US", { hour: "2-digit", minute: "2-digit" });
          var activeFilterBtn = document.querySelector("#tableFilter button.is-active");
          renderPriceTable(activeFilterBtn ? activeFilterBtn.getAttribute("data-filter") : "all");
          calculate();
        } else {
          throw new Error("No CNY rate");
        }
      })
      .catch(function () {
        rate = DEFAULT_RATE;
        if (elValue) elValue.textContent = rate.toFixed(2);
        if (elSource) elSource.textContent = "Fallback rate (API unavailable)";
      });
  }

  /* ---------- Dynamic dimensions ---------- */
  var dimWrap = document.getElementById("qDims");
  var shapeSel = document.getElementById("qShape");

  function renderDims() {
    if (!dimWrap) return;
    var shape = shapeSel.value;
    var html = "";

    if (shape === "disc") {
      html += dimInput("qD", "Diameter (mm)", 10, 0.1, 200, 10);
      html += dimInput("qH", "Thickness (mm)", 2, 0.1, 50, 2);
    } else if (shape === "block") {
      html += dimInput("qL", "Length (mm)", 20, 0.1, 200, 20);
      html += dimInput("qW", "Width (mm)", 10, 0.1, 200, 10);
      html += dimInput("qH", "Thickness (mm)", 3, 0.1, 50, 3);
    } else if (shape === "ring") {
      html += dimInput("qD", "Outer Diameter (mm)", 20, 0.1, 200, 20);
      html += dimInput("qHole", "Hole Diameter (mm)", 8, 0.1, 190, 8);
      html += dimInput("qH", "Thickness (mm)", 5, 0.1, 50, 5);
    } else {
      html = '<div class="field field--full">' +
        '<p class="muted">Arc, segment and custom shapes are quoted manually. Please <a href="index.html#contact">contact sales</a> with a drawing or sample.</p>' +
        '</div>';
    }
    dimWrap.innerHTML = html;
  }

  function dimInput(id, label, value, min, max, placeholder) {
    return '<div class="field">' +
      '<label for="' + id + '">' + label + '</label>' +
      '<input type="number" id="' + id + '" min="' + min + '" max="' + max + '" step="0.1" value="' + value + '" placeholder="' + placeholder + '" required>' +
      '</div>';
  }

  function getDims() {
    var shape = shapeSel.value;
    var val = function (id) { return parseFloat(document.getElementById(id).value) || 0; };
    if (shape === "disc") return { d: val("qD"), h: val("qH") };
    if (shape === "block") return { l: val("qL"), w: val("qW"), h: val("qH") };
    if (shape === "ring") return { d: val("qD"), hole: val("qHole"), h: val("qH") };
    return {};
  }

  /* ---------- Calculator ---------- */
  var resultBox = document.getElementById("calcResult");

  function calculate(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!resultBox) return;

    var grade = document.getElementById("qGrade").value;
    var shape = shapeSel.value;
    var coating = document.getElementById("qCoating").value;
    var qty = parseInt(document.getElementById("qQty").value, 10);

    if (shape === "arc" || shape === "custom") {
      resultBox.innerHTML = requestQuoteHTML(shape + " shape", "Arc, segment and irregular shapes require drawings and magnetization direction. Request a manual quote.");
      return;
    }

    var dims = getDims();
    var unitUsd = estimatedUnitPrice(shape, dims, grade, coating, qty);
    if (!unitUsd) {
      resultBox.innerHTML = requestQuoteHTML("custom dimensions", "We cannot estimate this geometry automatically. Send us the dimensions for a manual quote.");
      return;
    }

    var totalUsd = unitUsd * qty;

    var specText = specString(shape, dims, coating);
    lastQuote = { grade: grade, shape: shape, coating: coating, qty: qty, dims: dims, specText: specText, unitUsd: unitUsd, totalUsd: totalUsd };

    resultBox.innerHTML =
      '<div class="calc-result__head">' +
        '<span class="calc-result__label">Unit Price</span>' +
        '<strong class="calc-result__price">' + fmt$(unitUsd) + '</strong>' +
        '<span class="calc-result__sub">Tax included</span>' +
      '</div>' +
      '<div class="calc-result__body">' +
        '<div><span>Quantity</span><strong>' + fmtNum(qty) + ' pcs</strong></div>' +
        '<div><span>Total Estimate</span><strong>' + fmt$(totalUsd) + '</strong></div>' +
        '<div><span>Spec</span><strong>' + specText + '</strong></div>' +
        '<div><span>Grade</span><strong>' + grade + '</strong></div>' +
        '<div><span>Coating</span><strong>' + coatingLabel(coating) + '</strong></div>' +
      '</div>' +
      '<p class="calc-result__note">Estimated USD price for reference — prices are quoted directly in USD, no extra currency conversion applied. Final quote depends on tolerance, magnetization direction, packing and shipping.</p>' +
      quoteFormHTML();
  }

  function specString(shape, dims, coating) {
    if (shape === "disc") return "D" + dims.d + " × " + dims.h + " mm";
    if (shape === "block") return dims.l + " × " + dims.w + " × " + dims.h + " mm";
    if (shape === "ring") return "D" + dims.d + " × " + dims.h + " mm, hole D" + dims.hole + " mm";
    return "";
  }

  /* ---------- Quote request form ---------- */
  function buildSpecText() {
    if (!lastQuote) return "";
    var s = "Quote request from calculator:\n";
    s += "Grade: " + lastQuote.grade + "\n";
    s += "Shape: " + lastQuote.shape.charAt(0).toUpperCase() + lastQuote.shape.slice(1) + "\n";
    s += "Spec: " + lastQuote.specText + "\n";
    s += "Coating: " + coatingLabel(lastQuote.coating) + "\n";
    s += "Quantity: " + fmtNum(lastQuote.qty) + " pcs";
    if (lastQuote.unitUsd) {
      s += "\nUnit price: " + fmt$(lastQuote.unitUsd) + "/pc";
      s += "\nTotal estimate: " + fmt$(lastQuote.totalUsd);
    }
    return s;
  }

  function quoteFormHTML() {
    return '<div class="quote-request">' +
      '<h3>Request this quote</h3>' +
      '<p>Leave your contact details and we will confirm price, coating, tolerance and lead time by email.</p>' +
      '<form id="quoteRequestForm" class="quote-request__form">' +
        '<div class="field-row">' +
          '<div class="field"><label for="qrName">Name *</label><input type="text" id="qrName" name="name" required></div>' +
          '<div class="field"><label for="qrEmail">Email *</label><input type="email" id="qrEmail" name="email" required></div>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="qrCompany">Company</label><input type="text" id="qrCompany" name="company"></div>' +
          '<div class="field"><label for="qrCountry">Country</label><input type="text" id="qrCountry" name="country"></div>' +
        '</div>' +
        '<div class="field field--full"><label for="qrNotes">Notes / special requests</label><textarea id="qrNotes" name="notes" rows="2" placeholder="Tolerance, magnetization direction, packing, shipping terms..."></textarea></div>' +
        '<button type="submit" class="btn btn--primary btn--wide">Send Quote Request</button>' +
      '</form>' +
    '</div>';
  }

  function submitQuoteRequest(form) {
    var payload = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      company: form.elements.company.value.trim(),
      country: form.elements.country.value.trim(),
      spec: buildSpecText() + (form.elements.notes.value.trim() ? "\n\nNotes: " + form.elements.notes.value.trim() : "")
    };
    var btn = form.querySelector("button[type=submit]");
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    fetch(FORMS_ENDPOINT + "/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          form.innerHTML = '<p class="quote-request__success">✅ Quote request sent! We will reply to ' + payload.email + ' within 1 business day.</p>';
        } else {
          alert("Submit failed. Please try again or email info@huapeng-magnet.com");
          if (btn) { btn.disabled = false; btn.textContent = "Send Quote Request"; }
        }
      })
      .catch(function () {
        alert("Network error. Please try again or email info@huapeng-magnet.com");
        if (btn) { btn.disabled = false; btn.textContent = "Send Quote Request"; }
      });
  }

  function coatingLabel(c) {
    return { nickel: "Nickel", zinc: "Zinc" }[c] || c;
  }

  function requestQuoteHTML(title, msg) {
    var grade = document.getElementById("qGrade").value;
    var shape = shapeSel.value;
    var coating = document.getElementById("qCoating").value;
    var qty = parseInt(document.getElementById("qQty").value, 10);
    var dims = getDims();
    lastQuote = { grade: grade, shape: shape, coating: coating, qty: qty, dims: dims, specText: specString(shape, dims), unitUsd: null, totalUsd: null };
    return '<div class="calc-result__request">' +
      '<h3>Request a Quote</h3>' +
      '<p><strong>' + title + '</strong></p>' +
      '<p>' + msg + '</p>' +
      quoteFormHTML() +
    '</div>';
  }

  /* ---------- Price table ---------- */
  function renderPriceTable(filter) {
    var tbody = document.getElementById("priceTableBody");
    if (!tbody) return;

    var rows = BASE_PRICES.filter(function (b) { return filter === "all" || b.shape === filter; });

    tbody.innerHTML = rows.map(function (b) {
      var base = estimatedPrice10k(b.shape, b, "nickel");
      var p1k = base * QTY_FACTORS[1000];
      var p50k = base * QTY_FACTORS[50000];
      var p500k = base * QTY_FACTORS[500000];
      var dims = [];
      if (b.shape === "disc") dims.push("D" + b.d, "T" + b.h);
      if (b.shape === "block") dims.push(b.l + "×" + b.w, "T" + b.h);
      if (b.shape === "ring") dims.push("D" + b.d, "T" + b.h, "hole D" + b.hole);

      return '<tr data-shape="' + b.shape + '">' +
        '<td>' + b.spec + '</td>' +
        '<td>' + b.shape.charAt(0).toUpperCase() + b.shape.slice(1) + '</td>' +
        '<td>' + dims.join(" · ") + '</td>' +
        '<td>' + fmt$(p1k) + '</td>' +
        '<td>' + fmt$(p50k) + '</td>' +
        '<td>' + fmt$(p500k) + '</td>' +
        '<td><a class="btn btn--sm btn--ghost" href="index.html?quote=' + encodeURIComponent("Product inquiry: " + b.spec + "\nQuantity: (to be specified)") + '#contact">Quote</a></td>' +
      '</tr>';
    }).join("");
  }

  function initTableFilter() {
    var wrap = document.getElementById("tableFilter");
    if (!wrap) return;
    wrap.addEventListener("click", function (e) {
      if (e.target.tagName !== "BUTTON") return;
      Array.prototype.forEach.call(wrap.children, function (b) { b.classList.remove("is-active"); });
      e.target.classList.add("is-active");
      renderPriceTable(e.target.getAttribute("data-filter"));
    });
  }

  /* ---------- Grade table ---------- */
  function renderGradeTable() {
    var tbody = document.getElementById("gradeTableBody");
    if (!tbody) return;
    tbody.innerHTML = GRADES.map(function (g) {
      return '<tr>' +
        '<td><strong>' + g.grade + '</strong></td>' +
        '<td>' + g.br + '</td>' +
        '<td>' + g.hcj + '</td>' +
        '<td>' + g.bhmax + '</td>' +
        '<td>' + g.temp + '</td>' +
        '<td>' + g.use + '</td>' +
      '</tr>';
    }).join("");
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    loadRate();
    renderDims();
    renderPriceTable("all");
    renderGradeTable();
    initTableFilter();

    if (shapeSel) shapeSel.addEventListener("change", renderDims);
    var form = document.getElementById("quoteForm");
    if (form) form.addEventListener("submit", calculate);
    if (resultBox) {
      resultBox.addEventListener("submit", function (e) {
        if (e.target.id === "quoteRequestForm") {
          e.preventDefault();
          submitQuoteRequest(e.target);
        }
      });
    }
  });
})();
