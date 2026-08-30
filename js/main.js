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
    { grade: "N45" }, { grade: "N48" }, { grade: "N50" }, { grade: "N52" }
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
          '<div class="detail__magnetic">' +
            '<h4>Magnetic Path &amp; Poles</h4>' +
            '<div class="mag-toggle">' +
              '<button type="button" class="mag-btn mag-btn--active" data-mag="axial">Axial</button>' +
              '<button type="button" class="mag-btn" data-mag="radial">Radial</button>' +
            '</div>' +
            '<div class="mag-svg-wrap" id="magSvgWrap">' + magneticSvg(product, "axial") + '</div>' +
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

  /* ---------- Magnetic path & pole SVG (5 shapes) — 3D style ---------- */
  function magneticSvg(product, mag) {
    var shape = String((product && product.shape) || "disc").toLowerCase();
    mag = mag || "axial";
    if (shape === "disc") return discSvg3d(mag);
    if (shape === "block") return blockSvg3d(mag);
    if (shape === "ring") return ringSvg3d(mag);
    if (shape === "arc") return arcSvg3d(mag);
    return customSvg3d();
  }

  function sharedDefs3d() {
    return '<defs>' +
      '<marker id="mag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee"/></marker>' +
      '<linearGradient id="body-grad" x1="0" x2="1" y1="0" y2="0">' +
        '<stop offset="0%" stop-color="#ef4444" stop-opacity="0.88"/>' +
        '<stop offset="40%" stop-color="#f87171" stop-opacity="0.75"/>' +
        '<stop offset="60%" stop-color="#60a5fa" stop-opacity="0.75"/>' +
        '<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.88"/>' +
      '</linearGradient>' +
      '<linearGradient id="top-grad" x1="0" x2="0" y1="0" y2="1">' +
        '<stop offset="0%" stop-color="#fca5a5" stop-opacity="0.95"/>' +
        '<stop offset="100%" stop-color="#f87171" stop-opacity="0.75"/>' +
      '</linearGradient>' +
      '<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">' +
        '<feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.25"/>' +
      '</filter>' +
      '</defs>';
  }

  // 3D disc — shows top ellipse to make it look cylindrical
  function discSvg3d(mag) {
    var isRadial = /radial/.test(mag);
    var body, top;
    if (isRadial) {
      // 径向：左右分色，左红(N)右白(S)
      body = '<rect x="100" y="65" width="60" height="85" rx="2" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5" filter="url(#shadow)"/>' +
             '<rect x="160" y="65" width="60" height="85" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.5"/>';
      top = '<ellipse cx="130" cy="65" rx="30" ry="18" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5"/>' +
            '<ellipse cx="190" cy="65" rx="30" ry="18" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.5"/>' +
            '<ellipse cx="160" cy="65" rx="60" ry="18" fill="none" stroke="#475569" stroke-width="1.5"/>';
    } else {
      // 轴向：上下分色，上半红(N)下半白(S)
      body = '<rect x="100" y="65" width="120" height="42" rx="2" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5" filter="url(#shadow)"/>' +
             '<rect x="100" y="107" width="120" height="43" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.5"/>';
      top = '<ellipse cx="160" cy="65" rx="60" ry="18" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5"/>';
    }
    var labels = isRadial
      ? '<text x="130" y="175" font-size="16" font-weight="bold" fill="#ef4444" text-anchor="middle">N</text>' +
        '<text x="190" y="175" font-size="16" font-weight="bold" fill="#475569" text-anchor="middle">S</text>'
      : '<text x="160" y="50" font-size="16" font-weight="bold" fill="#ef4444" text-anchor="middle">N</text>' +
        '<text x="160" y="178" font-size="16" font-weight="bold" fill="#475569" text-anchor="middle">S</text>';
    return '<div class="magnetic-view">' +
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">' +
        sharedDefs3d() + body + top + labels +
      '</svg>' +
      '<p class="magnetic-caption">Disc magnet (3D view) · ' + escHtml(mag) + ' magnetization</p>' +
    '</div>';
  }

  // 3D ring — shows outer ellipse + inner hole (dashed)
  function ringSvg3d(mag) {
    var isRadial = /radial/.test(mag);
    var body, top;
    if (isRadial) {
      // 径向：左右分色，左红(N)右白(S)，带内孔
      body = '<path d="M 95 65 L 160 65 L 160 150 L 95 150 Z" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5" filter="url(#shadow)"/>' +
             '<path d="M 160 65 L 225 65 L 225 150 L 160 150 Z" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.5"/>';
      top = '<path d="M 95 65 A 65 20 0 0 1 225 65" fill="none" stroke="#475569" stroke-width="1.5"/>' +
            '<path d="M 95 65 A 32 10 0 0 1 160 65" fill="none" stroke="#475569" stroke-width="1.5" stroke-dasharray="3,2"/>' +
            '<path d="M 160 65 A 32 10 0 0 1 225 65" fill="none" stroke="#475569" stroke-width="1.5" stroke-dasharray="3,2"/>' +
            '<ellipse cx="127" cy="65" rx="32" ry="10" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.2"/>' +
            '<ellipse cx="192" cy="65" rx="32" ry="10" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.2"/>';
    } else {
      // 轴向：上下分色，上半红(N)下半白(S)
      body = '<path d="M 95 65 L 225 65 L 225 108 L 95 108 Z" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5" filter="url(#shadow)"/>' +
             '<path d="M 95 108 L 225 108 L 225 150 L 95 150 Z" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.5"/>';
      top = '<ellipse cx="160" cy="65" rx="65" ry="20" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5"/>' +
            '<ellipse cx="160" cy="65" rx="25" ry="8" fill="none" stroke="#475569" stroke-width="1.5" stroke-dasharray="4,3"/>';
    }
    var labels = isRadial
      ? '<text x="127" y="180" font-size="16" font-weight="bold" fill="#ef4444" text-anchor="middle">N</text>' +
        '<text x="192" y="180" font-size="16" font-weight="bold" fill="#475569" text-anchor="middle">S</text>'
      : '<text x="160" y="50" font-size="16" font-weight="bold" fill="#ef4444" text-anchor="middle">N</text>' +
        '<text x="160" y="175" font-size="16" font-weight="bold" fill="#475569" text-anchor="middle">S</text>';
    return '<div class="magnetic-view">' +
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">' +
        sharedDefs3d() + body + top + labels +
      '</svg>' +
      '<p class="magnetic-caption">Ring magnet (3D view) · ' + escHtml(mag) + ' magnetization</p>' +
    '</div>';
  }

  // 3D block — shows top face + side face for cuboid effect
  function blockSvg3d(mag) {
    var isRadial = /radial/.test(mag);
    var body, top, side;
    if (isRadial) {
      // 径向：左右分色，左红(N)右白(S)
      body = '<rect x="90" y="55" width="70" height="95" rx="3" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5" filter="url(#shadow)"/>' +
             '<rect x="160" y="55" width="70" height="95" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.5"/>';
      top = '<polygon points="90,55 115,35 185,35 160,55" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5"/>' +
            '<polygon points="160,55 185,35 255,35 230,55" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.5"/>';
      side = '<polygon points="230,55 255,35 255,130 230,150" fill="#f1f5f9" fill-opacity="0.95" stroke="#475569" stroke-width="1.5"/>';
    } else {
      // 轴向：上下分色，上半红(N)下半白(S)
      body = '<rect x="90" y="55" width="140" height="47" rx="3" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5" filter="url(#shadow)"/>' +
             '<rect x="90" y="102" width="140" height="48" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.5"/>';
      top = '<polygon points="90,55 115,35 255,35 230,55" fill="#ef4444" fill-opacity="0.95" stroke="#475569" stroke-width="1.5"/>';
      side = '<polygon points="230,55 255,35 255,102 230,150" fill="#f1f5f9" fill-opacity="1" stroke="#475569" stroke-width="1.5"/>';
    }
    var labels = isRadial
      ? '<text x="125" y="170" font-size="16" font-weight="bold" fill="#ef4444" text-anchor="middle">N</text>' +
        '<text x="195" y="170" font-size="16" font-weight="bold" fill="#475569" text-anchor="middle">S</text>'
      : '<text x="160" y="42" font-size="15" font-weight="bold" fill="#ef4444" text-anchor="middle">N</text>' +
        '<text x="160" y="178" font-size="15" font-weight="bold" fill="#475569" text-anchor="middle">S</text>';
    return '<div class="magnetic-view">' +
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">' +
        sharedDefs3d() + body + top + side + labels +
      '</svg>' +
      '<p class="magnetic-caption">Block magnet (3D view) · ' + escHtml(mag) + ' magnetization</p>' +
    '</div>';
  }

  // 3D arc segment — curved wedge shape
  function arcSvg3d(mag) {
    var isRadial = /radial/.test(mag);
    var body = '<path d="M 70 140 Q 160 40 250 140 L 235 140 Q 160 60 85 140 Z" fill="url(#body-grad)" stroke="#475569" stroke-width="1.5" filter="url(#shadow)"/>';
    var topEdge = '<path d="M 70 140 Q 160 40 250 140" fill="none" stroke="#fca5a5" stroke-width="2" stroke-opacity="0.8"/>';
    var lines;
    if (isRadial) {
      // 径向：N 在外侧弧面，S 在内侧弧面
      lines = '<text x="160" y="165" font-size="13" font-weight="bold" fill="#ef4444" text-anchor="middle">N (outer)</text>' +
              '<text x="160" y="55" font-size="13" font-weight="bold" fill="#3b82f6" text-anchor="middle">S (inner)</text>' +
              '<path d="M 130 130 Q 120 100 160 90" fill="none" stroke="#22d3ee" stroke-width="2" marker-end="url(#mag-arrow)"/>' +
              '<path d="M 190 130 Q 200 100 160 90" fill="none" stroke="#22d3ee" stroke-width="2" marker-end="url(#mag-arrow)"/>';
    } else {
      // 轴向：N 在上表面，S 在下表面（较少见但支持）
      lines = '<text x="160" y="35" font-size="13" font-weight="bold" fill="#ef4444" text-anchor="middle">N</text>' +
              '<text x="160" y="180" font-size="13" font-weight="bold" fill="#3b82f6" text-anchor="middle">S</text>' +
              '<path d="M 130 130 Q 130 70 160 55" fill="none" stroke="#22d3ee" stroke-width="2" marker-end="url(#mag-arrow)"/>' +
              '<path d="M 190 130 Q 190 70 160 55" fill="none" stroke="#22d3ee" stroke-width="2" marker-end="url(#mag-arrow)"/>';
    }
    return '<div class="magnetic-view">' +
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">' +
        sharedDefs3d() + body + topEdge + lines +
      '</svg>' +
      '<p class="magnetic-caption">Arc segment (3D view) · ' + escHtml(mag) + ' magnetization</p>' +
    '</div>';
  }

  function customSvg3d() {
    return '<div class="magnetic-view">' +
      '<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" class="magnetic-svg">' +
        sharedDefs3d() +
        '<polygon points="160,35 245,80 245,145 160,190 75,145 75,80" fill="url(#body-grad)" stroke="#475569" stroke-width="1.5" filter="url(#shadow)"/>' +
        '<polygon points="160,35 245,80 160,125 75,80" fill="#fca5a5" fill-opacity="0.6" stroke="#475569" stroke-width="1.5"/>' +
        '<text x="160" y="28" font-size="16" font-weight="bold" fill="#ef4444" text-anchor="middle">N</text>' +
        '<text x="160" y="200" font-size="16" font-weight="bold" fill="#3b82f6" text-anchor="middle">S</text>' +
        '<path d="M 100 60 Q 40 100 100 140" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4,3"/>' +
        '<path d="M 220 60 Q 280 100 220 140" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4,3"/>' +
      '</svg>' +
      '<p class="magnetic-caption">Custom shape · please specify magnetization direction in your RFQ</p>' +
    '</div>';
  }
})();