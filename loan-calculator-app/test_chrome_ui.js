const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:/Users/Daniel/.gemini/antigravity/brain/7b2541f6-d20f-4af3-b396-e859b69893c2');

async function run() {
  console.log('Launching Chrome window...');
  const browser = await puppeteer.launch({
    headless: false, // Visible Chrome window!
    defaultViewport: { width: 1440, height: 900 },
    args: ['--start-maximized']
  });
  const page = await browser.newPage();
  
  async function snap(name) {
    const file = path.join(ARTIFACT_DIR, name);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`✓ Captured: ${name}`);
  }

  // Step 1: Landing / Auth
  console.log('Navigating to landing page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await snap('chrome_1_login.png');

  // Login
  console.log('Logging in as admin...');
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].type('admin');
    await inputs[1].type('123');
  }
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) await submitBtn.click();

  // Step 2: Rooms Page
  await new Promise(r => setTimeout(r, 2000));
  await snap('chrome_2_rooms.png');

  // Step 3: Room Dashboard
  console.log('Navigating to room dashboard J990GT...');
  await page.goto('http://localhost:3000/rooms/J990GT', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await snap('chrome_3_dashboard.png');

  // Step 4: Admin Modal
  console.log('Opening Admin Panel Modal...');
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent || el.title, b);
    if (text && (text.includes('Admin') || text.includes('⚙️') || text.includes('Settings'))) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));
  await snap('chrome_4_admin_modal.png');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 800));

  // Step 5: Multi-Party Split Selector
  console.log('Opening Multi-Party Split Selector...');
  for (const b of (await page.$$('button'))) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && (text.includes('Split') || text.includes('Custom') || text.includes('Multi') || text.includes('Advance'))) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));
  await snap('chrome_5_split_selector.png');

  // Step 6: Balance Matrix
  console.log('Navigating to Balance Matrix...');
  await page.goto('http://localhost:3000/rooms/J990GT/balance', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await snap('chrome_6_balance_matrix.png');

  // Step 7: Audit Trail
  console.log('Navigating to Entries & Audit Trail...');
  await page.goto('http://localhost:3000/rooms/J990GT/entries', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  
  const clockBtns = await page.$$('button');
  for (const b of clockBtns) {
    const text = await page.evaluate(el => el.textContent || el.title, b);
    if (text && text.includes('🕒')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));
  await snap('chrome_7_audit_trail.png');

  console.log('All Chrome UI walkthrough steps finished successfully!');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
}

run().catch(e => {
  console.error('Browser automation error:', e);
  process.exit(1);
});
