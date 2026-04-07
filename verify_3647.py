import subprocess
import time
import os
import signal
import sys
from playwright.sync_api import sync_playwright, expect

def run_verify():
    # Kill any existing server on port 8000
    subprocess.run(["fuser", "-k", "8000/tcp"], stderr=subprocess.DEVNULL)

    server_process = subprocess.Popen(
        ["python3", "-m", "http.server", "8000", "--directory", "web"],
        stdout=sys.stdout,
        stderr=sys.stderr
    )
    time.sleep(2)  # Wait for server to start

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()

            print("Navigating to http://localhost:8000")
            page.goto("http://localhost:8000")

            # Verify that tt3647 is selected by default
            expect(page.locator("#wasmEngineSelect")).to_have_value("tt3647")
            print("Verified tt3647 is default engine.")

            # Wait for WASM to be ready
            page.wait_for_selector("#useFullWasm", state="attached")
            if not page.is_checked("#useFullWasm"):
                page.check("#useFullWasm")

            # Perform a transaction to see if it works
            page.fill("#ui_in_hex", "01")
            page.press("#ui_in_hex", "Enter")
            page.click("#sendReceive")

            # Wait for console to show "Received (Emulated WASM)"
            expect(page.locator("#console")).to_contain_text("Received (Emulated WASM)", timeout=10000)
            print("Verified tt3647 simulation is running.")

            browser.close()
    except Exception as e:
        print(f"An error occurred: {e}")
        if 'page' in locals():
            page.screenshot(path="verify_3647_failure.png")
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_verify()
