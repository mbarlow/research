const { test } = require('@playwright/test');

test('diagnose splat viewer', async ({ page }) => {
  const logs = [];
  page.on('console', (msg) => logs.push(`CONSOLE ${msg.type()} ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`PAGEERROR ${err.message}`));

  await page.goto('http://localhost:3070/#/post/2026-02-14-gaussian-splatting-smartphone-companion', { waitUntil: 'networkidle' });
  await page.waitForTimeout(10000);

  const info = await page.evaluate(() => {
    const sceneEl = document.querySelector('[data-scene="gaussian-splat-viewer.js"]');
    const canvasEls = sceneEl ? Array.from(sceneEl.querySelectorAll('canvas')) : [];
    const sceneStatusEl = sceneEl ? sceneEl.querySelector('.scene-status') : null;
    const rect = sceneEl ? sceneEl.getBoundingClientRect() : null;
    const canvasRects = canvasEls.map((c) => {
      const r = c.getBoundingClientRect();
      return {
        clientW: c.clientWidth,
        clientH: c.clientHeight,
        width: c.width,
        height: c.height,
        rectW: r.width,
        rectH: r.height,
        style: c.getAttribute('style') || '',
      };
    });
    return {
      hasScene: !!sceneEl,
      sceneRect: rect ? { w: rect.width, h: rect.height, x: rect.x, y: rect.y } : null,
      sceneInlineStyle: sceneEl ? sceneEl.getAttribute('style') || '' : '',
      sceneComputedHeight: sceneEl ? getComputedStyle(sceneEl).height : '',
      sceneStatusText: sceneStatusEl ? sceneStatusEl.textContent.trim() : '',
      canvasCount: canvasEls.length,
      canvasRects,
      sceneInner: sceneEl ? sceneEl.innerHTML.slice(0, 500) : '',
    };
  });

  console.log('---DIAG START---');
  console.log(JSON.stringify(info, null, 2));
  for (const l of logs) console.log(l);
  console.log('---DIAG END---');

  await page.screenshot({ path: '/tmp/splat-diagnose-full.png', fullPage: true });
});
