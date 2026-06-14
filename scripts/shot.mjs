// Interactive screenshotter — drives the installed Chrome via puppeteer-core to
// capture UI states that require interaction (team view, modals). Dev-only.
//
// Usage: node scripts/shot.mjs <baseUrl> <outDir>
import puppeteer from 'puppeteer-core';

const CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? '/tmp';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name, { w = 1280, h = 1400 } = {}) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✓ ${name}.png`);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=2'],
});

try {
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(1200); // client fetch + render

  // 1. Home feed (desktop + mobile)
  await shoot(page, 'state-home-desktop');
  await page.setViewport({ width: 420, height: 1500, deviceScaleFactor: 2 });
  await sleep(300);
  await shoot(page, 'state-home-mobile', { w: 420, h: 1500 });

  // 2. Team view — type a team into search, then Follow it
  await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 2 });
  const input = await page.$('input[placeholder^="Search a team"]');
  if (input) {
    await input.click();
    await input.type('Brazil', { delay: 30 });
    await sleep(900);
    await shoot(page, 'state-team-desktop');
    await page.setViewport({ width: 420, height: 1600, deviceScaleFactor: 2 });
    await sleep(300);
    await shoot(page, 'state-team-mobile', { w: 420, h: 1600 });

    // Click the Follow button
    await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 2 });
    const followBtn = await page.evaluateHandle(() =>
      [...document.querySelectorAll('button')].find((b) => /^follow$/i.test((b.textContent ?? '').trim())),
    );
    if (followBtn && (await followBtn.evaluate((n) => !!n))) {
      await followBtn.click();
      await sleep(500);
    }
  } else {
    console.log('! search input not found');
  }

  // 2b. Back home — should now show a Following row
  const wm = await page.$('header button');
  if (wm) {
    await wm.click();
    await sleep(600);
    await shoot(page, 'state-home-following');
  }

  // 3. All Fixtures modal (shows knockout placeholders too)
  await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 2 });
  // clear team first by clicking wordmark
  const wordmark = await page.$('header button');
  if (wordmark) {
    await wordmark.click();
    await sleep(400);
  }
  const allBtn = await page.evaluateHandle(() => {
    return [...document.querySelectorAll('button')].find((b) =>
      /all fixtures/i.test(b.textContent ?? ''),
    );
  });
  if (allBtn && (await allBtn.evaluate((n) => !!n))) {
    await allBtn.click();
    await sleep(700);
    await shoot(page, 'state-all-fixtures');
    // Scroll the modal's scroll area to the bottom to verify scrolling + see knockouts/TBD
    const scrolled = await page.evaluate(() => {
      const el = document.querySelector(
        '[data-slot="dialog-content"] .overflow-y-auto',
      );
      if (!el) return null;
      const before = el.scrollTop;
      el.scrollTop = el.scrollHeight;
      return { before, after: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
    });
    console.log('  scroll:', JSON.stringify(scrolled));
    await sleep(500);
    await shoot(page, 'state-all-fixtures-bottom');
    await page.keyboard.press('Escape');
    await sleep(400);
  } else {
    console.log('! all-fixtures button not found');
  }
} finally {
  await browser.close();
}
