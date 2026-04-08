import subprocess
import time
import os
import signal
from playwright.sync_api import sync_playwright, expect

def run_test():
    server_process = subprocess.Popen(
        ["python3", "-m", "http.server", "8000", "--directory", "web"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(2)  # Wait for server to start

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto("http://localhost:8000")

            # 1. Set ui_in to 0x00 and send
            print("Testing 0x00 highlighting...")
            page.fill("#ui_in_hex", "00")
            page.press("#ui_in_hex", "Enter")
            page.fill("#uio_in_hex", "00")
            page.press("#uio_in_hex", "Enter")
            page.click("#sendReceive")

            # In simulation mode, 0x00 ^ 0x00 = 0x00
            history_row = page.locator("#history tr").first
            ui_in_span = history_row.locator(".col-ui_in span")
            uo_out_span = history_row.locator(".col-uo_out span")

            expect(ui_in_span).to_have_class("value-zero")
            expect(uo_out_span).to_have_class("value-zero")

            # 2. Set ui_in to 0xFF and uio_in to 0x00 and send
            print("Testing 0xFF highlighting...")
            page.fill("#ui_in_hex", "FF")
            page.press("#ui_in_hex", "Enter")
            page.click("#sendReceive")

            # In simulation mode, 0xFF ^ 0x00 = 0xFF
            history_row = page.locator("#history tr").first
            ui_in_span = history_row.locator(".col-ui_in span")
            uo_out_span = history_row.locator(".col-uo_out span")

            expect(ui_in_span).to_have_class("value-max")
            expect(uo_out_span).to_have_class("value-max")

            print("Value highlighting test passed!")
            browser.close()
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_test()
