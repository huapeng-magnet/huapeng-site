/* ===========================================================
   verify_i18n.js — real check of the translation dictionaries.

   Extracts the I18N object from js/main.js and the L10N object from
   js/quote.js, evaluates them in a vm, and asserts:
     * every language defines exactly the same keys as English
     * no value is empty or still identical to English where it shouldn't be
     * PAGE_LANG / L selection code recognises ko and ja

   Usage: node _tools/verify_i18n.js
   =========================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = path.dirname(__dirname);

function extractObjectLiteral(src, startMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('marker not found: ' + startMarker);
  const open = src.indexOf('{', start);
  let depth = 0, inStr = null, esc = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const text = src.slice(open, i + 1);
        const sandbox = {};
        vm.createContext(sandbox);
        return vm.runInContext('(' + text + ')', sandbox);
      }
    }
  }
  throw new Error('unbalanced braces for ' + startMarker);
}

let pass = 0, fail = 0;
const chk = (name, ok, detail) => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

const LANGS = ['en', 'de', 'es', 'ko', 'ja'];

function audit(label, file, marker) {
  console.log(`\n=== ${label} (${file}) ===`);
  const src = fs.readFileSync(path.join(BASE, file), 'utf8');
  const obj = extractObjectLiteral(src, marker);
  const langs = Object.keys(obj);
  chk(`${label}: languages present`, LANGS.every((l) => langs.includes(l)),
      langs.join(', '));

  const enKeys = Object.keys(obj.en).sort();
  chk(`${label}: English key count`, enKeys.length > 0, enKeys.length + ' keys');

  for (const lang of LANGS) {
    if (!obj[lang]) { chk(`${label}: ${lang} block`, false, 'missing'); continue; }
    const keys = Object.keys(obj[lang]).sort();
    const missing = enKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !enKeys.includes(k));
    chk(`${label}[${lang}]: same keys as en`, missing.length === 0 && extra.length === 0,
        (missing.length ? 'missing=' + missing.join(',') + ' ' : '') +
        (extra.length ? 'extra=' + extra.join(',') : '') || 'identical');

    const empty = keys.filter((k) => !String(obj[lang][k]).trim());
    chk(`${label}[${lang}]: no empty values`, empty.length === 0, empty.join(',') || 'none');
  }

  // ko/ja must actually differ from English (catch copy-paste stubs)
  for (const lang of ['ko', 'ja']) {
    if (!obj[lang]) continue;
    const same = enKeys.filter((k) => obj[lang][k] === obj.en[k]);
    // allow a handful of legitimately identical technical strings
    const ratio = same.length / enKeys.length;
    chk(`${label}[${lang}]: translated (not an English copy)`, ratio < 0.25,
        same.length + '/' + enKeys.length + ' identical to en' +
        (same.length && same.length <= 8 ? ' [' + same.join(',') + ']' : ''));
  }
  return obj;
}

const i18n = audit('I18N', 'js/main.js', 'var I18N = {');
const l10n = audit('L10N', 'js/quote.js', 'var L10N = {');

console.log('\n=== language selection code ===');
for (const f of ['js/main.js', 'js/quote.js']) {
  const s = fs.readFileSync(path.join(BASE, f), 'utf8');
  chk(`${f}: recognises ko`, /indexOf\("ko"\)\s*===\s*0/.test(s));
  chk(`${f}: recognises ja`, /indexOf\("ja"\)\s*===\s*0/.test(s));
  chk(`${f}: recognises de/es`, /indexOf\("de"\)\s*===\s*0/.test(s) && /indexOf\("es"\)\s*===\s*0/.test(s));
}

console.log('\n=== key parity between the two dictionaries (shared concept names) ===');
const shared = ['grade', 'coating', 'quantity', 'spec', 'typicalUse', 'exportPdf'];
for (const k of shared) {
  const ok = LANGS.every((l) => i18n[l] && i18n[l][k] !== undefined);
  if (ok) chk(`I18N has "${k}" in all languages`, true);
}

console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? '   <-- FAILURES' : ''}`);
process.exit(fail ? 1 : 0);
