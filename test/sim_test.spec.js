const { test, expect } = require('@playwright/test');

test('simulation mode works', async ({ page }) => {
  await page.goto('http://localhost:8000');

  await expect(page.locator('#statusLabel')).toHaveText('Mode: Simulation');

  await page.fill('#ui_in_hex', '0A');
  await page.fill('#uio_in_hex', '05');
  await page.click('#sendReceive');

  const history = page.locator('#history tr');
  // Two rows because clk is '1/0' by default
  await expect(history).toHaveCount(2);
});
