/* ===========================================================
   Huapeng Magnetics — checkout page
   Two parallel submission flows:
     • Left  : "Send Inquiry (No Payment)" → POST /contact
     • Right : "Pay 30% Deposit via PayPal" → PayPal capture-order
   Both share the same form fields above; both end with the
   same success overlay (text swapped per flow).
   =========================================================== */
(function () {
  "use strict";

  var CART_KEY = "hp_cart";

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function fmt(n) { return "$" + n.toFixed(2); }
  // Cart items store the unit price under key "unitPrice" (see main.js addConfiguredToCart).
  // Some legacy items in localStorage may still have "price". This helper normalizes either.
  function itemUnitPrice(it) { return (it && (it.unitPrice || it.price)) || 0; }
  function itemLineTotal(it) { return itemUnitPrice(it) * ((it && it.qty) || 0); }

  var cart = loadCart();
  var cartCountEl = document.getElementById("cartCount");
  var summary = document.getElementById("orderSummary");
  var form = document.getElementById("checkoutForm");
  var done = document.getElementById("checkoutDone");
  var doneIco = document.getElementById("checkoutDoneIco");
  var doneTitle = document.getElementById("checkoutDoneTitle");
  var doneMsg = document.getElementById("checkoutDoneMsg");
  var cartDrawingsField = document.getElementById("cartDrawingsField");
  var cartDrawingsList = document.getElementById("cartDrawingsList");

  var count = cart.reduce(function (s, i) { return s + i.qty; }, 0);
  if (cartCountEl) cartCountEl.textContent = count;

  function renderSummary() {
    if (!cart.length) {
      summary.innerHTML = '<h3>Order Summary</h3><p style="color:var(--ink-soft)">Your cart is empty. ' +
        '<a href="index.html" style="color:var(--cyan)">Browse products →</a></p>';
      return;
    }
    var total = 0;
    var rows = cart.map(function (i) {
      var line = itemLineTotal(i);
      total += line;
      return '<div class="summary-row"><span>' + i.name + ' × ' + i.qty + '</span><span>' + fmt(line) + '</span></div>';
    }).join("");
    summary.innerHTML =
      '<h3>Order Summary</h3>' + rows +
      '<div class="summary-row summary-row--total"><span>Subtotal</span><span>' + fmt(total) + '</span></div>' +
      '<p class="summary-note">Final price, shipping &amp; lead time confirmed by email. ' +
      'Promo code <strong>WELCOME10</strong> applies to first orders.</p>';
  }

  renderSummary();

  // ===== Per-product drawing slots (shared by both flows) =====
  // One slot per cart item. The data URLs read here are included in BOTH
  // the inquiry POST (/contact) and the PayPal flow (/paypal/capture-order
  // receives them indirectly via the cart payload passed to createPaypalOrder).
  function readFileAsBase64(file, maxBytes, cb) {
    if (!file) return cb(null, null);
    if (!/^image\/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name || "")) {
      return cb({ error: "Only JPG/JPEG files are accepted." });
    }
    if (file.size > maxBytes) {
      return cb({ error: "Each file must be 4 MB or less." });
    }
    var fr = new FileReader();
    fr.onload = function () { cb(null, fr.result); };
    fr.onerror = function () { cb({ error: "Failed to read the file." }); };
    fr.readAsDataURL(file);
  }

  function renderCartDrawings() {
    if (!cartDrawingsField || !cartDrawingsList) return;
    if (!cart.length) {
      cartDrawingsField.hidden = true;
      cartDrawingsList.innerHTML = "";
      return;
    }
    cartDrawingsField.hidden = false;
    cartDrawingsList.innerHTML = cart.map(function (item, idx) {
      var label = (idx + 1) + ". " + (item.name || "Item") +
        (item.grade ? " — " + item.grade : "") +
        (item.spec ? " — " + item.spec : "") +
        (item.qty ? " × " + item.qty + " pcs" : "");
      return '<div class="cart-drawing-slot" data-item-index="' + idx + '">' +
        '<div class="cart-drawing-slot__header">' +
          '<span class="cart-drawing-slot__num">' + (idx + 1) + '</span>' +
          '<span class="cart-drawing-slot__label">' + label + '</span>' +
        '</div>' +
        '<label for="cartDrawing_' + idx + '" class="drawing-file-trigger">' +
          '<span class="drawing-file-trigger__icon">📎</span>' +
          '<span class="drawing-file-trigger__text">Choose JPG</span>' +
          '<span class="drawing-file-trigger__filename" id="cartDrawingFilename_' + idx + '"></span>' +
          '<span class="drawing-file-trigger__hint">(optional, max 4 MB)</span>' +
          '<input type="file" id="cartDrawing_' + idx + '" accept="image/jpeg,.jpg" class="drawing-input">' +
        '</label>' +
        '<div class="drawing-preview" id="cartDrawingPreview_' + idx + '"></div>' +
      '</div>';
    }).join("");
    // Wire up live preview thumbnails
    cart.forEach(function (item, idx) {
      var input = document.getElementById("cartDrawing_" + idx);
      var preview = document.getElementById("cartDrawingPreview_" + idx);
      var filename = document.getElementById("cartDrawingFilename_" + idx);
      if (!input) return;
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (filename) filename.textContent = file ? file.name : "";
        if (preview) preview.innerHTML = "";
        if (!file) return;
        readFileAsBase64(file, 4 * 1024 * 1024, function (err, dataUrl) {
          if (err) { if (filename) filename.textContent = ""; if (preview) preview.innerHTML = '<span style="color:#ef4444;font-size:12px">' + err.error + '</span>'; return; }
          if (preview) preview.innerHTML = '<div class="drawing-preview__item"><img src="' + dataUrl + '" alt="Drawing preview"></div>';
        });
      });
    });
  }
  renderCartDrawings();

  // ===== Collect current form values (used by both flows) =====
  function readForm() {
    var f = form.elements;
    return {
      name:    (f.name    && f.name.value.trim())    || "",
      email:   (f.email   && f.email.value.trim())   || "",
      company: (f.company && f.company.value.trim()) || "",
      phone:   (f.phone   && f.phone.value.trim())   || "",
      country: (f.country && f.country.value.trim()) || "",
      address: (f.address && f.address.value.trim()) || "",
      city:    (f.city    && f.city.value.trim())    || "",
      zip:     (f.zip     && f.zip.value.trim())     || "",
      notes:   (f.notes   && f.notes.value.trim())   || "",
    };
  }
  function validateContact(v) {
    var missing = [];
    if (!v.name) missing.push("Full Name");
    if (!v.email) missing.push("Email");
    if (!v.country) missing.push("Country");
    if (!v.address) missing.push("Street Address");
    if (missing.length) return "Please fill in: " + missing.join(", ");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return "Please enter a valid email address.";
    return null;
  }

  // Read every drawing slot into base64 (sequential to keep memory low).
  // Calls back with [{item: label, dataUrl: dataUrl}] or [] if none.
  function collectCartDrawings(cb) {
    var result = [];
    var i = 0;
    function next() {
      if (i >= cart.length) return cb(result);
      var idx = i++;
      var item = cart[idx];
      var label = (idx + 1) + ". " + (item.name || "Item") +
        (item.grade ? " — " + item.grade : "") +
        (item.spec ? " — " + item.spec : "") +
        (item.qty ? " × " + item.qty + " pcs" : "");
      var input = document.getElementById("cartDrawing_" + idx);
      var file = input && input.files && input.files[0];
      if (!file) return next();
      readFileAsBase64(file, 4 * 1024 * 1024, function (err, dataUrl) {
        if (err) { alert(err.error); return; } // bail on the whole submission
        result.push({ item: label, dataUrl: dataUrl });
        next();
      });
    }
    next();
  }

  function showDone(opts) {
    if (doneIco) doneIco.textContent = opts.ico || "✅";
    if (doneTitle) doneTitle.textContent = opts.title || "Done!";
    if (doneMsg) doneMsg.textContent = opts.msg || "Thanks — we'll be in touch shortly.";
    if (form) form.style.display = "none";
    if (cartDrawingsField) cartDrawingsField.hidden = true;
    if (summary) summary.style.display = "none";
    var depEl = document.getElementById("paypalDeposit");
    if (depEl) depEl.hidden = true;
    done.hidden = false;
  }

  // ===== Left button: Send Inquiry (no payment) =====
  var inquiryBtn = document.getElementById("inquiryBtn");
  if (inquiryBtn) {
    inquiryBtn.addEventListener("click", function () {
      if (!cart.length) { alert("Your cart is empty."); return; }
      var v = readForm();
      var vErr = validateContact(v);
      if (vErr) { alert(vErr); return; }

      inquiryBtn.disabled = true;
      var original = inquiryBtn.textContent;
      inquiryBtn.textContent = "Sending…";

      collectCartDrawings(function (cartDrawings) {
        var subtotal = cart.reduce(function (s, it) { return s + itemLineTotal(it); }, 0);
        var items = cart.map(function (it) {
          return { name: it.name, qty: it.qty, line: +itemLineTotal(it).toFixed(2) };
        });
        // Notes = user's own remarks only; items are sent separately in `items`
        var payload = {
          name: v.name, email: v.email, company: v.company, phone: v.phone,
          country: v.country, address: v.address, city: v.city, zip: v.zip,
          notes: v.notes, items: items, subtotal: +subtotal.toFixed(2),
          cartDrawings: cartDrawings, source: "checkout-inquiry",
        };
        fetch("https://huapeng-magnet.com/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(payload)
        })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (res && res.ok) {
              try { localStorage.removeItem(CART_KEY); } catch (e) {}
              if (cartCountEl) cartCountEl.textContent = "0";
              showDone({
                ico: "✅",
                title: "Inquiry sent!",
                msg: "We've received your inquiry and will reply to " + v.email + " within 1 business day with pricing, lead time and payment details."
              });
            } else {
              alert("Submit failed. Please try again or email us at info@huapeng-magnet.com");
              inquiryBtn.disabled = false;
              inquiryBtn.textContent = original;
            }
          })
          .catch(function () {
            alert("Network error. Please try again or email us at info@huapeng-magnet.com");
            inquiryBtn.disabled = false;
            inquiryBtn.textContent = original;
          });
      });
    });
  }

  // ===== Right column: PayPal 30% deposit =====
  var depositEl = document.getElementById("paypalDeposit");
  var depositAmountEl = document.getElementById("depositAmount");
  var btnWrapEl = document.getElementById("paypalBtnWrap");
  var hintEl = document.getElementById("paypalHint");

  function calcDeposit(items) {
    if (!items || !items.length) return 0;
    var total = items.reduce(function (s, i) { return s + itemLineTotal(i); }, 0);
    var deposit = Math.round(total * 0.3 * 100) / 100;
    if (deposit > 2000) deposit = 2000;
    return Math.max(deposit, 0);
  }

  async function fetchPaypalConfig() {
    try {
      var r = await fetch("https://huapeng-magnet.com/paypal/config");
      return await r.json();
    } catch (e) { return null; }
  }

  // The PayPal flow on the Worker side already notifies Feishu on capture with
  // the customer's name/email. We additionally pass the address & phone as
  // custom_id metadata so the Feishu notification can show them too.
  async function createPaypalOrder(deposit, customer, drawingsCount) {
    var items = cart.map(function (i) {
      return { name: i.name, qty: i.qty, price: itemUnitPrice(i) };
    });
    var customId = "order" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    try {
      var r2 = await fetch("https://huapeng-magnet.com/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: deposit,
          currency: "USD",
          description: "Huapeng deposit 30% — " + fmt(deposit),
          customId: customId,
          customer: customer,
          items: items,
          drawingsCount: drawingsCount,
        }),
      });
      var j2 = await r2.json();
      if (!j2.ok || !j2.id) throw new Error(j2.error || "create failed");
      return j2.id;
    } catch (e) {
      throw new Error("Failed to create PayPal order: " + String(e.message));
    }
  }

  function renderPaypalButton(clientId, paypalOrderId, customer) {
    if (!window.paypal) {
      if (hintEl) hintEl.textContent = "PayPal SDK not loaded. Please enable third-party cookies or try again.";
      return;
    }
    if (!btnWrapEl) return;
    btnWrapEl.innerHTML = "";
    paypal.Buttons({
      style: { layout: "vertical", color: "blue", shape: "pill" },
      createOrder: function () { return paypalOrderId; },
      onApprove: function (data) {
        if (hintEl) hintEl.textContent = "Verifying payment… please wait.";
        fetch("https://huapeng-magnet.com/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paypalOrderId: data.orderID,
            // Pass the rest of the form so the Worker's webhook to Feishu can
            // include phone + address (Worker normally only gets name/email
            // from PayPal, not the rest of the form).
            customer: customer,
            cartSummary: {
              items: cart.map(function (it) {
                return { name: it.name, qty: it.qty, line: +itemLineTotal(it).toFixed(2) };
              }),
              subtotal: +cart.reduce(function (s, it) { return s + itemLineTotal(it); }, 0).toFixed(2),
            }
          }),
        })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j.ok) {
              alert("Payment capture failed: " + (j.error || "unknown"));
              if (hintEl) hintEl.textContent = "";
              return;
            }
            // Capture succeeded. Also POST /contact once with the FULL form
            // payload so the Worker's notifyWebhook routine sends a complete
            // Feishu message (name + email + phone + address + items).
            // The Worker only emits a short PayPal-only message from /paypal/capture-order.
            // (Per-product drawings are skipped here: FileReader is async and
            // a successful capture shouldn't be blocked on file I/O. The
            // "Send Inquiry (No Payment)" path on the left is the one that
            // uploads drawings synchronously.)
            var v = readForm();
            var subtotalNum = cart.reduce(function (s, it) { return s + itemLineTotal(it); }, 0);
            var items = cart.map(function (it) {
              return { name: it.name, qty: it.qty, line: +itemLineTotal(it).toFixed(2) };
            });
            var payNote = "PayPal deposit captured · $ " + calcDeposit(cart).toFixed(2) + " USD · PayPal Order " + data.orderID;
            fetch("https://huapeng-magnet.com/contact", {
              method: "POST",
              headers: { "Content-Type": "application/json; charset=utf-8" },
              body: JSON.stringify({
                name: v.name || customer.name || "",
                email: v.email || customer.email || "",
                company: v.company || customer.company || "",
                phone: v.phone || customer.phone || "",
                country: v.country || customer.country || "",
                address: v.address || customer.address || "",
                city: v.city || customer.city || "",
                zip: v.zip || customer.zip || "",
                notes: (v.notes ? v.notes + "\n\n" : "") + payNote,
                items: items,
                subtotal: +subtotalNum.toFixed(2),
                source: "checkout-deposit",
              })
            }).catch(function () { /* non-fatal: capture already succeeded */ })
              .then(function () {
                try { localStorage.removeItem(CART_KEY); } catch (e) {}
                if (cartCountEl) cartCountEl.textContent = "0";
                showDone({
                  ico: "💳",
                  title: "Deposit received!",
                  msg: "Thanks " + (customer.name || "") + " — your 30% deposit of " + fmt(calcDeposit(cart)) +
                    " has been captured. We'll email " + (customer.email || "") +
                    " balance, production schedule and shipping details within 1 business day."
                });
              });
          })
          .catch(function () {
            alert("Network error. Please try again or contact sales.");
            if (hintEl) hintEl.textContent = "";
          });
      },
      onError: function (err) {
        alert("PayPal error: " + (err && err.message ? err.message : "unknown error"));
        if (hintEl) hintEl.textContent = "";
      },
      onClick: function () {
        if (hintEl) hintEl.textContent = "Clicking PayPal will open a secure payment page.";
      },
    }).render("#paypalBtnWrap");
  }

  // Also render PayPal button to the footer box (depositBtnWrap) for better UX
  var depositBtnWrapEl = document.getElementById("depositBtnWrap");

  async function initPaypal() {
    if (!depositEl) return;
    var v = readForm();
    var deposit = calcDeposit(cart);
    if (deposit <= 0) {
      depositEl.hidden = true;
      if (depositBtnWrapEl) depositBtnWrapEl.innerHTML = '<p style="color:var(--ink-soft);font-size:13px;padding:8px 0;">Add items to cart and fill in your contact details to unlock the deposit option.</p>';
      return;
    }
    if (depositAmountEl) depositAmountEl.textContent = "Deposit: " + fmt(deposit);
    var cfg = await fetchPaypalConfig();
    if (!cfg || !cfg.configured) {
      depositEl.hidden = true;
      if (depositBtnWrapEl) depositBtnWrapEl.innerHTML = '<p style="color:var(--ink-soft);font-size:13px;padding:8px 0;">Payment configuration unavailable. Please use the inquiry form or contact us at info@huapeng-magnet.com.</p>';
      return;
    }
    depositEl.hidden = false;
    if (hintEl) hintEl.textContent = "Loading PayPal…";
    try {
      // Snapshot the customer NOW (PayPal order creation must use these values,
      // since the form may be edited between order-create and capture).
      var customer = {
        name: v.name || "(no name)",
        email: v.email || "",
        company: v.company || "",
        phone: v.phone || "",
        country: v.country || "",
        address: v.address || "",
        city: v.city || "",
        zip: v.zip || "",
      };
      var paypalOrderId = await createPaypalOrder(deposit, customer, cart.length);
      if (hintEl) hintEl.textContent = "";
      if (!window.paypal) {
        var script = document.createElement("script");
        // Force English locale so PayPal's auto-rendered labels
        // Force English locale so PayPal's auto-rendered labels (e.g. "Debit or credit card", "Powered by PayPal") stay in English.
        script.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(cfg.clientId) + "&currency=USD&locale=en_US";
        script.onload = function () {
          renderPaypalButton(cfg.clientId, paypalOrderId, customer);
          // Also render to footer box if it exists
          if (depositBtnWrapEl && window.paypal) {
            try {
              paypal.Buttons({
                style: { layout: "vertical", color: "blue", shape: "pill" },
                createOrder: function () { return paypalOrderId; },
                onApprove: function (data) {
                  if (hintEl) hintEl.textContent = "Verifying payment… please wait.";
                  fetch("https://huapeng-magnet.com/paypal/capture-order", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      paypalOrderId: data.orderID,
                      customer: customer,
                      cartSummary: {
                        items: cart.map(function (it) {
                          return { name: it.name, qty: it.qty, line: +itemLineTotal(it).toFixed(2) };
                        }),
                        subtotal: +cart.reduce(function (s, it) { return s + itemLineTotal(it); }, 0).toFixed(2),
                      }
                    }),
                  })
                    .then(function (r) { return r.json(); })
                    .then(function (j) {
                      if (!j.ok) {
                        alert("Payment capture failed: " + (j.error || "unknown"));
                        if (hintEl) hintEl.textContent = "";
                        return;
                      }
                      var payNote = "PayPal deposit captured · $ " + calcDeposit(cart).toFixed(2) + " USD · PayPal Order " + data.orderID;
                      fetch("https://huapeng-magnet.com/contact", {
                        method: "POST",
                        headers: { "Content-Type": "application/json; charset=utf-8" },
                        body: JSON.stringify({
                          name: customer.name,
                          email: customer.email,
                          company: customer.company,
                          phone: customer.phone,
                          country: customer.country,
                          address: customer.address,
                          city: customer.city,
                          zip: customer.zip,
                          notes: payNote,
                          items: cart.map(function (it) {
                            return { name: it.name, qty: it.qty, line: +itemLineTotal(it).toFixed(2) };
                          }),
                          subtotal: +cart.reduce(function (s, it) { return s + itemLineTotal(it); }, 0).toFixed(2),
                          source: "checkout-deposit",
                        })
                      }).catch(function () { /* non-fatal */ })
                        .then(function () {
                          try { localStorage.removeItem(CART_KEY); } catch (e) {}
                          if (cartCountEl) cartCountEl.textContent = "0";
                          showDone({
                            ico: "💳",
                            title: "Deposit received!",
                            msg: "Thanks " + (customer.name || "") + " — your 30% deposit of " + fmt(calcDeposit(cart)) +
                              " has been captured. We'll email " + (customer.email || "") +
                              " balance, production schedule and shipping details within 1 business day."
                          });
                        });
                    })
                    .catch(function () {
                      alert("Network error. Please try again or contact sales.");
                      if (hintEl) hintEl.textContent = "";
                    });
                },
                onError: function (err) {
                  alert("PayPal error: " + (err && err.message ? err.message : "unknown error"));
                  if (hintEl) hintEl.textContent = "";
                },
                onClick: function () {
                  if (hintEl) hintEl.textContent = "Clicking PayPal will open a secure payment page.";
                },
              }).render("#depositBtnWrap");
            } catch (e) {
              console.warn("Footer PayPal render failed:", e);
            }
          }
        };
        script.onerror = function () { if (hintEl) hintEl.textContent = "PayPal SDK failed to load. Please check your connection."; };
        document.head.appendChild(script);
      } else {
        renderPaypalButton(cfg.clientId, paypalOrderId, customer);
        // Also render to footer box
        if (depositBtnWrapEl) {
          try {
            paypal.Buttons({
              style: { layout: "vertical", color: "blue", shape: "pill" },
              createOrder: function () { return paypalOrderId; },
              onApprove: function (data) {
                if (hintEl) hintEl.textContent = "Verifying payment… please wait.";
                fetch("https://huapeng-magnet.com/paypal/capture-order", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    paypalOrderId: data.orderID,
                    customer: customer,
                    cartSummary: {
                      items: cart.map(function (it) {
                        return { name: it.name, qty: it.qty, line: +itemLineTotal(it).toFixed(2) };
                      }),
                      subtotal: +cart.reduce(function (s, it) { return s + itemLineTotal(it); }, 0).toFixed(2),
                    }
                  }),
                })
                  .then(function (r) { return r.json(); })
                  .then(function (j) {
                    if (!j.ok) {
                      alert("Payment capture failed: " + (j.error || "unknown"));
                      if (hintEl) hintEl.textContent = "";
                      return;
                    }
                    var payNote = "PayPal deposit captured · $ " + calcDeposit(cart).toFixed(2) + " USD · PayPal Order " + data.orderID;
                    fetch("https://huapeng-magnet.com/contact", {
                      method: "POST",
                      headers: { "Content-Type": "application/json; charset=utf-8" },
                      body: JSON.stringify({
                        name: customer.name,
                        email: customer.email,
                        company: customer.company,
                        phone: customer.phone,
                        country: customer.country,
                        address: customer.address,
                        city: customer.city,
                        zip: customer.zip,
                        notes: payNote,
                        items: cart.map(function (it) {
                          return { name: it.name, qty: it.qty, line: +itemLineTotal(it).toFixed(2) };
                        }),
                        subtotal: +cart.reduce(function (s, it) { return s + itemLineTotal(it); }, 0).toFixed(2),
                        source: "checkout-deposit",
                      })
                    }).catch(function () { /* non-fatal */ })
                      .then(function () {
                        try { localStorage.removeItem(CART_KEY); } catch (e) {}
                        if (cartCountEl) cartCountEl.textContent = "0";
                        showDone({
                          ico: "💳",
                          title: "Deposit received!",
                          msg: "Thanks " + (customer.name || "") + " — your 30% deposit of " + fmt(calcDeposit(cart)) +
                            " has been captured. We'll email " + (customer.email || "") +
                            " balance, production schedule and shipping details within 1 business day."
                        });
                      });
                  })
                  .catch(function () {
                    alert("Network error. Please try again or contact sales.");
                    if (hintEl) hintEl.textContent = "";
                  });
              },
              onError: function (err) {
                alert("PayPal error: " + (err && err.message ? err.message : "unknown error"));
                if (hintEl) hintEl.textContent = "";
              },
              onClick: function () {
                if (hintEl) hintEl.textContent = "Clicking PayPal will open a secure payment page.";
              },
            }).render("#depositBtnWrap");
          } catch (e) {
            console.warn("Footer PayPal render failed:", e);
          }
        }
      }
    } catch (e) {
      alert("Could not initialize PayPal: " + e.message);
      depositEl.hidden = true;
    }
  }

  initPaypal();
})();