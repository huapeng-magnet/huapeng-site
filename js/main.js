/* ===========================================================
   Huapeng Magnetics — interactions
   =========================================================== */
(function () {
  "use strict";

  var CONTACT_EMAIL = "info@huapeng-magnet.com";
  var CART_KEY = "hp_cart";
  var FORMS_ENDPOINT = "https://huapeng-magnet.com";

  /* ---------- Pricing helpers (from pricing.js) ---------- */
  var Pricing = window.HPPricing || {};
  var fmt$ = Pricing.fmt$ || function (n) { return "$" + n.toFixed(2); };
  var fmtNum = Pricing.fmtNum || function (n) { return n.toLocaleString("en-US"); };
  var estimatedUnitPrice = Pricing.estimatedUnitPrice || function () { return null; };
  var specString = Pricing.specString || function () { return ""; };
  var coatingLabel = Pricing.coatingLabel || function (c) { return c; };
  var GRADES = Pricing.GRADES || [
    { grade: "N35" }, { grade: "N38" }, { grade: "N40" }, { grade: "N42" },
    { grade: "N45" }, { grade: "N48" }, { grade: "N50" }, { grade: "N52" },
    { grade: "M35" }, { grade: "M40" }, { grade: "H35" }, { grade: "H40" },
    { grade: "SH35" }, { grade: "UH35" }, { grade: "EH35" }, { grade: "AH35" }
  ];

  /* ---------- Toast ---------- */
  var toast = document.getElementById("toast");
  var toastTimer;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  /* ---------- Hero carousel ---------- */
  var track = document.getElementById("heroTrack");
  var slides = track ? Array.prototype.slice.call(track.querySelectorAll(".slide")) : [];
  var dotsWrap = document.getElementById("heroDots");
  var current = 0;
  var autoTimer;

  if (slides.length) {
    slides.forEach(function (_, i) {
      var b = document.createElement("button");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", "Slide " + (i + 1));
      if (i === 0) b.classList.add("is-active");
      b.addEventListener("click", function () { go(i); restart(); });
      dotsWrap.appendChild(b);
    });
    var dots = Array.prototype.slice.call(dotsWrap.children);

    function go(n) {
      current = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle("is-active", i === current); });
      dots.forEach(function (d, i) { d.classList.toggle("is-active", i === current); });
    }
    function next() { go(current + 1); }
    function prev() { go(current - 1); }

    var btnNext = document.getElementById("heroNext");
    var btnPrev = document.getElementById("heroPrev");
    if (btnNext) btnNext.addEventListener("click", function () { next(); restart(); });
    if (btnPrev) btnPrev.addEventListener("click", function () { prev(); restart(); });

    function start() { autoTimer = setInterval(next, 5500); }
    function restart() { clearInterval(autoTimer); start(); }
    start();
  }

  /* ---------- Mobile nav ---------- */
  var navToggle = document.getElementById("navToggle");
  var nav = document.querySelector(".nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () { nav.classList.toggle("open"); });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { nav.classList.remove("open"); });
    });
  }

  /* ---------- Product catalog (mirrors DOM cards) ----------
   * Cards are presented by shape only; grade/dimensions/coating are user-selected
   * in the configurator. CATALOG.name is the shape label (used by configurator
   * header, cart item labels, Feishu message). */
  var CATALOG = [
    { id: "disc-n52", name: "Disc Magnet", shape: "disc", grade: "N52", coating: "nickel", img: "assets/disc_1.jpg", defaultDims: { d: 10, h: 3 } },
    { id: "block-n50", name: "Block Magnet", shape: "block", grade: "N50", coating: "zinc", img: "assets/block_2.jpg", defaultDims: { l: 20, w: 10, h: 5 } },
    { id: "ring-n45", name: "Ring Magnet", shape: "ring", grade: "N45", coating: "nickel", img: "assets/ring_1.png", defaultDims: { d: 20, hole: 10, h: 5 } },
    { id: "arc-n42", name: "Arc Segment", shape: "arc", grade: "N42", coating: "nickel", img: "assets/arc_1.png", defaultDims: { l: 30, w: 20, h: 5, angle: 45 } },
    { id: "custom-assembly", name: "Custom Assembly", shape: "assembly", grade: "N35", coating: "nickel", img: null, isCustom: true }
  ];

  function findProduct(id) {
    return CATALOG.find(function (p) { return p.id === id; });
  }

  /* ---------- Product filters ---------- */
  var productGrid = document.getElementById("productGrid");
  var searchInput = document.getElementById("siteSearch");
  var searchClear = document.getElementById("siteSearchClear");
  var searchQuery = "";
  var noResultsEl = null;

  if (productGrid && productGrid.parentNode) {
    noResultsEl = document.createElement("p");
    noResultsEl.id = "productSearchEmpty";
    noResultsEl.className = "cart-empty";
    noResultsEl.textContent = "No products match your search or filters.";
    noResultsEl.style.textAlign = "center";
    noResultsEl.style.padding = "30px 0";
    noResultsEl.hidden = true;
    productGrid.parentNode.insertBefore(noResultsEl, productGrid.nextSibling);
  }

  function applyFilters() {
    if (!productGrid) return;
    var shapeBtn = document.querySelector('#shapeFilter button.is-active');
    var gradeBtn = document.querySelector('#gradeFilter button.is-active');
    var shape = shapeBtn ? shapeBtn.getAttribute("data-filter") : "all";
    var grade = gradeBtn ? gradeBtn.getAttribute("data-filter") : "all";

    var cards = Array.prototype.slice.call(productGrid.querySelectorAll(".product"));
    var visible = 0;
    cards.forEach(function (card) {
      var cardShape = card.getAttribute("data-shape") || "";
      var cardGrade = card.getAttribute("data-grade") || "";
      var matchShape = shape === "all" || cardShape === shape;
      var matchGrade = grade === "all" || cardGrade === grade;
      var matchSearch = true;
      if (searchQuery) {
        var titleEl = card.querySelector("h3");
        var hay = (card.getAttribute("data-keywords") || "") + " " +
          (titleEl ? titleEl.textContent : "") + " " +
          cardShape + " " + cardGrade + " " + (card.getAttribute("data-id") || "");
        matchSearch = hay.toLowerCase().indexOf(searchQuery) !== -1;
      }
      var show = matchShape && matchGrade && matchSearch;
      card.hidden = !show;
      if (show) visible++;
    });
    if (noResultsEl) noResultsEl.hidden = visible !== 0;
  }

  function initFilters() {
    ["shapeFilter", "gradeFilter"].forEach(function (id) {
      var wrap = document.getElementById(id);
      if (!wrap) return;
      wrap.addEventListener("click", function (e) {
        if (e.target.tagName !== "BUTTON") return;
        Array.prototype.forEach.call(wrap.children, function (b) { b.classList.remove("is-active"); });
        e.target.classList.add("is-active");
        applyFilters();
      });
    });
    applyFilters();
  }
  initFilters();

  /* ---------- Search box ---------- */
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchQuery = searchInput.value.trim().toLowerCase();
      if (searchClear) searchClear.hidden = searchQuery.length === 0;
      applyFilters();
    });
    if (searchClear) {
      searchClear.addEventListener("click", function () {
        searchInput.value = "";
        searchQuery = "";
        searchClear.hidden = true;
        applyFilters();
        searchInput.focus();
      });
    }
  }

  /* ---------- Product config modal ---------- */
  var configModal = document.getElementById("configModal");
  var configOverlay = document.getElementById("configModalOverlay");
  var configClose = document.getElementById("configModalClose");
  var configBody = document.getElementById("configModalBody");
  var currentConfigProduct = null;

  function openConfigModal() {
    if (!configModal) return;
    configModal.hidden = false;
    configModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeConfigModal() {
    if (!configModal) return;
    configModal.setAttribute("aria-hidden", "true");
    configModal.hidden = true;
    document.body.style.overflow = "";
    currentConfigProduct = null;
  }
  if (configOverlay) configOverlay.addEventListener("click", closeConfigModal);
  if (configClose) configClose.addEventListener("click", closeConfigModal);
  closeConfigModal();

  function dimInput(id, label, value, min, max, step) {
    step = step || 0.1;
    return '<div class="field config-modal__field">' +
      '<label for="' + id + '">' + label + '</label>' +
      '<input type="number" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" required>' +
      '</div>';
  }

  function renderConfigDims(shape, dims) {
    if (shape === "disc") {
      return dimInput("cfgD", "Diameter (mm)", dims.d || 10, 0.1, 200, 0.1) +
             dimInput("cfgH", "Thickness (mm)", dims.h || 3, 0.1, 50, 0.1);
    }
    if (shape === "block" || shape === "cube") {
      return dimInput("cfgL", "Length (mm)", dims.l || 20, 0.1, 200, 0.1) +
             dimInput("cfgW", "Width (mm)", dims.w || 10, 0.1, 200, 0.1) +
             dimInput("cfgH", "Thickness (mm)", dims.h || 5, 0.1, 50, 0.1);
    }
    if (shape === "ring") {
      return dimInput("cfgD", "Outer Diameter (mm)", dims.d || 20, 0.1, 200, 0.1) +
             dimInput("cfgHole", "Hole Diameter (mm)", dims.hole || 10, 0.1, 190, 0.1) +
             dimInput("cfgH", "Thickness (mm)", dims.h || 5, 0.1, 50, 0.1);
    }
    if (shape === "arc") {
      return dimInput("cfgL", "Length (mm)", dims.l || 30, 0.1, 300, 0.1) +
             dimInput("cfgW", "Width (mm)", dims.w || 20, 0.1, 200, 0.1) +
             dimInput("cfgH", "Thickness (mm)", dims.h || 5, 0.1, 50, 0.1) +
             dimInput("cfgAngle", "Angle (°)", dims.angle || 45, 1, 180, 1);
    }
    if (shape === "assembly") {
      return '<div class="field field--full config-modal__field">' +
        '<label for="cfgCustom">Your specification</label>' +
        '<textarea id="cfgCustom" rows="3" placeholder="Describe shape, dimensions, grade, coating, quantity, tolerance, magnetization direction..."></textarea>' +
        '</div>';
    }
    return "";
  }

  function getConfigDims(shape) {
    var val = function (id) { return parseFloat(document.getElementById(id).value) || 0; };
    if (shape === "disc") return { d: val("cfgD"), h: val("cfgH") };
    if (shape === "block" || shape === "cube") return { l: val("cfgL"), w: val("cfgW"), h: val("cfgH") };
    if (shape === "ring") return { d: val("cfgD"), hole: val("cfgHole"), h: val("cfgH") };
    if (shape === "arc") return { l: val("cfgL"), w: val("cfgW"), h: val("cfgH"), angle: val("cfgAngle") };
    return {};
  }

  function buildGradeOptions(selectedGrade) {
    return GRADES.map(function (g) {
      var grade = g.grade;
      return '<option value="' + grade + '"' + (grade === selectedGrade ? " selected" : "") + '>' + grade + '</option>';
    }).join("");
  }

  var COATING_OPTIONS = [
    { value: "nickel", label: "Nickel" },
    { value: "zinc", label: "Zinc" }
  ];
  function buildCoatingOptions(selectedCoating) {
    return COATING_OPTIONS.map(function (c) {
      return '<option value="' + c.value + '"' + (c.value === selectedCoating ? " selected" : "") + '>' + c.label + '</option>';
    }).join("");
  }

  function openConfigurator(product, sourceCard) {
    if (!configBody) return;
    currentConfigProduct = product;
    var imgHtml = product.img
      ? '<div class="config-modal__img" style="background-image:url(\'' + product.img + '\')"></div>'
      : '<div class="config-modal__img config-modal__img--custom"><svg viewBox="0 0 48 48" width="40" height="40"><path d="M24 6l4 8 9 1-6.5 6 1.5 9L24 33l-8 4 1.5-9L11 15l9-1z" fill="none" stroke="#22d3ee" stroke-width="2.4" stroke-linejoin="round"/></svg></div>';

    configBody.innerHTML =
      '<div class="config-modal">' +
        '<div class="config-modal__media">' + imgHtml + '</div>' +
        '<div class="config-modal__content">' +
          '<h3 class="config-modal__title">' + product.name + '</h3>' +
          '<p class="config-modal__subtitle">Configure grade, dimensions and quantity</p>' +
          '<form id="configForm" class="config-modal__form">' +
            '<div class="config-modal__row config-modal__row--grade">' +
              '<div class="field config-modal__field">' +
                '<label for="cfgGrade">Grade</label>' +
                '<select id="cfgGrade" required>' + buildGradeOptions(product.grade) + '</select>' +
              '</div>' +
            '</div>' +
            '<div class="config-modal__row config-modal__row--dims">' +
              '<div class="config-modal__dims" id="cfgDims">' + renderConfigDims(product.shape, product.defaultDims) + '</div>' +
            '</div>' +
            '<div class="config-modal__row config-modal__row--bottom">' +
              '<div class="field config-modal__field">' +
                '<label for="cfgCoating">Coating</label>' +
                '<select id="cfgCoating" required>' + buildCoatingOptions(product.coating || "nickel") + '</select>' +
              '</div>' +
              '<div class="field config-modal__field">' +
                '<label for="cfgQty">Quantity (pcs)</label>' +
                '<input type="number" id="cfgQty" min="1" step="1" value="1000" required>' +
              '</div>' +
            '</div>' +
            '<div class="config-modal__row config-modal__row--drawing">' +
              '<div class="field config-modal__field config-modal__field--full">' +
                '<label for="cfgDrawing" class="drawing-file-trigger">' +
                  '<span class="drawing-file-trigger__icon">📎</span>' +
                  '<span class="drawing-file-trigger__text">Choose JPG file</span>' +
                  '<span class="drawing-file-trigger__filename" id="cfgDrawingFilename"></span>' +
                  '<span class="drawing-file-trigger__hint">(max 4 MB)</span>' +
                  '<input type="file" id="cfgDrawing" name="drawing" accept="image/jpeg,.jpg" class="drawing-input">' +
                '</label>' +
                '<div class="drawing-preview" id="cfgDrawingPreview"></div>' +
              '</div>' +
            '</div>' +
            '<div class="config-modal__price" id="cfgPrice">Est. unit price: calculating…</div>' +
            '<div class="config-modal__actions">' +
              '<button type="submit" class="btn btn--primary">Add to Cart</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    openConfigModal();
    updateConfigPrice(product);

    var form = document.getElementById("configForm");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      addConfiguredToCart(product);
    });

    var qtyInput = document.getElementById("cfgQty");
    if (qtyInput) qtyInput.addEventListener("input", function () { updateConfigPrice(product); });
    var gradeInput = document.getElementById("cfgGrade");
    if (gradeInput) gradeInput.addEventListener("change", function () { updateConfigPrice(product); });
    var coatingInput = document.getElementById("cfgCoating");
    if (coatingInput) coatingInput.addEventListener("change", function () { updateConfigPrice(product); });

    var dimsWrap = document.getElementById("cfgDims");
    if (dimsWrap) {
      dimsWrap.addEventListener("input", function () { updateConfigPrice(product); });
    }
    bindDrawingInput(document.getElementById("cfgDrawing"), document.getElementById("cfgDrawingPreview"), document.getElementById("cfgDrawingFilename"));
  }

  function updateConfigPrice(product) {
    var priceEl = document.getElementById("cfgPrice");
    if (!priceEl) return;
    if (product.shape === "assembly") {
      priceEl.textContent = "Price on request";
      return;
    }
    var grade = document.getElementById("cfgGrade").value;
    var coating = (document.getElementById("cfgCoating") || {}).value || product.coating || "nickel";
    var qty = parseInt(document.getElementById("cfgQty").value, 10) || 0;
    var dims = getConfigDims(product.shape);
    var price = estimatedUnitPrice(product.shape, dims, grade, coating, qty);
    if (price && qty > 0) {
      priceEl.innerHTML = '<strong>' + fmt$(price) + '</strong> / pc at ' + fmtNum(qty) + ' pcs · Total ' + fmt$(price * qty);
    } else if (qty <= 0) {
      priceEl.textContent = "Please enter a valid quantity";
    } else {
      priceEl.textContent = "Price on request";
    }
  }

  function updateProductCardPrices() {
    if (!productGrid) return;
    Array.prototype.forEach.call(productGrid.querySelectorAll(".product"), function (card) {
      var priceEl = card.querySelector(".price");
      if (!priceEl || priceEl.classList.contains("price--quote")) return;
      var shape = card.getAttribute("data-shape");
      var grade = card.getAttribute("data-grade");
      var coating = card.getAttribute("data-coating");
      var spec = card.getAttribute("data-base-spec");
      if (!shape || !spec) return;
      var dims;
      try { dims = JSON.parse(spec); } catch (e) { return; }
      var price = estimatedUnitPrice(shape, dims, grade, coating, 10000);
      if (!price) return;
      priceEl.innerHTML = priceEl.innerHTML.replace(/\$[\d.]+/, fmt$(price));
    });
  }

  function refreshAllPrices() {
    updateProductCardPrices();
    recalcCartItems();
    renderCart();
    if (currentConfigProduct) updateConfigPrice(currentConfigProduct);
  }

  /* ---------- File helpers ---------- */
  function isJpegDataUrl(s) {
    return typeof s === "string" && s.indexOf("data:image/jpeg;base64,") === 0;
  }
  function readFileAsBase64(file, maxBytes, callback) {
    if (!file) { callback(null); return; }
    if (!/\.jpe?g$/i.test(file.name) || file.type !== "image/jpeg") {
      callback({ error: "Only JPG / JPEG images are accepted." }); return;
    }
    if (file.size > maxBytes) {
      callback({ error: "Image is too large. Max " + (maxBytes / 1024 / 1024) + " MB." }); return;
    }
    var reader = new FileReader();
    reader.onload = function () { callback(null, reader.result); };
    reader.onerror = function () { callback({ error: "Failed to read image." }); };
    reader.readAsDataURL(file);
  }

  function bindDrawingInput(inputEl, previewEl, filenameEl) {
    if (!inputEl) return;
    function clearPreview() {
      inputEl.value = "";
      if (previewEl) previewEl.innerHTML = "";
      if (filenameEl) filenameEl.textContent = "";
    }
    inputEl.addEventListener("change", function () {
      var file = inputEl.files[0];
      if (!file) { clearPreview(); return; }
      readFileAsBase64(file, 4 * 1024 * 1024, function (err, dataUrl) {
        if (err) {
          showToast(err.error);
          clearPreview();
          return;
        }
        if (filenameEl) filenameEl.textContent = file.name;
        if (previewEl) {
          previewEl.innerHTML =
            '<div class="drawing-preview__item">' +
              '<img src="' + dataUrl + '" alt="Preview">' +
              '<button type="button" class="drawing-preview__remove" aria-label="Remove image" title="Remove image">&times;</button>' +
            '</div>';
          var btn = previewEl.querySelector(".drawing-preview__remove");
          if (btn) btn.addEventListener("click", clearPreview);
        }
      });
    });
  }

  function addConfiguredToCart(product) {
    var qty = parseInt(document.getElementById("cfgQty").value, 10);
    if (isNaN(qty) || qty < 1) { showToast("Please enter a valid quantity."); return; }
    var grade = document.getElementById("cfgGrade").value;
    var coating = (document.getElementById("cfgCoating") || {}).value || product.coating || "nickel";
    var dims = product.shape === "assembly" ? null : getConfigDims(product.shape);
    var spec = product.shape === "assembly"
      ? (document.getElementById("cfgCustom").value.trim() || "Custom assembly")
      : specString(product.shape, dims);
    var unitPrice = dims ? estimatedUnitPrice(product.shape, dims, grade, coating, qty) : 0;

    // Build cart item directly (skip drawing upload for now)
    var cartItem = {
      id: product.id,
      name: product.name,
      shape: product.shape,
      grade: grade,
      coating: coating,
      dims: dims,
      spec: spec,
      qty: qty,
      unitPrice: unitPrice || 0
    };

    cart.push(cartItem);
    saveCart(cart);
    renderCart();
    closeConfigModal();
    openCart();
    showToast("Added: " + product.name + " (" + grade + ", " + fmtNum(qty) + " pcs)");
  }

  /* Bind configurator + detail to product cards */
  if (productGrid) {
    productGrid.addEventListener("click", function (e) {
      var detailsBtn = e.target.closest("[data-details]");
      if (detailsBtn) {
        var dCard = e.target.closest(".product");
        var dId = dCard ? (dCard.getAttribute("data-id") || (dCard.querySelector("h3") || {}).textContent) : null;
        if (dId) { e.preventDefault(); openDetail(dId); }
        return;
      }
      var btn = e.target.closest("[data-config]");
      var card = e.target.closest(".product");
      if (!card) return;
      var id = card.getAttribute("data-id") || card.querySelector("h3").textContent;
      var product = findProduct(id) || buildProductFromCard(card);
      if (btn || (!e.target.closest("a, button") && !e.target.closest(".product__foot"))) {
        e.preventDefault();
        openConfigurator(product, card);
      }
    });
  }

  function buildProductFromCard(card) {
    var shape = card.getAttribute("data-shape") || "assembly";
    var grade = card.getAttribute("data-grade") || "N35";
    var coating = card.getAttribute("data-coating") || "nickel";
    var name = card.querySelector("h3").textContent;
    var img = (card.querySelector(".product__img") || {}).style.backgroundImage || "";
    img = img.replace(/url\(['"]?([^'"]+)['"]?\)/, "$1");
    var defaultDims = {};
    try { defaultDims = JSON.parse(card.getAttribute("data-base-spec") || "{}"); } catch (err) {}
    return { id: name, name: name, shape: shape, grade: grade, coating: coating, img: img || null, defaultDims: defaultDims };
  }

  /* ---------- Cart (localStorage) ---------- */
  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  function fmt(n) { return "$" + n.toFixed(2); }

  function recalcCartItem(idx) {
    var item = cart[idx];
    if (!item || !item.dims || !estimatedUnitPrice) return;
    var price = estimatedUnitPrice(item.shape, item.dims, item.grade, item.coating, item.qty);
    if (price) item.unitPrice = price;
  }
  function recalcCartItems() {
    cart.forEach(function (_, idx) { recalcCartItem(idx); });
  }

  var cart = loadCart();
  var cartCountEl = document.getElementById("cartCount");
  var drawer = document.getElementById("cartDrawer");
  var overlay = document.getElementById("overlay");
  var cartBody = document.getElementById("cartBody");
  renderCartDrawings();
  var cartSubtotal = document.getElementById("cartSubtotal");

  function cartItemName(item) {
    var name = item.name || "Magnet";
    if (item.grade) name += " · " + item.grade;
    if (item.spec) name += " · " + item.spec;
    if (item.coating) name += " · " + coatingLabel(item.coating);
    return name;
  }

  function renderCart() {
    var count = cart.reduce(function (s, i) { return s + i.qty; }, 0);
    cartCountEl.textContent = count;
    if (!cart.length) {
      cartBody.innerHTML = '<p class="cart-empty">Your cart is empty.<br/>Add some magnets to get started.</p>';
      cartSubtotal.textContent = fmt(0);
      return;
    }
    var total = 0;
    cartBody.innerHTML = cart.map(function (item, idx) {
      var price = item.unitPrice || item.price || 0;
      var line = price * item.qty;
      total += line;
      return '' +
        '<div class="cart-item">' +
          '<div class="cart-item__info">' +
            '<div class="cart-item__name">' + cartItemName(item) + '</div>' +
            '<div class="cart-item__price">' + fmt(price) + ' / pc</div>' +
          '</div>' +
          '<div class="cart-item__qty">' +
            '<button data-dec="' + idx + '" aria-label="Decrease">−</button>' +
            '<input class="cart-item__qty-input" type="number" min="1" step="100" value="' + item.qty + '" data-qty="' + idx + '" aria-label="Quantity">' +
            '<button data-inc="' + idx + '" aria-label="Increase">+</button>' +
          '</div>' +
          '<button class="cart-item__remove" data-rm="' + idx + '" aria-label="Remove">🗑</button>' +
        '</div>';
    }).join("");
    cartSubtotal.textContent = fmt(total);
  }

  /* Per-product drawing upload slots (rendered on the contact form).
   * Number of slots == number of distinct cart items. Hidden when cart is empty.
   * If an item already has a drawing (set via the configurator), pre-fill the
   * preview so the user can see what they uploaded — they can still replace
   * it by picking a new file, or click × to clear it. */
  function renderCartDrawings() {
    var cartField = document.getElementById("cartDrawingsField");
    var list = document.getElementById("cartDrawingsList");
    if (!cartField || !list) return;
    if (!cart.length) {
      cartField.hidden = true;
      list.innerHTML = "";
      return;
    }
    cartField.hidden = false;
    list.innerHTML = cart.map(function (item, idx) {
      var label = (idx + 1) + ". " + (item.name || "Item") +
        (item.grade ? " — " + item.grade : "") +
        (item.spec ? " — " + item.spec : "") +
        (item.qty ? " × " + item.qty + " pcs" : "");
      var hasExisting = !!item.drawing;
      return '<div class="cart-drawing-slot" data-item-index="' + idx + '" data-has-existing="' + (hasExisting ? "1" : "0") + '">' +
        '<div class="cart-drawing-slot__header">' +
          '<span class="cart-drawing-slot__num">' + (idx + 1) + '</span>' +
          '<span class="cart-drawing-slot__label">' + label + '</span>' +
        '</div>' +
        '<label for="cartDrawing_' + idx + '" class="drawing-file-trigger">' +
          '<span class="drawing-file-trigger__icon">📎</span>' +
          '<span class="drawing-file-trigger__text">Choose JPG</span>' +
          '<span class="drawing-file-trigger__filename" id="cartDrawingFilename_' + idx + '"></span>' +
          '<span class="drawing-file-trigger__hint">' + (hasExisting ? "(already uploaded)" : "(optional, max 4 MB)") + '</span>' +
          '<input type="file" id="cartDrawing_' + idx + '" accept="image/jpeg,.jpg" class="drawing-input">' +
        '</label>' +
        '<div class="drawing-preview" id="cartDrawingPreview_' + idx + '"></div>' +
      '</div>';
    }).join("");
    cart.forEach(function (item, idx) {
      var input = document.getElementById("cartDrawing_" + idx);
      var preview = document.getElementById("cartDrawingPreview_" + idx);
      var filename = document.getElementById("cartDrawingFilename_" + idx);
      if (input) bindDrawingInput(input, preview, filename);
      // Pre-fill preview if the configurator already attached a drawing to this
      // cart item, so the user can see the existing upload on the contact form.
      if (preview && item.drawing && isJpegDataUrl(item.drawing)) {
        preview.innerHTML =
          '<div class="drawing-preview__item">' +
            '<img src="' + item.drawing + '" alt="Existing drawing">' +
            '<button type="button" class="drawing-preview__remove" aria-label="Remove" title="Remove">&times;</button>' +
          '</div>';
        var btn = preview.querySelector(".drawing-preview__remove");
        if (btn) {
          btn.addEventListener("click", function () {
            if (input) input.value = "";
            preview.innerHTML = "";
            if (cart[idx]) {
              delete cart[idx].drawing;
              saveCart(cart);
              // re-render so the hint flips from "uploaded" back to "JPG only"
              renderCartDrawings();
            }
          });
        }
      }
    });
  }

  function openCart() {
    drawer.classList.add("open");
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add("show"); });
    drawer.setAttribute("aria-hidden", "false");
  }
  function closeCart() {
    drawer.classList.remove("open");
    overlay.classList.remove("show");
    drawer.setAttribute("aria-hidden", "true");
    setTimeout(function () { overlay.hidden = true; }, 300);
  }

  cartBody.addEventListener("click", function (e) {
    var t = e.target;
    if (t.dataset.inc !== undefined) {
      var ii = +t.dataset.inc;
      var q = cart[ii].qty;
      cart[ii].qty = (q <= 1) ? 100 : q + 100;
    }
    else if (t.dataset.dec !== undefined) {
      var i = +t.dataset.dec;
      var dq = cart[i].qty;
      cart[i].qty = (dq <= 100) ? 1 : dq - 100;
    } else if (t.dataset.rm !== undefined) {
      cart.splice(+t.dataset.rm, 1);
      renderCartDrawings();
    } else { return; }
    recalcCartItems();
    saveCart(cart); renderCart();
  });

  cartBody.addEventListener("input", function (e) {
    var t = e.target;
    if (t.dataset.qty !== undefined) {
      var qi = +t.dataset.qty;
      var v = parseInt(t.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      cart[qi].qty = v;
      recalcCartItem(qi);
      saveCart(cart);
      cartCountEl.textContent = cart.reduce(function (s, i) { return s + i.qty; }, 0);
      var total = cart.reduce(function (s, i) { return s + (i.unitPrice || i.price || 0) * i.qty; }, 0);
      cartSubtotal.textContent = fmt(total);
    }
  });

  var cartBtn = document.getElementById("cartBtn");
  if (cartBtn) cartBtn.addEventListener("click", openCart);
  var cartClose = document.getElementById("cartClose");
  if (cartClose) cartClose.addEventListener("click", closeCart);
  if (overlay) overlay.addEventListener("click", closeCart);
  var cartContinue = document.getElementById("cartContinue");
  if (cartContinue) cartContinue.addEventListener("click", closeCart);

  renderCart();

  /* ---------- Load live exchange rate and refresh prices ---------- */
  if (Pricing.loadExchangeRate) {
    Pricing.loadExchangeRate().then(refreshAllPrices);
  }

  /* ---------- Quote buttons (non-product) ---------- */
  document.querySelectorAll("[data-quote]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest(".product");
      if (card) {
        var name = (card.querySelector("h3") || {}).textContent || "Custom magnet";
        var spec = (card.querySelector(".product__spec") || {}).textContent || "";
        var price = (card.querySelector(".price") || {}).textContent || "";
        var lines = ["Product inquiry: " + name.trim()];
        if (spec.trim()) lines.push("Spec: " + spec.trim());
        if (price.trim()) lines.push("Unit price: " + price.trim());
        lines.push("Quantity: (to be specified)");
        window.location.href = "index.html?quote=" + encodeURIComponent(lines.join("\n")) + "#contact";
      } else {
        window.location.href = "index.html#contact";
      }
    });
  });

  /* ---------- Cart checkout -> contact form ---------- */
  var checkoutLink = document.getElementById("checkoutLink");
  if (checkoutLink) checkoutLink.addEventListener("click", function () {
    if (!cart.length) { showToast("Your cart is empty."); return; }
    var lines = ["Shopping cart inquiry items:"];
    var total = 0;
    cart.forEach(function (item) {
      var price = item.unitPrice || item.price || 0;
      var line = price * item.qty;
      total += line;
      var note = item.drawing ? " [JPG attached]" : "";
      lines.push("- " + cartItemName(item) + " × " + fmtNum(item.qty) + " pcs, unit price " + fmt(price) + " = " + fmt(line) + note);
    });
    lines.push("Subtotal: " + fmt(total));
    window.location.href = "order.html";
  });

  /* ---------- Contact form (to Cloudflare Worker) ---------- */
  function submitToForms(path, payload, onDone) {
    showToast("Sending your inquiry…");
    fetch(FORMS_ENDPOINT + path, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok) {
          showToast("Inquiry sent! We will reply to " + payload.email);
          if (onDone) onDone();
        } else {
          showToast("Submit failed — please try again or email us directly.");
        }
      })
      .catch(function () {
        showToast("Network error — please try again or email us directly.");
      });
  }

  /* ---------- Pre-fill contact form from cart/quote params ---------- */
  function prefillContactForm() {
    var params = new URLSearchParams(window.location.search);
    var specText = params.get("cart") || params.get("quote");
    if (!specText) return;
    var specArea = document.getElementById("cSpec");
    if (specArea) {
      specArea.value = decodeURIComponent(specText);
      var contact = document.getElementById("contact");
      if (contact) setTimeout(function () { contact.scrollIntoView({ behavior: "smooth" }); }, 100);
      if (window.history && window.history.replaceState) {
        var cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }
  prefillContactForm();

  var contactForm = document.getElementById("contactForm");

  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = contactForm.name.value.trim();
      var email = contactForm.email.value.trim();
      var spec = contactForm.spec.value.trim();
      if (!name || !email || !spec) { showToast("Please fill in name, email and specification."); return; }
      var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) { showToast("Please enter a valid email address."); return; }
      var company = contactForm.company.value.trim();
      var country = contactForm.country.value.trim();

      function itemLabel(item, idx) {
        return (idx + 1) + ". " + (item.name || "Item") +
          (item.grade ? " — " + item.grade : "") +
          (item.spec ? " — " + item.spec : "") +
          (item.qty ? " × " + item.qty + " pcs" : "");
      }
      function clearAllDrawingPreviews() {
        cart.forEach(function (_, idx) {
          var p = document.getElementById("cartDrawingPreview_" + idx);
          if (p) p.innerHTML = "";
        });
      }
      function buildPayloadAndSubmit(extra) {
        var payload = { name: name, email: email, company: company, country: country, spec: spec };
        if (extra && extra.drawing) payload.drawing = extra.drawing;
        if (extra && extra.cartDrawings && extra.cartDrawings.length) payload.cartDrawings = extra.cartDrawings;
        submitToForms("/contact", payload, function () {
          contactForm.reset();
          clearAllDrawingPreviews();
          // Clear the cart after a successful submission so the next inquiry
          // starts fresh and the user doesn't accidentally re-submit the same items.
          cart = [];
          saveCart(cart);
          renderCart();
          renderCartDrawings();
        });
      }

      if (cart.length) {
        // Per-product upload slots: use the slot file if uploaded, else fall
        // back to the drawing that may have been attached in the configurator.
        var cartDrawings = [];
        var aborted = false;
        var i = 0;
        function processNext() {
          if (aborted) return;
          if (i >= cart.length) {
            return buildPayloadAndSubmit({
              drawing: cartDrawings[0] && cartDrawings[0].dataUrl,
              cartDrawings: cartDrawings
            });
          }
          var idx = i++;
          var item = cart[idx];
          var slotInput = document.getElementById("cartDrawing_" + idx);
          var slotFile = slotInput ? slotInput.files[0] : null;
          var label = itemLabel(item, idx);
          if (slotFile) {
            readFileAsBase64(slotFile, 4 * 1024 * 1024, function (err, dataUrl) {
              if (aborted) return;
              if (err) { aborted = true; showToast(err.error); return; }
              cartDrawings.push({ item: label, dataUrl: dataUrl });
              processNext();
            });
          } else if (item.drawing) {
            cartDrawings.push({ item: label, dataUrl: item.drawing });
            processNext();
          } else {
            processNext();
          }
        }
        processNext();
      } else {
        // No cart: submit spec-only inquiry
        buildPayloadAndSubmit({});
      }
    });
  }

  /* ---------- FAQ accordion ---------- */
  var faqList = document.getElementById("faqList");
  if (faqList) {
    faqList.addEventListener("click", function (e) {
      var q = e.target.closest(".faq-q");
      if (!q) return;
      var item = q.closest(".faq-item");
      var answer = item.querySelector(".faq-a");
      var isOpen = item.classList.toggle("open");
      q.setAttribute("aria-expanded", isOpen ? "true" : "false");
      answer.style.maxHeight = isOpen ? (answer.scrollHeight + "px") : "0px";
    });
  }

  /* ---------- Product detail modal (fetches /products) ---------- */
  var detailModal = document.getElementById("detailModal");
  var detailOverlay = document.getElementById("detailModalOverlay");
  var detailClose = document.getElementById("detailModalClose");
  var detailMaximize = document.getElementById("detailModalMaximize");
  var detailBody = document.getElementById("detailModalBody");
  var productsCache = null;

  function openDetailModal() {
    if (!detailModal) return;
    detailModal.hidden = false;
    detailModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeDetailModal() {
    if (!detailModal) return;
    detailModal.setAttribute("aria-hidden", "true");
    detailModal.hidden = true;
    document.body.style.overflow = "";
    if (detailModal) detailModal.classList.remove("modal--maximized");
    if (detailMaximize) detailMaximize.textContent = "⛶";
  }
  function toggleMaximize() {
    if (!detailModal) return;
    var isMax = detailModal.classList.toggle("modal--maximized");
    if (detailMaximize) detailMaximize.textContent = isMax ? "🗗" : "⛶";
  }
  if (detailOverlay) detailOverlay.addEventListener("click", closeDetailModal);
  if (detailClose) detailClose.addEventListener("click", closeDetailModal);
  if (detailMaximize) detailMaximize.addEventListener("click", toggleMaximize);
  closeDetailModal();

  function fetchProducts() {
    if (productsCache) return Promise.resolve(productsCache);
    return fetch(FORMS_ENDPOINT + "/products", { headers: { "Accept": "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        productsCache = Array.isArray(data) ? data : (data && data.products) || [];
        return productsCache;
      })
      .catch(function () { return []; });
  }

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]);
    });
  }

  function detailChips(arr) {
    if (!Array.isArray(arr) || !arr.length) return '<div class="detail__chips"><span class="detail__chip">—</span></div>';
    return '<div class="detail__chips">' + arr.map(function (x) { return '<span class="detail__chip">' + escHtml(x) + '</span>'; }).join("") + '</div>';
  }
  function detailList(arr) {
    if (!Array.isArray(arr) || !arr.length) return '<p>—</p>';
    return '<ul>' + arr.map(function (x) { return '<li>' + escHtml(x) + '</li>'; }).join("") + '</ul>';
  }
  function detailRow(title, content) {
    return '<div class="detail__row"><h4>' + title + '</h4>' + content + '</div>';
  }

  // NdFeB grade-temperature data for display
  var GRADE_TEMP_DATA = {
    'N35':  { bhMax: '33-36', hcj: '≥11', tMax: 80 },
    'N38':  { bhMax: '36-39', hcj: '≥12', tMax: 80 },
    'N40':  { bhMax: '38-42', hcj: '≥12', tMax: 80 },
    'N42':  { bhMax: '40-43', hcj: '≥12', tMax: 80 },
    'N45':  { bhMax: '43-46', hcj: '≥12', tMax: 80 },
    'N48':  { bhMax: '46-49', hcj: '≥12', tMax: 80 },
    'N50':  { bhMax: '48-51', hcj: '≥11', tMax: 80 },
    'N52':  { bhMax: '50-53', hcj: '≥10', tMax: 80 },
    'M35':  { bhMax: '33-36', hcj: '≥14', tMax: 100 },
    'M40':  { bhMax: '36-39', hcj: '≥14', tMax: 100 },
    'H35':  { bhMax: '33-36', hcj: '≥16', tMax: 120 },
    'H40':  { bhMax: '36-39', hcj: '≥16', tMax: 120 },
    'SH35': { bhMax: '33-36', hcj: '≥19', tMax: 150 },
    'UH35': { bhMax: '30-33', hcj: '≥22', tMax: 180 },
    'EH35': { bhMax: '28-31', hcj: '≥25', tMax: 200 },
    'AH35': { bhMax: '28-31', hcj: '≥28', tMax: 230 }
  };

  function getGradeTemp(grade) {
    return GRADE_TEMP_DATA[grade] || null;
  }

  function renderDetail(product, detail) {
    if (!detailBody) return;
    var d = detail || {};
    var imgHtml = product.img
      ? '<div class="detail__media"><div class="detail__img" style="background-image:url(\'' + product.img + '\')"></div></div>'
      : '<div class="detail__media"><div class="detail__img detail__img--custom"><svg viewBox="0 0 48 48" width="40" height="40"><path d="M24 6l4 8 9 1-6.5 6 1.5 9L24 33l-8 4 1.5-9L11 15l9-1z" fill="none" stroke="#22d3ee" stroke-width="2.4" stroke-linejoin="round"/></svg></div></div>';

    detailBody.innerHTML =
      '<div class="detail">' + imgHtml +
        '<div class="detail__content">' +
          '<h3 class="detail__title">' + escHtml(product.name) + '</h3>' +
          '<p class="detail__tagline">' + escHtml(d.tagline || (product.shape === "assembly" ? "Made-to-order" : "Standard & custom")) + '</p>' +
          '<p class="detail__desc">' + escHtml(d.description || "High-performance sintered NdFeB magnet, fully customizable to your specification.") + '</p>' +
          '<div class="detail__grid">' +
            detailRow("Available Grades", detailChips(d.grades || ["N35","N38","N40","N42","N45","N48","N50","N52"])) +
            detailRow("Coatings", detailChips(d.coatings || ["Nickel (Ni-Cu-Ni)","Zinc","Epoxy","Black Nickel"])) +
            detailRow("Dimensions", '<p>' + escHtml(d.dimensions || "Custom per drawing") + '</p>') +
            detailRow("Magnetization", '<p>' + escHtml(d.magnetization || "Axial / radial (per spec)") + '</p>') +
            detailRow("Tolerance", '<p>' + escHtml(d.tolerance || "±0.1 mm standard") + '</p>') +
            detailRow("Applications", detailList(d.applications || [])) +
            detailRow("Lead Time", '<p>' + escHtml(d.leadTime || "Samples 3–5 days; mass production 2–3 weeks") + '</p>') +
            detailRow("MOQ", '<p>' + escHtml(d.moq || "100 pcs sampling; 1,000 pcs production") + '</p>') +
            detailRow("Certifications", detailList(d.certs || ["Material certificate (per lot)","RoHS","REACH",""])) +
          '</div>' +
          '<div class="grade-temp-box">' +
            '<h4>Grade Performance &amp; Temperature</h4>' +
            '<div class="grade-temp-grid" id="gradeTempGrid"></div>' +
            '<p class="grade-temp-note">Br = residual flux density · Hcj = intrinsic coercivity · T<sub>max</sub> = maximum operating temperature</p>' +
          '</div>' +
          '<div class="detail__magnetic">' +
            '<h4>Magnetic Path &amp; Poles</h4>' +
            '<div class="mag-toggle">' +
              '<button type="button" class="mag-btn mag-btn--active" data-mag="axial">Axial</button>' +
              '<button type="button" class="mag-btn" data-mag="diametrical">Diametrical</button>' +
              '<button type="button" class="mag-btn" data-mag="radial">Radial</button>' +
              '<button type="button" class="mag-btn" data-mag="multi-axial">Multi-Axial</button>' +
              '<button type="button" class="mag-btn" data-mag="chord">Chord</button>' +
            '</div>' +
            '<div class="mag-svg-wrap" id="magSvgWrap">' + magneticSvg(product, "axial") + '</div>' +
            '<p class="mag-note">Select direction to see pole positions • Custom magnetization per RFQ</p>' +
          '</div>' +
          '<div class="detail__actions">' +
            '<a class="btn btn--primary" href="index.html#contact">Request Quote</a>' +
            '<button type="button" class="btn btn--ghost" data-detail-add>Configure &amp; Add</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    openDetailModal();

    var addBtn = detailBody.querySelector("[data-detail-add]");
    if (addBtn) addBtn.addEventListener("click", function () {
      closeDetailModal();
      openConfigurator(product, null);
    });

    // Magnetization toggle
    var wrap = detailBody.querySelector("#magSvgWrap");
    var btns = detailBody.querySelectorAll(".mag-btn");
    if (wrap && btns.length) {
      var currentMag = "axial";
      btns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var mag = btn.getAttribute("data-mag");
          if (mag === currentMag) return;
          currentMag = mag;
          btns.forEach(function (b) { b.classList.remove("mag-btn--active"); });
          btn.classList.add("mag-btn--active");
          wrap.innerHTML = magneticSvg(product, mag);
        });
      });
    }

    // Grade-Temperature performance table
    var gtpl = detailBody.querySelector("#gradeTempGrid");
    if (gtpl) {
      var grades = d.grades || ["N35","N38","N40","N42","N45","N48","N50","N52"];
      var html = '<table class="grade-perf-table"><thead><tr>' +
        '<th>Grade</th><th>(BH)max MGOe</th><th>Hcj kOe</th><th>T<sub>max</sub> °C</th><th>Typical Use</th>' +
        '</tr></thead><tbody>';
      var uses = {
        'N35':'General purpose', 'N38':'Speakers, fixtures', 'N40':'Motors', 'N42':'Motors, sensors',
        'N45':'High-performance motors', 'N48':'Compact high-power', 'N50':'Maximum pull force', 'N52':'Top energy',
        'M35':'Medium-temp auto', 'M40':'Medium-temp sensors', 'H35':'EV motors 120°C', 'H40':'Industrial 120°C',
        'SH35':'Aerospace 150°C', 'UH35':'Extreme high-temp', 'EH35':'Ultra-high-temp', 'AH35':'Premium 230°C'
      };
      grades.forEach(function (g) {
        var t = getGradeTemp(g);
        var bh = t ? t.bhMax : '—';
        var hcj = t ? t.hcj : '—';
        var tm = t ? t.tMax : '—';
        var use = uses[g] || '';
        html += '<tr><td class="gpt-grade">' + escHtml(g) + '</td><td>' + escHtml(bh) + '</td><td>' + escHtml(hcj) + '</td><td>' + escHtml(String(tm)) + '</td><td class="gpt-use">' + escHtml(use) + '</td></tr>';
      });
      html += '</tbody></table>';
      gtpl.innerHTML = html;
    }
  }

  function openDetail(id) {
    var product = findProduct(id) || null;
    if (!product && productGrid) {
      var card = productGrid.querySelector('[data-id="' + id + '"]');
      product = card ? buildProductFromCard(card) : null;
    }
    if (!product) return;
    if (detailBody) detailBody.innerHTML = '<div class="detail__loading">Loading specifications…</div>';
    openDetailModal();
    fetchProducts().then(function (list) {
      var detail = {};
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) { detail = list[i]; break; } }
      renderDetail(product, detail);
    });
  }

  /* ---------- Scroll reveal ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Clean 2D magnetic visualization ---------- */
  var MAG_RED = '#ef4444';
  var MAG_BLUE = '#3b82f6';
  var MAG_STROKE = '#64748b';

  function magneticSvg(product, mag) {
    var shape = String((product && product.shape) || "disc").toLowerCase();
    mag = mag || "axial";
    if (shape === "disc") return discSvg2d(mag);
    if (shape === "block") return blockSvg2d(mag);
    if (shape === "ring") return ringSvg2d(mag);
    if (shape === "arc") return arcSvg2d(mag);
    return customSvg2d(mag);
  }

  // ── Clean 2D magnetic visualization (simple red/blue split) ─────────────────

  function discSvg2d(mag) {
    var cx = 100, cy = 100, r = 65;
    var isAxial = /axial/.test(mag) && !/multi/.test(mag);
    var isDiametrical = /diametrical/.test(mag);
    var isRadial = /radial/.test(mag);
    var isMulti = /multi/.test(mag);
    var isChord = /chord/.test(mag);
    var svg = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">';
    var caption = '';

    if (isAxial) {
      // Top half red (N), bottom half blue (S)
      svg += '<path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 0 1 '+(cx+r)+' '+cy+' Z" fill="'+MAG_RED+'" opacity="0.9"/>';
      svg += '<path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 0 0 '+(cx+r)+' '+cy+' Z" fill="'+MAG_BLUE+'" opacity="0.9"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<line x1="'+cx+'" y1="'+(cy-r)+'" x2="'+cx+'" y2="'+(cy+r)+'" stroke="'+MAG_STROKE+'" stroke-width="1" stroke-dasharray="4,3"/>';
      svg += '<text x="'+cx+'" y="'+(cy-r*0.4)+'" font-size="16" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+cx+'" y="'+(cy+r*0.5)+'" font-size="16" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Axial — poles on flat faces (top/bottom)';
    } else if (isChord) {
      // Chord: N/S on opposite flat chord faces (vertical split like diametrical but rotated)
      svg += '<path d="M '+cx+' '+(cy-r)+' A '+r+' '+r+' 0 0 0 '+cx+' '+(cy+r)+' Z" fill="'+MAG_RED+'" opacity="0.9"/>';
      svg += '<path d="M '+cx+' '+(cy-r)+' A '+r+' '+r+' 0 0 1 '+cx+' '+(cy+r)+' Z" fill="'+MAG_BLUE+'" opacity="0.9"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<line x1="'+(cx-r)+'" y1="'+cy+'" x2="'+(cx+r)+'" y2="'+cy+'" stroke="'+MAG_STROKE+'" stroke-width="1" stroke-dasharray="4,3"/>';
      svg += '<text x="'+(cx-r*0.4)+'" y="'+cy+'" font-size="16" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+(cx+r*0.4)+'" y="'+cy+'" font-size="16" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Chord — poles on flat chord faces';
    } else if (isDiametrical) {
      // Left half red (N), right half blue (S)
      svg += '<path d="M '+cx+' '+(cy-r)+' A '+r+' '+r+' 0 0 0 '+cx+' '+(cy+r)+' Z" fill="'+MAG_RED+'" opacity="0.9"/>';
      svg += '<path d="M '+cx+' '+(cy-r)+' A '+r+' '+r+' 0 0 1 '+cx+' '+(cy+r)+' Z" fill="'+MAG_BLUE+'" opacity="0.9"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<line x1="'+(cx-r)+'" y1="'+cy+'" x2="'+(cx+r)+'" y2="'+cy+'" stroke="'+MAG_STROKE+'" stroke-width="1" stroke-dasharray="4,3"/>';
      svg += '<text x="'+(cx-r*0.4)+'" y="'+cy+'" font-size="16" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+(cx+r*0.4)+'" y="'+cy+'" font-size="16" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Diametrical — poles on opposite sides of diameter';
    } else if (isRadial) {
      // Outer ring red (N), inner circle blue (S)
      var innerR = Math.round(r * 0.35);
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+MAG_RED+'" opacity="0.9"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+innerR+'" fill="'+MAG_BLUE+'" opacity="0.9"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+innerR+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<text x="'+cx+'" y="'+(cy-r*0.6)+'" font-size="11" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+cx+'" y="'+cy+'" font-size="11" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Radial — N on outer surface, S on inner hole';
    } else if (isMulti) {
      // 4-pole pattern: alternating N/S segments
      var nPoles = 4, arcAngle = 360 / nPoles;
      for (var i = 0; i < nPoles; i++) {
        var startDeg = i * arcAngle - 90, endDeg = (i+1) * arcAngle - 90;
        var sRad = startDeg * Math.PI / 180, eRad = endDeg * Math.PI / 180;
        var x1 = cx + r * Math.cos(sRad), y1 = cy + r * Math.sin(sRad);
        var x2 = cx + r * Math.cos(eRad), y2 = cy + r * Math.sin(eRad);
        var largeArc = arcAngle > 180 ? 1 : 0;
        var color = i % 2 === 0 ? MAG_RED : MAG_BLUE;
        svg += '<path d="M '+cx+' '+cy+' L '+x1+' '+y1+' A '+r+' '+r+' 0 '+largeArc+' 1 '+x2+' '+y2+' Z" fill="'+color+'" opacity="0.85"/>';
      }
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<text x="'+cx+'" y="'+(cy-r-6)+'" font-size="11" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+cx+'" y="'+(cy+r+12)+'" font-size="11" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Multi-Axial — multiple N/S pairs around circumference';
    }
    svg += '</svg>';
    return '<div class="magnetic-view">'+svg+'<p class="magnetic-caption">'+caption+'</p></div>';
  }

  // ── Block magnet 2D ──────────────────────────────────────────────────────────
  function blockSvg2d(mag) {
    var w = 100, h = 70, d = 35; // width, height, depth
    var x = 50, y = 75;
    var isAxial = /axial/.test(mag) && !/multi/.test(mag);
    var isDiametrical = /diametrical/.test(mag);
    var caption = '';

    var svg = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">';

    if (isDiametrical) {
      // Left red (N), right blue (S)
      svg += '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+MAG_RED+'" opacity="0.9" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<rect x="'+(x+w)+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+MAG_BLUE+'" opacity="0.9" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      // Top face
      svg += '<polygon points="'+x+','+(y-d)+' '+(x+w)+','+(y-d)+' '+(x+w+w/2)+','+y+' '+x+','+y+'" fill="'+MAG_RED+'" opacity="0.85" stroke="'+MAG_STROKE+'" stroke-width="1"/>';
      svg += '<polygon points="'+(x+w)+','+(y-d)+' '+(x+w+w)+','+(y-d)+' '+(x+w+w/2)+','+y+' '+(x+w)+','+y+'" fill="'+MAG_BLUE+'" opacity="0.85" stroke="'+MAG_STROKE+'" stroke-width="1"/>';
      svg += '<text x="'+(x+w/2)+'" y="'+(y+h/2+5)+'" font-size="14" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+(x+w+w/2)+'" y="'+(y+h/2+5)+'" font-size="14" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Diametrical — poles on left/right faces';
    } else {
      // Axial: front red (N), back blue (S) - shown as split
      svg += '<rect x="'+x+'" y="'+y+'" width="'+w*2+'" height="'+h+'" fill="'+MAG_RED+'" opacity="0.9" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      // Top face (red)
      svg += '<polygon points="'+x+','+(y-d)+' '+(x+w*2)+','+(y-d)+' '+(x+w*2+w/2)+','+y+' '+x+','+y+'" fill="'+MAG_RED+'" opacity="0.85" stroke="'+MAG_STROKE+'" stroke-width="1"/>';
      // Side face (blue)
      svg += '<polygon points="'+(x+w*2)+','+y+' '+(x+w*2+w/2)+','+(y-d)+' '+(x+w*2+w/2)+','+(y+h-d)+' '+(x+w*2)+','+(y+h)+'" fill="'+MAG_BLUE+'" opacity="0.85" stroke="'+MAG_STROKE+'" stroke-width="1"/>';
      svg += '<text x="'+(x+w)+'" y="'+(y+h/2+5)+'" font-size="14" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+(x+w*2+w/4)+'" y="'+(y+h/2)+'" font-size="14" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Axial — poles on front/back faces';
    }
    svg += '</svg>';
    return '<div class="magnetic-view">'+svg+'<p class="magnetic-caption">'+caption+'</p></div>';
  }

  // ── Ring magnet 2D ───────────────────────────────────────────────────────────
  function ringSvg2d(mag) {
    var cx = 100, cy = 100, r = 65, hole = 25;
    var isAxial = /axial/.test(mag) && !/multi/.test(mag);
    var isRadial = /radial/.test(mag);
    var isMulti = /multi/.test(mag);
    var caption = '';

    var svg = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">';

    if (isRadial) {
      // Outer ring red (N), inner hole blue (S)
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+MAG_RED+'" opacity="0.9"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+hole+'" fill="'+MAG_BLUE+'" opacity="0.9"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+hole+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<text x="'+cx+'" y="'+(cy-r*0.5)+'" font-size="12" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+cx+'" y="'+cy+'" font-size="12" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Radial — N on outer surface, S on inner hole';
    } else if (isMulti) {
      // Multi-pole: alternating segments
      var nPoles = 6, arcAngle = 360 / nPoles;
      for (var i = 0; i < nPoles; i++) {
        var startDeg = i * arcAngle - 90, endDeg = (i+1) * arcAngle - 90;
        var sRad = startDeg * Math.PI / 180, eRad = endDeg * Math.PI / 180;
        var x1 = cx + r * Math.cos(sRad), y1 = cy + r * Math.sin(sRad);
        var x2 = cx + r * Math.cos(eRad), y2 = cy + r * Math.sin(eRad);
        var hs1 = cx + hole * Math.cos(sRad), hs2 = cy + hole * Math.sin(sRad);
        var hs3 = cx + hole * Math.cos(eRad), hs4 = cy + hole * Math.sin(eRad);
        var color = i % 2 === 0 ? MAG_RED : MAG_BLUE;
        svg += '<path d="M '+hs1+' '+hs2+' L '+x1+' '+y1+' A '+r+' '+r+' 0 0 1 '+x2+' '+y2+' L '+hs3+' '+hs4+' A '+hole+' '+hole+' 0 0 0 '+hs1+' '+hs2+' Z" fill="'+color+'" opacity="0.85"/>';
      }
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+hole+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      caption = 'Multi-Axial — multiple N/S pairs around circumference';
    } else {
      // Axial: top red (N), bottom blue (S)
      svg += '<path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 0 1 '+(cx+r)+' '+cy+' Z" fill="'+MAG_RED+'" opacity="0.9"/>';
      svg += '<path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 0 0 '+(cx+r)+' '+cy+' Z" fill="'+MAG_BLUE+'" opacity="0.9"/>';
      svg += '<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+r+'" ry="'+hole+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5" stroke-dasharray="4,3"/>';
      svg += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
      svg += '<text x="'+cx+'" y="'+(cy-r*0.4)+'" font-size="14" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+cx+'" y="'+(cy+r*0.5)+'" font-size="14" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Axial — poles on flat faces (top/bottom)';
    }
    svg += '</svg>';
    return '<div class="magnetic-view">'+svg+'<p class="magnetic-caption">'+caption+'</p></div>';
  }

  // ── Arc segment 2D ──────────────────────────────────────────────────────────
  function arcSvg2d(mag) {
    var cx = 100, cy = 120, r = 70, hole = 35, angle = 60;
    var isAxial = /axial/.test(mag) && !/multi/.test(mag);
    var isRadial = /radial/.test(mag);
    var caption = '';

    var svg = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">';

    if (isRadial) {
      // Radial: outer arc red (N), inner arc blue (S)
      var halfAngle = angle / 2 * Math.PI / 180;
      var x1 = cx + r * Math.cos(-halfAngle), y1 = cy - r * Math.sin(-halfAngle);
      var x2 = cx + r * Math.cos(halfAngle), y2 = cy - r * Math.sin(halfAngle);
      var x3 = cx + hole * Math.cos(-halfAngle), y3 = cy - hole * Math.sin(-halfAngle);
      var x4 = cx + hole * Math.cos(halfAngle), y4 = cy - hole * Math.sin(halfAngle);
      svg += '<path d="M '+x3+' '+y3+' L '+x1+' '+y1+' A '+r+' '+r+' 0 0 1 '+x2+' '+y2+' L '+x4+' '+y4+' A '+hole+' '+hole+' 0 0 0 '+x3+' '+y3+' Z" fill="'+MAG_RED+'" opacity="0.9" stroke="'+MAG_STROKE+'" stroke-width="1"/>';
      svg += '<text x="'+cx+'" y="'+(cy-r*0.6)+'" font-size="13" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N (outer)</text>';
      svg += '<text x="'+cx+'" y="'+(cy-hole*0.5)+'" font-size="13" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S (inner)</text>';
      caption = 'Radial — N on outer curve, S on inner curve';
    } else {
      // Axial: split horizontally
      svg += '<path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 0 1 '+(cx+r)+' '+cy+' L '+(cx+r*0.5)+','+cy+' A '+(r*0.5)+' '+(r*0.5)+' 0 0 0 '+(cx-r*0.5)+','+cy+' Z" fill="'+MAG_RED+'" opacity="0.9"/>';
      svg += '<path d="M '+(cx-r)+' '+cy+' A '+r+' '+r+' 0 0 0 '+(cx+r)+' '+cy+' L '+(cx+r*0.5)+','+cy+' A '+(r*0.5)+' '+(r*0.5)+' 0 0 1 '+(cx-r*0.5)+','+cy+' Z" fill="'+MAG_BLUE+'" opacity="0.9"/>';
      svg += '<text x="'+cx+'" y="'+(cy-r*0.4)+'" font-size="14" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
      svg += '<text x="'+cx+'" y="'+(cy+r*0.5)+'" font-size="14" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
      caption = 'Axial — poles on flat faces';
    }
    svg += '</svg>';
    return '<div class="magnetic-view">'+svg+'<p class="magnetic-caption">'+caption+'</p></div>';
  }

  // ── Custom shape 2D ─────────────────────────────────────────────────────────
  function customSvg2d() {
    var svg = '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">';
    svg += '<rect x="50" y="60" width="100" height="80" rx="4" fill="'+MAG_RED+'" opacity="0.7" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
    svg += '<rect x="50" y="100" width="100" height="40" fill="'+MAG_BLUE+'" opacity="0.7" stroke="'+MAG_STROKE+'" stroke-width="1.5"/>';
    svg += '<text x="100" y="85" font-size="16" font-weight="bold" fill="'+MAG_RED+'" text-anchor="middle">N</text>';
    svg += '<text x="100" y="125" font-size="16" font-weight="bold" fill="'+MAG_BLUE+'" text-anchor="middle">S</text>';
    svg += '</svg>';
    return '<div class="magnetic-view">'+svg+'<p class="magnetic-caption">Custom shape — please specify magnetization in your RFQ</p></div>';
  }

})();
