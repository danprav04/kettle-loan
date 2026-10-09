const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const KETTLE_PATH = 'M12.5,3C7.81,3 4,5.69 4,9V9C4,10.19 4.5,11.34 5.44,12.33C4.53,13.5 4,14.96 4,16.5C4,17.64 4,18.83 4,20C4,21.11 4.89,22 6,22H19C20.11,22 21,21.11 21,20C21,18.85 21,17.61 21,16.5C21,15.28 20.66,14.07 20,13L22,11L19,8L16.9,10.1C15.58,9.38 14.05,9 12.5,9C10.65,9 8.95,9.53 7.55,10.41C7.19,9.97 7,9.5 7,9C7,7.21 9.46,5.75 12.5,5.75V5.75C13.93,5.75 15.3,6.08 16.33,6.67L18.35,4.65C16.77,3.59 14.68,3 12.5,3M12.5,11C12.84,11 13.17,11.04 13.5,11.09C10.39,11.57 8,14.25 8,17.5V20H6V17.5A6.5,6.5 0 0,1 12.5,11Z';

// 1. Standard App Icon SVG (512x512 squircle)
function getAppIconSvg(size = 512, isMaskable = false) {
  const rx = isMaskable ? 0 : Math.round(size * 0.22);
  const scale = (size * (isMaskable ? 0.55 : 0.62)) / 24;
  const offset = (size - 24 * scale) / 2;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1f2e" />
      <stop offset="50%" stop-color="#13141f" />
      <stop offset="100%" stop-color="#090a10" />
    </linearGradient>
    <linearGradient id="kettleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a5b4fc" />
      <stop offset="45%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
    <radialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.32" />
      <stop offset="60%" stop-color="#6366f1" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
    </radialGradient>
    <filter id="kettleShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${Math.max(1, Math.round(size * 0.015))}" stdDeviation="${Math.max(1, Math.round(size * 0.025))}" flood-color="#4f46e5" flood-opacity="0.4" />
    </filter>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.05" />
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bgGrad)" />

  <!-- Ambient Glow Behind Kettle -->
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.38}" fill="url(#ambientGlow)" />

  <!-- Subtle Border (for non-maskable) -->
  ${!isMaskable ? `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${rx - 1}" fill="none" stroke="url(#borderGrad)" stroke-width="${Math.max(1, Math.round(size * 0.006))}" />` : ''}

  <!-- Kettle Shape -->
  <g transform="translate(${offset}, ${offset}) scale(${scale})" filter="url(#kettleShadow)">
    <path fill="url(#kettleGrad)" d="${KETTLE_PATH}" />
  </g>
</svg>
`.trim();
}

// 2. Crisp Vector Favicon SVG (adaptive or standalone)
function getVectorFaviconSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1f2030" />
      <stop offset="100%" stop-color="#0a0a12" />
    </linearGradient>
    <linearGradient id="kettle" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a5b4fc" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="url(#bg)" stroke="#818cf8" stroke-width="0.75" stroke-opacity="0.35"/>
  <g transform="translate(4.5, 4.5) scale(0.958)">
    <path fill="url(#kettle)" d="${KETTLE_PATH}"/>
  </g>
</svg>
`.trim();
}

async function renderPng(browser, svgString, width, height, outputPath) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;overflow:hidden;}body{background:transparent;width:${width}px;height:${height}px;}</style></head><body>${svgString}</body></html>`;
  await page.setContent(html);
  const buffer = await page.screenshot({ type: 'png', omitBackground: true });
  fs.writeFileSync(outputPath, buffer);
  await page.close();
  console.log(`Generated: ${outputPath} (${width}x${height}, ${buffer.length} bytes)`);
}

async function run() {
  const publicIconsDir = path.resolve(__dirname, '../public/icons');
  const publicDir = path.resolve(__dirname, '../public');
  const appDir = path.resolve(__dirname, '../src/app');

  if (!fs.existsSync(publicIconsDir)) {
    fs.mkdirSync(publicIconsDir, { recursive: true });
  }

  // Write SVG icons
  const vectorFavicon = getVectorFaviconSvg();
  fs.writeFileSync(path.join(appDir, 'icon.svg'), vectorFavicon);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), vectorFavicon);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), vectorFavicon);
  console.log('Saved icon.svg & favicon.svg');

  // Launch browser for rendering PNGs
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 512x512
    const svg512 = getAppIconSvg(512, false);
    await renderPng(browser, svg512, 512, 512, path.join(publicIconsDir, 'icon-512x512.png'));

    // 192x192
    const svg192 = getAppIconSvg(192, false);
    await renderPng(browser, svg192, 192, 192, path.join(publicIconsDir, 'icon-192x192.png'));

    // 180x180 (Apple touch icon)
    const svg180 = getAppIconSvg(180, false);
    await renderPng(browser, svg180, 180, 180, path.join(publicIconsDir, 'apple-touch-icon.png'));
    await renderPng(browser, svg180, 180, 180, path.join(appDir, 'apple-icon.png'));

    // Maskable icons (full bleed)
    const svgMaskable512 = getAppIconSvg(512, true);
    await renderPng(browser, svgMaskable512, 512, 512, path.join(publicIconsDir, 'icon-maskable-512x512.png'));
    const svgMaskable192 = getAppIconSvg(192, true);
    await renderPng(browser, svgMaskable192, 192, 192, path.join(publicIconsDir, 'icon-maskable-192x192.png'));

    // Render 256 for ICO generation
    const temp256Path = path.join(publicIconsDir, 'temp-256.png');
    await renderPng(browser, svg512, 256, 256, temp256Path);

  } finally {
    await browser.close();
  }

  // Generate multi-size favicon.ico with python Pillow
  const pyScriptPath = path.resolve(__dirname, 'make_ico.py');
  execSync(`python "${pyScriptPath}"`, { stdio: 'inherit' });

  // Clean temp
  const tempPath = path.join(publicIconsDir, 'temp-256.png');
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  console.log('All icons generated successfully!');
}

run().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
