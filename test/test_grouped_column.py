import time
import subprocess
from playwright.sync_api import sync_playwright

def test_grouped_column():
    # Start local server
    server_process = subprocess.Popen(['python3', '-m', 'http.server', '8000'], cwd='web')
    time.sleep(2)  # Give server time to start

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto('http://localhost:8000/index.html')

            # 1. Set clk to 1/0 mode
            page.select_option('#clk', '1/0')

            # 2. Perform 4 transactions with specific ui_in values
            # Since uio_in is 0 and it's XOR mode by default, uo_out will match ui_in
            test_values = [0xAA, 0xBB, 0xCC, 0xDD]

            for val in test_values:
                # Set ui_in_hex
                page.fill('#ui_in_hex', f'{val:02X}')
                page.press('#ui_in_hex', 'Enter')
                # Click Send
                page.click('#sendReceive')
                # Wait for history row to appear
                page.wait_for_selector(f'#history tr td:has-text("0x{val:02X}")')

            # 3. Enable Grouped column and configure it
            # Need to use force=True or ensure it's visible if hidden by CSS
            # But select_option usually works on hidden elements if we are careful,
            # however Playwright waits for visibility.
            # Let's use dispatchEvent or set it via JS if it's "hidden" by class.
            page.evaluate("document.getElementById('table-type-grouped').value = 'hex'")
            page.evaluate("document.getElementById('table-type-grouped').dispatchEvent(new Event('change'))")
            # All these selectors are in the same header which might be considered "not visible" if it's too small or something,
            # but they should be visible now that 'hidden' is gone from #table-type-grouped.
            # However, if the column itself is still "display: none" during the transition, Playwright might complain.
            # Let's use evaluate for all of them to be safe and fast.
            page.evaluate("document.getElementById('table-type-grouped-signal').value = 'uo_out'")
            page.evaluate("document.getElementById('table-type-grouped-signal').dispatchEvent(new Event('change'))")
            page.evaluate("document.getElementById('table-type-grouped-size').value = '4'")
            page.evaluate("document.getElementById('table-type-grouped-size').dispatchEvent(new Event('change'))")

            # 4. Verify grouped_result in input-row
            # The expected value should be 0xDDCCBBAA (most recent is least significant byte in my implementation)
            # wait, let's re-read getGroupedValue logic
            # for (let i = historyIndex; i >= 0; i--) { ...
            #   const shift = BigInt(cyclesFound * 8);
            #   value |= BigInt(entry[signal]) << shift;
            #   cyclesFound++;
            # }
            # So historyData[last] is shift 0, historyData[last-2] (previous falling edge) is shift 8, etc.
            # My performTransaction in 1/0 mode does clk=1 then clk=0.
            # So test_values[3] (0xDD) results in TWO rows. The second row has clk=0 (falling edge).
            # test_values[2] (0xCC) results in TWO rows. The fourth row from top has clk=0.

            # Expected: 0xAABBCCDD (Oldest is MSB)
            expected_grouped_hex = "0xAABBCCDD"

            # Debug: print what we have
            time.sleep(2)
            actual_text = page.inner_text('#grouped_result')
            print(f"Actual grouped result: '{actual_text}'")

            # Use wait_for_function to ensure the value is updated
            page.wait_for_function(f'document.getElementById("grouped_result").innerText.includes("{expected_grouped_hex}")')

            grouped_text = page.inner_text('#grouped_result')
            print(f"Grouped Result: {grouped_text}")
            assert expected_grouped_hex in grouped_text

            # 5. Check history rows
            # The top row should have the same grouped value
            history_grouped = page.inner_text('#history tr:first-child .col-grouped')
            print(f"History Top Row Grouped: {history_grouped}")
            assert expected_grouped_hex in history_grouped

            print("Grouped Column Verification Passed!")

    finally:
        server_process.terminate()

if __name__ == '__main__':
    test_grouped_column()
