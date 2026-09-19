/* ===========================================================
   verify_shared_assets.js
   Proves that no localised page still requests its own assets folder.

   Serves the site locally, drives the real Edge browser, records every
   network request made by each page, and asserts:
     1. nothing requests /de/assets/... or /es/assets/...
     2. every image request returns 200 (not 404)
     3. every image URL that does load comes from /assets/ (shared)

   Usage:
     NODE_PATH=... node _tools/verify_shared_assets.js
   =========================================================== */
const { chromium } = require('playwright');

const PORT = process.env.PORT || 8899;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const PAGES = [
  ['en index', '/'],
  ['en quote', '/request-quote.html'],
  ['de index', '/de/'],
  ['de quote', '/de/request-quote.html'],
  ['es index', '/es/'],
  ['es quote', '/es/request-quote.html'],
];

const IMG_EXT = /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  let pass = 0, fail = 0;
  const chk = (name, ok, detail) => {
    ok ? pass++ : fail++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
  };

  for (const [label, path] of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const requests = [];
    const failures = [];
    page.on('request', (r) => requests.push(r.url()));
    page.on('requestfailed', (r) => failures.push(r.url() + ' :: ' + (r.failure() || {}).errorText));
    const bad = [];
    page.on('response', (r) => {
      if (r.status() >= 400) bad.push(r.status() + ' ' + r.url());
    });

    await page.goto(ORIGIN + path, { waitUntil: 'networkidle', timeout: 45000 });
    // let lazy-loaded / JS-built content appear
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2500);

    console.log(`\n=== ${label}  (${path}) ===`);
    const perLocale = requests.filter((u) => /\/(de|es)\/assets\//.test(u));
    chk(`${label}: no request to its own /<lang>/assets/`, perLocale.length === 0,
        perLocale.slice(0, 3).join(', ') || 'clean');

    const imgReqs = requests.filter((u) => IMG_EXT.test(u) && u.indexOf(ORIGIN) === 0);
    const shared = imgReqs.filter((u) => u.indexOf('/assets/') > -1);
    chk(`${label}: images served from shared /assets/`, imgReqs.length > 0 && shared.length === imgReqs.length,
        `${shared.length}/${imgReqs.length} from /assets/`);

    const img4xx = bad.filter((b) => IMG_EXT.test(b));
    chk(`${label}: no missing image (4xx/5xx)`, img4xx.length === 0,
        img4xx.slice(0, 4).join(' | ') || 'none');

    const hardFail = failures.filter((u) => IMG_EXT.test(u) && u.indexOf('cdnjs') === -1);
    chk(`${label}: no failed image request`, hardFail.length === 0,
        hardFail.slice(0, 3).join(' | ') || 'none');

    await ctx.close();
  }

  await browser.close();
  console.log(`\nRESULT: ${pass}/${pass + fail} passed${fail ? '   <-- FAILURES' : ''}`);
  process.exit(fail ? 1 : 0);
})();
