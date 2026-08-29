/* ===========================================================
   Huapeng Magnetics — checkout page
   =========================================================== */
(function () {
  "use strict";

  var CONTACT_EMAIL = "info@huapeng-magnet.com";
  var CART_KEY = "hp_cart";

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function fmt(n) { return "$" + n.toFixed(2); }

  var cart = loadCart();
  var cartCountEl = document.getElementById("cartCount");
  var summary = document.getElementById("orderSummary");
  var form = document.getElementById("checkoutForm");
  var done = document.getElementById("checkoutDone");

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
      var line = i.price * i.qty;
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

  // Auto-fill order notes with cart contents so customers don't re-type specs
  var notesEl = document.getElementById("notes");
  if (notesEl && cart.length && !notesEl.value.trim()) {
    var total = cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var lines = cart.map(function (i) { return "- " + i.name + " × " + i.qty; }).join("\n");
    notesEl.value = "Products inquired from shopping cart:\n" + lines +
      "\nSubtotal: " + fmt(total) +
      "\n\nPlease confirm final price, coating and lead time.";
  }

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!cart.length) { alert("Your cart is empty."); return; }
      var f = form.elements;
      var required = ["name", "email", "country", "address"];
      for (var i = 0; i < required.length; i++) {
        if (!f[required[i]].value.trim()) {
          alert("Please fill in: " + required[i]);
          f[required[i]].focus();
          return;
        }
      }
      var total = cart.reduce(function (s, it) { return s + it.price * it.qty; }, 0);
      var lines = cart.map(function (it) {
        return { name: it.name, qty: it.qty, line: +(it.price * it.qty).toFixed(2) };
      });
      var payload = {
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        company: f.company.value.trim(),
        phone: f.phone.value.trim(),
        country: f.country.value.trim(),
        address: f.address.value.trim(),
        city: f.city.value.trim(),
        zip: f.zip.value.trim(),
        notes: f.notes.value.trim(),
        items: lines,
        subtotal: +total.toFixed(2)
      };
      var btn = form.querySelector("button[type=submit]");
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      fetch("https://huapeng-magnet.com/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok) {
            try { localStorage.removeItem(CART_KEY); } catch (e) {}
            if (cartCountEl) cartCountEl.textContent = "0";
            form.style.display = "none";
            summary.style.display = "none";
            done.hidden = false;
          } else {
            alert("Submit failed. Please try again or email us at info@huapeng-magnet.com");
            if (btn) { btn.disabled = false; btn.textContent = "Submit Order Inquiry"; }
          }
        })
        .catch(function () {
          alert("Network error. Please try again or email us at info@huapeng-magnet.com");
          if (btn) { btn.disabled = false; btn.textContent = "Submit Order Inquiry"; }
        });
    });
  }
})();
