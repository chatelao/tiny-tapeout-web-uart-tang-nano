const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Tiny Tapeout Web Tester', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the local index.html file
    const filePath = 'file://' + path.resolve(__dirname, '../web/index.html');
    await page.goto(filePath);
  });

  test('initial state is simulation mode', async ({ page }) => {
    const statusLabel = page.locator('#statusLabel');
    await expect(statusLabel).toHaveText('Mode: Simulation');

    const connectBtn = page.locator('#connectBtn');
    await expect(connectBtn).toHaveText('Connect');
  });

  test('switching to simulation (hardware mode) and back', async ({ page }) => {
    const connectBtn = page.locator('#connectBtn');
    const statusLabel = page.locator('#statusLabel');

    // Handle the window.confirm that appears when WebSerial is not supported
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // Click Connect (which will trigger simulation since WebSerial is missing in headless environment)
    await connectBtn.click();

    await expect(statusLabel).toHaveText('Mode: Real Hardware');
    await expect(connectBtn).toHaveText('Simulation');

    // Switch back
    await connectBtn.click();
    await expect(statusLabel).toHaveText('Mode: Simulation');
    await expect(connectBtn).toHaveText('Connect');
  });

  test('sending a transaction in simulation mode', async ({ page }) => {
    // Set ui_in to 0x01
    await page.fill('#ui_in_hex', '01');
    // Set uio_in to 0x02
    await page.fill('#uio_in_hex', '02');

    // Click Send
    await page.click('#sendReceive');

    // Check history table
    const historyBody = page.locator('#history');
    await expect(historyBody.locator('tr')).toHaveCount(2); // 0x01+0x02=0x03 and clk=1 then clk=0 for 1/0 default

    // Check console for simulation logs
    const consoleDiv = page.locator('#console');
    await expect(consoleDiv).toContainText('010207 (Sim)'); // ui=01, uio=02, ctrl=07 (clk=1, rst=1, ena=1)
    await expect(consoleDiv).toContainText('030000 (Sim)'); // result 0x03
  });
});
