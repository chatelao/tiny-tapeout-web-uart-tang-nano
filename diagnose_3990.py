import subprocess
import time
import os
import signal
import sys
from playwright.sync_api import sync_playwright

def run_diagnostic():
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
            url = "http://localhost:8000/?wasm=tt3990"
            print(f"Loading {url}")
            page.goto(url)

            # page.on("console", lambda msg: print(f"BROWSER: {msg.text}"))

            # Wait for initialized log
            print("Waiting for WASM initialization...")
            page.wait_for_function("typeof window.digitalTwin !== 'undefined'", timeout=20000)

            diag_script = """
            (() => {
                const results = [];
                const dt = window.digitalTwin;

                results.push("Methods: " + Object.getOwnPropertyNames(Object.getPrototypeOf(dt)).join(", "));

                function test(c0_ui, c1_ui) {
                    // Reset
                    dt.set_rst_n(false);
                    dt.step();
                    dt.step();
                    dt.set_rst_n(true);

                    // Cycle 0
                    dt.set_ui_in(c0_ui);
                    dt.set_uio_in(0);
                    dt.set_ena(true);
                    dt.step();
                    const uo0 = dt.get_uo_out();

                    // Cycle 1
                    dt.set_ui_in(c1_ui);
                    dt.step();
                    const uo1 = dt.get_uo_out();
                    return { uo0, uo1 };
                }

                results.push("Test 1 (C0 UI=0x00, C1 UI=0x55): " + JSON.stringify(test(0x00, 0x55)));
                results.push("Test 2 (C0 UI=0x20, C1 UI=0x55): " + JSON.stringify(test(0x20, 0x55)));
                results.push("Test 3 (C0 UI=0x40, C1 UI=0x55): " + JSON.stringify(test(0x40, 0x55)));

                return results;
            })()
            """

            diag_results = page.evaluate(diag_script)
            for res in diag_results:
                print(res)

            browser.close()
    finally:
        os.kill(server_process.pid, signal.SIGTERM)

if __name__ == "__main__":
    run_diagnostic()
