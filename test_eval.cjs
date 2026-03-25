const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    console.log('STACK:', err.stack);
  });
  await page.goto('http://localhost:5174');
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
