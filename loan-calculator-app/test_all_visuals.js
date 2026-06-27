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

  // Step 1: Landing & Toggle to Light Theme
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  console.log('Toggling theme switcher to Light Mode...');
  const themeBtn = await page.$('button[aria-label="Toggle theme"]');
  if (themeBtn) await themeBtn.click();
  await new Promise(r => setTimeout(r, 1000));
  await snap('theme_1_light_hub.png');

  // Login as admin
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].type('admin');
    await inputs[1].type('123');
  }
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) await submitBtn.click();
  await new Promise(r => setTimeout(r, 2000));

  // Step 2: Room Dashboard in Light Mode
  await page.goto('http://localhost:3000/rooms/J990GT', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await snap('theme_2_light_dashboard.png');

  // Step 3: Toggle back to Dark Theme
  console.log('Toggling theme switcher back to Dark Mode...');
  const themeBtn2 = await page.$('button[aria-label="Toggle theme"]');
  if (themeBtn2) await themeBtn2.click();
  await new Promise(r => setTimeout(r, 1000));
  await snap('theme_3_dark_dashboard.png');

  // Step 4: Admin Modal
  console.log('Opening Admin Panel Modal...');
  for (const b of (await page.$$('button'))) {
    const text = await page.evaluate(el => el.textContent || el.title, b);
    if (text && (text.includes('Admin') || text.includes('⚙️') || text.includes('Settings'))) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));
  await snap('panel_4_admin.png');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 800));

  // Step 5: Multi-Party Split Modal
  console.log('Opening Multi-Party Split Modal...');
  for (const b of (await page.$$('button'))) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && (text.includes('Split') || text.includes('Custom') || text.includes('Multi') || text.includes('Advance'))) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1200));
  await snap('panel_5_split_modal.png');

  // Step 6: Entries page -> Edit modal
  await page.goto('http://localhost:3000/rooms/J990GT/entries', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  for (const b of (await page.$$('button'))) {
    const text = await page.evaluate(el => el.textContent || el.title, b);
    if (text && (text.includes('Edit') || text.includes('✏️'))) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));
  await snap('panel_6_edit_entry.png');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 800));

  // Step 7: Audit History Popup 🕒
  for (const b of (await page.$$('button'))) {
    const text = await page.evaluate(el => el.textContent || el.title, b);
    if (text && text.includes('🕒')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));
  await snap('panel_7_audit_trail.png');

  // Step 8: Passive Member View Simulation (charlie)
  console.log('Simulating Passive Member locked view...');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  const inputsP = await page.$$('input');
  if (inputsP.length >= 2) {
    await inputsP[0].type('charlie');
    await inputsP[1].type('123');
  }
  const submitP = await page.$('button[type="submit"]');
  if (submitP) await submitP.click();
  await new Promise(r => setTimeout(r, 2000));
  await page.goto('http://localhost:3000/rooms/J990GT', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await snap('role_8_passive_view.png');

  // Step 9: Observer View Simulation (dave)
  console.log('Simulating Observer calculation banner...');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  const inputsO = await page.$$('input');
  if (inputsO.length >= 2) {
    await inputsO[0].type('dave');
    await inputsO[1].type('123');
  }
  const submitO = await page.$('button[type="submit"]');
  if (submitO) await submitO.click();
  await new Promise(r => setTimeout(r, 2000));
  await page.goto('http://localhost:3000/rooms/J990GT', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await snap('role_9_observer_view.png');

  // Step 10 & 11: Safeguard & Offline
  await snap('alert_10_safeguard.png');
  await page.setOfflineMode(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await new Promise(r => setTimeout(r, 1500));
  await snap('offline_11_banner.png');

  console.log('All exhaustive visual inspection steps finished!');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
}

run().catch(e => {
  console.error('Visual test error:', e);
  process.exit(1);
});
