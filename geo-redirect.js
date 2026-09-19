/* ===========================================================
   Huapeng Magnetics — automatic language routing (V2)
   -----------------------------------------------------------
   Shows visitors the site language that matches where they are:

     IP in DE / AT / CH          → /de/
     IP in a Spanish-speaking
       country (ES + LatAm)      → /es/
     everything else             → English (site root)

   Priority order:
     1. ?lang=en|de|es  (explicit link — always wins, also persisted)
     2. saved preference from a previous visit (language switcher)
     3. IP geolocation (api.country.is, fallback ipapi.co)
     4. browser language (navigator.language)

   Safe by design:
     - never redirects when the visitor is already on the right prefix
     - skips search-engine crawlers and bots (SEO safety)
     - 2.5s network timeout, then silently falls back
   =========================================================== */
(function () {
  "use strict";

  var SUPPORTED = ["en", "de", "es"];
  var STORAGE_KEY = "hp_lang_preference";
  var GEO_TIMEOUT = 2500;

  /* ---------- Bot / crawler guard (never redirect them) ---------- */
  var ua = navigator.userAgent || "";
  if (/bot|crawler|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|headless|lighthouse|python-requests|curl|wget|axios|node-fetch/i.test(ua)) {
    return;
  }

  /* ---------- Path helpers ---------- */
  function currentLang(path) {
    if (path.indexOf("/de/") === 0 || path === "/de") return "de";
    if (path.indexOf("/es/") === 0 || path === "/es") return "es";
    return "en";
  }

  /* '/de/request-quote.html' → '/request-quote.html'
     '/es/'                   → '/'                        */
  function barePath(path, lang) {
    if (lang === "en") return path;
    var rest = path.slice(3);          // strip '/de' or '/es'
    return rest === "" ? "/" : rest;
  }

  function buildPath(lang, bare) {
    if (lang === "en") return bare;
    return "/" + lang + (bare === "/" ? "/" : bare);
  }

  var path = window.location.pathname;
  var here = currentLang(path);
  var bare = barePath(path, here);
  var query = window.location.search || "";

  /* Only redirect on pages that actually have localised versions
     (de/ and es/ currently ship index, request-quote and calculator).
     Any other page keeps its language so we never send a visitor to a 404. */
  var REDIRECTABLE = ["/", "/index.html", "/request-quote.html", "/request-quote",
                      "/calculator.html", "/calculator"];
  if (REDIRECTABLE.indexOf(bare) === -1) return;

  function go(lang, persist) {
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    }
    if (lang === here) return false;
    window.location.replace(buildPath(lang, bare) + query + window.location.hash);
    return true;
  }

  /* ---------- 1. Explicit ?lang= override ---------- */
  var forced = "";
  try {
    forced = (new URLSearchParams(window.location.search).get("lang") || "").toLowerCase();
  } catch (e) { /* very old browser — ignore */ }

  if (SUPPORTED.indexOf(forced) !== -1) {
    try { localStorage.setItem(STORAGE_KEY, forced); } catch (e) {}
    if (forced !== here) {
      window.location.replace(buildPath(forced, bare) + window.location.hash);
    }
    return;
  }

  /* ---------- 2. Saved preference ---------- */
  var saved = "";
  try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch (e) {}

  if (SUPPORTED.indexOf(saved) !== -1) {
    if (go(saved, false)) return;
    return; // already on the preferred language
  }

  /* ---------- 3 & 4. Detect, then redirect ----------
     Three explicit lists, checked in order (de -> es -> en).
     Anything not listed anywhere also falls through to English, so the
     EN_COUNTRIES list is documentation as much as logic: it spells out the
     markets we deliberately serve in English instead of leaving them to an
     implicit default. Add a country to EN_COUNTRIES when English is an
     official or primary business language there. */

  /* German-speaking */
  var DE_COUNTRIES = ["de", "at", "ch", "li", "lu"];

  /* Spanish-speaking: Spain + Latin America */
  var ES_COUNTRIES = ["es", "mx", "ar", "co", "cl", "pe", "ve", "cr", "pa", "uy", "py", "bo", "ec", "gt", "hn", "ni", "sv", "do", "cu", "pr", "ad"];

  /* English-speaking / English is an OFFICIAL language.
     Core export markets first, then the wider Anglophone set.
     Kept as an explicit list rather than relying on the implicit default so a
     reviewer can see at a glance which countries we deliberately serve in
     English. Behaviour is unchanged either way: anything not listed anywhere
     also falls through to English at the bottom of langForCountry(). */
  var EN_COUNTRIES = [
    // core English-speaking markets
    "us", "gb", "ie", "ca", "au", "nz",
    // Asia-Pacific: English is an official language
    "in", "sg", "ph", "my", "pk", "lk", "bd",
    // Africa: English is an official language
    "za", "ng", "ke", "gh", "tz", "ug", "zm", "zw", "bw", "na",
    "mw", "mu", "sc", "rw", "sl", "lr", "gm",
    // Pacific & Caribbean
    "fj", "pg", "sb", "vu", "ws", "to", "nr", "ki", "tv",
    "jm", "tt", "bb", "bs", "bz", "gy", "ag", "dm", "gd", "kn", "lc",
    "vc", "ai", "bm", "vg", "ky", "ms", "tc", "fk", "gi", "mt"
  ];

  function langForCountry(cc) {
    cc = (cc || "").toLowerCase();
    if (DE_COUNTRIES.indexOf(cc) !== -1) return "de";
    if (ES_COUNTRIES.indexOf(cc) !== -1) return "es";
    if (EN_COUNTRIES.indexOf(cc) !== -1) return "en";
    return "en"; // anything unlisted also gets English
  }

  function langForBrowser() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ""];
    for (var i = 0; i < list.length; i++) {
      var l = (list[i] || "").toLowerCase();
      if (l.indexOf("de") === 0) return "de";
      if (l.indexOf("es") === 0) return "es";
      if (l.indexOf("en") === 0) return "en";
    }
    return "en";
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("timeout")); }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); },
                   function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function fetchJSON(url) {
    return withTimeout(fetch(url, { credentials: "omit" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }), GEO_TIMEOUT);
  }

  /* api.country.is is the primary: it is fast and sends `Access-Control-
     Allow-Origin: *`. ipapi.co used to lead, but it now sits behind a
     Cloudflare interstitial, so a browser fetch from this page gets a 403
     challenge with no CORS header and always fails — keep it as the backup
     only. */
  fetchJSON("https://api.country.is/")
    .then(function (d) { return d && d.country; })
    .catch(function () {
      return fetchJSON("https://ipapi.co/json/").then(function (d) { return d && d.country_code; });
    })
    .then(function (cc) {
      var lang = cc ? langForCountry(cc) : langForBrowser();
      go(lang, false);
    })
    .catch(function () {
      go(langForBrowser(), false);
    });

  /* ---------- Language switcher: remember explicit choices ----------
     Kept in sync with the same handler in js/main.js. Storing 'en' is
     deliberate: clearing the key would let geo detection bounce an
     English speaker straight back to /de/ or /es/. */
  document.addEventListener("DOMContentLoaded", function () {
    var links = document.querySelectorAll("a.lang-option, a[data-lang]");
    Array.prototype.forEach.call(links, function (a) {
      a.addEventListener("click", function () {
        var l = (a.getAttribute("data-lang") || "").toLowerCase();
        if (SUPPORTED.indexOf(l) === -1) return;
        try { localStorage.setItem(STORAGE_KEY, l); } catch (e) {}
      });
    });
  });
})();
