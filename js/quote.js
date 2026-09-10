/* ===========================================================
   Huapeng Magnetics — Quotation page
   =========================================================== */
(function () {
  "use strict";

  /* ---------- i18n DOM ID aliases ----------
   * EN request-quote uses qGrade/qShape/qCoating; DE uses qSorte/qForm/qBeschichtung;
   * ES uses qGrado/qForma/qRecubrimiento. All three pages use the same logic,
   * so look up the actual element id by language. */
  var HTML_LANG = (document.documentElement.getAttribute("lang") || "en").toLowerCase();
  var IDS = HTML_LANG.indexOf("de") === 0 ? {
    grade: "qSorte", shape: "qForm", coating: "qBeschichtung", qty: "qQty",
    d: "qD", h: "qH", l: "qL", w: "qW", hole: "qBohrung", angle: "qWinkel"
  } : HTML_LANG.indexOf("es") === 0 ? {
    grade: "qGrado", shape: "qForma", coating: "qRecubrimiento", qty: "qQty",
    d: "qD", h: "qH", l: "qL", w: "qW", hole: "qAgujero", angle: "qAngulo"
  } : {
    grade: "qGrade", shape: "qShape", coating: "qCoating", qty: "qQty",
    d: "qD", h: "qH", l: "qL", w: "qW", hole: "qHole", angle: "qAngle"
  };
  function $id(key) { return document.getElementById(IDS[key]); }

  var DEFAULT_RATE = 7.2;
  var rate = DEFAULT_RATE;
  var RATE_API = "https://api.exchangerate-api.com/v4/latest/USD";
  var FORMS_ENDPOINT = "https://huapeng-magnet.com";
  var lastQuote = null;

  /* ---------- Base N35 nickel-coated prices (from price list) ---------- */
  var BASE_PRICES = [
    { spec: "D5 × 1 mm", shape: "disc", img: "assets/disc_1.jpg", d: 5, l: null, w: null, h: 1, hole: null, price10k: 0.027 },
    { spec: "D8 × 2 mm", shape: "disc", img: "assets/disc_1.jpg", d: 8, l: null, w: null, h: 2, hole: null, price10k: 0.072 },
    { spec: "D10 × 2 mm", shape: "disc", img: "assets/disc_1.jpg", d: 10, l: null, w: null, h: 2, hole: null, price10k: 0.109 },
    { spec: "D12 × 3 mm", shape: "disc", img: "assets/disc_1.jpg", d: 12, l: null, w: null, h: 3, hole: null, price10k: 0.225 },
    { spec: "D15 × 3 mm", shape: "disc", img: "assets/disc_1.jpg", d: 15, l: null, w: null, h: 3, hole: null, price10k: 0.36 },
    { spec: "D20 × 5 mm", shape: "disc", img: "assets/disc_1.jpg", d: 20, l: null, w: null, h: 5, hole: null, price10k: 1.063 },
    { spec: "10 × 5 × 2 mm", shape: "block", img: "assets/block_2.jpg", d: null, l: 10, w: 5, h: 2, hole: null, price10k: 0.072 },
    { spec: "20 × 10 × 3 mm", shape: "block", img: "assets/block_2.jpg", d: null, l: 20, w: 10, h: 3, hole: null, price10k: 0.389 },
    { spec: "20 × 10 × 5 mm", shape: "block", img: "assets/block_2.jpg", d: null, l: 20, w: 10, h: 5, hole: null, price10k: 0.623 },
    { spec: "D20 × 5 mm ring D8", shape: "ring", img: "assets/ring_1.png", d: 20, l: null, w: null, h: 5, hole: 8, price10k: 0.97 }
  ];

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

  /* V3 cost-based constants */
  var COST_CNY_KG = 177.5 * 1.5 * 1.3;    // effective N35 cost benchmark (raised +50%, then +30%)
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
  var shapeSel = $id("shape");

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

  /* ---------- History Management ---------- */
  var HISTORY_KEY = "huapeng_quote_history";
  var MAX_HISTORY = 10;

  function loadHistory() {
    try {
      var stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveToHistory(quote) {
    try {
      var history = loadHistory();
      history.unshift({
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        grade: quote.grade,
        shape: quote.shape,
        dims: quote.dims,
        specText: quote.specText,
        coating: quote.coating,
        qty: quote.qty,
        unitPrice: quote.unitUsd,
        totalPrice: quote.totalUsd
      });
      if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      renderHistory();
    } catch (e) {
      console.error("Failed to save history:", e);
    }
  }

  window.restoreHistory = function(id) {
    var history = loadHistory();
    var item = history.find(function(h) { return h.id === id; });
    if (!item) return;

    $id("grade").value = item.grade;
    $id("shape").value = item.shape;
    $id("coating").value = item.coating;
    $id("qty").value = item.qty;

    if (item.shape === "disc") {
      $id("d").value = item.dims.d;
      $id("h").value = item.dims.h;
    } else if (item.shape === "block") {
      $id("l").value = item.dims.l;
      $id("w").value = item.dims.w;
      $id("h").value = item.dims.h;
    } else if (item.shape === "ring") {
      $id("d").value = item.dims.d;
      $id("hole").value = item.dims.hole;
      $id("h").value = item.dims.h;
    }
    calculate();
  };

  window.deleteHistory = function(id) {
    var history = loadHistory();
    history = history.filter(function(h) { return h.id !== id; });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
  };

  function renderHistory() {
    var container = document.getElementById("historyContainer");
    if (!container) return;

    var history = loadHistory();
    if (history.length === 0) {
      container.innerHTML = '<p class="muted">No history yet. Calculate a quote to save it.</p>';
      return;
    }

    var html = '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
    history.forEach(function(item) {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem;background:#f8f9fa;border-radius:4px;">' +
        '<div>' +
          '<div style="font-size:0.85rem;color:#6c757d;">' + item.timestamp + '</div>' +
          '<div style="font-weight:600;">' + item.grade + ' ' + item.shape + ' ' + item.specText + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-weight:700;color:#007bff;">' + fmt$(item.unitPrice) + '/pc</div>' +
          '<div style="font-size:0.85rem;">Total: ' + fmt$(item.totalPrice) + '</div>' +
        '</div>' +
        '<div style="margin-left:1rem;">' +
          '<button type="button" class="btn btn--mini btn--ghost" onclick="restoreHistory(' + item.id + ')" style="margin-right:0.25rem;">Restore</button>' +
          '<button type="button" class="btn btn--mini btn--ghost" onclick="deleteHistory(' + item.id + ')" style="color:#dc3545;">Delete</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function calculate(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!resultBox) return;

    var grade = $id("grade").value;
    var shape = shapeSel.value;
    var coating = $id("coating").value;
    var qty = parseInt($id("qty").value, 10);

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

    // Save to history
    saveToHistory(lastQuote);

    resultBox.innerHTML =
      '<div class="calc-result__head">' +
        '<span class="calc-result__label">' + L.unitPrice + '</span>' +
        '<strong class="calc-result__price">' + fmt$(unitUsd) + '</strong>' +
        '<span class="calc-result__sub">' + L.taxIncl + '</span>' +
      '</div>' +
      '<div class="calc-result__body">' +
        '<div><span>' + L.quantity + '</span><strong>' + fmtNum(qty) + ' pcs</strong></div>' +
        '<div><span>' + L.totalEst + '</span><strong>' + fmt$(totalUsd) + '</strong></div>' +
        '<div><span>' + L.spec + '</span><strong>' + specText + '</strong></div>' +
        '<div><span>' + L.grade + '</span><strong>' + grade + '</strong></div>' +
        '<div><span>' + L.coating + '</span><strong>' + coatingLabel(coating) + '</strong></div>' +
      '</div>' +
      '<div class="calc-result__actions">' +
        '<button type="button" class="btn btn--primary" onclick="exportPDF()">' + L.exportPdf + '</button>' +
      '</div>' +
      '<p class="calc-result__note">' + L.estUsd + '.</p>' +
      quoteFormHTML();
  }

  function specString(shape, dims, coating) {
    if (shape === "disc") return "D" + dims.d + " × " + dims.h + " mm";
    if (shape === "block") return dims.l + " × " + dims.w + " × " + dims.h + " mm";
    if (shape === "ring") return "D" + dims.d + " × " + dims.h + " mm, hole D" + dims.hole + " mm";
    return "";
  }

  /* ---------- PDF Export ---------- */
  window.exportPDF = function() {
    if (!lastQuote) return;

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.text("Huapeng Magnetics", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.text("Industrial-grade Neodymium Magnets", 105, 28, { align: "center" });
      doc.text("No. 859 Shijia Rd, Zonghan, Cixi, Ningbo, Zhejiang, China", 105, 33, { align: "center" });
      doc.text("Email: info@huapeng-magnet.com | www.huapeng-magnet.com", 105, 38, { align: "center" });

      // Divider
      doc.setDrawColor(0, 123, 255);
      doc.line(20, 42, 190, 42);

      // Title
      doc.setFontSize(16);
      doc.text("Quotation", 105, 50, { align: "center" });

      // Quote details
      doc.setFontSize(11);
      var y = 65;
      doc.text("Quote Details:", 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.text("Date: " + new Date().toLocaleDateString(), 20, y);
      y += 6;
      doc.text("Grade: " + lastQuote.grade, 20, y);
      y += 6;
      doc.text("Shape: " + lastQuote.shape.charAt(0).toUpperCase() + lastQuote.shape.slice(1), 20, y);
      y += 6;
      doc.text("Specification: " + lastQuote.specText, 20, y);
      y += 6;
      doc.text("Coating: " + coatingLabel(lastQuote.coating), 20, y);
      y += 6;
      doc.text("Quantity: " + fmtNum(lastQuote.qty) + " pcs", 20, y);
      y += 10;

      // Price table
      doc.setFontSize(11);
      doc.text("Price Breakdown:", 20, y);
      y += 8;

      doc.setFillColor(240, 240, 240);
      doc.rect(20, y-5, 170, 8, "F");
      doc.setFontSize(10);
      doc.text("Quantity", 25, y);
      doc.text("Unit Price (USD)", 80, y);
      doc.text("Total (USD)", 130, y);

      y += 8;
      doc.text(fmtNum(lastQuote.qty) + " pcs", 25, y);
      doc.text(fmt$(lastQuote.unitUsd), 80, y);
      doc.text(fmt$(lastQuote.totalUsd), 130, y);

      y += 12;
      doc.setFontSize(9);
      doc.text("Note: Prices are FOB China, tax included. Valid for 30 days.", 20, y);
      y += 6;
      doc.text("Final quote subject to tolerance, magnetization direction, packing and shipping.", 20, y);

      // Footer
      doc.setFontSize(8);
      doc.text("© 2026 Huapeng Magnetics. All rights reserved.", 105, 280, { align: "center" });

      doc.save("huapeng-quote-" + Date.now() + ".pdf");
    } catch (e) {
      alert("PDF export failed: " + e.message);
      console.error(e);
    }
  };
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

  /* ---------- i18n strings ---------- */
  var L10N = {
    en: {
      quoteTitle: "Request this quote",
      quoteDesc: "Leave your contact details and we will confirm price, coating, tolerance and lead time by email.",
      name: "Name", email: "Email", company: "Company", country: "Country",
      notes: "Notes / special requests",
      notesPh: "Tolerance, magnetization direction, packing, shipping terms...",
      sendQuote: "Send Quote Request", sending: "Sending…",
      unitPrice: "UNIT PRICE", taxIncl: "Tax included", quantity: "Quantity",
      totalEst: "Total Estimate", spec: "Spec", grade: "Grade", coating: "Coating",
      exportPdf: "Export PDF", estUsd: "Estimated USD price",
      standardList: "STANDARD LIST", n35List: "N35 nickel-coated price list",
      typicalUse: "Typical Use", contactSales: "Contact Sales",
      needed: "* required", allShapes: "All"
    },
    de: {
      quoteTitle: "Dieses Angebot anfordern",
      quoteDesc: "Hinterlassen Sie Ihre Kontaktdaten — wir bestätigen Preis, Beschichtung, Toleranz und Lieferzeit per E-Mail.",
      name: "Name", email: "E-Mail", company: "Unternehmen", country: "Land",
      notes: "Hinweise / Sonderwünsche",
      notesPh: "Toleranz, Magnetisierungsrichtung, Verpackung, Lieferbedingungen...",
      sendQuote: "Angebot anfordern", sending: "Wird gesendet…",
      unitPrice: "STÜCKPREIS", taxIncl: "Inkl. Steuern", quantity: "Menge",
      totalEst: "Gesamtschätzung", spec: "Spezifikation", grade: "Sorte", coating: "Beschichtung",
      exportPdf: "PDF exportieren", estUsd: "Geschätzter USD-Preis",
      standardList: "STANDARDLISTE", n35List: "N35 nickel-beschichtete Preisliste",
      typicalUse: "Typische Anwendung", contactSales: "Vertrieb kontaktieren",
      needed: "* erforderlich", allShapes: "Alle"
    },
    es: {
      quoteTitle: "Solicitar este presupuesto",
      quoteDesc: "Deje sus datos de contacto y confirmaremos precio, recubrimiento, tolerancia y plazo de entrega por correo.",
      name: "Nombre", email: "Email", company: "Empresa", country: "País",
      notes: "Notas / solicitudes especiales",
      notesPh: "Tolerancia, dirección de magnetización, embalaje, condiciones de envío...",
      sendQuote: "Enviar Solicitud", sending: "Enviando…",
      unitPrice: "PRECIO UNITARIO", taxIncl: "Impuestos incluidos", quantity: "Cantidad",
      totalEst: "Estimación Total", spec: "Especificación", grade: "Grado", coating: "Recubrimiento",
      exportPdf: "Exportar PDF", estUsd: "Precio estimado en USD",
      standardList: "LISTA ESTÁNDAR", n35List: "Lista de precios N35 con recubrimiento de níquel",
      typicalUse: "Uso Típico", contactSales: "Contactar Ventas",
      needed: "* obligatorio", allShapes: "Todos"
    }
  };
  var L = L10N[HTML_LANG.indexOf("de") === 0 ? "de" : HTML_LANG.indexOf("es") === 0 ? "es" : "en"];

  function quoteFormHTML() {
    return '<div class="quote-request">' +
      '<h3>' + L.quoteTitle + '</h3>' +
      '<p>' + L.quoteDesc + '</p>' +
      '<form id="quoteRequestForm" class="quote-request__form">' +
        '<div class="field-row">' +
          '<div class="field"><label for="qrName">' + L.name + ' *</label><input type="text" id="qrName" name="name" required></div>' +
          '<div class="field"><label for="qrEmail">' + L.email + ' *</label><input type="email" id="qrEmail" name="email" required></div>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="qrCompany">' + L.company + '</label><input type="text" id="qrCompany" name="company"></div>' +
          '<div class="field"><label for="qrCountry">' + L.country + '</label><input type="text" id="qrCountry" name="country"></div>' +
        '</div>' +
        '<div class="field field--full"><label for="qrNotes">' + L.notes + '</label><textarea id="qrNotes" name="notes" rows="2" placeholder="' + L.notesPh + '"></textarea></div>' +
        '<button type="submit" class="btn btn--primary btn--wide">' + L.sendQuote + '</button>' +
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
    if (btn) { btn.disabled = true; btn.textContent = L.sending; }
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
          if (btn) { btn.disabled = false; btn.textContent = L.sendQuote; }
        }
      })
      .catch(function () {
        alert("Network error. Please try again or email info@huapeng-magnet.com");
        if (btn) { btn.disabled = false; btn.textContent = L.sendQuote; }
      });
  }

  function coatingLabel(c) {
    return { nickel: "Nickel", zinc: "Zinc" }[c] || c;
  }

  function requestQuoteHTML(title, msg) {
    var grade = $id("grade").value;
    var shape = shapeSel.value;
    var coating = $id("coating").value;
    var qty = parseInt($id("qty").value, 10);
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

      return '<tr data-shape="' + b.shape + '">' +
        '<td class="spec">' + b.spec + '</td>' +
        '<td class="img-cell"><img src="' + b.img + '" alt="' + b.spec + '"></td>' +
        '<td class="price">' + fmt$(p1k) + '</td>' +
        '<td class="price">' + fmt$(p50k) + '</td>' +
        '<td class="price">' + fmt$(p500k) + '</td>' +
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
  var GRADE_USE = {
    en: {
      N35: "General-purpose holding, sensors, consumer electronics",
      N38: "Higher holding force, magnetic closures, DC motors",
      N40: "Motors, generators, high-performance assemblies",
      N42: "Industrial motors, magnetic separators, sensors",
      N45: "Premium motors, audio drivers, medical devices",
      N48: "High-end motors, aerospace, precision instruments",
      N50: "Maximum energy product for compact designs",
      N52: "Extreme performance, research, specialty motors"
    },
    de: {
      N35: "Allgemeine Halteanwendungen, Sensoren, Unterhaltungselektronik",
      N38: "Höhere Haltekraft, Magnetverschlüsse, DC-Motoren",
      N40: "Motoren, Generatoren, Hochleistungsbaugruppen",
      N42: "Industriemotoren, Magnetabscheider, Sensoren",
      N45: "Premium-Motoren, Audiotreiber, Medizingeräte",
      N48: "High-End-Motoren, Luft- und Raumfahrt, Präzisionsinstrumente",
      N50: "Maximales Energieprodukt für kompakte Designs",
      N52: "Extreme Leistung, Forschung, Spezialmotoren"
    },
    es: {
      N35: "Sujeción general, sensores, electrónica de consumo",
      N38: "Mayor fuerza de sujeción, cierres magnéticos, motores DC",
      N40: "Motores, generadores, conjuntos de alto rendimiento",
      N42: "Motores industriales, separadores magnéticos, sensores",
      N45: "Motores premium, controladores de audio, dispositivos médicos",
      N48: "Motores de gama alta, aeroespacial, instrumentos de precisión",
      N50: "Máximo producto energético para diseños compactos",
      N52: "Rendimiento extremo, investigación, motores especiales"
    }
  };

  function renderGradeTable() {
    var tbody = document.getElementById("gradeTableBody");
    if (!tbody) return;
    var useMap = GRADE_USE[HTML_LANG.indexOf("de") === 0 ? "de" : HTML_LANG.indexOf("es") === 0 ? "es" : "en"];
    tbody.innerHTML = GRADES.map(function (g) {
      return '<tr>' +
        '<td><strong>' + g.grade + '</strong></td>' +
        '<td>' + g.br + '</td>' +
        '<td>' + g.hcj + '</td>' +
        '<td>' + g.bhmax + '</td>' +
        '<td>' + g.temp + '</td>' +
        '<td>' + (useMap[g.grade] || g.use) + '</td>' +
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
