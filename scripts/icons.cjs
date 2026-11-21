// Renders public/icon.svg to the PNG icons the web app manifest needs:
//   node scripts/icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // `maskable`: the drawing shrunk into the safe zone, on the dungeon's dark.
  for (const [name, size, inset] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.12], ['apple-touch-icon.png', 180, 0]]) {
    await page.setViewportSize({ width: size, height: size });
    const pad = Math.round(size * inset);
    await page.setContent(
      `<body style="margin:0;background:#110e0c"><div style="padding:${pad}px;width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace('<svg ', `<svg width="${size - pad * 2}" height="${size - pad * 2}" `)}</div></body>`,
    );
    await page.screenshot({ path: path.join(__dirname, '../public', name), omitBackground: false });
  }
  await browser.close();
})();
