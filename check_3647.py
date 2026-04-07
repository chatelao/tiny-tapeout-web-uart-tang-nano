import subprocess
import time
import os
import signal
import sys
from playwright.sync_api import sync_playwright

def check_project():
    # Kill any existing server on port 8000
    subprocess.run(["fuser", "-k", "8000/tcp"], stderr=subprocess.DEVNULL)

    server_process = subprocess.Popen(
        ["python3", "-m", "http.server", "8000", "--directory", "web"],
        stdout=sys.stdout,
        stderr=sys.stderr
    )
    time.sleep(2)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto("http://localhost:8000")

            # Wait for dropdown to populate
            try:
                page.wait_for_selector("#wasmEngineSelect option[value='tt3647']", timeout=10000, state="attached")
            except:
                pass

            options = page.locator("#wasmEngineSelect option").all_inner_texts()
            print("WASM Options:", options)

            values = page.locator("#wasmEngineSelect option").all_attrs()
            print("WASM Values:", [v['value'] for v in values])

            testset_options = page.locator("#testsetSelect option").all_inner_texts()
            print("Testset Options:", testset_options)

            browser.close()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    check_project()
