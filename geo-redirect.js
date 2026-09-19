/* ===========================================================
   Huapeng Magnetics — Geo-based language redirect
   Detects visitor location via IP geolocation API,
   then redirects to /de/ or /es/ if appropriate.
   Falls back to browser language preference.
   =========================================================== */
(function () {
  "use strict";

  var CURRENT_PATH = window.location.pathname;
  var CURRENT_HOST = window.location.hostname;
  var IS_DE = CURRENT_PATH.indexOf('/de/') === 0;
  var IS_ES = CURRENT_PATH.indexOf('/es/') === 0;
  var IS_EN = !IS_DE && !IS_ES;

  // Only redirect on homepage or if no language prefix exists
  if (IS_DE || IS_ES) return; // Already on language-specific page

  // Check if user has already chosen a language (stored in localStorage)
  var savedLang = localStorage.getItem('hp_lang_preference');
  if (savedLang && (savedLang === 'de' || savedLang === 'es')) {
    if ((savedLang === 'de' && !IS_DE) || (savedLang === 'es' && !IS_ES)) {
      var targetPath = '/' + savedLang + CURRENT_PATH;
      window.location.href = targetPath;
    }
    return;
  }

  // Try IP-based geolocation (free API)
  var GEO_API = 'https://ipapi.co/json/';

  function redirectByLang(lang) {
    if (lang === 'de' && !IS_DE) {
      localStorage.setItem('hp_lang_preference', 'de');
      window.location.href = '/de' + CURRENT_PATH;
    } else if (lang === 'es' && !IS_ES) {
      localStorage.setItem('hp_lang_preference', 'es');
      window.location.href = '/es' + CURRENT_PATH;
    }
  }

  // Method 1: Try IP geolocation
  fetch(GEO_API, { signal: AbortSignal.timeout(3000) })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var country = (data.country_code || '').toLowerCase();
      var lang = null;

      // German-speaking countries
      if (['de', 'at', 'ch'].indexOf(country) !== -1) {
        lang = 'de';
      }
      // Spanish-speaking countries
      else if (['es', 'mx', 'ar', 'co', 'cl', 'pe', 've', 'cr', 'pa', 'uy', 'py', 'bo', 'ec', 'gt', 'hn', 'ni', 'sv', 'do', 'cu', 'pr'].indexOf(country) !== -1) {
        lang = 'es';
      }

      if (lang) {
        redirectByLang(lang);
      }
    })
    .catch(function () {
      // Fallback to browser language
      checkBrowserLanguage();
    });

  // Method 2: Fallback to browser language
  function checkBrowserLanguage() {
    var browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();

    if (browserLang.indexOf('de') === 0) {
      redirectByLang('de');
    } else if (browserLang.indexOf('es') === 0) {
      redirectByLang('es');
    }
    // Otherwise stay on English
  }

  // Manual override button (for users who want to change language)
  document.addEventListener('DOMContentLoaded', function () {
    var langBtn = document.getElementById('langBtn');
    if (langBtn) {
      langBtn.addEventListener('click', function () {
        // Clear saved preference when user manually changes
        localStorage.removeItem('hp_lang_preference');
      });
    }
  });
})();
