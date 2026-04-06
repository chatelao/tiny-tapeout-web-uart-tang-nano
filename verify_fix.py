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

            print("Navigating to http://localhost:8000?wasm=tt3990")
            page.goto("http://localhost:8000?wasm=tt3990")

            # Wait for WASM to be ready
            page.wait_for_selector("#useFullWasm", state="attached")
            if not page.is_checked("#useFullWasm"):
                page.check("#useFullWasm")

            # Wait for testsets to load
            page.wait_for_selector("#testsetSelect option:nth-child(2)", state="attached", timeout=30000)

            # Select and load testset
            page.select_option("#testsetSelect", label="tt3990_fp8_mul.yaml")
            page.click("#loadTestset")
            expect(page.locator("#testsetInfo")).to_contain_text("OCP MXFP8 Streaming MAC Unit")

            # Run testset
            page.click("#runTestset")

            # Wait for some cycles and take screenshot
            time.sleep(5)

            os.makedirs("/home/jules/verification", exist_ok=True)
            page.screenshot(path="/home/jules/verification/tt3990_fix_final.png")
            print("Screenshot saved to /home/jules/verification/tt3990_fix_final.png")
            browser.close()
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_verify()
