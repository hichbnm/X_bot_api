const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto('https://example.com');
    console.log('Puppeteer launch: SUCCESS');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Puppeteer launch: FAIL', err);
    process.exit(1);
  }
})();
