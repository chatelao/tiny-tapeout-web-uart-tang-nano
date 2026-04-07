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

            # Wait for testsets to load
            page.wait_for_selector("#testsetSelect option:nth-child(5)", timeout=10000)

            testset_options = page.locator("#testsetSelect option").all_inner_texts()
            print("Testset Options count:", len(testset_options))
            if "tt3647_systolic.yaml" in testset_options:
                print("tt3647_systolic.yaml is PRESENT")
            else:
                print("tt3647_systolic.yaml is MISSING")

            browser.close()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    check_project()
