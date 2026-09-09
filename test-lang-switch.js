const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://huapeng-magnet.com/', { waitUntil: 'networkidle' });

  // 检查按钮是否存在
  const btn = await page.$('#langBtn');
  console.log('Button exists:', !!btn);

  // 点击按钮
  await btn.click();
  await page.waitForTimeout(300);

  // 检查下拉菜单是否显示
  const dropdown = await page.$('.topbar__lang-dropdown.show');
  console.log('Dropdown visible after click:', !!dropdown);

  if (dropdown) {
    const items = await page.$$('.lang-option');
    console.log('Menu items:', await Promise.all(items.map(el => el.textContent())));
  }

  await browser.close();
})();
